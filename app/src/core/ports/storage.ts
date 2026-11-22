import type { Preferences } from '../model/preferences';
import type {
  DateRange,
  ListItem,
  ListKind,
  Payload,
  RecordKind,
  Records,
  Settings,
  SkinArea,
  Snapshot,
  Stamp,
  Tombstone,
} from '../model/types';

export type ImportMode = 'merge' | 'replace';

/**
 * EX-13: what an import does besides inserting records, worked out by the core so both adapters stay simple.
 * Applied in this order inside the same transaction: `remove` the local records, `forget` (delete) local
 * tombstones, replace wipes all tombstones and records, insert the payload, then `store` tombstones
 * (ids that already have one keep it).
 */
export interface ImportTombstones {
  remove?: Partial<Record<RecordKind, string[]>>;
  forget?: string[];
  store?: Tombstone[];
}

/** Every collection that is exported and imported: record kinds and setting kinds. */
export type CollectionKey = keyof Records | keyof Settings;
export type ExistingIds = Record<CollectionKey, Set<string>>;

/** Repository port (EX-1, EX-10, portable data). Implemented by SQLite and by an in-memory fake. */
export interface StorageRepository {
  /** Insert or update by id. */
  upsertArea(area: SkinArea): Promise<void>;
  /** All areas, including archived. */
  listAreas(): Promise<SkinArea[]>;

  /** Insert or update by id. */
  upsertItem(kind: ListKind, item: ListItem): Promise<void>;
  /** All items of a list, including archived, ordered by id. */
  listItems(kind: ListKind): Promise<ListItem[]>;

  /** Adds a new record of any kind (a meal with its ingredients, a skin entry, a drink …). An existing id throws. */
  addRecord<K extends RecordKind>(kind: K, record: Records[K][number]): Promise<void>;
  /** EN-1: insert or replace by id, for a record that changes after it was created (an edit, the day's Daily health). */
  putRecord<K extends RecordKind>(kind: K, record: Records[K][number]): Promise<void>;
  /** The records of a kind, optionally in a time range, newest first. */
  listRecords<K extends RecordKind>(kind: K, range?: DateRange): Promise<Records[K]>;
  /** One record by id, or null. */
  getRecord<K extends RecordKind>(kind: K, id: string): Promise<Records[K][number] | null>;

  /** SE-9: atomically delete the given records by id (unknown ids are ignored). Areas and lists are untouched. Leaves no tombstones. */
  deleteRecords(ids: Partial<Record<RecordKind, string[]>>): Promise<void>;
  /**
   * EN-1, EX-13: atomically delete the given records and store a tombstone for each id that existed
   * (unknown ids are ignored). `at` is the deletion time.
   */
  deleteWithTombstones(ids: Partial<Record<RecordKind, string[]>>, at: Stamp): Promise<void>;
  /** All tombstones, oldest deletion first. */
  listTombstones(): Promise<Tombstone[]>;

  /** IN-14, UX-2: the stored preferences, or null while the user never changed any (the defaults apply). */
  getPreferences(): Promise<Preferences | null>;
  setPreferences(preferences: Preferences): Promise<void>;

  /** Entries inside the range plus all areas. */
  snapshot(range?: DateRange): Promise<Snapshot>;
  existingIds(): Promise<ExistingIds>;
  /**
   * Atomic; only the parts present in the payload are touched (EX-10).
   * merge: insert rows whose id is not present, skip the rest.
   * replace records: delete all meals and skin entries, insert the payload's.
   * replace settings: overwrite areas and list items by id, delete user areas and items that are neither
   * in the payload nor used by a remaining record, keep predefined ones.
   * Tombstones (EX-13): see ImportTombstones. Replace records also wipes all local tombstones.
   * Preferences (the payload's, with settings): merge stores them only when none are stored yet, replace overwrites.
   */
  importData(payload: Payload, mode: ImportMode, tombstones?: ImportTombstones): Promise<void>;
}
