import { planEntryDeletion } from '../model/deletion';
import { NettleError } from '../model/errors';
import { localDay, makeStamp } from '../model/time';
import type {
  Drink,
  CheckIn,
  Meal,
  MedicationEntry,
  NailEntry,
  Reaction,
  RecordKind,
  Records,
  SkinEntry,
  Stamp,
  StoolEntry,
  TreatmentApplication,
  ChangeEvent,
  MedicalEvent,
} from '../model/types';
import { cleanValues, logStool, type CheckInInput } from './checkin';
import type { Deps } from './deps';
import type { EntryWrite } from './write';
import {
  applyTreatment,
  logChangeEvent,
  logMedicalEvent,
  logReaction,
  type ApplyTreatmentInput,
  type ChangeEventInput,
  type MedicalEventInput,
  type ReactionInput,
} from './events';
import { afterEdit, sameIngredients } from '../model/source';
import { logDrink, logMedication, type LogDrinkInput } from './intake';
import { logMeal, type LogMealInput } from './logMeal';
import { logNailEntry, logSkinEntry, type LogNailEntryInput, type LogSkinEntryInput } from './skin';

/** The record of a kind with this id, or a NettleError('unknown_entry'). */
export async function getEntry<K extends RecordKind>(deps: Deps, kind: K, id: string): Promise<Records[K][number]> {
  const found = await deps.repo.getRecord(kind, id);
  if (!found) throw new NettleError('unknown_entry', `${kind}/${id}`);
  return found;
}

const cleanList = (l: readonly string[]) => l.map((i) => i.trim()).filter(Boolean);

/**
 * EN-1: how an edit writes through the matching `log*` use case, so it keeps that use case's rules: the id stays,
 * the record is replaced, an unchanged time keeps its stamp (and so its time zone), and the areas or items the
 * entry already uses stay allowed after they were archived (archived, not deleted).
 */
const editOf = (orig: { id: string; at: Stamp }, at: Date | undefined, used: string[] = []): EntryWrite => ({
  id: orig.id,
  ...(at ? {} : { keepAt: orig.at }),
  allowArchived: new Set(used),
});

/** EN-1: edit a meal. Its time cannot move after one of its reactions. */
export async function editMeal(deps: Deps, id: string, input: LogMealInput): Promise<Meal> {
  const orig = await getEntry(deps, 'meals', id);
  const at = input.at ? makeStamp(deps.clock, input.at) : orig.at;
  for (const r of await deps.repo.listRecords('reactions')) {
    if (r.mealId === id && r.at.utc < at.utc) throw new NettleError('meal_after_reaction', id);
  }
  const changed = !sameIngredients(orig, { ingredients: cleanList(input.ingredients), allergens: input.allergens ?? [] });
  return logMeal(deps, { ...input, barcode: orig.barcode, source: afterEdit(orig.source, changed) }, editOf(orig, input.at));
}

export async function editSkinEntry(deps: Deps, id: string, input: LogSkinEntryInput): Promise<SkinEntry> {
  const orig = await getEntry(deps, 'skinEntries', id);
  return logSkinEntry(deps, input, editOf(orig, input.at, [orig.areaId]));
}

export async function editNailEntry(deps: Deps, id: string, input: LogNailEntryInput): Promise<NailEntry> {
  const orig = await getEntry(deps, 'nailEntries', id);
  return logNailEntry(deps, input, editOf(orig, input.at, [orig.areaId]));
}

export async function editStool(deps: Deps, id: string, input: { bristol: number; at?: Date; note?: string }): Promise<StoolEntry> {
  const orig = await getEntry(deps, 'stoolEntries', id);
  return logStool(deps, input, editOf(orig, input.at));
}

export async function editDrink(deps: Deps, id: string, input: LogDrinkInput): Promise<Drink> {
  const orig = await getEntry(deps, 'drinks', id);
  const changed = !sameIngredients(orig, { ingredients: cleanList(input.ingredients ?? []), allergens: input.allergens ?? [] });
  return logDrink(deps, { ...input, barcode: orig.barcode, source: afterEdit(orig.source, changed) }, editOf(orig, input.at));
}

