import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { SqliteRepo } from '@/adapters/storage/sqliteRepo';
import { DELETE_GROUPS } from '@/core/model/deleteGroups';
import { deleteData } from '@/core/usecases/deleteData';
import { applyImport, exportBundle, previewImport } from '@/core/usecases/exchange';
import { buildAnalysisInput, LOOKBACK_DAYS } from '@/core/llm/analysisInput';
import { analysisPrompt } from '@/core/llm/analysisPrompt';
import { analysisResultFromJson } from '@/core/llm/analysisResult';
import { NettleError } from '@/core/model/errors';
import { addDays, localDateTime } from '@/core/model/time';
import type { StorageRepository } from '@/core/ports/storage';
import { listAnalyses, MAX_ANALYSIS_PHOTOS, prepareAnalysis, runAnalysis } from '@/core/usecases/analysis';
import { saveCheckIn } from '@/core/usecases/checkin';
import { logMeal } from '@/core/usecases/logMeal';
import { addPhoto } from '@/core/usecases/photos';
import { saveApiKey } from '@/core/usecases/llm';
import { applyTreatment, logChangeEvent, logReaction } from '@/core/usecases/events';
import { addListItem } from '@/core/usecases/lists';
import { logNailEntry, addArea, logSkinEntry } from '@/core/usecases/skin';
import { logMedication } from '@/core/usecases/intake';
import { FakeLlm } from './fakes/fakeLlm';
import { MemoryRepo } from './fakes/memoryRepo';
import { createNodeSqliteDb } from './helpers/nodeSqliteDb';
import { makeDeps } from './helpers/fixtures';

const repos: [string, () => Promise<StorageRepository>][] = [
  ['in-memory', async () => new MemoryRepo()],
  ['sqlite', async () => SqliteRepo.open(createNodeSqliteDb())],
];
const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );
const scores = { severity: 6, itch: 7, pain: 1, dryness: 4, scaling: 5 };
const VALID_ANSWER = JSON.stringify({
  summary: 'Synthetic summary',
  hypotheses: [
    { title: 'Synthetic hypothesis', explanation: 'x', evidence: ['2026-01-12 meal'], counter_evidence: [], uncertainty: 'Few data points', lag_hours: 24, strength: 'weak' },
  ],
  order_and_lag: 'No clear order',
  data_limits: ['Only 5 days'],
  suggestions: ['Keep logging'],
});

/** A small synthetic diary: a period of 2026-01-10 to 2026-01-14 (Warsaw, UTC+1) and an antibiotic started before it. */
async function diary(make: () => Promise<StorageRepository>, llm = new FakeLlm([VALID_ANSWER])) {
  const repo = await make();
  const deps = makeDeps(repo, '2026-01-20T10:00:00.000Z', llm);
  await saveApiKey(deps, 'synthetic-test-key');
  const at = (s: string) => new Date(s);
  const m1 = await logMeal(deps, { description: 'Synthetic pasta', ingredients: ['Wheat Pasta', 'tomato'], allergens: ['gluten'], at: at('2026-01-10T11:00:00.000Z') });
  await logMeal(deps, { description: 'Synthetic soup', ingredients: ['tomato', 'celery'], allergens: ['celery'], at: at('2026-01-11T11:00:00.000Z') });
  await logMeal(deps, { description: 'Synthetic salad', ingredients: ['tomato'], at: at('2026-01-12T11:00:00.000Z') });
  await logSkinEntry(deps, { areaId: 'area-chin', scores, at: at('2026-01-12T20:00:00.000Z') });
  const nail = await addArea(deps, 'Left thumb', 'nail');
  await logNailEntry(deps, { areaId: nail.id, stage: 'yellow', extent: 'under_quarter', at: at('2026-01-13T08:00:00.000Z') });
  await logReaction(deps, { mealId: m1.id, symptoms: ['hives'], at: at('2026-01-10T12:00:00.000Z') });
  const cream = await addListItem(deps, 'treatments', 'Synthetic cream');
  await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin'], at: at('2026-01-12T21:00:00.000Z') });
  await saveCheckIn(deps, { at: at('2026-01-12T21:30:00.000Z'), values: { 'item-wellbeing': 4, 'item-stress': 8, 'tag-antibiotics': true }, confirmEmptyDay: true });
  await saveCheckIn(deps, { at: at('2026-01-13T21:30:00.000Z'), values: { 'item-wellbeing': 5 }, confirmEmptyDay: true });
  await logChangeEvent(deps, { action: 'started', category: 'cat-product', name: 'Synthetic antibiotic', at: at('2025-12-30T09:00:00.000Z') });
  await logMedication(deps, { category: 'supplement', name: 'Synthetic vitamin', at: at('2025-12-28T09:00:00.000Z') });
  await logMeal(deps, { description: 'Synthetic lookback meal', ingredients: ['rice'], at: at('2025-12-29T11:00:00.000Z') }); // must not be sent
  await logMeal(deps, { description: 'Synthetic later meal', ingredients: ['bread'], at: at('2026-01-16T11:00:00.000Z') }); // after the period
  return { repo, deps, llm, nail };
}

