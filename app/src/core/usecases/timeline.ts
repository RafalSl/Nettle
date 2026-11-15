import { localDay } from '../model/time';
import { deriveFlares } from '../model/flares';
import { NAIL_EXTENTS, type ListItem, type LocalDay, type NailEntry, type Stamp, type Photo, type SkinArea, type SkinEntry } from '../model/types';
import type { Deps } from './deps';
import { getPreferences } from './preferences';
import { openFlare } from './flares';

/** SK-8: one skin or nail entry of an area with its photos, so scores and photos sit side by side. */
export type TimelineEntry =
  | { kind: 'skin'; entry: SkinEntry; photos: Photo[] }
  | { kind: 'nail'; entry: NailEntry; photos: Photo[] };

export interface TimelineDay {
  day: LocalDay;
  /** Oldest first within the day. */
  entries: TimelineEntry[];
  /** SK-6: the start and end of this area's derived flares that fall on the day. */
  flares: { id: string; kind: 'start' | 'end'; at: Stamp }[];
}

/** SK-8: the entries, photos and derived flare marks of one area grouped by the entry's own local day, newest day first. */
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
  const threshold = (await getPreferences(deps)).flareThreshold;
  const skin = (await deps.repo.listSkinEntries()).filter((e) => e.areaId === areaId);
  for (const f of deriveFlares(skin, threshold)) {
    dayOf(localDay(f.start.utc, f.start.tz, deps.dayStart.get())).flares.push({ id: `start-${f.start.utc}`, kind: 'start', at: f.start });
    if (f.end) dayOf(localDay(f.end.utc, f.end.tz, deps.dayStart.get())).flares.push({ id: `end-${f.end.utc}`, kind: 'end', at: f.end });
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
  /** A derived flare start or end of the area on this day, for the chart's marks. */
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

export interface AreaOverviewRow {
  area: SkinArea;
  /** The date of the last entry, or null while the area has none. */
  lastDay: LocalDay | null;
  /** Skin areas: the severity of the last entry. */
  severity: number | null;
  /** Nail areas: the stage and extent of the last entry. */
  stage: NailEntry['stage'] | null;
  extent: NailEntry['extent'] | null;
  /** The area is part of the open flare (SK-6). */
  flaring: boolean;
}

/**
 * UX-10: the active skin areas and nail areas, each with its last score or stage and the date of that entry. Areas
 * of the open flare come first, then the most recently logged; archived areas are hidden (their history stays on
 * their timeline and in the report).
 */
export async function areaOverview(deps: Deps): Promise<{ skin: AreaOverviewRow[]; nails: AreaOverviewRow[] }> {
  const start = deps.dayStart.get();
  const skin = await deps.repo.listSkinEntries();
  const nails = await deps.repo.listRecords('nailEntries');
  const flaring = new Set((await openFlare(deps))?.areaIds ?? []);
  const row = (area: SkinArea): AreaOverviewRow & { last: string } => {
    const s = skin.filter((e) => e.areaId === area.id).sort((a, b) => b.at.utc.localeCompare(a.at.utc))[0];
    const n = nails.filter((e) => e.areaId === area.id).sort((a, b) => b.at.utc.localeCompare(a.at.utc))[0];
    const last = area.kind === 'nail' ? n : s;
    return {
      area,
      last: last?.at.utc ?? '',
      lastDay: last ? localDay(last.at.utc, last.at.tz, start) : null,
      severity: area.kind === 'skin' ? (s?.scores.severity ?? null) : null,
      stage: area.kind === 'nail' ? (n?.stage ?? null) : null,
      extent: area.kind === 'nail' ? (n?.extent ?? null) : null,
      flaring: flaring.has(area.id),
    };
  };
  const rows = (await deps.repo.listAreas()).filter((a) => !a.archived).map(row);
  const order = (a: { flaring: boolean; last: string }, b: { flaring: boolean; last: string }) => Number(b.flaring) - Number(a.flaring) || b.last.localeCompare(a.last);
  const strip = ({ last: _last, ...rest }: AreaOverviewRow & { last: string }): AreaOverviewRow => rest;
  return {
    skin: rows.filter((r) => r.area.kind === 'skin').sort(order).map(strip),
    nails: rows.filter((r) => r.area.kind === 'nail').sort(order).map(strip),
  };
}

/** SK-7, UX-1: the score items that have at least one value (archived ones keep their history), for the Daily health trends. */
export async function trendScoreItems(deps: Deps): Promise<ListItem[]> {
  const used = new Set((await deps.repo.listRecords('checkIns')).flatMap((c) => Object.entries(c.values).filter(([, v]) => typeof v === 'number').map(([id]) => id)));
  return (await deps.repo.listItems('dailyItems')).filter((i) => i.valueKind === 'score' && used.has(i.id));
}

/** SK-7, UX-1: the points of a trend chart for one Daily health score item, oldest day first. Days without a value are skipped. */
export async function healthTrendPoints(deps: Deps, itemId: string): Promise<TrendPoint[]> {
  return (await deps.repo.listRecords('checkIns'))
    .flatMap((c) => (typeof c.values[itemId] === 'number' ? [{ day: c.day, value: c.values[itemId] as number, flare: null }] : []))
    .sort((a, b) => a.day.localeCompare(b.day));
}
