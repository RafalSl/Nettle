import { PREDEFINED_AREAS } from '@/core/model/areas';
import { PREDEFINED_ITEMS } from '@/core/model/lists';
import { recordRefs } from '@/core/model/refs';
import {
  EXTRA_KINDS,
  LIST_KINDS,
  type DateRange,
  type ExtraKind,
  type ListItem,
  type ListKind,
  type Meal,
  type Payload,
  type RecordKind,
  type Records,
  type SkinArea,
  type SkinEntry,
  type Snapshot,
  type Stamp,
  type Tombstone,
} from '@/core/model/types';
import type { ExistingIds, ImportMode, StorageRepository } from '@/core/ports/storage';

const inRange = (utc: string, r?: DateRange) =>
  (!r?.from || utc >= r.from) && (!r?.to || utc <= r.to);
const newestFirst = <T extends { at: { utc: string }; id: string }>(a: T, b: T) =>
  b.at.utc.localeCompare(a.at.utc) || a.id.localeCompare(b.id);
const clone = <T>(v: T): T => structuredClone(v);

export class MemoryRepo implements StorageRepository {
  private meals = new Map<string, Meal>();
  private areas = new Map<string, SkinArea>();
  private entries = new Map<string, SkinEntry>();
  private tombstones = new Map<string, Tombstone>();
  private extra = Object.fromEntries(EXTRA_KINDS.map((k) => [k, new Map<string, Records[ExtraKind][number]>()])) as Record<
    ExtraKind,
    Map<string, Records[ExtraKind][number]>
  >;

  constructor() {
    this.seed();
  }

  private items = Object.fromEntries(LIST_KINDS.map((k) => [k, new Map<string, ListItem>()])) as Record<
    ListKind,
    Map<string, ListItem>
  >;

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

  async addMeal(meal: Meal) {
    if (this.meals.has(meal.id)) throw new Error('duplicate id');
    this.meals.set(meal.id, clone(meal));
  }
  async listMeals(range?: DateRange) {
    return [...this.meals.values()].filter((m) => inRange(m.at.utc, range)).sort(newestFirst).map(clone);
  }
  async upsertArea(area: SkinArea) {
    this.areas.set(area.id, clone(area));
  }
  async listAreas() {
    return [...this.areas.values()].sort((a, b) => a.id.localeCompare(b.id)).map(clone);
  }
  async addSkinEntry(entry: SkinEntry) {
    if (this.entries.has(entry.id)) throw new Error('duplicate id');
    if (!this.areas.has(entry.areaId)) throw new Error('unknown area');
    this.entries.set(entry.id, clone(entry));
  }
  async listSkinEntries(range?: DateRange) {
    return [...this.entries.values()].filter((e) => inRange(e.at.utc, range)).sort(newestFirst).map(clone);
  }
  async addRecord<K extends ExtraKind>(kind: K, record: Records[K][number]) {
    if (this.extra[kind].has(record.id)) throw new Error('duplicate id');
    this.checkArea(record);
    this.extra[kind].set(record.id, clone(record));
  }
  async putRecord<K extends ExtraKind>(kind: K, record: Records[K][number]) {
    this.checkArea(record);
    this.extra[kind].set(record.id, clone(record));
  }
  async listRecords<K extends ExtraKind>(kind: K, range?: DateRange): Promise<Records[K]> {
    return [...this.extra[kind].values()]
      .filter((r) => inRange(r.at.utc, range))
      .sort(newestFirst)
      .map(clone) as unknown as Records[K];
  }
  /**
   * Mirrors the foreign keys of the SQL schema: a record's `areaId` and `mealId` must exist. Ids kept inside
   * JSON lists (tags, treatment areas) have no foreign key in SQL, so the use cases and import check them.
   */
  private checkArea(record: object, areas = this.areas, meals = this.meals) {
    const { areaId, mealId } = record as { areaId?: string; mealId?: string };
    if (areaId !== undefined && !areas.has(areaId)) throw new Error('unknown area');
    if (mealId !== undefined && !meals.has(mealId)) throw new Error('unknown meal');
  }
  async putMeal(meal: Meal) {
    if (!this.meals.has(meal.id)) throw new Error('unknown meal');
    this.meals.set(meal.id, clone(meal));
  }
  async putSkinEntry(entry: SkinEntry) {
    if (!this.entries.has(entry.id)) throw new Error('unknown entry');
    if (!this.areas.has(entry.areaId)) throw new Error('unknown area');
    this.entries.set(entry.id, clone(entry));
  }
  async deleteRecords(ids: Partial<Record<RecordKind, string[]>>) {
    for (const id of ids.meals ?? []) this.meals.delete(id);
    for (const id of ids.skinEntries ?? []) this.entries.delete(id);
    for (const kind of EXTRA_KINDS) for (const id of ids[kind] ?? []) this.extra[kind].delete(id);
  }
  async deleteWithTombstones(ids: Partial<Record<RecordKind, string[]>>, at: Stamp) {
    const has = (kind: RecordKind, id: string) =>
      kind === 'meals' ? this.meals.has(id) : kind === 'skinEntries' ? this.entries.has(id) : this.extra[kind].has(id);
    for (const [kind, list] of Object.entries(ids) as [RecordKind, string[]][]) {
      for (const id of list) if (has(kind, id)) this.tombstones.set(id, { id, kind, deletedAt: clone(at) });
    }
    await this.deleteRecords(ids);
  }
  async listTombstones(): Promise<Tombstone[]> {
    return [...this.tombstones.values()]
      .sort((a, b) => a.deletedAt.utc.localeCompare(b.deletedAt.utc) || a.id.localeCompare(b.id))
      .map(clone);
  }

