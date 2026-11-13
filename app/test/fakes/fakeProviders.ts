import type { BarcodeSource, ProductInfo } from '@/core/ports/barcode';

export class FakeBarcodeSource implements BarcodeSource {
  constructor(private readonly products: Record<string, ProductInfo> = {}) {}
  async lookup(barcode: string) {
    return this.products[barcode] ?? null;
  }
}
