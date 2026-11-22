import { atOnDay, localDay } from '@/core/model/time';
import { archiveListItem, addListItem } from '@/core/usecases/lists';
import {
  dayLog,
  dayStatus,
  daysWithEntries,
  treatmentShortcuts,
  addMonths,
  monthOf,
  monthOverview,
  monthShape,
} from '@/core/usecases/dayLog';
import { reportPhotos, reportPreview } from '@/core/usecases/backup';
import { addPhoto } from '@/core/usecases/photos';
import { saveCheckIn, logStool } from '@/core/usecases/checkin';
import { applyTreatment, logReaction } from '@/core/usecases/events';
import { logMeal } from '@/core/usecases/logMeal';
import { addArea, archiveSkinArea, logNailEntry, logSkinEntry } from '@/core/usecases/skin';
import { areasWithEntries, areaTimeline, resolveJumpDay, trendPoints } from '@/core/usecases/timeline';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps, syntheticScores as scores } from './helpers/fixtures';

const d = (iso: string) => new Date(iso);

describe('the day log (UX-2)', () => {
  it('UX-2 lists everything of one local day, oldest first, and nothing of the days around it', async () => {
    const deps = makeDeps(new MemoryRepo());
    const meal = await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: d('2026-01-15T07:00:00.000Z') });
    await logReaction(deps, { mealId: meal.id, symptoms: ['hives'], at: d('2026-01-15T08:00:00.000Z') });
    await logStool(deps, { bristol: 4, at: d('2026-01-15T06:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: d('2026-01-14T10:00:00.000Z') });
    await logMeal(deps, { description: 'Synthetic soup', ingredients: [], at: d('2026-01-16T10:00:00.000Z') });
    const rows = await dayLog(deps, '2026-01-15');
    expect(rows.map((r) => r.kind)).toEqual(['stoolEntries', 'meals', 'reactions']);
    expect(rows[1]).toMatchObject({ id: meal.id, record: { description: 'Synthetic oats' } });
  });

  it("NF-4 a day is the entry's own local day: 23:30 in Warsaw belongs to that evening, not the next UTC day", async () => {
    const deps = makeDeps(new MemoryRepo());
    await logMeal(deps, { description: 'Synthetic late meal', ingredients: [], at: d('2026-01-15T22:30:00.000Z') }); // 23:30 Warsaw
    expect((await dayLog(deps, '2026-01-15')).map((r) => r.kind)).toEqual(['meals']);
    expect(await dayLog(deps, '2026-01-16')).toEqual([]);
  });

  it('SK-11 the status holds the Daily health record of the day and how many meals it has', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await dayStatus(deps, '2026-01-15')).toMatchObject({ mealCount: 0, checkIn: null });
    await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: d('2026-01-15T07:00:00.000Z') });
    await saveCheckIn(deps, { at: d('2026-01-15T20:00:00.000Z') });
    expect(await dayStatus(deps, '2026-01-15')).toMatchObject({ checkIn: { day: '2026-01-15' }, mealCount: 1 });
  });
});

describe('treatment shortcuts (IN-11)', () => {
  async function setup() {
    const deps = makeDeps(new MemoryRepo());
    const cream = await addListItem(deps, 'treatments', 'Synthetic cream');
    const oil = await addListItem(deps, 'treatments', 'Synthetic oil');
    return { deps, cream, oil };
  }

  it('IN-11 a combination becomes a shortcut after two uses, whatever the order of its areas', async () => {
    const { deps, cream } = await setup();
    await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin', 'area-neck'], at: d('2026-01-10T08:00:00.000Z') });
    expect(await treatmentShortcuts(deps)).toEqual([]);
    await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-neck', 'area-chin'], at: d('2026-01-11T08:00:00.000Z') });
    expect(await treatmentShortcuts(deps)).toEqual([{ treatmentId: cream.id, areaIds: ['area-chin', 'area-neck'], count: 2 }]);
  });

  it('IN-11 shows at most three, most used first, and never an archived treatment or area', async () => {
    const { deps, cream, oil } = await setup();
    const use = (treatmentId: string, areaId: string, n: number) =>
      Promise.all(
        Array.from({ length: n }, (_, i) => applyTreatment(deps, { treatmentId, areaIds: [areaId], at: d(`2026-01-1${i}T08:00:00.000Z`) })),
      );
    await use(cream.id, 'area-chin', 2);
    await use(cream.id, 'area-neck', 4);
    await use(oil.id, 'area-chin', 3);
    await use(oil.id, 'area-sternum', 2);
    const shortcuts = await treatmentShortcuts(deps);
    expect(shortcuts).toHaveLength(3); // four combinations qualify
    expect(shortcuts.slice(0, 2).map((s) => [s.areaIds[0], s.count])).toEqual([
      ['area-neck', 4],
      ['area-chin', 3],
    ]);
    await archiveSkinArea(deps, 'area-neck');
    await archiveListItem(deps, 'treatments', oil.id);
    expect((await treatmentShortcuts(deps)).map((s) => s.treatmentId)).toEqual([cream.id]);
  });
});

