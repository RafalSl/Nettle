import { packBundle, unpackBundle } from '../export/bundle';
import { toDataJson } from '../export/schema';
import { NettleError } from '../model/errors';
import { makeStamp } from '../model/time';
import type { DateRange, Parts, Payload } from '../model/types';
import type { ImportMode } from '../ports/storage';
import type { Deps } from './deps';

export interface ExportOptions {
  /** Applies to records only; settings are always exported in full. */
  range?: DateRange;
  parts?: Parts;
}

/** EX-1: a snapshot of the chosen range as a ZIP with data.json, records, settings or both. */
export async function exportBundle(deps: Deps, options: ExportOptions = {}): Promise<Uint8Array> {
  const range = options.range ?? {};
  const parts = options.parts ?? { records: true, settings: true };
  if (!parts.records && !parts.settings) throw new NettleError('nothing_selected');
  const snapshot = await deps.repo.snapshot(range);
  return packBundle(toDataJson(snapshot, range, makeStamp(deps.clock), parts));
}

export interface PartCounts {
  meals: number;
  skinEntries: number;
  skinAreas: number;
}

export interface ImportPreview {
  /** Which parts the file contains. */
  has: Parts;
  /** What the file contains (zero for an absent part). */
  incoming: PartCounts;
  /** Rows merge would add (ids not already present). */
  newRows: PartCounts;
  /** Rows merge would skip as duplicates. */
  duplicates: PartCounts;
}

export interface ParsedImport {
  payload: Payload;
  preview: ImportPreview;
}

/** EX-10: validate (including schema_version) and count before anything is applied. */
export async function previewImport(deps: Deps, zip: Uint8Array): Promise<ParsedImport> {
  const payload = unpackBundle(zip);
  const existing = await deps.repo.existingIds();
  const count = (ids: string[], have: Set<string>) => ({
    total: ids.length,
    dup: ids.filter((id) => have.has(id)).length,
  });
  const m = count(payload.records?.meals.map((x) => x.id) ?? [], existing.meals);
  const e = count(payload.records?.skinEntries.map((x) => x.id) ?? [], existing.skinEntries);
  const a = count(payload.settings?.skinAreas.map((x) => x.id) ?? [], existing.skinAreas);
  return {
    payload,
    preview: {
      has: { records: !!payload.records, settings: !!payload.settings },
      incoming: { meals: m.total, skinEntries: e.total, skinAreas: a.total },
      newRows: { meals: m.total - m.dup, skinEntries: e.total - e.dup, skinAreas: a.total - a.dup },
      duplicates: { meals: m.dup, skinEntries: e.dup, skinAreas: a.dup },
    },
  };
}

/**
 * Applies the chosen parts of a parsed import. Parts the file lacks are ignored.
 * Fails before writing when imported entries would point at an area that will not exist.
 */
export async function applyImport(
  deps: Deps,
  parsed: ParsedImport,
  choice: { mode: ImportMode; parts: Parts },
): Promise<void> {
  const payload: Payload = {};
  if (choice.parts.records && parsed.payload.records) payload.records = parsed.payload.records;
  if (choice.parts.settings && parsed.payload.settings) payload.settings = parsed.payload.settings;
  if (!payload.records && !payload.settings) throw new NettleError('nothing_selected');

  if (payload.records) {
    const known = new Set((await deps.repo.existingIds()).skinAreas);
    for (const a of payload.settings?.skinAreas ?? []) known.add(a.id);
    for (const e of payload.records.skinEntries) {
      if (!known.has(e.areaId)) throw new NettleError('import_unknown_area', e.areaId);
    }
  }
  await deps.repo.importData(payload, choice.mode);
}
