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
import type { StorageRepository } from '../ports/storage';
import { cleanValues, logStool, type CheckInInput } from './checkin';
import type { Deps } from './deps';
import { applyTreatment, logChangeEvent, logMedicalEvent, logReaction, type ApplyTreatmentInput, type ChangeEventInput, type MedicalEventInput, type ReactionInput } from './events';
import { afterEdit, sameIngredients } from '../model/source';
import { logDrink, logMedication, type LogDrinkInput } from './intake';
import { logMeal, type LogMealInput } from './logMeal';
import { logNailEntry, logSkinEntry, type LogNailEntryInput, type LogSkinEntryInput } from './skin';

/** The record of a kind with this id, or a NettleError('unknown_entry'). */
export async function getEntry(deps: Deps, kind: RecordKind, id: string): Promise<Records[RecordKind][number]> {
  const all =
    kind === 'meals'
      ? await deps.repo.listMeals()
      : kind === 'skinEntries'
        ? await deps.repo.listSkinEntries()
        : await deps.repo.listRecords(kind);
  const found = (all as { id: string }[]).find((r) => r.id === id);
  if (!found) throw new NettleError('unknown_entry', `${kind}/${id}`);
  return found as Records[RecordKind][number];
}

/**
 * EN-1: dependencies for editing one record with the validation of the matching `log*` use case. The id is
 * kept, the "add" calls become "replace", an unchanged time keeps its stamp (and so its timezone) and areas
 * or items the entry already uses stay allowed after they were archived (archived, not deleted).
 */
const cleanList = (l: readonly string[]) => l.map((i) => i.trim()).filter(Boolean);

function editing(deps: Deps, id: string, keep: { at?: Stamp; used?: string[] }): Deps {
  const used = new Set(keep.used ?? []);
  const withStamp = <T extends { at: Stamp }>(r: T): T => (keep.at ? { ...r, at: keep.at } : r);
  const repo = new Proxy(deps.repo, {
    get(target, prop) {
      switch (prop) {
        case 'addMeal':
          return (m: Meal) => target.putMeal(withStamp(m));
        case 'addSkinEntry':
          return (e: SkinEntry) => target.putSkinEntry(withStamp(e));
        case 'addRecord':
          return (k: Parameters<StorageRepository['putRecord']>[0], r: never) =>
            target.putRecord(k, withStamp(r as { at: Stamp }) as never);
        case 'listAreas':
          return async () => (await target.listAreas()).map((a) => (used.has(a.id) ? { ...a, archived: false } : a));
        case 'listItems':
          return async (k: Parameters<StorageRepository['listItems']>[0]) =>
            (await target.listItems(k)).map((i) => (used.has(i.id) ? { ...i, archived: false } : i));
        default: {
          const v = Reflect.get(target, prop);
          return typeof v === 'function' ? v.bind(target) : v;
        }
      }
    },
  });
  return { ...deps, repo, ids: () => id };
}

/** Keeps the original stamp when the edit gives no new time. */
const keepAt = (orig: { at: Stamp }, at?: Date) => (at ? undefined : orig.at);

/** EN-1: edit a meal. Its time cannot move after one of its reactions. */
export async function editMeal(deps: Deps, id: string, input: LogMealInput): Promise<Meal> {
  const orig = (await getEntry(deps, 'meals', id)) as Meal;
  const at = input.at ? makeStamp(deps.clock, input.at) : orig.at;
  for (const r of await deps.repo.listRecords('reactions')) {
    if (r.mealId === id && r.at.utc < at.utc) throw new NettleError('meal_after_reaction', id);
  }
  const changed = !sameIngredients(orig, { ingredients: cleanList(input.ingredients), allergens: input.allergens ?? [] });
  return logMeal(editing(deps, id, { at: keepAt(orig, input.at) }), { ...input, barcode: orig.barcode, source: afterEdit(orig.source, changed) });
}

