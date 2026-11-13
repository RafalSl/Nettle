import { SqliteRepo } from '@/adapters/storage/sqliteRepo';
import { NettleError } from '@/core/model/errors';
import { planDeletion } from '@/core/model/deletion';
import { RECORD_KINDS } from '@/core/model/types';
import type { StorageRepository } from '@/core/ports/storage';
import { deleteData, previewDelete } from '@/core/usecases/deleteData';
import { MemoryRepo } from './fakes/memoryRepo';
import { createNodeSqliteDb } from './helpers/nodeSqliteDb';
import { TZ, makeDeps, syntheticCheckIn, syntheticEntry, syntheticMeal, syntheticStool } from './helpers/fixtures';

const repos: [string, () => Promise<StorageRepository>][] = [
  ['in-memory', async () => new MemoryRepo()],
  ['sqlite', async () => SqliteRepo.open(createNodeSqliteDb())],
];
const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );

async function seeded(make: () => Promise<StorageRepository>) {
  const repo = await make();
  await repo.addMeal(syntheticMeal('m1', '2026-01-10T08:00:00.000Z'));
  await repo.addMeal(syntheticMeal('m2', '2026-01-12T08:00:00.000Z'));
  await repo.addRecord('reactions', { id: 'r1', at: { utc: '2026-01-10T09:00:00.000Z', tz: TZ }, mealId: 'm1', symptoms: ['hives'], note: null });
  await repo.addRecord('reactions', { id: 'r2', at: { utc: '2026-01-12T09:00:00.000Z', tz: TZ }, mealId: 'm2', symptoms: ['stomach'], note: null });
  await repo.addSkinEntry(syntheticEntry('e1', '2026-01-10T10:00:00.000Z'));
  await repo.addSkinEntry(syntheticEntry('e2', '2026-01-12T10:00:00.000Z'));
  await repo.addRecord('checkIns', syntheticCheckIn('c1', '2026-01-12T20:00:00.000Z', '2026-01-12'));
  await repo.addRecord('stoolEntries', syntheticStool('s1', '2026-01-12T07:00:00.000Z'));
  await repo.upsertItem('treatments', { id: 'tr1', name: 'Synthetic cream', predefined: false, archived: false, nameOverride: null });
  return repo;
}

describe('planDeletion (SE-9)', () => {
  it('SE-9 picks records of the chosen kinds inside the inclusive range', async () => {
    const records = await (await seeded(async () => new MemoryRepo())).snapshot();
    const plan = planDeletion(records, { kinds: ['skinEntries', 'stoolEntries'], range: { from: '2026-01-11T00:00:00.000Z' } });
    expect(plan.skinEntries).toEqual(['e2']);
    expect(plan.stoolEntries).toEqual(['s1']);
    expect(plan.meals).toEqual([]);
    expect(plan.reactions).toEqual([]);
  });

  it('SE-9 deleting a meal also deletes the reactions linked to it, wherever they fall', async () => {
    const records = await (await seeded(async () => new MemoryRepo())).snapshot();
    const plan = planDeletion(records, { kinds: ['meals'], range: { to: '2026-01-10T23:59:59.999Z' } });
    expect(plan.meals).toEqual(['m1']);
    expect(plan.reactions).toEqual(['r1']);
  });

  it('SE-9 an empty selection plans nothing', async () => {
    const records = await (await seeded(async () => new MemoryRepo())).snapshot();
    const plan = planDeletion(records, { kinds: [] });
    for (const k of RECORD_KINDS) expect(plan[k]).toEqual([]);
  });
});

describe.each(repos)('bulk delete (%s)', (_name, make) => {
  it('SE-9 preview counts what would go and changes nothing', async () => {
    const repo = await seeded(make);
    const counts = await previewDelete(makeDeps(repo), { kinds: ['meals'] });
    expect(counts).toMatchObject({ meals: 2, reactions: 2, skinEntries: 0 });
    expect(await repo.listMeals()).toHaveLength(2);
    expect(await repo.listRecords('reactions')).toHaveLength(2);
  });

  it('SE-9 deletes by kind and leaves everything else', async () => {
    const repo = await seeded(make);
    const counts = await deleteData(makeDeps(repo), { kinds: ['skinEntries', 'checkIns'] });
    expect(counts).toMatchObject({ skinEntries: 2, checkIns: 1, meals: 0 });
    expect(await repo.listSkinEntries()).toEqual([]);
    expect(await repo.listRecords('checkIns')).toEqual([]);
    expect(await repo.listMeals()).toHaveLength(2);
    expect(await repo.listRecords('stoolEntries')).toHaveLength(1);
  });

  it('SE-9 deletes by date range, taking linked reactions with their meals', async () => {
    const repo = await seeded(make);
    await deleteData(makeDeps(repo), { kinds: ['meals'], range: { from: '2026-01-11T00:00:00.000Z' } });
    expect((await repo.listMeals()).map((m) => m.id)).toEqual(['m1']);
    expect((await repo.listRecords('reactions')).map((r) => r.id)).toEqual(['r1']);
  });

  it('SE-9 deleting everything empties all records but keeps areas, tags and treatments', async () => {
    const repo = await seeded(make);
    await deleteData(makeDeps(repo), { kinds: RECORD_KINDS });
    const snap = await repo.snapshot();
    for (const k of RECORD_KINDS) expect(snap[k]).toEqual([]);
    expect(snap.skinAreas).toHaveLength(6);
    expect(snap.dailyTags).toHaveLength(9);
    expect(snap.treatments).toHaveLength(1);
  });

  it('SE-9 selecting nothing is rejected and deletes nothing', async () => {
    const repo = await seeded(make);
    expect(await code(deleteData(makeDeps(repo), { kinds: [] }))).toBe('nothing_selected');
    expect(await code(previewDelete(makeDeps(repo), { kinds: [] }))).toBe('nothing_selected');
    expect(await repo.listMeals()).toHaveLength(2);
  });
});