describe('buildAnalysisInput (LL-2, LL-3, LL-4)', () => {
  it('LL-4 and IN-16 tell the model where a non-typed ingredient list came from', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    const llm = { model: 'm', at: '2026-01-10T00:00:00.000Z', promptVersion: 'p' };
    const at = new Date('2026-01-12T10:00:00Z');
    await logMeal(deps, { description: 'Synthetic a', ingredients: ['x'], source: { kind: 'photo_estimate', edited: true, llm, aiTags: false }, at });
    await logMeal(deps, { description: 'Synthetic b', ingredients: ['y'], at });
    await logMeal(deps, { description: 'Synthetic n', ingredients: ['w'], source: { kind: 'name_estimate', edited: false, llm, aiTags: false }, at }); // IN-19
    const data = JSON.parse(buildAnalysisInput(await repo.snapshot(), '2026-01-10', '2026-01-14').json);
    const meals = data.days.flatMap((d: { meals?: { description: string }[] }) => d.meals ?? []);
    expect(meals.find((m: { description: string }) => m.description === 'Synthetic a').ingredients_source).toBe('photo_estimate (edited by the user)');
    expect(meals.find((m: { description: string }) => m.description === 'Synthetic b').ingredients_source).toBeUndefined();
    expect(meals.find((m: { description: string }) => m.description === 'Synthetic n').ingredients_source).toBe('name_estimate');
    const tagged = await logMeal(deps, { description: 'Synthetic c', ingredients: ['z'], source: { kind: 'typed', edited: false, llm: null, aiTags: true }, at });
    expect(tagged.source.aiTags).toBe(true);
    const again = JSON.parse(buildAnalysisInput(await repo.snapshot(), '2026-01-10', '2026-01-14').json).days.flatMap((d: { meals?: { description: string }[] }) => d.meals ?? []);
    expect(again.find((m: { description: string }) => m.description === 'Synthetic c').allergens_source).toContain('ai_suggestion');
  });

  it('LL-2 builds a timeline by local day with local times, areas, treatments and reactions by name', async () => {
    const { repo } = await diary(async () => new MemoryRepo());
    const built = buildAnalysisInput(await repo.snapshot(), '2026-01-10', '2026-01-14');
    const data = JSON.parse(built.json);
    const day = (d: string) => data.days.find((x: { date: string }) => x.date === d);
    expect(day('2026-01-10').meals[0]).toMatchObject({ time: '12:00', description: 'Synthetic pasta', allergens: ['gluten'] });
    expect(day('2026-01-10').reactions[0]).toMatchObject({ onset: '13:00', symptoms: ['hives'] });
    expect(day('2026-01-10').reactions[0].meal).toContain('Synthetic pasta');
    expect(day('2026-01-12').skin[0]).toMatchObject({ area: 'Chin', severity: 6, itch: 7 });
    expect(day('2026-01-12').treatments[0]).toMatchObject({ name: 'Synthetic cream', areas: ['Chin'] });
    expect(day('2026-01-12').daily_health).toEqual({ scores: { wellbeing: 4, stress: 8 }, yes: ['antibiotics'] });
    expect(day('2026-01-13').nails[0]).toMatchObject({ nail: 'Left thumb', stage: 'yellow' });
  });

  it('LL-4 counts logged days (a Daily health record), shows empty days, and flags the unlogged ones', async () => {
    const { repo } = await diary(async () => new MemoryRepo());
    const built = buildAnalysisInput(await repo.snapshot(), '2026-01-10', '2026-01-14');
    const data = JSON.parse(built.json);
    expect(built.days).toBe(5);
    expect(built.completeDays).toBe(2);
    expect(data.period).toMatchObject({ days: 5, days_logged: 2, days_with_meals: 3 });
    const days = data.days.filter((d: { context?: boolean }) => !d.context);
    expect(days.map((d: { date: string }) => d.date)).toEqual(['2026-01-10', '2026-01-11', '2026-01-12', '2026-01-13', '2026-01-14']);
    expect(days.find((d: { date: string }) => d.date === '2026-01-12').logged).toBe(true);
    expect(days.find((d: { date: string }) => d.date === '2026-01-13').logged).toBe(true);
    expect(days.find((d: { date: string }) => d.date === '2026-01-14').logged).toBeNull(); // nothing logged
  });

  it('LL-3 includes a 21 day lookback for change events and medication only, flagged as context', async () => {
    const { repo } = await diary(async () => new MemoryRepo());
    const built = buildAnalysisInput(await repo.snapshot(), '2026-01-10', '2026-01-14');
    const context = JSON.parse(built.json).days.filter((d: { context?: boolean }) => d.context);
    expect(context.map((d: { date: string }) => d.date)).toEqual(['2025-12-28', '2025-12-30']);
    expect(context[1].events[0]).toMatchObject({ action: 'started', name: 'Synthetic antibiotic' });
    expect(context[0].medication[0].name).toBe('Synthetic vitamin');
    expect(built.json).not.toContain('lookback meal'); // meals are not sent outside the period
    expect(built.json).not.toContain('Synthetic later meal'); // nor after it
    expect(addDays('2026-01-10', -LOOKBACK_DAYS)).toBe('2025-12-20');
    expect(built.counts.lookbackDays).toBe(2);
  });

  it('LL-4 precomputes how often each ingredient and allergen was eaten, so "most days" is visible', async () => {
    const { repo } = await diary(async () => new MemoryRepo());
    const data = JSON.parse(buildAnalysisInput(await repo.snapshot(), '2026-01-10', '2026-01-14').json);
    expect(data.ingredient_frequency[0]).toEqual({ ingredient: 'tomato', days_eaten: 3, share_of_days_with_meals: 1 });
    expect(data.ingredient_frequency.map((f: { ingredient: string }) => f.ingredient)).toContain('wheat pasta');
    expect(data.allergen_frequency).toEqual(
      expect.arrayContaining([{ allergen: 'gluten', days_eaten: 1, share_of_days_with_meals: 0.33 }]),
    );
  });

  it('NF-4 a late evening entry belongs to its local day, not the UTC day', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    await logMeal(deps, { description: 'Synthetic late snack', ingredients: [], at: new Date('2026-01-10T23:30:00.000Z') }); // 00:30 on the 11th in Warsaw
    const data = JSON.parse(buildAnalysisInput(await repo.snapshot(), '2026-01-10', '2026-01-11').json);
    expect(data.days.find((d: { date: string }) => d.date === '2026-01-11').meals[0].time).toBe('00:30');
    expect(data.days.find((d: { date: string }) => d.date === '2026-01-10').meals).toBeUndefined();
    expect(localDateTime('2026-01-10T23:30:00.000Z', 'Europe/Warsaw')).toBe('2026-01-11 00:30');
  });
});

