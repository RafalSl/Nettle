import { addDays, localDay, localDaysToRange } from '../model/time';
import type { CheckIn, DateRange, LocalDay, Records, Stamp } from '../model/types';
import type { Deps } from './deps';
import { getCheckIn } from './checkin';

/** The record kinds that appear in the day's log (UX-2). Photos hang off entries, analyses are not diary entries. */
export const LOG_KINDS = [
  'meals',
  'skinEntries',
  'nailEntries',
  'checkIns',
  'stoolEntries',
  'treatmentApplications',
  'changeEvents',
  'reactions',
  'drinks',
  'medicationEntries',
  'flareMarkers',
] as const;
export type LogKind = (typeof LOG_KINDS)[number];

export type LogRow = { [K in LogKind]: { kind: K; id: string; at: Stamp; record: Records[K][number] } }[LogKind];

/** Local calendar days are the entry's own (NF-4), so a day is looked up with one day of slack either side. */
function slack(day: LocalDay, tz: string, startHour: number): DateRange {
  return localDaysToRange(addDays(day, -1) ?? day, addDays(day, 1) ?? day, tz, startHour) ?? {};
}

/** UX-2: everything logged on one local day, oldest first, each row carrying its record for editing and deleting (EN-1). */
export async function dayLog(deps: Deps, day: LocalDay): Promise<LogRow[]> {
  const start = deps.dayStart.get();
  const snap = await deps.repo.snapshot(slack(day, deps.clock.timeZone(), start));
  const rows: LogRow[] = [];
  for (const kind of LOG_KINDS) {
    for (const record of snap[kind] as { id: string; at: Stamp }[]) {
      if (localDay(record.at.utc, record.at.tz, start) === day) rows.push({ kind, id: record.id, at: record.at, record } as LogRow);
    }
  }
  return rows.sort((a, b) => a.at.utc.localeCompare(b.at.utc) || a.id.localeCompare(b.id));
}

export interface DayStatus {
  /** SK-7, SK-11: the Daily health record; having one is what logs the day. */
  checkIn: CheckIn | null;
  mealCount: number;
}

/** UX-2: what the context cards need about a day. */
export async function dayStatus(deps: Deps, day: LocalDay): Promise<DayStatus> {
  const checkIn = await getCheckIn(deps, day);
  const mealCount = (await dayLog(deps, day)).filter((r) => r.kind === 'meals').length;
  return { checkIn, mealCount };
}

export interface TreatmentShortcut {
  treatmentId: string;
  areaIds: string[];
  /** Times this exact combination was applied. */
  count: number;
}

/** A combination becomes a shortcut after it was used this many times (IN-11). */
export const SHORTCUT_MIN_USES = 2;
export const SHORTCUT_MAX = 3;

/**
 * IN-11, UX-2: treatment and area combinations used at least twice, most used first (ties: most recent),
 * at most three. A combination with an archived treatment or area never shows.
 */
export async function treatmentShortcuts(deps: Deps): Promise<TreatmentShortcut[]> {
  const treatments = new Map((await deps.repo.listItems('treatments')).map((t) => [t.id, t]));
  const areas = new Map((await deps.repo.listAreas()).map((a) => [a.id, a]));
  const groups = new Map<string, TreatmentShortcut & { last: string }>();
  for (const a of await deps.repo.listRecords('treatmentApplications')) {
    const areaIds = [...new Set(a.areaIds)].sort();
    const key = `${a.treatmentId}|${areaIds.join(',')}`;
    const g = groups.get(key);
    if (g) {
      g.count++;
      if (a.at.utc > g.last) g.last = a.at.utc;
    } else groups.set(key, { treatmentId: a.treatmentId, areaIds, count: 1, last: a.at.utc });
  }
  return [...groups.values()]
    .filter(
      (g) =>
        g.count >= SHORTCUT_MIN_USES &&
        treatments.get(g.treatmentId) !== undefined &&
        !treatments.get(g.treatmentId)!.archived &&
        g.areaIds.every((id) => areas.has(id) && !areas.get(id)!.archived),
    )
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, SHORTCUT_MAX)
    .map(({ treatmentId, areaIds, count }) => ({ treatmentId, areaIds, count }));
}

export interface DaySummary {
  day: LocalDay;
  entries: number;
  complete: boolean;
}

/** UX-1: the days that have entries, newest first, for the Review list. Each day is the entry's own local day (NF-4). */
export async function daysWithEntries(deps: Deps, limit = 60): Promise<DaySummary[]> {
  const snap = await deps.repo.snapshot();
  const start = deps.dayStart.get();
  const days = new Map<LocalDay, DaySummary>();
  for (const kind of LOG_KINDS) {
    for (const r of snap[kind] as { at: Stamp }[]) {
      const day = localDay(r.at.utc, r.at.tz, start);
      const cur = days.get(day) ?? { day, entries: 0, complete: false };
      cur.entries++;
      if (kind === 'checkIns') cur.complete = true; // SK-11: a Daily health record logs the day
      days.set(day, cur);
    }
  }
  return [...days.values()].sort((a, b) => b.day.localeCompare(a.day)).slice(0, limit);
}
