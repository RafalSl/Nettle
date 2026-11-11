export interface ProductInfo {
  barcode: string;
  name: string;
  ingredients: string[];
  allergens: string[];
}

/** IN-9: barcode in; name, ingredients, allergens out. null = not found (fall back to manual, IN-8). */
export interface BarcodeSource {
  lookup(barcode: string): Promise<ProductInfo | null>;
}