describe('analysis prompt (LL-4, LL-10, LL-11)', () => {
  const p = analysisPrompt('pl', { json: '{}', photoNotes: ['Chin 2026-01-12 20:00'] });

  it('asks for hypotheses with uncertainty, windows, lookbacks, confounders, incomplete days and limits', () => {
    for (const phrase of ['never diagnose', 'tentative hypothes', '24, 48 and 72 hours', '7 and 21 days', 'confounders', '"logged": false', 'most days', 'cannot answer', 'order_and_lag']) {
      expect(p.system).toContain(phrase);
    }
    expect(p.system).toContain('Polish');
  });

  it('describes attached photos in order, stays provider-neutral and leaves no "strong" strength', () => {
    expect(p.user).toContain('1. Chin 2026-01-12 20:00');
    expect(JSON.stringify(p)).not.toMatch(/anthropic|claude/i);
    expect(JSON.stringify(p.schema)).toContain('"enum":["weak","moderate"]');
  });
});

describe('analysisResultFromJson (LL-4)', () => {
  const ok = JSON.parse(VALID_ANSWER);
  it('accepts a complete answer and rejects anything off-shape or too confident', () => {
    expect(analysisResultFromJson(ok)?.hypotheses[0]).toMatchObject({ strength: 'weak', lagHours: 24 });
    expect(analysisResultFromJson({ ...ok, hypotheses: [{ ...ok.hypotheses[0], strength: 'strong' }] })).toBeNull();
    expect(analysisResultFromJson({ ...ok, hypotheses: [{ ...ok.hypotheses[0], lag_hours: -1 }] })).toBeNull();
    expect(analysisResultFromJson({ ...ok, hypotheses: [{ ...ok.hypotheses[0], evidence: 'x' }] })).toBeNull();
    expect(analysisResultFromJson({ ...ok, summary: undefined })).toBeNull();
    expect(analysisResultFromJson({ ...ok, data_limits: [1] })).toBeNull();
    expect(analysisResultFromJson(null)).toBeNull();
  });
});

