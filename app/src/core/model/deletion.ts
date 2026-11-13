import { RECORD_KINDS, type DateRange, type RecordKind, type Records } from './types';

/** SE-9: what to delete. `kinds` are the record collections, `range` bounds them by time (open sides allowed). */
export interface DeleteSelection {
  kinds: readonly RecordKind[];
  range?: DateRange;
}

export type DeletePlan = Record<RecordKind, string[]>;

const inRange = (utc: string, r?: DateRange) => (!r?.from || utc >= r.from) && (!r?.to || utc <= r.to);

/**
 * SE-9: which record ids a selection removes. A reaction cannot outlive its meal, so deleting a meal also
 * deletes the reactions linked to it, even when they fall outside the range or `reactions` is not selected.
 */
export function planDeletion(records: Records, selection: DeleteSelection): DeletePlan {
  const plan = Object.fromEntries(RECORD_KINDS.map((k) => [k, [] as string[]])) as DeletePlan;
  for (const kind of selection.kinds) {
    for (const r of records[kind] as { id: string; at: { utc: string } }[]) {
      if (inRange(r.at.utc, selection.range)) plan[kind].push(r.id);
    }
  }
  const meals = new Set(plan.meals);
  const reactions = new Set(plan.reactions);
  for (const r of records.reactions) if (meals.has(r.mealId)) reactions.add(r.id);
  plan.reactions = [...reactions];
  return plan;
}

export const countPlan = (plan: DeletePlan): Record<RecordKind, number> =>
  Object.fromEntries(RECORD_KINDS.map((k) => [k, plan[k].length])) as Record<RecordKind, number>;
