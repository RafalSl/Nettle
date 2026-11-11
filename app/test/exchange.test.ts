import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { SqliteRepo } from '@/adapters/storage/sqliteRepo';
import { NettleError } from '@/core/model/errors';
import type { StorageRepository } from '@/core/ports/storage';
import { applyImport, exportBundle, previewImport } from '@/core/usecases/exchange';
import { MemoryRepo } from './fakes/memoryRepo';
import { MemoryKeyStore } from './fakes/memoryKeyStore';
import { createNodeSqliteDb } from './helpers/nodeSqliteDb';
import { makeDeps, syntheticEntry, syntheticMeal } from './helpers/fixtures';

const repos: [string, () => Promise<StorageRepository>][] = [
  ['in-memory', async () => new MemoryRepo()],
  ['sqlite', async () => SqliteRepo.open(createNodeSqliteDb())],
];

async function seeded(make: () => Promise<StorageRepository>) {
  const repo = await make();
  await repo.upsertArea({ id: 'a-custom', name: 'Synthetic elbow', predefined: false, archived: false, sensitiveDefault: false, nameOverride: null });
  const chin = (await repo.listAreas()).find((a) => a.id === 'area-chin')!;
  await repo.upsertArea({ ...chin, nameOverride: 'Synthetic jaw' }); // SK-2 override must survive the round trip
  await repo.addMeal(syntheticMeal('m1', '2026-01-10T08:00:00.000Z'));
  await repo.addMeal(syntheticMeal('m2', '2026-01-12T08:00:00.000Z', []));
  await repo.addSkinEntry(syntheticEntry('e1', '2026-01-10T09:00:00.000Z', 'area-intimate'));
  await repo.addSkinEntry(syntheticEntry('e2', '2026-01-12T09:00:00.000Z', 'a-custom'));
  return repo;
}

const dataJson = (zip: Uint8Array) => JSON.parse(strFromU8(unzipSync(zip)['data.json']!));
const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );

describe.each(repos)('export/import round trip (%s)', (_name, make) => {
  it('EX-1 + EX-10 export then import into an empty store restores everything', async () => {
    const source = await seeded(make);
    const zip = await exportBundle(makeDeps(source));

    const target = await make();
    const deps = makeDeps(target);
    const parsed = await previewImport(deps, zip);
    expect(parsed.preview.incoming).toEqual({ meals: 2, skinAreas: 7, skinEntries: 2 });
    await applyImport(deps, parsed, 'merge');

    expect(await target.snapshot()).toEqual(await source.snapshot());
  });

  it('EX-10 preview reports duplicates, and merge skips them', async () => {
    const source = await seeded(make);
    const zip = await exportBundle(makeDeps(source));
    const target = await make();
    await target.addMeal(syntheticMeal('m1', '2026-01-10T08:00:00.000Z', ['kept']));
    const deps = makeDeps(target);

    const parsed = await previewImport(deps, zip);
    expect(parsed.preview.duplicates).toEqual({ meals: 1, skinAreas: 6, skinEntries: 0 });
    expect(parsed.preview.newRows).toEqual({ meals: 1, skinAreas: 1, skinEntries: 2 });
    await applyImport(deps, parsed, 'merge');
    expect((await target.listMeals()).find((m) => m.id === 'm1')?.ingredients).toEqual(['kept']);
    expect(await target.listMeals()).toHaveLength(2);
  });

  it('EX-10 replace discards what was there', async () => {
    const source = await seeded(make);
    const zip = await exportBundle(makeDeps(source));
    const target = await make();
    await target.addMeal(syntheticMeal('only-here', '2026-01-01T08:00:00.000Z'));
    const deps = makeDeps(target);
    await applyImport(deps, await previewImport(deps, zip), 'replace');
    expect((await target.listMeals()).map((m) => m.id).sort()).toEqual(['m1', 'm2']);
  });

  it('EX-1 range export is a snapshot of the chosen range only', async () => {
    const source = await seeded(make);
    const zip = await exportBundle(makeDeps(source), { from: '2026-01-11T00:00:00.000Z' });
    const json = dataJson(zip);
    expect(json.meals.map((m: { id: string }) => m.id)).toEqual(['m2']);
    expect(json.skin_entries.map((e: { id: string }) => e.id)).toEqual(['e2']);
    expect(json.range).toEqual({ from: '2026-01-11T00:00:00.000Z', to: null });
  });
});

