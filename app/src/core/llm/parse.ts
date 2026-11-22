import { NettleError } from '../model/errors';
import { isObj } from '../model/json';
import { ALLERGENS, type Allergen } from '../model/types';

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

/** LL-14: the summary text from the model's JSON; anything but a non-empty `summary` string is `llm_bad_response`. */
export function parseSummary(text: string): string {
  const o = parseJson(text);
  if (!isObj(o) || typeof o.summary !== 'string' || !o.summary.trim()) throw new NettleError('llm_bad_response');
  return o.summary.trim();
}

export interface AllergenSuggestion {
  /** Suggested tags per ingredient name, as the model wrote the name. Suggestions only (IN-10). */
  items: { name: string; allergens: Allergen[] }[];
  note: string | null;
}

/** IN-10: unknown ids are dropped and duplicates merged; anything else unexpected is `llm_bad_response`. */
export function parseAllergenSuggestion(text: string): AllergenSuggestion {
  const o = parseJson(text);
  const bad = (): never => {
    throw new NettleError('llm_bad_response');
  };
  if (!isObj(o) || !Array.isArray(o.items)) return bad();
  const note = o.note;
  if (note !== null && note !== undefined && typeof note !== 'string') return bad();
  const items = o.items.map((it) => {
    if (!isObj(it) || typeof it.name !== 'string' || !Array.isArray(it.allergens) || it.allergens.some((x) => typeof x !== 'string'))
      return bad();
    const allergens = [...new Set((it.allergens as string[]).map((s) => s.trim()))].filter((s): s is Allergen =>
      (ALLERGENS as readonly string[]).includes(s),
    );
    return { name: it.name.trim(), allergens };
  });
  return { items, note: typeof note === 'string' && note.trim() ? note.trim() : null };
}

export interface LabelScan {
  /** As printed, in the label's language. Suggestions only: never saved until the user confirms (IN-15). */
  ingredients: string[];
  /** Declared allergens; suggestions until the user selects them (IN-10). */
  allergens: Allergen[];
  /** "May contain" traces, same ids. */
  traces: Allergen[];
  /** The ingredient text as printed, shown beside the editable list. */
  textRead: string;
  /** What the model could not read, or why the image is not a label. */
  note: string | null;
}

/** LL-13: parses the model's JSON text; unknown allergen ids are dropped, anything else unexpected is `llm_bad_response`. */
export function parseLabelScan(text: string): LabelScan {
  const o = parseJson(text);
  const strings = (v: unknown): string[] => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : bad());
  const bad = (): never => {
    throw new NettleError('llm_bad_response');
  };
  if (!isObj(o)) return bad();
  const tags = (v: unknown) => [
    ...new Set(
      strings(v)
        .map((s) => s.trim())
        .filter((s): s is Allergen => (ALLERGENS as readonly string[]).includes(s)),
    ),
  ];
  const note = o.note;
  if (note !== null && note !== undefined && typeof note !== 'string') return bad();
  if (typeof o.text_read !== 'string') return bad();
  return {
    ingredients: [
      ...new Set(
        strings(o.ingredients)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ].slice(0, 80),
    allergens: tags(o.allergens),
    traces: tags(o.traces),
    textRead: o.text_read.trim(),
    note: typeof note === 'string' && note.trim() ? note.trim() : null,
  };
}
