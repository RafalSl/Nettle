import { NettleError } from '../model/errors';
import { assertSource, typedSource, type IngredientSource } from '../model/source';
import { ALLERGENS, type Allergen, type Meal } from '../model/types';
import type { Deps } from './deps';
import { refreshFavoriteMeal } from './preferences';
import { entryId, entryStamp, saveEntry, type EntryWrite } from './write';

export interface LogMealInput {
  description: string;
  ingredients: string[];
  /** IN-10: allergen tags the user confirmed (see suggestAllergens for suggestions). */
  allergens?: Allergen[];
  /** Editable timestamp so past meals can be added; defaults to now. */
  at?: Date;
  note?: string;
  /** IN-2: the barcode the meal was made from. */
  barcode?: string | null;
  /** IN-16: where the ingredients and tags came from; typed when left out. */
  source?: IngredientSource;
  /** IN-20: wait for an AI fill (the next pack asks for it). */
  fillLater?: boolean;
}

/** IN-1: free-text description plus editable ingredient list. */
export async function logMeal(deps: Deps, input: LogMealInput, w: EntryWrite = {}): Promise<Meal> {
  const description = input.description.trim();
  if (!description) throw new NettleError('empty_description');
  const allergens = [...new Set(input.allergens ?? [])];
  for (const a of allergens) if (!ALLERGENS.includes(a)) throw new NettleError('invalid_value', a);
  const source = input.source ?? typedSource();
  assertSource(source);
  const meal: Meal = {
    id: entryId(deps, w),
    at: entryStamp(deps, input.at, w),
    description,
    ingredients: input.ingredients.map((i) => i.trim()).filter(Boolean),
    allergens,
    barcode: input.barcode ?? null,
    source,
    ...(input.fillLater ? { fillLater: true as const } : {}),
    note: input.note?.trim() || null,
  };
  await saveEntry(deps, 'meals', meal, w);
  await refreshFavoriteMeal(deps, meal);
  return meal;
}
