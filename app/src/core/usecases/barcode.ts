import { isInStoreCode, normalizeBarcode } from '../model/barcode';
import { NettleError } from '../model/errors';
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
}

/**
 * IN-2, IN-8, IN-9: look a scanned or typed barcode up. An invalid code throws `invalid_barcode`; a source
 * that cannot be reached throws `barcode_lookup_failed`. Both leave the form to manual entry. Nothing is saved:
 * the result only fills the form, and its allergen tags stay unselected until the user selects them (IN-10).
 */
export async function lookupProduct(deps: Deps, raw: string): Promise<ProductLookup> {
  const barcode = normalizeBarcode(raw);
  if (!barcode) throw new NettleError('invalid_barcode');
  const product = await deps.barcode.lookup(barcode);
  return {
    barcode,
    inStore: isInStoreCode(barcode),
    product,
    incomplete: !!product && (!product.name || product.ingredients.length === 0),
  };
}
