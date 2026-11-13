import { PREDEFINED_AREAS } from '@/core/model/areas';
import {
  EXTRA_KINDS,
  type DateRange,
  type ExtraKind,
  type Meal,
  type Payload,
  type Records,
  type SkinArea,
  type SkinEntry,
  type Snapshot,
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
  private extra = Object.fromEntries(EXTRA_KINDS.map((k) => [k, new Map<string, Records[ExtraKind][number]>()])) as Record<
    ExtraKind,
    Map<string, Records[ExtraKind][number]>
  >;

  constructor() {
    this.seed();
  }

  private seed() {
    for (const a of PREDEFINED_AREAS) if (!this.areas.has(a.id)) this.areas.set(a.id, clone(a));
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
  async listRecords<K extends ExtraKind>(kind: K, range?: DateRange): Promise<Records[K]> {
    return [...this.extra[kind].values()]
      .filter((r) => inRange(r.at.utc, range))
      .sort(newestFirst)
      .map(clone) as unknown as Records[K];
  }
  private checkArea(record: object, areas = this.areas) {
    const areaId = (record as { areaId?: string }).areaId;
    if (areaId !== undefined && !areas.has(areaId)) throw new Error('unknown area');
  }
  async snapshot(range?: DateRange): Promise<Snapshot> {
    const snap = {
      meals: await this.listMeals(range),
      skinAreas: await this.listAreas(),
      skinEntries: await this.listSkinEntries(range),
    } as Snapshot;
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
        this.checkArea(r, areas);
        if (!extra[kind].has(r.id)) extra[kind].set(r.id, clone(r));
      }
    }
    if (settings && mode === 'replace') {
      const usedAreas = [...entries.values(), ...EXTRA_KINDS.flatMap((k) => [...extra[k].values()])].map(
        (e) => (e as { areaId?: string }).areaId,
      );
      const keep = new Set([...settings.skinAreas.map((a) => a.id), ...usedAreas]);
      for (const [id, a] of areas) if (!a.predefined && !keep.has(id)) areas.delete(id);
    }
    this.meals = meals;
    this.areas = areas;
    this.entries = entries;
    this.extra = extra;
    this.seed();
  }
}
