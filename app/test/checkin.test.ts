import { logMeal } from '@/core/usecases/logMeal';
import { localDay } from '@/core/model/time';
import { askableValues, getCheckIn, logStool, saveCheckIn } from '@/core/usecases/checkin';
import { addListItem, archiveListItem, listActiveItems, renameListItem, resetListItemName } from '@/core/usecases/lists';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';
import { errorCode } from './helpers/errors';

describe('localDay (SK-11, NF-4)', () => {
  it('uses the timezone, not UTC', () => {
    expect(localDay('2026-01-15T23:30:00.000Z', 'Europe/Warsaw')).toBe('2026-01-16');
    expect(localDay('2026-01-15T23:30:00.000Z', 'America/New_York')).toBe('2026-01-15');
    expect(localDay('2026-07-01T22:30:00.000Z', 'Europe/Warsaw')).toBe('2026-07-02'); // summer time, UTC+2
  });
});

describe('Daily health items (SK-7, IN-6)', () => {
  it('IN-6 seeds the five scores and yes/no items and the nine tags, and lets the user add, rename and archive', async () => {
    const deps = makeDeps(new MemoryRepo());
    const seeded = await listActiveItems(deps, 'dailyItems');
    expect(seeded).toHaveLength(16);
    expect(seeded.every((t) => t.predefined)).toBe(true);
    expect(
      seeded
        .filter((i) => i.valueKind === 'score')
        .map((i) => i.id)
        .sort(),
    ).toEqual(['item-abdominal-pain', 'item-sleep', 'item-stress', 'item-wellbeing']);

    const mine = await addListItem(deps, 'dailyItems', ' Synthetic score ', { valueKind: 'score', description: ' my note ' });
    expect(mine).toMatchObject({ name: 'Synthetic score', valueKind: 'score', description: 'my note' });
    await renameListItem(deps, 'dailyItems', mine.id, 'Renamed');
    await renameListItem(deps, 'dailyItems', 'tag-travel', 'Trip'); // predefined: override, id and name stay
    const all = await listActiveItems(deps, 'dailyItems');
    expect(all.find((t) => t.id === mine.id)?.name).toBe('Renamed');
    expect(all.find((t) => t.id === 'tag-travel')).toMatchObject({ name: 'travel', nameOverride: 'Trip' });
    await resetListItemName(deps, 'dailyItems', 'tag-travel');
    await archiveListItem(deps, 'dailyItems', mine.id);
    expect((await listActiveItems(deps, 'dailyItems')).some((t) => t.id === mine.id)).toBe(false);
    expect(await errorCode(addListItem(deps, 'dailyItems', '  '))).toBe('empty_item_name');
    expect(await errorCode(renameListItem(deps, 'dailyItems', 'nope', 'x'))).toBe('unknown_item');
  });
});

