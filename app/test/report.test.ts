import { strFromU8, unzipSync } from 'fflate';
import en from '@/i18n/en.json';
import pl from '@/i18n/pl.json';
import { csvPath, toCsv } from '@/core/export/csv';
import { buildReportHtml } from '@/core/export/report';
import { exportBundle } from '@/core/usecases/exchange';
import { applyTreatment, logChangeEvent, logReaction } from '@/core/usecases/events';
import { saveCheckIn, logStool } from '@/core/usecases/checkin';
import { markFlare } from '@/core/usecases/flares';
import { addListItem } from '@/core/usecases/lists';
import { logMeal } from '@/core/usecases/logMeal';
import { addPhoto } from '@/core/usecases/photos';
import { addArea, logNailEntry, logSkinEntry } from '@/core/usecases/skin';
import { prepareAnalysis, runAnalysis } from '@/core/usecases/analysis';
import { saveApiKey } from '@/core/usecases/llm';
import { FakeLlm } from './fakes/fakeLlm';
import { FakePdf } from './fakes/fakePdf';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';

const get = (obj: unknown, key: string): unknown => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);

describe('toCsv (EX-5)', () => {
  it('EX-5 writes a header and rows with quotes, commas, newlines and lists escaped', () => {
    const csv = toCsv([
      { id: 'a', note: 'plain', n: 3, flag: true, list: ['x', 'y'], none: null },
      { id: 'b', note: 'has, comma and "quote"\nand newline', extra: 'only here' },
    ]);
    expect(csv).toBe(
      'id,note,n,flag,list,none,extra\r\n' +
        'a,plain,3,true,x; y,,\r\n' +
        'b,"has, comma and ""quote""\nand newline",,,,,only here\r\n',
    );
  });

  it('EX-5 defuses spreadsheet formulas in text but leaves numbers alone', () => {
    const csv = toCsv([{ a: '=1+1', b: '@SUM(A1)', c: '+1', d: '-5', e: -5, f: 'ok' }]);
    expect(csv.split('\r\n')[1]).toBe("'=1+1,'@SUM(A1),'+1,'-5,-5,ok");
  });

  it('EX-5 names files by table', () => {
    expect(csvPath('skin_entries')).toBe('csv/skin_entries.csv');
    expect(toCsv([])).toBe('\r\n');
  });
});

