import { makeStamp } from '../model/time';
import type { RecordKind, Records, Stamp } from '../model/types';
import type { Deps } from './deps';

/**
 * EN-1: how a `log*` use case writes its record. A new entry (the default, `{}`) gets a fresh id and the time
 * given or now, and is added. An edit passes the entry's `id` (the record is then replaced), `keepAt` when the
 * time did not change (so the original stamp and its time zone stay), and the areas or items the entry already
 * uses in `allowArchived`, so archiving one never blocks editing an old entry (archived, not deleted).
 */
export interface EntryWrite {
  id?: string;
  keepAt?: Stamp;
  allowArchived?: ReadonlySet<string>;
}

/** The id of the record being written. Called once, after validation, so a refused entry uses up no id. */
export const entryId = (deps: Deps, w: EntryWrite): string => w.id ?? deps.ids();

/** The stamp of the record being written: the kept one, or the time given (default now) in the current time zone. */
export const entryStamp = (deps: Deps, at: Date | undefined, w: EntryWrite): Stamp => w.keepAt ?? makeStamp(deps.clock, at);

/** Whether an area or list item may be used: not archived, or already used by the entry being edited. */
export const usable = (x: { id: string; archived: boolean }, w: EntryWrite): boolean => !x.archived || !!w.allowArchived?.has(x.id);

/** Adds a new record, or replaces the one being edited. */
export const saveEntry = <K extends RecordKind>(deps: Deps, kind: K, record: Records[K][number], w: EntryWrite): Promise<void> =>
  w.id ? deps.repo.putRecord(kind, record) : deps.repo.addRecord(kind, record);
