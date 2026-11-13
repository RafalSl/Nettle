import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { SqliteRepo } from '@/adapters/storage/sqliteRepo';
import { NettleError } from '@/core/model/errors';
import type { StorageRepository } from '@/core/ports/storage';
import { applyImport, exportBundle, previewImport } from '@/core/usecases/exchange';
import { parseDataJson } from '@/core/export/validate';
import { MemoryRepo } from './fakes/memoryRepo';
import { MemoryKeyStore } from './fakes/memoryKeyStore';
import { createNodeSqliteDb } from './helpers/nodeSqliteDb';
import { TZ, makeDeps, syntheticEntry, syntheticCheckIn, syntheticMeal, syntheticNailEntry, syntheticStool } from './helpers/fixtures';

const repos: [string, () => Promise<StorageRepository>][] = [
  ['in-memory', async () => new MemoryRepo()],
  ['sqlite', async () => SqliteRepo.open(createNodeSqliteDb())],
];

const BOTH = { records: true, settings: true };
const RECORDS = { records: true, settings: false };
const SETTINGS = { records: false, settings: true };

const custom = {
  id: 'a-custom',
  kind: 'skin' as const,
  name: 'Synthetic elbow',
  predefined: false,
  archived: false,
  sensitiveDefault: false,
  nameOverride: null,
};

async function seeded(make: () => Promise<StorageRepository>) {
  const repo = await make();
  await repo.upsertArea(custom);
  const chin = (await repo.listAreas()).find((a) => a.id === 'area-chin')!;
  await repo.upsertArea({ ...chin, nameOverride: 'Synthetic jaw' }); // SK-2 override must survive the round trip
  await repo.addMeal({ ...syntheticMeal('m1', '2026-01-10T08:00:00.000Z'), allergens: ['milk', 'gluten'] }); // IN-10 survives the round trip
  await repo.addMeal(syntheticMeal('m2', '2026-01-12T08:00:00.000Z', []));
  await repo.addSkinEntry(syntheticEntry('e1', '2026-01-10T09:00:00.000Z', 'area-intimate'));
  await repo.addSkinEntry(syntheticEntry('e2', '2026-01-12T09:00:00.000Z', 'a-custom'));
  await repo.upsertArea({ ...custom, id: 'a-nail', kind: 'nail', name: 'Synthetic left thumb' });
  await repo.addRecord('nailEntries', syntheticNailEntry('n1', '2026-01-12T10:00:00.000Z', 'a-nail'));
  await repo.upsertItem('dailyTags', { id: 'tag-custom', name: 'Synthetic tag', predefined: false, archived: false, nameOverride: null });
  await repo.addRecord('checkIns', syntheticCheckIn('c1', '2026-01-12T20:00:00.000Z', '2026-01-12', ['tag-travel', 'tag-custom']));
  await repo.addRecord('stoolEntries', syntheticStool('s1', '2026-01-12T07:00:00.000Z'));
  await repo.addRecord('stoolEntries', syntheticStool('s2', '2026-01-12T18:00:00.000Z', 6));
  await repo.upsertItem('treatments', { id: 'tr1', name: 'Synthetic cream', predefined: false, archived: false, nameOverride: null });
  await repo.addRecord('treatmentApplications', {
    id: 'ta1',
    at: { utc: '2026-01-12T21:00:00.000Z', tz: TZ },
    treatmentId: 'tr1',
    areaIds: ['area-chin', 'a-nail'],
    note: null,
  });
  await repo.addRecord('changeEvents', {
    id: 'ce1',
    at: { utc: '2026-01-11T00:00:00.000Z', tz: TZ },
    action: 'started',
    category: 'product',
    name: 'Synthetic shampoo',
    note: null,
  });
  await repo.addRecord('alcoholEntries', { id: 'al1', at: { utc: '2026-01-12T19:00:00.000Z', tz: TZ }, drink: 'Synthetic beer', amountMl: 500, note: null });
  await repo.addRecord('medicationEntries', { id: 'md1', at: { utc: '2026-01-12T08:00:00.000Z', tz: TZ }, category: 'supplement', name: 'Synthetic vitamin', dose: '1 tablet', note: null });
  await repo.addRecord('reactions', {
    id: 'r1',
    at: { utc: '2026-01-12T09:00:00.000Z', tz: TZ },
    mealId: 'm2',
    symptoms: ['hives', 'stomach'],
    note: null,
  });
  return repo;
}

const dataJson = (zip: Uint8Array) => JSON.parse(strFromU8(unzipSync(zip)['data.json']!));
const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );

