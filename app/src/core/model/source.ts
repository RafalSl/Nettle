import { NettleError } from './errors';

/** IN-16: where an entry's ingredient list and allergen tags came from. */
export const SOURCE_KINDS = ['typed', 'open_food_facts', 'label_scan', 'photo_estimate'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/** The LLM run behind a label scan or a photo estimate. */
export interface LlmProvenance {
  model: string;
  /** UTC instant of the answer. */
  at: string;
  promptVersion: string;
}

export interface IngredientSource {
  kind: SourceKind;
  /** The user changed the ingredients or tags after they were filled from `kind`. Never true for `typed`. */
  edited: boolean;
  /** Only for the two LLM sources (`label_scan`, `photo_estimate`). */
  llm: LlmProvenance | null;
  /** The allergen tags were selected from an AI suggestion (label scan or allergen suggestion), whatever the ingredients' source. */
  aiTags: boolean;
}

export const typedSource = (): IngredientSource => ({ kind: 'typed', edited: false, llm: null, aiTags: false });

/** A saved source from before `aiTags` existed has none. */
export const normalizeSource = (s: Omit<IngredientSource, 'aiTags'> & { aiTags?: boolean }): IngredientSource => ({ ...s, aiTags: s.aiTags === true });

/** The label scan and the photo estimate are AI-derived (EX-4 marks them). */
export const isAiSource = (s: IngredientSource): boolean => s.kind === 'label_scan' || s.kind === 'photo_estimate';

/** IN-16: editing the list or the tags of a filled entry marks it edited; typed entries have nothing to mark. */
export const afterEdit = (s: IngredientSource, changed: boolean): IngredientSource =>
  changed && s.kind !== 'typed' ? { ...s, edited: true } : s;

/** Same ingredients (in order) and same tags (as a set)? Used to decide whether an edit changed them. */
export function sameIngredients(
  a: { ingredients: readonly string[]; allergens: readonly string[] },
  b: { ingredients: readonly string[]; allergens: readonly string[] },
): boolean {
  return (
    a.ingredients.length === b.ingredients.length &&
    a.ingredients.every((x, i) => x === b.ingredients[i]) &&
    a.allergens.length === b.allergens.length &&
    a.allergens.every((x) => b.allergens.includes(x))
  );
}

/** Throws `invalid_value` unless the source is consistent: LLM details exactly for the LLM sources, typed never edited. */
export function assertSource(s: IngredientSource): void {
  if (!(SOURCE_KINDS as readonly string[]).includes(s.kind)) throw new NettleError('invalid_value', 'source');
  if (isAiSource(s) !== (s.llm !== null)) throw new NettleError('invalid_value', 'source.llm');
  if (s.kind === 'typed' && s.edited) throw new NettleError('invalid_value', 'source.edited');
}
