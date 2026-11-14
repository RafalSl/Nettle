import { logMeal } from '@/core/usecases/logMeal';
import { NettleError } from '@/core/model/errors';
import { localDay } from '@/core/model/time';
import { getCheckIn, logStool, saveCheckIn, setDayComplete } from '@/core/usecases/checkin';
import {
  addListItem,
  archiveListItem,
  listActiveItems,
  renameListItem,
  resetListItemName,
} from '@/core/usecases/lists';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';

const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );

describe('localDay (SK-11, NF-4)', () => {
  it('uses the timezone, not UTC', () => {
    expect(localDay('2026-01-15T23:30:00.000Z', 'Europe/Warsaw')).toBe('2026-01-16');
    expect(localDay('2026-01-15T23:30:00.000Z', 'America/New_York')).toBe('2026-01-15');
    expect(localDay('2026-07-01T22:30:00.000Z', 'Europe/Warsaw')).toBe('2026-07-02'); // summer time, UTC+2
  });
});

describe('daily tags (IN-6)', () => {
  it('IN-6 seeds the nine tags and lets the user add, rename and archive', async () => {
    const deps = makeDeps(new MemoryRepo());
    const seeded = await listActiveItems(deps, 'dailyTags');
    expect(seeded).toHaveLength(9);
    expect(seeded.every((t) => t.predefined)).toBe(true);

    const mine = await addListItem(deps, 'dailyTags', ' Synthetic tag ');
    expect(mine.name).toBe('Synthetic tag');
    await renameListItem(deps, 'dailyTags', mine.id, 'Renamed');
    await renameListItem(deps, 'dailyTags', 'tag-travel', 'Trip'); // predefined: override, id and name stay
    const all = await listActiveItems(deps, 'dailyTags');
    expect(all.find((t) => t.id === mine.id)?.name).toBe('Renamed');
    expect(all.find((t) => t.id === 'tag-travel')).toMatchObject({ name: 'travel', nameOverride: 'Trip' });
    await resetListItemName(deps, 'dailyTags', 'tag-travel');
    await archiveListItem(deps, 'dailyTags', mine.id);
    expect((await listActiveItems(deps, 'dailyTags')).some((t) => t.id === mine.id)).toBe(false);
    expect(await code(addListItem(deps, 'dailyTags', '  '))).toBe('empty_item_name');
    expect(await code(renameListItem(deps, 'dailyTags', 'nope', 'x'))).toBe('unknown_item');
  });
});

describe('daily check-in (SK-7, SK-11)', () => {
  const noon = new Date('2026-01-15T11:00:00.000Z');

  it('SK-7 saves one check-in per local day and updates it on the second save', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    const first = await saveCheckIn(deps, { at: noon, wellbeing: 7, stress: 3, bloating: true, tags: ['tag-travel', 'tag-travel'] });
    expect(first).toMatchObject({ day: '2026-01-15', wellbeing: 7, stress: 3, sleep: null, bloating: true, tags: ['tag-travel'] });
    const second = await saveCheckIn(deps, { at: new Date('2026-01-15T19:00:00.000Z'), wellbeing: 4, note: ' evening ' });
    expect(second.id).toBe(first.id);
    expect(second).toMatchObject({ wellbeing: 4, stress: null, bloating: false, tags: [], note: 'evening' });
    expect(await repo.listRecords('checkIns')).toHaveLength(1);
    await saveCheckIn(deps, { at: new Date('2026-01-16T09:00:00.000Z') });
    expect(await repo.listRecords('checkIns')).toHaveLength(2);
  });

  it('SK-7 without an explicit time it updates the day of the clock (today)', async () => {
    const deps = makeDeps(new MemoryRepo()); // clock: 2026-01-15T10:00Z
    const a = await saveCheckIn(deps, { wellbeing: 5 });
    const b = await saveCheckIn(deps, { wellbeing: 6 });
    expect(b.id).toBe(a.id);
    expect(await getCheckIn(deps, '2026-01-15')).toMatchObject({ wellbeing: 6 });
    expect(await getCheckIn(deps, '2026-01-14')).toBeNull();
  });

  it('SK-7 rejects scores outside 0-10 and unknown tags', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await code(saveCheckIn(deps, { stress: 11 }))).toBe('invalid_score');
    expect(await code(saveCheckIn(deps, { sleep: 2.5 }))).toBe('invalid_score');
    expect(await code(saveCheckIn(deps, { tags: ['nope'] }))).toBe('unknown_item');
    expect(await getCheckIn(deps, '2026-01-15')).toBeNull();
  });

  it('SK-11 closes a day, keeps the mark across saves unless told otherwise, and removes it', async () => {
    const deps = makeDeps(new MemoryRepo());
    const saved = await saveCheckIn(deps, { at: noon, wellbeing: 5, complete: true, confirmEmptyDay: true });
    expect(saved.completedAt).not.toBeNull();
    expect((await saveCheckIn(deps, { at: noon, wellbeing: 6 })).completedAt).toEqual(saved.completedAt);
    expect((await setDayComplete(deps, '2026-01-15', false)).completedAt).toBeNull();
    expect((await setDayComplete(deps, '2026-01-15', true, { confirmEmptyDay: true })).completedAt).not.toBeNull();
    expect((await saveCheckIn(deps, { at: noon, complete: false })).completedAt).toBeNull();
    expect(await code(setDayComplete(deps, '2026-02-01', true))).toBe('checkin_not_found');
  });

  it('SK-11 closing a day with no meals needs confirmation; a day with a meal closes at once', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await code(saveCheckIn(deps, { at: noon, wellbeing: 5, complete: true }))).toBe('day_has_no_meals');
    expect(await getCheckIn(deps, '2026-01-15')).toBeNull(); // nothing saved by the refused call
    await saveCheckIn(deps, { at: noon, wellbeing: 5 });
    expect(await code(setDayComplete(deps, '2026-01-15', true))).toBe('day_has_no_meals');
    await logMeal(deps, { description: 'Synthetic soup', ingredients: [], at: noon });
    expect((await setDayComplete(deps, '2026-01-15', true)).completedAt).not.toBeNull();
    expect(await code(setDayComplete(deps, '2026-01-15', false))).toBe('no error'); // reopening never asks
  });

  it('SK-7 stool entries take Bristol types 1-7, several per day', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    await logStool(deps, { bristol: 4, at: new Date('2026-01-15T07:00:00.000Z') });
    await logStool(deps, { bristol: 7, at: new Date('2026-01-15T15:00:00.000Z'), note: ' loose ' });
    expect((await repo.listRecords('stoolEntries')).map((s) => s.bristol)).toEqual([7, 4]);
    for (const bad of [0, 8, 2.5, NaN]) expect(await code(logStool(deps, { bristol: bad }))).toBe('invalid_stool_type');
  });
});