describe('entries on a chosen day (UX-2)', () => {
  const tz = 'Europe/Warsaw';
  it('UX-2 today is simply now; a past day gets the current clock time on that day, a future time is never produced', () => {
    const now = new Date('2026-01-15T10:30:00.000Z'); // 11:30 in Warsaw
    expect(atOnDay('2026-01-15', now, tz)).toBe(now);
    expect(atOnDay('2026-01-10', now, tz).toISOString()).toBe('2026-01-10T10:30:00.000Z');
  });

  it('UX-2 the day is the local day: late evening stays on the chosen day', () => {
    const now = new Date('2026-01-15T22:45:00.000Z'); // 23:45 in Warsaw
    const at = atOnDay('2026-01-10', now, tz);
    expect(localDay(at.toISOString(), tz)).toBe('2026-01-10');
    expect(at.toISOString()).toBe('2026-01-10T22:45:00.000Z');
  });
});

describe('days list and report preview (UX-1, EX-14)', () => {
  it('UX-1 lists the days with entries newest first, with a count and whether a Daily health record logged the day', async () => {
    const deps = makeDeps(new MemoryRepo());
    await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: d('2026-01-10T08:00:00.000Z') });
    await logMeal(deps, { description: 'Synthetic soup', ingredients: [], at: d('2026-01-12T08:00:00.000Z') });
    await saveCheckIn(deps, { at: d('2026-01-12T20:00:00.000Z') });
    expect(await daysWithEntries(deps)).toEqual([
      { day: '2026-01-12', entries: 2, complete: true },
      { day: '2026-01-10', entries: 1, complete: false },
    ]);
    expect(await daysWithEntries(deps, 1)).toHaveLength(1);
  });

  it('EX-14 the report preview counts entries and photos of the period, and the sensitive ones apart', async () => {
    const deps = makeDeps(new MemoryRepo());
    const inside = await logSkinEntry(deps, { areaId: 'area-penis', scores, at: d('2026-01-12T08:00:00.000Z') });
    const outside = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: d('2026-02-12T08:00:00.000Z') });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: inside.id, sourceUri: 'a' });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: inside.id, sourceUri: 'b', sensitive: false });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: outside.id, sourceUri: 'c' });
    expect(await reportPreview(deps, { from: '2026-01-01', to: '2026-01-31' })).toEqual({ entries: 1, photos: 2, sensitivePhotos: 1 });
    expect(await reportPreview(deps, {})).toMatchObject({ entries: 2, photos: 3 });
    await expect(reportPreview(deps, { from: 'nope' })).rejects.toThrow();
  });

  it('EX-4, EX-7 the report lists the photos of the period to pick from, with the area of their entry, oldest first', async () => {
    const deps = makeDeps(new MemoryRepo());
    const inside = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: d('2026-01-12T08:00:00.000Z') });
    const outside = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: d('2026-02-12T08:00:00.000Z') });
    const b = await addPhoto(deps, { entryKind: 'skinEntry', entryId: inside.id, sourceUri: 'b', at: d('2026-01-12T09:00:00.000Z') });
    const a = await addPhoto(deps, { entryKind: 'skinEntry', entryId: inside.id, sourceUri: 'a', at: d('2026-01-12T08:30:00.000Z') });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: outside.id, sourceUri: 'c' });
    const list = await reportPhotos(deps, { from: '2026-01-01', to: '2026-01-31' });
    expect(list.map((p) => p.photo.id)).toEqual([a.id, b.id]);
    expect(list.every((p) => p.areaId === 'area-chin')).toBe(true);
    expect(await reportPhotos(deps, {})).toHaveLength(3);
  });
});

