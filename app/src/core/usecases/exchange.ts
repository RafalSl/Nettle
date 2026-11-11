import { packBundle, unpackBundle } from '../export/bundle';
import { toDataJson } from '../export/schema';
import { makeStamp } from '../model/time';
import type { DateRange, Snapshot } from '../model/types';
import type { ImportMode } from '../ports/storage';
import type { Deps } from './deps';

/** EX-1: a snapshot of the chosen range as a ZIP with data.json. */
export async function exportBundle(deps: Deps, range: DateRange = {}): Promise<Uint8Array> {
  const snapshot = await deps.repo.snapshot(range);
  return packBundle(toDataJson(snapshot, range, makeStamp(deps.clock)));
}

export interface ImportCounts {
  meals: number;
  skinAreas: number;
  skinEntries: number;
}

export interface ImportPreview {
  /** What the bundle contains. */
  incoming: ImportCounts;
  /** Rows merge would add (ids not already present). */
  newRows: ImportCounts;
  /** Rows merge would skip as duplicates. */
  duplicates: ImportCounts;
}

export interface ParsedImport {
  snapshot: Snapshot;
  preview: ImportPreview;
}

/** EX-10: validate (including schema_version) and count before anything is applied. */
export async function previewImport(deps: Deps, zip: Uint8Array): Promise<ParsedImport> {
  const snapshot = unpackBundle(zip);
  const existing = await deps.repo.existingIds();
  const count = (ids: string[], have: Set<string>) => ({
    total: ids.length,
    dup: ids.filter((id) => have.has(id)).length,
  });
  const m = count(snapshot.meals.map((x) => x.id), existing.meals);
  const a = count(snapshot.skinAreas.map((x) => x.id), existing.skinAreas);
  const e = count(snapshot.skinEntries.map((x) => x.id), existing.skinEntries);
  return {
    snapshot,
    preview: {
      incoming: { meals: m.total, skinAreas: a.total, skinEntries: e.total },
      newRows: { meals: m.total - m.dup, skinAreas: a.total - a.dup, skinEntries: e.total - e.dup },
      duplicates: { meals: m.dup, skinAreas: a.dup, skinEntries: e.dup },
    },
  };
}

export async function applyImport(deps: Deps, parsed: ParsedImport, mode: ImportMode): Promise<void> {
  await deps.repo.importSnapshot(parsed.snapshot, mode);
}