const RAW_RECORDS = {
  meals: [],
  skin_entries: [],
  nail_entries: [],
  check_ins: [],
  stool_entries: [],
  treatment_applications: [],
  change_events: [],
  reactions: [],
  alcohol_entries: [],
  medication_entries: [],
};
const RAW_SETTINGS = { skin_areas: [], daily_tags: [], treatments: [] };

describe('data.json validation of nail data (SK-10)', () => {
  const stamp = { utc: '2026-01-10T08:00:00.000Z', tz: 'Europe/Warsaw' };
  const file = (records: object, settings?: object) => ({
    schema_version: 1,
    records,
    ...(settings && { settings }),
  });
  const nailRow = { id: 'n1', utc: stamp.utc, tz: stamp.tz, area_id: 'a', stage: 'white', extent: 'none', note: null };
  const base = RAW_RECORDS;

  it('accepts a nail entry and a nail area', () => {
    const p = parseDataJson(
      file(
        { ...base, nail_entries: [nailRow] },
        { ...RAW_SETTINGS, skin_areas: [{ id: 'a', kind: 'nail', name: 'x', predefined: false, archived: false, sensitive_default: false, name_override: null }] },
      ),
    );
    expect(p.records?.nailEntries).toHaveLength(1);
    expect(p.settings?.skinAreas[0]?.kind).toBe('nail');
  });

  it('rejects a bad stage, a bad extent, a missing nail_entries list and an unknown area kind', () => {
    const bad = (raw: unknown) => {
      try {
        parseDataJson(raw);
        return 'no error';
      } catch (e) {
        return e instanceof NettleError ? e.code : 'other';
      }
    };
    expect(bad(file({ ...base, nail_entries: [{ ...nailRow, stage: 'purple' }] }))).toBe('import_invalid_data');
    expect(bad(file({ ...base, nail_entries: [{ ...nailRow, extent: 'all' }] }))).toBe('import_invalid_data');
    const { nail_entries: _omitted, ...withoutNail } = RAW_RECORDS;
    expect(bad(file(withoutNail))).toBe('import_invalid_data');
    expect(
      bad(file(undefined as never, { ...RAW_SETTINGS, skin_areas: [{ id: 'a', kind: 'toe', name: 'x', predefined: false, archived: false, sensitive_default: false, name_override: null }] })),
    ).toBe('import_invalid_data');
  });

  it('refuses to apply a nail entry whose area is unknown (import_unknown_area)', async () => {
    const target = new MemoryRepo();
    const deps = makeDeps(target);
    const parsed = { payload: parseDataJson(file({ ...base, nail_entries: [nailRow] })), preview: undefined as never };
    expect(await code(applyImport(deps, parsed, { mode: 'merge', parts: RECORDS }))).toBe('import_unknown_area');
  });
});

