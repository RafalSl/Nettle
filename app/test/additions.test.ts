import { baseThreshold, deriveFlares, thresholdOf } from '@/core/model/flares';
import { defaultPreferences, flareRule } from '@/core/model/preferences';
import { parsePreferences, preferencesToJson } from '@/core/export/preferencesJson';
import { NettleError } from '@/core/model/errors';
import { formatElapsed, runCardStatus, type AnalysisRun } from '@/core/usecases/analysisRunner';
import { getGroupModel, getModel, setGroupModel, setModel } from '@/core/usecases/llm';
import { flarePeriods } from '@/core/usecases/flares';
import { addArea, logSkinEntry } from '@/core/usecases/skin';
import { getPreferences, setAreaFlareThreshold, setFlareScope } from '@/core/usecases/preferences';
import { DEFAULT_TREND_RANGE, downsample, limitTrend, trendRangeStart, type TrendPoint } from '@/core/usecases/timeline';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps, syntheticEntry } from './helpers/fixtures';

const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );

describe('trend ranges (SK-7, SK-8)', () => {
  const pt = (day: string): TrendPoint => ({ day, value: 1, flare: null });
  const points = ['2025-11-20', '2025-12-15', '2026-01-10', '2026-01-14', '2026-01-15'].map(pt);
  it('SK-8 the default is 90 days; a range of N days is today and the N-1 days before', () => {
    expect(DEFAULT_TREND_RANGE).toBe('90d');
    expect(trendRangeStart('30d', '2026-01-15')).toBe('2025-12-17');
    expect(trendRangeStart('90d', '2026-01-15')).toBe('2025-10-18');
    expect(trendRangeStart('1y', '2026-01-15')).toBe('2025-01-16');
    expect(trendRangeStart('all', '2026-01-15')).toBeNull();
  });
  it('SK-8 limits the points to the range, keeps order, and All keeps everything', () => {
    expect(limitTrend(points, '30d', '2026-01-15').map((p) => p.day)).toEqual(['2026-01-10', '2026-01-14', '2026-01-15']); // 2025-12-15 is 31 days back
    expect(limitTrend(points, '90d', '2026-01-15')).toHaveLength(5);
    expect(limitTrend(points, 'all', '2026-01-15')).toHaveLength(5);
    expect(limitTrend([pt('2025-12-17'), pt('2025-12-16')], '30d', '2026-01-15').map((p) => p.day)).toEqual(['2025-12-17']); // exactly 30 days: in; the day before: out
    expect(limitTrend([pt('2026-01-16')], 'all', '2026-01-15')).toHaveLength(1); // All is not cut at today
    expect(limitTrend([pt('2026-01-16')], '30d', '2026-01-15')).toHaveLength(0); // a day after today is outside a range
  });
});

describe('chart downsampling (SK-8)', () => {
  const pts = (n: number): TrendPoint[] =>
    Array.from({ length: n }, (_, i) => ({ day: `2026-01-${String(i + 1).padStart(2, '0')}`, value: i % 2 === 0 ? 2 : 4, flare: null }));
  it('SK-8 up to the maximum nothing changes; above it groups are averaged and keep a flare start before an end', () => {
    expect(downsample(pts(10), 10)).toEqual(pts(10));
    const many = pts(30).map((p, i) => (i === 7 ? { ...p, flare: 'end' as const } : i === 8 ? { ...p, flare: 'start' as const } : p));
    const out = downsample(many, 10);
    expect(out).toHaveLength(10);
    expect(out[0]).toEqual({ day: '2026-01-01', value: 2.7, flare: null }); // (2 + 4 + 2) / 3, to one decimal
    expect(out[2]!.flare).toBe('start'); // the group of days 7 to 9 holds an end and a start
  });
});

