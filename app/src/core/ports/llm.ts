import type { DateRange, Snapshot } from '../model/types';

export type Language = 'en' | 'pl';

export interface IngredientEstimate {
  /** Suggestions only: never saved until the user confirms (IN-3). */
  names: string[];
  uncertainty: string | null;
}

export interface Hypothesis {
  text: string;
  evidence: string[];
  uncertainty: string;
}

export interface AnalysisRequest {
  range: DateRange;
  data: Snapshot;
  language: Language;
  windowsHours: number[];
}

export interface AnalysisResult {
  /** Tentative hypotheses only, never conclusions (LL-4). */
  hypotheses: Hypothesis[];
}

/** LL-10: provider-agnostic. One adapter per provider; model and key come from settings. */
export interface LlmProvider {
  ingredientsFromPhoto(req: {
    image: Uint8Array;
    mimeType: string;
    language: Language;
  }): Promise<IngredientEstimate>;
  analyze(req: AnalysisRequest): Promise<AnalysisResult>;
}