export async function editMedication(deps: Deps, id: string, input: Parameters<typeof logMedication>[1]): Promise<MedicationEntry> {
  const orig = await getEntry(deps, 'medicationEntries', id);
  return logMedication(deps, input, editOf(orig, input.at));
}

export async function editTreatmentApplication(deps: Deps, id: string, input: ApplyTreatmentInput): Promise<TreatmentApplication> {
  const orig = await getEntry(deps, 'treatmentApplications', id);
  return applyTreatment(deps, input, editOf(orig, input.at, [orig.treatmentId, ...orig.areaIds]));
}

export async function editMedicalEvent(deps: Deps, id: string, input: MedicalEventInput): Promise<MedicalEvent> {
  const orig = await getEntry(deps, 'medicalEvents', id);
  // The end date is checked against the day of the kept stamp when the date did not change.
  return logMedicalEvent(deps, input, editOf(orig, input.at));
}

export async function editChangeEvent(deps: Deps, id: string, input: ChangeEventInput): Promise<ChangeEvent> {
  const orig = await getEntry(deps, 'changeEvents', id);
  return logChangeEvent(deps, input, editOf(orig, input.at));
}

/** EN-1: edit a reaction; it still cannot start before its meal (a different meal may be chosen). */
export async function editReaction(deps: Deps, id: string, input: ReactionInput): Promise<Reaction> {
  const orig = await getEntry(deps, 'reactions', id);
  // Without a new time the kept onset is what is checked against the meal, not "now".
  return logReaction(deps, input, editOf(orig, input.at));
}

/**
 * EN-1, SK-7: edit a Daily health record as a whole (values, note, time). Moving it to a day that already has
 * another record is refused: a day has one record.
 */
export async function editCheckIn(deps: Deps, id: string, input: CheckInInput): Promise<CheckIn> {
  const orig = await getEntry(deps, 'checkIns', id);
  const values = await cleanValues(deps, input, orig);
  const at = input.at ? makeStamp(deps.clock, input.at) : orig.at;
  const day = localDay(at.utc, at.tz, deps.dayStart.get());
  if ((await deps.repo.listRecords('checkIns')).some((c) => c.day === day && c.id !== id)) {
    throw new NettleError('checkin_day_taken', day);
  }
  const record: CheckIn = { id, at, day, values, note: input.note?.trim() || null };
  await deps.repo.putRecord('checkIns', record);
  return record;
}

/** Counts per kind of what a plan removes besides the entry itself. */
function alsoDeleted(plan: Record<RecordKind, string[]>, kind: RecordKind): Partial<Record<RecordKind, number>> {
  const also: Partial<Record<RecordKind, number>> = {};
  for (const [k, ids] of Object.entries(plan) as [RecordKind, string[]][]) {
    const n = ids.length - (k === kind ? 1 : 0);
    if (n > 0) also[k] = n;
  }
  return also;
}

/**
 * EN-1: what else goes when one entry is deleted, for the action sheet ("also deletes 3 photos"): counts per
 * kind, not including the entry itself. Changes nothing.
 */
export async function previewEntryDelete(deps: Deps, kind: RecordKind, id: string): Promise<Partial<Record<RecordKind, number>>> {
  await getEntry(deps, kind, id);
  const plan = planEntryDeletion(await deps.repo.snapshot(), kind, id);
  return alsoDeleted(plan, kind);
}

/**
 * EN-1, EX-13: delete one entry with what cannot outlive it and leave a tombstone for each removed record,
 * so an older backup cannot bring back a child of a deleted parent. Photo files go after the records. The
 * caller has asked for confirmation (UX-9). Returns the same counts as `previewEntryDelete`.
 */
export async function deleteEntry(deps: Deps, kind: RecordKind, id: string): Promise<Partial<Record<RecordKind, number>>> {
  await getEntry(deps, kind, id);
  const records = await deps.repo.snapshot();
  const plan = planEntryDeletion(records, kind, id);
  await deps.repo.deleteWithTombstones(plan, makeStamp(deps.clock));
  const doomed = new Set(plan.photos);
  for (const photo of records.photos) {
    if (doomed.has(photo.id)) await deps.photos.remove(photo.file);
  }
  return alsoDeleted(plan, kind);
}
