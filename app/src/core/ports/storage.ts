import type { DateRange, Meal, SkinArea, SkinEntry, Snapshot } from '../model/types';

export type ImportMode = 'merge' | 'replace';

export interface ExistingIds {
  meals: Set<string>;
  skinAreas: Set<string>;
  skinEntries: Set<string>;
}

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

  /** Entries inside the range plus all areas. */
  snapshot(range?: DateRange): Promise<Snapshot>;
  existingIds(): Promise<ExistingIds>;
  /**
   * Atomic. merge: insert rows whose id is not present, skip the rest.
   * replace: delete everything, insert the snapshot, then restore predefined areas.
   */
  importSnapshot(snapshot: Snapshot, mode: ImportMode): Promise<void>;
}
