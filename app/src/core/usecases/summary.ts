import { buildAnalysisInput } from '../llm/analysisInput';
import { parseSummary } from '../llm/parse';
import { SUMMARY_PROMPT_VERSION, summaryPrompt } from '../llm/summaryPrompt';
import { NettleError } from '../model/errors';
import { addDays, localDay, makeStamp } from '../model/time';
import type { LocalDay, ReportSummary } from '../model/types';
import type { Language, LlmRequest } from '../ports/llm';
import { MAX_INPUT_CHARS } from './analysis';
import { getPreferences } from './preferences';
import type { Deps } from './deps';
import { currentProvider, getModel } from './llm';

export interface SummarySelection {
  dayFrom: LocalDay;
  dayTo: LocalDay;
  /** EX-3: the report's language; the summary is written in it. */
  language: Language;
}

/** LL-5: exactly what a summary run sends, for the confirmation before anything leaves the phone. Never photos. */
export interface PreparedSummary extends SummarySelection {
  model: string;
  promptVersion: string;
  /** Records sent by kind, plus `days`, `completeDays` and `lookbackDays`. */
  counts: Record<string, number>;
  sentCharacters: number;
  request: LlmRequest;
}

/** What the model wrote, before the person has reviewed it. Nothing is stored yet. */
export interface SummaryDraft {
  selection: SummarySelection;
  model: string;
  promptVersion: string;
  counts: Record<string, number>;
  text: string;
}

const validDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && addDays(d, 0) === d;

/**
 * LL-14: turns the doctor report's period (open ends allowed) into concrete diary days: an open start becomes the
 * first day that has an entry, an open end today (NF-7). Null when the diary has nothing to summarize.
 */
export async function summaryDays(deps: Deps, days: { from?: string; to?: string }): Promise<{ dayFrom: LocalDay; dayTo: LocalDay } | null> {
  const start = deps.dayStart.get();
  const tz = deps.clock.timeZone();
  const today = localDay(deps.clock.now().toISOString(), tz, start);
  let dayFrom = days.from;
  if (!dayFrom) {
    const snap = await deps.repo.snapshot();
    const all = [...snap.meals, ...snap.skinEntries, ...snap.nailEntries, ...snap.checkIns, ...snap.drinks, ...snap.stoolEntries, ...snap.medicalEvents].map((r) => localDay(r.at.utc, r.at.tz, start));
    dayFrom = all.sort()[0];
  }
  const dayTo = days.to ?? today;
  return dayFrom && dayFrom <= dayTo ? { dayFrom, dayTo } : null;
}

/** LL-14, LL-2, LL-5: build the request from the same diary data as the analysis, without photos. Sends nothing, changes nothing. */
export async function prepareSummary(deps: Deps, sel: SummarySelection): Promise<PreparedSummary> {
  if (!validDay(sel.dayFrom) || !validDay(sel.dayTo) || sel.dayFrom > sel.dayTo) throw new NettleError('invalid_range');
  const built = buildAnalysisInput(await deps.repo.snapshot(), sel.dayFrom, sel.dayTo, deps.dayStart.get(), (await getPreferences(deps)).flareThreshold, deps.clock.now().toISOString());
  if (built.periodRecords === 0) throw new NettleError('analysis_no_data');
  const prompt = summaryPrompt(sel.language, { json: built.json });
  const sentCharacters = prompt.system.length + prompt.user.length;
  if (sentCharacters > MAX_INPUT_CHARS) throw new NettleError('analysis_too_large');
  return { ...sel, model: await getModel(deps, 'report_summary'), promptVersion: SUMMARY_PROMPT_VERSION, counts: built.counts, sentCharacters, request: prompt };
}

/**
 * LL-14, LL-12: sends a prepared request and returns the text for review. Nothing is stored, so Cancel, a failure
 * or leaving the screen loses nothing (LL-8).
 */
export async function runSummary(deps: Deps, prepared: PreparedSummary, signal?: AbortSignal): Promise<SummaryDraft> {
  const { provider } = await currentProvider(deps, 'report_summary');
  const response = await provider.completeJson(signal ? { ...prepared.request, signal } : prepared.request);
  if (signal?.aborted) throw new NettleError('llm_cancelled');
  return {
    selection: { dayFrom: prepared.dayFrom, dayTo: prepared.dayTo, language: prepared.language },
    model: response.model,
    promptVersion: prepared.promptVersion,
    counts: prepared.counts,
    text: parseSummary(response.text),
  };
}

/** LL-14, LL-7: the person reviewed (and perhaps edited) the text and keeps it; it is stored as its own object. */
export async function saveSummary(deps: Deps, draft: SummaryDraft, text: string): Promise<ReportSummary> {
  const kept = text.trim();
  if (!kept) throw new NettleError('summary_empty');
  const summary: ReportSummary = {
    id: deps.ids(),
    at: makeStamp(deps.clock),
    dayFrom: draft.selection.dayFrom,
    dayTo: draft.selection.dayTo,
    language: draft.selection.language,
    model: draft.model,
    promptVersion: draft.promptVersion,
    counts: draft.counts,
    generated: draft.text,
    text: kept,
  };
  await deps.repo.addRecord('reportSummaries', summary);
  return summary;
}

/** LL-14: stored summaries, newest first. */
export const listSummaries = (deps: Deps) => deps.repo.listRecords('reportSummaries');
