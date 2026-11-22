import { NettleError, type ErrorCode } from '../model/errors';
import type { Analysis } from '../model/types';
import { runAnalysis, type PreparedAnalysis } from './analysis';
import type { Deps } from './deps';

/** LL-12: the state of the one analysis run the app allows at a time. */
export type AnalysisRun =
  | { status: 'idle' }
  | { status: 'running'; prepared: PreparedAnalysis; startedAt: number }
  | { status: 'ready'; analysis: Analysis }
  /** The user cancelled. Nothing was stored. */
  | { status: 'cancelled' }
  /** A failure (LL-8). Nothing was stored; `prepared` allows a one-tap retry of the same request. */
  | { status: 'failed'; prepared: PreparedAnalysis; error: unknown }
  /** The app was left during the run and the request did not survive. Nothing was stored; retry is one tap. */
  | { status: 'interrupted'; prepared: PreparedAnalysis };

/** Failures that can come from a request cut off by leaving the app, as opposed to a rejected key or an unreadable answer. */
const CONNECTION_LIKE: readonly ErrorCode[] = ['llm_network', 'llm_unavailable', 'llm_timeout'];

/**
 * LL-12: runs an analysis outside any screen, so leaving the screen inside the app does not stop it and the
 * Review tab can show a running or ready card. Platform-free: the app tells it when it was backgrounded.
 */
export class AnalysisRunner {
  private current: AnalysisRun = { status: 'idle' };
  private listeners = new Set<() => void>();
  private controller: AbortController | null = null;
  private backgrounded = false;

  constructor(
    private readonly deps: Deps,
    private readonly now: () => number = Date.now,
  ) {}

  get state(): AnalysisRun {
    return this.current;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(next: AnalysisRun) {
    this.current = next;
    for (const l of [...this.listeners]) l();
  }

  /** Starts the run and resolves when it ended, whatever the outcome (see `state`). Ignored while one is running. */
  async start(prepared: PreparedAnalysis): Promise<void> {
    if (this.current.status === 'running') return;
    const controller = new AbortController();
    this.controller = controller;
    this.backgrounded = false;
    this.set({ status: 'running', prepared, startedAt: this.now() });
    try {
      this.set({ status: 'ready', analysis: await runAnalysis(this.deps, prepared, controller.signal) });
    } catch (error) {
      const code = error instanceof NettleError ? error.code : null;
      if (code === 'llm_cancelled') this.set({ status: 'cancelled' });
      else if (this.backgrounded && (code === null || CONNECTION_LIKE.includes(code))) this.set({ status: 'interrupted', prepared });
      else this.set({ status: 'failed', prepared, error });
    } finally {
      this.controller = null;
    }
  }

  /** One-tap retry of the same prepared request after a failure or an interruption. */
  async retry(): Promise<void> {
    const s = this.current;
    if (s.status === 'failed' || s.status === 'interrupted') await this.start(s.prepared);
  }

  /** Aborts the request. Nothing is stored; the note on the screen says work already started may still be billed. */
  cancel(): void {
    this.controller?.abort();
  }

  /** The app went to the background while a run was in progress. */
  markBackgrounded(): void {
    if (this.current.status === 'running') this.backgrounded = true;
  }

  /** Forgets a finished outcome (a ready card that was looked at, a cancel or failure note). Does not touch a running one. */
  dismiss(): void {
    if (this.current.status !== 'running') this.set({ status: 'idle' });
  }
}

/** LL-12: what a Review output card says about the run: nothing for idle or cancelled, else a state and, while running, the seconds so far. */
export type RunCardStatus = { state: 'running'; seconds: number } | { state: 'ready' | 'interrupted' | 'failed' } | null;

export function runCardStatus(run: AnalysisRun, nowMs: number): RunCardStatus {
  switch (run.status) {
    case 'running':
      return { state: 'running', seconds: Math.max(0, Math.floor((nowMs - run.startedAt) / 1000)) };
    case 'ready':
    case 'interrupted':
    case 'failed':
      return { state: run.status };
    default:
      return null;
  }
}

/** LL-12: seconds as "m:ss" for the elapsed time of a call. */
export const formatElapsed = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
