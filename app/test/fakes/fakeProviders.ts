import type { BarcodeSource, ProductInfo } from '@/core/ports/barcode';
import type { AnalysisResult, IngredientEstimate, LlmProvider } from '@/core/ports/llm';

export class FakeBarcodeSource implements BarcodeSource {
  constructor(private readonly products: Record<string, ProductInfo> = {}) {}
  async lookup(barcode: string) {
    return this.products[barcode] ?? null;
  }
}

export class FakeLlmProvider implements LlmProvider {
  async ingredientsFromPhoto(): Promise<IngredientEstimate> {
    return { names: ['Synthetic ingredient'], uncertainty: 'fake estimate' };
  }
  async analyze(): Promise<AnalysisResult> {
    return { hypotheses: [{ text: 'Synthetic hypothesis', evidence: [], uncertainty: 'fake' }] };
  }
}
