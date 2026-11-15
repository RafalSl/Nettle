import { NettleError } from '../model/errors';
import {
  ALLERGENS,
  EXTRA_KINDS,
  LIST_KINDS,
  RECORD_KINDS,
  type ListItem,
  type Meal,
  type Payload,
  type Records,
  type SkinArea,
  type SkinEntry,
  type Tombstone,
} from '../model/types';
import { isScore } from '../usecases/skin';
import { EXTRA_CODECS } from './extras';
import { parsePreferences } from './preferencesJson';
import { parseBarcode, parseSource } from './sourceJson';
import { bad, bool, enumList, oneOf, isObj, list, nullableText, str, tz, unique, utc, type Obj } from './guards';
import { LIST_KEYS, recordWireKey, SCHEMA_VERSION } from './schema';

const obj = (o: Obj, k: string, where: string): Obj => (isObj(o[k]) ? (o[k] as Obj) : bad(`${where}.${k}`));
const section = (o: Obj, k: string): Obj | null => {
  const v = o[k];
  if (v === undefined) return null;
  return isObj(v) ? v : bad(k);
};

/**
 * Turns untrusted parsed JSON into a Payload, or throws a NettleError. Checks schema_version first (EX-10).
 * Sections are optional but at least one must be present. References from entries to areas are checked
 * when the import is applied, because a records-only file legitimately points at areas it does not contain.
 */
export function parseDataJson(raw: unknown): Payload {
  if (!isObj(raw)) return bad('root');
  const version = raw.schema_version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return bad('schema_version');
  }
  if (version > SCHEMA_VERSION) {
    throw new NettleError('import_unsupported_version', String(version));
  }

  const payload: Payload = {};

  const settings = section(raw, 'settings');
  if (settings) {
    const skinAreas: SkinArea[] = list(settings, 'skin_areas').map((o, i) => {
      const w = `settings.skin_areas[${i}]`;
      return {
        id: str(o, 'id', w),
        kind: oneOf(o, 'kind', ['skin', 'nail'] as const, w),
        name: str(o, 'name', w),
        predefined: bool(o, 'predefined', w),
        archived: bool(o, 'archived', w),
        sensitiveDefault: bool(o, 'sensitive_default', w),
        nameOverride: nullableText(o, 'name_override', w),
      };
    });
    unique(skinAreas.map((a) => a.id), 'settings.skin_areas');
    const lists = {} as Record<(typeof LIST_KINDS)[number], ListItem[]>;
    for (const kind of LIST_KINDS) {
      const key = LIST_KEYS[kind];
      lists[kind] = list(settings, key).map((o, i) => {
        const w = `settings.${key}[${i}]`;
        return {
          id: str(o, 'id', w),
          name: str(o, 'name', w),
          predefined: bool(o, 'predefined', w),
          archived: bool(o, 'archived', w),
          nameOverride: nullableText(o, 'name_override', w),
        };
      });
      unique(lists[kind].map((x) => x.id), `settings.${key}`);
    }
    payload.settings = { skinAreas, ...lists };
    payload.preferences = parsePreferences(obj(settings, 'preferences', 'settings'));
  }

  const records = section(raw, 'records');
  if (records) {
    const meals: Meal[] = list(records, 'meals').map((o, i) => {
      const w = `records.meals[${i}]`;
      const ing = o.ingredients;
      if (!Array.isArray(ing) || ing.some((x) => typeof x !== 'string')) bad(`${w}.ingredients`);
      return {
        id: str(o, 'id', w),
        at: { utc: utc(o, w), tz: tz(o, w) },
        description: str(o, 'description', w),
        ingredients: ing as string[],
        allergens: enumList(o, 'allergens', ALLERGENS, w),
        barcode: parseBarcode(o, w),
        source: parseSource(o, w),
        note: nullableText(o, 'note', w),
      };
    });
    const skinEntries: SkinEntry[] = list(records, 'skin_entries').map((o, i) => {
      const w = `records.skin_entries[${i}]`;
      const s = o.scores;
      if (!isObj(s)) return bad(`${w}.scores`);
      const scores = {
        severity: s.severity,
        itch: s.itch,
        pain: s.pain,
        dryness: s.dryness,
        scaling: s.scaling,
      };
      for (const [k, v] of Object.entries(scores)) if (!isScore(v)) bad(`${w}.scores.${k}`);
      return {
        id: str(o, 'id', w),
        at: { utc: utc(o, w), tz: tz(o, w) },
        areaId: str(o, 'area_id', w),
        scores: scores as SkinEntry['scores'],
        note: nullableText(o, 'note', w),
      };
    });
    unique(meals.map((m) => m.id), 'records.meals');
    unique(skinEntries.map((e) => e.id), 'records.skin_entries');
    const out = { meals, skinEntries } as Records;
    for (const kind of EXTRA_KINDS) {
      const codec = EXTRA_CODECS[kind];
      const rows = list(records, codec.key).map((o, i) =>
        (codec.parse as (o: Obj, w: string) => Records[typeof kind][number])(o, `records.${codec.key}[${i}]`),
      );
      unique(rows.map((r) => r.id), `records.${codec.key}`);
      Object.assign(out, { [kind]: rows });
    }
    payload.records = out;
    const kinds = new Map(RECORD_KINDS.map((k) => [recordWireKey(k), k]));
    payload.tombstones = list(records, 'tombstones').map((o, i): Tombstone => {
      const w = `records.tombstones[${i}]`;
      return {
        id: str(o, 'id', w),
        kind: kinds.get(oneOf(o, 'kind', [...kinds.keys()], w))!,
        deletedAt: { utc: utc(o, w), tz: tz(o, w) },
      };
    });
    unique(payload.tombstones.map((t) => t.id), 'records.tombstones');
  }

  if (!payload.records && !payload.settings) return bad('no records or settings section');
  return payload;
}
