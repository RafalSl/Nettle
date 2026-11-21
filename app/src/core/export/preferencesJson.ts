import { isDayStartHour } from '../model/dayStart';
import { LANGUAGE_PREFERENCES, type LanguagePreference } from '../model/language';
import { ENTRY_TYPES, FLARE_SCOPES, MAX_SUGGESTION_ROWS, WINDOW_DAYS, type EntryType, type FlareScope, type Preferences, type RegularItem } from '../model/preferences';
import { ALLERGENS, MEDICATION_CATEGORIES } from '../model/types';
import { parseBarcode, parseSource, sourceToJson } from './sourceJson';
import { bad, bool, enumList, isObj, list, nullableText, oneOf, str, stringList, unique, type Obj } from './guards';

/** data.json form of the preferences (`settings.preferences`), snake_case like the rest of the file. */
/** SK-8: area id to a threshold of 1 to 10. */
function parseAreaThresholds(v: unknown, where: string): Record<string, number> {
  if (!isObj(v)) return bad(where);
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(v)) {
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 10) return bad(`${where}.${id}`);
    out[id] = n;
  }
  return out;
}

export function preferencesToJson(p: Preferences): Obj {
  return {
    favorites: {
      meals: p.favorites.meals.map((m) => ({ key: m.key, description: m.description, ingredients: [...m.ingredients], allergens: [...m.allergens], barcode: m.barcode, source: sourceToJson(m.source) })),
      drinks: p.favorites.drinks.map((a) => ({ key: a.key, name: a.name, amount_ml: a.amountMl, alcohol: a.alcohol, ingredients: [...a.ingredients], allergens: [...a.allergens], barcode: a.barcode, source: sourceToJson(a.source) })),
      medications: p.favorites.medications.map((m) => ({ key: m.key, category: m.category, name: m.name, dose: m.dose })),
    },
    suggestions: { rows: p.suggestions.rows, window_days: p.suggestions.windowDays, save_on_tap: p.suggestions.saveOnTap, known_names: p.suggestions.knownNames },
    quick_actions: { pinned: [...p.quickActions.pinned] },
    day_start_hour: p.dayStartHour,
    flare_threshold: p.flareThreshold,
    flare_scope: p.flareScope,
    flare_thresholds: { ...p.flareThresholdByArea },
    language: p.language,
    regular: p.regular.map((r) => ({ id: r.id, kind: r.kind, category: r.category, name: r.name, dose: r.dose, treatment_id: r.treatmentId, area_ids: [...r.areaIds], times: r.times.map((t) => ({ hour: t.hour, minute: t.minute })), hide_name: r.hideName })),
  };
}

const obj = (o: Obj, k: string, where: string): Obj => (isObj(o[k]) ? (o[k] as Obj) : bad(`${where}.${k}`));
const quickList = (o: Obj, k: string, where: string): EntryType[] => {
  const v = enumList(o, k, ENTRY_TYPES, where);
  unique(v, `${where}.${k}`);
  return v;
};

const int = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** IN-17: the regular items of the preferences, validated. */
function parseRegular(o: Obj, where: string): RegularItem[] {
  const raw = o.regular;
  if (!Array.isArray(raw)) return bad(`${where}.regular`);
  const items = raw.map((r: unknown, i): RegularItem => {
    const w = `${where}.regular[${i}]`;
    if (!isObj(r)) return bad(w);
    const kind = oneOf(r, 'kind', ['medication', 'treatment'] as const, w);
    const times = r.times;
    if (!Array.isArray(times) || times.length > 8) return bad(`${w}.times`);
    return {
      id: str(r, 'id', w),
      kind,
      category: kind === 'medication' ? oneOf(r, 'category', MEDICATION_CATEGORIES, w) : null,
      name: kind === 'medication' ? str(r, 'name', w) : null,
      dose: nullableText(r, 'dose', w),
      treatmentId: kind === 'treatment' ? str(r, 'treatment_id', w) : null,
      areaIds: kind === 'treatment' ? stringList(r, 'area_ids', w) : [],
      times: times.map((t: unknown, j) => (isObj(t) && int(t.hour, 0, 23) && int(t.minute, 0, 59) ? { hour: t.hour, minute: t.minute } : bad(`${w}.times[${j}]`))),
      hideName: bool(r, 'hide_name', w),
    };
  });
  unique(items.map((r) => r.id), `${where}.regular`);
  return items;
}