describe.each(repos)('prepare and run an analysis (%s)', (_name, make) => {
  const sel = { dayFrom: '2026-01-10', dayTo: '2026-01-14', language: 'en' as const };

  it('LL-5 prepare reports what will be sent and sends nothing', async () => {
    const { deps, llm } = await diary(make);
    const prepared = await prepareAnalysis(deps, sel);
    expect(llm.requests).toHaveLength(0);
    expect(prepared).toMatchObject({ dayFrom: '2026-01-10', dayTo: '2026-01-14', model: 'claude-haiku-5-5', promptVersion: 'analysis-7' });
    expect(prepared.counts).toMatchObject({ meals: 3, skinEntries: 1, nailEntries: 1, reactions: 1, treatmentApplications: 1, checkIns: 2, days: 5, completeDays: 2, photos: 0 });
    expect(prepared.counts.changeEvents).toBe(1); // lookback
    expect(prepared.sentCharacters).toBeGreaterThan(500);
  });

  it('LL-6 photos are off by default; chosen photos are sent with labels, sensitive ones only when chosen', async () => {
    const { deps, llm } = await diary(make);
    const entry = (await deps.repo.listSkinEntries())[0]!;
    const intimate = await logSkinEntry(deps, { areaId: 'area-penis', scores, at: new Date('2026-01-12T22:00:00.000Z') });
    const normal = await addPhoto(deps, { entryKind: 'skinEntry', entryId: entry.id, sourceUri: 'chin-photo', at: new Date('2026-01-12T20:05:00.000Z') });
    const hidden = await addPhoto(deps, { entryKind: 'skinEntry', entryId: intimate.id, sourceUri: 'private-photo', at: new Date('2026-01-12T22:05:00.000Z') });
    expect(hidden.sensitive).toBe(true);

    expect((await prepareAnalysis(deps, sel)).request.images).toEqual([]);
    const chosen = await prepareAnalysis(deps, { ...sel, photoIds: [normal.id] });
    expect(chosen.photos).toEqual([{ id: normal.id, label: 'Chin 2026-01-12 21:05', sensitive: false }]);
    expect(chosen.request.images).toHaveLength(1);
    expect(chosen.request.user).toContain('1. Chin 2026-01-12 21:05');
    const both = await prepareAnalysis(deps, { ...sel, photoIds: [normal.id, hidden.id] });
    expect(both.photos.map((p) => p.sensitive)).toEqual([false, true]);
    expect(llm.requests).toHaveLength(0);
  });

  it('LL-6 rejects an unknown photo and more photos than the cap', async () => {
    const { deps } = await diary(make);
    expect(await code(prepareAnalysis(deps, { ...sel, photoIds: ['nope'] }))).toBe('unknown_photo');
    const ids = Array.from({ length: MAX_ANALYSIS_PHOTOS + 1 }, (_, i) => `p${i}`);
    expect(await code(prepareAnalysis(deps, { ...sel, photoIds: ids }))).toBe('too_many_photos');
  });

  it('LL-2 rejects bad ranges and a range with nothing logged', async () => {
    const { deps } = await diary(make);
    expect(await code(prepareAnalysis(deps, { ...sel, dayFrom: '2026-01-14', dayTo: '2026-01-10' }))).toBe('invalid_range');
    expect(await code(prepareAnalysis(deps, { ...sel, dayFrom: '10-01-2026' }))).toBe('invalid_range');
    expect(await code(prepareAnalysis(deps, { ...sel, dayFrom: '2026-02-01', dayTo: '2026-02-05' }))).toBe('analysis_no_data');
  });

  it('LL-7 run stores the analysis as its own object with model, run date, prompt version and counts', async () => {
    const { deps, llm, repo } = await diary(make);
    const before = await repo.snapshot();
    const prepared = await prepareAnalysis(deps, sel);
    const analysis = await runAnalysis(deps, prepared);
    expect(llm.requests[0]).toBe(prepared.request); // exactly what was confirmed
    expect(analysis).toMatchObject({ dayFrom: '2026-01-10', dayTo: '2026-01-14', model: 'fake-model', promptVersion: 'analysis-7', language: 'en', at: { utc: '2026-01-20T10:00:00.000Z' } });
    expect(analysis.result.hypotheses[0]?.title).toBe('Synthetic hypothesis');
    expect(await listAnalyses(deps)).toEqual([analysis]);
    const after = await repo.snapshot();
    expect({ ...after, analyses: [] }).toEqual({ ...before, analyses: [] }); // raw entries untouched
  });

  it.each([
    ['rate limit', new NettleError('llm_rate_limited'), 'llm_rate_limited'],
    ['no network', new NettleError('llm_network'), 'llm_network'],
    ['invalid key', new NettleError('llm_invalid_key'), 'llm_invalid_key'],
    ['spend cap', new NettleError('llm_billing'), 'llm_billing'],
    ['refusal', new NettleError('llm_refused'), 'llm_refused'],
  ])('LL-8 %s: a clear code and nothing stored', async (_n, error, expected) => {
    const { deps } = await diary(make, new FakeLlm([error]));
    const prepared = await prepareAnalysis(deps, sel);
    expect(await code(runAnalysis(deps, prepared))).toBe(expected);
    expect(await listAnalyses(deps)).toEqual([]);
  });

  it('LL-8 an unreadable or off-shape answer is llm_bad_response and nothing is stored', async () => {
    for (const bad of ['not json', '{}', JSON.stringify({ ...JSON.parse(VALID_ANSWER), hypotheses: [{}] })]) {
      const { deps } = await diary(make, new FakeLlm([bad]));
      expect(await code(runAnalysis(deps, await prepareAnalysis(deps, sel)))).toBe('llm_bad_response');
      expect(await listAnalyses(deps)).toEqual([]);
    }
  });

  it('LL-1 running without a key fails before anything is sent', async () => {
    const { deps, llm } = await diary(make);
    const prepared = await prepareAnalysis(deps, sel);
    await deps.keys.delete('anthropic_api_key');
    expect(await code(runAnalysis(deps, prepared))).toBe('llm_no_key');
    expect(llm.requests).toHaveLength(0);
  });

  it('LL-12 a cancelled run stores nothing, even when the answer arrives at the same moment, and the signal reaches the provider', async () => {
    const { deps } = await diary(make);
    const prepared = await prepareAnalysis(deps, sel);
    const ctl = new AbortController();
    const answering = { completeJson: async () => (ctl.abort(), { text: VALID_ANSWER, model: 'fake-model' }) };
    expect(await code(runAnalysis({ ...deps, llmFor: () => answering }, prepared, ctl.signal))).toBe('llm_cancelled');
    expect(await listAnalyses(deps)).toEqual([]);
    const seen: (AbortSignal | undefined)[] = [];
    const watching = { completeJson: async (r: { signal?: AbortSignal }) => (seen.push(r.signal), { text: VALID_ANSWER, model: 'fake-model' }) };
    await runAnalysis({ ...deps, llmFor: () => watching }, prepared, new AbortController().signal);
    expect(seen[0]).toBeDefined();
  });

  it('LL-9 the prepared request names the model from the setting', async () => {
    const { deps } = await diary(make);
    await deps.settings.set('llm_model.analysis', 'claude-sonnet-5-5');
    expect((await prepareAnalysis(deps, sel)).model).toBe('claude-sonnet-5-5');
  });
});

