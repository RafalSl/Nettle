import { NettleError } from '@/core/model/errors';
import { prepareAnalysis } from '@/core/usecases/analysis';
import { AnalysisRunner } from '@/core/usecases/analysisRunner';
import { saveApiKey } from '@/core/usecases/llm';
import { logMeal } from '@/core/usecases/logMeal';
import { FakeLlm } from './fakes/fakeLlm';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';
import type { LlmProvider, LlmRequest, LlmResponse } from '@/core/ports/llm';

const ANSWER = JSON.stringify({ summary: 'Synthetic summary', hypotheses: [], order_and_lag: 'none', data_limits: [], questions_for_doctor: [] });

async function setup(llm: LlmProvider) {
  const repo = new MemoryRepo();
  const deps = makeDeps(repo, '2026-01-15T10:00:00.000Z', llm);
  await saveApiKey(deps, 'sk-synthetic-secret');
  await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: new Date('2026-01-14T08:00:00.000Z') });
  const prepared = await prepareAnalysis(deps, { dayFrom: '2026-01-10', dayTo: '2026-01-15', language: 'en', photoIds: [] });
  return { deps, repo, prepared, runner: new AnalysisRunner(deps, () => 1000) };
}

/** A provider whose answer arrives when the test says so, and which honours the abort signal. */
class SlowLlm implements LlmProvider {
  release!: (v: LlmResponse | Error) => void;
  requests: LlmRequest[] = [];
  completeJson(req: LlmRequest): Promise<LlmResponse> {
    this.requests.push(req);
    return new Promise((resolve, reject) => {
      this.release = (v) => (v instanceof Error ? reject(v) : resolve(v));
      req.signal?.addEventListener('abort', () => reject(new NettleError('llm_cancelled')));
    });
  }
}

describe('analysis runner (LL-12)', () => {
  it('LL-12 goes idle, running, ready, tells its listeners, and stores one analysis', async () => {
    const { runner, repo, prepared } = await setup(new FakeLlm([ANSWER]));
    const seen: string[] = [];
    runner.subscribe(() => seen.push(runner.state.status));
    expect(runner.state.status).toBe('idle');
    await runner.start(prepared);
    expect(seen).toEqual(['running', 'ready']);
    expect(runner.state).toMatchObject({ status: 'ready', analysis: { dayFrom: '2026-01-10' } });
    expect(await repo.listRecords('analyses')).toHaveLength(1);
  });

  it('LL-12 keeps running without any screen, and a second start while running is ignored', async () => {
    const llm = new SlowLlm();
    const { runner, repo, prepared } = await setup(llm);
    const done = runner.start(prepared);
    await new Promise((r) => setTimeout(r, 0));
    expect(runner.state).toMatchObject({ status: 'running', startedAt: 1000 });
    await runner.start(prepared);
    expect(llm.requests).toHaveLength(1);
    llm.release({ text: ANSWER, model: 'fake-model' });
    await done;
    expect(runner.state.status).toBe('ready');
    expect(await repo.listRecords('analyses')).toHaveLength(1);
  });

  it('LL-12 Cancel stores nothing, even when the answer arrives at the same moment', async () => {
    const llm = new SlowLlm();
    const { runner, repo, prepared } = await setup(llm);
    const done = runner.start(prepared);
    await new Promise((r) => setTimeout(r, 0));
    runner.cancel();
    llm.release({ text: ANSWER, model: 'fake-model' });
    await done;
    expect(runner.state.status).toBe('cancelled');
    expect(await repo.listRecords('analyses')).toEqual([]);
  });

  it('LL-8, LL-12 a failure stores nothing and a one-tap retry sends the same request again', async () => {
    const llm = new FakeLlm([new NettleError('llm_rate_limited'), ANSWER]);
    const { runner, repo, prepared } = await setup(llm);
    await runner.start(prepared);
    expect(runner.state).toMatchObject({ status: 'failed', error: { code: 'llm_rate_limited' } });
    expect(await repo.listRecords('analyses')).toEqual([]);
    await runner.retry();
    expect(runner.state.status).toBe('ready');
    expect(llm.requests[1]).toEqual(llm.requests[0]);
  });

  it('LL-12 a connection failure after the app was left is an interruption, any other failure stays a failure', async () => {
    const left = await setup(new FakeLlm([new NettleError('llm_network')]));
    const done = left.runner.start(left.prepared);
    left.runner.markBackgrounded();
    await done;
    expect(left.runner.state.status).toBe('interrupted');
    expect(await left.repo.listRecords('analyses')).toEqual([]);

    const rejected = await setup(new FakeLlm([new NettleError('llm_invalid_key')]));
    const done2 = rejected.runner.start(rejected.prepared);
    rejected.runner.markBackgrounded();
    await done2;
    expect(rejected.runner.state.status).toBe('failed');

    const stayed = await setup(new FakeLlm([new NettleError('llm_network')]));
    await stayed.runner.start(stayed.prepared); // never left the app
    expect(stayed.runner.state.status).toBe('failed');
  });

  it('LL-12 dismiss clears a finished outcome but never a running one', async () => {
    const llm = new SlowLlm();
    const { runner, prepared } = await setup(llm);
    const done = runner.start(prepared);
    await new Promise((r) => setTimeout(r, 0));
    runner.dismiss();
    expect(runner.state.status).toBe('running');
    llm.release({ text: ANSWER, model: 'fake-model' });
    await done;
    runner.dismiss();
    expect(runner.state.status).toBe('idle');
  });
});
