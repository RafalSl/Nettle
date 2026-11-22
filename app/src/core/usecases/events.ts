import { NettleError } from '../model/errors';
import { addDays, localDay, makeStamp } from '../model/time';
import {
  CHANGE_ACTIONS,
  MAX_MEDICAL_TITLE,
  MEDICAL_KINDS,
  SYMPTOMS,
  TREATMENT_REACTIONS,
  type ChangeAction,
  type ChangeEvent,
  type LocalDay,
  type MedicalEvent,
  type MedicalKind,
  type Reaction,
  type Symptom,
  type TreatmentApplication,
  type TreatmentReaction,
} from '../model/types';
import type { Deps } from './deps';

export interface ApplyTreatmentInput {
  treatmentId: string;
  areaIds: string[];
  at?: Date;
  note?: string;
  /** IN-11: set afterwards from the application's edit screen; the one-tap path leaves it out (not recorded). */
  reaction?: TreatmentReaction | null;
}

/** IN-11: apply a saved treatment to one or more areas, timestamped. */
export async function applyTreatment(deps: Deps, input: ApplyTreatmentInput): Promise<TreatmentApplication> {
  const areaIds = [...new Set(input.areaIds)];
  if (areaIds.length === 0) throw new NettleError('no_areas_selected');
  const reaction = input.reaction ?? null;
  if (reaction !== null && !TREATMENT_REACTIONS.includes(reaction)) throw new NettleError('invalid_value', 'reaction');
  const treatment = (await deps.repo.listItems('treatments')).find((t) => t.id === input.treatmentId);
  if (!treatment) throw new NettleError('unknown_item', input.treatmentId);
  if (treatment.archived) throw new NettleError('area_archived', input.treatmentId);
  const areas = await deps.repo.listAreas();
  for (const id of areaIds) {
    const area = areas.find((a) => a.id === id);
    if (!area) throw new NettleError('unknown_area', id);
    if (area.archived) throw new NettleError('area_archived', id);
  }
  const record: TreatmentApplication = {
    id: deps.ids(),
    at: makeStamp(deps.clock, input.at),
    treatmentId: input.treatmentId,
    areaIds,
    reaction,
    note: input.note?.trim() || null,
  };
  await deps.repo.addRecord('treatmentApplications', record);
  return record;
}

export interface ChangeEventInput {
  action: ChangeAction;
  /** The id of a routine change category (`cat-product`, `cat-diet`, or one the user added). */
  category: string;
  name: string;
  /** The date it changed; defaults to now. */
  at?: Date;
  /** "Already using, date unknown": only for `started`; `at` is then just when it was logged. */
  dateUnknown?: boolean;
  note?: string;
}

/** IN-12: "started" or "stopped" a product or diet (or a category of the user's). */
export async function logChangeEvent(deps: Deps, input: ChangeEventInput): Promise<ChangeEvent> {
  if (!CHANGE_ACTIONS.includes(input.action)) throw new NettleError('invalid_value', 'action');
  const category = (await deps.repo.listItems('changeCategories')).find((c) => c.id === input.category);
  if (!category) throw new NettleError('unknown_item', input.category);
  if (input.dateUnknown && input.action !== 'started') throw new NettleError('invalid_value', 'dateUnknown');
  const name = input.name.trim();
  if (!name) throw new NettleError('empty_item_name');
  const event: ChangeEvent = {
    id: deps.ids(),
    at: makeStamp(deps.clock, input.at),
    action: input.action,
    category: input.category,
    name,
    dateUnknown: !!input.dateUnknown,
    note: input.note?.trim() || null,
  };
  await deps.repo.addRecord('changeEvents', event);
  return event;
}

export interface MedicalEventInput {
  kind: MedicalKind;
  title: string;
  /** The date of the event; defaults to now. */
  at?: Date;
  /** IN-18: an illness may have an end date (a calendar day, not before the day it started). Other kinds have none. */
  endDay?: LocalDay | null;
  note?: string;
}

/** IN-18: a visit, test result, diagnosis, illness or other medical event, with a short title. */
export async function logMedicalEvent(deps: Deps, input: MedicalEventInput): Promise<MedicalEvent> {
  if (!MEDICAL_KINDS.includes(input.kind)) throw new NettleError('invalid_value', 'kind');
  const title = input.title.trim();
  if (!title) throw new NettleError('empty_title');
  if (title.length > MAX_MEDICAL_TITLE) throw new NettleError('invalid_value', 'title');
  const at = makeStamp(deps.clock, input.at);
  const endDay = input.endDay ?? null;
  if (endDay !== null) {
    if (input.kind !== 'illness') throw new NettleError('invalid_value', 'endDay');
    if (addDays(endDay, 0) !== endDay) throw new NettleError('invalid_value', 'endDay');
    if (endDay < localDay(at.utc, at.tz, deps.dayStart.get())) throw new NettleError('invalid_value', 'endDay'); // not before the day it started
  }
  const event: MedicalEvent = { id: deps.ids(), at, kind: input.kind, title, endDay, note: input.note?.trim() || null };
  await deps.repo.addRecord('medicalEvents', event);
  return event;
}

export interface ReactionInput {
  mealId: string;
  symptoms: Symptom[];
  /** Time of onset; defaults to now. Must not be before the meal. */
  at?: Date;
  note?: string;
}

/** IN-13: an immediate reaction linked to the meal that probably caused it. */
export async function logReaction(deps: Deps, input: ReactionInput): Promise<Reaction> {
  const symptoms = [...new Set(input.symptoms)];
  if (symptoms.length === 0 || symptoms.some((s) => !SYMPTOMS.includes(s))) throw new NettleError('invalid_value', 'symptoms');
  const meal = (await deps.repo.listMeals()).find((m) => m.id === input.mealId);
  if (!meal) throw new NettleError('unknown_meal', input.mealId);
  const at = makeStamp(deps.clock, input.at);
  if (at.utc < meal.at.utc) throw new NettleError('reaction_before_meal', input.mealId);
  const reaction: Reaction = { id: deps.ids(), at, mealId: input.mealId, symptoms, note: input.note?.trim() || null };
  await deps.repo.addRecord('reactions', reaction);
  return reaction;
}

export interface InUseItem {
  category: string;
  name: string;
  /** When it was started (or logged, when the date is unknown). */
  since: ChangeEvent['at'];
  dateUnknown: boolean;
}

/**
 * IN-12: what is in use now: for each category and name (compared without case), the latest event is "started".
 * "Stopped" offers these so the name does not have to be typed again.
 */
export async function itemsInUse(deps: Deps): Promise<InUseItem[]> {
  const latest = new Map<string, ChangeEvent>();
  for (const e of [...(await deps.repo.listRecords('changeEvents'))].sort(
    (a, b) => a.at.utc.localeCompare(b.at.utc) || a.id.localeCompare(b.id),
  )) {
    latest.set(`${e.category}|${e.name.trim().toLowerCase()}`, e);
  }
  return [...latest.values()]
    .filter((e) => e.action === 'started')
    .sort((a, b) => b.at.utc.localeCompare(a.at.utc))
    .map((e) => ({ category: e.category, name: e.name, since: e.at, dateUnknown: e.dateUnknown }));
}
