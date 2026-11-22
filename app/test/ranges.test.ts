import { strFromU8, unzipSync } from 'fflate';
import { SqliteRepo } from '@/adapters/storage/sqliteRepo';
import { localDaysToRange } from '@/core/model/time';
import type { StorageRepository } from '@/core/ports/storage';
import { exportBundle } from '@/core/usecases/exchange';
import { archiveSkinArea, lastSkinScores, logSkinEntry, repeatSkinEntry } from '@/core/usecases/skin';
import { MemoryRepo } from './fakes/memoryRepo';
import { createNodeSqliteDb } from './helpers/nodeSqliteDb';
import { makeDeps, syntheticMeal } from './helpers/fixtures';
import { errorCode } from './helpers/errors';

describe('localDaysToRange (EX-11 note, NF-4)', () => {
  it('EX-11 converts a winter day in Warsaw (UTC+1), inclusive at both ends', () => {
    expect(localDaysToRange('2026-01-15', '2026-01-15', 'Europe/Warsaw')).toEqual({
      from: '2026-01-14T23:00:00.000Z',
      to: '2026-01-15T22:59:59.999Z',
    });
  });

  it('EX-11 converts a summer day in Warsaw (UTC+2) and a span of days', () => {
    expect(localDaysToRange('2026-07-01', '2026-07-03', 'Europe/Warsaw')).toEqual({
      from: '2026-06-30T22:00:00.000Z',
      to: '2026-07-03T21:59:59.999Z',
    });
  });

  it('EX-11 handles the 23-hour and 25-hour days at the daylight saving switches', () => {
    expect(localDaysToRange('2026-03-29', '2026-03-29', 'Europe/Warsaw')).toEqual({
      from: '2026-03-28T23:00:00.000Z',
      to: '2026-03-29T21:59:59.999Z',
    });
    expect(localDaysToRange('2026-10-25', '2026-10-25', 'Europe/Warsaw')).toEqual({
      from: '2026-10-24T22:00:00.000Z',
      to: '2026-10-25T22:59:59.999Z',
    });
  });

  it('EX-11 works west of UTC and in UTC, and leaves an open side open', () => {
    expect(localDaysToRange('2026-01-15', '2026-01-15', 'America/New_York')).toEqual({
      from: '2026-01-15T05:00:00.000Z',
      to: '2026-01-16T04:59:59.999Z',
    });
    expect(localDaysToRange('2026-01-15', undefined, 'UTC')).toEqual({ from: '2026-01-15T00:00:00.000Z' });
    expect(localDaysToRange(undefined, '2026-01-15', 'UTC')).toEqual({ to: '2026-01-15T23:59:59.999Z' });
    expect(localDaysToRange(undefined, undefined, 'UTC')).toEqual({});
  });

  it('EX-11 rejects malformed days, days that do not exist and a start after the end', () => {
    expect(localDaysToRange('15-01-2026', undefined, 'UTC')).toBeNull();
    expect(localDaysToRange('2026-02-30', undefined, 'UTC')).toBeNull();
    expect(localDaysToRange(undefined, '2026-13-01', 'UTC')).toBeNull();
    expect(localDaysToRange('2026-01-16', '2026-01-15', 'UTC')).toBeNull();
  });
});

const repos: [string, () => Promise<StorageRepository>][] = [
  ['in-memory', async () => new MemoryRepo()],
  ['sqlite', async () => SqliteRepo.open(createNodeSqliteDb())],
];

describe.each(repos)('export by local days (%s)', (_name, make) => {
  it('EX-11 includes the first and last minute of a local day and excludes the minute outside', async () => {
    const repo = await make();
    // Device timezone in the test deps is Europe/Warsaw (UTC+1 in January).
    for (const [id, utc] of [
      ['before', '2026-01-14T22:59:59.000Z'],
      ['first', '2026-01-14T23:00:00.000Z'],
      ['last', '2026-01-15T22:59:59.000Z'],
      ['after', '2026-01-15T23:00:00.000Z'],
    ] as const) {
      await repo.addRecord('meals', syntheticMeal(id, utc));
    }
    const zip = await exportBundle(makeDeps(repo), { days: { from: '2026-01-15', to: '2026-01-15' } });
    const json = JSON.parse(strFromU8(unzipSync(zip)['data.json']!));
    expect(json.records.meals.map((m: { id: string }) => m.id).sort()).toEqual(['first', 'last']);
    expect(json.range).toEqual({ from: '2026-01-14T23:00:00.000Z', to: '2026-01-15T22:59:59.999Z' });
  });

  it('EX-11 rejects an invalid day range before exporting', async () => {
    const deps = makeDeps(await make());
    expect(await errorCode(exportBundle(deps, { days: { from: '2026-01-16', to: '2026-01-15' } }))).toBe('invalid_range');
    expect(await errorCode(exportBundle(deps, { days: { from: 'yesterday' } }))).toBe('invalid_range');
  });
});

describe('fast skin logging (SK-3, NF-2)', () => {
  const scores = { severity: 4, itch: 7, pain: 1, dryness: 3, scaling: 6 };

  it('SK-3 prefills from the newest entry of that area only', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await lastSkinScores(deps, 'area-chin')).toBeNull();
    await logSkinEntry(deps, { areaId: 'area-chin', scores: { ...scores, itch: 1 }, at: new Date('2026-01-10T08:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-12T08:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-neck', scores: { ...scores, itch: 9 }, at: new Date('2026-01-13T08:00:00.000Z') });
    expect(await lastSkinScores(deps, 'area-chin')).toEqual(scores);
  });

  it('SK-3 "no change" saves a new entry with the last scores and no note, in one call', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    await logSkinEntry(deps, { areaId: 'area-chin', scores, note: 'flaky', at: new Date('2026-01-10T08:00:00.000Z') });
    const again = await repeatSkinEntry(deps, 'area-chin', new Date('2026-01-11T08:00:00.000Z'));
    expect(again).toMatchObject({ areaId: 'area-chin', scores, note: null, at: { utc: '2026-01-11T08:00:00.000Z' } });
    expect(await repo.listRecords('skinEntries')).toHaveLength(2);
  });

  it('SK-3 "no change" needs a previous entry and a loggable area', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await errorCode(repeatSkinEntry(deps, 'area-chin'))).toBe('no_previous_entry');
    await logSkinEntry(deps, { areaId: 'area-chin', scores });
    await archiveSkinArea(deps, 'area-chin');
    expect(await errorCode(repeatSkinEntry(deps, 'area-chin'))).toBe('area_archived');
  });
});
