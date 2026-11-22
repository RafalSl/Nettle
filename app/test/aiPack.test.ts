import { strFromU8, strToU8, unzipSync } from 'fflate';
import { SqliteRepo } from '@/adapters/storage/sqliteRepo';
import { parsePackResult } from '@/core/llm/packResult';
import { NettleError } from '@/core/model/errors';
import { deleteData } from '@/core/usecases/deleteData';
import { DELETE_GROUPS } from '@/core/model/deleteGroups';
import { editDrink, editMeal } from '@/core/usecases/entries';
import { exportBundle, applyImport, previewImport } from '@/core/usecases/exchange';
import { logDrink } from '@/core/usecases/intake';
import { logMeal } from '@/core/usecases/logMeal';
import { addPhoto } from '@/core/usecases/photos';
import { logSkinEntry } from '@/core/usecases/skin';
import {
  buildPack,
  completeSuggestion,
  dismissSuggestion,
  importResult,
  listSuggestions,
  markedEntries,
  packInstructions,
  preparePack,
  previewResult,
} from '@/core/usecases/aiPack';
import { MemoryRepo } from './fakes/memoryRepo';
import { createNodeSqliteDb } from './helpers/nodeSqliteDb';
import { makeDeps } from './helpers/fixtures';

const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );
const at = (iso: string) => new Date(iso);
const scores = { severity: 4, itch: 3, pain: 2, dryness: 1, scaling: 0 };
const sel = { dayFrom: '2026-01-10', dayTo: '2026-01-14', language: 'en' as const };
const analysis = {
  summary: 'Synthetic summary',
  hypotheses: [],
  order_and_lag: 'none',
  data_limits: ['few days'],
  questions_for_doctor: [],
};
const resultBytes = (o: object) => strToU8(JSON.stringify(o));

async function diary() {
  const repo = new MemoryRepo();
  const deps = makeDeps(repo, '2026-01-20T10:00:00.000Z');
  const skin = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: at('2026-01-11T08:00:00.000Z') });
  const sensitive = await logSkinEntry(deps, { areaId: 'area-penis', scores, at: at('2026-01-11T09:00:00.000Z') });
  const open = await addPhoto(deps, {
    entryKind: 'skinEntry',
    entryId: skin.id,
    sourceUri: 'open-photo',
    at: at('2026-01-11T08:05:00.000Z'),
  });
  const secret = await addPhoto(deps, {
    entryKind: 'skinEntry',
    entryId: sensitive.id,
    sourceUri: 'secret-photo',
    at: at('2026-01-11T09:05:00.000Z'),
  });
  const pancakes = await logMeal(deps, {
    description: 'Synthetic pancakes with jam',
    ingredients: [],
    fillLater: true,
    at: at('2026-01-02T08:00:00.000Z'),
  }); // outside the range: still goes in
  const smoothie = await logDrink(deps, {
    name: 'Synthetic banana smoothie',
    amountMl: 300,
    fillLater: true,
    at: at('2026-01-12T08:00:00.000Z'),
  });
  const plain = await logMeal(deps, { description: 'Synthetic toast', ingredients: ['bread'], at: at('2026-01-12T09:00:00.000Z') });
  return { repo, deps, skin, open, secret, pancakes, smoothie, plain };
}

