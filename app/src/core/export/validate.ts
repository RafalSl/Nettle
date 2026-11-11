import { NettleError } from '../model/errors';
import { CANONICAL_UTC } from '../model/time';
import type { Meal, SkinArea, SkinEntry, Snapshot } from '../model/types';
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

/** Turns untrusted parsed JSON into a Snapshot, or throws a NettleError. Checks schema_version first (EX-10). */
export function parseDataJson(raw: unknown): Snapshot {
  if (!isObj(raw)) return bad('root');
  const version = raw.schema_version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return bad('schema_version');
  }
  if (version > SCHEMA_VERSION) {
    throw new NettleError('import_unsupported_version', String(version));
  }

  const skinAreas: SkinArea[] = list(raw, 'skin_areas').map((o, i) => {
    const w = `skin_areas[${i}]`;
    return {
      id: str(o, 'id', w),
      name: str(o, 'name', w),
      predefined: bool(o, 'predefined', w),
      archived: bool(o, 'archived', w),
      sensitiveDefault: bool(o, 'sensitive_default', w),
    };
  });
  const meals: Meal[] = list(raw, 'meals').map((o, i) => {
    const w = `meals[${i}]`;
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
  const areaIds = new Set(skinAreas.map((a) => a.id));
  const skinEntries: SkinEntry[] = list(raw, 'skin_entries').map((o, i) => {
    const w = `skin_entries[${i}]`;
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
    const areaId = str(o, 'area_id', w);
    if (!areaIds.has(areaId)) bad(`${w}.area_id unknown`);
    return {
      id: str(o, 'id', w),
      at: { utc: utc(o, w), tz: str(o, 'tz', w) },
      areaId,
      scores: scores as SkinEntry['scores'],
      note: nullableText(o, 'note', w),
    };
  });
  unique(skinAreas.map((a) => a.id), 'skin_areas');
  unique(meals.map((m) => m.id), 'meals');
  unique(skinEntries.map((e) => e.id), 'skin_entries');
  return { meals, skinAreas, skinEntries };
}
