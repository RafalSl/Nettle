import { SqliteRepo } from '@/adapters/storage/sqliteRepo';
import { NettleError } from '@/core/model/errors';
import type { StorageRepository } from '@/core/ports/storage';
import { logStool, saveCheckIn } from '@/core/usecases/checkin';
import { applyTreatment, logReaction } from '@/core/usecases/events';
import {
  deleteEntry,
  editCheckIn,
  editFlareMarker,
  editMeal,
  editNailEntry,
  editReaction,
  editSkinEntry,
  editStool,
  editTreatmentApplication,
  previewEntryDelete,
} from '@/core/usecases/entries';
import { addListItem } from '@/core/usecases/lists';
import { markFlare } from '@/core/usecases/flares';
import { logMeal } from '@/core/usecases/logMeal';
import { addPhoto } from '@/core/usecases/photos';
import { addArea, archiveSkinArea, logNailEntry, logSkinEntry } from '@/core/usecases/skin';
import { MemoryPhotoStore } from './fakes/memoryPhotoStore';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';
import { createNodeSqliteDb } from './helpers/nodeSqliteDb';

const repos: [string, () => Promise<StorageRepository>][] = [
  ['in-memory', async () => new MemoryRepo()],
  ['sqlite', async () => SqliteRepo.open(createNodeSqliteDb())],
];
const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );
const scores = { severity: 1, itch: 2, pain: 3, dryness: 4, scaling: 5 };
const d = (iso: string) => new Date(iso);

