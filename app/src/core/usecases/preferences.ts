import { isDayStartHour } from '../model/dayStart';
import { NettleError } from '../model/errors';
import {
  defaultPreferences,
  MAX_SUGGESTION_ROWS,
  QUICK_ACTIONS,
  WINDOW_DAYS,
  type Preferences,
  type QuickAction,
  type SuggestionSettings,
} from '../model/preferences';
import { drinkKey, normalizeText } from '../model/suggestions';
import type { Drink, Meal, MedicationEntry } from '../model/types';
import type { Deps } from './deps';

/** The stored preferences, or the defaults while the user never changed any. */
export async function getPreferences(deps: Deps): Promise<Preferences> {
  return (await deps.repo.getPreferences()) ?? defaultPreferences();
}

async function change(deps: Deps, edit: (p: Preferences) => void): Promise<Preferences> {
  const prefs = await getPreferences(deps);
  edit(prefs);
  await deps.repo.setPreferences(prefs);
  deps.dayStart.set(prefs.dayStartHour);
  return prefs;
}

/** NF-7: "Day starts at", a whole hour from 00:00 to 06:00. Changing it regroups the whole diary (the time of an entry never changes). */
export async function setDayStartHour(deps: Deps, hour: number): Promise<number> {
  if (!isDayStartHour(hour)) throw new NettleError('invalid_value', 'dayStartHour');
  return (await change(deps, (p) => void (p.dayStartHour = hour))).dayStartHour;
}

/** SK-6: the severity at or above which skin entries count as a flare, a whole number 1 to 10. Flares are recomputed from the entries. */
export async function setFlareThreshold(deps: Deps, threshold: number): Promise<number> {
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 10) throw new NettleError('invalid_value', 'flareThreshold');
  return (await change(deps, (p) => void (p.flareThreshold = threshold))).flareThreshold;
}

/** IN-14, UX-6: a favorite removed in Settings (the key is the suggestion identity). */
export async function removeFavorite(deps: Deps, kind: 'meals' | 'drinks' | 'medications', key: string): Promise<void> {
  await change(deps, (p) => {
    p.favorites[kind] = (p.favorites[kind] as { key: string }[]).filter((f) => f.key !== key) as never;
  });
}

/** NF-7: re-reads the stored setting after something replaced the preferences (an import). */
export async function reloadDayStart(deps: Deps): Promise<void> {
  deps.dayStart.set((await getPreferences(deps)).dayStartHour);
}

/** IN-14: rows 1 to 20, a window of 7, 14, 30 or 60 days, and "save on tap" (drinks and medication only). */
export async function updateSuggestionSettings(deps: Deps, patch: Partial<SuggestionSettings>): Promise<SuggestionSettings> {
  if (patch.rows !== undefined && (!Number.isInteger(patch.rows) || patch.rows < 1 || patch.rows > MAX_SUGGESTION_ROWS)) {
    throw new NettleError('invalid_value', 'rows');
  }
  if (patch.windowDays !== undefined && !WINDOW_DAYS.includes(patch.windowDays)) throw new NettleError('invalid_value', 'windowDays');
  return (await change(deps, (p) => void Object.assign(p.suggestions, patch))).suggestions;
}

const toggle = <T extends { key: string }>(list: T[], item: T): T[] =>
  list.some((x) => x.key === item.key) ? list.filter((x) => x.key !== item.key) : [...list, item];

/** IN-14: star or unstar a meal. The favorite is a snapshot of description, ingredients and allergen tags. */
export async function toggleFavoriteMeal(deps: Deps, meal: MealSnapshot): Promise<boolean> {
  const key = normalizeText(meal.description);
  const prefs = await change(deps, (p) => {
    p.favorites.meals = toggle(p.favorites.meals, mealSnapshot(meal));
  });
  return prefs.favorites.meals.some((m) => m.key === key);
}

/** IN-14: a favorite drink is a snapshot of name, amount, alcohol switch, ingredients and allergen tags. */
export type MealSnapshot = Pick<Meal, 'description' | 'ingredients' | 'allergens' | 'barcode' | 'source'>;
export type DrinkSnapshot = Pick<Drink, 'name' | 'amountMl' | 'alcohol' | 'ingredients' | 'allergens' | 'barcode' | 'source'>;

