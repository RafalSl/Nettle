import type { SkinEntry, Stamp } from './types';

/** SK-6: the default severity at or above which an entry counts as a flare. */
export const DEFAULT_FLARE_THRESHOLD = 8;

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
 * SK-6: flare periods from skin entries and a severity threshold, oldest first. Per area a period starts at the first
 * entry at or above the threshold and ends at the first later entry below it; overlapping periods of different
 * areas merge into one. Nail entries are not skin entries, so they never flare.
 */
export function deriveFlares(entries: readonly Pick<SkinEntry, 'id' | 'at' | 'areaId' | 'scores'>[], threshold: number): FlarePeriod[] {
  const perArea: FlarePeriod[] = [];
  const areas = new Set(entries.map((e) => e.areaId));
  for (const areaId of areas) {
    let open: FlarePeriod | null = null;
    for (const e of entries.filter((x) => x.areaId === areaId).sort(byTime)) {
      if (e.scores.severity >= threshold) {
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
    if (cur && (cur.end === null || p.start.utc <= cur.end.utc)) {
      for (const id of p.areaIds) if (!cur.areaIds.includes(id)) cur.areaIds.push(id);
      cur.end = cur.end === null || p.end === null ? null : cur.end.utc >= p.end.utc ? cur.end : p.end;
      if (p.lastEntryAt.utc > cur.lastEntryAt.utc) cur.lastEntryAt = p.lastEntryAt;
    } else merged.push({ ...p, areaIds: [...p.areaIds] });
  }
  return merged;
}
