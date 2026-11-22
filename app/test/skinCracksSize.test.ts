import { SqliteRepo } from '@/adapters/storage/sqliteRepo';
import { MIGRATIONS } from '@/adapters/storage/migrations';
import { buildAnalysisInput } from '@/core/llm/analysisInput';
import { analysisPrompt } from '@/core/llm/analysisPrompt';
import { NettleError } from '@/core/model/errors';
import { dayLog } from '@/core/usecases/dayLog';
import { editSkinEntry } from '@/core/usecases/entries';
import { exportBundle } from '@/core/usecases/exchange';
import { areaTimeline, trendPoints } from '@/core/usecases/timeline';
import { lastSkinValues, logSkinEntry, repeatAllAreas, repeatSkinEntry } from '@/core/usecases/skin';
import { buildReportHtml } from '@/core/export/report';
import { parseDataJson } from '@/core/export/validate';
import { skinSummary } from '@/ui/logRow';
import { strFromU8, unzipSync } from 'fflate';
import { MemoryRepo } from './fakes/memoryRepo';
import { createNodeSqliteDb } from './helpers/nodeSqliteDb';
import { makeDeps } from './helpers/fixtures';

const scores = { severity: 4, itch: 3, pain: 2, dryness: 5, scaling: 1 };
const at = (iso: string) => new Date(iso);
const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );

