import { NettleError } from '../model/errors';
import { makeStamp } from '../model/time';
import type { Meal } from '../model/types';
import type { Deps } from './deps';

export interface LogMealInput {
  description: string;
  ingredients: string[];
  /** Editable timestamp so past meals can be added; defaults to now. */
  at?: Date;
  note?: string;
}

/** IN-1: free-text description plus editable ingredient list. */
export async function logMeal(deps: Deps, input: LogMealInput): Promise<Meal> {
  const description = input.description.trim();
  if (!description) throw new NettleError('empty_description');
  const meal: Meal = {
    id: deps.ids(),
    at: makeStamp(deps.clock, input.at),
    description,
    ingredients: input.ingredients.map((i) => i.trim()).filter(Boolean),
    note: input.note?.trim() || null,
  };
  await deps.repo.addMeal(meal);
  return meal;
}
