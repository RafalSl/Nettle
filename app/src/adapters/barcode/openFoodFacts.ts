import { allergensFromTags, parseIngredientText } from '@/core/model/barcode';
import { NettleError } from '@/core/model/errors';
import type { BarcodeSource, ProductInfo } from '@/core/ports/barcode';

const FIELDS = 'code,product_name,ingredients_text,ingredients_text_pl,lang,allergens_tags';

/** Turns an Open Food Facts v2 answer into a product, or null when the product is not in the database. */
export function parseOffResponse(barcode: string, json: unknown): ProductInfo | null {
  if (typeof json !== 'object' || json === null) throw new NettleError('barcode_lookup_failed');
  const body = json as { status?: unknown; product?: Record<string, unknown> };
  if (body.status === 0) return null;
  if (body.status !== 1 || typeof body.product !== 'object' || body.product === null) throw new NettleError('barcode_lookup_failed');
  const p = body.product;
  // The Polish text is preferred when the database has one. It is a translation unless the product was entered in Polish.
  const pl = typeof p.ingredients_text_pl === 'string' ? p.ingredients_text_pl.trim() : '';
  const text = pl || (typeof p.ingredients_text === 'string' ? p.ingredients_text : '');
  const translated = pl !== '' && p.lang !== 'pl';
  return {
    barcode,
    name: typeof p.product_name === 'string' ? p.product_name.trim() : '',
    ingredients: parseIngredientText(text),
    ...(translated ? { translated: true } : {}),
    allergens: Array.isArray(p.allergens_tags) ? allergensFromTags(p.allergens_tags) : [],
  };
}

/**
 * IN-9: Open Food Facts as the first barcode source. Only the barcode leaves the phone, in the URL; the
 * User-Agent names the app without any personal contact details.
 */
export const openFoodFacts: BarcodeSource = {
  async lookup(barcode) {
    let res: Response;
    try {
      res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`, {
        headers: { 'User-Agent': 'Nettle/1.0 (private diary app)', Accept: 'application/json' },
      });
    } catch {
      throw new NettleError('barcode_lookup_failed');
    }
    // An unknown product answers 404 with a JSON body that says status 0.
    if (!res.ok && res.status !== 404) throw new NettleError('barcode_lookup_failed');
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new NettleError('barcode_lookup_failed');
    }
    return parseOffResponse(barcode, json);
  },
};
