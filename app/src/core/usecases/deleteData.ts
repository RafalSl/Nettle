import { countPlan, planDeletion, type DeleteSelection } from '../model/deletion';
import { NettleError } from '../model/errors';
import type { RecordKind } from '../model/types';
import type { Deps } from './deps';

async function plan(deps: Deps, selection: DeleteSelection) {
  if (selection.kinds.length === 0) throw new NettleError('nothing_selected');
  return planDeletion(await deps.repo.snapshot(), selection);
}

/** SE-9: how many rows of each kind a deletion would remove, for the confirmation screen. Changes nothing. */
export async function previewDelete(deps: Deps, selection: DeleteSelection): Promise<Record<RecordKind, number>> {
  return countPlan(await plan(deps, selection));
}

/**
 * SE-9: delete the selected records. The caller shows the preview, offers an export first and asks for
 * confirmation; this function does not ask. Returns what was removed. Settings (areas, lists) stay.
 */
export async function deleteData(deps: Deps, selection: DeleteSelection): Promise<Record<RecordKind, number>> {
  const p = await plan(deps, selection);
  await deps.repo.deleteRecords(p);
  return countPlan(p);
}
