import { parseSummary } from '@/core/llm/parse';
import { summaryPrompt, SUMMARY_PROMPT_VERSION } from '@/core/llm/summaryPrompt';
import { buildReportHtml } from '@/core/export/report';
import { NettleError } from '@/core/model/errors';
import { exportBundle } from '@/core/usecases/exchange';
import { saveApiKey, setModel } from '@/core/usecases/llm';
import { logMeal } from '@/core/usecases/logMeal';
import { listSummaries, prepareSummary, runSummary, saveSummary, summaryDays } from '@/core/usecases/summary';
import { deleteData } from '@/core/usecases/deleteData';
import { strFromU8, unzipSync } from 'fflate';
import { FakeLlm } from './fakes/fakeLlm';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';

const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );
const answer = JSON.stringify({ summary: ' The skin flared twice in January. ' });
const sel = { dayFrom: '2026-01-10', dayTo: '2026-01-14', language: 'en' as const };

async function diary(llm = new FakeLlm([answer])) {
  const repo = new MemoryRepo();
  const deps = makeDeps(repo, '2026-01-20T10:00:00.000Z', llm);
  await saveApiKey(deps, 'synthetic-test-key');
  await logMeal(deps, { description: 'Synthetic pasta', ingredients: ['pasta'], at: new Date('2026-01-12T10:00:00.000Z') });
  return { deps, repo, llm };
}

