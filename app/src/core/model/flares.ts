import type { SkinEntry, Stamp } from './types';

/** SK-6: the default severity at or above which an entry counts as a flare. */
export const DEFAULT_FLARE_THRESHOLD = 8;

/**
 * SK-8: how flares are found. A number is one threshold for every area ("Same for all", the default). An object gives
 * each area its own threshold and a fallback for the areas without one ("Per area").
 */
export type FlareRule = number | { fallback: number; perArea: Readonly<Record<string, number>> };

/** SK-8: the threshold that applies to one area. */
export const thresholdOf = (rule: FlareRule, areaId: string): number => (typeof rule === 'number' ? rule : (rule.perArea[areaId] ?? rule.fallback));

/** SK-8: the single number behind a rule (the fallback of a per-area rule), for texts that state one threshold. */
export const baseThreshold = (rule: FlareRule): number => (typeof rule === 'number' ? rule : rule.fallback);

/**
 * SK-6: a derived flare. `end` is the first later entry of the area below the threshold; null means the flare is
 * "open at last entry" (`lastEntryAt`). Periods of different areas that overlap are merged, so `areaIds` can list several.
 */
export interface FlarePeriod {
  start: Stamp;
  end: Stamp | null;
  areaIds: string[];
  lastEntryAt: Stamp;
}

const byTime = (a: { at: Stamp; id: string }, b: { at: Stamp; id: string }) => a.at.utc.localeCompare(b.at.utc) || a.id.localeCompare(b.id);

/**
 * SK-6, SK-8: flare periods from skin entries and a severity threshold (one for all areas or one per area), oldest first. Per area a period starts at the first
 * entry at or above the threshold and ends at the first later entry below it; overlapping periods of different
 * areas merge into one. An open period reaches to its last entry, so a later flare of another area is its own period. Nail entries are not skin entries, so they never flare.
 */
export function deriveFlares(entries: readonly Pick<SkinEntry, 'id' | 'at' | 'areaId' | 'scores'>[], rule: FlareRule): FlarePeriod[] {
  const perArea: FlarePeriod[] = [];
  const areas = new Set(entries.map((e) => e.areaId));
  for (const areaId of areas) {
    let open: FlarePeriod | null = null;
    for (const e of entries.filter((x) => x.areaId === areaId).sort(byTime)) {
      if (e.scores.severity >= thresholdOf(rule, areaId)) {
        if (open) open.lastEntryAt = e.at;
        else perArea.push((open = { start: e.at, end: null, areaIds: [areaId], lastEntryAt: e.at }));
      } else if (open) {
        open.end = e.at;
        open = null;
      }
    }
  }
  perArea.sort((a, b) => a.start.utc.localeCompare(b.start.utc));
  const merged: FlarePeriod[] = [];
  for (const p of perArea) {
    const cur = merged[merged.length - 1];
    // SK-6: an open period is known only up to its last entry ("open at last entry"), so it overlaps what starts by then.
    if (cur && p.start.utc <= (cur.end ?? cur.lastEntryAt).utc) {
      for (const id of p.areaIds) if (!cur.areaIds.includes(id)) cur.areaIds.push(id);
      cur.end = cur.end === null || p.end === null ? null : cur.end.utc >= p.end.utc ? cur.end : p.end;
      if (p.lastEntryAt.utc > cur.lastEntryAt.utc) cur.lastEntryAt = p.lastEntryAt;
    } else merged.push({ ...p, areaIds: [...p.areaIds] });
  }
  return merged;
}