const mealSnapshot = (m: MealSnapshot) => ({
  key: normalizeText(m.description),
  description: m.description,
  ingredients: [...m.ingredients],
  allergens: [...m.allergens],
  barcode: m.barcode,
  source: structuredClone(m.source),
});

const drinkSnapshot = (e: DrinkSnapshot) => ({
  key: drinkKey(e),
  name: e.name,
  amountMl: e.amountMl,
  alcohol: e.alcohol,
  ingredients: [...e.ingredients],
  allergens: [...e.allergens],
  barcode: e.barcode,
  source: structuredClone(e.source),
});

export async function toggleFavoriteDrink(deps: Deps, e: DrinkSnapshot): Promise<boolean> {
  const snap = drinkSnapshot(e);
  const prefs = await change(deps, (p) => {
    p.favorites.drinks = toggle(p.favorites.drinks, snap);
  });
  return prefs.favorites.drinks.some((m) => m.key === snap.key);
}

/** Like `refreshFavoriteMeal`: a saved drink that is a favorite updates the snapshot, otherwise nothing is touched. */
export async function refreshFavoriteDrink(deps: Deps, drink: Drink): Promise<void> {
  const snap = drinkSnapshot(drink);
  const prefs = await deps.repo.getPreferences();
  if (!prefs?.favorites.drinks.some((m) => m.key === snap.key)) return;
  prefs.favorites.drinks = prefs.favorites.drinks.map((m) => (m.key === snap.key ? snap : m));
  await deps.repo.setPreferences(prefs);
}

export async function toggleFavoriteMedication(deps: Deps, e: Pick<MedicationEntry, 'category' | 'name' | 'dose'>): Promise<boolean> {
  const key = `${e.category}|${normalizeText(e.name)}|${normalizeText(e.dose ?? '')}`;
  const prefs = await change(deps, (p) => {
    p.favorites.medications = toggle(p.favorites.medications, { key, category: e.category, name: e.name, dose: e.dose });
  });
  return prefs.favorites.medications.some((m) => m.key === key);
}

/**
 * IN-14: "a favorite stores a snapshot ... updated whenever that meal is saved". Called after a meal is saved;
 * touches nothing (not even the stored preferences) when the meal is not a favorite.
 */
export async function refreshFavoriteMeal(deps: Deps, meal: Meal): Promise<void> {
  const key = normalizeText(meal.description);
  const prefs = await deps.repo.getPreferences();
  if (!prefs?.favorites.meals.some((m) => m.key === key)) return;
  prefs.favorites.meals = prefs.favorites.meals.map((m) =>
    m.key === key ? mealSnapshot(meal) : m,
  );
  await deps.repo.setPreferences(prefs);
}

/** UX-2: move a quick action up (-1) or down (+1) in the order; at either end nothing changes. */
export async function moveQuickAction(deps: Deps, id: QuickAction, delta: -1 | 1): Promise<QuickAction[]> {
  if (!QUICK_ACTIONS.includes(id)) throw new NettleError('invalid_value', id);
  return (
    await change(deps, (p) => {
      const order = p.quickActions.order;
      const i = order.indexOf(id);
      const j = i + delta;
      if (i >= 0 && j >= 0 && j < order.length) [order[i], order[j]] = [order[j]!, order[i]!];
    })
  ).quickActions.order;
}

/** UX-2: hide or show a quick action. More stays: it is the way to every rarer entry. */
export async function setQuickActionHidden(deps: Deps, id: QuickAction, hidden: boolean): Promise<QuickAction[]> {
  if (!QUICK_ACTIONS.includes(id) || (hidden && id === 'more')) throw new NettleError('invalid_value', id);
  return (
    await change(deps, (p) => {
      p.quickActions.hidden = hidden ? [...new Set([...p.quickActions.hidden, id])] : p.quickActions.hidden.filter((x) => x !== id);
    })
  ).quickActions.hidden;
}

/** UX-2: the quick actions Today shows, in order. */
export const visibleQuickActions = (p: Preferences): QuickAction[] => p.quickActions.order.filter((a) => !p.quickActions.hidden.includes(a));
