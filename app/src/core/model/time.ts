import type { Clock } from '../ports/platform';
import type { DateRange, Stamp } from './types';

/** Canonical form: fixed width, so string order equals time order. */
export const CANONICAL_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function makeStamp(clock: Clock, at?: Date): Stamp {
  return { utc: (at ?? clock.now()).toISOString(), tz: clock.timeZone() };
}

/** Wall-clock parts of an instant in an IANA timezone. Built from named parts, so it does not depend on a locale's date format. */
function wallParts(utc: string, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(utc));
  const get = (type: string) => parts.find((p) => p.type === type)!.value.padStart(2, '0');
  return { y: get('year').padStart(4, '0'), mo: get('month'), d: get('day'), h: get('hour') === '24' ? '00' : get('hour'), mi: get('minute') };
}

/**
 * SK-7 / SK-11, NF-7: the diary day of an instant, as "YYYY-MM-DD". A day runs from `startHour` (whole hours, default
 * midnight) on the wall clock of `tz` to the same hour the next day, so 00:30 can still belong to the day before.
 * The shift is done on the wall clock, so a daylight saving switch cannot move an entry by an hour.
 */
export function localDay(utc: string, tz: string, startHour = 0): string {
  const { y, mo, d, h, mi } = wallParts(utc, tz);
  if (startHour === 0) return `${y}-${mo}-${d}`;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi) - startHour * HOUR_MS).toISOString().slice(0, 10);
}

const HOUR_MS = 3600 * 1000;

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
export function localDaysToRange(from: string | undefined, to: string | undefined, tz: string, startHour = 0): DateRange | null {
  const range: DateRange = {};
  const f = from === undefined ? undefined : dayToMs(from);
  const t = to === undefined ? undefined : dayToMs(to);
  if (f === null || t === null) return null;
  if (f !== undefined && t !== undefined && f > t) return null;
  const shift = startHour * HOUR_MS; // NF-7: a day begins at its start hour
  if (f !== undefined) range.from = new Date(startOfLocalDayMs(f + shift, tz)).toISOString();
  if (t !== undefined) range.to = new Date(startOfLocalDayMs(t + 24 * HOUR_MS + shift, tz) - 1).toISOString();
  return range;
}

/** "YYYY-MM-DD HH:mm" of an instant in an IANA timezone, for showing local times to the model and the user. */
export function localDateTime(utc: string, tz: string): string {
  const { y, mo, d, h, mi } = wallParts(utc, tz);
  return `${y}-${mo}-${d} ${h}:${mi}`;
}

/** The calendar day `n` days after (or before, when negative) a "YYYY-MM-DD" day. Returns null for an invalid day. */
export function addDays(day: string, n: number): string | null {
  const ms = dayToMs(day);
  return ms === null ? null : new Date(ms + n * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * SK-9: the instant of a wall-clock time (hour and minute) on a calendar day in `tz`, independent of the time zone of
 * the process. Null for an invalid day. A time inside a daylight saving gap lands an hour later.
 */
export function wallTimeOnDay(day: string, hour: number, minute: number, tz: string): Date | null {
  const ms = dayToMs(day);
  return ms === null ? null : new Date(startOfLocalDayMs(ms, tz) + (hour * 60 + minute) * 60 * 1000);
}

/**
 * UX-2: the moment to use for a new entry on a chosen day: the current clock time on that day (in the given
 * timezone), never later than the end of that day. For today it is simply now.
 */
export function atOnDay(day: string, now: Date, tz: string, startHour = 0): Date {
  const todayDay = localDay(now.toISOString(), tz, startHour);
  if (day === todayDay) return now;
  const dayRange = localDaysToRange(day, day, tz, startHour);
  const todayRange = localDaysToRange(todayDay, todayDay, tz, startHour);
  if (!dayRange?.from || !dayRange.to || !todayRange?.from) return now;
  const at = Date.parse(dayRange.from) + (now.getTime() - Date.parse(todayRange.from));
  return new Date(Math.min(at, Date.parse(dayRange.to)));
}
