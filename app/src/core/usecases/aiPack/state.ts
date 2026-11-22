import type { Allergen, Drink, LocalDay, Meal } from '../../model/types';
import type { Language } from '../../ports/llm';
import type { Deps } from '../deps';
import { readJsonSetting, SETTING_KEYS, writeJsonSetting } from '../settingsStore';
import { isObj } from '../../model/json';

/**
 * LL-15, IN-20: the manual handoff to the user's own Claude plan. The app writes a pack (a ZIP) and later imports a
 * `result.json`; the model never edits `data.json`, an import never changes an entry, and nothing is sent by the app.
 * Everything the app must remember between the two steps lives in one settings value that is not exported.
 */
const STATE_KEY = SETTING_KEYS.aiPack;
export const MAX_REMEMBERED_PACKS = 20;

export type MarkedKind = 'meal' | 'drink';
export interface MarkedRef {
  kind: MarkedKind;
  id: string;
}

/** What the app remembers of a pack it made, to check a result against it. */
export interface PackRecord {
  id: string;
  createdUtc: string;
  dayFrom: LocalDay;
  dayTo: LocalDay;
  language: Language;
  counts: Record<string, number>;
  marked: MarkedRef[];
}

/** IN-20: a fill that came back from a pack and waits for the person to look at it. */
export interface Suggestion {
  id: string;
  kind: MarkedKind;
  entryId: string;
  ingredients: string[];
  allergens: Allergen[];
  note: string | null;
  /** The name the model gave itself in the result. */
  model: string;
  packId: string;
  receivedUtc: string;
}

export interface State {
  packs: PackRecord[];
  imported: string[];
  suggestions: Suggestion[];
}

const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
export const readState = (deps: Deps): Promise<State> =>
  readJsonSetting(
    deps,
    STATE_KEY,
    (raw) =>
      isObj(raw)
        ? { packs: list<PackRecord>(raw.packs), imported: list<string>(raw.imported), suggestions: list<Suggestion>(raw.suggestions) }
        : null,
    () => ({ packs: [], imported: [], suggestions: [] }),
  );
export const writeState = (deps: Deps, s: State) => writeJsonSetting(deps, STATE_KEY, s);

/** IN-20: forgets packs, imported results and suggestions (Delete data, AI). Entries and their marks stay. */
export const clearAiPackState = (deps: Deps) => deps.settings.delete(STATE_KEY);

/* ---------- marked entries ---------- */

export interface MarkedEntry extends MarkedRef {
  /** What was typed: a meal's description, or a drink's name and amount. */
  text: string;
  entry: Meal | Drink;
}

/** IN-20: the meals and drinks marked "fill later with AI", whatever their date, oldest first. */
export async function markedEntries(deps: Deps): Promise<MarkedEntry[]> {
  const meals = (await deps.repo.listRecords('meals'))
    .filter((m) => m.fillLater)
    .map((m): MarkedEntry => ({ kind: 'meal', id: m.id, text: m.description, entry: m }));
  const drinks = (await deps.repo.listRecords('drinks'))
    .filter((d) => d.fillLater)
    .map((d): MarkedEntry => ({ kind: 'drink', id: d.id, text: `${d.name} (${d.amountMl} ml)`, entry: d }));
  return [...meals, ...drinks].sort((a, b) => a.entry.at.utc.localeCompare(b.entry.at.utc) || a.id.localeCompare(b.id));
}
