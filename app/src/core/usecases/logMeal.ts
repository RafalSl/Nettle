import { NettleError } from '../model/errors';
import { makeStamp } from '../model/time';
import { ALLERGENS, type Allergen, type Meal } from '../model/types';
import type { Deps } from './deps';
import { refreshFavoriteMeal } from './preferences';

export interface LogMealInput {
  description: string;
  ingredients: string[];
  /** IN-10: allergen tags the user confirmed (see suggestAllergens for suggestions). */
  allergens?: Allergen[];
  /** Editable timestamp so past meals can be added; defaults to now. */
  at?: Date;
  note?: string;
}

/** IN-1: free-text description plus editable ingredient list. */
export async function logMeal(deps: Deps, input: LogMealInput): Promise<Meal> {
  const description = input.description.trim();
  if (!description) throw new NettleError('empty_description');
  const allergens = [...new Set(input.allergens ?? [])];
  for (const a of allergens) if (!ALLERGENS.includes(a)) throw new NettleError('invalid_value', a);
  const meal: Meal = {
    id: deps.ids(),
    at: makeStamp(deps.clock, input.at),
    description,
    ingredients: input.ingredients.map((i) => i.trim()).filter(Boolean),
    allergens,
    note: input.note?.trim() || null,
  };
  await deps.repo.addMeal(meal);
  await refreshFavoriteMeal(deps, meal);
  return meal;
}
