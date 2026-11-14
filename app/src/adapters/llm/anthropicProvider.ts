import { NettleError } from '@/core/model/errors';
import type { LlmConfig, LlmProvider, LlmRequest, LlmResponse } from '@/core/ports/llm';
import { bytesToBase64 } from '@/core/util/base64';

/**
 * LL-10: the Anthropic adapter, talking to the Messages API over plain HTTPS with `fetch`.
 *
 * Why not the official SDK: its ESM build has a circular import between its beta modules that Metro cannot
 * evaluate, so the app crashed at start-up on the phone. The request here is one POST with a JSON body, which
 * the API documents as raw HTTP, so the adapter stays small and has no extra dependency.
 */
const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2026-10-21';
const MAX_RETRIES = 2;
const TIMEOUT_MS = 10 * 60 * 1000;

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{
  status: number;
  text(): Promise<string>;
}>;

/** LL-8: turn an HTTP failure into a stable code the UI can explain. Never includes the key, the request or the body. */
export function mapHttpError(status: number, errorType?: string): NettleError {
  if (status === 401 || errorType === 'authentication_error') return new NettleError('llm_invalid_key');
  if (status === 402 || errorType === 'billing_error') return new NettleError('llm_billing');
  if (status === 403 || errorType === 'permission_error') return new NettleError('llm_permission');
  if (status === 404 || errorType === 'not_found_error') return new NettleError('llm_model_not_found');
  if (status === 429 || errorType === 'rate_limit_error') return new NettleError('llm_rate_limited');
  if (status >= 500) return new NettleError('llm_unavailable');
  return new NettleError('llm_failed');
}

const retryable = (status: number) => status === 408 || status === 409 || status === 429 || status >= 500;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The request body for one JSON-schema answer, with optional images (LL-1, LL-6). */
export function buildBody(model: string, req: LlmRequest) {
  return {
    model,
    max_tokens: req.maxTokens,
    system: req.system,
    messages: [
      {
        role: 'user',
        content: [
          ...(req.images ?? []).map((img) => ({
            type: 'image',
            source: { type: 'base64', media_type: img.mimeType, data: bytesToBase64(img.data) },
          })),
          { type: 'text', text: req.user },
        ],
      },
    ],
    output_config: { format: { type: 'json_schema', schema: req.schema } },
  };
}

/** Reads a successful response. A refusal or a cut-off answer is an error: nothing partial is ever used. */
export function readResponse(json: unknown): LlmResponse {
  const r = json as { stop_reason?: string; model?: string; content?: { type: string; text?: string }[] } | null;
  if (!r || typeof r !== 'object' || !Array.isArray(r.content)) throw new NettleError('llm_bad_response');
  if (r.stop_reason === 'refusal') throw new NettleError('llm_refused');
  if (r.stop_reason === 'max_tokens') throw new NettleError('llm_bad_response');
  const text = r.content.flatMap((b) => (b.type === 'text' && typeof b.text === 'string' ? [b.text] : [])).join('');
  if (!text) throw new NettleError('llm_bad_response');
  return { text, model: typeof r.model === 'string' ? r.model : 'unknown' };
}

export function createAnthropicProvider(config: LlmConfig, fetchImpl: FetchLike = fetch as unknown as FetchLike): LlmProvider {
  return {
    async completeJson(req: LlmRequest): Promise<LlmResponse> {
      const body = JSON.stringify(buildBody(config.model, req));
      const headers = {
        'content-type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': API_VERSION,
      };
      for (let attempt = 0; ; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          let res;
          try {
            res = await fetchImpl(ENDPOINT, { method: 'POST', headers, body, signal: controller.signal });
          } catch {
            // No connection, DNS or TLS failure, or the timeout above. Details are not kept: they are not needed and could echo the request.
            if (attempt < MAX_RETRIES) {
              await sleep(500 * 2 ** attempt);
              continue;
            }
            throw new NettleError('llm_network');
          }
          const raw = await res.text();
          let parsed: unknown = null;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = null;
          }
          if (res.status >= 200 && res.status < 300) return readResponse(parsed);
          if (retryable(res.status) && attempt < MAX_RETRIES) {
            await sleep(500 * 2 ** attempt);
            continue;
          }
          const errorType = (parsed as { error?: { type?: string } } | null)?.error?.type;
          throw mapHttpError(res.status, errorType);
        } finally {
          clearTimeout(timer);
        }
      }
    },
  };
}