describe('data.json validation of check-ins, stool and tags (SK-7, SK-11, IN-6)', () => {
  const at = { utc: '2026-01-10T20:00:00.000Z', tz: 'Europe/Warsaw' };
  const checkIn = {
    id: 'c1', utc: at.utc, tz: at.tz, day: '2026-01-10', wellbeing: 5, stress: null, sleep: 3,
    abdominal_pain: 0, bloating: false, tags: ['tag-travel'], note: null, completed_utc: at.utc, completed_tz: at.tz,
  };
  const stool = { id: 's1', utc: at.utc, tz: at.tz, bristol: 4, note: null };
  const records = (over: object = {}) => ({ ...RAW_RECORDS, check_ins: [checkIn], stool_entries: [stool], ...over });
  const file = (r: object, settings?: object) => ({ schema_version: 1, records: r, ...(settings && { settings }) });
  const err = (raw: unknown) => {
    try {
      parseDataJson(raw);
      return 'no error';
    } catch (e) {
      return e instanceof NettleError ? e.code : 'other';
    }
  };

  it('accepts a check-in, a stool entry and a tag list', () => {
    const p = parseDataJson(
      file(records(), {
        ...RAW_SETTINGS,
        daily_tags: [{ id: 'tag-x', name: 'x', predefined: false, archived: false, name_override: null }],
      }),
    );
    expect(p.records?.checkIns[0]).toMatchObject({ day: '2026-01-10', stress: null, completedAt: at });
    expect(p.records?.stoolEntries[0]?.bristol).toBe(4);
    expect(p.settings?.dailyTags[0]?.id).toBe('tag-x');
  });

  it('rejects bad scores, days, completion stamps, tag lists and Bristol types', () => {
    const bad = (over: object) => err(file(records({ check_ins: [{ ...checkIn, ...over }] })));
    expect(bad({ wellbeing: 11 })).toBe('import_invalid_data');
    expect(bad({ stress: 2.5 })).toBe('import_invalid_data');
    expect(bad({ day: '15-01-2026' })).toBe('import_invalid_data');
    expect(bad({ day: '2026-13-45' })).toBe('import_invalid_data');
    expect(bad({ bloating: 'yes' })).toBe('import_invalid_data');
    expect(bad({ tags: 'tag-travel' })).toBe('import_invalid_data');
    expect(bad({ tags: [''] })).toBe('import_invalid_data');
    expect(bad({ completed_tz: null })).toBe('import_invalid_data'); // stamp must be both or neither
    expect(bad({ completed_utc: 'yesterday' })).toBe('import_invalid_data');
    expect(err(file(records({ stool_entries: [{ ...stool, bristol: 0 }] })))).toBe('import_invalid_data');
    expect(err(file(records({ stool_entries: [{ ...stool, bristol: 7.5 }] })))).toBe('import_invalid_data');
    expect(err(file(records({ check_ins: [checkIn, checkIn] })))).toBe('import_invalid_data'); // duplicate id
    expect(err(file({ meals: [], skin_entries: [], nail_entries: [] }))).toBe('import_invalid_data'); // kinds missing
    expect(err(file(records(), { skin_areas: [] }))).toBe('import_invalid_data'); // lists missing
  });

  it('refuses to apply a check-in that uses a tag that will not exist (import_unknown_item)', async () => {
    const deps = makeDeps(new MemoryRepo());
    const parsed = { payload: parseDataJson(file(records({ check_ins: [{ ...checkIn, tags: ['tag-gone'] }] }))), preview: undefined as never };
    expect(await code(applyImport(deps, parsed, { mode: 'merge', parts: RECORDS }))).toBe('import_unknown_item');
  });
});

describe('data.json validation of alcohol and medication entries (IN-4, IN-5)', () => {
  const at = { utc: '2026-01-10T20:00:00.000Z', tz: 'Europe/Warsaw' };
  const alcohol = { id: 'al1', utc: at.utc, tz: at.tz, drink: 'x', amount_ml: 330, note: null };
  const med = { id: 'md1', utc: at.utc, tz: at.tz, category: 'medication', name: 'x', dose: null, note: null };
  const err = (r: object) => {
    try {
      parseDataJson({ schema_version: 1, records: { ...RAW_RECORDS, ...r } });
      return 'no error';
    } catch (e) {
      return e instanceof NettleError ? e.code : 'other';
    }
  };

  it('accepts valid entries and rejects bad amounts and categories', () => {
    expect(err({ alcohol_entries: [alcohol], medication_entries: [med] })).toBe('no error');
    for (const ml of [0, -1, 2.5, '330']) expect(err({ alcohol_entries: [{ ...alcohol, amount_ml: ml }] })).toBe('import_invalid_data');
    expect(err({ medication_entries: [{ ...med, category: 'herb' }] })).toBe('import_invalid_data');
    expect(err({ medication_entries: [{ ...med, name: '' }] })).toBe('import_invalid_data');
  });
});

