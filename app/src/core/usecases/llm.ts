import { ALLERGEN_PROMPT_VERSION, allergenPrompt, INGREDIENTS_PROMPT_VERSION, LABEL_PROMPT_VERSION, MAX_KNOWN_NAMES, NAME_PROMPT_VERSION, ingredientsPrompt, labelPrompt, namePrompt } from '../llm/prompts';
import type { LlmProvenance } from '../model/source';
import { parseAllergenSuggestion, parseIngredientEstimate, parseLabelScan, type IngredientEstimate, type LabelScan } from '../llm/parse';
import { NettleError } from '../model/errors';
import { ALLERGENS, type Allergen } from '../model/types';
import { LLM_ACTIONS, type LlmAction } from '../llm/actions';
import type { Language, LlmImage, LlmProvider, ModelChoice } from '../ports/llm';
import type { Deps } from './deps';

/** SE-2: the API key lives only in the key store. */
export const API_KEY_NAME = 'anthropic_api_key';
const modelSetting = (action: LlmAction) => `llm_model.${action}`;
/** LL-9: the default for every action. */
export const DEFAULT_MODEL = 'claude-haiku-5-5';

export const hasApiKey = async (deps: Deps) => !!(await deps.keys.get(API_KEY_NAME));

/** SE-2, SE-5: enter or rotate the key. The value is never logged or returned. */
export async function saveApiKey(deps: Deps, key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) throw new NettleError('empty_key');
  await deps.keys.set(API_KEY_NAME, trimmed);
}

export const deleteApiKey = (deps: Deps) => deps.keys.delete(API_KEY_NAME);

/** LL-9: the models the provider offers, for the settings screen. */
export const modelChoices = (deps: Deps): readonly ModelChoice[] => deps.llmModels;

/** LL-9: the model chosen for one action; the default when none is set or the stored one is no longer offered. */
export async function getModel(deps: Deps, action: LlmAction): Promise<string> {
  const stored = await deps.settings.get(modelSetting(action));
  return stored && deps.llmModels.some((m) => m.id === stored) ? stored : DEFAULT_MODEL;
}

/** LL-9: pick the model of one action from the offered list; null restores the default. */
export async function setModel(deps: Deps, action: LlmAction, model: string | null): Promise<void> {
  if (!LLM_ACTIONS.includes(action)) throw new NettleError('invalid_value', 'action');
  if (model === null || model === DEFAULT_MODEL) return deps.settings.delete(modelSetting(action));
  if (!deps.llmModels.some((m) => m.id === model)) throw new NettleError('invalid_value', 'model');
  await deps.settings.set(modelSetting(action), model);
}

/** The provider for one action under the current settings, or `llm_no_key`. */
export async function currentProvider(deps: Deps, action: LlmAction): Promise<{ provider: LlmProvider; model: string }> {
  const apiKey = await deps.keys.get(API_KEY_NAME);
  if (!apiKey) throw new NettleError('llm_no_key');
  const model = await getModel(deps, action);
  return { provider: deps.llmFor({ provider: 'anthropic', model, apiKey }), model };
}

/**
 * LL-1, IN-3: ask the model for ingredient suggestions from a meal photo. The caller must have shown a
 * confirmation that the photo is sent; the result only fills a form, nothing is saved here.
 */
export async function estimateIngredients(
  deps: Deps,
  input: { image: LlmImage; language: Language; signal?: AbortSignal; /** From `knownIngredientNames`; empty when the setting is off. */ knownNames?: readonly string[] },
): Promise<IngredientEstimate & { provenance: LlmProvenance }> {
  const { provider } = await currentProvider(deps, 'meal_photo');
  const prompt = ingredientsPrompt(input.language, input.knownNames ?? []);
  const response = await provider.completeJson({ ...prompt, images: [input.image], ...(input.signal ? { signal: input.signal } : {}) });
  // IN-16: the model that answered, when, and which prompt asked.
  const provenance: LlmProvenance = { model: response.model, at: deps.clock.now().toISOString(), promptVersion: INGREDIENTS_PROMPT_VERSION };
  return { ...parseIngredientEstimate(response.text), provenance };
}