export async function editSkinEntry(deps: Deps, id: string, input: LogSkinEntryInput): Promise<SkinEntry> {
  const orig = (await getEntry(deps, 'skinEntries', id)) as SkinEntry;
  return logSkinEntry(editing(deps, id, { at: keepAt(orig, input.at), used: [orig.areaId] }), input);
}

export async function editNailEntry(deps: Deps, id: string, input: LogNailEntryInput): Promise<NailEntry> {
  const orig = (await getEntry(deps, 'nailEntries', id)) as NailEntry;
  return logNailEntry(editing(deps, id, { at: keepAt(orig, input.at), used: [orig.areaId] }), input);
}

export async function editStool(deps: Deps, id: string, input: { bristol: number; at?: Date; note?: string }): Promise<StoolEntry> {
  const orig = (await getEntry(deps, 'stoolEntries', id)) as StoolEntry;
  return logStool(editing(deps, id, { at: keepAt(orig, input.at) }), input);
}

export async function editDrink(
  deps: Deps,
  id: string,
  input: LogDrinkInput,
): Promise<Drink> {
  const orig = (await getEntry(deps, 'drinks', id)) as Drink;
  const changed = !sameIngredients(orig, { ingredients: cleanList(input.ingredients ?? []), allergens: input.allergens ?? [] });
  return logDrink(editing(deps, id, { at: keepAt(orig, input.at) }), { ...input, barcode: orig.barcode, source: afterEdit(orig.source, changed) });
}

export async function editMedication(
  deps: Deps,
  id: string,
  input: Parameters<typeof logMedication>[1],
): Promise<MedicationEntry> {
  const orig = (await getEntry(deps, 'medicationEntries', id)) as MedicationEntry;
  return logMedication(editing(deps, id, { at: keepAt(orig, input.at) }), input);
}

export async function editTreatmentApplication(
  deps: Deps,
  id: string,
  input: ApplyTreatmentInput,
): Promise<TreatmentApplication> {
  const orig = (await getEntry(deps, 'treatmentApplications', id)) as TreatmentApplication;
  return applyTreatment(
    editing(deps, id, { at: keepAt(orig, input.at), used: [orig.treatmentId, ...orig.areaIds] }),
    input,
  );
}

export async function editMedicalEvent(deps: Deps, id: string, input: MedicalEventInput): Promise<MedicalEvent> {
  const orig = (await getEntry(deps, 'medicalEvents', id)) as MedicalEvent;
  const edit = editing(deps, id, { at: keepAt(orig, input.at) });
  // The end date is checked against the day the event is on. An unchanged date keeps its own stamp, so validate with it too.
  const same = input.at === undefined ? { clock: { now: () => new Date(orig.at.utc), timeZone: () => orig.at.tz } } : {};
  return logMedicalEvent({ ...edit, ...same }, input);
}

export async function editChangeEvent(deps: Deps, id: string, input: ChangeEventInput): Promise<ChangeEvent> {
  const orig = (await getEntry(deps, 'changeEvents', id)) as ChangeEvent;
  return logChangeEvent(editing(deps, id, { at: keepAt(orig, input.at) }), input);
}

/** EN-1: edit a reaction; it still cannot start before its meal (a different meal may be chosen). */
export async function editReaction(deps: Deps, id: string, input: ReactionInput): Promise<Reaction> {
  const orig = (await getEntry(deps, 'reactions', id)) as Reaction;
  // Validate against the original onset when no new time is given, not against "now"; the stamp is kept as is.
  return logReaction(editing(deps, id, { at: keepAt(orig, input.at) }), { ...input, at: input.at ?? new Date(orig.at.utc) });
}

/**
 * EN-1, SK-7: edit a Daily health record as a whole (values, note, time). Moving it to a day that already has
 * another record is refused: a day has one record.
 */
export async function editCheckIn(deps: Deps, id: string, input: CheckInInput): Promise<CheckIn> {
  const orig = (await getEntry(deps, 'checkIns', id)) as CheckIn;
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
