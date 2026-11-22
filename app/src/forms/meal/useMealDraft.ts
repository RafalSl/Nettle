import { useState } from 'react';
import { afterEdit, sameIngredients, typedSource, type IngredientSource } from '@/core/model/source';
import type { Allergen } from '@/core/model/types';

/** IN-16: where the form's lists came from, and the lists as they were filled in. */
export interface Origin {
  barcode: string | null;
  source: IngredientSource;
  filled: { ingredients: string[]; allergens: string[] };
}
export const typedOrigin = (): Origin => ({ barcode: null, source: typedSource(), filled: { ingredients: [], allergens: [] } });

/**
 * IN-1, IN-16: the fields of the meal review form, whether the user changed them (`edited`, for Discard), and what
 * a save stores from them. `touch(set)` wraps a setter so a change counts as an edit.
 */
export function useMealDraft() {
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<string[]>(['']);
  const [allergens, setAllergens] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [fillLater, setFillLater] = useState(false);
  const [at, setAt] = useState<Date | null>(null);
  const [edited, setEdited] = useState(false);
  const [origin, setOrigin] = useState<Origin>(typedOrigin());
  const [dateHint, setDateHint] = useState<string | null>(null);

  const touch =
    <T>(set: (v: T) => void) =>
    (v: T) => {
      setEdited(true);
      set(v);
    };
  const setIngredient = (i: number, v: string) => touch(setIngredients)(ingredients.map((x, j) => (j === i ? v : x)));

  /** What is saved from the lists: cleaned, with the barcode and the source (marked edited when the lists differ from how they were filled). */
  function saveFields() {
    const list = ingredients.map((i) => i.trim()).filter(Boolean);
    const tags = [...allergens] as Allergen[];
    return {
      ingredients: list,
      allergens: tags,
      barcode: origin.barcode,
      source: afterEdit(origin.source, !sameIngredients(origin.filled, { ingredients: list, allergens: tags })),
    };
  }

  return {
    description,
    setDescription,
    ingredients,
    setIngredients,
    allergens,
    setAllergens,
    note,
    setNote,
    fillLater,
    setFillLater,
    at,
    setAt,
    edited,
    setEdited,
    origin,
    setOrigin,
    dateHint,
    setDateHint,
    touch,
    setIngredient,
    saveFields,
  };
}
