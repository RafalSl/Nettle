import { EXTRA_KINDS, LIST_KINDS, type DateRange, type Parts, type RecordKind, type Snapshot, type Tombstone } from '../model/types';
import { EXTRA_CODECS } from './extras';

/** Bump on any breaking change to data.json (EX-1). */
export const SCHEMA_VERSION = 1;

export interface MealJson {
  id: string;
  utc: string;
  tz: string;
  description: string;
  ingredients: string[];
  allergens: string[];
  note: string | null;
}

export interface SkinEntryJson {
  id: string;
  utc: string;
  tz: string;
  area_id: string;
  scores: { severity: number; itch: number; pain: number; dryness: number; scaling: number };
  note: string | null;
}

export interface SkinAreaJson {
  id: string;
  kind: 'skin' | 'nail';
  name: string;
  predefined: boolean;
  archived: boolean;
  sensitive_default: boolean;
  name_override: string | null;
}

/**
 * The wire format is the platform-neutral contract, so it is snake_case and independent of the in-app model.
 * `records` and `settings` are separate sections; either may be absent (EX-1).
 */
export interface DataJson {
  schema_version: number;
  exported_at: { utc: string; tz: string };
  range: { from: string | null; to: string | null };
  /** meals and skin_entries plus one array per flat record kind (see export/extras.ts). */
  records?: { meals: MealJson[]; skin_entries: SkinEntryJson[]; [kind: string]: unknown[] };
  /** skin_areas plus one array per list kind (daily_tags, ...). */
  settings?: { skin_areas: SkinAreaJson[]; [list: string]: unknown[] };
}

/** Array name inside `settings` for each list kind. */
export const LIST_KEYS = { dailyTags: 'daily_tags', treatments: 'treatments' } as const;

/** Name of a record kind in data.json (the array name inside `records`), used by tombstones. */
export const recordWireKey = (kind: RecordKind): string =>
  kind === 'meals' ? 'meals' : kind === 'skinEntries' ? 'skin_entries' : EXTRA_CODECS[kind].key;

/** `tombstones` are all of them, whatever the range: they are small and a merge elsewhere needs them (EX-13). */
export function toDataJson(
  snap: Snapshot,
  range: DateRange,
  exportedAt: { utc: string; tz: string },
  parts: Parts,
  tombstones: Tombstone[] = [],
): DataJson {
  return {
    schema_version: SCHEMA_VERSION,
    exported_at: exportedAt,
    range: { from: range.from ?? null, to: range.to ?? null },
    ...(parts.records && {
      records: {
        meals: snap.meals.map((m) => ({
          id: m.id,
          utc: m.at.utc,
          tz: m.at.tz,
          description: m.description,
          ingredients: [...m.ingredients],
          allergens: [...m.allergens],
          note: m.note,
        })),
        skin_entries: snap.skinEntries.map((e) => ({
          id: e.id,
          utc: e.at.utc,
          tz: e.at.tz,
          area_id: e.areaId,
          scores: { ...e.scores },
          note: e.note,
        })),
        ...Object.fromEntries(
          EXTRA_KINDS.map((k) => [EXTRA_CODECS[k].key, snap[k].map((r) => (EXTRA_CODECS[k].toJson as (r: unknown) => unknown)(r))]),
        ),
        tombstones: tombstones.map((t) => ({
          id: t.id,
          kind: recordWireKey(t.kind),
          utc: t.deletedAt.utc,
          tz: t.deletedAt.tz,
        })),
      },
    }),
    ...(parts.settings && {
      settings: {
        skin_areas: snap.skinAreas.map((a) => ({
          id: a.id,
          kind: a.kind,
          name: a.name,
          predefined: a.predefined,
          archived: a.archived,
          sensitive_default: a.sensitiveDefault,
          name_override: a.nameOverride,
        })),
        ...Object.fromEntries(
          LIST_KINDS.map((k) => [
            LIST_KEYS[k],
            snap[k].map((i) => ({
              id: i.id,
              name: i.name,
              predefined: i.predefined,
              archived: i.archived,
              name_override: i.nameOverride,
            })),
          ]),
        ),
      },
    }),
  };
}