describe('the mark "fill later with AI" (IN-20)', () => {
  it('IN-20 a meal or drink carries the mark only when it was set, edits keep or clear it, and the list finds every marked entry', async () => {
    const { deps, pancakes, smoothie, plain } = await diary();
    expect(plain.fillLater).toBeUndefined();
    expect(pancakes.fillLater).toBe(true);
    expect((await markedEntries(deps)).map((m) => [m.kind, m.id, m.text])).toEqual([
      ['meal', pancakes.id, 'Synthetic pancakes with jam'],
      ['drink', smoothie.id, 'Synthetic banana smoothie (300 ml)'],
    ]);
    const kept = await editMeal(deps, pancakes.id, { description: 'Synthetic pancakes with jam', ingredients: [], fillLater: true });
    expect(kept.fillLater).toBe(true);
    expect((await editMeal(deps, pancakes.id, { description: 'Synthetic pancakes', ingredients: [] })).fillLater).toBeUndefined();
    expect((await editDrink(deps, smoothie.id, { name: 'Synthetic banana smoothie', amountMl: 300 })).fillLater).toBeUndefined();
    expect(await markedEntries(deps)).toEqual([]);
  });

  it('IN-20, EX-1 the mark travels with the entry in data.json on both repositories', async () => {
    for (const make of [async () => new MemoryRepo(), async () => SqliteRepo.open(createNodeSqliteDb())]) {
      const deps = makeDeps(await make());
      const meal = await logMeal(deps, { description: 'Synthetic pancakes', ingredients: [], fillLater: true });
      const drink = await logDrink(deps, { name: 'Synthetic tea', amountMl: 200, fillLater: true });
      await logMeal(deps, { description: 'Synthetic toast', ingredients: ['bread'] });
      const zip = await exportBundle(deps, { parts: { records: true, settings: true } });
      const json = JSON.parse(strFromU8(unzipSync(zip)['data.json']!));
      expect(json.records.meals.filter((m: { fill_later?: boolean }) => m.fill_later).map((m: { id: string }) => m.id)).toEqual([meal.id]);
      expect(json.records.drinks[0].fill_later).toBe(true);
      expect(json.records.meals.find((m: { id: string }) => m.id !== meal.id).fill_later).toBeUndefined(); // only ever written as true
      const target = makeDeps(await make());
      const parsed = await previewImport(target, zip);
      await applyImport(target, parsed, { mode: 'replace', parts: { records: true, settings: true } });
      expect((await target.repo.listRecords('meals')).filter((m) => m.fillLater).map((m) => m.id)).toEqual([meal.id]);
      expect((await target.repo.listRecords('drinks'))[0]).toMatchObject({ id: drink.id, fillLater: true });
    }
  });
});

