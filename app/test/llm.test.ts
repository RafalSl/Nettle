import { buildBody, createAnthropicProvider, mapHttpError, readResponse } from '@/adapters/llm/anthropicProvider';
import { SqliteSettings } from '@/adapters/storage/sqliteSettings';
import { SqliteRepo } from '@/adapters/storage/sqliteRepo';
import { ingredientsPrompt } from '@/core/llm/prompts';
import { parseIngredientEstimate } from '@/core/llm/parse';
import { NettleError } from '@/core/model/errors';
import { bytesToBase64 } from '@/core/util/base64';
import {
  DEFAULT_MODEL,
  deleteApiKey,
  estimateIngredients,
  getModel,
  hasApiKey,
  saveApiKey,
  setModel,
} from '@/core/usecases/llm';
import { FakeLlm } from './fakes/fakeLlm';
import { MemoryRepo } from './fakes/memoryRepo';
import { createNodeSqliteDb } from './helpers/nodeSqliteDb';
import { makeDeps } from './helpers/fixtures';

const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );
const image = { mimeType: 'image/jpeg' as const, data: new Uint8Array([1, 2, 3]) };

describe('bytesToBase64', () => {
  it.each([0, 1, 2, 3, 4, 5, 255, 1000])('matches Buffer for %i bytes', (n) => {
    const bytes = new Uint8Array(n).map((_, i) => (i * 37 + 11) % 256);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });
});

describe('API key and model settings (SE-2, SE-4, LL-9)', () => {
  it('SE-2 stores, reports and deletes the key without ever returning it', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await hasApiKey(deps)).toBe(false);
    await saveApiKey(deps, '  synthetic-test-key  ');
    expect(await hasApiKey(deps)).toBe(true);
    expect(await deps.keys.get('anthropic_api_key')).toBe('synthetic-test-key');
    await saveApiKey(deps, 'synthetic-rotated-key'); // SE-5 rotation replaces it
    expect(await deps.keys.get('anthropic_api_key')).toBe('synthetic-rotated-key');
    await deleteApiKey(deps);
    expect(await hasApiKey(deps)).toBe(false);
    expect(await code(saveApiKey(deps, '   '))).toBe('empty_key');
  });

  it('LL-9 the model is a setting with a default, and clearing it restores the default', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await getModel(deps)).toBe(DEFAULT_MODEL);
    await setModel(deps, ' claude-sonnet-5-5 ');
    expect(await getModel(deps)).toBe('claude-sonnet-5-5');
    await setModel(deps, ' ');
    expect(await getModel(deps)).toBe(DEFAULT_MODEL);
  });

  it('LL-9 the SQLite settings store keeps values, overwrites and deletes', async () => {
    const db = createNodeSqliteDb();
    await SqliteRepo.open(db);
    const s = new SqliteSettings(db);
    expect(await s.get('k')).toBeNull();
    await s.set('k', 'a');
    await s.set('k', 'b');
    expect(await s.get('k')).toBe('b');
    await s.delete('k');
    expect(await s.get('k')).toBeNull();
  });
});

describe('ingredient estimate (LL-1, IN-3)', () => {
  it('IN-3 returns cleaned suggestions and sends the photo, language and a JSON schema', async () => {
    const llm = new FakeLlm(['{"ingredients":[" tomato ","tomato","","bread"],"uncertainty":" sauce? "}']);
    const deps = makeDeps(new MemoryRepo(), undefined, llm);
    await saveApiKey(deps, 'synthetic-test-key');
    const est = await estimateIngredients(deps, { image, language: 'pl' });
    expect(est).toEqual({ names: ['tomato', 'bread'], uncertainty: 'sauce?' });
    const req = llm.requests[0]!;
    expect(req.images).toEqual([image]);
    expect(req.system).toContain('Polish');
    expect(req.schema).toMatchObject({ type: 'object', required: ['ingredients', 'uncertainty'] });
  });

  it('LL-1 without a key it fails with llm_no_key before anything is sent', async () => {
    const llm = new FakeLlm(['{}']);
    const deps = makeDeps(new MemoryRepo(), undefined, llm);
    expect(await code(estimateIngredients(deps, { image, language: 'en' }))).toBe('llm_no_key');
    expect(llm.requests).toHaveLength(0);
  });

  it('LL-8 a provider error reaches the caller unchanged and nothing is saved', async () => {
    const llm = new FakeLlm([new NettleError('llm_rate_limited')]);
    const repo = new MemoryRepo();
    const deps = makeDeps(repo, undefined, llm);
    await saveApiKey(deps, 'synthetic-test-key');
    expect(await code(estimateIngredients(deps, { image, language: 'en' }))).toBe('llm_rate_limited');
    expect(await repo.listMeals()).toEqual([]);
  });

  it('LL-8 malformed answers are llm_bad_response', () => {
    for (const bad of ['not json', '[]', '{}', '{"ingredients":"tomato"}', '{"ingredients":[1]}', '{"ingredients":[],"uncertainty":3}']) {
      expect(() => parseIngredientEstimate(bad)).toThrow(NettleError);
    }
    expect(parseIngredientEstimate('{"ingredients":[],"uncertainty":null}')).toEqual({ names: [], uncertainty: null });
  });

  it('LL-10 the prompt is provider-neutral and follows the language (LL-11)', () => {
    expect(ingredientsPrompt('en').system).toContain('English');
    expect(ingredientsPrompt('pl').system).toContain('Polish');
    expect(JSON.stringify(ingredientsPrompt('en'))).not.toMatch(/anthropic|claude/i);
  });
});