async function diary() {
  const repo = new MemoryRepo();
  const llm = new FakeLlm([
    JSON.stringify({
      summary: 'Synthetic AI summary <b>',
      hypotheses: [{ title: 'Synthetic hypothesis', explanation: 'x', evidence: ['e1'], counter_evidence: [], uncertainty: 'u', lag_hours: null, strength: 'weak' }],
      order_and_lag: 'none',
      data_limits: ['limit'],
      suggestions: [],
    }),
  ]);
  const deps = makeDeps(repo, '2026-01-20T10:00:00.000Z', llm);
  await saveApiKey(deps, 'synthetic-test-key');
  const at = (s: string) => new Date(s);
  const meal = await logMeal(deps, { description: 'Synthetic <pasta> & sauce', ingredients: ['pasta'], allergens: ['gluten'], at: at('2026-01-10T11:00:00.000Z') });
  await logReaction(deps, { mealId: meal.id, symptoms: ['hives'], at: at('2026-01-10T12:00:00.000Z') });
  const e1 = await logSkinEntry(deps, { areaId: 'area-chin', scores: { severity: 3, itch: 4, pain: 0, dryness: 2, scaling: 1 }, at: at('2026-01-10T20:00:00.000Z') });
  const e2 = await logSkinEntry(deps, { areaId: 'area-chin', scores: { severity: 7, itch: 8, pain: 2, dryness: 5, scaling: 4 }, at: at('2026-01-13T20:00:00.000Z') });
  const priv = await logSkinEntry(deps, { areaId: 'area-intimate', scores: { severity: 5, itch: 5, pain: 5, dryness: 5, scaling: 5 }, at: at('2026-01-11T20:00:00.000Z') });
  const nail = await addArea(deps, 'Left thumb', 'nail');
  const n1 = await logNailEntry(deps, { areaId: nail.id, stage: 'yellow', extent: 'under_quarter', at: at('2026-01-12T08:00:00.000Z') });
  const p = (kind: 'skinEntry' | 'nailEntry', id: string, uri: string, when: string) => addPhoto(deps, { entryKind: kind, entryId: id, sourceUri: uri, at: at(when) });
  const photos = {
    chin1: await p('skinEntry', e1.id, 'chin-first', '2026-01-10T20:05:00.000Z'),
    chin2: await p('skinEntry', e2.id, 'chin-last', '2026-01-13T20:05:00.000Z'),
    priv: await p('skinEntry', priv.id, 'private-photo', '2026-01-11T20:05:00.000Z'),
    nail: await p('nailEntry', n1.id, 'nail-photo', '2026-01-12T08:05:00.000Z'),
  };
  await markFlare(deps, { areaId: 'area-chin', kind: 'start', at: at('2026-01-10T20:00:00.000Z') });
  await saveCheckIn(deps, { at: at('2026-01-12T21:00:00.000Z'), wellbeing: 5, stress: 2, bloating: true, tags: ['tag-travel'], complete: true, confirmEmptyDay: true });
  await logStool(deps, { bristol: 6, at: at('2026-01-12T07:00:00.000Z') });
  const cream = await addListItem(deps, 'treatments', 'Synthetic cream');
  await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin'], at: at('2026-01-13T21:00:00.000Z') });
  await logChangeEvent(deps, { action: 'started', category: 'product', name: 'Synthetic soap', at: at('2026-01-09T09:00:00.000Z') });
  await runAnalysis(deps, await prepareAnalysis(deps, { dayFrom: '2026-01-10', dayTo: '2026-01-13', language: 'en' }));
  return { deps, photos, pdf: deps.pdf as FakePdf };
}

const reportOptions = (language: 'en' | 'pl' = 'en') => ({
  language,
  text: (key: string, vars?: Record<string, string | number>) => `[${key}${vars ? JSON.stringify(vars) : ''}]`,
  areaName: (a: { id: string; name: string }) => a.name,
  itemName: (i: { id: string; name: string }) => i.name,
});

