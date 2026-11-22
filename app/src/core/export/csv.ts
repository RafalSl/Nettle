import { LLM_SOURCE_KINDS, type SourceKind } from '../model/source';

/** EX-5: one CSV file per table, for spreadsheets. */

type Cell = string | number | boolean | null | undefined | readonly unknown[] | object;

/**
 * A spreadsheet may run a cell that starts with = + - @ as a formula, so text cells that start that way get a
 * leading apostrophe (numbers are written as numbers and are not touched).
 */
function cell(value: Cell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  let text =
    typeof value === 'string'
      ? value
      : Array.isArray(value) && value.every((v) => typeof v === 'string')
        ? value.join('; ')
        : JSON.stringify(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows to CSV text with a header made from the keys that occur, in first-seen order. UTF-8, CRLF line ends. */
export function toCsv(rows: readonly Record<string, Cell>[]): string {
  const columns: string[] = [];
  for (const row of rows) for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key);
  const lines = [columns.map(cell).join(','), ...rows.map((row) => columns.map((c) => cell(row[c])).join(','))];
  return lines.join('\r\n') + '\r\n';
}

/** File name for a section of data.json, such as `csv/skin_entries.csv`. */
export const csvPath = (section: string) => `csv/${section}.csv`;

/**
 * EX-4, IN-16: a meal or drink row for a spreadsheet. The nested `source` becomes plain columns, so AI-derived
 * ingredients and tags can be filtered: `ingredients_ai` and `allergens_ai` say yes or no.
 */
export function flattenSource(row: Record<string, unknown>): Record<string, Cell> {
  const { source, ...rest } = row;
  if (typeof source !== 'object' || source === null) return rest as Record<string, Cell>;
  const s = source as {
    kind?: string;
    edited?: boolean;
    llm?: { model?: string; at?: string; prompt_version?: string } | null;
    ai_tags?: boolean;
  };
  const ai = LLM_SOURCE_KINDS.includes(s.kind as SourceKind);
  return {
    ...(rest as Record<string, Cell>),
    ingredients_source: s.kind ?? 'typed',
    ingredients_ai: ai ? 'yes' : 'no',
    ingredients_edited: s.edited ? 'yes' : 'no',
    allergens_ai: s.ai_tags ? 'yes' : 'no',
    ai_model: s.llm?.model ?? '',
    ai_at: s.llm?.at ?? '',
    ai_prompt_version: s.llm?.prompt_version ?? '',
  };
}

/** SK-7, EX-5: a Daily health row for a spreadsheet: one column per item id (`item-stress`), so scores can be charted. */
export function flattenValues(row: Record<string, unknown>): Record<string, Cell> {
  const { values, ...rest } = row;
  return { ...(rest as Record<string, Cell>), ...(typeof values === 'object' && values !== null ? (values as Record<string, Cell>) : {}) };
}