describe.each(repos)('stored analyses travel with the export (%s)', (_name, make) => {
  const sel = { dayFrom: '2026-01-10', dayTo: '2026-01-14', language: 'pl' as const };

  it('EX-4 + LL-7 an analysis survives export and import, and a damaged result is rejected', async () => {
    const { deps } = await diary(make);
    const analysis = await runAnalysis(deps, await prepareAnalysis(deps, sel));
    const zip = await exportBundle(deps);

    const target = makeDeps(await make());
    const parsed = await previewImport(target, zip);
    expect(parsed.preview.incoming.analyses).toBe(1);
    await applyImport(target, parsed, { mode: 'replace', parts: { records: true, settings: true } });
    expect(await listAnalyses(target)).toEqual([analysis]);

    const files = unzipSync(zip);
    const json = JSON.parse(strFromU8(files['data.json']!));
    json.records.analyses[0].result.hypotheses[0].strength = 'strong';
    const damaged = zipSync({ ...files, 'data.json': strToU8(JSON.stringify(json)) });
    expect(await code(previewImport(makeDeps(await make()), damaged))).toBe('import_invalid_data');
  });

  it('SE-9 analyses can be deleted on their own, without touching entries', async () => {
    const { deps, repo } = await diary(make);
    await runAnalysis(deps, await prepareAnalysis(deps, sel));
    const counts = await deleteData(deps, { kinds: DELETE_GROUPS.ai });
    expect(counts.analyses).toBe(1);
    expect(await listAnalyses(deps)).toEqual([]);
    expect((await repo.listMeals()).length).toBeGreaterThan(0);
  });
});
