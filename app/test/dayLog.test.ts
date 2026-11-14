import { atOnDay, localDay } from '@/core/model/time';
import { archiveListItem, addListItem } from '@/core/usecases/lists';
import { dayLog, dayStatus, treatmentShortcuts } from '@/core/usecases/dayLog';
import { saveCheckIn, logStool } from '@/core/usecases/checkin';
import { applyTreatment, logReaction } from '@/core/usecases/events';
import { logMeal } from '@/core/usecases/logMeal';
import { archiveSkinArea, logSkinEntry } from '@/core/usecases/skin';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';

const d = (iso: string) => new Date(iso);
const scores = { severity: 1, itch: 2, pain: 3, dryness: 4, scaling: 5 };

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

  it('SK-11 the status says whether the day is complete and how many meals it has', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await dayStatus(deps, '2026-01-15')).toMatchObject({ complete: false, mealCount: 0, checkIn: null });
    await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: d('2026-01-15T07:00:00.000Z') });
    await saveCheckIn(deps, { at: d('2026-01-15T20:00:00.000Z'), complete: true });
    expect(await dayStatus(deps, '2026-01-15')).toMatchObject({ complete: true, mealCount: 1 });
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
      Promise.all(Array.from({ length: n }, (_, i) => applyTreatment(deps, { treatmentId, areaIds: [areaId], at: d(`2026-01-1${i}T08:00:00.000Z`) })));
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
