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

const BOTH = { records: true, settings: true };
const RECORDS = { records: true, settings: false };
const SETTINGS = { records: false, settings: true };

async function seeded(make: () => Promise<StorageRepository>) {
  const repo = await make();
  await repo.upsertArea({
    id: 'a-custom',
    name: 'Synthetic elbow',
    predefined: false,
    archived: false,
    sensitiveDefault: false,
    nameOverride: null,
  });
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

describe.each(repos)('export/import (%s)', (_name, make) => {
  it('EX-1 + EX-10 export both parts then replace both restores everything', async () => {
    const source = await seeded(make);
    const zip = await exportBundle(makeDeps(source));

    const target = await make();
    const deps = makeDeps(target);
    const parsed = await previewImport(deps, zip);
    expect(parsed.preview.has).toEqual(BOTH);
    expect(parsed.preview.incoming).toEqual({ meals: 2, skinEntries: 2, skinAreas: 7 });
    await applyImport(deps, parsed, { mode: 'replace', parts: BOTH });

    expect(await target.snapshot()).toEqual(await source.snapshot());
  });

  it('EX-10 merge keeps local area settings, so a renamed predefined area in the file does not override', async () => {
    const source = await seeded(make);
    const zip = await exportBundle(makeDeps(source));
    const target = await make();
    const deps = makeDeps(target);
    await applyImport(deps, await previewImport(deps, zip), { mode: 'merge', parts: BOTH });
    expect((await target.listAreas()).find((a) => a.id === 'area-chin')?.nameOverride).toBeNull();
  });

  it('EX-10 preview reports duplicates, and merge skips them', async () => {
    const source = await seeded(make);
    const zip = await exportBundle(makeDeps(source));
    const target = await make();
    await target.addMeal(syntheticMeal('m1', '2026-01-10T08:00:00.000Z', ['kept']));
    const deps = makeDeps(target);

    const parsed = await previewImport(deps, zip);
    expect(parsed.preview.duplicates).toEqual({ meals: 1, skinEntries: 0, skinAreas: 6 });
    expect(parsed.preview.newRows).toEqual({ meals: 1, skinEntries: 2, skinAreas: 1 });
    await applyImport(deps, parsed, { mode: 'merge', parts: BOTH });
    expect((await target.listMeals()).find((m) => m.id === 'm1')?.ingredients).toEqual(['kept']);
    expect(await target.listMeals()).toHaveLength(2);
  });

  it('EX-1 records-only export has no settings section and restores into a store with the same areas', async () => {
    const source = await seeded(make);
    const zip = await exportBundle(makeDeps(source), { parts: RECORDS });
    const json = dataJson(zip);
    expect(json.settings).toBeUndefined();
    expect(json.records.meals).toHaveLength(2);

    const target = await make();
    await target.upsertArea((await source.listAreas()).find((a) => a.id === 'a-custom')!);
    const deps = makeDeps(target);
    const parsed = await previewImport(deps, zip);
    expect(parsed.preview.has).toEqual(RECORDS);
    await applyImport(deps, parsed, { mode: 'replace', parts: BOTH });
    expect((await target.listSkinEntries()).map((e) => e.id).sort()).toEqual(['e1', 'e2']);
    expect((await target.listAreas()).find((a) => a.id === 'area-chin')?.nameOverride).toBeNull();
  });

  it('EX-10 importing records that point at a missing user area fails and changes nothing', async () => {
    const source = await seeded(make);
    const zip = await exportBundle(makeDeps(source), { parts: RECORDS });
    const target = await make();
    await target.addMeal(syntheticMeal('keep', '2026-01-01T08:00:00.000Z'));
    const deps = makeDeps(target);
    const parsed = await previewImport(deps, zip);
    expect(await code(applyImport(deps, parsed, { mode: 'replace', parts: BOTH }))).toBe('import_unknown_area');
    expect((await target.listMeals()).map((m) => m.id)).toEqual(['keep']);
  });

  it('EX-1 settings-only export carries all areas and no records', async () => {
    const source = await seeded(make);
    const json = dataJson(await exportBundle(makeDeps(source), { parts: SETTINGS }));
    expect(json.records).toBeUndefined();
    expect(json.settings.skin_areas).toHaveLength(7);
    expect(json.settings.skin_areas.find((a: { id: string }) => a.id === 'area-chin').name_override).toBe('Synthetic jaw');
  });

  it('EX-10 the user chooses which parts of a full file to apply', async () => {
    const source = await seeded(make);
    const zip = await exportBundle(makeDeps(source));

    const target = await make();
    const deps = makeDeps(target);
    await applyImport(deps, await previewImport(deps, zip), { mode: 'replace', parts: SETTINGS });
    expect(await target.listMeals()).toEqual([]);
    expect((await target.listAreas()).find((a) => a.id === 'area-chin')?.nameOverride).toBe('Synthetic jaw');

    await applyImport(deps, await previewImport(deps, zip), { mode: 'replace', parts: RECORDS });
    expect(await target.listMeals()).toHaveLength(2);
  });

  it('EX-10 replace records discards what was there and leaves settings alone', async () => {
    const source = await seeded(make);
    const zip = await exportBundle(makeDeps(source));
    const target = await make();
    await target.addMeal(syntheticMeal('only-here', '2026-01-01T08:00:00.000Z'));
    await target.upsertArea((await source.listAreas()).find((a) => a.id === 'a-custom')!);
    const deps = makeDeps(target);
    await applyImport(deps, await previewImport(deps, zip), { mode: 'replace', parts: RECORDS });
    expect((await target.listMeals()).map((m) => m.id).sort()).toEqual(['m1', 'm2']);
    expect((await target.listAreas()).find((a) => a.id === 'area-chin')?.nameOverride).toBeNull();
  });

  it('EX-1 / EX-10 selecting nothing is rejected', async () => {
    const source = await seeded(make);
    expect(await code(exportBundle(makeDeps(source), { parts: { records: false, settings: false } }))).toBe(
      'nothing_selected',
    );
    const zip = await exportBundle(makeDeps(source), { parts: RECORDS });
    const deps = makeDeps(await make());
    const parsed = await previewImport(deps, zip);
    // Asking for settings from a records-only file leaves nothing to apply.
    expect(await code(applyImport(deps, parsed, { mode: 'merge', parts: SETTINGS }))).toBe('nothing_selected');
  });

  it('EX-1 range export is a snapshot of the chosen range only; settings are not filtered', async () => {
    const source = await seeded(make);
    const zip = await exportBundle(makeDeps(source), { range: { from: '2026-01-11T00:00:00.000Z' } });
    const json = dataJson(zip);
    expect(json.records.meals.map((m: { id: string }) => m.id)).toEqual(['m2']);
    expect(json.records.skin_entries.map((e: { id: string }) => e.id)).toEqual(['e2']);
    expect(json.settings.skin_areas).toHaveLength(7);
    expect(json.range).toEqual({ from: '2026-01-11T00:00:00.000Z', to: null });
  });
});

describe('data.json format', () => {
  it('EX-1 has schema_version, stable ids, and UTC timestamps plus timezone', async () => {
    const zip = await exportBundle(makeDeps(await seeded(repos[0]![1])));
    const json = dataJson(zip);
    expect(json.schema_version).toBe(1);
    expect(json.exported_at).toEqual({ utc: '2026-01-15T10:00:00.000Z', tz: 'Europe/Warsaw' });
    expect(json.records.meals[0]).toMatchObject({ id: 'm2', utc: '2026-01-12T08:00:00.000Z', tz: 'Europe/Warsaw' });
    expect(json.records.skin_entries[0].scores).toEqual({ severity: 3, itch: 5, pain: 0, dryness: 2, scaling: 10 });
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

  it('EX-10 rejects a file with neither records nor settings', async () => {
    expect(await code(previewImport(deps(), zipOf({ schema_version: 1 })))).toBe('import_invalid_data');
  });

  it('EX-10 rejects out-of-range scores, bad timestamps, bad sections and duplicate ids', async () => {
    const mutate = async (fn: (j: any) => void) => {
      const j = await goodJson();
      fn(j);
      return code(previewImport(deps(), zipOf(j)));
    };
    expect(await mutate((j) => (j.records.skin_entries[0].scores.itch = 11))).toBe('import_invalid_data');
    expect(await mutate((j) => (j.records.meals[0].utc = '2026-01-12 08:00'))).toBe('import_invalid_data');
    expect(await mutate((j) => (j.records.meals[1].id = j.records.meals[0].id))).toBe('import_invalid_data');
    expect(await mutate((j) => (j.settings.skin_areas[1].id = j.settings.skin_areas[0].id))).toBe('import_invalid_data');
    expect(await mutate((j) => (j.records.meals = 'nope'))).toBe('import_invalid_data');
    expect(await mutate((j) => (j.settings = []))).toBe('import_invalid_data');
  });

  it('EX-10 validation failure does not touch the store', async () => {
    const target = new MemoryRepo();
    const d = makeDeps(target);
    await code(previewImport(d, zipOf({ schema_version: 1, records: { meals: [], skin_entries: 5 } })));
    expect(await target.listMeals()).toEqual([]);
  });
});

describe.each(repos)('password-protected export/import (%s)', (_name, make) => {
  const PW = 'synthetic-passphrase-1';

  it('EX-6 export with a password then import with it restores everything', async () => {
    const source = await seeded(make);
    const zip = await exportBundle(makeDeps(source), { password: PW });
    expect(Buffer.from(zip).includes('Synthetic')).toBe(false); // data.json content is not readable

    const target = await make();
    const deps = makeDeps(target);
    const parsed = await previewImport(deps, zip, PW);
    await applyImport(deps, parsed, { mode: 'replace', parts: BOTH });
    expect(await target.snapshot()).toEqual(await source.snapshot());
  });

  it('EX-6 import asks for a password when missing and rejects a wrong one, changing nothing', async () => {
    const source = await seeded(make);
    const zip = await exportBundle(makeDeps(source), { password: PW });
    const target = await make();
    const deps = makeDeps(target);
    expect(await code(previewImport(deps, zip))).toBe('import_password_required');
    expect(await code(previewImport(deps, zip, 'synthetic-wrong-pass'))).toBe('import_wrong_password');
    expect(await target.listMeals()).toEqual([]);
  });

  it('EX-6 a too-short password is rejected before anything is exported', async () => {
    const source = await seeded(make);
    expect(await code(exportBundle(makeDeps(source), { password: 'short' }))).toBe('password_too_short');
  });
});
