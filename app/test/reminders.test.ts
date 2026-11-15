import { NettleError } from '@/core/model/errors';
import {
  applyReminders,
  DEFAULT_REMINDERS,
  loadReminderSettings,
  plannedReminders,
  resolveReminderTap,
  saveReminderSettings,
  type ReminderSettings,
  type ReminderTexts,
} from '@/core/usecases/reminders';
import { saveCheckIn } from '@/core/usecases/checkin';
import { addArea, archiveSkinArea } from '@/core/usecases/skin';
import { FakeNotifier } from './fakes/fakeNotifier';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';

const texts: ReminderTexts = {
  checkIn: { title: 'Check-in', body: 'Log today' },
  nails: { title: 'Nails', body: 'Photograph nails' },
  backup: { title: 'Backup', body: 'Export your diary' },
};
const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );
const all: ReminderSettings = {
  checkIn: { enabled: true, hour: 20, minute: 30 },
  nails: { enabled: true, weekday: 7, hour: 9, minute: 15 },
  backup: { enabled: true, day: 15, hour: 10, minute: 0 },
};
const notifier = (d: ReturnType<typeof makeDeps>) => d.notifier as FakeNotifier;

describe('reminders (SK-9)', () => {
  it('SK-9 everything is off by default and nothing is scheduled', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await loadReminderSettings(deps)).toEqual(DEFAULT_REMINDERS);
    await applyReminders(deps, texts);
    expect(notifier(deps).scheduled).toEqual([]);
  });

  it('SK-9 the daily check-in and the monthly export reminder are scheduled at the chosen times', async () => {
    const deps = makeDeps(new MemoryRepo());
    await saveReminderSettings(deps, { ...all, nails: { ...all.nails, enabled: false } }, texts);
    expect(notifier(deps).scheduled).toEqual([
      { id: 'checkin', title: 'Check-in', body: 'Log today', when: { type: 'daily', hour: 20, minute: 30 } },
      { id: 'backup', title: 'Backup', body: 'Export your diary', when: { type: 'monthly', day: 15, hour: 10, minute: 0 } },
    ]);
    expect(await loadReminderSettings(deps)).toMatchObject({ checkIn: { enabled: true, hour: 20, minute: 30 } });
  });

  it('SK-9 the weekly nail reminder exists only while an active nail area exists', async () => {
    const deps = makeDeps(new MemoryRepo());
    await saveReminderSettings(deps, all, texts);
    expect(notifier(deps).scheduled.map((s) => s.id)).toEqual(['checkin', 'backup']); // no nails tracked yet
    const nail = await addArea(deps, 'Synthetic thumb', 'nail');
    await applyReminders(deps, texts);
    expect(notifier(deps).scheduled.find((s) => s.id === 'nails')).toEqual({
      id: 'nails',
      title: 'Nails',
      body: 'Photograph nails',
      when: { type: 'weekly', weekday: 7, hour: 9, minute: 15 },
    });
    await archiveSkinArea(deps, nail.id);
    await applyReminders(deps, texts);
    expect(notifier(deps).scheduled.map((s) => s.id)).toEqual(['checkin', 'backup']);
  });

  it('SK-9 switching reminders off cancels them, and replaces rather than adds on every apply', async () => {
    const deps = makeDeps(new MemoryRepo());
    await saveReminderSettings(deps, all, texts);
    await applyReminders(deps, texts);
    await applyReminders(deps, texts);
    expect(notifier(deps).scheduled.filter((s) => s.id === 'checkin')).toHaveLength(1);
    await saveReminderSettings(deps, DEFAULT_REMINDERS, texts);
    expect(notifier(deps).scheduled).toEqual([]);
  });

  it('SK-9 refused permission saves nothing and says so; turning things off needs no permission', async () => {
    const deps = makeDeps(new MemoryRepo());
    notifier(deps).granted = false;
    expect(await code(saveReminderSettings(deps, all, texts))).toBe('notifications_denied');
    expect(await loadReminderSettings(deps)).toEqual(DEFAULT_REMINDERS);
    expect(notifier(deps).scheduled).toEqual([]);
    const before = notifier(deps).permissionRequests;
    await saveReminderSettings(deps, DEFAULT_REMINDERS, texts);
    expect(notifier(deps).permissionRequests).toBe(before);
  });

  it('SK-9 rejects impossible times, weekdays and days of the month', async () => {
    const deps = makeDeps(new MemoryRepo());
    for (const bad of [
      { ...all, checkIn: { ...all.checkIn, hour: 24 } },
      { ...all, checkIn: { ...all.checkIn, minute: 60 } },
      { ...all, nails: { ...all.nails, weekday: 0 } },
      { ...all, nails: { ...all.nails, weekday: 8 } },
      { ...all, backup: { ...all.backup, day: 31 } },
      { ...all, backup: { ...all.backup, day: 0 } },
      { ...all, checkIn: { ...all.checkIn, hour: 1.5 } },
    ]) {
      expect(await code(saveReminderSettings(deps, bad, texts))).toBe('invalid_value');
    }
  });

  it('SK-9 damaged stored settings fall back to the defaults', async () => {
    const deps = makeDeps(new MemoryRepo());
    for (const raw of ['not json', '{}', JSON.stringify({ ...all, backup: { ...all.backup, day: 99 } })]) {
      await deps.settings.set('reminders', raw);
      expect(await loadReminderSettings(deps)).toEqual(DEFAULT_REMINDERS);
    }
  });

  it('SK-9 reminder texts carry no diary data, only what the caller passes', async () => {
    const deps = makeDeps(new MemoryRepo());
    await saveReminderSettings(deps, all, texts);
    await addArea(deps, 'Synthetic thumb', 'nail');
    const planned = await plannedReminders(deps, texts);
    expect(JSON.stringify(planned)).not.toContain('Synthetic thumb');
  });
});

