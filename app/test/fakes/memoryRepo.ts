import { PREDEFINED_AREAS } from '@/core/model/areas';
import { PREDEFINED_ITEMS } from '@/core/model/lists';
import type { Preferences } from '@/core/model/preferences';
import { recordRefs } from '@/core/model/refs';
import {
  LIST_KINDS,
  RECORD_KINDS,
  type DateRange,
  type ListItem,
  type ListKind,
  type Payload,
  type RecordKind,
  type Records,
  type SkinArea,
  type Snapshot,
  type Stamp,
  type Tombstone,
} from '@/core/model/types';
import type { ExistingIds, ImportMode, ImportTombstones, StorageRepository } from '@/core/ports/storage';

const inRange = (utc: string, r?: DateRange) => (!r?.from || utc >= r.from) && (!r?.to || utc <= r.to);
const newestFirst = <T extends { at: { utc: string }; id: string }>(a: T, b: T) =>
  b.at.utc.localeCompare(a.at.utc) || a.id.localeCompare(b.id);
const clone = <T>(v: T): T => structuredClone(v);

type AnyRecord = Records[RecordKind][number];
type Store = Record<RecordKind, Map<string, AnyRecord>>;
const emptyStore = (from?: Store): Store => Object.fromEntries(RECORD_KINDS.map((k) => [k, new Map(from?.[k] ?? [])])) as Store;

export class MemoryRepo implements StorageRepository {
  private records: Store = emptyStore();
  private areas = new Map<string, SkinArea>();
  private tombstones = new Map<string, Tombstone>();
  private preferences: Preferences | null = null;
  private items = Object.fromEntries(LIST_KINDS.map((k) => [k, new Map<string, ListItem>()])) as Record<ListKind, Map<string, ListItem>>;

  constructor() {
    this.seed();
  }

  private seed(items = this.items) {
    for (const a of PREDEFINED_AREAS) if (!this.areas.has(a.id)) this.areas.set(a.id, clone(a));
    for (const k of LIST_KINDS) for (const i of PREDEFINED_ITEMS[k]) if (!items[k].has(i.id)) items[k].set(i.id, clone(i));
  }

  async upsertItem(kind: ListKind, item: ListItem) {
    this.items[kind].set(item.id, clone(item));
  }
  async listItems(kind: ListKind) {
    return [...this.items[kind].values()].sort((a, b) => a.id.localeCompare(b.id)).map(clone);
  }
  async upsertArea(area: SkinArea) {
    this.areas.set(area.id, clone(area));
  }
  async listAreas() {
    return [...this.areas.values()].sort((a, b) => a.id.localeCompare(b.id)).map(clone);
  }

  async addRecord<K extends RecordKind>(kind: K, record: Records[K][number]) {
    if (this.records[kind].has(record.id)) throw new Error('duplicate id');
    this.checkRefs(record);
    this.records[kind].set(record.id, clone(record));
  }
  async putRecord<K extends RecordKind>(kind: K, record: Records[K][number]) {
    this.checkRefs(record);
    this.records[kind].set(record.id, clone(record));
  }
  async listRecords<K extends RecordKind>(kind: K, range?: DateRange): Promise<Records[K]> {
    return [...this.records[kind].values()]
      .filter((r) => inRange(r.at.utc, range))
      .sort(newestFirst)
      .map(clone) as Records[K];
  }
  async getRecord<K extends RecordKind>(kind: K, id: string): Promise<Records[K][number] | null> {
    const found = this.records[kind].get(id);
    return found ? (clone(found) as Records[K][number]) : null;
  }

  /**
   * Mirrors the foreign keys of the SQL schema: a record's `areaId` and `mealId` must exist. Ids kept inside
   * JSON lists (tags, treatment areas) have no foreign key in SQL, so the use cases and import check them.
   */
  private checkRefs(record: object, areas = this.areas, meals = this.records.meals) {
    const { areaId, mealId } = record as { areaId?: string; mealId?: string };
    if (areaId !== undefined && !areas.has(areaId)) throw new Error('unknown area');
    if (mealId !== undefined && !meals.has(mealId)) throw new Error('unknown meal');
  }

