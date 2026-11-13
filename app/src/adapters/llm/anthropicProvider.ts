import Anthropic from '@anthropic-ai/sdk';
import { NettleError } from '@/core/model/errors';
import type { LlmConfig, LlmProvider, LlmRequest, LlmResponse } from '@/core/ports/llm';
import { bytesToBase64 } from '@/core/util/base64';

/** LL-8: turn an SDK error into a stable code the UI can explain. Never includes the key or the request. */
export function mapAnthropicError(e: unknown): NettleError {
  if (e instanceof NettleError) return e;
  if (e instanceof Anthropic.AuthenticationError) return new NettleError('llm_invalid_key');
  if (e instanceof Anthropic.PermissionDeniedError) return new NettleError('llm_permission');
  if (e instanceof Anthropic.NotFoundError) return new NettleError('llm_model_not_found');
  if (e instanceof Anthropic.RateLimitError) return new NettleError('llm_rate_limited');
  if (e instanceof Anthropic.APIConnectionError) return new NettleError('llm_network');
  if (e instanceof Anthropic.APIError) {
    if (e.status === 402 || e.type === 'billing_error') return new NettleError('llm_billing');
    if (e.status !== undefined && e.status >= 500) return new NettleError('llm_unavailable');
  }
  return new NettleError('llm_failed');
}

/**
 * LL-10: the Anthropic adapter. It sends one request with a JSON-schema answer format and returns the text.
 * `dangerouslyAllowBrowser` is set because the app runs on the phone with the user's own key from the Keychain
 * (bring your own key, SE-2); there is no shared secret and no backend.
 */
export function createAnthropicProvider(config: LlmConfig): LlmProvider {
  const client = new Anthropic({ apiKey: config.apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });

  return {
    async completeJson(req: LlmRequest): Promise<LlmResponse> {
      try {
        const content: Anthropic.ContentBlockParam[] = [
          ...(req.images ?? []).map(
            (img): Anthropic.ContentBlockParam => ({
              type: 'image',
              source: { type: 'base64', media_type: img.mimeType, data: bytesToBase64(img.data) },
            }),
          ),
          { type: 'text', text: req.user },
        ];
        const response = await client.messages.create({
          model: config.model,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: [{ role: 'user', content }],
          output_config: { format: { type: 'json_schema', schema: req.schema } },
        });
        if (response.stop_reason === 'refusal') throw new NettleError('llm_refused');
        if (response.stop_reason === 'max_tokens') throw new NettleError('llm_bad_response');
        const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
        if (!text) throw new NettleError('llm_bad_response');
        return { text, model: response.model };
      } catch (e) {
        throw mapAnthropicError(e);
      }
    },
  };
}
