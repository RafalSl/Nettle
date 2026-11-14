import { NettleError } from '../model/errors';
import { makeStamp } from '../model/time';
import {
  ALLERGENS,
  MEDICATION_CATEGORIES,
  type Allergen,
  type Drink,
  type MedicationCategory,
  type MedicationEntry,
} from '../model/types';
import type { Deps } from './deps';
import { refreshFavoriteDrink } from './preferences';

export interface LogDrinkInput {
  name: string;
  /** Whole millilitres, as poured. */
  amountMl: number;
  /** IN-4: marks an alcoholic drink; defaults to false. */
  alcohol?: boolean;
  ingredients?: string[];
  /** IN-10: allergen tags the user confirmed. */
  allergens?: Allergen[];
  at?: Date;
  note?: string;
}

/** IN-4: any beverage, with an alcohol switch and optional ingredients and allergen tags. */
export async function logDrink(deps: Deps, input: LogDrinkInput): Promise<Drink> {
  const name = input.name.trim();
  if (!name) throw new NettleError('empty_name');
  if (!Number.isInteger(input.amountMl) || input.amountMl <= 0) throw new NettleError('invalid_amount');
  const allergens = [...new Set(input.allergens ?? [])];
  for (const a of allergens) if (!ALLERGENS.includes(a)) throw new NettleError('invalid_value', a);
  const entry: Drink = {
    id: deps.ids(),
    at: makeStamp(deps.clock, input.at),
    name,
    amountMl: input.amountMl,
    alcohol: input.alcohol ?? false,
    ingredients: (input.ingredients ?? []).map((i) => i.trim()).filter(Boolean),
    allergens,
    note: input.note?.trim() || null,
  };
  await deps.repo.addRecord('drinks', entry);
  await refreshFavoriteDrink(deps, entry);
  return entry;
}

/** IN-5: a medication or supplement with an optional free-text dose. */
export async function logMedication(
  deps: Deps,
  input: { category: MedicationCategory; name: string; dose?: string; at?: Date; note?: string },
): Promise<MedicationEntry> {
  if (!MEDICATION_CATEGORIES.includes(input.category)) throw new NettleError('invalid_value', 'category');
  const name = input.name.trim();
  if (!name) throw new NettleError('empty_name');
  const entry: MedicationEntry = {
    id: deps.ids(),
    at: makeStamp(deps.clock, input.at),
    category: input.category,
    name,
    dose: input.dose?.trim() || null,
    note: input.note?.trim() || null,
  };
  await deps.repo.addRecord('medicationEntries', entry);
  return entry;
}
