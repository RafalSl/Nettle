import { NettleError } from '../model/errors';

export interface IngredientEstimate {
  /** Suggestions only: never saved until the user confirms (IN-3). */
  names: string[];
  uncertainty: string | null;
}

/** Parses the model's JSON text; anything unexpected is `llm_bad_response`, never a crash or a partial save. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new NettleError('llm_bad_response');
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseIngredientEstimate(text: string): IngredientEstimate {
  const o = parseJson(text);
  if (!isObj(o) || !Array.isArray(o.ingredients) || o.ingredients.some((x) => typeof x !== 'string')) {
    throw new NettleError('llm_bad_response');
  }
  const unc = o.uncertainty;
  if (unc !== null && unc !== undefined && typeof unc !== 'string') throw new NettleError('llm_bad_response');
  const names = [...new Set((o.ingredients as string[]).map((s) => s.trim()).filter(Boolean))].slice(0, 50);
  return { names, uncertainty: typeof unc === 'string' && unc.trim() ? unc.trim() : null };
}