describe('Anthropic adapter over fetch (LL-8, LL-10)', () => {
  const config = { provider: 'anthropic' as const, model: 'claude-test', apiKey: 'sk-synthetic-secret' };
  const req = { system: 'sys', user: 'usr', schema: { type: 'object' }, maxTokens: 100, images: [image] };
  const ok = (over: object = {}) => ({
    status: 200,
    text: async () => JSON.stringify({ model: 'claude-test', stop_reason: 'end_turn', content: [{ type: 'text', text: '{"a":1}' }], ...over }),
  });
  const fail = (status: number, type?: string) => ({ status, text: async () => JSON.stringify({ type: 'error', error: { type, message: 'm sk-synthetic-secret' } }) });
  const noWait = () => jest.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => (fn(), 0)) as never);
  afterEach(() => jest.restoreAllMocks());

  it('LL-1 sends one POST with the key in a header, the image as base64 and a JSON-schema answer format', async () => {
    const calls: { url: string; init: { headers: Record<string, string>; body: string } }[] = [];
    const provider = createAnthropicProvider(config, async (url, init) => (calls.push({ url, init }), ok()));
    expect(await provider.completeJson(req)).toEqual({ text: '{"a":1}', model: 'claude-test' });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.anthropic.com/v1/messages');
    expect(calls[0]!.init.headers['x-api-key']).toBe('sk-synthetic-secret');
    expect(calls[0]!.init.headers['anthropic-version']).toBe('2026-10-21');
    expect(calls[0]!.init.body).not.toContain('sk-synthetic-secret'); // the key is never in the body
    const body = JSON.parse(calls[0]!.init.body);
    expect(body).toMatchObject({ model: 'claude-test', max_tokens: 100, system: 'sys', output_config: { format: { type: 'json_schema', schema: { type: 'object' } } } });
    expect(body.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AQID' } });
    expect(body.messages[0].content[1]).toEqual({ type: 'text', text: 'usr' });
  });

  it('LL-8 maps each failure to a stable code and never leaks the key', () => {
    const codeOf = (status: number, type?: string) => mapHttpError(status, type).code;
    expect(codeOf(401, 'authentication_error')).toBe('llm_invalid_key');
    expect(codeOf(403, 'permission_error')).toBe('llm_permission');
    expect(codeOf(404, 'not_found_error')).toBe('llm_model_not_found');
    expect(codeOf(429, 'rate_limit_error')).toBe('llm_rate_limited');
    expect(codeOf(402, 'billing_error')).toBe('llm_billing');
    expect(codeOf(529, 'overloaded_error')).toBe('llm_unavailable');
    expect(codeOf(500, 'api_error')).toBe('llm_unavailable');
    expect(codeOf(400, 'invalid_request_error')).toBe('llm_failed');
  });

  it.each([
    [401, 'authentication_error', 'llm_invalid_key'],
    [402, 'billing_error', 'llm_billing'],
    [404, 'not_found_error', 'llm_model_not_found'],
    [400, 'invalid_request_error', 'llm_failed'],
  ])('LL-8 HTTP %i is not retried and becomes %s → %s', async (status, type, expected) => {
    let n = 0;
    const provider = createAnthropicProvider(config, async () => (n++, fail(status, type)));
    const error = await provider.completeJson(req).catch((e) => e);
    expect(error).toBeInstanceOf(NettleError);
    expect(error.code).toBe(expected);
    expect(error.message).not.toContain('sk-synthetic-secret');
    expect(n).toBe(1);
  });

  it('LL-8 rate limits and server errors are retried twice, then reported', async () => {
    noWait();
    let n = 0;
    const provider = createAnthropicProvider(config, async () => (n++, fail(429, 'rate_limit_error')));
    expect((await provider.completeJson(req).catch((e) => e)).code).toBe('llm_rate_limited');
    expect(n).toBe(3);
    let m = 0;
    const flaky = createAnthropicProvider(config, async () => (++m < 3 ? fail(529, 'overloaded_error') : ok()));
    expect((await flaky.completeJson(req)).text).toBe('{"a":1}');
    expect(m).toBe(3);
  });

  it('LL-8 a lost connection is llm_network after the retries, with no details kept', async () => {
    noWait();
    let n = 0;
    const provider = createAnthropicProvider(config, async () => {
      n++;
      throw new Error('Network request failed for sk-synthetic-secret');
    });
    const error = await provider.completeJson(req).catch((e) => e);
    expect(error.code).toBe('llm_network');
    expect(error.message).not.toContain('sk-synthetic-secret');
    expect(n).toBe(3);
  });

  it('LL-8 refusals, cut-off and empty or unreadable answers are errors, never partial results', () => {
    expect(() => readResponse({ stop_reason: 'refusal', content: [] })).toThrow('llm_refused');
    expect(() => readResponse({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{' }] })).toThrow('llm_bad_response');
    expect(() => readResponse({ stop_reason: 'end_turn', content: [] })).toThrow('llm_bad_response');
    expect(() => readResponse(null)).toThrow('llm_bad_response');
    expect(() => readResponse({ content: 'x' })).toThrow('llm_bad_response');
    expect(readResponse({ stop_reason: 'end_turn', model: 'm', content: [{ type: 'thinking' }, { type: 'text', text: 'a' }, { type: 'text', text: 'b' }] })).toEqual({ text: 'ab', model: 'm' });
  });

  it('LL-8 a 200 response that is not JSON is llm_bad_response', async () => {
    const provider = createAnthropicProvider(config, async () => ({ status: 200, text: async () => '<html>' }));
    expect((await provider.completeJson(req).catch((e) => e)).code).toBe('llm_bad_response');
  });

  it('LL-6 builds a text-only body when there are no images', () => {
    expect(buildBody('m', { ...req, images: undefined }).messages[0]!.content).toEqual([{ type: 'text', text: 'usr' }]);
  });
});
