import { labelPrompt, LABEL_PROMPT_VERSION } from '@/core/llm/prompts';
import { parseLabelScan } from '@/core/llm/parse';
import { NettleError } from '@/core/model/errors';
import { ALLERGENS } from '@/core/model/types';
import { saveApiKey, scanLabel, setModel } from '@/core/usecases/llm';
import { FakeLlm } from './fakes/fakeLlm';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';
import { errorCode } from './helpers/errors';

const image = { mimeType: 'image/jpeg' as const, data: new Uint8Array([1, 2, 3]) };
const answer = (over: object = {}) =>
  JSON.stringify({
    ingredients: ['mleko (3,2%)', ' cukier ', 'cukier', ''],
    allergens: ['milk', 'gold', 'milk'],
    traces: ['peanuts'],
    text_read: ' Składniki: mleko, cukier ',
    note: '  ',
    ...over,
  });

describe('label scan (IN-15, LL-13)', () => {
  it('LL-13 keeps the label text as printed, drops unknown allergen ids and duplicates, and keeps traces apart', () => {
    expect(parseLabelScan(answer())).toEqual({
      ingredients: ['mleko (3,2%)', 'cukier'],
      allergens: ['milk'],
      traces: ['peanuts'],
      textRead: 'Składniki: mleko, cukier',
      note: null,
    });
    expect(parseLabelScan(answer({ note: 'The last line is cut off.' })).note).toBe('The last line is cut off.');
  });

  it('LL-13 an answer of the wrong shape is llm_bad_response, never a partial result', () => {
    for (const text of [
      'not json',
      '[]',
      answer({ ingredients: 'milk' }),
      answer({ allergens: [1] }),
      answer({ text_read: null }),
      answer({ note: 5 }),
    ]) {
      expect(() => parseLabelScan(text)).toThrow(NettleError);
    }
  });

  it('LL-13 the prompt asks for the text as printed and for a note on unreadable parts, and lists the allergen ids', () => {
    const p = labelPrompt('pl', ALLERGENS);
    expect(p.system).toMatch(/exactly as printed/);
    expect(p.system).toMatch(/unreadable/);
    expect(p.system).toContain('Polish');
    for (const a of ALLERGENS) expect(p.system).toContain(a);
    expect(p.schema.required).toEqual(['ingredients', 'allergens', 'traces', 'text_read', 'note']);
  });

  it('IN-15, IN-16 scanLabel sends the photo with the label_scan model and returns its provenance, saving nothing', async () => {
    const llm = new FakeLlm([answer()]);
    const repo = new MemoryRepo();
    const deps = makeDeps(repo, undefined, llm);
    await saveApiKey(deps, 'synthetic-test-key');
    const seen: string[] = [];
    const spy = { ...deps, llmFor: (c: { model: string }) => (seen.push(c.model), { completeJson: (r: never) => llm.completeJson(r) }) };
    await setModel(spy, 'label_scan', 'claude-sonnet-5-5');
    const out = await scanLabel(spy, { image, language: 'en' });
    expect(seen).toEqual(['claude-sonnet-5-5']);
    expect(out.provenance).toMatchObject({ promptVersion: LABEL_PROMPT_VERSION });
    expect(llm.requests[0]!.images).toEqual([image]);
    expect(await repo.listRecords('meals')).toEqual([]);
  });

  it('SE-2 without a key nothing is sent', async () => {
    const llm = new FakeLlm([answer()]);
    const deps = makeDeps(new MemoryRepo(), undefined, llm);
    expect(await errorCode(scanLabel(deps, { image, language: 'en' }))).toBe('llm_no_key');
    expect(llm.requests).toHaveLength(0);
  });
});