describe('data.json validation of treatments, events, reactions and allergens (IN-10 to IN-13)', () => {
  const at = { utc: '2026-01-10T20:00:00.000Z', tz: 'Europe/Warsaw' };
  const application = { id: 'ta1', utc: at.utc, tz: at.tz, treatment_id: 'tr1', area_ids: ['area-chin'], note: null };
  const event = { id: 'ce1', utc: at.utc, tz: at.tz, action: 'started', category: 'product', name: 'x', note: null };
  const reaction = { id: 'r1', utc: at.utc, tz: at.tz, meal_id: 'm1', symptoms: ['hives'], note: null };
  const meal = { id: 'm1', utc: at.utc, tz: at.tz, description: 'x', ingredients: [], allergens: ['milk'], note: null };
  const records = (over: object = {}) => ({
    ...RAW_RECORDS,
    meals: [meal],
    treatment_applications: [application],
    change_events: [event],
    reactions: [reaction],
    ...over,
  });
  const file = (r: object, settings?: object) => ({ schema_version: 1, records: r, ...(settings && { settings }) });
  const err = (raw: unknown) => {
    try {
      parseDataJson(raw);
      return 'no error';
    } catch (e) {
      return e instanceof NettleError ? e.code : 'other';
    }
  };

  it('accepts all of them', () => {
    const p = parseDataJson(
      file(records(), {
        ...RAW_SETTINGS,
        treatments: [{ id: 'tr1', name: 'x', predefined: false, archived: false, name_override: null }],
      }),
    );
    expect(p.records?.meals[0]?.allergens).toEqual(['milk']);
    expect(p.records?.treatmentApplications[0]).toMatchObject({ treatmentId: 'tr1', areaIds: ['area-chin'] });
    expect(p.records?.changeEvents[0]).toMatchObject({ action: 'started', category: 'product' });
    expect(p.records?.reactions[0]).toMatchObject({ mealId: 'm1', symptoms: ['hives'] });
    expect(p.settings?.treatments).toHaveLength(1);
  });

  it('rejects unknown allergens, empty area or symptom lists and unknown enum values', () => {
    expect(err(file(records({ meals: [{ ...meal, allergens: ['dust'] }] })))).toBe('import_invalid_data');
    expect(err(file(records({ meals: [{ ...meal, allergens: undefined }] })))).toBe('import_invalid_data');
    expect(err(file(records({ treatment_applications: [{ ...application, area_ids: [] }] })))).toBe('import_invalid_data');
    expect(err(file(records({ change_events: [{ ...event, action: 'paused' }] })))).toBe('import_invalid_data');
    expect(err(file(records({ change_events: [{ ...event, category: 'mood' }] })))).toBe('import_invalid_data');
    expect(err(file(records({ reactions: [{ ...reaction, symptoms: [] }] })))).toBe('import_invalid_data');
    expect(err(file(records({ reactions: [{ ...reaction, symptoms: ['sneezing'] }] })))).toBe('import_invalid_data');
  });

  it('refuses to apply references to a missing meal, treatment or area', async () => {
    const deps = makeDeps(new MemoryRepo());
    const apply = (r: object) =>
      code(applyImport(deps, { payload: parseDataJson(file(r)), preview: undefined as never }, { mode: 'merge', parts: RECORDS }));
    expect(await apply(records({ meals: [], treatment_applications: [] }))).toBe('import_unknown_meal');
    expect(await apply(records({ reactions: [] }))).toBe('import_unknown_item'); // treatment tr1 is not known
    expect(await apply(records({ reactions: [], treatment_applications: [{ ...application, treatment_id: 'x', area_ids: ['nope'] }] }))).toBe(
      'import_unknown_area',
    );
  });
});

describe.each(repos)('export/import (%s)', (_name, make) => {
  it('EX-1 + EX-10 export both parts then replace both restores everything', async () => {
    const source = await seeded(make);
    const zip = await exportBundle(makeDeps(source));

    const target = await make();
    const deps = makeDeps(target);
    const parsed = await previewImport(deps, zip);
    expect(parsed.preview.has).toEqual(BOTH);
    expect(parsed.preview.incoming).toEqual({
      meals: 2,
      skinEntries: 2,
      nailEntries: 1,
      checkIns: 1,
      stoolEntries: 2,
      treatmentApplications: 1,
      changeEvents: 1,
      reactions: 1,
      alcoholEntries: 1,
      medicationEntries: 1,
      skinAreas: 8,
      dailyTags: 10,
      treatments: 1,
    });
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
    expect(parsed.preview.duplicates).toEqual({
      meals: 1,
      skinEntries: 0,
      nailEntries: 0,
      checkIns: 0,
      stoolEntries: 0,
      treatmentApplications: 0,
      changeEvents: 0,
      reactions: 0,
      alcoholEntries: 0,
      medicationEntries: 0,
      skinAreas: 6,
      dailyTags: 9,
      treatments: 0,
    });
    expect(parsed.preview.newRows).toEqual({
      meals: 1,
      skinEntries: 2,
      nailEntries: 1,
      checkIns: 1,
      stoolEntries: 2,
      treatmentApplications: 1,
      changeEvents: 1,
      reactions: 1,
      alcoholEntries: 1,
      medicationEntries: 1,
      skinAreas: 2,
      dailyTags: 1,
      treatments: 1,
    });
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
    for (const a of (await source.listAreas()).filter((a) => a.id.startsWith('a-'))) await target.upsertArea(a);
    for (const k of ['dailyTags', 'treatments'] as const) {
      for (const i of await source.listItems(k)) await target.upsertItem(k, i);
    }
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
    expect(json.settings.skin_areas).toHaveLength(8);
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
    for (const a of (await source.listAreas()).filter((a) => a.id.startsWith('a-'))) await target.upsertArea(a);
    for (const k of ['dailyTags', 'treatments'] as const) {
      for (const i of await source.listItems(k)) await target.upsertItem(k, i);
    }
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
    expect(json.settings.skin_areas).toHaveLength(8);
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
