import { ANALYSIS_PROMPT_VERSION, analysisPrompt } from '../llm/analysisPrompt';
import { buildAnalysisInput } from '../llm/analysisInput';
import { analysisResultFromJson } from '../llm/analysisResult';
import { parseJson } from '../llm/parse';
import { NettleError } from '../model/errors';
import { addDays, localDateTime, makeStamp } from '../model/time';
import type { Analysis, LocalDay } from '../model/types';
import type { Language, LlmImage, LlmRequest } from '../ports/llm';
import type { Deps } from './deps';
import { currentProvider, getModel } from './llm';

/** LL-6: photos in one run are capped, to keep the request and its cost reasonable. */
export const MAX_ANALYSIS_PHOTOS = 20;
/** The text part of a request may not exceed this many characters; a narrower date range fixes it. */
export const MAX_INPUT_CHARS = 600_000;

export interface AnalysisSelection {
  dayFrom: LocalDay;
  dayTo: LocalDay;
  /** LL-6: photos are off unless listed here; sensitive photos are included only when their id is listed. */
  photoIds?: readonly string[];
  language: Language;
}

/** LL-5: exactly what a run will send, shown on the confirmation screen before anything leaves the device. */
export interface PreparedAnalysis {
  dayFrom: LocalDay;
  dayTo: LocalDay;
  language: Language;
  model: string;
  promptVersion: string;
  /** Records sent by kind, plus `days`, `completeDays`, `lookbackDays` and `photos`. */
  counts: Record<string, number>;
  photos: { id: string; label: string; sensitive: boolean }[];
  sentCharacters: number;
  /** The request that will be sent, unchanged, by `runAnalysis`. */
  request: LlmRequest;
}

const validDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && addDays(d, 0) === d;

/** LL-2, LL-3, LL-5, LL-6: build the request from the diary for a date range. Makes no network call and changes nothing. */
export async function prepareAnalysis(deps: Deps, sel: AnalysisSelection): Promise<PreparedAnalysis> {
  if (!validDay(sel.dayFrom) || !validDay(sel.dayTo) || sel.dayFrom > sel.dayTo) throw new NettleError('invalid_range');
  const photoIds = [...new Set(sel.photoIds ?? [])];
  if (photoIds.length > MAX_ANALYSIS_PHOTOS) throw new NettleError('too_many_photos');

  const snap = await deps.repo.snapshot();
  const built = buildAnalysisInput(snap, sel.dayFrom, sel.dayTo);
  if (built.periodRecords === 0) throw new NettleError('analysis_no_data');

  const areas = new Map(snap.skinAreas.map((a) => [a.id, a.nameOverride ?? a.name]));
  const entryArea = new Map([...snap.skinEntries, ...snap.nailEntries].map((e) => [e.id, areas.get(e.areaId) ?? '']));
  const images: LlmImage[] = [];
  const photos: PreparedAnalysis['photos'] = [];
  const notes: string[] = [];
  for (const id of photoIds) {
    const photo = snap.photos.find((p) => p.id === id);
    if (!photo) throw new NettleError('unknown_photo', id);
    const label = `${entryArea.get(photo.entryId) ?? ''} ${localDateTime(photo.at.utc, photo.at.tz)}`.trim();
    images.push({ mimeType: 'image/jpeg', data: await deps.photos.read(photo.file) });
    photos.push({ id, label, sensitive: photo.sensitive });
    notes.push(label);
  }

  const prompt = analysisPrompt(sel.language, { json: built.json, photoNotes: notes });
  const sentCharacters = prompt.system.length + prompt.user.length;
  if (sentCharacters > MAX_INPUT_CHARS) throw new NettleError('analysis_too_large');
  return {
    dayFrom: sel.dayFrom,
    dayTo: sel.dayTo,
    language: sel.language,
    model: await getModel(deps, 'analysis'),
    promptVersion: ANALYSIS_PROMPT_VERSION,
    counts: { ...built.counts, photos: photos.length },
    photos,
    sentCharacters,
    request: { ...prompt, images },
  };
}

/**
 * LL-2, LL-4, LL-7, LL-8: send a prepared request and store the answer as its own object. Nothing is stored
 * unless the answer is complete and valid, so a failure (no network, invalid key, rate limit, spend cap,
 * refusal, unreadable answer) loses no data and leaves the diary as it was.
 */
export async function runAnalysis(deps: Deps, prepared: PreparedAnalysis, signal?: AbortSignal): Promise<Analysis> {
  const { provider } = await currentProvider(deps, 'analysis');
  const response = await provider.completeJson(signal ? { ...prepared.request, signal } : prepared.request);
  // LL-12: Cancel stores nothing, even when the answer arrived at the same moment.
  if (signal?.aborted) throw new NettleError('llm_cancelled');
  const result = analysisResultFromJson(parseJson(response.text));
  if (!result) throw new NettleError('llm_bad_response');
  const analysis: Analysis = {
    id: deps.ids(),
    at: makeStamp(deps.clock),
    dayFrom: prepared.dayFrom,
    dayTo: prepared.dayTo,
    model: response.model,
    promptVersion: prepared.promptVersion,
    language: prepared.language,
    counts: prepared.counts,
    result,
  };
  await deps.repo.addRecord('analyses', analysis);
  return analysis;
}

/** LL-7: stored analyses, newest first. */
export const listAnalyses = (deps: Deps) => deps.repo.listRecords('analyses');
