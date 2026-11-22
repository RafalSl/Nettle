import { ANALYSIS_PROMPT_VERSION } from '../../llm/analysisPrompt';
import { parsePackResult, type PackFill, type PackResult } from '../../llm/packResult';
import { SUMMARY_PROMPT_VERSION } from '../../llm/summaryPrompt';
import { NettleError } from '../../model/errors';
import { makeStamp } from '../../model/time';
import type { Analysis, LocalDay, ReportSummary } from '../../model/types';
import type { Deps } from '../deps';
import { markedEntries, readState, writeState, type PackRecord, type Suggestion } from './state';

/** LL-15, LL-7: a result.json checked against the packs this phone made, then imported. */

/** LL-15: what an import would do, shown before it does it. */
export interface ResultPreview {
  packId: string;
  model: string;
  dayFrom: LocalDay;
  dayTo: LocalDay;
  hasAnalysis: boolean;
  hasSummary: boolean;
  /** Fills that become suggestions, and fills that are skipped (entry deleted, no longer marked, or already has a suggestion). */
  fillsAccepted: number;
  fillsSkipped: number;
  /** This result was imported before: an import does nothing. */
  alreadyImported: boolean;
}

interface Plan {
  result: PackResult;
  pack: PackRecord;
  accepted: PackFill[];
  preview: ResultPreview;
}

async function plan(deps: Deps, bytes: Uint8Array): Promise<Plan> {
  const result = parsePackResult(bytes);
  const state = await readState(deps);
  const pack = state.packs.find((p) => p.id === result.packId);
  if (!pack) throw new NettleError('result_wrong_pack', result.packId);
  const inPack = new Set(pack.marked.map((m) => `${m.kind}:${m.id}`));
  if (result.fills.some((f) => !inPack.has(`${f.kind}:${f.id}`))) throw new NettleError('result_unknown_entry', result.packId);
  const alreadyImported = state.imported.includes(pack.id);
  const stillMarked = new Set((await markedEntries(deps)).map((m) => `${m.kind}:${m.id}`));
  const waiting = new Set(state.suggestions.map((s) => `${s.kind}:${s.entryId}`));
  const accepted: PackFill[] = [];
  for (const f of result.fills) {
    const key = `${f.kind}:${f.id}`;
    if (!stillMarked.has(key) || waiting.has(key)) continue; // deleted or already filled since the pack, or one is waiting
    waiting.add(key); // a second fill for the same entry in one file is skipped too
    accepted.push(f);
  }
  return {
    result,
    pack,
    accepted,
    preview: {
      packId: pack.id,
      model: result.model,
      dayFrom: pack.dayFrom,
      dayTo: pack.dayTo,
      hasAnalysis: result.analysis !== null,
      hasSummary: result.reportSummary !== null,
      fillsAccepted: accepted.length,
      fillsSkipped: result.fills.length - accepted.length,
      alreadyImported,
    },
  };
}

/** LL-15: validates a result against the packs this phone made and says what an import would do. Changes nothing. */
export async function previewResult(deps: Deps, bytes: Uint8Array): Promise<ResultPreview> {
  return (await plan(deps, bytes)).preview;
}

/**
 * LL-15, LL-7, IN-20: imports a result. An analysis and a summary become their own objects labelled manual with the
 * model's name; fills become suggestions to review. A result that was imported before does nothing. No entry changes.
 */
export async function importResult(deps: Deps, bytes: Uint8Array): Promise<ResultPreview & { imported: boolean }> {
  const { result, pack, accepted, preview } = await plan(deps, bytes);
  if (preview.alreadyImported) return { ...preview, imported: false };
  const at = makeStamp(deps.clock);
  // The pack is marked imported before any record is stored, so a retry after a failure never stores a record twice;
  // if storing fails, the mark is taken back and the import can run again.
  const before = await readState(deps);
  const added: Suggestion[] = accepted.map((f) => ({
    id: deps.ids(),
    kind: f.kind,
    entryId: f.id,
    ingredients: f.ingredients,
    allergens: f.allergens,
    note: f.note,
    model: result.model,
    packId: pack.id,
    receivedUtc: at.utc,
  }));
  await writeState(deps, { ...before, imported: [...before.imported, pack.id], suggestions: [...before.suggestions, ...added] });
  const stored: { kind: 'analyses' | 'reportSummaries'; id: string }[] = [];
  try {
    if (result.analysis) {
      const analysis: Analysis = {
        id: deps.ids(),
        at,
        dayFrom: pack.dayFrom,
        dayTo: pack.dayTo,
        model: result.model,
        promptVersion: ANALYSIS_PROMPT_VERSION,
        language: pack.language,
        counts: pack.counts,
        result: result.analysis,
        manual: true,
      };
      await deps.repo.addRecord('analyses', analysis);
      stored.push({ kind: 'analyses', id: analysis.id });
    }
    if (result.reportSummary) {
      const summary: ReportSummary = {
        id: deps.ids(),
        at,
        dayFrom: pack.dayFrom,
        dayTo: pack.dayTo,
        language: pack.language,
        model: result.model,
        promptVersion: SUMMARY_PROMPT_VERSION,
        counts: pack.counts,
        generated: result.reportSummary,
        text: result.reportSummary,
        manual: true,
      };
      await deps.repo.addRecord('reportSummaries', summary);
      stored.push({ kind: 'reportSummaries', id: summary.id });
    }
  } catch (e) {
    const undo: Partial<Record<'analyses' | 'reportSummaries', string[]>> = {};
    for (const r of stored) (undo[r.kind] ??= []).push(r.id);
    await deps.repo.deleteRecords(undo).catch(() => undefined);
    await writeState(deps, before).catch(() => undefined);
    throw e;
  }
  return { ...preview, imported: true };
}