describe('the pack (LL-15)', () => {
  it('LL-15 writes one ZIP with pack.json, INSTRUCTIONS.md and only the chosen photos, never the key, and keeps a record of the pack', async () => {
    const { deps, open, secret, pancakes, smoothie } = await diary();
    await deps.keys.set('anthropic_api_key', 'sk-synthetic-secret');
    const pack = await buildPack(deps, { ...sel, photoIds: [open.id] });
    expect(pack.packId).toMatch(/^pack-[0-9a-f]{12}$/);
    expect(pack.fileName).toBe('nettle-pack-2026-01-10_2026-01-14.zip');
    const files = unzipSync(pack.bytes);
    expect(Object.keys(files).sort()).toEqual(['INSTRUCTIONS.md', 'pack.json', 'photos/photo-01.jpg']);
    const text = Object.values(files)
      .map((f) => strFromU8(f))
      .join('\n');
    expect(text).not.toContain('sk-synthetic-secret');
    const json = JSON.parse(strFromU8(files['pack.json']!));
    expect(json).toMatchObject({ pack_id: pack.packId, period: { from: '2026-01-10', to: '2026-01-14' }, language: 'en' });
    expect(json.photos).toEqual([
      {
        file: 'photos/photo-01.jpg',
        label: expect.stringContaining('Chin'),
        sensitive: false,
        since_last_treatment: expect.stringMatching(/no treatment logged/),
      },
    ]);
    expect(JSON.stringify(json)).not.toContain(secret.file); // the sensitive photo was not chosen
    expect(json.diary.period).toMatchObject({ from: '2026-01-10', to: '2026-01-14' });
    expect(json.fills.map((f: { id: string; kind: string; text: string }) => [f.kind, f.id, f.text])).toEqual([
      ['meal', pancakes.id, 'Synthetic pancakes with jam'],
      ['drink', smoothie.id, 'Synthetic banana smoothie (300 ml)'],
    ]); // marked entries go in whatever their date, with exactly what was typed
    const instructions = strFromU8(files['INSTRUCTIONS.md']!);
    expect(instructions).toContain(pack.packId);
    expect(instructions).toContain('result.json');
    expect(instructions).toContain('hypotheses'); // the analysis schema
    expect(instructions).toContain('Task 3: fills');
  });

  it('LL-15 a sensitive photo goes in only when its id is chosen, and a pack with no photos says so', async () => {
    const { deps, open, secret } = await diary();
    const withSecret = await buildPack(deps, { ...sel, photoIds: [open.id, secret.id] });
    const json = JSON.parse(strFromU8(unzipSync(withSecret.bytes)['pack.json']!));
    expect(json.photos.map((p: { sensitive: boolean }) => p.sensitive)).toEqual([false, true]);
    const none = await buildPack(deps, sel);
    expect(Object.keys(unzipSync(none.bytes)).some((n) => n.startsWith('photos/'))).toBe(false);
    expect(packInstructions('pack-000000000000', 'en', false, false)).toContain('No photos are included');
  });

  it('LL-15, LL-5 the preparation lists what is inside without writing a pack, and bad input is refused', async () => {
    const { deps, open } = await diary();
    const prepared = await preparePack(deps, { ...sel, photoIds: [open.id] });
    expect(prepared.counts).toMatchObject({ skinEntries: 2, photos: 1 });
    expect(prepared.marked.map((m) => m.kind)).toEqual(['meal', 'drink']);
    expect(prepared.photos).toEqual([{ id: open.id, label: expect.stringContaining('Chin'), sensitive: false }]);
    expect(await deps.settings.get('ai_pack_state')).toBeNull(); // nothing remembered yet
    expect(await code(preparePack(deps, { ...sel, dayFrom: '2026-01-15' }))).toBe('invalid_range');
    expect(await code(preparePack(deps, { ...sel, photoIds: ['nope'] }))).toBe('unknown_photo');
    expect(await code(preparePack(deps, { ...sel, photoIds: Array.from({ length: 21 }, (_, i) => `p${i}`) }))).toBe('too_many_photos');
    const empty = makeDeps(new MemoryRepo());
    expect(await code(preparePack(empty, sel))).toBe('analysis_no_data');
    await logMeal(empty, { description: 'Synthetic', ingredients: [], fillLater: true, at: at('2025-06-01T08:00:00.000Z') });
    expect(await code(preparePack(empty, sel))).toBe('no error'); // only marked entries is still a pack
  });
});

