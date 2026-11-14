import { packBundle, unpackBundle } from '../export/bundle';
import { csvPath, toCsv } from '../export/csv';
import { buildReportHtml, type ReportInput } from '../export/report';
import { bytesToBase64 } from '../util/base64';
import { DEFAULT_PHOTO_SELECTION, planPhotoNames, selectPhotos, type PhotoSelection } from '../export/photoSelection';
import { toDataJson } from '../export/schema';
import { NettleError } from '../model/errors';
import { localDaysToRange, makeStamp } from '../model/time';
import { recordRefs } from '../model/refs';
import { EXTRA_KINDS, LIST_KINDS, RECORD_KINDS, type DateRange, type Parts, type Payload, type Records } from '../model/types';
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
  /** EX-7: which photos to include; the default leaves out sensitive ones. Photos belong to records, so they need `parts.records`. */
  photos?: PhotoSelection;
  /** EX-5: also write one CSV file per table of data.json. */
  csv?: boolean;
  /** EX-3, EX-4: also write report.pdf in this language; the photo selection above applies to it too (EX-8). */
  report?: Pick<ReportInput, 'language' | 'text' | 'areaName' | 'itemName'>;
}

/** Width of the photos in the PDF, in pixels: small enough to keep the report light. */
const REPORT_PHOTO_EDGE = 500;

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

  // EX-2, EX-7: a photo is exported when its entry is in the range and the photo selection includes it.
  const files: Record<string, Uint8Array> = {};
  snapshot.photos = [];
  if (parts.records) {
    const inRange = new Set([...snapshot.skinEntries, ...snapshot.nailEntries].map((e) => e.id));
    const candidates = (await deps.repo.listRecords('photos')).filter((p) => inRange.has(p.entryId));
    const areaByEntry = new Map([...snapshot.skinEntries, ...snapshot.nailEntries].map((e) => [e.id, e.areaId]));
    const chosen = selectPhotos(candidates, options.photos ?? DEFAULT_PHOTO_SELECTION, (p) => areaByEntry.get(p.entryId));
    const areas = new Map(snapshot.skinAreas.map((a) => [a.id, a]));
    const names = planPhotoNames(chosen, (p) => areas.get(areaByEntry.get(p.entryId) ?? ''));
    for (const p of chosen) {
      const path = names.get(p.id)!;
      files[path] = await deps.photos.read(p.file);
      snapshot.photos.push({ ...p, file: path });
    }
  }
  const data = toDataJson(snapshot, range, makeStamp(deps.clock), parts);

  if (options.csv) {
    for (const section of [data.records, data.settings]) {
      for (const [name, rows] of Object.entries(section ?? {})) {
        files[csvPath(name)] = new TextEncoder().encode(toCsv(rows as Record<string, never>[]));
      }
    }
  }

  if (options.report) {
    const thumbnails = new Map<string, string>();
    // The snapshot's photo `file` is already the ZIP path; the stored file comes from the original record.
    const originals = new Map((await deps.repo.listRecords('photos')).map((x) => [x.id, x]));
    for (const p of snapshot.photos) {
      const original = originals.get(p.id);
      if (!original) continue;
      const jpeg = await deps.photos.compress(deps.photos.uri(original.file), REPORT_PHOTO_EDGE);
      thumbnails.set(p.id, `data:image/jpeg;base64,${bytesToBase64(jpeg)}`);
    }
    const html = buildReportHtml({
      ...options.report,
      records: parts.records ? snapshot : emptyRecords(),
      skinAreas: snapshot.skinAreas,
      dailyTags: snapshot.dailyTags,
      treatments: snapshot.treatments,
      photos: thumbnails,
      range: data.range,
      exportedAt: data.exported_at,
    });
    files['report.pdf'] = await deps.pdf.renderHtml(html);
  }

  return packBundle(data, files, options.password, deps.randomBytes);
}

const emptyRecords = (): Records => Object.fromEntries(RECORD_KINDS.map((k) => [k, []])) as unknown as Records;

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
  /** Reads a photo from the opened ZIP by its path in data.json. Needed when the file has photos. */
  readPhoto?: (path: string) => Uint8Array | undefined;
}

/** EX-10: validate (including schema_version) and count before anything is applied. */
export async function previewImport(deps: Deps, zip: Uint8Array, password?: string): Promise<ParsedImport> {
  const { payload, readPhoto } = unpackBundle(zip, password);
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
    readPhoto,
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
    // Replacing records wipes the current meals and entries first, so only the file's own count there.
    const replacing = choice.mode === 'replace';
    const kept = <T extends string>(have: Set<T>) => (replacing ? new Set<T>() : have);
    const meals = new Set([...kept(existing.meals), ...payload.records.meals.map((m) => m.id)]);
    const refs = recordRefs(payload.records as Records);
    for (const id of refs.areas) if (!areas.has(id)) throw new NettleError('import_unknown_area', id);
    for (const kind of LIST_KINDS) {
      const known = new Set([...existing[kind], ...(payload.settings?.[kind] ?? []).map((i) => i.id)]);
      for (const id of refs.items[kind]) if (!known.has(id)) throw new NettleError('import_unknown_item', id);
    }
    for (const id of refs.meals) if (!meals.has(id)) throw new NettleError('import_unknown_meal', id);
    const skin = new Set([...kept(existing.skinEntries), ...payload.records.skinEntries.map((e) => e.id)]);
    const nails = new Set([...kept(existing.nailEntries), ...payload.records.nailEntries.map((e) => e.id)]);
    for (const id of refs.skinEntries) if (!skin.has(id)) throw new NettleError('import_unknown_entry', id);
    for (const id of refs.nailEntries) if (!nails.has(id)) throw new NettleError('import_unknown_entry', id);
  }

  // Photos: copy their bytes into private storage first (NF-3: any failure removes what was copied and
  // leaves the diary untouched), then write the records with the new store keys.
  const saved: string[] = [];
  let oldFiles: string[] = [];
  try {
    if (payload.records) {
      const have = (await deps.repo.existingIds()).photos;
      const keys = new Map<string, string>();
      for (const photo of payload.records.photos) {
        if (choice.mode === 'merge' && have.has(photo.id)) continue; // a duplicate is skipped, so is its file
        const bytes = parsed.readPhoto?.(photo.file);
        if (!bytes) throw new NettleError('import_missing_photo', photo.file);
        const key = await deps.photos.saveBytes(bytes);
        saved.push(key);
        keys.set(photo.id, key);
      }
      payload.records = {
        ...payload.records,
        photos: payload.records.photos.map((p) => (keys.has(p.id) ? { ...p, file: keys.get(p.id)! } : p)),
      };
      if (choice.mode === 'replace') oldFiles = (await deps.repo.listRecords('photos')).map((p) => p.file);
    }
    await deps.repo.importData(payload, choice.mode);
  } catch (e) {
    for (const key of saved) await deps.photos.remove(key);
    throw e;
  }
  for (const file of oldFiles) await deps.photos.remove(file);
}
