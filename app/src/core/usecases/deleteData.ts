import { countPlan, planDeletion, type DeleteSelection } from '../model/deletion';
import { NettleError } from '../model/errors';
import type { RecordKind } from '../model/types';
import type { Deps } from './deps';
import { clearAiPackState } from './aiPack';
import { clearAllergenCache } from './llm';

async function plan(deps: Deps, selection: DeleteSelection) {
  if (selection.kinds.length === 0) throw new NettleError('nothing_selected');
  const records = await deps.repo.snapshot();
  return { records, plan: planDeletion(records, selection) };
}

/** SE-9: how many rows of each kind a deletion would remove, for the confirmation screen. Changes nothing. */
export async function previewDelete(deps: Deps, selection: DeleteSelection): Promise<Record<RecordKind, number>> {
  return countPlan((await plan(deps, selection)).plan);
}

/**
 * SE-9: delete the selected records and the files of their photos. The caller shows the preview, offers an
 * export first and asks for confirmation; this function does not ask. Returns what was removed. Settings
 * (areas, lists) stay. The records go first, so a failure while removing a file leaves no record pointing at
 * a missing file.
 */
export async function deleteData(deps: Deps, selection: DeleteSelection): Promise<Record<RecordKind, number>> {
  const { records, plan: p } = await plan(deps, selection);
  await deps.repo.deleteRecords(p);
  const doomed = new Set(p.photos);
  for (const photo of records.photos) {
    if (doomed.has(photo.id)) await deps.photos.remove(photo.file);
  }
  // IN-10: the saved allergen suggestions are AI output derived from the diary's ingredients; they go with the AI group.
  if (selection.kinds.includes('analyses')) {
    await clearAllergenCache(deps);
    await clearAiPackState(deps); // LL-15: packs, imported results and suggestions are AI data too; the marks on entries stay
  }
  return countPlan(p);
}
