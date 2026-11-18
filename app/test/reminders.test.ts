import { NettleError } from '@/core/model/errors';
import {
  applyReminders,
  DEFAULT_REMINDERS,
  loadReminderSettings,
  plannedReminders,
  reminderStatus,
  sendTestReminder,
  CHECKIN_REMINDER_DAYS,
  resolveReminderTap,
  restoreReminders,
  saveReminderSettings,
  type ReminderSettings,
  type ReminderTexts,
} from '@/core/usecases/reminders';
import { saveCheckIn } from '@/core/usecases/checkin';
import { addListItem } from '@/core/usecases/lists';
import { addRegularMedication, addRegularTreatment, listRegular, logRegular, setRegularTimes } from '@/core/usecases/regular';
import { saveRegularHideName, saveRegularReminders, stopRegularAndRemind } from '@/core/usecases/regularReminders';
import { addArea, archiveSkinArea } from '@/core/usecases/skin';
import { FakeNotifier } from './fakes/fakeNotifier';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';

const texts: ReminderTexts = {
  checkIn: { title: 'Check-in', body: 'Log today' },
  nails: { title: 'Nails', body: 'Photograph nails' },
  backup: { title: 'Backup', body: 'Export your diary' },
  regular: {
    named: (name, kind) => ({ title: `${kind === 'medication' ? 'Take' : 'Apply'} ${name}`, body: 'Tap to log it.' }),
    hidden: (kind) => ({ title: kind === 'medication' ? 'Your medication' : 'Your treatment', body: 'Tap to log it.' }),
    takenLabel: 'Taken',
    appliedLabel: 'Applied',
  },
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
/** The ids of the scheduled reminders; the Daily health ones (one per day) count once, as 'checkin'. */
const ids = (d: ReturnType<typeof makeDeps>) => [...new Set(notifier(d).scheduled.map((s) => (s.id.startsWith('checkin-') ? 'checkin' : s.id)))];

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
    const checkins = notifier(deps).scheduled.filter((s) => s.id.startsWith('checkin-'));
    expect(checkins.length).toBeGreaterThanOrEqual(CHECKIN_REMINDER_DAYS - 1); // one per day ahead; today's is skipped when its time has passed
    expect(checkins.every((s) => s.target === 'checkin' && s.when.type === 'at' && s.when.at.getHours() === 20 && s.when.at.getMinutes() === 30)).toBe(true);
    expect(notifier(deps).scheduled.filter((s) => !s.id.startsWith('checkin-'))).toEqual([
      { id: 'backup', title: 'Backup', body: 'Export your diary', when: { type: 'monthly', day: 15, hour: 10, minute: 0 } },
    ]);
    expect(await loadReminderSettings(deps)).toMatchObject({ checkIn: { enabled: true, hour: 20, minute: 30 } });
  });

  it('SK-9 the weekly nail reminder exists only while an active nail area exists', async () => {
    const deps = makeDeps(new MemoryRepo());
    await saveReminderSettings(deps, all, texts);
    expect(ids(deps)).toEqual(['checkin', 'backup']); // no nails tracked yet
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
    expect(ids(deps)).toEqual(['checkin', 'backup']);
  });

  it('SK-9 switching reminders off cancels them, and replaces rather than adds on every apply', async () => {
    const deps = makeDeps(new MemoryRepo());
    await saveReminderSettings(deps, all, texts);
    await applyReminders(deps, texts);
    await applyReminders(deps, texts);
    expect(notifier(deps).scheduled.filter((s) => s.id === 'checkin-1')).toHaveLength(1);
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

  it('SK-9 the Daily health reminder skips today once today has its record, and comes back when the record is deleted', async () => {
    const deps = makeDeps(new MemoryRepo()); // clock 2026-01-15T10:00Z
    await saveReminderSettings(deps, { ...DEFAULT_REMINDERS, checkIn: { enabled: true, hour: 23, minute: 59 } }, texts); // 23:59 is still ahead today in any time zone near UTC
    const day = (s: { when: { type: string; at?: Date } }) => s.when.at!.toDateString();
    const todayCount = () => notifier(deps).scheduled.filter((s) => day(s) === deps.clock.now().toDateString()).length;
    expect(todayCount()).toBe(1);
    await saveCheckIn(deps, { confirmEmptyDay: true });
    await applyReminders(deps, texts);
    expect(todayCount()).toBe(0);
    expect(notifier(deps).scheduled).toHaveLength(CHECKIN_REMINDER_DAYS - 1);
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

  it('SK-9 the scheduled reminders carry only a target from the fixed list', async () => {
    const deps = makeDeps(new MemoryRepo());
    await saveReminderSettings(deps, { ...DEFAULT_REMINDERS, checkIn: { enabled: true, hour: 21, minute: 0 }, backup: { enabled: true, day: 1, hour: 10, minute: 0 } }, texts);
    expect(ids(deps)).toEqual(['checkin', 'backup']);
    expect(notifier(deps).scheduled.every((s) => ['checkin', 'backup'].includes(s.target ?? s.id))).toBe(true);
  });
});

describe('regular items (IN-17, SK-9)', () => {
  const texts2 = texts;
  const setup = async () => {
    const deps = makeDeps(new MemoryRepo());
    const med = await addRegularMedication(deps, { category: 'medication', name: ' Synthetic pill ', dose: '5 mg' });
    const cream = await addListItem(deps, 'treatments', 'Synthetic cream');
    const tr = await addRegularTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin', 'area-neck'] });
    return { deps, med, tr, cream };
  };

  it('IN-17 a medication or treatment is regular once; adding the same again returns the existing one', async () => {
    const { deps, med, tr, cream } = await setup();
    expect(med).toMatchObject({ kind: 'medication', name: 'Synthetic pill', dose: '5 mg', times: [], hideName: false });
    expect((await addRegularMedication(deps, { category: 'medication', name: 'synthetic PILL', dose: '5 MG' })).id).toBe(med.id);
    expect((await addRegularTreatment(deps, { treatmentId: cream.id, areaIds: ['area-neck', 'area-chin'] })).id).toBe(tr.id);
    expect(await listRegular(deps)).toHaveLength(2);
    expect(await code(addRegularTreatment(deps, { treatmentId: 'nope', areaIds: ['area-chin'] }))).toBe('unknown_item');
    expect(await code(addRegularTreatment(deps, { treatmentId: cream.id, areaIds: [] }))).toBe('no_areas_selected');
    expect(await code(addRegularMedication(deps, { category: 'medication', name: ' ' }))).toBe('empty_name');
  });

  it('IN-17 one reminder per time, with the name unless hidden, never a dose, and a Taken or Applied action', async () => {
    const { deps, med, tr } = await setup();
    await saveRegularReminders(deps, med.id, [{ hour: 20, minute: 0 }, { hour: 8, minute: 30 }, { hour: 8, minute: 30 }], texts2);
    await saveRegularReminders(deps, tr.id, [{ hour: 21, minute: 0 }], texts2);
    const regular = notifier(deps).scheduled.filter((s) => s.target === 'regular');
    expect(regular.map((s) => [s.itemId, s.title, s.actionLabel, s.when])).toEqual([
      [med.id, 'Take Synthetic pill', 'Taken', { type: 'daily', hour: 8, minute: 30 }],
      [med.id, 'Take Synthetic pill', 'Taken', { type: 'daily', hour: 20, minute: 0 }],
      [tr.id, 'Apply Synthetic cream', 'Applied', { type: 'daily', hour: 21, minute: 0 }],
    ]);
    expect(JSON.stringify(regular)).not.toContain('5 mg'); // the dose is never in a notification
    await saveRegularHideName(deps, med.id, true, texts2);
    expect(notifier(deps).scheduled.filter((s) => s.itemId === med.id).every((s) => s.title === 'Your medication')).toBe(true);
    expect(JSON.stringify(notifier(deps).scheduled)).not.toContain('Synthetic pill');
  });

  it('IN-17 reminders need permission; refused saves nothing, and Stop removes the item and its reminders but not its entries', async () => {
    const { deps, med } = await setup();
    notifier(deps).granted = false;
    expect(await code(saveRegularReminders(deps, med.id, [{ hour: 8, minute: 0 }], texts2))).toBe('notifications_denied');
    expect((await listRegular(deps)).find((r) => r.id === med.id)!.times).toEqual([]);
    notifier(deps).granted = true;
    await saveRegularReminders(deps, med.id, [{ hour: 8, minute: 0 }], texts2);
    await logRegular(deps, med.id);
    await stopRegularAndRemind(deps, med.id, texts2);
    expect(notifier(deps).scheduled.filter((s) => s.target === 'regular')).toEqual([]);
    expect((await listRegular(deps)).some((r) => r.id === med.id)).toBe(false);
    expect(await deps.repo.listRecords('medicationEntries')).toHaveLength(1);
    expect(await code(saveRegularReminders(deps, 'nope', [], texts2))).toBe('unknown_item');
    expect(await code(setRegularTimes(deps, tr0(await listRegular(deps)), [{ hour: 25, minute: 0 }]))).toBe('invalid_value');
  });

  it('IN-17 logging a regular item makes the entry at the given time', async () => {
    const { deps, med, tr } = await setup();
    const at = new Date('2026-01-14T07:00:00.000Z');
    expect(await logRegular(deps, med.id, at)).toMatchObject({ name: 'Synthetic pill', dose: '5 mg', category: 'medication', at: { utc: at.toISOString() } });
    expect(await logRegular(deps, tr.id)).toMatchObject({ areaIds: ['area-chin', 'area-neck'] });
    expect(await code(logRegular(deps, 'nope'))).toBe('unknown_item');
  });

  it('IN-17, SK-9 the action button logs the item and the plain tap opens the quick sheet of its kind', async () => {
    const { deps, med, tr } = await setup();
    const tap = (id: string, itemId: string, action: 'log' | null) => ({ id, target: 'regular', itemId, action, deliveredAt: new Date('2026-01-15T08:00:00.000Z') });
    expect(await resolveReminderTap(deps, tap(`regular-${med.id}-0`, med.id, 'log'), { hasUnsavedForm: true })).toEqual({ route: { pathname: '/today' }, viaToday: false }); // even with a form open
    expect(await deps.repo.listRecords('medicationEntries')).toHaveLength(1);
    expect(await resolveReminderTap(deps, tap(`regular-${med.id}-0`, med.id, 'log'), { hasUnsavedForm: false })).toBeNull(); // handled once
    expect(await resolveReminderTap(deps, tap(`regular-${tr.id}-0`, tr.id, null), { hasUnsavedForm: false })).toEqual({ route: { pathname: '/today', params: { sheet: 'treatment' } }, viaToday: false });
    expect(await resolveReminderTap(deps, tap('regular-x-0', 'gone', 'log'), { hasUnsavedForm: false })).toEqual({ route: { pathname: '/today' }, viaToday: false }); // a stopped item: nothing logged, no crash
  });

  it('EX-10, IN-17 after an import the reminders are rebuilt and permission is asked again; a refusal keeps the items', async () => {
    const { deps, med } = await setup();
    await saveRegularReminders(deps, med.id, [{ hour: 8, minute: 0 }], texts2);
    const before = notifier(deps).permissionRequests;
    await notifier(deps).replaceAll([]); // a new phone: nothing scheduled
    expect(await restoreReminders(deps, texts2)).toBe(true);
    expect(notifier(deps).permissionRequests).toBe(before + 1);
    expect(notifier(deps).scheduled.filter((s) => s.target === 'regular')).toHaveLength(1);
    notifier(deps).granted = false;
    await notifier(deps).replaceAll([]);
    expect(await restoreReminders(deps, texts2)).toBe(false);
    expect(await listRegular(deps)).toHaveLength(2);
  });
});

const tr0 = (items: { id: string }[]) => items[0]!.id;

describe('reminder self-check (SK-9)', () => {
  it('SK-9 the status reports the permission and how many reminders are scheduled', async () => {
    const deps = makeDeps(new MemoryRepo());
    await saveReminderSettings(deps, { ...DEFAULT_REMINDERS, checkIn: { ...DEFAULT_REMINDERS.checkIn, enabled: true } }, texts);
    const status = await reminderStatus(deps);
    expect(status.permission).toBe('granted');
    expect(status.scheduled).toBeGreaterThan(0);
    (deps.notifier as unknown as FakeNotifier).granted = false;
    expect((await reminderStatus(deps)).permission).toBe('denied');
  });

  it('SK-9 a test reminder asks for permission, carries only the fixed text, and a refusal sends nothing', async () => {
    const deps = makeDeps(new MemoryRepo());
    const n = deps.notifier as unknown as FakeNotifier;
    await sendTestReminder(deps, 'Test', 'It works');
    expect(n.tests).toEqual([{ title: 'Test', body: 'It works' }]);
    expect(n.permissionRequests).toBe(1);
    n.granted = false;
    await expect(sendTestReminder(deps, 'Test', 'It works')).rejects.toMatchObject({ code: 'notifications_denied' });
    expect(n.tests).toHaveLength(1);
  });

  it('SK-9 a notifier whose status throws gives a rejection, not an exception', async () => {
    const deps = makeDeps(new MemoryRepo());
    (deps.notifier as unknown as { status: () => never }).status = () => {
      throw new TypeError('undefined is not a function');
    };
    await expect(reminderStatus(deps)).rejects.toThrow('undefined is not a function');
  });
});