/**
 * LL-13, IN-15: ask the model to read an ingredient label from a photo. The caller must have shown the LL-5
 * confirmation; the result only fills a form for review, nothing is saved here.
 */
export async function scanLabel(
  deps: Deps,
  input: { image: LlmImage; language: Language; signal?: AbortSignal },
): Promise<LabelScan & { provenance: LlmProvenance }> {
  const { provider } = await currentProvider(deps, 'label_scan');
  const prompt = labelPrompt(input.language, ALLERGENS);
  const response = await provider.completeJson({ ...prompt, images: [input.image], ...(input.signal ? { signal: input.signal } : {}) });
  const provenance: LlmProvenance = { model: response.model, at: deps.clock.now().toISOString(), promptVersion: LABEL_PROMPT_VERSION };
  return { ...parseLabelScan(response.text), provenance };
}

/** IN-19: the longest description sent for a name estimate. */
export const MAX_NAME_ESTIMATE_CHARS = 200;

/** IN-19: the text a name estimate sends: trimmed, single spaces; `empty_description` when nothing is typed. */
export function nameEstimateText(description: string): string {
  const text = description.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_ESTIMATE_CHARS);
  if (!text) throw new NettleError('empty_description');
  return text;
}

/**
 * IN-19, LL-5: ask the model for the typical ingredients of a meal or drink from its name alone (no photo). The
 * caller must have shown the confirmation that lists this text; the result only fills a form for review, nothing is
 * saved here. A name too vague to list returns no names and the model's note.
 */
export async function estimateIngredientsFromName(
  deps: Deps,
  input: { description: string; language: Language; signal?: AbortSignal; knownNames?: readonly string[] },
): Promise<IngredientEstimate & { provenance: LlmProvenance }> {
  const description = nameEstimateText(input.description);
  const { provider } = await currentProvider(deps, 'meal_name');
  const prompt = namePrompt(input.language, description, input.knownNames ?? []);
  const response = await provider.completeJson({ ...prompt, ...(input.signal ? { signal: input.signal } : {}) });
  const provenance: LlmProvenance = { model: response.model, at: deps.clock.now().toISOString(), promptVersion: NAME_PROMPT_VERSION };
  return { ...parseIngredientEstimate(response.text), provenance };
}

/**
 * IN-3: the ingredient names already used in meals and drinks, most used first, for the optional "prefer my names"
 * setting. Empty when the setting is off. Only the names leave the phone, never entries or photos, and the
 * confirmation says how many.
 */
export async function knownIngredientNames(deps: Deps): Promise<string[]> {
  const prefs = await deps.repo.getPreferences();
  if (!prefs?.suggestions.knownNames) return [];
  return ingredientNameHistory(deps, MAX_KNOWN_NAMES);
}

/**
 * IN-1: every ingredient name in meals and drinks, most used first (one spelling per name), for autocomplete. It
 * stays on the phone and does not depend on the "prefer my names" setting, which only governs what is sent.
 */