describe('reminder taps (SK-9)', () => {
  const at = new Date('2026-01-10T20:00:00.000Z');
  const tap = (target: unknown, deliveredAt: Date | null = at) => ({ id: String(target), target, deliveredAt });

  it('SK-9 check-in: the form for the delivery day, or just Today when that day is complete', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await resolveReminderTap(deps, tap('checkin'), { hasUnsavedForm: false })).toEqual({
      route: { pathname: '/form/checkin', params: { day: '2026-01-10' } },
      viaToday: true,
    });
    await saveCheckIn(deps, { at, confirmEmptyDay: true });
    expect(await resolveReminderTap(deps, tap('checkin', new Date('2026-01-10T20:00:01.000Z')), { hasUnsavedForm: false })).toEqual({
      route: { pathname: '/today' },
      viaToday: false,
    });
  });

  it('SK-9 nails: the nail form while a nail area exists, otherwise just Today', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect((await resolveReminderTap(deps, tap('nails'), { hasUnsavedForm: false }))?.route.pathname).toBe('/today');
    await addArea(deps, 'Synthetic thumb', 'nail');
    expect(await resolveReminderTap(deps, tap('nails', new Date('2026-01-17T10:00:00.000Z')), { hasUnsavedForm: false })).toEqual({
      route: { pathname: '/form/nails' },
      viaToday: true,
    });
  });

  it('SK-9 backup opens Data and backup; an unknown target, a URL or an object opens nothing', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect((await resolveReminderTap(deps, tap('backup'), { hasUnsavedForm: false }))?.route.pathname).toBe('/settings/data');
    for (const [i, target] of ['https://example.invalid/', '/form/skin', { x: 1 }, undefined, 'Backup'].entries()) {
      expect(await resolveReminderTap(deps, { id: `n${i}`, target, deliveredAt: at }, { hasUnsavedForm: false })).toBeNull();
    }
  });

  it('SK-9 a tap is handled once, even when it did nothing because a form had unsaved changes', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await resolveReminderTap(deps, tap('backup'), { hasUnsavedForm: true })).toBeNull();
    expect(await resolveReminderTap(deps, tap('backup'), { hasUnsavedForm: false })).toBeNull(); // already handled
    expect(await resolveReminderTap(deps, tap('backup', new Date('2026-02-01T10:00:00.000Z')), { hasUnsavedForm: false })).not.toBeNull(); // the next one
  });

  it('SK-9 the scheduled reminders carry only their own id as the target', async () => {
    const deps = makeDeps(new MemoryRepo());
    await saveReminderSettings(deps, { ...DEFAULT_REMINDERS, checkIn: { enabled: true, hour: 21, minute: 0 }, backup: { enabled: true, day: 1, hour: 10, minute: 0 } }, texts);
    expect((deps.notifier as unknown as { scheduled: { id: string }[] }).scheduled.map((s) => s.id)).toEqual(['checkin', 'backup']);
  });
});