describe('the result (LL-15)', () => {
  const answer = (packId: string, over: object = {}) => ({
    pack_id: packId,
    model: 'Synthetic Model 9',
    analysis,
    report_summary: 'Synthetic narrative for the doctor.',
    fills: [],
    ...over,
  });

  it('LL-15 the parser refuses what is not a result, is too large or has the wrong shape, and cleans the fills', () => {
    const ok = answer('pack-0123456789ab', {
      fills: [
        { kind: 'meal', id: 'm1', ingredients: [' flour ', 'flour', '', 'milk'], allergens: ['milk', 'dust', 'milk'], note: ' varies ' },
      ],
    });
    expect(parsePackResult(resultBytes(ok))).toMatchObject({
      packId: 'pack-0123456789ab',
      model: 'Synthetic Model 9',
      reportSummary: 'Synthetic narrative for the doctor.',
      fills: [{ ingredients: ['flour', 'milk'], allergens: ['milk'], note: 'varies' }],
    });
    const bad = (o: unknown) => () => parsePackResult(typeof o === 'string' ? strToU8(o) : resultBytes(o as object));
    for (const x of [
      'not json',
      '[]',
      answer('nope'),
      answer('pack-0123456789ab', { model: '' }),
      answer('pack-0123456789ab', { analysis: { summary: 1 } }),
      answer('pack-0123456789ab', { report_summary: '  ' }),
      answer('pack-0123456789ab', { fills: [{ kind: 'meal', id: 'm1', ingredients: 'x', allergens: [], note: null }] }),
      answer('pack-0123456789ab', { fills: [{ kind: 'snack', id: 'm1', ingredients: [], allergens: [], note: null }] }),
      { pack_id: 'pack-0123456789ab', model: 'm' },
    ]) {
      expect(bad(x)).toThrow(NettleError);
    }
    expect(() => parsePackResult(new Uint8Array(50 * 1024 * 1024 + 1))).toThrow(expect.objectContaining({ code: 'import_too_large' }));
  });

  it('LL-15, LL-7, IN-20 an import stores the analysis and the summary as manual objects, queues the fills, and changes no entry', async () => {
    const { repo, deps, pancakes, smoothie } = await diary();
    const { packId } = await buildPack(deps, sel);
    const before = JSON.stringify([
      await repo.listRecords('meals'),
      await repo.listRecords('drinks'),
      await repo.listRecords('skinEntries'),
    ]);
    const bytes = resultBytes(
      answer(packId, {
        fills: [
          {
            kind: 'meal',
            id: pancakes.id,
            ingredients: ['wheat flour', 'milk', 'egg'],
            allergens: ['gluten', 'milk', 'eggs'],
            note: 'Recipes differ.',
          },
          { kind: 'drink', id: smoothie.id, ingredients: ['banana', 'milk'], allergens: ['milk'], note: null },
        ],
      }),
    );
    const preview = await previewResult(deps, bytes);
    expect(preview).toEqual({
      packId,
      model: 'Synthetic Model 9',
      dayFrom: '2026-01-10',
      dayTo: '2026-01-14',
      hasAnalysis: true,
      hasSummary: true,
      fillsAccepted: 2,
      fillsSkipped: 0,
      alreadyImported: false,
    });
    expect(await repo.listRecords('analyses')).toEqual([]); // a preview stores nothing
    const done = await importResult(deps, bytes);
    expect(done.imported).toBe(true);
    expect(await repo.listRecords('analyses')).toMatchObject([
      {
        manual: true,
        model: 'Synthetic Model 9',
        dayFrom: '2026-01-10',
        dayTo: '2026-01-14',
        language: 'en',
        result: { summary: 'Synthetic summary' },
      },
    ]);
    expect(await repo.listRecords('reportSummaries')).toMatchObject([
      {
        manual: true,
        model: 'Synthetic Model 9',
        text: 'Synthetic narrative for the doctor.',
        generated: 'Synthetic narrative for the doctor.',
      },
    ]);
    expect((await listSuggestions(deps)).map((s) => [s.kind, s.entryId, s.ingredients])).toEqual([
      ['meal', pancakes.id, ['wheat flour', 'milk', 'egg']],
      ['drink', smoothie.id, ['banana', 'milk']],
    ]);
    expect(JSON.stringify([await repo.listRecords('meals'), await repo.listRecords('drinks'), await repo.listRecords('skinEntries')])).toBe(
      before,
    ); // no entry changed
  });

  it('LL-15 a result for another pack, for entries outside its pack, or an empty one is refused; one imported before is skipped', async () => {
    const { repo, deps, pancakes, plain } = await diary();
    const { packId } = await buildPack(deps, sel);
    expect(await code(previewResult(deps, resultBytes(answer('pack-aaaaaaaaaaaa'))))).toBe('result_wrong_pack');
    expect(
      await code(
        previewResult(
          deps,
          resultBytes(
            answer(packId, {
              analysis: null,
              report_summary: null,
              fills: [{ kind: 'meal', id: plain.id, ingredients: ['x'], allergens: [], note: null }],
            }),
          ),
        ),
      ),
    ).toBe('result_unknown_entry'); // an unmarked entry is not in the pack
    expect(await code(previewResult(deps, resultBytes({ pack_id: packId, model: 'm' })))).toBe('result_invalid');
    const bytes = resultBytes(
      answer(packId, { fills: [{ kind: 'meal', id: pancakes.id, ingredients: ['flour'], allergens: [], note: null }] }),
    );
    expect((await importResult(deps, bytes)).imported).toBe(true);
    expect((await previewResult(deps, bytes)).alreadyImported).toBe(true);
    const again = await importResult(deps, bytes);
    expect(again).toMatchObject({ imported: false, alreadyImported: true });
    expect(await repo.listRecords('analyses')).toHaveLength(1);
    expect(await listSuggestions(deps)).toHaveLength(1);
  });

  it('LL-15 an import that fails part way stores nothing and can run again without a second analysis', async () => {
    const { repo, deps } = await diary();
    const { packId } = await buildPack(deps, sel);
    const bytes = resultBytes(answer(packId));
    const addRecord = repo.addRecord.bind(repo);
    let fail = true;
    repo.addRecord = (async (kind: Parameters<typeof addRecord>[0], r: never) => {
      if (kind === 'reportSummaries' && fail) throw new Error('synthetic storage failure');
      return addRecord(kind, r);
    }) as typeof repo.addRecord;
    expect(await code(importResult(deps, bytes))).toBe('other');
    expect(await repo.listRecords('analyses')).toEqual([]);
    expect((await previewResult(deps, bytes)).alreadyImported).toBe(false);
    fail = false;
    expect((await importResult(deps, bytes)).imported).toBe(true);
    expect(await repo.listRecords('analyses')).toHaveLength(1);
    expect(await repo.listRecords('reportSummaries')).toHaveLength(1);
  });

  it('IN-20 a fill for an entry that was deleted or unmarked since the pack is skipped and counted, and so is a second fill for one entry', async () => {
    const { deps, pancakes, smoothie } = await diary();
    const { packId } = await buildPack(deps, sel);
    await editDrink(deps, smoothie.id, { name: 'Synthetic banana smoothie', amountMl: 300 }); // unmarked since
    const fills = [
      { kind: 'meal', id: pancakes.id, ingredients: ['flour'], allergens: [], note: null },
      { kind: 'meal', id: pancakes.id, ingredients: ['rice'], allergens: [], note: null },
      { kind: 'drink', id: smoothie.id, ingredients: ['banana'], allergens: [], note: null },
    ];
    const preview = await previewResult(deps, resultBytes(answer(packId, { analysis: null, report_summary: null, fills })));
    expect(preview).toMatchObject({ fillsAccepted: 1, fillsSkipped: 2 });
    await importResult(deps, resultBytes(answer(packId, { analysis: null, report_summary: null, fills })));
    expect((await listSuggestions(deps)).map((s) => s.ingredients)).toEqual([['flour']]);
  });

  it('IN-20 a suggestion for an entry that is deleted later is dropped from the list, so the card never counts it', async () => {
    const { deps, pancakes } = await diary();
    const { packId } = await buildPack(deps, sel);
    await importResult(
      deps,
      resultBytes(
        answer(packId, {
          analysis: null,
          report_summary: null,
          fills: [{ kind: 'meal', id: pancakes.id, ingredients: ['flour'], allergens: [], note: null }],
        }),
      ),
    );
    expect(await listSuggestions(deps)).toHaveLength(1);
    await deps.repo.deleteRecords({ meals: [pancakes.id] });
    expect(await listSuggestions(deps)).toEqual([]);
  });
});