describe.each(repos)('editing and deleting one entry (%s)', (_name, make) => {
  async function setup() {
    const repo = await make();
    const deps = makeDeps(repo);
    return { repo, deps, store: deps.photos as MemoryPhotoStore };
  }

  it('EN-1 editing a meal keeps its id and replaces description, ingredients, tags and time', async () => {
    const { repo, deps } = await setup();
    const meal = await logMeal(deps, { description: 'Synthetic oats', ingredients: ['a'], at: d('2026-01-15T08:00:00.000Z') });
    const edited = await editMeal(deps, meal.id, {
      description: ' Synthetic porridge ',
      ingredients: ['b', 'c'],
      allergens: ['milk'],
      at: d('2026-01-15T07:30:00.000Z'),
    });
    expect(edited).toMatchObject({ id: meal.id, description: 'Synthetic porridge', ingredients: ['b', 'c'], allergens: ['milk'] });
    expect(await repo.listMeals()).toEqual([edited]);
  });

  it('EN-1 an edit without a new time keeps the original stamp, and validation still applies', async () => {
    const { repo, deps } = await setup();
    const meal = await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: d('2026-01-15T08:00:00.000Z') });
    await editMeal(deps, meal.id, { description: 'Synthetic oats 2', ingredients: [] });
    expect((await repo.listMeals())[0]?.at).toEqual(meal.at);
    expect(await code(editMeal(deps, meal.id, { description: '  ', ingredients: [] }))).toBe('empty_description');
    expect(await code(editMeal(deps, 'nope', { description: 'x', ingredients: [] }))).toBe('unknown_entry');
  });

  it('EN-1 a meal cannot be moved after its reaction, and a reaction cannot move before its meal', async () => {
    const { deps } = await setup();
    const meal = await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: d('2026-01-15T08:00:00.000Z') });
    const reaction = await logReaction(deps, { mealId: meal.id, symptoms: ['hives'], at: d('2026-01-15T09:00:00.000Z') });
    expect(await code(editMeal(deps, meal.id, { description: 'Synthetic oats', ingredients: [], at: d('2026-01-15T09:30:00.000Z') }))).toBe(
      'meal_after_reaction',
    );
    expect(await code(editReaction(deps, reaction.id, { mealId: meal.id, symptoms: ['hives'], at: d('2026-01-15T07:00:00.000Z') }))).toBe(
      'reaction_before_meal',
    );
    const ok = await editReaction(deps, reaction.id, { mealId: meal.id, symptoms: ['hives', 'swelling'], at: d('2026-01-15T09:10:00.000Z') });
    expect(ok.id).toBe(reaction.id);
  });

  it('EN-1 editing a reaction without a new time keeps its onset even when its meal is later than "now"', async () => {
    const { repo, deps } = await setup(); // the clock stands at 2026-01-15
    const meal = await logMeal(deps, { description: 'Synthetic future meal', ingredients: [], at: d('2026-02-01T08:00:00.000Z') });
    const reaction = await logReaction(deps, { mealId: meal.id, symptoms: ['hives'], at: d('2026-02-01T09:00:00.000Z') });
    const ok = await editReaction(deps, reaction.id, { mealId: meal.id, symptoms: ['stomach'] });
    expect(ok.at).toEqual(reaction.at);
    expect((await repo.listRecords('reactions'))[0]?.symptoms).toEqual(['stomach']);
  });

  it('EN-1 editing a skin entry keeps an archived area it already uses but refuses to move to another archived one', async () => {
    const { repo, deps } = await setup();
    const entry = await logSkinEntry(deps, { areaId: 'area-chin', scores });
    await archiveSkinArea(deps, 'area-chin');
    await archiveSkinArea(deps, 'area-neck');
    const edited = await editSkinEntry(deps, entry.id, { areaId: 'area-chin', scores: { ...scores, itch: 9 } });
    expect(edited.scores.itch).toBe(9);
    expect((await repo.listSkinEntries())[0]?.id).toBe(entry.id);
    expect(await code(editSkinEntry(deps, entry.id, { areaId: 'area-neck', scores }))).toBe('area_archived');
    expect(await code(editSkinEntry(deps, entry.id, { areaId: 'area-sternum', scores: { ...scores, pain: 11 } }))).toBe('invalid_score');
  });

  it('EN-1 edits nail entries, stool entries and treatment applications through the same rules', async () => {
    const { repo, deps } = await setup();
    const nail = await addArea(deps, 'Synthetic thumb', 'nail');
    const ne = await logNailEntry(deps, { areaId: nail.id, stage: 'white', extent: 'none' });
    expect((await editNailEntry(deps, ne.id, { areaId: nail.id, stage: 'yellow', extent: 'up_to_half' })).id).toBe(ne.id);
    const st = await logStool(deps, { bristol: 4 });
    expect((await editStool(deps, st.id, { bristol: 6 })).bristol).toBe(6);
    expect(await code(editStool(deps, st.id, { bristol: 9 }))).toBe('invalid_stool_type');
    const tr = await addListItem(deps, 'treatments', 'Synthetic cream');
    const app = await applyTreatment(deps, { treatmentId: tr.id, areaIds: ['area-chin'] });
    const edited = await editTreatmentApplication(deps, app.id, { treatmentId: tr.id, areaIds: ['area-chin', 'area-neck'] });
    expect(edited.areaIds).toEqual(['area-chin', 'area-neck']);
    expect(await repo.listRecords('treatmentApplications')).toHaveLength(1);
  });

  it('EN-1, SK-7 a check-in cannot move to a day that already has one', async () => {
    const { repo, deps } = await setup();
    const a = await saveCheckIn(deps, { at: d('2026-01-14T10:00:00.000Z'), wellbeing: 5 });
    const b = await saveCheckIn(deps, { at: d('2026-01-15T10:00:00.000Z'), wellbeing: 6 });
    expect(await code(editCheckIn(deps, b.id, { at: d('2026-01-14T18:00:00.000Z'), wellbeing: 6 }))).toBe('checkin_day_taken');
    const edited = await editCheckIn(deps, a.id, { wellbeing: 2, tags: [], complete: true, confirmEmptyDay: true });
    expect(edited).toMatchObject({ id: a.id, day: a.day, wellbeing: 2 });
    expect(edited.completedAt).not.toBeNull();
    expect(await repo.listRecords('checkIns')).toHaveLength(2);
  });

  it('EN-1, SK-6 a flare marker keeps start before end and the flares of an area apart', async () => {
    const { deps } = await setup();
    const s1 = await markFlare(deps, { areaId: 'area-chin', kind: 'start', at: d('2026-01-02T08:00:00.000Z') });
    const e1 = await markFlare(deps, { areaId: 'area-chin', kind: 'end', at: d('2026-01-05T08:00:00.000Z') });
    const s2 = await markFlare(deps, { areaId: 'area-chin', kind: 'start', at: d('2026-01-10T08:00:00.000Z') });
    expect(await code(editFlareMarker(deps, e1.id, { at: d('2026-01-01T08:00:00.000Z') }))).toBe('flare_end_before_start');
    expect(await code(editFlareMarker(deps, s1.id, { at: d('2026-01-06T08:00:00.000Z') }))).toBe('flare_end_before_start');
    expect(await code(editFlareMarker(deps, s2.id, { at: d('2026-01-04T08:00:00.000Z') }))).toBe('flare_overlap');
    expect(await code(editFlareMarker(deps, e1.id, { at: d('2026-01-11T08:00:00.000Z') }))).toBe('flare_overlap');
    const moved = await editFlareMarker(deps, e1.id, { at: d('2026-01-07T08:00:00.000Z'), note: ' n ' });
    expect(moved).toMatchObject({ id: e1.id, note: 'n' });
  });

  it('EN-1, EX-13 deleting a meal also deletes its reactions and tombstones all of them', async () => {
    const { repo, deps } = await setup();
    const meal = await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: d('2026-01-15T08:00:00.000Z') });
    const other = await logMeal(deps, { description: 'Synthetic soup', ingredients: [], at: d('2026-01-15T12:00:00.000Z') });
    const r = await logReaction(deps, { mealId: meal.id, symptoms: ['hives'], at: d('2026-01-15T09:00:00.000Z') });
    expect(await previewEntryDelete(deps, 'meals', meal.id)).toEqual({ reactions: 1 });
    expect(await deleteEntry(deps, 'meals', meal.id)).toEqual({ reactions: 1 });
    expect((await repo.listMeals()).map((m) => m.id)).toEqual([other.id]);
    expect(await repo.listRecords('reactions')).toEqual([]);
    const tombs = await repo.listTombstones();
    expect(tombs.map((t) => [t.id, t.kind]).sort()).toEqual([[meal.id, 'meals'], [r.id, 'reactions']].sort());
    expect(tombs[0]?.deletedAt).toEqual({ utc: '2026-01-15T10:00:00.000Z', tz: 'Europe/Warsaw' });
    expect(await code(deleteEntry(deps, 'meals', meal.id))).toBe('unknown_entry');
  });

  it('EN-1, SK-4 deleting a skin entry also deletes its photos and their files, and nothing else', async () => {
    const { repo, deps, store } = await setup();
    const entry = await logSkinEntry(deps, { areaId: 'area-chin', scores });
    const keep = await logSkinEntry(deps, { areaId: 'area-neck', scores });
    const p1 = await addPhoto(deps, { entryKind: 'skinEntry', entryId: entry.id, sourceUri: 'one' });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: entry.id, sourceUri: 'two' });
    const kept = await addPhoto(deps, { entryKind: 'skinEntry', entryId: keep.id, sourceUri: 'three' });
    expect(await deleteEntry(deps, 'skinEntries', entry.id)).toEqual({ photos: 2 });
    expect((await repo.listRecords('photos')).map((p) => p.id)).toEqual([kept.id]);
    await expect(store.read(p1.file)).rejects.toThrow();
    expect(await store.read(kept.file)).toBeDefined();
    expect((await repo.listTombstones()).filter((t) => t.kind === 'photos')).toHaveLength(2);
  });

  it('EN-1, SK-6 deleting a flare start also removes its end; deleting an end alone reopens the flare', async () => {
    const { repo, deps } = await setup();
    const s = await markFlare(deps, { areaId: 'area-chin', kind: 'start', at: d('2026-01-02T08:00:00.000Z') });
    const e = await markFlare(deps, { areaId: 'area-chin', kind: 'end', at: d('2026-01-05T08:00:00.000Z') });
    const s2 = await markFlare(deps, { areaId: 'area-chin', kind: 'start', at: d('2026-01-10T08:00:00.000Z') });
    expect(await previewEntryDelete(deps, 'flareMarkers', s.id)).toEqual({ flareMarkers: 1 });
    await deleteEntry(deps, 'flareMarkers', s.id);
    expect((await repo.listRecords('flareMarkers')).map((m) => m.id)).toEqual([s2.id]);
    expect(e.id).not.toBe(s2.id);
    // an end alone: only it goes
    const s3 = await markFlare(deps, { areaId: 'area-neck', kind: 'start', at: d('2026-01-02T08:00:00.000Z') });
    const e3 = await markFlare(deps, { areaId: 'area-neck', kind: 'end', at: d('2026-01-03T08:00:00.000Z') });
    expect(await deleteEntry(deps, 'flareMarkers', e3.id)).toEqual({});
    expect((await repo.listRecords('flareMarkers')).map((m) => m.id).sort()).toEqual([s2.id, s3.id].sort());
  });

  it('EN-1 deleting a flat entry leaves one tombstone, and bulk delete still leaves none (SE-9)', async () => {
    const { repo, deps } = await setup();
    const st = await logStool(deps, { bristol: 3 });
    await deleteEntry(deps, 'stoolEntries', st.id);
    expect(await repo.listTombstones()).toHaveLength(1);
    const st2 = await logStool(deps, { bristol: 3 });
    await repo.deleteRecords({ stoolEntries: [st2.id] });
    expect(await repo.listTombstones()).toHaveLength(1);
  });
});