describe('report summary (LL-14, EX-3, EX-4)', () => {
  it('LL-14 the prompt asks for a factual narrative with uncertainty and gaps, no diagnosis, in the report language', () => {
    const p = summaryPrompt('pl', { json: '{"days":[]}' });
    expect(p.system).toMatch(/never diagnose/);
    expect(p.system).toMatch(/"logged": false/);
    expect(p.system).toContain('Polish');
    expect(p.user).toContain('{"days":[]}');
    expect(p.schema.required).toEqual(['summary']);
    expect(SUMMARY_PROMPT_VERSION).toBe('summary-5');
  });

  it('LL-14 only a non-empty summary string is an answer', () => {
    expect(parseSummary(answer)).toBe('The skin flared twice in January.');
    for (const bad of ['nope', '{}', '{"summary":""}', '{"summary":" "}', '{"summary":3}', '[]']) expect(() => parseSummary(bad)).toThrow(NettleError);
  });

  it('LL-14, LL-5 preparing sends nothing, uses the report_summary model, and never includes photos', async () => {
    const { deps, llm } = await diary();
    await setModel(deps, 'report_summary', 'claude-sonnet-5-5');
    const prepared = await prepareSummary(deps, sel);
    expect(llm.requests).toHaveLength(0);
    expect(prepared).toMatchObject({ model: 'claude-sonnet-5-5', promptVersion: 'summary-5', counts: { days: 5 } });
    expect(prepared.request.images).toBeUndefined();
    expect(await code(prepareSummary(deps, { ...sel, dayFrom: '2026-01-15', dayTo: '2026-01-14' }))).toBe('invalid_range');
    expect(await code(prepareSummary(deps, { ...sel, dayFrom: '2026-03-01', dayTo: '2026-03-02' }))).toBe('analysis_no_data');
  });

  it('LL-14, LL-7, LL-8 a run stores nothing; only keeping the reviewed text stores a summary, with what the model wrote kept apart', async () => {
    const { deps } = await diary();
    const draft = await runSummary(deps, await prepareSummary(deps, sel));
    expect(draft.text).toBe('The skin flared twice in January.');
    expect(await listSummaries(deps)).toEqual([]);
    expect(await code(saveSummary(deps, draft, '  '))).toBe('summary_empty');
    const kept = await saveSummary(deps, draft, ' The skin flared twice; I added the nails. ');
    expect(kept).toMatchObject({ generated: 'The skin flared twice in January.', text: 'The skin flared twice; I added the nails.', language: 'en', dayFrom: '2026-01-10', dayTo: '2026-01-14' });
    expect(await listSummaries(deps)).toEqual([kept]);
  });

  it('LL-12 a cancelled run stores nothing and a failure leaves the diary as it was', async () => {
    const { deps } = await diary(new FakeLlm([new NettleError('llm_rate_limited')]));
    expect(await code(runSummary(deps, await prepareSummary(deps, sel)))).toBe('llm_rate_limited');
    const ctl = new AbortController();
    ctl.abort();
    const ok = await diary();
    expect(await code(runSummary(ok.deps, await prepareSummary(ok.deps, sel), ctl.signal))).toBe('llm_cancelled');
    expect(await listSummaries(ok.deps)).toEqual([]);
  });

  it('LL-14 open ends of a period become the first day with an entry and today', async () => {
    const { deps } = await diary();
    expect(await summaryDays(deps, {})).toEqual({ dayFrom: '2026-01-12', dayTo: '2026-01-20' });
    expect(await summaryDays(deps, { from: '2026-01-01', to: '2026-01-05' })).toEqual({ dayFrom: '2026-01-01', dayTo: '2026-01-05' });
    expect(await summaryDays(makeDeps(new MemoryRepo()), {})).toBeNull();
  });

  it('EX-3, EX-4 the PDF opens with the summary under the AI label, and a stale one (period or language) is refused', async () => {
    const { deps } = await diary();
    const draft = await runSummary(deps, await prepareSummary(deps, sel));
    const kept = await saveSummary(deps, draft, 'Edited text.\n\nSecond paragraph.');
    const report = (language: 'en' | 'pl') => ({ language, text: (k: string) => `[${k}]`, areaName: () => '', itemName: () => '' });
    const options = (over: object) => ({ days: { from: '2026-01-10', to: '2026-01-14' }, parts: { records: true, settings: false }, report: report('en'), summaryId: kept.id, ...over });
    const zip = unzipSync(await exportBundle(deps, options({})));
    expect(Object.keys(zip)).toContain('report.pdf');
    const html = strFromU8(zip['report.pdf']!);
    expect(html).toContain('[report.summaryTitle]');
    expect(html).toContain('[report.aiWarning]');
    expect(html.indexOf('[report.summaryTitle]')).toBeLessThan(html.indexOf('Synthetic pasta'));
    expect(html).toContain('<p>Edited text.</p><p>Second paragraph.</p>');
    expect(html).toContain('[report.summaryEdited]');
    expect(await code(exportBundle(deps, options({ report: report('pl') })))).toBe('summary_mismatch');
    expect(await code(exportBundle(deps, options({ days: { from: '2026-01-01', to: '2026-01-14' } })))).toBe('summary_mismatch');
    expect(await code(exportBundle(deps, options({ summaryId: 'nope' })))).toBe('summary_mismatch');
    // the stored summary travels in data.json
    const data = JSON.parse(strFromU8(unzipSync(await exportBundle(deps, { parts: { records: true, settings: false } }))['data.json']!));
    expect(data.records.report_summaries).toMatchObject([{ id: kept.id, generated: draft.text, text: kept.text }]);
  });

  it('EX-4 the summary text is escaped and an unedited one carries no "edited" note', () => {
    const base = { language: 'en' as const, text: (k: string) => `[${k}]`, areaName: () => '', itemName: () => '', records: Object.fromEntries(['meals', 'skinEntries', 'nailEntries', 'checkIns', 'stoolEntries', 'treatmentApplications', 'changeEvents', 'reactions', 'drinks', 'medicationEntries', 'photos', 'analyses', 'reportSummaries'].map((k) => [k, []])) as never, skinAreas: [], dailyItems: [], changeCategories: [], treatments: [], photos: new Map(), range: { from: null, to: null }, exportedAt: { utc: '2026-01-20T10:00:00.000Z', tz: 'UTC' } };
    const s = { id: 's', at: base.exportedAt, dayFrom: '2026-01-01', dayTo: '2026-01-02', language: 'en' as const, model: 'm', promptVersion: 'p', counts: {}, generated: '<b>x</b>', text: '<b>x</b>' };
    const html = buildReportHtml({ ...base, summary: s });
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).not.toContain('<b>x</b>');
    expect(html).not.toContain('[report.summaryEdited]');
  });

  it('SE-9 deleting the AI group removes summaries too', async () => {
    const { deps } = await diary();
    const draft = await runSummary(deps, await prepareSummary(deps, sel));
    await saveSummary(deps, draft, draft.text);
    await deleteData(deps, { kinds: ['analyses', 'reportSummaries'] });
    expect(await listSummaries(deps)).toEqual([]);
  });
});
