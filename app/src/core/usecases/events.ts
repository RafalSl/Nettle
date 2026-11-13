import { NettleError } from '../model/errors';
import { makeStamp } from '../model/time';
import {
  CHANGE_ACTIONS,
  CHANGE_CATEGORIES,
  SYMPTOMS,
  type ChangeAction,
  type ChangeCategory,
  type ChangeEvent,
  type Reaction,
  type Symptom,
  type TreatmentApplication,
} from '../model/types';
import type { Deps } from './deps';

export interface ApplyTreatmentInput {
  treatmentId: string;
  areaIds: string[];
  at?: Date;
  note?: string;
}

/** IN-11: apply a saved treatment to one or more areas, timestamped. */
export async function applyTreatment(deps: Deps, input: ApplyTreatmentInput): Promise<TreatmentApplication> {
  const areaIds = [...new Set(input.areaIds)];
  if (areaIds.length === 0) throw new NettleError('no_areas_selected');
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
    note: input.note?.trim() || null,
  };
  await deps.repo.addRecord('treatmentApplications', record);
  return record;
}

export interface ChangeEventInput {
  action: ChangeAction;
  category: ChangeCategory;
  name: string;
  /** The date it changed; defaults to now. */
  at?: Date;
  note?: string;
}

/** IN-12: "started" or "stopped" a product, medication or diet. */
export async function logChangeEvent(deps: Deps, input: ChangeEventInput): Promise<ChangeEvent> {
  if (!CHANGE_ACTIONS.includes(input.action)) throw new NettleError('invalid_value', 'action');
  if (!CHANGE_CATEGORIES.includes(input.category)) throw new NettleError('invalid_value', 'category');
  const name = input.name.trim();
  if (!name) throw new NettleError('empty_item_name');
  const event: ChangeEvent = {
    id: deps.ids(),
    at: makeStamp(deps.clock, input.at),
    action: input.action,
    category: input.category,
    name,
    note: input.note?.trim() || null,
  };
  await deps.repo.addRecord('changeEvents', event);
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