describe('data.json format', () => {
  it('EX-1 has schema_version, stable ids, and UTC timestamps plus timezone', async () => {
    const zip = await exportBundle(makeDeps(await seeded(repos[0]![1])));
    const json = dataJson(zip);
    expect(json.schema_version).toBe(1);
    expect(json.exported_at).toEqual({ utc: '2026-01-15T10:00:00.000Z', tz: 'Europe/Warsaw' });
    expect(json.meals[0]).toMatchObject({ id: 'm2', utc: '2026-01-12T08:00:00.000Z', tz: 'Europe/Warsaw' });
    expect(json.skin_entries[0].scores).toEqual({ severity: 3, itch: 5, pain: 0, dryness: 2, scaling: 10 });
  });

  it('SE-6 the API key is never part of an export', async () => {
    const keys = new MemoryKeyStore();
    await keys.set('anthropic-api-key', 'synthetic-secret-key-123');
    const zip = await exportBundle(makeDeps(await seeded(repos[0]![1])));
    expect(strFromU8(unzipSync(zip)['data.json']!)).not.toContain('synthetic-secret-key-123');
  });
});

describe('import validation', () => {
  const deps = () => makeDeps(new MemoryRepo());
  const goodJson = async () => dataJson(await exportBundle(makeDeps(await seeded(repos[0]![1]))));
  const zipOf = (obj: unknown) => zipSync({ 'data.json': strToU8(JSON.stringify(obj)) });

  it('EX-10 rejects a file that is not a ZIP', async () => {
    expect(await code(previewImport(deps(), strToU8('not a zip')))).toBe('import_corrupt_zip');
  });

  it('EX-10 rejects a ZIP without data.json', async () => {
    expect(await code(previewImport(deps(), zipSync({ 'other.txt': strToU8('x') })))).toBe('import_missing_data');
  });

  it('EX-10 rejects invalid JSON', async () => {
    expect(await code(previewImport(deps(), zipSync({ 'data.json': strToU8('{oops') })))).toBe('import_invalid_json');
  });

  it('EX-10 rejects a newer schema_version before looking at the rest', async () => {
    expect(await code(previewImport(deps(), zipOf({ schema_version: 2 })))).toBe('import_unsupported_version');
  });

  it('EX-10 rejects a missing or non-numeric schema_version', async () => {
    expect(await code(previewImport(deps(), zipOf({})))).toBe('import_invalid_data');
    expect(await code(previewImport(deps(), zipOf({ schema_version: '1' })))).toBe('import_invalid_data');
  });

  it('EX-10 rejects out-of-range scores, bad timestamps, unknown area refs and duplicate ids', async () => {
    const mutate = async (fn: (j: any) => void) => {
      const j = await goodJson();
      fn(j);
      return code(previewImport(deps(), zipOf(j)));
    };
    expect(await mutate((j) => (j.skin_entries[0].scores.itch = 11))).toBe('import_invalid_data');
    expect(await mutate((j) => (j.meals[0].utc = '2026-01-12 08:00'))).toBe('import_invalid_data');
    expect(await mutate((j) => (j.skin_entries[0].area_id = 'ghost'))).toBe('import_invalid_data');
    expect(await mutate((j) => (j.meals[1].id = j.meals[0].id))).toBe('import_invalid_data');
    expect(await mutate((j) => (j.meals = 'nope'))).toBe('import_invalid_data');
  });

  it('EX-10 validation failure does not touch the store', async () => {
    const target = new MemoryRepo();
    const d = makeDeps(target);
    await code(previewImport(d, zipOf({ schema_version: 1, meals: [], skin_areas: [], skin_entries: 5 })));
    expect(await target.listMeals()).toEqual([]);
  });
});