describe('cracks and size on a skin entry (SK-3)', () => {
  it('SK-3 an entry has no cracks and no size unless it says so, and a size is whole millimetres from 1 to 500', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await logSkinEntry(deps, { areaId: 'area-chin', scores })).toMatchObject({ cracks: false, sizeMm: null });
    expect(await logSkinEntry(deps, { areaId: 'area-chin', scores, cracks: true, sizeMm: 500 })).toMatchObject({
      cracks: true,
      sizeMm: 500,
    });
    expect(await logSkinEntry(deps, { areaId: 'area-chin', scores, sizeMm: null })).toMatchObject({ sizeMm: null });
    for (const bad of [0, -3, 501, 12.5, Number.NaN, '12' as never]) {
      expect(await code(logSkinEntry(deps, { areaId: 'area-chin', scores, sizeMm: bad }))).toBe('invalid_size');
    }
  });

  it('SK-3 the area\'s last cracks flag and size prefill a new entry, and "No change" carries them like the scores', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await lastSkinValues(deps, 'area-chin')).toBeNull();
    await logSkinEntry(deps, { areaId: 'area-chin', scores, cracks: true, sizeMm: 18, at: at('2026-01-10T08:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-neck', scores, at: at('2026-01-10T08:00:00.000Z') });
    expect(await lastSkinValues(deps, 'area-chin')).toEqual({ scores, cracks: true, sizeMm: 18 });
    const again = await repeatSkinEntry(deps, 'area-chin', at('2026-01-11T08:00:00.000Z'));
    expect(again).toMatchObject({ scores, cracks: true, sizeMm: 18 });
    const all = await repeatAllAreas(deps, at('2026-01-12T08:00:00.000Z'));
    const byArea = Object.fromEntries(all.saved.map((e) => [(e as { areaId: string }).areaId, e]));
    expect(byArea['area-chin']).toMatchObject({ cracks: true, sizeMm: 18 });
    expect(byArea['area-neck']).toMatchObject({ cracks: false, sizeMm: null });
  });

  it('SK-3, EN-1 an edit can change, set or clear them, keeps the id, and refuses a bad size', async () => {
    const deps = makeDeps(new MemoryRepo());
    const e = await logSkinEntry(deps, { areaId: 'area-chin', scores, cracks: true, sizeMm: 10 });
    const edited = await editSkinEntry(deps, e.id, { areaId: 'area-chin', scores, cracks: false, sizeMm: null });
    expect(edited).toMatchObject({ id: e.id, cracks: false, sizeMm: null });
    expect(await code(editSkinEntry(deps, e.id, { areaId: 'area-chin', scores, sizeMm: 0 }))).toBe('invalid_size');
    expect((await deps.repo.listSkinEntries())[0]).toMatchObject({ cracks: false, sizeMm: null });
  });

  it('SK-3 SQLite enforces the flag and the size range in the database, and an old entry gets the defaults', async () => {
    const db = createNodeSqliteDb();
    const step = MIGRATIONS.findIndex((sql) => sql.includes('ADD COLUMN size_mm'));
    expect(step).toBeGreaterThan(0);
    for (const [i, sql] of MIGRATIONS.slice(0, step).entries()) {
      await db.exec(sql);
      await db.exec(`PRAGMA user_version = ${i + 1}`);
    }
    await db
      .run(
        `INSERT INTO skin_entry (id, ts_utc, tz, area_id, severity, itch, pain, dryness, scaling) VALUES ('old', '2026-01-01T00:00:00.000Z', 'UTC', 'area-x', 1, 1, 1, 1, 1)`,
      )
      .catch(() => undefined);
    const repo = await SqliteRepo.open(db);
    const insert = (id: string, cracks: number, size: number | null) =>
      db.run(
        `INSERT INTO skin_entry (id, ts_utc, tz, area_id, severity, itch, pain, dryness, scaling, cracks, size_mm) VALUES (?, '2026-01-02T00:00:00.000Z', 'UTC', 'area-chin', 1, 1, 1, 1, 1, ?, ?)`,
        [id, cracks, size],
      );
    await expect(insert('a', 2, null)).rejects.toThrow();
    await expect(insert('b', 0, 0)).rejects.toThrow();
    await expect(insert('c', 0, 501)).rejects.toThrow();
    await insert('d', 1, 500);
    expect((await repo.listSkinEntries()).find((e) => e.id === 'd')).toMatchObject({ cracks: true, sizeMm: 500 });
  });

  it('SK-3, EX-1 data.json carries cracks and size_mm, and an import refuses a missing flag or a size out of range', async () => {
    const deps = makeDeps(new MemoryRepo());
    await logSkinEntry(deps, { areaId: 'area-chin', scores, cracks: true, sizeMm: 12, at: at('2026-01-10T08:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: at('2026-01-11T08:00:00.000Z') });
    const json = JSON.parse(strFromU8(unzipSync(await exportBundle(deps, { parts: { records: true, settings: true } }))['data.json']!));
    const pairs = (rows: { cracks: boolean; size_mm: number | null }[]) => rows.map((e) => [e.cracks, e.size_mm]).sort();
    expect(pairs(json.records.skin_entries)).toEqual([
      [false, null],
      [true, 12],
    ]);
    expect(
      parseDataJson(json)
        .records?.skinEntries.map((e) => [e.cracks, e.sizeMm])
        .sort(),
    ).toEqual([
      [false, null],
      [true, 12],
    ]);
    const withEntry = (patch: object) => ({
      ...json,
      records: { ...json.records, skin_entries: [{ ...json.records.skin_entries[0], ...patch }] },
    }); // an undefined field counts as missing
    const code = (raw: unknown) => {
      try {
        parseDataJson(raw);
        return 'no error';
      } catch (e) {
        return e instanceof NettleError ? e.code : 'other';
      }
    };
    expect(code(withEntry({}))).toBe('no error');
    for (const patch of [
      { cracks: undefined },
      { cracks: 'yes' },
      { size_mm: undefined },
      { size_mm: 0 },
      { size_mm: 501 },
      { size_mm: 2.5 },
      { size_mm: '12' },
    ]) {
      expect(code(withEntry(patch))).toBe('import_invalid_data');
    }
  });

  it('LL-2, SK-3 the analysis input lists cracks and size_mm only when they are set, and the prompt explains them', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    await logSkinEntry(deps, { areaId: 'area-chin', scores, cracks: true, sizeMm: 14, at: at('2026-01-12T08:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-neck', scores, at: at('2026-01-12T09:00:00.000Z') });
    const data = JSON.parse(buildAnalysisInput(await repo.snapshot(), '2026-01-10', '2026-01-14').json);
    const skin = data.days.flatMap((d: { skin?: object[] }) => d.skin ?? []) as { area: string; cracks?: boolean; size_mm?: number }[];
    expect(skin.find((e) => e.area.toLowerCase().includes('chin'))).toMatchObject({ cracks: true, size_mm: 14 });
    const neck = skin.find((e) => e.area.toLowerCase().includes('neck'))!;
    expect('cracks' in neck).toBe(false);
    expect('size_mm' in neck).toBe(false);
    const p = analysisPrompt('en', { json: '{}', photoNotes: [] });
    expect(p.system).toContain('"cracks": true');
    expect(p.system).toContain('size_mm');
    expect(p.system).toMatch(/not a size of zero/);
  });

  it("SK-8 the timeline charts the size where one is logged, using the day's largest", async () => {
    const deps = makeDeps(new MemoryRepo());
    await logSkinEntry(deps, { areaId: 'area-chin', scores, sizeMm: 10, at: at('2026-01-10T08:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-chin', scores, sizeMm: 16, at: at('2026-01-10T18:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: at('2026-01-11T08:00:00.000Z') }); // no size logged: skipped, not zero
    await logSkinEntry(deps, { areaId: 'area-chin', scores, sizeMm: 8, at: at('2026-01-12T08:00:00.000Z') });
    expect(trendPoints(await areaTimeline(deps, 'area-chin'), 'size')).toEqual([
      { day: '2026-01-10', value: 16, flare: null },
      { day: '2026-01-12', value: 8, flare: null },
    ]);
  });

  it('UX-2 the day log row says cracks and size in words', async () => {
    const deps = makeDeps(new MemoryRepo());
    const e = await logSkinEntry(deps, { areaId: 'area-chin', scores, cracks: true, sizeMm: 9 });
    // the order is scores, cracks, size; the words come from the strings
    expect(skinSummary(e).split(', ').slice(-2)).toEqual([expect.stringMatching(/crack/), expect.stringMatching(/9 mm/)]);
    expect(skinSummary({ ...e, cracks: false, sizeMm: null })).not.toMatch(/crack|mm/);
    expect((await dayLog(deps, '2026-01-15')).length).toBeGreaterThan(0);
  });
});

describe('cracks and size in the doctor report (EX-3, SK-3)', () => {
  const entry = (id: string, day: string, over: object = {}) => ({
    id,
    at: { utc: `${day}T08:00:00.000Z`, tz: 'Europe/Warsaw' },
    areaId: 'area-chin',
    scores,
    cracks: false,
    sizeMm: null,
    note: null,
    ...over,
  });
  const html = (skinEntries: object[]) =>
    buildReportHtml({
      language: 'en',
      text: (key: string) => `[${key}]`,
      areaName: (a: { name: string }) => a.name,
      itemName: (i: { name: string }) => i.name,
      records: {
        ...Object.fromEntries(
          [
            'meals',
            'nailEntries',
            'checkIns',
            'stoolEntries',
            'treatmentApplications',
            'changeEvents',
            'medicalEvents',
            'reactions',
            'drinks',
            'medicationEntries',
            'photos',
            'analyses',
            'reportSummaries',
            'tombstones',
          ].map((k) => [k, []]),
        ),
        skinEntries,
      },
      skinAreas: [
        { id: 'area-chin', kind: 'skin', name: 'Chin', predefined: true, archived: false, sensitiveDefault: false, nameOverride: null },
      ],
      dailyItems: [],
      changeCategories: [],
      treatments: [],
      photos: new Map(),
      range: { from: null, to: null },
      exportedAt: { utc: '2026-01-20T10:00:00.000Z', tz: 'Europe/Warsaw' },
    } as never);

  it('EX-3 an area with cracks or a size gets those columns, marks the entries, and plots the size from two values on', () => {
    const out = html([entry('a', '2026-01-10', { cracks: true, sizeMm: 20 }), entry('b', '2026-01-12', { sizeMm: 12 })]);
    expect(out).toContain('<th>[report.cracks]</th>');
    expect(out).toContain('<th>[report.sizeMm]</th>');
    expect(out).toContain('<td>[report.cracksYes]</td>');
    expect(out).toContain('<td>20</td>');
    expect(out).toContain('[report.sizeTrend]');
  });

  it('EX-3 an area without them keeps the compact table, and one size is a column but not yet a trend', () => {
    const plain = html([entry('a', '2026-01-10'), entry('b', '2026-01-12')]);
    expect(plain).not.toContain('report.cracks');
    expect(plain).not.toContain('report.sizeMm');
    const one = html([entry('a', '2026-01-10', { sizeMm: 7 }), entry('b', '2026-01-12')]);
    expect(one).toContain('<th>[report.sizeMm]</th>');
    expect(one).not.toContain('report.sizeTrend');
  });
});
