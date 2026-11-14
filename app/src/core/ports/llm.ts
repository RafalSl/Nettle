export type Language = 'en' | 'pl';

/** An image sent with a request (LL-1, LL-6). */
export interface LlmImage {
  mimeType: 'image/jpeg' | 'image/png';
  data: Uint8Array;
}

export interface LlmRequest {
  system: string;
  user: string;
  images?: LlmImage[];
  /** JSON Schema the answer must follow. */
  schema: Record<string, unknown>;
  maxTokens: number;
  /** LL-12: aborting it cancels the call; the adapter then throws `llm_cancelled` and nothing is retried. */
  signal?: AbortSignal;
}

export interface LlmResponse {
  /** The model's answer as JSON text; the core parses and validates it. */
  text: string;
  /** The model that actually answered (LL-7 stores it). */
  model: string;
}

/**
 * LL-10: one provider-neutral interface. Prompts and answer validation live in the core, so a provider adapter
 * only sends one request and returns the JSON text. Adapters throw NettleError with an `llm_*` code (LL-8).
 */
export interface LlmProvider {
  completeJson(req: LlmRequest): Promise<LlmResponse>;
}

/** LL-9: one entry of the list a provider offers for the model setting. */
export interface ModelChoice {
  id: string;
  label: string;
}

/** LL-9, LL-10: provider, model and key come from settings. */
export interface LlmConfig {
  provider: 'anthropic';
  model: string;
  apiKey: string;
}