describe('export with CSV and PDF report (EX-3, EX-4, EX-5, EX-8)', () => {
  it('EX-5 writes one CSV per section of data.json, with photo paths and without the API key', async () => {
    const { deps } = await diary();
    const zip = await exportBundle(deps, { csv: true });
    const files = unzipSync(zip);
    const names = Object.keys(files);
    for (const n of ['csv/meals.csv', 'csv/skin_entries.csv', 'csv/check_ins.csv', 'csv/skin_areas.csv', 'csv/daily_tags.csv', 'csv/flare_markers.csv', 'csv/analyses.csv']) {
      expect(names).toContain(n);
    }
    const skin = strFromU8(files['csv/skin_entries.csv']!).split('\r\n');
    expect(skin[0]).toBe('id,utc,tz,area_id,scores,note'.replace('scores', 'scores'));
    expect(skin).toHaveLength(5); // header, 3 entries, trailing empty
    expect(strFromU8(files['csv/meals.csv']!)).toContain('Synthetic <pasta> & sauce');
    expect(names.some((n) => n.includes('key'))).toBe(false);
    expect(await exportBundle(deps)).not.toEqual(zip); // CSV is optional and off by default
    expect(Object.keys(unzipSync(await exportBundle(deps))).some((n) => n.startsWith('csv/'))).toBe(false);
  });

  it('EX-3 the report covers every section, escapes text and is written to report.pdf', async () => {
    const { deps, pdf } = await diary();
    const zip = await exportBundle(deps, { report: reportOptions() });
    const html = pdf.html[0]!;
    expect(strFromU8(unzipSync(zip)['report.pdf']!)).toBe(html);
    for (const key of ['report.flares', 'report.skin', 'report.nails', 'report.photos', 'report.checkins', 'report.stool', 'report.treatments', 'report.changes', 'report.intake', 'report.reactions', 'report.aiTitle']) {
      expect(html).toContain(`[${key}]`);
    }
    expect(html).toContain('Synthetic &lt;pasta&gt; &amp; sauce'); // user text is escaped
    expect(html).not.toContain('<pasta>');
    expect(html).toContain('<svg'); // severity trend
    expect(html).toContain('Synthetic cream');
    expect(html).toContain('Synthetic soap');
  });

  it('EX-4 AI analyses sit in their own labelled section after the person\'s records', async () => {
    const { deps, pdf } = await diary();
    await exportBundle(deps, { report: reportOptions() });
    const html = pdf.html[0]!;
    const ai = html.indexOf('[report.aiTitle]');
    expect(ai).toBeGreaterThan(html.indexOf('[report.intake]'));
    expect(html.slice(ai)).toContain('[report.aiWarning]');
    expect(html.slice(0, ai)).not.toContain('Synthetic AI summary');
    expect(html.slice(ai)).toContain('Synthetic AI summary &lt;b&gt;');
    expect(html.slice(ai)).toContain('Synthetic hypothesis');
  });

  it('EX-8 the photo selection applies to the PDF: sensitive photos are left out by default, then included on request', async () => {
    const { deps, pdf, photos } = await diary();
    const encode = (s: string) => Buffer.from(s).toString('base64');
    await exportBundle(deps, { report: reportOptions() });
    const byDefault = pdf.html[0]!;
    expect(byDefault).toContain(encode('chin-first'));
    expect(byDefault).toContain(encode('chin-last'));
    expect(byDefault).toContain(encode('nail-photo'));
    expect(byDefault).not.toContain(encode('private-photo'));

    await exportBundle(deps, { report: reportOptions(), photos: { mode: 'none' } });
    expect(pdf.html[1]).not.toContain('data:image/jpeg');

    await exportBundle(deps, { report: reportOptions(), photos: { mode: 'custom', ids: [photos.priv.id] } });
    expect(pdf.html[2]).toContain(encode('private-photo'));
    expect(pdf.html[2]).not.toContain(encode('chin-first'));
  });

  it('EX-3 shows first and latest photo per skin area, and a timeline for nails', async () => {
    const { deps, pdf } = await diary();
    await exportBundle(deps, { report: reportOptions() });
    const html = pdf.html[0]!;
    expect(html).toContain('[report.firstLast]');
    expect(html).toContain('[report.nailTimeline]');
  });

  it('EX-3 a settings-only export has no report data and no photos', async () => {
    const { deps, pdf } = await diary();
    await exportBundle(deps, { parts: { records: false, settings: true }, report: reportOptions() });
    expect(pdf.html[0]).not.toContain('[report.skin]');
  });

  it('EX-3 every text key the report uses exists in English and Polish', async () => {
    const { deps, pdf } = await diary();
    const used = new Set<string>();
    const record = (key: string) => (used.add(key), '');
    await exportBundle(deps, { report: { ...reportOptions(), text: record }, photos: { mode: 'all' } });
    expect(pdf.html).toHaveLength(1);
    expect(used.size).toBeGreaterThan(40);
    for (const key of used) {
      expect(get(en, key)).toEqual(expect.any(String));
      expect(get(pl, key)).toEqual(expect.any(String));
    }
  });

  it('EX-3 an empty diary still produces a valid page with a title and the disclaimer', () => {
    const html = buildReportHtml({
      ...reportOptions('pl'),
      records: Object.fromEntries(
        ['meals', 'skinEntries', 'nailEntries', 'checkIns', 'stoolEntries', 'treatmentApplications', 'changeEvents', 'reactions', 'drinks', 'medicationEntries', 'photos', 'analyses', 'flareMarkers'].map((k) => [k, []]),
      ) as never,
      skinAreas: [],
      dailyTags: [],
      treatments: [],
      photos: new Map(),
      range: { from: null, to: null },
      exportedAt: { utc: '2026-01-20T10:00:00.000Z', tz: 'Europe/Warsaw' },
    });
    expect(html).toContain('<html lang="pl">');
    expect(html).toContain('[report.title]');
    expect(html).toContain('[report.disclaimer]');
    expect(html).not.toContain('[report.skin]');
  });
});
