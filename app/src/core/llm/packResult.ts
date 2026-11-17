import { strFromU8 } from 'fflate';
import { MAX_DATA_BYTES } from '../export/bundle';
import { NettleError } from '../model/errors';
import { ALLERGENS, type AnalysisResult, type Allergen } from '../model/types';
import { analysisResultFromJson } from './analysisResult';
import { parseJson } from './parse';

/** LL-15: the limits on what a fill may contain; a result is untrusted text from outside the app. */
export const MAX_FILL_INGREDIENTS = 50;
export const MAX_FILL_NAME_CHARS = 80;
export const MAX_SUMMARY_CHARS = 8000;

/** IN-20: one suggested fill for a marked meal or drink. It never changes the entry by itself. */
export interface PackFill {
  kind: 'meal' | 'drink';
  id: string;
  ingredients: string[];
  /** Suggestions only: unselected until the user selects them (IN-10). */
  allergens: Allergen[];
  note: string | null;
}

/** LL-15: what a model returns for a pack: the pack id, its own name and any of an analysis, a summary and fills. */
export interface PackResult {
  packId: string;
  model: string;
  analysis: AnalysisResult | null;
  reportSummary: string | null;
  fills: PackFill[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const bad = (): never => {
  throw new NettleError('result_invalid');
};

/**
 * LL-15: parses `result.json` with the same parsers as LL-2 (the analysis) and LL-14 (the summary). A result that is
 * larger than the limit of EX-10, is not JSON or has the wrong shape is refused whole; unknown allergen ids and
 * repeated names are cleaned like everywhere else. The file never edits `data.json` and never touches an entry.
 */
export function parsePackResult(bytes: Uint8Array): PackResult {
  if (bytes.byteLength > MAX_DATA_BYTES) throw new NettleError('import_too_large', 'result.json');
  let raw: unknown;
  try {
    raw = parseJson(strFromU8(bytes));
  } catch {
    return bad();
  }
  if (!isObj(raw)) return bad();
  const { pack_id: packId, model } = raw;
  if (typeof packId !== 'string' || !/^pack-[0-9a-f]{12}$/.test(packId)) return bad();
  if (typeof model !== 'string' || !model.trim() || model.length > 80) return bad();

  let analysis: AnalysisResult | null = null;
  if (raw.analysis !== undefined && raw.analysis !== null) {
    analysis = analysisResultFromJson(raw.analysis);
    if (!analysis) return bad();
  }
  let reportSummary: string | null = null;
  if (raw.report_summary !== undefined && raw.report_summary !== null) {
    if (typeof raw.report_summary !== 'string' || !raw.report_summary.trim() || raw.report_summary.length > MAX_SUMMARY_CHARS) return bad();
    reportSummary = raw.report_summary.trim();
  }
  const fills: PackFill[] = [];
  if (raw.fills !== undefined && raw.fills !== null) {
    if (!Array.isArray(raw.fills)) return bad();
    for (const f of raw.fills) {
      if (!isObj(f) || (f.kind !== 'meal' && f.kind !== 'drink') || typeof f.id !== 'string' || !f.id) return bad();
      if (!Array.isArray(f.ingredients) || f.ingredients.some((x) => typeof x !== 'string')) return bad();
      if (!Array.isArray(f.allergens) || f.allergens.some((x) => typeof x !== 'string')) return bad();
      if (f.note !== null && f.note !== undefined && typeof f.note !== 'string') return bad();
      const ingredients = [...new Set((f.ingredients as string[]).map((s) => s.trim()).filter((s) => s && s.length <= MAX_FILL_NAME_CHARS))].slice(0, MAX_FILL_INGREDIENTS);
      const allergens = [...new Set((f.allergens as string[]).map((s) => s.trim()))].filter((s): s is Allergen => (ALLERGENS as readonly string[]).includes(s));
      fills.push({ kind: f.kind, id: f.id, ingredients, allergens, note: typeof f.note === 'string' && f.note.trim() ? f.note.trim() : null });
    }
  }
  if (!analysis && !reportSummary && fills.length === 0) return bad(); // nothing to import
  return { packId, model: model.trim(), analysis, reportSummary, fills };
}
