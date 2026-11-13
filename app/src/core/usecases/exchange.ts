import { packBundle, unpackBundle } from '../export/bundle';
import { toDataJson } from '../export/schema';
import { NettleError } from '../model/errors';
import { localDaysToRange, makeStamp } from '../model/time';
import { recordRefs } from '../model/refs';
import { EXTRA_KINDS, LIST_KINDS, type DateRange, type Parts, type Payload, type Records } from '../model/types';
import type { CollectionKey, ImportMode } from '../ports/storage';
import type { Deps } from './deps';

export interface ExportOptions {
  /** UTC bounds. Applies to records only; settings are always exported in full. */
  range?: DateRange;
  /** Alternative to `range`: local calendar days ("YYYY-MM-DD"), converted with the device's current timezone. */
  days?: { from?: string; to?: string };
  parts?: Parts;
  /** EX-6: when set, the ZIP is AES-256 encrypted. Never stored or logged. */
  password?: string;
}

/** EX-1: a snapshot of the chosen range as a ZIP with data.json, records, settings or both. */
export async function exportBundle(deps: Deps, options: ExportOptions = {}): Promise<Uint8Array> {
  let range = options.range ?? {};
  if (options.days) {
    const converted = localDaysToRange(options.days.from, options.days.to, deps.clock.timeZone());
    if (!converted) throw new NettleError('invalid_range');
    range = converted;
  }
  const parts = options.parts ?? { records: true, settings: true };
  if (!parts.records && !parts.settings) throw new NettleError('nothing_selected');
  const snapshot = await deps.repo.snapshot(range);
  return packBundle(toDataJson(snapshot, range, makeStamp(deps.clock), parts), options.password, deps.randomBytes);
}

/** Row counts per collection (zero for a collection the file lacks). */
export type PartCounts = Record<CollectionKey, number>;

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
export async function previewImport(deps: Deps, zip: Uint8Array, password?: string): Promise<ParsedImport> {
  const payload = unpackBundle(zip, password);
  const existing = await deps.repo.existingIds();
  const incoming = {} as PartCounts;
  const duplicates = {} as PartCounts;
  const newRows = {} as PartCounts;
  const tally = (key: CollectionKey, ids: string[]) => {
    incoming[key] = ids.length;
    duplicates[key] = ids.filter((id) => existing[key].has(id)).length;
    newRows[key] = ids.length - duplicates[key];
  };
  const records = payload.records;
  tally('meals', records?.meals.map((x) => x.id) ?? []);
  tally('skinEntries', records?.skinEntries.map((x) => x.id) ?? []);
  for (const kind of EXTRA_KINDS) tally(kind, records?.[kind].map((x) => x.id) ?? []);
  tally('skinAreas', payload.settings?.skinAreas.map((x) => x.id) ?? []);
  for (const kind of LIST_KINDS) tally(kind, payload.settings?.[kind].map((x) => x.id) ?? []);
  return {
    payload,
    preview: { has: { records: !!records, settings: !!payload.settings }, incoming, newRows, duplicates },
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
    // Imported records must not point at areas or list items that will not exist.
    const existing = await deps.repo.existingIds();
    const areas = new Set([...existing.skinAreas, ...(payload.settings?.skinAreas ?? []).map((a) => a.id)]);
    const meals = new Set([...existing.meals, ...payload.records.meals.map((m) => m.id)]);
    const refs = recordRefs(payload.records as Records);
    for (const id of refs.areas) if (!areas.has(id)) throw new NettleError('import_unknown_area', id);
    for (const kind of LIST_KINDS) {
      const known = new Set([...existing[kind], ...(payload.settings?.[kind] ?? []).map((i) => i.id)]);
      for (const id of refs.items[kind]) if (!known.has(id)) throw new NettleError('import_unknown_item', id);
    }
    for (const id of refs.meals) if (!meals.has(id)) throw new NettleError('import_unknown_meal', id);
    const skin = new Set([...existing.skinEntries, ...payload.records.skinEntries.map((e) => e.id)]);
    const nails = new Set([...existing.nailEntries, ...payload.records.nailEntries.map((e) => e.id)]);
    for (const id of refs.skinEntries) if (!skin.has(id)) throw new NettleError('import_unknown_entry', id);
    for (const id of refs.nailEntries) if (!nails.has(id)) throw new NettleError('import_unknown_entry', id);
  }
  await deps.repo.importData(payload, choice.mode);
}
