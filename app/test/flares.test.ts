import { DEFAULT_FLARE_THRESHOLD, deriveFlares } from '@/core/model/flares';
import { buildAnalysisInput } from '@/core/llm/analysisInput';
import { flarePeriods, openFlare } from '@/core/usecases/flares';
import { setFlareThreshold } from '@/core/usecases/preferences';
import { logSkinEntry } from '@/core/usecases/skin';
import { NettleError } from '@/core/model/errors';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';

const at = (day: string, hour = '08') => ({ utc: `2026-01-${day}T${hour}:00:00.000Z`, tz: 'UTC' });
const entry = (id: string, areaId: string, day: string, severity: number, hour = '08') => ({
  id,
  areaId,
  at: at(day, hour),
  scores: { severity, itch: 0, pain: 0, dryness: 0, scaling: 0 },
});
const when = (d: string, severity: number, area = 'area-chin') => entry(`${area}-${d}`, area, d, severity);

describe('derived flares (SK-6)', () => {
  it('SK-6 a flare starts at the first entry at or above the threshold and ends at the first later entry below it', () => {
    const flares = deriveFlares([when('10', 5), when('12', 8), when('14', 9), when('16', 7), when('20', 8), when('22', 2)], 8);
    expect(flares).toEqual([
      { start: at('12'), end: at('16'), areaIds: ['area-chin'], lastEntryAt: at('14') },
      { start: at('20'), end: at('22'), areaIds: ['area-chin'], lastEntryAt: at('20') },
    ]);
  });

  it('SK-6 a flare with no later entry below the threshold is open at its last entry', () => {
    const [f] = deriveFlares([when('10', 9), when('12', 10)], 8);
    expect(f).toEqual({ start: at('10'), end: null, areaIds: ['area-chin'], lastEntryAt: at('12') });
  });

  it('SK-6 overlapping flares of different areas merge into one period listing the areas', () => {
    const flares = deriveFlares(
      [
        when('10', 8),
        when('14', 3),
        when('12', 9, 'area-neck'),
        when('16', 4, 'area-neck'),
        when('20', 8, 'area-arm'),
        when('21', 1, 'area-arm'),
      ],
      8,
    );
    expect(flares).toHaveLength(2);
    expect(flares[0]).toMatchObject({ start: at('10'), end: at('16'), areaIds: ['area-chin', 'area-neck'] });
    expect(flares[1]).toMatchObject({ start: at('20'), end: at('21'), areaIds: ['area-arm'] });
  });

  it('SK-6 an open flare reaches only to its last entry: a later flare of another area is its own period', () => {
    const flares = deriveFlares(
      [when('01', 9), when('20', 9, 'area-neck'), when('22', 3, 'area-neck'), when('25', 8, 'area-arm'), when('26', 9, 'area-arm')],
      8,
    );
    expect(flares).toEqual([
      { start: at('01'), end: null, areaIds: ['area-chin'], lastEntryAt: at('01') },
      { start: at('20'), end: at('22'), areaIds: ['area-neck'], lastEntryAt: at('20') },
      { start: at('25'), end: null, areaIds: ['area-arm'], lastEntryAt: at('26') },
    ]);
  });

  it('SK-6 a flare that starts by the last entry of an open one merges into it and stays open', () => {
    const flares = deriveFlares([when('10', 8), when('12', 9), when('11', 9, 'area-neck'), when('13', 2, 'area-neck')], 8);
    expect(flares).toEqual([{ start: at('10'), end: null, areaIds: ['area-chin', 'area-neck'], lastEntryAt: at('12') }]);
  });

  it('SK-6 the threshold decides, entries are judged in time order, and nothing is derived without entries', () => {
    expect(deriveFlares([], 8)).toEqual([]);
    expect(deriveFlares([when('12', 5), when('10', 5)], 8)).toEqual([]);
    expect(deriveFlares([when('12', 5), when('10', 5)], 5)).toHaveLength(1);
    expect(deriveFlares([when('14', 2), when('10', 9)], 8)[0]).toMatchObject({ start: at('10'), end: at('14') }); // given out of order
    expect(DEFAULT_FLARE_THRESHOLD).toBe(8);
  });

  it('SK-6 the flares follow the entries and the threshold in Settings', async () => {
    const deps = makeDeps(new MemoryRepo());
    const scores = (severity: number) => ({ severity, itch: 0, pain: 0, dryness: 0, scaling: 0 });
    await logSkinEntry(deps, { areaId: 'area-chin', scores: scores(6), at: new Date('2026-01-10T08:00:00.000Z') });
    expect(await flarePeriods(deps)).toEqual([]);
    await setFlareThreshold(deps, 6);
    expect(await openFlare(deps)).toMatchObject({ areaIds: ['area-chin'], end: null });
    await logSkinEntry(deps, { areaId: 'area-chin', scores: scores(2), at: new Date('2026-01-12T08:00:00.000Z') });
    expect(await openFlare(deps)).toBeNull();
    expect(await flarePeriods(deps)).toHaveLength(1);
    for (const bad of [0, 11, 2.5]) await expect(setFlareThreshold(deps, bad)).rejects.toBeInstanceOf(NettleError);
  });

  it('SK-6, UX-2 with several open flares, the current one is the most recent', async () => {
    const deps = makeDeps(new MemoryRepo());
    const scores = (severity: number) => ({ severity, itch: 0, pain: 0, dryness: 0, scaling: 0 });
    await logSkinEntry(deps, { areaId: 'area-chin', scores: scores(9), at: new Date('2026-01-01T08:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-neck', scores: scores(9), at: new Date('2026-01-12T08:00:00.000Z') });
    expect(await flarePeriods(deps)).toHaveLength(2);
    expect(await openFlare(deps)).toMatchObject({ areaIds: ['area-neck'], end: null });
  });

  it('LL-2 the analysis input lists derived flares by area name with the threshold used', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    const scores = (severity: number) => ({ severity, itch: 0, pain: 0, dryness: 0, scaling: 0 });
    await logSkinEntry(deps, { areaId: 'area-chin', scores: scores(9), at: new Date('2026-01-10T08:00:00.000Z') });
    const data = JSON.parse(buildAnalysisInput(await repo.snapshot(), '2026-01-10', '2026-01-11').json);
    expect(data.severity_threshold_for_flares).toBe(8);
    expect(data.flares).toEqual([{ areas: ['Chin'], start: '2026-01-10 09:00', end: null, open_at_last_entry: '2026-01-10 09:00' }]);
  });
});
