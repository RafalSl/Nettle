import { isInStoreCode, normalizeBarcode } from '../model/barcode';
import { NettleError } from '../model/errors';
import type { IngredientSource } from '../model/source';
import type { Allergen } from '../model/types';
import type { ProductInfo } from '../ports/barcode';
import type { Deps } from './deps';

export interface ProductLookup {
  barcode: string;
  /** IN-2: a restricted circulation number, so the match is ambiguous and the user must confirm it. */
  inStore: boolean;
  /** null when the source does not know the code (IN-8: enter the product by hand). */
  product: ProductInfo | null;
  /** The product is known but has no name or no ingredients (IN-8). */
  incomplete: boolean;
  /** IN-2: the diary already holds an entry made from this barcode; the source was not asked. */
  history: HistoryProduct | null;
}

/** The latest earlier use of a barcode: what fills the review (its tags count as confirmed, IN-10). */
export interface HistoryProduct {
  name: string;
  ingredients: string[];
  allergens: Allergen[];
  source: IngredientSource;
  /** UTC instant of that entry. */
  at: string;
}

/** IN-2: the latest meal or drink made from this barcode, or null. */
export async function findInHistory(deps: Deps, barcode: string): Promise<HistoryProduct | null> {
  const hits: (HistoryProduct & { kind: 'meal' | 'drink' })[] = [];
  for (const m of await deps.repo.listRecords('meals')) {
    if (m.barcode === barcode)
      hits.push({ kind: 'meal', name: m.description, ingredients: m.ingredients, allergens: m.allergens, source: m.source, at: m.at.utc });
  }
  for (const d of await deps.repo.listRecords('drinks')) {
    if (d.barcode === barcode)
      hits.push({ kind: 'drink', name: d.name, ingredients: d.ingredients, allergens: d.allergens, source: d.source, at: d.at.utc });
  }
  hits.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const top = hits[0];
  return top ? { name: top.name, ingredients: top.ingredients, allergens: top.allergens, source: top.source, at: top.at } : null;
}

/**
 * IN-2, IN-8, IN-9: look a scanned or typed barcode up. An invalid code throws `invalid_barcode`; a source
 * that cannot be reached throws `barcode_lookup_failed`. Both leave the form to manual entry. Nothing is saved:
 * the result only fills the form, and its allergen tags stay unselected until the user selects them (IN-10).
 */
export async function lookupProduct(deps: Deps, raw: string): Promise<ProductLookup> {
  const barcode = normalizeBarcode(raw);
  if (!barcode) throw new NettleError('invalid_barcode');
  const inStore = isInStoreCode(barcode);
  // IN-2: confirmed history is the cache; the source is only asked when the diary has never seen the code.
  const history = await findInHistory(deps, barcode);
  if (history) return { barcode, inStore, product: null, incomplete: false, history };
  const product = await deps.barcode.lookup(barcode);
  return { barcode, inStore, product, incomplete: !!product && (!product.name || product.ingredients.length === 0), history: null };
}
