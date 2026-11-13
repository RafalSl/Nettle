import type {
  DateRange,
  ExtraKind,
  ListItem,
  ListKind,
  Meal,
  Payload,
  Records,
  Settings,
  SkinArea,
  SkinEntry,
  Snapshot,
} from '../model/types';

export type ImportMode = 'merge' | 'replace';

/** Every collection that is exported and imported: record kinds and setting kinds. */
export type CollectionKey = keyof Records | keyof Settings;
export type ExistingIds = Record<CollectionKey, Set<string>>;

/** Repository port (EX-1, EX-10, portable data). Implemented by SQLite and by an in-memory fake. */
export interface StorageRepository {
  addMeal(meal: Meal): Promise<void>;
  /** Newest first. */
  listMeals(range?: DateRange): Promise<Meal[]>;

  /** Insert or update by id. */
  upsertArea(area: SkinArea): Promise<void>;
  /** All areas, including archived. */
  listAreas(): Promise<SkinArea[]>;

  addSkinEntry(entry: SkinEntry): Promise<void>;
  /** Newest first. */
  listSkinEntries(range?: DateRange): Promise<SkinEntry[]>;

  /** Insert or update by id. */
  upsertItem(kind: ListKind, item: ListItem): Promise<void>;
  /** All items of a list, including archived, ordered by id. */
  listItems(kind: ListKind): Promise<ListItem[]>;

  /** Generic storage for the flat record kinds (see ExtraKind). Newest first. */
  addRecord<K extends ExtraKind>(kind: K, record: Records[K][number]): Promise<void>;
  /** Insert or replace by id, for records that change after they are created (the daily check-in). */
  putRecord<K extends ExtraKind>(kind: K, record: Records[K][number]): Promise<void>;
  listRecords<K extends ExtraKind>(kind: K, range?: DateRange): Promise<Records[K]>;

  /** Entries inside the range plus all areas. */
  snapshot(range?: DateRange): Promise<Snapshot>;
  existingIds(): Promise<ExistingIds>;
  /**
   * Atomic; only the parts present in the payload are touched (EX-10).
   * merge: insert rows whose id is not present, skip the rest.
   * replace records: delete all meals and skin entries, insert the payload's.
   * replace settings: overwrite areas and list items by id, delete user areas and items that are neither
   * in the payload nor used by a remaining record, keep predefined ones.
   */
  importData(payload: Payload, mode: ImportMode): Promise<void>;
}