describe('flare threshold scope (SK-8)', () => {
  const e = (id: string, utc: string, areaId: string, severity: number) => ({
    ...syntheticEntry(id, utc, areaId),
    scores: { severity, itch: 0, pain: 0, dryness: 0, scaling: 0 },
  });
  const entries = [e('a1', '2026-01-10T10:00:00.000Z', 'area-chin', 6), e('b1', '2026-01-10T10:00:00.000Z', 'area-hands', 6)];
  it('SK-8 one threshold for every area is the default and works as before', () => {
    expect(deriveFlares(entries, 8)).toEqual([]);
    expect(deriveFlares(entries, 6).map((f) => f.areaIds)).toEqual([['area-chin', 'area-hands']]);
    expect(thresholdOf(8, 'area-chin')).toBe(8);
    expect(baseThreshold(8)).toBe(8);
  });
  it('SK-8 a per-area rule gives each area its own threshold and the others the fallback', () => {
    const rule = { fallback: 8, perArea: { 'area-chin': 5 } };
    expect(thresholdOf(rule, 'area-chin')).toBe(5);
    expect(thresholdOf(rule, 'area-hands')).toBe(8);
    expect(deriveFlares(entries, rule).map((f) => f.areaIds)).toEqual([['area-chin']]);
    expect(baseThreshold(rule)).toBe(8);
  });
  it('SK-8 the preferences switch the rule: "all" ignores the per-area values, "perArea" uses them', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(flareRule(defaultPreferences())).toBe(8);
    await setAreaFlareThreshold(deps, 'area-chin', 5);
    await logSkinEntry(deps, {
      areaId: 'area-chin',
      scores: { severity: 6, itch: 0, pain: 0, dryness: 0, scaling: 0 },
      at: new Date('2026-01-14T10:00:00.000Z'),
    });
    expect(await flarePeriods(deps)).toEqual([]); // scope "all": the common threshold 8 applies
    expect(await setFlareScope(deps, 'perArea')).toBe('perArea');
    expect((await flarePeriods(deps)).map((f) => f.areaIds)).toEqual([['area-chin']]);
    expect(flareRule(await getPreferences(deps))).toEqual({ fallback: 8, perArea: { 'area-chin': 5 } });
    await setAreaFlareThreshold(deps, 'area-chin', null); // back to the common value
    expect(await flarePeriods(deps)).toEqual([]);
  });
  it('SK-8 only skin areas take a threshold, and only whole numbers from 1 to 10', async () => {
    const deps = makeDeps(new MemoryRepo());
    const nail = await addArea(deps, 'Synthetic nail', 'nail');
    expect(await code(setAreaFlareThreshold(deps, nail.id, 5))).toBe('wrong_area_kind');
    expect(await code(setAreaFlareThreshold(deps, 'area-nope', 5))).toBe('unknown_area');
    expect(await code(setAreaFlareThreshold(deps, 'area-chin', 0))).toBe('invalid_value');
    expect(await code(setAreaFlareThreshold(deps, 'area-chin', 5.5))).toBe('invalid_value');
    expect(await code(setFlareScope(deps, 'nope' as never))).toBe('invalid_value');
  });
  it('SK-8, EX-1 the scope and the per-area thresholds travel in the settings part and are validated on the way in', () => {
    const p = { ...defaultPreferences(), flareScope: 'perArea' as const, flareThresholdByArea: { 'area-chin': 5 } };
    expect(parsePreferences(JSON.parse(JSON.stringify(preferencesToJson(p))), 'preferences')).toEqual(p);
    const json = JSON.parse(JSON.stringify(preferencesToJson(p)));
    expect(() => parsePreferences({ ...json, flare_scope: 'x' }, 'preferences')).toThrow();
    expect(() => parsePreferences({ ...json, flare_thresholds: { 'area-chin': 11 } }, 'preferences')).toThrow();
  });
});

describe('model groups (LL-2, LL-9)', () => {
  it('LL-2 one choice sets every action of its group; a hand-set action makes the group "mixed" until it is set again', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await getGroupModel(deps, 'estimates')).toBe('claude-haiku-5-5');
    await setGroupModel(deps, 'analysis', 'claude-sonnet-5-5');
    expect(await getModel(deps, 'analysis')).toBe('claude-sonnet-5-5');
    expect(await getModel(deps, 'report_summary')).toBe('claude-sonnet-5-5');
    expect(await getModel(deps, 'meal_photo')).toBe('claude-haiku-5-5'); // the other group is untouched
    await setModel(deps, 'report_summary', 'claude-haiku-5-5');
    expect(await getGroupModel(deps, 'analysis')).toBeNull();
    await setGroupModel(deps, 'analysis', null);
    expect(await getGroupModel(deps, 'analysis')).toBe('claude-haiku-5-5');
    await setGroupModel(deps, 'estimates', 'claude-sonnet-5-5');
    for (const a of ['label_scan', 'meal_photo', 'meal_name', 'allergen_suggest'] as const)
      expect(await getModel(deps, a)).toBe('claude-sonnet-5-5');
    expect(await code(setGroupModel(deps, 'estimates', 'not-offered'))).toBe('invalid_value');
  });
});

describe('run card status (LL-12)', () => {
  const prepared = {} as never;
  it('LL-12 a card shows the seconds while running, and a state when the run ended; nothing when idle or cancelled', () => {
    const running: AnalysisRun = { status: 'running', prepared, startedAt: 1_000 };
    expect(runCardStatus(running, 66_500)).toEqual({ state: 'running', seconds: 65 });
    expect(runCardStatus(running, 500)).toEqual({ state: 'running', seconds: 0 });
    expect(runCardStatus({ status: 'failed', prepared, error: new Error('x') }, 0)).toEqual({ state: 'failed' });
    expect(runCardStatus({ status: 'interrupted', prepared }, 0)).toEqual({ state: 'interrupted' });
    expect(runCardStatus({ status: 'idle' }, 0)).toBeNull();
    expect(runCardStatus({ status: 'cancelled' }, 0)).toBeNull();
  });
  it('LL-12 elapsed time reads m:ss', () => {
    expect([0, 9, 65, 600, 3599].map(formatElapsed)).toEqual(['0:00', '0:09', '1:05', '10:00', '59:59']);
  });
});