  async deleteRecords(ids: Partial<Record<RecordKind, string[]>>) {
    for (const kind of RECORD_KINDS) for (const id of ids[kind] ?? []) this.records[kind].delete(id);
  }
  async deleteWithTombstones(ids: Partial<Record<RecordKind, string[]>>, at: Stamp) {
    for (const [kind, list] of Object.entries(ids) as [RecordKind, string[]][]) {
      for (const id of list) if (this.records[kind].has(id)) this.tombstones.set(id, { id, kind, deletedAt: clone(at) });
    }
    await this.deleteRecords(ids);
  }
  async getPreferences(): Promise<Preferences | null> {
    return this.preferences ? clone(this.preferences) : null;
  }
  async setPreferences(p: Preferences) {
    this.preferences = clone(p);
  }
  async listTombstones(): Promise<Tombstone[]> {
    return [...this.tombstones.values()]
      .sort((a, b) => a.deletedAt.utc.localeCompare(b.deletedAt.utc) || a.id.localeCompare(b.id))
      .map(clone);
  }

  async snapshot(range?: DateRange): Promise<Snapshot> {
    const snap = { skinAreas: await this.listAreas() } as Snapshot;
    for (const kind of LIST_KINDS) Object.assign(snap, { [kind]: await this.listItems(kind) });
    for (const kind of RECORD_KINDS) Object.assign(snap, { [kind]: await this.listRecords(kind, range) });
    return snap;
  }
  async existingIds(): Promise<ExistingIds> {
    const result = { skinAreas: new Set(this.areas.keys()) } as ExistingIds;
    for (const kind of RECORD_KINDS) result[kind] = new Set(this.records[kind].keys());
    for (const kind of LIST_KINDS) result[kind] = new Set(this.items[kind].keys());
    return result;
  }
  async importData({ records, settings, preferences }: Payload, mode: ImportMode, tombstones: ImportTombstones = {}) {
    // Work on copies so a failure leaves the store untouched (atomic).
    const store = records && mode === 'replace' ? emptyStore() : emptyStore(this.records);
    const tombs = new Map(records && mode === 'replace' ? [] : this.tombstones);
    const areas = new Map(this.areas);
    for (const kind of RECORD_KINDS) for (const id of tombstones.remove?.[kind] ?? []) store[kind].delete(id);
    for (const id of tombstones.forget ?? []) tombs.delete(id);
    for (const t of tombstones.store ?? []) if (!tombs.has(t.id)) tombs.set(t.id, clone(t));
    for (const a of settings?.skinAreas ?? []) {
      if (mode === 'replace' || !areas.has(a.id)) areas.set(a.id, clone(a));
    }
    // Meals first: reactions point at them.
    for (const kind of RECORD_KINDS) {
      for (const r of (records?.[kind] ?? []) as AnyRecord[]) {
        this.checkRefs(r, areas, store.meals);
        if (!store[kind].has(r.id)) store[kind].set(r.id, clone(r));
      }
    }
    const items = Object.fromEntries(LIST_KINDS.map((k) => [k, new Map(this.items[k])])) as typeof this.items;
    for (const kind of LIST_KINDS) {
      for (const i of settings?.[kind] ?? []) {
        if (mode === 'replace' || !items[kind].has(i.id)) items[kind].set(i.id, clone(i));
      }
    }
    if (settings && mode === 'replace') {
      const refs = recordRefs(Object.fromEntries(RECORD_KINDS.map((k) => [k, [...store[k].values()]])) as unknown as Records);
      const keep = new Set([...settings.skinAreas.map((a) => a.id), ...refs.areas]);
      for (const [id, a] of areas) if (!a.predefined && !keep.has(id)) areas.delete(id);
      for (const kind of LIST_KINDS) {
        const keepItems = new Set([...settings[kind].map((i) => i.id), ...refs.items[kind]]);
        for (const [id, i] of items[kind]) if (!i.predefined && !keepItems.has(id)) items[kind].delete(id);
      }
    }
    this.records = store;
    this.areas = areas;
    this.tombstones = tombs;
    if (settings && preferences && (mode === 'replace' || this.preferences === null)) this.preferences = clone(preferences);
    this.items = items;
    this.seed();
  }
}
