import type { LlmProvider, LlmRequest, LlmResponse } from '@/core/ports/llm';

/** Scripted provider: answers are returned in order; an Error in the list is thrown. Requests are recorded. */
export class FakeLlm implements LlmProvider {
  requests: LlmRequest[] = [];
  constructor(
    private answers: (string | Error)[] = [],
    private model = 'fake-model',
  ) {}
  async completeJson(req: LlmRequest): Promise<LlmResponse> {
    this.requests.push(req);
    const next = this.answers.shift();
    if (next === undefined) throw new Error('no scripted answer');
    if (next instanceof Error) throw next;
    return { text: next, model: this.model };
  }
}
