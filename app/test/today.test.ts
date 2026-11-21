import { NettleError } from '@/core/model/errors';
import { logMeal } from '@/core/usecases/logMeal';
import { markExported } from '@/core/usecases/backup';
import { logSkinEntry } from '@/core/usecases/skin';
import { pinEntryType, unpinEntryType } from '@/core/usecases/preferences';
import { DEFAULT_REMINDERS, saveReminderSettings, type ReminderTexts } from '@/core/usecases/reminders';
import { checkInTimePassed, selectPills, todayContext, type PillInput } from '@/core/usecases/today';
import { saveCheckIn } from '@/core/usecases/checkin';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';

const texts: ReminderTexts = {
  checkIn: { title: 'a', body: 'b' },
  nails: { title: 'a', body: 'b' },
  backup: { title: 'a', body: 'b' },
  regular: { named: () => ({ title: 'a', body: 'b' }), hidden: () => ({ title: 'a', body: 'b' }), takenLabel: 't', appliedLabel: 'a' },
};
const flare = { period: { start: { utc: '2026-01-10T10:00:00.000Z', tz: 'Europe/Warsaw' }, end: null, areaIds: ['area-chin'] }, areas: [{ areaId: 'area-chin', severity: 8 }] } as never;
const none: PillInput = { flare: null, checkInDue: false, backupDue: false, backupDays: null, suggestions: 0 };

describe('context pills (UX-2)', () => {
  it('UX-2 pills come in the fixed order flare, Daily health, backup, suggestions', () => {
    expect(selectPills({ ...none, checkInDue: true, suggestions: 2 }).map((p) => p.kind)).toEqual(['checkin', 'suggestions']);
    expect(selectPills({ ...none, backupDue: true, suggestions: 2 }).map((p) => p.kind)).toEqual(['backup', 'suggestions']);
  });
  it('UX-2 at most two show; the flare wins over the rest', () => {
    const all = selectPills({ flare, checkInDue: true, backupDue: true, backupDays: 9, suggestions: 3 });
    expect(all.map((p) => p.kind)).toEqual(['flare', 'checkin']);
    expect(selectPills(none)).toEqual([]);
  });
});

describe('Today context (UX-2, SK-9)', () => {
  it('SK-9 the Daily health time counts from the reminder time, even when the reminder is off', async () => {
    const deps = makeDeps(new MemoryRepo()); // 2026-01-15 11:00 in Warsaw
    expect(await checkInTimePassed(deps, '2026-01-15', deps.clock.now())).toBe(false); // default 21:00
    await saveReminderSettings(deps, { ...DEFAULT_REMINDERS, checkIn: { enabled: false, hour: 8, minute: 0 } }, texts);
    expect(await checkInTimePassed(deps, '2026-01-15', deps.clock.now())).toBe(true);
    await saveReminderSettings(deps, { ...DEFAULT_REMINDERS, checkIn: { enabled: false, hour: 11, minute: 0 } }, texts);
    expect(await checkInTimePassed(deps, '2026-01-15', deps.clock.now())).toBe(true); // exactly the time
  });

  it('NF-7 with a day start of 04:00, a 02:00 reminder belongs to the next calendar date of the diary day', async () => {
    const deps = makeDeps(new MemoryRepo(), '2026-01-15T20:00:00.000Z'); // 21:00 Warsaw on the 15th
    deps.dayStart.set(4);
    await saveReminderSettings(deps, { ...DEFAULT_REMINDERS, checkIn: { enabled: false, hour: 2, minute: 0 } }, texts);
    expect(await checkInTimePassed(deps, '2026-01-15', deps.clock.now())).toBe(false); // 02:00 on the 16th is still ahead
  });

  it('UX-1 an empty diary shows the first-run card and no pills; a past day shows neither', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await todayContext(deps, '2026-01-15')).toEqual({ isToday: true, firstRun: true, pills: [] });
    expect(await todayContext(deps, '2026-01-14')).toEqual({ isToday: false, firstRun: false, pills: [] });
  });

  it('UX-2 with entries the pills follow the facts: no export yet is due, a record removes the Daily health pill', async () => {
    const deps = makeDeps(new MemoryRepo());
    await saveReminderSettings(deps, { ...DEFAULT_REMINDERS, checkIn: { enabled: false, hour: 8, minute: 0 } }, texts);
    await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: new Date('2026-01-15T07:00:00.000Z') });
    expect((await todayContext(deps, '2026-01-15')).pills.map((p) => p.kind)).toEqual(['checkin', 'backup']);
    await saveCheckIn(deps, { confirmEmptyDay: true });
    await markExported(deps);
    expect((await todayContext(deps, '2026-01-15')).pills).toEqual([]);
  });

  it('SK-6 an open flare shows first', async () => {
    const deps = makeDeps(new MemoryRepo());
    await logSkinEntry(deps, { areaId: 'area-chin', scores: { severity: 9, itch: 1, pain: 1, dryness: 1, scaling: 1 }, at: new Date('2026-01-14T10:00:00.000Z') });
    await markExported(deps);
    expect((await todayContext(deps, '2026-01-15')).pills.map((p) => p.kind)).toEqual(['flare']);
  });
});

describe('pinning (UX-2)', () => {
  it('UX-2 at most 5 entry types can be pinned; unpinning one makes room', async () => {
    const deps = makeDeps(new MemoryRepo());
    await expect(pinEntryType(deps, 'drink')).rejects.toMatchObject({ code: 'too_many_pinned' });
    await expect(pinEntryType(deps, 'drink')).rejects.toBeInstanceOf(NettleError);
    await pinEntryType(deps, 'meal'); // already pinned: allowed, no change
    await unpinEntryType(deps, 'stool');
    expect(await pinEntryType(deps, 'drink')).toHaveLength(5);
  });
});
