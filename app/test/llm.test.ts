import Anthropic from '@anthropic-ai/sdk';
import { mapAnthropicError } from '@/adapters/llm/anthropicProvider';
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

describe('Anthropic error mapping (LL-8)', () => {
  const api = (status: number, type?: string) =>
    Anthropic.APIError.generate(status, { type: 'error', error: { type: type ?? 'x', message: 'm' } }, 'm', new Headers());

  it('maps each failure to a stable code without leaking details', () => {
    const codeOf = (e: unknown) => mapAnthropicError(e).code;
    expect(codeOf(api(401, 'authentication_error'))).toBe('llm_invalid_key');
    expect(codeOf(api(403, 'permission_error'))).toBe('llm_permission');
    expect(codeOf(api(404, 'not_found_error'))).toBe('llm_model_not_found');
    expect(codeOf(api(429, 'rate_limit_error'))).toBe('llm_rate_limited');
    expect(codeOf(api(402, 'billing_error'))).toBe('llm_billing');
    expect(codeOf(api(529, 'overloaded_error'))).toBe('llm_unavailable');
    expect(codeOf(api(500, 'api_error'))).toBe('llm_unavailable');
    expect(codeOf(new Anthropic.APIConnectionError({ message: 'offline' }))).toBe('llm_network');
    expect(codeOf(new Error('boom'))).toBe('llm_failed');
    expect(mapAnthropicError(new Error('sk-secret-123')).message).not.toContain('sk-secret');
  });
});