describe('Daily health record (SK-7, SK-11)', () => {
  const noon = new Date('2026-01-15T11:00:00.000Z');
  const ok = { confirmEmptyDay: true };

  it('SK-7 saves one record per local day and updates it on the second save', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    const first = await saveCheckIn(deps, {
      at: noon,
      ...ok,
      values: { 'item-wellbeing': 7, 'item-stress': 3, 'item-bloating': true, 'tag-travel': true },
    });
    expect(first).toMatchObject({
      day: '2026-01-15',
      values: { 'item-wellbeing': 7, 'item-stress': 3, 'item-bloating': true, 'tag-travel': true },
    });
    const second = await saveCheckIn(deps, {
      at: new Date('2026-01-15T19:00:00.000Z'),
      values: { 'item-wellbeing': 4, 'item-bloating': false },
      note: ' evening ',
    });
    expect(second.id).toBe(first.id);
    expect(second).toMatchObject({ values: { 'item-wellbeing': 4 }, note: 'evening' });
    expect(await repo.listRecords('checkIns')).toHaveLength(1);
    await saveCheckIn(deps, { at: new Date('2026-01-16T09:00:00.000Z'), ...ok });
    expect(await repo.listRecords('checkIns')).toHaveLength(2);
  });

  it('SK-7 a user score item is recorded like a predefined one, and zero is a value', async () => {
    const deps = makeDeps(new MemoryRepo());
    const mine = await addListItem(deps, 'dailyItems', 'Synthetic itch', { valueKind: 'score' });
    const saved = await saveCheckIn(deps, { at: noon, ...ok, values: { [mine.id]: 0 } });
    expect(saved.values).toEqual({ [mine.id]: 0 });
  });

  it('SK-7 without an explicit time it updates the day of the clock (today)', async () => {
    const deps = makeDeps(new MemoryRepo()); // clock: 2026-01-15T10:00Z
    const a = await saveCheckIn(deps, { ...ok, values: { 'item-wellbeing': 5 } });
    const b = await saveCheckIn(deps, { values: { 'item-wellbeing': 6 } });
    expect(b.id).toBe(a.id);
    expect(await getCheckIn(deps, '2026-01-15')).toMatchObject({ values: { 'item-wellbeing': 6 } });
    expect(await getCheckIn(deps, '2026-01-14')).toBeNull();
  });

  it('SK-7 rejects scores outside 0-10, wrong value types and unknown items', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await errorCode(saveCheckIn(deps, { ...ok, values: { 'item-stress': 11 } }))).toBe('invalid_score');
    expect(await errorCode(saveCheckIn(deps, { ...ok, values: { 'item-sleep': 2.5 } }))).toBe('invalid_score');
    expect(await errorCode(saveCheckIn(deps, { ...ok, values: { 'item-sleep': true } }))).toBe('invalid_score');
    expect(await errorCode(saveCheckIn(deps, { ...ok, values: { 'tag-travel': 3 } }))).toBe('invalid_value');
    expect(await errorCode(saveCheckIn(deps, { ...ok, values: { nope: true } }))).toBe('unknown_item');
    expect(await getCheckIn(deps, '2026-01-15')).toBeNull();
  });

  it('SK-7 an archived item is not asked and keeps what the day already had', async () => {
    const deps = makeDeps(new MemoryRepo());
    await saveCheckIn(deps, { at: noon, ...ok, values: { 'item-stress': 8, 'item-sleep': 5 } });
    await archiveListItem(deps, 'dailyItems', 'item-stress');
    const again = await saveCheckIn(deps, { at: noon, values: { 'item-sleep': 6, 'item-stress': 1 } }); // the form cannot send it; a stale value is ignored
    expect(again.values).toEqual({ 'item-sleep': 6, 'item-stress': 8 });
  });

  it('SK-7 "same as yesterday" copies only items that can still be asked', async () => {
    const deps = makeDeps(new MemoryRepo());
    const before = await saveCheckIn(deps, {
      at: new Date('2026-01-14T11:00:00.000Z'),
      ...ok,
      values: { 'item-stress': 8, 'item-sleep': 5, 'tag-travel': true },
    });
    await archiveListItem(deps, 'dailyItems', 'item-stress');
    expect(askableValues(await listActiveItems(deps, 'dailyItems'), before)).toEqual({ 'item-sleep': 5, 'tag-travel': true });
  });

  it('SK-11 saving logs the day: a first save with no meals needs confirmation, a day with a meal saves at once', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await errorCode(saveCheckIn(deps, { at: noon, values: { 'item-wellbeing': 5 } }))).toBe('day_has_no_meals');
    expect(await getCheckIn(deps, '2026-01-15')).toBeNull(); // nothing saved by the refused call
    await logMeal(deps, { description: 'Synthetic soup', ingredients: [], at: noon });
    expect(await errorCode(saveCheckIn(deps, { at: noon, values: { 'item-wellbeing': 5 } }))).toBe('no error');
    expect(await errorCode(saveCheckIn(deps, { at: noon, values: { 'item-wellbeing': 6 } }))).toBe('no error'); // updating never asks again
  });

  it('SK-7 stool entries take Bristol types 1-7, several per day', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    await logStool(deps, { bristol: 4, at: new Date('2026-01-15T07:00:00.000Z') });
    await logStool(deps, { bristol: 7, at: new Date('2026-01-15T15:00:00.000Z'), note: ' loose ' });
    expect((await repo.listRecords('stoolEntries')).map((s) => s.bristol)).toEqual([7, 4]);
    for (const bad of [0, 8, 2.5, NaN]) expect(await errorCode(logStool(deps, { bristol: bad }))).toBe('invalid_stool_type');
  });
});
