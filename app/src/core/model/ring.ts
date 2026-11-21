import { localDaysToRange } from './time';
import type { LocalDay, Stamp } from './types';

/**
 * UX-2: geometry of the day ring, with no drawing. A dial covers one diary day (NF-7) from its start hour; a position
 * is a fraction from 0 (the day start) to 1 (the next day start), so the screen only turns it into an angle.
 */

/** The track an entry sits on: intake (filled dots, outer) or body and care (hollow dots, inner). */
export type RingTrack = 'intake' | 'care';

const INTAKE_KINDS: ReadonlySet<string> = new Set(['meals', 'drinks', 'medicationEntries']);

/** UX-2: meals, drinks and medication are intake; everything else is body and care. */
export const trackOf = (kind: string): RingTrack => (INTAKE_KINDS.has(kind) ? 'intake' : 'care');

export interface RingEntry {
  id: string;
  kind: string;
  at: Stamp;
}

/** One dot on the ring: one entry, or several merged ones (`ids` oldest first). */
export interface RingDot {
  track: RingTrack;
  /** 0 to 1 along the day; for a merged dot the mean of its entries. */
  position: number;
  ids: string[];
}

/** Dots closer than this fraction of the day on the same track merge: 3 % is about 43 minutes. */
export const MERGE_GAP = 0.03;

interface DayBounds {
  fromMs: number;
  lengthMs: number;
}

/** The start and length of a diary day in its time zone (23 or 25 hours on a daylight saving switch). */
function dayBounds(day: LocalDay, tz: string, startHour: number): DayBounds | null {
  const r = localDaysToRange(day, day, tz, startHour);
  if (!r?.from || !r.to) return null;
  const fromMs = Date.parse(r.from);
  return { fromMs, lengthMs: Date.parse(r.to) + 1 - fromMs };
}

/** The position of an instant on the ring of a day, clamped to 0 to 1; null for an invalid day. */
export function ringPosition(utc: string, day: LocalDay, tz: string, startHour = 0): number | null {
  const b = dayBounds(day, tz, startHour);
  if (!b) return null;
  return Math.min(1, Math.max(0, (Date.parse(utc) - b.fromMs) / b.lengthMs));
}

/** UX-2: the arc runs up to now on today and is absent on a past day (null). */
export function arcPosition(now: Date, day: LocalDay, today: LocalDay, tz: string, startHour = 0): number | null {
  return day === today ? ringPosition(now.toISOString(), day, tz, startHour) : null;
}

/**
 * UX-2: the dots of a day. Entries sort by time; on each track an entry that lies within `gap` of the previous one
 * joins that dot, which then sits at the mean position of its entries.
 */
export function ringDots(entries: readonly RingEntry[], day: LocalDay, tz: string, startHour = 0, gap = MERGE_GAP): RingDot[] {
  const sorted = [...entries].sort((a, b) => a.at.utc.localeCompare(b.at.utc) || a.id.localeCompare(b.id));
  const open: Record<RingTrack, { positions: number[]; ids: string[] } | null> = { intake: null, care: null };
  const dots: RingDot[] = [];
  const close = (track: RingTrack) => {
    const c = open[track];
    if (c) dots.push({ track, position: c.positions.reduce((s, p) => s + p, 0) / c.positions.length, ids: c.ids });
    open[track] = null;
  };
  for (const e of sorted) {
    const p = ringPosition(e.at.utc, day, tz, startHour);
    if (p === null) continue;
    const track = trackOf(e.kind);
    const c = open[track];
    if (c && p - c.positions[c.positions.length - 1]! <= gap) {
      c.positions.push(p);
      c.ids.push(e.id);
    } else {
      close(track);
      open[track] = { positions: [p], ids: [e.id] };
    }
  }
  close('intake');
  close('care');
  return dots.sort((a, b) => a.position - b.position || a.track.localeCompare(b.track));
}

/** UX-2: the four hour labels of the dial, 00, 06, 12 and 18 counted from the day start, as two-digit hours. */
export function hourLabels(startHour = 0): string[] {
  return [0, 6, 12, 18].map((h) => String((startHour + h) % 24).padStart(2, '0'));
}
