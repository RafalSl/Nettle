import { localDay } from '../model/time';
import { NAIL_EXTENTS, type FlareMarker, type LocalDay, type NailEntry, type Photo, type SkinArea, type SkinEntry } from '../model/types';
import type { Deps } from './deps';

/** SK-8: one skin or nail entry of an area with its photos, so scores and photos sit side by side. */
export type TimelineEntry =
  | { kind: 'skin'; entry: SkinEntry; photos: Photo[] }
  | { kind: 'nail'; entry: NailEntry; photos: Photo[] };

export interface TimelineDay {
  day: LocalDay;
  /** Oldest first within the day. */
  entries: TimelineEntry[];
  flares: FlareMarker[];
}

/** SK-8: the entries, photos and flare markers of one area grouped by the entry's own local day, newest day first. */
export async function areaTimeline(deps: Deps, areaId: string): Promise<TimelineDay[]> {
  const photos = await deps.repo.listRecords('photos');
  const photosOf = (kind: Photo['entryKind'], id: string) =>
    photos.filter((p) => p.entryKind === kind && p.entryId === id).sort((a, b) => a.at.utc.localeCompare(b.at.utc));
  const days = new Map<LocalDay, TimelineDay>();
  const dayOf = (day: LocalDay) => {
    const cur = days.get(day) ?? { day, entries: [], flares: [] };
    days.set(day, cur);
    return cur;
  };
  for (const entry of await deps.repo.listSkinEntries()) {
    if (entry.areaId === areaId) dayOf(localDay(entry.at.utc, entry.at.tz, deps.dayStart.get())).entries.push({ kind: 'skin', entry, photos: photosOf('skinEntry', entry.id) });
  }
  for (const entry of await deps.repo.listRecords('nailEntries')) {
    if (entry.areaId === areaId) dayOf(localDay(entry.at.utc, entry.at.tz, deps.dayStart.get())).entries.push({ kind: 'nail', entry, photos: photosOf('nailEntry', entry.id) });
  }
  for (const marker of await deps.repo.listRecords('flareMarkers')) {
    if (marker.areaId === areaId) dayOf(localDay(marker.at.utc, marker.at.tz, deps.dayStart.get())).flares.push(marker);
  }
  for (const d of days.values()) {
    d.entries.sort((a, b) => a.entry.at.utc.localeCompare(b.entry.at.utc) || a.entry.id.localeCompare(b.entry.id));
    d.flares.sort((a, b) => a.at.utc.localeCompare(b.at.utc));
  }
  return [...days.values()].sort((a, b) => b.day.localeCompare(a.day));
}

export interface AreaSummary {
  area: SkinArea;
  entries: number;
  lastDay: LocalDay;
}

/** SK-8: the areas that have skin or nail entries, the most recently logged first (archived ones too: history stays). */
export async function areasWithEntries(deps: Deps): Promise<AreaSummary[]> {
  const byArea = new Map<string, { entries: number; last: string; lastDay: LocalDay }>();
  for (const e of [...(await deps.repo.listSkinEntries()), ...(await deps.repo.listRecords('nailEntries'))]) {
    const cur = byArea.get(e.areaId) ?? { entries: 0, last: '', lastDay: '' };
    cur.entries++;
    if (e.at.utc > cur.last) Object.assign(cur, { last: e.at.utc, lastDay: localDay(e.at.utc, e.at.tz, deps.dayStart.get()) });
    byArea.set(e.areaId, cur);
  }
  const areas = new Map((await deps.repo.listAreas()).map((a) => [a.id, a]));
  return [...byArea.entries()]
    .flatMap(([id, v]) => (areas.has(id) ? [{ area: areas.get(id)!, entries: v.entries, lastDay: v.lastDay, last: v.last }] : []))
    .sort((a, b) => b.last.localeCompare(a.last))
    .map(({ area, entries, lastDay }) => ({ area, entries, lastDay }));
}

/** What a trend chart can plot: one of the five skin scores, or the extent of a nail entry (0 = none to 3 = over half). */
export type TrendKey = keyof SkinEntry['scores'] | 'extent';

export interface TrendPoint {
  day: LocalDay;
  /** The day's average (skin scores) or worst (nail extent), to one decimal. */
  value: number;
  /** A flare marker of the area on this day, for the chart's marks. */
  flare: 'start' | 'end' | null;
}

/**
 * SK-8, UX-1: the points of a trend chart, oldest day first, from the timeline of one area. A day with several skin
 * entries is averaged; a nail day takes its largest extent. Days without an entry of that kind are skipped.
 */
export function trendPoints(days: readonly TimelineDay[], key: TrendKey): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (const d of [...days].reverse()) {
    const values: number[] = [];
    for (const e of d.entries) {
      if (key === 'extent' && e.kind === 'nail') values.push(NAIL_EXTENTS.indexOf(e.entry.extent));
      if (key !== 'extent' && e.kind === 'skin') values.push(e.entry.scores[key]);
    }
    if (values.length === 0) continue;
    const value = key === 'extent' ? Math.max(...values) : values.reduce((a, b) => a + b, 0) / values.length;
    const last = d.flares[d.flares.length - 1];
    points.push({ day: d.day, value: Math.round(value * 10) / 10, flare: last ? last.kind : null });
  }
  return points;
}
