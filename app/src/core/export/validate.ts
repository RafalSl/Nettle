import { NettleError } from '../model/errors';
import { CANONICAL_UTC } from '../model/time';
import type { Meal, Payload, SkinArea, SkinEntry } from '../model/types';
import { isScore } from '../usecases/skin';
import { SCHEMA_VERSION } from './schema';

type Obj = Record<string, unknown>;

const bad = (detail: string): never => {
  throw new NettleError('import_invalid_data', detail);
};
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (o: Obj, k: string, where: string): string =>
  typeof o[k] === 'string' && (o[k] as string).length > 0 ? (o[k] as string) : bad(`${where}.${k}`);
const text = (o: Obj, k: string, where: string): string =>
  typeof o[k] === 'string' ? (o[k] as string) : bad(`${where}.${k}`);
const bool = (o: Obj, k: string, where: string): boolean =>
  typeof o[k] === 'boolean' ? (o[k] as boolean) : bad(`${where}.${k}`);
const nullableText = (o: Obj, k: string, where: string): string | null =>
  o[k] === null || o[k] === undefined ? null : text(o, k, where);
const utc = (o: Obj, where: string): string => {
  const v = str(o, 'utc', where);
  return CANONICAL_UTC.test(v) && !Number.isNaN(Date.parse(v)) ? v : bad(`${where}.utc`);
};
const list = (o: Obj, k: string): Obj[] => {
  const v = o[k];
  if (!Array.isArray(v)) return bad(k);
  return v.map((x, i) => (isObj(x) ? x : bad(`${k}[${i}]`)));
};
const unique = (ids: string[], where: string) => {
  if (new Set(ids).size !== ids.length) bad(`${where} duplicate id`);
};

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
        name: str(o, 'name', w),
        predefined: bool(o, 'predefined', w),
        archived: bool(o, 'archived', w),
        sensitiveDefault: bool(o, 'sensitive_default', w),
        nameOverride: nullableText(o, 'name_override', w),
      };
    });
    unique(skinAreas.map((a) => a.id), 'settings.skin_areas');
    payload.settings = { skinAreas };
  }

  const records = section(raw, 'records');
  if (records) {
    const meals: Meal[] = list(records, 'meals').map((o, i) => {
      const w = `records.meals[${i}]`;
      const ing = o.ingredients;
      if (!Array.isArray(ing) || ing.some((x) => typeof x !== 'string')) bad(`${w}.ingredients`);
      return {
        id: str(o, 'id', w),
        at: { utc: utc(o, w), tz: str(o, 'tz', w) },
        description: str(o, 'description', w),
        ingredients: ing as string[],
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
        at: { utc: utc(o, w), tz: str(o, 'tz', w) },
        areaId: str(o, 'area_id', w),
        scores: scores as SkinEntry['scores'],
        note: nullableText(o, 'note', w),
      };
    });
    unique(meals.map((m) => m.id), 'records.meals');
    unique(skinEntries.map((e) => e.id), 'records.skin_entries');
    payload.records = { meals, skinEntries };
  }

  if (!payload.records && !payload.settings) return bad('no records or settings section');
  return payload;
}