/** Turns the untrusted `settings.preferences` object into Preferences, or throws a NettleError. */
export function parsePreferences(o: Obj, where = 'settings.preferences'): Preferences {
  const fav = obj(o, 'favorites', where);
  const meals = list(fav, 'meals').map((m, i) => {
    const w = `${where}.favorites.meals[${i}]`;
    return { key: str(m, 'key', w), description: str(m, 'description', w), ingredients: Array.isArray(m.ingredients) ? stringList(m, 'ingredients', w) : bad(`${w}.ingredients`), allergens: enumList(m, 'allergens', ALLERGENS, w), barcode: parseBarcode(m, w), source: parseSource(m, w) };
  });
  const drinks = list(fav, 'drinks').map((a, i) => {
    const w = `${where}.favorites.drinks[${i}]`;
    const ml = a.amount_ml;
    return {
      key: str(a, 'key', w),
      name: str(a, 'name', w),
      amountMl: typeof ml === 'number' && Number.isInteger(ml) && ml > 0 ? ml : bad(`${w}.amount_ml`),
      alcohol: bool(a, 'alcohol', w),
      ingredients: Array.isArray(a.ingredients) ? stringList(a, 'ingredients', w) : bad(`${w}.ingredients`),
      allergens: enumList(a, 'allergens', ALLERGENS, w),
      barcode: parseBarcode(a, w),
      source: parseSource(a, w),
    };
  });
  const medications = list(fav, 'medications').map((m, i) => {
    const w = `${where}.favorites.medications[${i}]`;
    return { key: str(m, 'key', w), category: oneOf(m, 'category', MEDICATION_CATEGORIES, w), name: str(m, 'name', w), dose: nullableText(m, 'dose', w) };
  });
  unique(meals.map((m) => m.key), `${where}.favorites.meals`);
  unique(drinks.map((m) => m.key), `${where}.favorites.drinks`);
  unique(medications.map((m) => m.key), `${where}.favorites.medications`);

  const sg = obj(o, 'suggestions', where);
  const rows = sg.rows;
  const windowDays = sg.window_days;
  if (typeof rows !== 'number' || !Number.isInteger(rows) || rows < 1 || rows > MAX_SUGGESTION_ROWS) bad(`${where}.suggestions.rows`);
  if (!(WINDOW_DAYS as readonly unknown[]).includes(windowDays)) bad(`${where}.suggestions.window_days`);

  const qa = obj(o, 'quick_actions', where);
  const pinned = quickList(qa, 'pinned', `${where}.quick_actions`);
  return {
    favorites: { meals, drinks, medications },
    suggestions: { rows: rows as number, windowDays: windowDays as (typeof WINDOW_DAYS)[number], saveOnTap: bool(sg, 'save_on_tap', `${where}.suggestions`), knownNames: bool(sg, 'known_names', `${where}.suggestions`) },
    quickActions: { pinned },
    dayStartHour: isDayStartHour(o.day_start_hour) ? o.day_start_hour : bad(`${where}.day_start_hour`),
    regular: parseRegular(o, where),
    flareThreshold: typeof o.flare_threshold === 'number' && Number.isInteger(o.flare_threshold) && o.flare_threshold >= 1 && o.flare_threshold <= 10 ? o.flare_threshold : bad(`${where}.flare_threshold`),
    flareScope: FLARE_SCOPES.includes(o.flare_scope as never) ? (o.flare_scope as FlareScope) : bad(`${where}.flare_scope`),
    flareThresholdByArea: parseAreaThresholds(o.flare_thresholds, `${where}.flare_thresholds`),
    language: LANGUAGE_PREFERENCES.includes(o.language as never) ? (o.language as LanguagePreference) : bad(`${where}.language`),
  };
}
