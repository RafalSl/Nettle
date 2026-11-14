import { NettleError } from '@/core/model/errors';
import type { BarcodeSource, ProductInfo } from '@/core/ports/barcode';

/** Scripted barcode source: known products by code; a code listed in `failing` throws like an unreachable source. */
export class FakeBarcode implements BarcodeSource {
  lookups: string[] = [];
  failing = new Set<string>();
  constructor(private products: Record<string, ProductInfo> = {}) {}
  async lookup(barcode: string): Promise<ProductInfo | null> {
    this.lookups.push(barcode);
    if (this.failing.has(barcode)) throw new NettleError('barcode_lookup_failed');
    return this.products[barcode] ?? null;
  }
}
