/** EX-5: one CSV file per table, for spreadsheets. */

type Cell = string | number | boolean | null | undefined | readonly unknown[] | object;

/**
 * A spreadsheet may run a cell that starts with = + - @ as a formula, so text cells that start that way get a
 * leading apostrophe (numbers are written as numbers and are not touched).
 */
function cell(value: Cell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  let text = typeof value === 'string' ? value : Array.isArray(value) && value.every((v) => typeof v === 'string') ? value.join('; ') : JSON.stringify(value);
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
