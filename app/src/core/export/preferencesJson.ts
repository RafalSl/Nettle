import { isDayStartHour } from '../model/dayStart';
import { QUICK_ACTIONS, MAX_SUGGESTION_ROWS, WINDOW_DAYS, type Preferences, type QuickAction } from '../model/preferences';
import { ALLERGENS, MEDICATION_CATEGORIES } from '../model/types';
import { parseBarcode, parseSource, sourceToJson } from './sourceJson';
import { bad, bool, enumList, isObj, list, nullableText, oneOf, str, stringList, unique, type Obj } from './guards';

/** data.json form of the preferences (`settings.preferences`), snake_case like the rest of the file. */
export function preferencesToJson(p: Preferences): Obj {
  return {
    favorites: {
      meals: p.favorites.meals.map((m) => ({ key: m.key, description: m.description, ingredients: [...m.ingredients], allergens: [...m.allergens], barcode: m.barcode, source: sourceToJson(m.source) })),
      drinks: p.favorites.drinks.map((a) => ({ key: a.key, name: a.name, amount_ml: a.amountMl, alcohol: a.alcohol, ingredients: [...a.ingredients], allergens: [...a.allergens], barcode: a.barcode, source: sourceToJson(a.source) })),
      medications: p.favorites.medications.map((m) => ({ key: m.key, category: m.category, name: m.name, dose: m.dose })),
    },
    suggestions: { rows: p.suggestions.rows, window_days: p.suggestions.windowDays, save_on_tap: p.suggestions.saveOnTap, known_names: p.suggestions.knownNames },
    quick_actions: { order: [...p.quickActions.order], hidden: [...p.quickActions.hidden] },
    day_start_hour: p.dayStartHour,
    flare_threshold: p.flareThreshold,
  };
}

const obj = (o: Obj, k: string, where: string): Obj => (isObj(o[k]) ? (o[k] as Obj) : bad(`${where}.${k}`));
const quickList = (o: Obj, k: string, where: string): QuickAction[] => {
  const v = enumList(o, k, QUICK_ACTIONS, where);
  unique(v, `${where}.${k}`);
  return v;
};

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
  const order = quickList(qa, 'order', `${where}.quick_actions`);
  const hidden = quickList(qa, 'hidden', `${where}.quick_actions`);
  return {
    favorites: { meals, drinks, medications },
    suggestions: { rows: rows as number, windowDays: windowDays as (typeof WINDOW_DAYS)[number], saveOnTap: bool(sg, 'save_on_tap', `${where}.suggestions`), knownNames: bool(sg, 'known_names', `${where}.suggestions`) },
    quickActions: { order, hidden },
    dayStartHour: isDayStartHour(o.day_start_hour) ? o.day_start_hour : bad(`${where}.day_start_hour`),
    flareThreshold: typeof o.flare_threshold === 'number' && Number.isInteger(o.flare_threshold) && o.flare_threshold >= 1 && o.flare_threshold <= 10 ? o.flare_threshold : bad(`${where}.flare_threshold`),
  };
}
