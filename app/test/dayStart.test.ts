import { DayStart } from '@/core/model/dayStart';
import { addDays, atOnDay, localDay, localDaysToRange } from '@/core/model/time';
import { dayLog, daysWithEntries } from '@/core/usecases/dayLog';
import { getCheckIn, saveCheckIn } from '@/core/usecases/checkin';
import { exportBundle } from '@/core/usecases/exchange';
import { logDrink } from '@/core/usecases/intake';
import { logMeal } from '@/core/usecases/logMeal';
import { getPreferences, setDayStartHour } from '@/core/usecases/preferences';
import { buildAnalysisInput } from '@/core/llm/analysisInput';
import { NettleError } from '@/core/model/errors';
import { unzipSync, strFromU8 } from 'fflate';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';

const tz = 'Europe/Warsaw';
const d = (iso: string) => new Date(iso);
const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );

describe('diary day with a start hour (NF-7)', () => {
  it('NF-7 a day runs from its start hour to the same hour the next day, on the wall clock of the entry', () => {
    // 2026-01-16 00:30 in Warsaw (UTC+1)
    const at = '2026-01-15T23:30:00.000Z';
    expect(localDay(at, tz)).toBe('2026-01-16');
    expect(localDay(at, tz, 1)).toBe('2026-01-15');
    expect(localDay('2026-01-16T00:00:00.000Z', tz, 1)).toBe('2026-01-16'); // 01:00 exactly starts the new day
    expect(localDay('2026-01-15T23:59:00.000Z', tz, 1)).toBe('2026-01-15'); // 00:59
    expect(localDay('2026-01-16T04:59:00.000Z', tz, 6)).toBe('2026-01-15'); // 05:59
    expect(localDay('2026-01-16T05:00:00.000Z', tz, 6)).toBe('2026-01-16'); // 06:00
    // the entry's own timezone decides, not the phone's
    expect(localDay('2026-01-15T23:30:00.000Z', 'America/New_York', 3)).toBe('2026-01-15');
  });

  it('NF-7 daylight saving does not move an entry across the day start', () => {
    // Warsaw switches to summer time on 2026-03-29 at 02:00 (clocks go to 03:00). 03:30 summer time = 01:30 UTC.
    expect(localDay('2026-03-29T01:30:00.000Z', tz, 3)).toBe('2026-03-29');
    expect(localDay('2026-03-29T00:30:00.000Z', tz, 3)).toBe('2026-03-28'); // 01:30 winter time
  });

  it('NF-7 a day converts to the instants between its start hour and the next one', () => {
    expect(localDaysToRange('2026-01-15', '2026-01-15', tz, 3)).toEqual({
      from: '2026-01-15T02:00:00.000Z',
      to: '2026-01-16T01:59:59.999Z',
    });
    expect(localDaysToRange('2026-01-15', '2026-01-15', tz)).toEqual({ from: '2026-01-14T23:00:00.000Z', to: '2026-01-15T22:59:59.999Z' });
    const r = localDaysToRange('2026-01-15', '2026-01-15', tz, 3)!;
    expect(localDay(r.from!, tz, 3)).toBe('2026-01-15');
    expect(localDay(r.to!, tz, 3)).toBe('2026-01-15');
    expect(localDay(new Date(Date.parse(r.to!) + 1).toISOString(), tz, 3)).toBe('2026-01-16');
  });

  it('NF-7, UX-2 a new entry for a past day takes the current clock time on that diary day', () => {
    const now = d('2026-01-15T10:30:00.000Z');
    const at = atOnDay('2026-01-10', now, tz, 3);
    expect(at.toISOString()).toBe('2026-01-10T10:30:00.000Z');
    expect(localDay(at.toISOString(), tz, 3)).toBe('2026-01-10');
    // 00:30 on the 16th still belongs to the 15th; the same wall time on a past day is 00:30 after its midnight
    const night = d('2026-01-15T23:30:00.000Z');
    expect(localDay(night.toISOString(), tz, 3)).toBe('2026-01-15');
    expect(atOnDay('2026-01-10', night, tz, 3).toISOString()).toBe('2026-01-10T23:30:00.000Z');
    expect(localDay(atOnDay('2026-01-10', night, tz, 3).toISOString(), tz, 3)).toBe('2026-01-10');
  });

  it('NF-7 the setting is a whole hour from 00:00 to 06:00 and is kept in the preferences', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(deps.dayStart.get()).toBe(0);
    for (const bad of [-1, 7, 2.5, NaN, '3' as unknown as number]) expect(await code(setDayStartHour(deps, bad))).toBe('invalid_value');
    expect(await setDayStartHour(deps, 3)).toBe(3);
    expect(deps.dayStart.get()).toBe(3);
    expect((await getPreferences(deps)).dayStartHour).toBe(3);
    expect(new DayStart(9).get()).toBe(0); // a stored nonsense value falls back to midnight
  });

  it('NF-7 the day log, the days list and the analysis regroup by the start hour while entry times stay as they are', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    const night = d('2026-01-15T23:30:00.000Z'); // 00:30 on the 16th in Warsaw
    const evening = d('2026-01-15T19:00:00.000Z');
    await logDrink(deps, { name: 'Synthetic beer', amountMl: 500, alcohol: true, at: night });
    await logMeal(deps, { description: 'Synthetic dinner', ingredients: [], at: evening });
    expect((await dayLog(deps, '2026-01-16')).map((r) => r.kind)).toEqual(['drinks']);
    await setDayStartHour(deps, 3);
    expect((await dayLog(deps, '2026-01-15')).map((r) => r.kind)).toEqual(['meals', 'drinks']);
    expect(await dayLog(deps, '2026-01-16')).toEqual([]);
    expect((await daysWithEntries(deps)).map((x) => [x.day, x.entries])).toEqual([['2026-01-15', 2]]);
    expect((await dayLog(deps, '2026-01-15'))[1]!.at.utc).toBe(night.toISOString()); // the time did not move
    const input = JSON.parse(buildAnalysisInput(await repo.snapshot(), '2026-01-15', '2026-01-15', 3).json);
    expect(input.days.find((x: { date: string }) => x.date === '2026-01-15').drinks).toHaveLength(1);
  });

  it('NF-7 a check-in made after midnight belongs to the evening before, and keeps its day when the setting changes', async () => {
    const deps = makeDeps(new MemoryRepo(), '2026-01-15T23:30:00.000Z'); // 00:30 on the 16th in Warsaw
    await setDayStartHour(deps, 3);
    const c = await saveCheckIn(deps, { values: { 'item-wellbeing': 5 }, confirmEmptyDay: true });
    expect(c.day).toBe('2026-01-15');
    expect(await getCheckIn(deps, '2026-01-15')).toMatchObject({ id: c.id });
    await setDayStartHour(deps, 0);
    expect((await getCheckIn(deps, '2026-01-15'))?.id).toBe(c.id); // a saved check-in keeps the day it was made for
    expect(addDays('2026-01-15', 1)).toBe('2026-01-16');
  });

  it('NF-7, EX-1 the setting travels with the settings of an export', async () => {
    const deps = makeDeps(new MemoryRepo());
    await setDayStartHour(deps, 4);
    const files = unzipSync(await exportBundle(deps, { parts: { records: false, settings: true } }));
    expect(JSON.parse(strFromU8(files['data.json']!)).settings.preferences.day_start_hour).toBe(4);
  });
});
