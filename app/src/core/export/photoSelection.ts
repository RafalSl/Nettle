import { localDay } from '../model/time';
import type { DateRange, Photo, SkinArea } from '../model/types';

/** EX-7: which photos go into an export. */
export type PhotoSelection =
  | { mode: 'all' | 'none' | 'non_sensitive' }
  /** Exactly these photos, chosen one by one. */
  | { mode: 'custom'; ids: readonly string[] }
  /** Photos of some areas and/or inside a date range. Sensitive photos only when `includeSensitive` is set. */
  | { mode: 'filter'; areaIds?: readonly string[]; range?: DateRange; includeSensitive: boolean };

/** EX-7: the default excludes sensitive photos. */
export const DEFAULT_PHOTO_SELECTION: PhotoSelection = { mode: 'non_sensitive' };

export function selectPhotos(
  photos: readonly Photo[],
  selection: PhotoSelection,
  areaOfPhoto: (photo: Photo) => string | undefined = () => undefined,
): Photo[] {
  switch (selection.mode) {
    case 'all':
      return [...photos];
    case 'none':
      return [];
    case 'non_sensitive':
      return photos.filter((p) => !p.sensitive);
    case 'custom': {
      const ids = new Set(selection.ids);
      return photos.filter((p) => ids.has(p.id));
    }
    case 'filter': {
      const ids = new Set(filterPhotoIds(photos, areaOfPhoto, selection));
      return photos.filter((p) => ids.has(p.id) && (selection.includeSensitive || !p.sensitive));
    }
  }
}

/**
 * EX-7: ids of the photos that match an area and/or a date range, to build a custom selection from. The area
 * of a photo is the area of the entry it belongs to; the range applies to the photo's own time.
 */
export function filterPhotoIds(
  photos: readonly Photo[],
  areaOfPhoto: (photo: Photo) => string | undefined,
  filter: { areaIds?: readonly string[]; range?: DateRange },
): string[] {
  const { areaIds, range } = filter;
  return photos
    .filter((p) => !areaIds || areaIds.includes(areaOfPhoto(p) ?? ''))
    .filter((p) => (!range?.from || p.at.utc >= range.from) && (!range?.to || p.at.utc <= range.to))
    .map((p) => p.id);
}

/**
 * EX-2: predictable names such as `photos/2026-11-11_chin_01.jpg`, one counter per day and label. File names
 * stay readable even in an encrypted ZIP, so they reveal little: predefined areas use their short id, user
 * areas and nails a generic word, and sensitive photos only "private".
 */
export function planPhotoNames(
  photos: readonly Photo[],
  areaOfPhoto: (photo: Photo) => SkinArea | undefined,
): Map<string, string> {
  const label = (p: Photo) => {
    if (p.sensitive) return 'private';
    const area = areaOfPhoto(p);
    if (!area) return 'photo';
    if (area.kind === 'nail') return 'nail';
    return area.predefined ? area.id.replace(/^area-/, '') : 'skin';
  };
  const ordered = [...photos].sort((a, b) => a.at.utc.localeCompare(b.at.utc) || a.id.localeCompare(b.id));
  const counters = new Map<string, number>();
  const names = new Map<string, string>();
  for (const p of ordered) {
    const base = `${localDay(p.at.utc, p.at.tz)}_${label(p)}`;
    const n = (counters.get(base) ?? 0) + 1;
    counters.set(base, n);
    names.set(p.id, `photos/${base}_${String(n).padStart(2, '0')}.jpg`);
  }
  return names;
}
