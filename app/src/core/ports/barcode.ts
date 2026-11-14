import type { Allergen } from '../model/types';

export interface ProductInfo {
  barcode: string;
  name: string;
  ingredients: string[];
  /** The ingredient text is a Polish translation the database holds for a product entered in another language (check it). */
  translated?: boolean;
  /** EU allergen tags the source lists. A suggestion only: the user confirms it (IN-10). */
  allergens: Allergen[];
}

/**
 * IN-9: barcode in; name, ingredients and allergens out. null = not found (fall back to manual entry, IN-8).
 * Throws NettleError('barcode_lookup_failed') when the source cannot be reached or answers badly.
 */
export interface BarcodeSource {
  lookup(barcode: string): Promise<ProductInfo | null>;
}