describe('suggestions to review (IN-20)', () => {
  async function withSuggestion() {
    const d = await diary();
    const { packId } = await buildPack(d.deps, sel);
    await importResult(
      d.deps,
      resultBytes({
        pack_id: packId,
        model: 'Synthetic Model 9',
        fills: [{ kind: 'meal', id: d.pancakes.id, ingredients: ['wheat flour', 'milk'], allergens: ['gluten', 'milk'], note: null }],
      }),
    );
    const [suggestion] = await listSuggestions(d.deps);
    return { ...d, suggestion: suggestion! };
  }

  it('IN-20 dismissing removes the suggestion and keeps the mark, so the next pack asks again', async () => {
    const { deps, suggestion, pancakes } = await withSuggestion();
    await dismissSuggestion(deps, suggestion.id);
    expect(await listSuggestions(deps)).toEqual([]);
    expect((await markedEntries(deps)).map((m) => m.id)).toContain(pancakes.id);
    expect(await code(completeSuggestion(deps, suggestion.id, { edited: false, aiTags: false }))).toBe('suggestion_gone');
  });

  it('IN-16, IN-20 completing clears the mark and gives a typed entry the source name estimate (manual) with the model the result names', async () => {
    const { deps, suggestion, pancakes } = await withSuggestion();
    await editMeal(deps, pancakes.id, {
      description: 'Synthetic pancakes with jam',
      ingredients: ['wheat flour', 'milk'],
      allergens: ['gluten'],
      fillLater: true,
    }); // what the edit screen saves first
    await completeSuggestion(deps, suggestion.id, { edited: true, aiTags: true });
    const [meal] = (await deps.repo.listRecords('meals')).filter((m) => m.id === pancakes.id);
    expect(meal).toMatchObject({
      ingredients: ['wheat flour', 'milk'],
      allergens: ['gluten'],
      source: {
        kind: 'name_estimate',
        edited: true,
        aiTags: true,
        llm: { model: 'Synthetic Model 9', promptVersion: 'manual', manual: true },
      },
    });
    expect(meal!.fillLater).toBeUndefined();
    expect(await listSuggestions(deps)).toEqual([]);
  });

  it('IN-16, IN-20 completing works when the edit just saved already switched the mark off', async () => {
    const { deps, suggestion, pancakes } = await withSuggestion();
    await editMeal(deps, pancakes.id, {
      description: 'Synthetic pancakes with jam',
      ingredients: ['wheat flour', 'milk'],
      allergens: [],
      fillLater: false,
    });
    await completeSuggestion(deps, suggestion.id, { edited: false, aiTags: false });
    const meal = (await deps.repo.listRecords('meals')).find((m) => m.id === pancakes.id)!;
    expect(meal.source).toMatchObject({ kind: 'name_estimate', llm: { model: 'Synthetic Model 9', manual: true } });
    expect(meal.fillLater).toBeUndefined();
    expect(await listSuggestions(deps)).toEqual([]);
  });

  it('IN-20 an entry that already has another source keeps it, and the manual flag survives export and import', async () => {
    const { deps, suggestion, pancakes } = await withSuggestion();
    const scanned = {
      kind: 'label_scan' as const,
      edited: false,
      aiTags: false,
      llm: { model: 'm', at: '2026-01-03T00:00:00.000Z', promptVersion: 'label-1' },
    };
    await deps.repo.putRecord('meals', { ...(await deps.repo.listRecords('meals')).find((m) => m.id === pancakes.id)!, source: scanned });
    await completeSuggestion(deps, suggestion.id, { edited: false, aiTags: false });
    expect((await deps.repo.listRecords('meals')).find((m) => m.id === pancakes.id)).toMatchObject({ source: scanned });
    // a manual name estimate and an imported analysis round-trip through data.json
    await deps.repo.putRecord('meals', {
      ...(await deps.repo.listRecords('meals')).find((m) => m.id === pancakes.id)!,
      source: {
        kind: 'name_estimate',
        edited: false,
        aiTags: false,
        llm: { model: 'Synthetic Model 9', at: '2026-01-20T10:00:00.000Z', promptVersion: 'manual', manual: true },
      },
    });
    const { packId } = await buildPack(deps, sel);
    await importResult(
      deps,
      resultBytes({ pack_id: packId, model: 'Synthetic Model 9', analysis, report_summary: 'Synthetic narrative.' }),
    );
    const zip = await exportBundle(deps, { parts: { records: true, settings: true } });
    const target = makeDeps(new MemoryRepo());
    await applyImport(target, await previewImport(target, zip), { mode: 'replace', parts: { records: true, settings: true } });
    expect((await target.repo.listRecords('meals')).find((m) => m.id === pancakes.id)!.source.llm).toMatchObject({ manual: true });
    expect((await target.repo.listRecords('analyses'))[0]).toMatchObject({ manual: true });
    expect((await target.repo.listRecords('reportSummaries'))[0]).toMatchObject({ manual: true });
  });

  it('LL-15 deleting the AI data also forgets packs and suggestions, but the marks on entries stay', async () => {
    const { deps, pancakes } = await withSuggestion();
    await deleteData(deps, { kinds: DELETE_GROUPS.ai });
    expect(await deps.settings.get('ai_pack_state')).toBeNull();
    expect(await listSuggestions(deps)).toEqual([]);
    expect((await markedEntries(deps)).map((m) => m.id)).toContain(pancakes.id);
  });
});
