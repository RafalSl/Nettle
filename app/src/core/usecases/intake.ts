import { NettleError } from '../model/errors';
import { makeStamp } from '../model/time';
import {
  MEDICATION_CATEGORIES,
  type AlcoholEntry,
  type MedicationCategory,
  type MedicationEntry,
} from '../model/types';
import type { Deps } from './deps';

/** IN-4: type and amount (whole millilitres of the drink, as poured). */
export async function logAlcohol(
  deps: Deps,
  input: { drink: string; amountMl: number; at?: Date; note?: string },
): Promise<AlcoholEntry> {
  const drink = input.drink.trim();
  if (!drink) throw new NettleError('empty_name');
  if (!Number.isInteger(input.amountMl) || input.amountMl <= 0) throw new NettleError('invalid_amount');
  const entry: AlcoholEntry = {
    id: deps.ids(),
    at: makeStamp(deps.clock, input.at),
    drink,
    amountMl: input.amountMl,
    note: input.note?.trim() || null,
  };
  await deps.repo.addRecord('alcoholEntries', entry);
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
