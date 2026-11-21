import { addDays, localDay, wallTimeOnDay } from '../model/time';
import type { LocalDay } from '../model/types';
import { listSuggestions } from './aiPack';
import { backupCardDue, daysSinceExport } from './backup';
import { getCheckIn } from './checkin';
import { daysWithEntries } from './dayLog';
import type { Deps } from './deps';
import { openFlareSummary, type OpenFlare } from './flares';
import { loadReminderSettings } from './reminders';

/**
 * UX-2: a context pill is a short status notice that Today shows by itself. At most two show, in this order:
 * a flare, Daily health not recorded, the time since the last export and AI suggestions to review.
 */
export type ContextPill =
  | { kind: 'flare'; flare: OpenFlare }
  | { kind: 'checkin' }
  | { kind: 'backup'; days: number | null }
  | { kind: 'suggestions'; count: number };

export const MAX_PILLS = 2;

export interface PillInput {
  flare: OpenFlare | null;
  /** The Daily health reminder time of the day has passed and the day has no record (SK-9). */
  checkInDue: boolean;
  backupDue: boolean;
  /** Whole days since the last export; null when there has been none. */
  backupDays: number | null;
  suggestions: number;
}

/** UX-2: the pills for these facts, in the fixed order and cut at two. */
export function selectPills(i: PillInput): ContextPill[] {
  const pills: ContextPill[] = [];
  if (i.flare) pills.push({ kind: 'flare', flare: i.flare });
  if (i.checkInDue) pills.push({ kind: 'checkin' });
  if (i.backupDue) pills.push({ kind: 'backup', days: i.backupDays });
  if (i.suggestions > 0) pills.push({ kind: 'suggestions', count: i.suggestions });
  return pills.slice(0, MAX_PILLS);
}

/** What Today shows around the ring for a day. */
export interface TodayContext {
  isToday: boolean;
  /** UX-1: nothing has ever been logged: the first-run card replaces the pills (today only). */
  firstRun: boolean;
  /** Today only: a past day shows "Back to Today" in place of the pills. */
  pills: ContextPill[];
}

/**
 * SK-9: whether the Daily health reminder time of a diary day has passed. The time counts whether or not the
 * reminder is switched on. A time before the day start belongs to the next calendar date of that diary day.
 */
export async function checkInTimePassed(deps: Deps, day: LocalDay, now: Date): Promise<boolean> {
  const { hour, minute } = (await loadReminderSettings(deps)).checkIn;
  const start = deps.dayStart.get();
  const date = hour < start ? (addDays(day, 1) ?? day) : day;
  const at = wallTimeOnDay(date, hour, minute, deps.clock.timeZone());
  return at !== null && now.getTime() >= at.getTime();
}

/** UX-2: the context of Today for a diary day. Only today has pills or the first-run card. */
export async function todayContext(deps: Deps, day: LocalDay): Promise<TodayContext> {
  const now = deps.clock.now();
  const today = localDay(now.toISOString(), deps.clock.timeZone(), deps.dayStart.get());
  if (day !== today) return { isToday: false, firstRun: false, pills: [] };
  if ((await daysWithEntries(deps, 1)).length === 0) return { isToday: true, firstRun: true, pills: [] };
  const pills = selectPills({
    flare: await openFlareSummary(deps),
    checkInDue: (await getCheckIn(deps, day)) === null && (await checkInTimePassed(deps, day, now)),
    backupDue: await backupCardDue(deps),
    backupDays: await daysSinceExport(deps),
    suggestions: (await listSuggestions(deps)).length,
  });
  return { isToday: true, firstRun: false, pills };
}
