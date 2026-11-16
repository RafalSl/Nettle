import { NettleError } from '@/core/model/errors';
import {
  addArea,
  archiveSkinArea,
  logNailEntry,
  logSkinEntry,
  renameSkinArea,
  repeatAllAreas,
  repeatNailEntry,
  resetSkinAreaName,
} from '@/core/usecases/skin';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';

const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );
const scores = { severity: 1, itch: 2, pain: 3, dryness: 4, scaling: 5 };

describe('area names (SK-2)', () => {
  it('SK-2 rejects a duplicate active name without regard to case, also for predefined areas', async () => {
    const deps = makeDeps(new MemoryRepo());
    await addArea(deps, 'Synthetic elbow');
    expect(await code(addArea(deps, '  synthetic ELBOW '))).toBe('duplicate_area_name');
    expect(await code(addArea(deps, 'chin'))).toBe('duplicate_area_name');
  });

  it('SK-2 renaming checks the new name against other active areas but not against itself', async () => {
    const deps = makeDeps(new MemoryRepo());
    const a = await addArea(deps, 'Synthetic elbow');
    await addArea(deps, 'Synthetic knee');
    expect(await code(renameSkinArea(deps, a.id, 'synthetic KNEE'))).toBe('duplicate_area_name');
    expect(await code(renameSkinArea(deps, a.id, 'SYNTHETIC ELBOW'))).toBe('no error');
    expect(await code(renameSkinArea(deps, 'area-neck', 'Synthetic knee'))).toBe('duplicate_area_name'); // override too
    await renameSkinArea(deps, 'area-neck', 'Synthetic throat');
    expect(await code(addArea(deps, 'synthetic throat'))).toBe('duplicate_area_name');
    expect(await code(resetSkinAreaName(deps, 'area-neck'))).toBe('no error');
  });

  it('SK-2 an archived area frees its name, and unarchiving into a clash is refused', async () => {
    const deps = makeDeps(new MemoryRepo());
    const a = await addArea(deps, 'Synthetic elbow');
    await archiveSkinArea(deps, a.id);
    const b = await addArea(deps, 'synthetic elbow');
    expect(await code(archiveSkinArea(deps, a.id, false))).toBe('duplicate_area_name');
    await archiveSkinArea(deps, b.id);
    expect(await code(archiveSkinArea(deps, a.id, false))).toBe('no error');
  });
});

describe('no change (SK-3)', () => {
  it('SK-3 repeats the last nail entry in one call, and refuses when there is none', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    const nail = await addArea(deps, 'Synthetic thumb', 'nail');
    expect(await code(repeatNailEntry(deps, nail.id))).toBe('no_previous_entry');
    await logNailEntry(deps, { areaId: nail.id, stage: 'yellow', extent: 'up_to_half', at: new Date('2026-01-10T08:00:00.000Z') });
    const again = await repeatNailEntry(deps, nail.id);
    expect(again).toMatchObject({ stage: 'yellow', extent: 'up_to_half' });
    expect(await repo.listRecords('nailEntries')).toHaveLength(2);
  });

  it('SK-3 no change for all areas saves every area with an earlier entry at one time and lists the rest', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    const nail = await addArea(deps, 'Synthetic thumb', 'nail');
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-10T08:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-neck', scores: { ...scores, itch: 9 }, at: new Date('2026-01-10T08:00:00.000Z') });
    await logNailEntry(deps, { areaId: nail.id, stage: 'white', extent: 'none', at: new Date('2026-01-10T08:00:00.000Z') });
    await archiveSkinArea(deps, 'area-neck');
    const result = await repeatAllAreas(deps);
    expect(result.saved).toHaveLength(2); // chin and the nail; neck is archived
    expect(new Set(result.saved.map((e) => e.at.utc)).size).toBe(1);
    expect(result.needFirstEntry.map((a) => a.id).sort()).toEqual(
      ['area-behind-ears', 'area-between-buttocks', 'area-ears-inside', 'area-penis', 'area-perineum-groin', 'area-sternum'].sort(),
    );
  });
});
