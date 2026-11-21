import { deriveFlares, type FlareRule } from './flares';
import type { SkinEntry, Stamp, TreatmentApplication } from './types';

/** SK-4: how far back a photo looks for the last treatment on its area. */
export const TREATMENT_LOOKBACK_DAYS = 7;
/** SK-12: a course ends after this many days without an application; one gap for all treatments (decided 2026-11-16). */
export const COURSE_GAP_DAYS = 7;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ms = (utc: string) => Date.parse(utc);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** SK-4: the last treatment on the area before a moment, and how long before. */
export interface SinceTreatment {
  treatmentId: string;
  /** Elapsed hours between the application and the moment, to one decimal. */
  hours: number;
}

/**
 * SK-4: the most recent application on `areaId` at or before `atUtc`, when it is at most 7 days earlier; null means
 * "no treatment logged" in that window. The program computes it from the timestamps, so it is exact and repeatable;
 * nothing is stored, it is recomputed from the applications every time.
 */
export function sinceLastTreatment(areaId: string, atUtc: string, applications: readonly Pick<TreatmentApplication, 'at' | 'areaIds' | 'treatmentId' | 'id'>[]): SinceTreatment | null {
  const t = ms(atUtc);
  let best: (typeof applications)[number] | null = null;
  for (const a of applications) {
    if (!a.areaIds.includes(areaId) || ms(a.at.utc) > t) continue;
    if (!best || a.at.utc > best.at.utc || (a.at.utc === best.at.utc && a.id > best.id)) best = a;
  }
  if (!best || t - ms(best.at.utc) > TREATMENT_LOOKBACK_DAYS * DAY) return null;
  return { treatmentId: best.treatmentId, hours: round1((t - ms(best.at.utc)) / HOUR) };
}

/** How to say an elapsed time: minutes under an hour, hours under two days, otherwise days. */
export function elapsedParts(hours: number): { unit: 'minutes' | 'hours' | 'days'; n: number } {
  if (hours < 1) return { unit: 'minutes', n: Math.max(1, Math.round(hours * 60)) };
  if (hours < 48) return { unit: 'hours', n: Math.round(hours) };
  return { unit: 'days', n: Math.round(hours / 24) };
}

type TextFn = (key: string, vars?: Record<string, string | number>) => string;

/** SK-4: the caption of a photo, "14 h after <treatment>" or "no treatment logged", in the language of `tx`. */
export function sinceCaption(since: SinceTreatment | null, nameOf: (treatmentId: string) => string, tx: TextFn): string {
  if (!since) return tx('derived.noTreatment');
  const { unit, n } = elapsedParts(since.hours);
  return tx('derived.sinceTreatment', { elapsed: tx(`derived.${unit}`, { n }), name: nameOf(since.treatmentId) });
}

/** SK-4: the same caption in plain English, for the analysis request (the model reads English labels whatever the app language). */
export function sinceCaptionEn(since: SinceTreatment | null, nameOf: (treatmentId: string) => string): string {
  if (!since) return `no treatment logged in the ${TREATMENT_LOOKBACK_DAYS} days before`;
  const { unit, n } = elapsedParts(since.hours);
  return `${n} ${unit === 'minutes' ? 'min' : unit === 'hours' ? 'h' : 'days'} after ${nameOf(since.treatmentId)}`;
}

/** SK-12: one finished course of one treatment on one area, and what followed it. */
export interface RelapseRow {
  areaId: string;
  treatmentId: string;
  start: Stamp;
  end: Stamp;
  applications: number;
  /** The first flare of this area that starts after the course ended; null while there is none ("no flare yet"). */
  flareStart: Stamp | null;
  /** Days from the last application to that flare start, to one decimal; null with `flareStart`. */
  days: number | null;
  /** Other treatments applied on this area between the course's end and the flare start (or the as-of moment): confounders. */
  otherTreatmentIds: string[];
}

/**
 * SK-12: time to relapse, per skin area and treatment. A course is a run of applications on the area with no gap
 * longer than 7 days, so maintenance use twice a week is one course (cost: two real courses less than a week apart
 * merge). Only finished courses count: the last application is more than 7 days before `asOfUtc`. The flare is the
 * area's own SK-6 flare (from its own entries at or above `threshold`), the first one starting after the course
 * ended. One pure function; the numbers come from the timestamps, not from the model. Nail areas have no flares and
 * no rows. Ordered by area, treatment, then course start.
 */
export function timeToRelapse(
  skinEntries: readonly Pick<SkinEntry, 'id' | 'at' | 'areaId' | 'scores'>[],
  applications: readonly Pick<TreatmentApplication, 'id' | 'at' | 'areaIds' | 'treatmentId'>[],
  threshold: FlareRule,
  asOfUtc: string,
): RelapseRow[] {
  const rows: RelapseRow[] = [];
  const skinAreas = [...new Set(skinEntries.map((e) => e.areaId))].sort();
  for (const areaId of skinAreas) {
    const flares = deriveFlares(skinEntries.filter((e) => e.areaId === areaId), threshold);
    const onArea = applications.filter((a) => a.areaIds.includes(areaId));
    for (const treatmentId of [...new Set(onArea.map((a) => a.treatmentId))].sort()) {
      const mine = onArea.filter((a) => a.treatmentId === treatmentId).sort((a, b) => a.at.utc.localeCompare(b.at.utc) || a.id.localeCompare(b.id));
      const courses: (typeof mine)[] = [];
      for (const a of mine) {
        const cur = courses[courses.length - 1];
        if (cur && ms(a.at.utc) - ms(cur[cur.length - 1]!.at.utc) <= COURSE_GAP_DAYS * DAY) cur.push(a);
        else courses.push([a]);
      }
      for (const course of courses) {
        const end = course[course.length - 1]!.at;
        if (ms(asOfUtc) - ms(end.utc) <= COURSE_GAP_DAYS * DAY) continue; // still running, or only just stopped
        const flare = flares.find((f) => f.start.utc > end.utc) ?? null;
        const until = flare ? flare.start.utc : asOfUtc;
        const others = [...new Set(onArea.filter((a) => a.treatmentId !== treatmentId && a.at.utc > end.utc && a.at.utc <= until).map((a) => a.treatmentId))].sort();
        rows.push({
          areaId,
          treatmentId,
          start: course[0]!.at,
          end,
          applications: course.length,
          flareStart: flare ? flare.start : null,
          days: flare ? round1((ms(flare.start.utc) - ms(end.utc)) / DAY) : null,
          otherTreatmentIds: others,
        });
      }
    }
  }
  return rows;
}