export async function ingredientNameHistory(deps: Deps, limit = 500): Promise<string[]> {
  const counts = new Map<string, { name: string; n: number }>();
  const lists = [...(await deps.repo.listMeals()).map((m) => m.ingredients), ...(await deps.repo.listRecords('drinks')).map((d) => d.ingredients)];
  for (const list of lists) {
    for (const raw of list) {
      const name = raw.trim();
      if (!name || name.length > 40) continue;
      const key = name.toLowerCase();
      const cur = counts.get(key);
      if (cur) cur.n++;
      else counts.set(key, { name, n: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, limit).map((c) => c.name);
}

/** Most ingredient names one allergen request sends. */
export const MAX_ALLERGEN_INGREDIENTS = 80;
const ALLERGEN_CACHE = 'allergen_cache';
const MAX_CACHED_NAMES = 3000;

const nameKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

type CacheFile = { version: string; names: Record<string, Allergen[]> };

async function readAllergenCache(deps: Deps): Promise<CacheFile> {
  const empty: CacheFile = { version: ALLERGEN_PROMPT_VERSION, names: {} };
  try {
    const raw = await deps.settings.get(ALLERGEN_CACHE);
    const parsed = raw ? (JSON.parse(raw) as CacheFile) : empty;
    // A different prompt version means different answers: the old ones are not reused.
    return parsed.version === ALLERGEN_PROMPT_VERSION && typeof parsed.names === 'object' && parsed.names !== null ? parsed : empty;
  } catch {
    return empty;
  }
}

/** IN-10: forgets every saved allergen suggestion (Delete data, AI). */
export const clearAllergenCache = (deps: Deps) => deps.settings.delete(ALLERGEN_CACHE);

export interface AllergenPlan {
  /** The distinct ingredient names, as given. */
  names: string[];
  /** The saved suggestions for names asked before. */
  known: Allergen[];
  /** The names the model has not been asked about yet: only these are sent, and they are what the confirmation lists. */
  toSend: string[];
}

/**
 * IN-10, LL-5: works out what an allergen suggestion needs. The model's answers are saved per ingredient name on
 * this phone (not exported), so a name asked before is never sent again. Nothing is sent here.
 */
export async function planAllergenSuggestion(deps: Deps, ingredients: readonly string[]): Promise<AllergenPlan> {
  const names = [...new Map(ingredients.map((i) => i.trim()).filter(Boolean).map((n) => [nameKey(n), n])).values()].slice(0, MAX_ALLERGEN_INGREDIENTS);
  if (names.length === 0) throw new NettleError('no_ingredients');
  const cache = await readAllergenCache(deps);
  const known = new Set<Allergen>();
  const toSend: string[] = [];
  for (const n of names) {
    const hit = cache.names[nameKey(n)];
    if (hit) hit.forEach((a) => known.add(a));
    else toSend.push(n);
  }
  return { names, known: [...known], toSend };
}

/**
 * IN-10, LL-5: ask the model about the names that have no saved answer, save its answers per name, and return the
 * tags of the whole list. Text only. With nothing to send, no call is made. The tags are suggestions: nothing is
 * selected or saved on an entry here.
 */
export async function suggestAllergensWithAi(
  deps: Deps,
  input: { ingredients: readonly string[]; language: Language; signal?: AbortSignal },
): Promise<{ allergens: Allergen[]; note: string | null; asked: number }> {
  const plan = await planAllergenSuggestion(deps, input.ingredients);
  if (plan.toSend.length === 0) return { allergens: plan.known, note: null, asked: 0 };
  const { provider } = await currentProvider(deps, 'allergen_suggest');
  const prompt = allergenPrompt(input.language, ALLERGENS, plan.toSend);
  const response = await provider.completeJson({ ...prompt, ...(input.signal ? { signal: input.signal } : {}) });
  const parsed = parseAllergenSuggestion(response.text);
  if (input.signal?.aborted) throw new NettleError('llm_cancelled');
  const answered = new Map(parsed.items.map((i) => [nameKey(i.name), i.allergens]));
  const cache = await readAllergenCache(deps);
  const all = new Set<Allergen>(plan.known);
  for (const n of plan.toSend) {
    const tags = answered.get(nameKey(n)) ?? []; // a name the model skipped counts as "none found"
    cache.names[nameKey(n)] = tags;
    tags.forEach((a) => all.add(a));
  }
  const keys = Object.keys(cache.names);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_CACHED_NAMES))) delete cache.names[k]; // oldest first
  await deps.settings.set(ALLERGEN_CACHE, JSON.stringify(cache));
  return { allergens: [...all], note: parsed.note, asked: plan.toSend.length };
}