describe('area timeline (SK-8)', () => {
  it('SK-8 groups an area by the entry day, newest first, with each entry beside its photos and the derived flare marks', async () => {
    const deps = makeDeps(new MemoryRepo());
    const early = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: d('2026-01-10T08:00:00.000Z') });
    const late = await logSkinEntry(deps, { areaId: 'area-chin', scores: { ...scores, severity: 9 }, at: d('2026-01-12T20:00:00.000Z') });
    const other = await logSkinEntry(deps, { areaId: 'area-neck', scores, at: d('2026-01-12T08:00:00.000Z') });
    const nail = await addArea(deps, 'Synthetic thumb', 'nail');
    await logNailEntry(deps, { areaId: nail.id, stage: 'white', extent: 'none', at: d('2026-01-12T09:00:00.000Z') });
    const p1 = await addPhoto(deps, { entryKind: 'skinEntry', entryId: early.id, sourceUri: 'a', at: d('2026-01-10T08:05:00.000Z') });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: other.id, sourceUri: 'b' });
    const days = await areaTimeline(deps, 'area-chin');
    expect(days.map((x) => x.day)).toEqual(['2026-01-12', '2026-01-10']);
    expect(days[0]!.entries.map((e) => e.entry.id)).toEqual([late.id]);
    expect(days[0]!.flares.map((f) => f.kind)).toEqual(['start']); // severity 9 is a derived flare start
    expect(days[1]!.entries[0]).toMatchObject({ kind: 'skin', photos: [{ id: p1.id }] });
    expect(await areaTimeline(deps, nail.id)).toMatchObject([{ day: '2026-01-12', entries: [{ kind: 'nail', photos: [] }] }]);
    expect(await areaTimeline(deps, 'area-sternum')).toEqual([]);
  });

  it('SK-8 a date jump lands on the day, the nearest earlier day with an entry, or the oldest day, and never filters', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(resolveJumpDay(await areaTimeline(deps, 'area-chin'), '2026-01-11')).toBeNull(); // no entries, nowhere to go
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: d('2026-01-10T08:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: d('2026-01-14T08:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: d('2026-01-20T08:00:00.000Z') });
    const days = await areaTimeline(deps, 'area-chin'); // newest first: 20, 14, 10
    expect(resolveJumpDay(days, '2026-01-14')).toEqual({ day: '2026-01-14', how: 'exact' });
    expect(resolveJumpDay(days, '2026-01-17')).toEqual({ day: '2026-01-14', how: 'earlier' }); // not the later 20th
    expect(resolveJumpDay(days, '2026-01-13')).toEqual({ day: '2026-01-10', how: 'earlier' });
    expect(resolveJumpDay(days, '2026-02-01')).toEqual({ day: '2026-01-20', how: 'earlier' }); // after the last entry
    expect(resolveJumpDay(days, '2026-01-02')).toEqual({ day: '2026-01-10', how: 'oldest' }); // before the first entry
    expect(days.map((x) => x.day)).toEqual(['2026-01-20', '2026-01-14', '2026-01-10']); // the list itself is untouched
  });

  it('SK-8 trend points average a day, go oldest first, carry the derived flare marks, and skip other kinds', async () => {
    const deps = makeDeps(new MemoryRepo());
    await logSkinEntry(deps, { areaId: 'area-chin', scores: { ...scores, severity: 2 }, at: d('2026-01-10T08:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-chin', scores: { ...scores, severity: 5 }, at: d('2026-01-10T18:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-chin', scores: { ...scores, severity: 8 }, at: d('2026-01-12T08:00:00.000Z') });
    const days = await areaTimeline(deps, 'area-chin');
    expect(trendPoints(days, 'severity')).toEqual([
      { day: '2026-01-10', value: 3.5, flare: null },
      { day: '2026-01-12', value: 8, flare: 'start' },
    ]);
    expect(trendPoints(days, 'extent')).toEqual([]);
    const nail = await addArea(deps, 'Synthetic thumb', 'nail');
    await logNailEntry(deps, { areaId: nail.id, stage: 'white', extent: 'under_quarter', at: d('2026-01-12T09:00:00.000Z') });
    await logNailEntry(deps, { areaId: nail.id, stage: 'white', extent: 'over_half', at: d('2026-01-12T10:00:00.000Z') });
    expect(trendPoints(await areaTimeline(deps, nail.id), 'extent')).toEqual([{ day: '2026-01-12', value: 3, flare: null }]);
  });

  it('SK-8 lists the areas that have entries, the most recently logged first, archived ones included', async () => {
    const deps = makeDeps(new MemoryRepo());
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: d('2026-01-10T08:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: d('2026-01-11T08:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-neck', scores, at: d('2026-01-12T08:00:00.000Z') });
    await archiveSkinArea(deps, 'area-neck');
    expect((await areasWithEntries(deps)).map((a) => [a.area.id, a.entries, a.lastDay])).toEqual([
      ['area-neck', 1, '2026-01-12'],
      ['area-chin', 2, '2026-01-11'],
    ]);
  });
});

describe('month overview (UX-10)', () => {
  it('UX-10 month helpers: neighbours across a year, days in the month, Monday-first weekday of the 1st', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(monthShape('2026-02')).toEqual({ days: 28, firstWeekday: 6 }); // 1 Feb 2026 is a Sunday
    expect(monthShape('2024-02').days).toBe(29);
    expect(monthOf('2026-01-31')).toBe('2026-01');
  });

  it('UX-10 every day of the month is listed; entries, a Daily health record and flare days are marked (NF-4, NF-7)', async () => {
    const deps = makeDeps(new MemoryRepo());
    await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: d('2026-01-10T08:00:00.000Z') });
    await saveCheckIn(deps, { at: d('2026-01-10T20:00:00.000Z'), confirmEmptyDay: true });
    await logSkinEntry(deps, { areaId: 'area-chin', scores: { ...scores, severity: 9 }, at: d('2026-01-30T08:00:00.000Z') }); // open flare into the next month
    const jan = await monthOverview(deps, '2026-01');
    expect(jan).toHaveLength(31);
    expect(jan.find((x) => x.day === '2026-01-10')).toEqual({ day: '2026-01-10', entries: 2, dailyHealth: true, flare: false });
    expect(jan.filter((x) => x.flare).map((x) => x.day)).toEqual(['2026-01-30']); // open: to the last entry
    expect(jan.find((x) => x.day === '2026-01-11')).toEqual({ day: '2026-01-11', entries: 0, dailyHealth: false, flare: false });
    expect((await monthOverview(deps, '2026-02')).every((x) => x.entries === 0 && !x.flare)).toBe(true);
  });
});
