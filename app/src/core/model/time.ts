import type { Clock } from '../ports/platform';
import type { Stamp } from './types';

/** Canonical form: fixed width, so string order equals time order. */
export const CANONICAL_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function makeStamp(clock: Clock, at?: Date): Stamp {
  return { utc: (at ?? clock.now()).toISOString(), tz: clock.timeZone() };
}
