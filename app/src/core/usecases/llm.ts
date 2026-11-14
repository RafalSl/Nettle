import { ingredientsPrompt } from '../llm/prompts';
import { parseIngredientEstimate, type IngredientEstimate } from '../llm/parse';
import { NettleError } from '../model/errors';
import type { Language, LlmImage, LlmProvider } from '../ports/llm';
import type { Deps } from './deps';

/** SE-2: the API key lives only in the key store. */
export const API_KEY_NAME = 'anthropic_api_key';
const MODEL_SETTING = 'llm_model';
/** LL-9: a default only; the model name is a setting the user can change. */
export const DEFAULT_MODEL = 'claude-opus-5-5';

export const hasApiKey = async (deps: Deps) => !!(await deps.keys.get(API_KEY_NAME));

/** SE-2, SE-5: enter or rotate the key. The value is never logged or returned. */
export async function saveApiKey(deps: Deps, key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) throw new NettleError('empty_key');
  await deps.keys.set(API_KEY_NAME, trimmed);
}

export const deleteApiKey = (deps: Deps) => deps.keys.delete(API_KEY_NAME);

export async function getModel(deps: Deps): Promise<string> {
  return (await deps.settings.get(MODEL_SETTING)) ?? DEFAULT_MODEL;
}

export async function setModel(deps: Deps, model: string): Promise<void> {
  const trimmed = model.trim();
  if (!trimmed) await deps.settings.delete(MODEL_SETTING);
  else await deps.settings.set(MODEL_SETTING, trimmed);
}

/** The provider for the current settings, or `llm_no_key`. */
export async function currentProvider(deps: Deps): Promise<{ provider: LlmProvider; model: string }> {
  const apiKey = await deps.keys.get(API_KEY_NAME);
  if (!apiKey) throw new NettleError('llm_no_key');
  const model = await getModel(deps);
  return { provider: deps.llmFor({ provider: 'anthropic', model, apiKey }), model };
}

/**
 * LL-1, IN-3: ask the model for ingredient suggestions from a meal photo. The caller must have shown a
 * confirmation that the photo is sent; the result only fills a form, nothing is saved here.
 */
export async function estimateIngredients(
  deps: Deps,
  input: { image: LlmImage; language: Language; signal?: AbortSignal },
): Promise<IngredientEstimate> {
  const { provider } = await currentProvider(deps);
  const prompt = ingredientsPrompt(input.language);
  const response = await provider.completeJson({ ...prompt, images: [input.image], ...(input.signal ? { signal: input.signal } : {}) });
  return parseIngredientEstimate(response.text);
}
