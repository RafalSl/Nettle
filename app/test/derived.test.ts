import { buildAnalysisInput } from '@/core/llm/analysisInput';
import { buildReportHtml } from '@/core/export/report';
import { COURSE_GAP_DAYS, elapsedParts, sinceCaption, sinceCaptionEn, sinceLastTreatment, timeToRelapse } from '@/core/model/derived';
import { analysisPrompt } from '@/core/llm/analysisPrompt';
import { applyTreatment } from '@/core/usecases/events';
import { addListItem } from '@/core/usecases/lists';
import { addPhoto } from '@/core/usecases/photos';
import { prepareAnalysis } from '@/core/usecases/analysis';
import { addArea, logNailEntry, logSkinEntry } from '@/core/usecases/skin';
import { areaTimeline } from '@/core/usecases/timeline';
import { saveApiKey } from '@/core/usecases/llm';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';

const stamp = (utc: string) => ({ utc, tz: 'Europe/Warsaw' });
const app = (id: string, utc: string, treatmentId = 'tr1', areaIds = ['area-chin']) => ({
  id,
  at: stamp(utc),
  treatmentId,
  areaIds,
  reaction: null,
  note: null,
});
const skin = (id: string, utc: string, severity: number, areaId = 'area-chin') => ({
  id,
  at: stamp(utc),
  areaId,
  scores: { severity, itch: 0, pain: 0, dryness: 0, scaling: 0 },
  cracks: false,
  sizeMm: null,
  note: null,
});
const day = (n: number, hour = 8) => `2026-01-${String(n).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;

describe('time since the last treatment (SK-4)', () => {
  const apps = [app('a1', day(10, 8)), app('a2', day(12, 20), 'tr2'), app('a3', day(12, 22), 'tr3', ['area-neck']), app('a4', day(14, 8))];

  it('SK-4 takes the latest application on that area at or before the photo, with the exact hours', () => {
    expect(sinceLastTreatment('area-chin', day(13, 8), apps)).toEqual({ treatmentId: 'tr2', hours: 12 });
    expect(sinceLastTreatment('area-chin', day(12, 20), apps)).toEqual({ treatmentId: 'tr2', hours: 0 }); // the same moment counts
    expect(sinceLastTreatment('area-chin', day(12, 20).replace(':00:00.000Z', ':20:00.000Z'), apps)).toEqual({
      treatmentId: 'tr2',
      hours: 0.3,
    });
    expect(sinceLastTreatment('area-neck', day(13, 8), apps)).toEqual({ treatmentId: 'tr3', hours: 10 }); // another area's application is not mixed in
  });

  it('SK-4 an application after the photo does not count, and nothing within 7 days says "no treatment logged"', () => {
    expect(sinceLastTreatment('area-chin', day(9, 8), apps)).toBeNull(); // the first application is the next day
    expect(sinceLastTreatment('area-chin', day(17, 8), [app('a', day(10, 8))])).toEqual({ treatmentId: 'tr1', hours: 168 }); // exactly 7 days still counts
    expect(sinceLastTreatment('area-chin', day(17, 9), [app('a', day(10, 8))])).toBeNull();
    expect(sinceLastTreatment('area-sternum', day(13, 8), apps)).toBeNull();
  });

  it('SK-4 an application on several areas counts for each of them, and two at the same moment resolve the same way every time', () => {
    const both = [app('x1', day(10, 8), 'tr1', ['area-chin', 'area-neck']), app('x2', day(10, 8), 'tr2', ['area-chin'])];
    expect(sinceLastTreatment('area-neck', day(10, 12), both)).toEqual({ treatmentId: 'tr1', hours: 4 });
    expect(sinceLastTreatment('area-chin', day(10, 12), both)?.treatmentId).toBe('tr2'); // the larger id wins a tie
    expect(sinceLastTreatment('area-chin', day(10, 12), [...both].reverse())?.treatmentId).toBe('tr2');
  });

  it('SK-4 says the elapsed time in minutes, hours or days, and the caption in the given language', () => {
    expect(elapsedParts(0.2)).toEqual({ unit: 'minutes', n: 12 });
    expect(elapsedParts(0)).toEqual({ unit: 'minutes', n: 1 });
    expect(elapsedParts(14.4)).toEqual({ unit: 'hours', n: 14 });
    expect(elapsedParts(47.9)).toEqual({ unit: 'hours', n: 48 });
    expect(elapsedParts(96)).toEqual({ unit: 'days', n: 4 });
    const tx = (k: string, v?: Record<string, string | number>) => `[${k}${v ? JSON.stringify(v) : ''}]`;
    expect(sinceCaption({ treatmentId: 'tr1', hours: 14 }, () => 'Cream', tx)).toBe(
      '[derived.sinceTreatment{"elapsed":"[derived.hours{\\"n\\":14}]","name":"Cream"}]',
    );
    expect(sinceCaption(null, () => '', tx)).toBe('[derived.noTreatment]');
    expect(sinceCaptionEn({ treatmentId: 'tr1', hours: 14 }, () => 'Cream')).toBe('14 h after Cream');
    expect(sinceCaptionEn({ treatmentId: 'tr1', hours: 72 }, () => 'Cream')).toBe('3 days after Cream');
    expect(sinceCaptionEn(null, () => '')).toMatch(/no treatment logged in the 7 days before/);
  });
});

describe('time to relapse (SK-12)', () => {
  const asOf = '2026-03-01T00:00:00.000Z';
  const calm = (utc: string) => skin(`c-${utc}`, utc, 2);
  const flare = (utc: string) => skin(`f-${utc}`, utc, 9);

  it('SK-12 a finished course gives the days from its last application to the next flare start', () => {
    const rows = timeToRelapse(
      [calm(day(1)), flare(day(20)), calm(day(25))],
      [app('a1', day(3)), app('a2', day(5)), app('a3', day(7))],
      8,
      asOf,
    );
    expect(rows).toEqual([
      {
        areaId: 'area-chin',
        treatmentId: 'tr1',
        start: stamp(day(3)),
        end: stamp(day(7)),
        applications: 3,
        flareStart: stamp(day(20)),
        days: 13,
        otherTreatmentIds: [],
      },
    ]);
  });

  it('SK-12 maintenance twice a week is one course; a gap of more than 7 days starts another', () => {
    const maintenance = [1, 4, 8, 11, 15].map((d, i) => app(`m${i}`, day(d))); // gaps of 3 to 4 days
    expect(timeToRelapse([calm(day(1))], maintenance, 8, asOf)).toHaveLength(1);
    expect(timeToRelapse([calm(day(1))], maintenance, 8, asOf)[0]!.applications).toBe(5);
    const exactly7 = timeToRelapse([calm(day(1))], [app('a', day(1)), app('b', day(8))], 8, asOf);
    expect(exactly7).toHaveLength(1); // a gap of exactly 7 days still joins
    const over7 = timeToRelapse([calm(day(1))], [app('a', day(1)), app('b', day(8, 9))], 8, asOf);
    expect(over7).toHaveLength(2);
    expect(COURSE_GAP_DAYS).toBe(7);
  });

  it('SK-12 with no flare after the course it says so; a flare that began before the course does not count', () => {
    const rows = timeToRelapse([flare(day(1)), calm(day(5)), calm(day(20))], [app('a', day(10))], 8, asOf);
    expect(rows).toMatchObject([{ flareStart: null, days: null }]);
    const during = timeToRelapse([flare(day(1)), flare(day(12))], [app('a', day(10))], 8, asOf); // open flare through the course: the next one starts after it ended, so none
    expect(during).toMatchObject([{ flareStart: null }]);
  });

  it('SK-12 only finished courses count: one that ended within 7 days of the as-of moment is still running', () => {
    expect(timeToRelapse([calm(day(1))], [app('a', day(20))], 8, day(26))).toEqual([]);
    expect(timeToRelapse([calm(day(1))], [app('a', day(20))], 8, day(27, 9))).toHaveLength(1);
  });

  it("SK-12 uses the area's own flares, so another area's flare does not end its wait, and lists other treatments in between as confounders", () => {
    const rows = timeToRelapse(
      [calm(day(1)), flare(day(30)), skin('n1', day(2), 2, 'area-neck'), skin('n2', day(12), 10, 'area-neck')],
      [
        app('a1', day(3)),
        app('a2', day(14), 'tr2'),
        app('a3', day(14, 9), 'tr2'),
        app('a4', day(18), 'tr3', ['area-neck']),
        app('a5', day(40), 'tr9'),
      ],
      8,
      asOf,
    );
    const chin = rows.find((r) => r.areaId === 'area-chin' && r.treatmentId === 'tr1')!;
    expect(chin).toMatchObject({ days: 27, otherTreatmentIds: ['tr2'] }); // the neck's flare on the 12th is not the chin's; tr3 was on the neck; tr9 came after the flare
    expect(rows.find((r) => r.areaId === 'area-neck')).toMatchObject({ treatmentId: 'tr3', flareStart: null }); // the neck flared on the 12th, before its treatment
  });

  it('SK-12 an application on several areas gives each skin area its own row, nail areas have none, and the order is by area, treatment and course', () => {
    const rows = timeToRelapse(
      [calm(day(1)), skin('n1', day(1), 2, 'area-neck')],
      [app('a', day(3), 'tr2', ['area-neck', 'area-chin', 'nail-thumb']), app('b', day(3), 'tr1', ['area-chin'])],
      8,
      asOf,
    );
    expect(rows.map((r) => `${r.areaId}:${r.treatmentId}`)).toEqual(['area-chin:tr1', 'area-chin:tr2', 'area-neck:tr2']);
  });

  it('SK-12 the threshold decides what a flare is', () => {
    const entries = [calm(day(1)), skin('mid', day(15), 6)];
    expect(timeToRelapse(entries, [app('a', day(3))], 8, asOf)[0]!.flareStart).toBeNull();
    expect(timeToRelapse(entries, [app('a', day(3))], 6, asOf)[0]).toMatchObject({ days: 12 });
  });
});

describe('the derived numbers reach the report, the analysis and the timeline (SK-4, SK-12)', () => {
  async function setup() {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo, '2026-03-01T10:00:00.000Z');
    const cream = await addListItem(deps, 'treatments', 'Synthetic cream');
    const early = await logSkinEntry(deps, {
      areaId: 'area-chin',
      scores: { severity: 2, itch: 0, pain: 0, dryness: 0, scaling: 0 },
      at: new Date(day(2)),
    });
    await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin'], at: new Date(day(3)) });
    await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin'], at: new Date(day(6)) });
    await logSkinEntry(deps, {
      areaId: 'area-chin',
      scores: { severity: 9, itch: 0, pain: 0, dryness: 0, scaling: 0 },
      at: new Date(day(16)),
    });
    const p1 = await addPhoto(deps, { entryKind: 'skinEntry', entryId: early.id, sourceUri: 'before', at: new Date(day(2, 9)) });
    const late = await logSkinEntry(deps, {
      areaId: 'area-chin',
      scores: { severity: 3, itch: 0, pain: 0, dryness: 0, scaling: 0 },
      at: new Date(day(6, 14)),
    });
    const p2 = await addPhoto(deps, { entryKind: 'skinEntry', entryId: late.id, sourceUri: 'after', at: new Date(day(6, 14)) });
    return { repo, deps, cream, p1, p2 };
  }

  it('LL-2 the analysis input carries time_to_relapse as numbers, and the prompt says not to recompute them', async () => {
    const { repo } = await setup();
    const data = JSON.parse(buildAnalysisInput(await repo.snapshot(), '2026-01-01', '2026-01-31', 0, 8, '2026-03-01T00:00:00.000Z').json);
    expect(data.time_to_relapse).toEqual([
      expect.objectContaining({
        area: expect.stringMatching(/chin/i),
        treatment: 'Synthetic cream',
        applications: 2,
        days_to_next_flare: 10,
        next_flare_start: expect.stringContaining('2026-01-16'),
      }),
    ]);
    const none = JSON.parse(buildAnalysisInput(await new MemoryRepo().snapshot(), '2026-01-01', '2026-01-31').json);
    expect('time_to_relapse' in none).toBe(false);
    expect(analysisPrompt('en', { json: '{}', photoNotes: [] }).system).toMatch(/computed by the program[\s\S]*do not recompute/);
  });

  it('SK-4 the photo notes of a run carry the computed time since the last treatment', async () => {
    const { deps, p1, p2 } = await setup();
    await saveApiKey(deps, 'synthetic-test-key');
    const prepared = await prepareAnalysis(deps, { dayFrom: '2026-01-01', dayTo: '2026-01-31', language: 'en', photoIds: [p1.id, p2.id] });
    const notes = prepared.request.user;
    expect(notes).toMatch(/no treatment logged in the 7 days before/); // the first photo is before any application
    expect(notes).toMatch(/\b6 h after Synthetic cream/); // application at 08:00 UTC, photo at 14:00 UTC
  });

  it('SK-8, SK-4 the timeline carries the same computation per photo, and an entry without photos carries none', async () => {
    const { deps, p1, p2 } = await setup();
    const days = await areaTimeline(deps, 'area-chin');
    const photoEntries = days.flatMap((d) => d.entries).filter((e) => e.photos.length > 0);
    const byPhoto = Object.assign({}, ...photoEntries.map((e) => e.sinceTreatment));
    expect(byPhoto[p1.id]).toBeNull();
    expect(byPhoto[p2.id]).toMatchObject({ hours: 6 });
    expect(days.flatMap((d) => d.entries).find((e) => e.photos.length === 0)!.sinceTreatment).toEqual({});
  });

  it('EX-3 the report captions each photo and lists time to relapse with the intro, in both uses of the text function', async () => {
    const { repo } = await setup();
    const snap = await repo.snapshot();
    const html = buildReportHtml({
      language: 'en',
      text: (key: string, vars?: Record<string, string | number>) => `[${key}${vars ? `:${Object.values(vars).join('|')}` : ''}]`, // no JSON, so the HTML escaping does not get in the way
      areaName: (a: { name: string }) => a.name,
      itemName: (i: { name: string }) => i.name,
      records: snap,
      skinAreas: snap.skinAreas,
      dailyItems: [],
      changeCategories: [],
      treatments: snap.treatments,
      photos: new Map(snap.photos.map((p) => [p.id, 'data:image/jpeg;base64,AA'])),
      range: { from: null, to: null },
      exportedAt: { utc: '2026-03-01T10:00:00.000Z', tz: 'Europe/Warsaw' },
    } as never);
    expect(html).toContain('[report.relapse]');
    expect(html).toContain('[report.relapseDays]');
    expect(html).toContain('[derived.days:10]');
    expect(html).toContain('[derived.noTreatment]');
    expect(html).toContain('Synthetic cream');
    expect(html).toContain('[derived.sinceTreatment:[derived.hours:6]|Synthetic cream]');
  });
});

describe('nail photos get the same caption (SK-4)', () => {
  it("SK-4 a nail entry's photo looks up treatments on the nail area", async () => {
    const deps = makeDeps(new MemoryRepo(), '2026-03-01T10:00:00.000Z');
    const nail = await addArea(deps, 'Synthetic thumb', 'nail');
    const cream = await addListItem(deps, 'treatments', 'Synthetic oil');
    await applyTreatment(deps, { treatmentId: cream.id, areaIds: [nail.id], at: new Date(day(3)) });
    const entry = await logNailEntry(deps, { areaId: nail.id, stage: 'white', extent: 'none', at: new Date(day(4)) });
    const photo = await addPhoto(deps, { entryKind: 'nailEntry', entryId: entry.id, sourceUri: 'nail', at: new Date(day(4)) });
    const [d] = await areaTimeline(deps, nail.id);
    expect(d!.entries[0]!.sinceTreatment[photo.id]).toMatchObject({ hours: 24 });
  });
});
