import type { Clock } from '../ports/platform';
import type { DateRange, Stamp } from './types';

/** Canonical form: fixed width, so string order equals time order. */
export const CANONICAL_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function makeStamp(clock: Clock, at?: Date): Stamp {
  return { utc: (at ?? clock.now()).toISOString(), tz: clock.timeZone() };
}

/** SK-7 / SK-11: the local calendar day of an instant in an IANA timezone, as "YYYY-MM-DD". */
export function localDay(utc: string, tz: string): string {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(utc),
  );
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses "YYYY-MM-DD" into UTC midnight milliseconds, or null when it is not a real calendar day. */
function dayToMs(day: string): number | null {
  const m = DAY.exec(day);
  if (!m) return null;
  const ms = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!);
  return new Date(ms).toISOString().startsWith(day) ? ms : null;
}

/** How far the wall clock in `tz` is ahead of UTC at an instant, in milliseconds. */
function offsetMs(instantMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const get = (type: string) => +parts.find((p) => p.type === type)!.value;
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wall - Math.floor(instantMs / 1000) * 1000;
}

/** The first instant of a local calendar day in `tz` (two passes so a daylight saving switch is handled). */
function startOfLocalDayMs(dayMs: number, tz: string): number {
  const first = dayMs - offsetMs(dayMs, tz);
  return dayMs - offsetMs(first, tz);
}

/**
 * EX-11 note: local calendar days to inclusive UTC bounds, using the timezone given (the device's at export
 * time). `from` is the start of its day, `to` the last millisecond of its day; either may be open.
 * Returns null when a day is not "YYYY-MM-DD" or `from` is after `to`.
 */
export function localDaysToRange(from: string | undefined, to: string | undefined, tz: string): DateRange | null {
  const range: DateRange = {};
  const f = from === undefined ? undefined : dayToMs(from);
  const t = to === undefined ? undefined : dayToMs(to);
  if (f === null || t === null) return null;
  if (f !== undefined && t !== undefined && f > t) return null;
  if (f !== undefined) range.from = new Date(startOfLocalDayMs(f, tz)).toISOString();
  if (t !== undefined) range.to = new Date(startOfLocalDayMs(t + 24 * 3600 * 1000, tz) - 1).toISOString();
  return range;
}

/** "YYYY-MM-DD HH:mm" of an instant in an IANA timezone, for showing local times to the model and the user. */
export function localDateTime(utc: string, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(utc));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

/** The calendar day `n` days after (or before, when negative) a "YYYY-MM-DD" day. Returns null for an invalid day. */
export function addDays(day: string, n: number): string | null {
  const ms = dayToMs(day);
  return ms === null ? null : new Date(ms + n * 24 * 3600 * 1000).toISOString().slice(0, 10);
}
