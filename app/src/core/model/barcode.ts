import type { Allergen } from './types';

/** Digits only (scanners and people add spaces or dashes). */
const digits = (raw: string) => raw.replace(/[\s-]/g, '');

/** GS1 check digit: from the right, the digit before the check digit counts 3, then 1, 3, ... */
function checksumOk(code: string): boolean {
  const body = code.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += Number(body[body.length - 1 - i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === Number(code.at(-1));
}

/** IN-2: a valid EAN-8, UPC-A (12), EAN-13 or GTIN-14 with a correct check digit, or null. */
export function normalizeBarcode(raw: string): string | null {
  const code = digits(raw);
  return /^\d+$/.test(code) && [8, 12, 13, 14].includes(code.length) && checksumOk(code) ? code : null;
}

/**
 * IN-2: restricted circulation numbers (GS1 prefixes 20 to 29, also UPC-A starting with 2) are in-store codes:
 * a shop prints its own, so the same number can mean different products. The match is ambiguous.
 */
export function isInStoreCode(code: string): boolean {
  if (code.length === 13) return /^2\d/.test(code);
  if (code.length === 12) return code.startsWith('2');
  return false;
}

/** Open Food Facts allergen tags to the 14 EU allergens (IN-10). Unknown tags are ignored. */
const OFF_ALLERGENS: Record<string, Allergen> = {
  'en:gluten': 'gluten',
  'en:crustaceans': 'crustaceans',
  'en:eggs': 'eggs',
  'en:fish': 'fish',
  'en:peanuts': 'peanuts',
  'en:soybeans': 'soybeans',
  'en:milk': 'milk',
  'en:nuts': 'tree_nuts',
  'en:celery': 'celery',
  'en:mustard': 'mustard',
  'en:sesame-seeds': 'sesame',
  'en:sulphur-dioxide-and-sulphites': 'sulphites',
  'en:lupin': 'lupin',
  'en:molluscs': 'molluscs',
};

export function allergensFromTags(tags: readonly unknown[]): Allergen[] {
  const out = new Set<Allergen>();
  for (const tag of tags) if (typeof tag === 'string' && OFF_ALLERGENS[tag]) out.add(OFF_ALLERGENS[tag]!);
  return [...out];
}

/**
 * Splits a printed ingredient list into names: commas and semicolons outside brackets separate, brackets and
 * emphasis marks go, and a trailing percentage goes. "flour (wheat, _barley_), sugar 5%" gives ["flour", "sugar"].
 */
export function parseIngredientText(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    else if ((ch === ',' || ch === ';') && depth === 0) {
      parts.push(cur);
      cur = '';
    } else if (depth === 0) cur += ch;
  }
  parts.push(cur);
  const seen = new Set<string>();
  return parts
    .map((p) =>
      p
        .replace(/[_*]/g, '')
        .replace(/\d+([.,]\d+)?\s*%/g, '')
        .replace(/^\s*(ingredients|składniki)\s*:\s*/i, '')
        .replace(/\.$/, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((p) => {
      const key = p.toLowerCase();
      if (!p || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
