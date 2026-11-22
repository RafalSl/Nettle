import { NettleError } from '../../model/errors';
import type { IngredientSource } from '../../model/source';
import type { Drink, Meal } from '../../model/types';
import type { Deps } from '../deps';
import { readState, writeState, type Suggestion } from './state';

/** IN-20: fills that came back and wait for the person to look at them. */

async function entryOf(deps: Deps, s: Pick<Suggestion, 'kind' | 'entryId'>): Promise<Meal | Drink | null> {
  return s.kind === 'meal' ? deps.repo.getRecord('meals', s.entryId) : deps.repo.getRecord('drinks', s.entryId);
}

/**
 * IN-20: the suggestions that still wait. One whose entry was deleted, or is no longer marked, is dropped here, so the
 * Today card never counts what cannot be opened.
 */
export async function listSuggestions(deps: Deps): Promise<(Suggestion & { entry: Meal | Drink })[]> {
  const state = await readState(deps);
  const kept: (Suggestion & { entry: Meal | Drink })[] = [];
  for (const s of state.suggestions) {
    const entry = await entryOf(deps, s);
    if (entry && entry.fillLater) kept.push({ ...s, entry });
  }
  if (kept.length !== state.suggestions.length) await writeState(deps, { ...state, suggestions: kept.map(({ entry: _entry, ...s }) => s) });
  return kept;
}

export async function getSuggestion(deps: Deps, id: string): Promise<Suggestion & { entry: Meal | Drink }> {
  const found = (await listSuggestions(deps)).find((s) => s.id === id);
  if (!found) throw new NettleError('suggestion_gone', id);
  return found;
}

/** IN-20: dismissing removes the suggestion and keeps the mark, so the next pack asks again. */
export async function dismissSuggestion(deps: Deps, id: string): Promise<void> {
  const state = await readState(deps);
  await writeState(deps, { ...state, suggestions: state.suggestions.filter((s) => s.id !== id) });
}

/**
 * IN-20: the person added names from a suggestion and saved the entry. Clears the mark and removes the suggestion. An
 * entry that was still typed gets the source "name estimate (manual)" with the model the result names; an entry that
 * has another source keeps it. `edited` says that the list was changed after the names were added; `aiTags` that the
 * allergen tags were selected from the suggestion (IN-16).
 */
export async function completeSuggestion(deps: Deps, id: string, opts: { edited: boolean; aiTags: boolean }): Promise<void> {
  // Read from the state, not from `listSuggestions`: the edit that came just before may already have cleared the mark.
  const waiting = (await readState(deps)).suggestions.find((x) => x.id === id);
  const entry = waiting ? await entryOf(deps, waiting) : null;
  if (!waiting || !entry) throw new NettleError('suggestion_gone', id);
  const s = waiting;
  const source: IngredientSource =
    entry.source.kind === 'typed'
      ? {
          kind: 'name_estimate',
          edited: opts.edited,
          llm: { model: s.model, at: s.receivedUtc, promptVersion: 'manual', manual: true },
          aiTags: opts.aiTags,
        }
      : { ...entry.source, aiTags: entry.source.aiTags || opts.aiTags };
  const { fillLater: _mark, ...rest } = entry;
  if (s.kind === 'meal') await deps.repo.putRecord('meals', { ...(rest as Meal), source });
  else await deps.repo.putRecord('drinks', { ...(rest as Drink), source });
  await dismissSuggestion(deps, id);
}
