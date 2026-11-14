import { INGREDIENTS_PROMPT_VERSION, LABEL_PROMPT_VERSION, ingredientsPrompt, labelPrompt } from '../llm/prompts';
import type { LlmProvenance } from '../model/source';
import { parseIngredientEstimate, parseLabelScan, type IngredientEstimate, type LabelScan } from '../llm/parse';
import { NettleError } from '../model/errors';
import { ALLERGENS } from '../model/types';
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
  input: { image: LlmImage; language: Language; signal?: AbortSignal },
): Promise<IngredientEstimate & { provenance: LlmProvenance }> {
  const { provider } = await currentProvider(deps, 'meal_photo');
  const prompt = ingredientsPrompt(input.language);
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