  async snapshot(range?: DateRange): Promise<Snapshot> {
    const snap = {
      meals: await this.listMeals(range),
      skinAreas: await this.listAreas(),
      skinEntries: await this.listSkinEntries(range),
    } as Snapshot;
    for (const kind of LIST_KINDS) Object.assign(snap, { [kind]: await this.listItems(kind) });
    for (const kind of EXTRA_KINDS) Object.assign(snap, { [kind]: await this.listRecords(kind, range) });
    return snap;
  }
  async existingIds(): Promise<ExistingIds> {
    const result = {
      meals: new Set(this.meals.keys()),
      skinAreas: new Set(this.areas.keys()),
      skinEntries: new Set(this.entries.keys()),
    } as ExistingIds;
    for (const kind of EXTRA_KINDS) result[kind] = new Set(this.extra[kind].keys());
    for (const kind of LIST_KINDS) result[kind] = new Set(this.items[kind].keys());
    return result;
  }
  async importData({ records, settings }: Payload, mode: ImportMode) {
    // Work on copies so a failure leaves the store untouched (atomic).
    const meals = new Map(records && mode === 'replace' ? [] : this.meals);
    const entries = new Map(records && mode === 'replace' ? [] : this.entries);
    const areas = new Map(this.areas);
    const extra = Object.fromEntries(
      EXTRA_KINDS.map((k) => [k, new Map(records && mode === 'replace' ? [] : this.extra[k])]),
    ) as typeof this.extra;
    for (const a of settings?.skinAreas ?? []) {
      if (mode === 'replace' || !areas.has(a.id)) areas.set(a.id, clone(a));
    }
    for (const m of records?.meals ?? []) if (!meals.has(m.id)) meals.set(m.id, clone(m));
    for (const e of records?.skinEntries ?? []) {
      if (!areas.has(e.areaId)) throw new Error('unknown area');
      if (!entries.has(e.id)) entries.set(e.id, clone(e));
    }
    for (const kind of EXTRA_KINDS) {
      for (const r of records?.[kind] ?? []) {
        this.checkArea(r, areas, meals);
        if (!extra[kind].has(r.id)) extra[kind].set(r.id, clone(r));
      }
    }
    const items = Object.fromEntries(LIST_KINDS.map((k) => [k, new Map(this.items[k])])) as typeof this.items;
    for (const kind of LIST_KINDS) {
      for (const i of settings?.[kind] ?? []) {
        if (mode === 'replace' || !items[kind].has(i.id)) items[kind].set(i.id, clone(i));
      }
    }
    if (settings && mode === 'replace') {
      const refs = recordRefs({
        meals: [],
        skinEntries: [...entries.values()],
        ...Object.fromEntries(EXTRA_KINDS.map((k) => [k, [...extra[k].values()]])),
      } as unknown as Records);
      const keep = new Set([...settings.skinAreas.map((a) => a.id), ...refs.areas]);
      for (const [id, a] of areas) if (!a.predefined && !keep.has(id)) areas.delete(id);
      for (const kind of LIST_KINDS) {
        const keepItems = new Set([...settings[kind].map((i) => i.id), ...refs.items[kind]]);
        for (const [id, i] of items[kind]) if (!i.predefined && !keepItems.has(id)) items[kind].delete(id);
      }
    }
    this.meals = meals;
    this.areas = areas;
    this.entries = entries;
    this.extra = extra;
    this.items = items;
    this.seed();
  }
}
