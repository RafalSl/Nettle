import { NettleError } from '@/core/model/errors';
import { logMeal } from '@/core/usecases/logMeal';
import {
  addArea,
  archiveSkinArea,
  listActiveAreas,
  logNailEntry,
  logSkinEntry,
  renameSkinArea,
  resetSkinAreaName,
} from '@/core/usecases/skin';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';

const scores = { severity: 1, itch: 2, pain: 3, dryness: 4, scaling: 5 };
const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );

describe('logMeal', () => {
  it('IN-1 saves description and cleaned ingredient list', async () => {
    const deps = makeDeps(new MemoryRepo());
    const meal = await logMeal(deps, { description: '  Synthetic soup ', ingredients: [' water ', '', 'salt'] });
    expect(meal.description).toBe('Synthetic soup');
    expect(meal.ingredients).toEqual(['water', 'salt']);
    expect(await deps.repo.listMeals()).toEqual([meal]);
  });

  it('IN-1 rejects an empty description', async () => {
    expect(await code(logMeal(makeDeps(new MemoryRepo()), { description: '  ', ingredients: [] }))).toBe(
      'empty_description',
    );
  });

  it('NF-4 stores UTC plus local timezone, and the timestamp is editable', async () => {
    const deps = makeDeps(new MemoryRepo());
    const now = await logMeal(deps, { description: 'a', ingredients: [] });
    expect(now.at).toEqual({ utc: '2026-01-15T10:00:00.000Z', tz: 'Europe/Warsaw' });
    const past = await logMeal(deps, { description: 'b', ingredients: [], at: new Date('2026-01-10T07:30:00Z') });
    expect(past.at.utc).toBe('2026-01-10T07:30:00.000Z');
  });
});

describe('logSkinEntry', () => {
  it('SK-3 saves separate scores for an area', async () => {
    const deps = makeDeps(new MemoryRepo());
    const e = await logSkinEntry(deps, { areaId: 'area-chin', scores, note: ' ok ' });
    expect(e.scores).toEqual(scores);
    expect(e.note).toBe('ok');
    expect(await deps.repo.listSkinEntries()).toEqual([e]);
  });

  it.each([11, -1, 2.5, Number.NaN])('SK-3 rejects score %p', async (bad) => {
    const deps = makeDeps(new MemoryRepo());
    expect(await code(logSkinEntry(deps, { areaId: 'area-chin', scores: { ...scores, itch: bad } }))).toBe(
      'invalid_score',
    );
  });

  it('SK-3 rejects unknown and archived areas', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await code(logSkinEntry(deps, { areaId: 'nope', scores }))).toBe('unknown_area');
    await archiveSkinArea(deps, 'area-neck');
    expect(await code(logSkinEntry(deps, { areaId: 'area-neck', scores }))).toBe('area_archived');
  });
});

describe('areas', () => {
  it('SK-2 user can add, rename and archive their own areas', async () => {
    const deps = makeDeps(new MemoryRepo());
    const a = await addArea(deps, ' Synthetic elbow ');
    await renameSkinArea(deps, a.id, 'Synthetic knee');
    expect((await listActiveAreas(deps)).find((x) => x.id === a.id)?.name).toBe('Synthetic knee');
    await archiveSkinArea(deps, a.id);
    expect((await listActiveAreas(deps)).some((x) => x.id === a.id)).toBe(false);
    await archiveSkinArea(deps, a.id, false);
    expect((await listActiveAreas(deps)).some((x) => x.id === a.id)).toBe(true);
  });

  it('SK-2 renaming a predefined area sets an override, keeps its id, and can be reset', async () => {
    const deps = makeDeps(new MemoryRepo());
    await renameSkinArea(deps, 'area-chin', ' Synthetic jaw ');
    const renamed = (await deps.repo.listAreas()).find((a) => a.id === 'area-chin')!;
    expect(renamed).toMatchObject({ name: 'Chin', nameOverride: 'Synthetic jaw', predefined: true });
    await resetSkinAreaName(deps, 'area-chin');
    expect((await deps.repo.listAreas()).find((a) => a.id === 'area-chin')?.nameOverride).toBeNull();
  });

  it('SK-2 names must not be empty, and predefined areas can be archived', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await code(addArea(deps, ' '))).toBe('empty_area_name');
    expect(await code(renameSkinArea(deps, 'area-chin', ' '))).toBe('empty_area_name');
    await archiveSkinArea(deps, 'area-chin');
    expect((await listActiveAreas(deps)).map((a) => a.id)).not.toContain('area-chin');
  });
});

describe('nail areas (SK-10)', () => {
  it('SK-10 adds a nail area, logs a nail entry and lists areas by kind', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    const nail = await addArea(deps, ' Synthetic left thumb ', 'nail');
    expect(nail).toMatchObject({ kind: 'nail', name: 'Synthetic left thumb', predefined: false });
    const entry = await logNailEntry(deps, { areaId: nail.id, stage: 'yellow', extent: 'up_to_half', note: ' n ' });
    expect(entry).toMatchObject({ areaId: nail.id, stage: 'yellow', extent: 'up_to_half', note: 'n' });
    expect(await repo.listRecords('nailEntries')).toEqual([entry]);
    expect((await listActiveAreas(deps, 'nail')).map((a) => a.id)).toEqual([nail.id]);
    expect((await listActiveAreas(deps, 'skin')).map((a) => a.id)).not.toContain(nail.id);
  });

  it('SK-10 keeps kinds apart: scores go to skin areas, stage and extent to nail areas', async () => {
    const deps = makeDeps(new MemoryRepo());
    const nail = await addArea(deps, 'Synthetic left thumb', 'nail');
    expect(await code(logSkinEntry(deps, { areaId: nail.id, scores }))).toBe('wrong_area_kind');
    expect(await code(logNailEntry(deps, { areaId: 'area-chin', stage: 'clear', extent: 'none' }))).toBe('wrong_area_kind');
  });

  it('SK-10 rejects an unknown stage, an unknown extent and an archived nail area', async () => {
    const deps = makeDeps(new MemoryRepo());
    const nail = await addArea(deps, 'Synthetic left thumb', 'nail');
    const base = { areaId: nail.id, stage: 'clear', extent: 'none' } as const;
    expect(await code(logNailEntry(deps, { ...base, stage: 'purple' as never }))).toBe('invalid_nail_value');
    expect(await code(logNailEntry(deps, { ...base, extent: 'all' as never }))).toBe('invalid_nail_value');
    await archiveSkinArea(deps, nail.id);
    expect(await code(logNailEntry(deps, base))).toBe('area_archived');
  });
});
