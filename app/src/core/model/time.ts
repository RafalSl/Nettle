import type { Clock } from '../ports/platform';
import type { Stamp } from './types';

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
