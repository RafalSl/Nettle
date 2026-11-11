import { PREDEFINED_AREAS } from '@/core/model/areas';
import type { DateRange, Meal, Payload, SkinArea, SkinEntry, Snapshot } from '@/core/model/types';
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
  async snapshot(range?: DateRange): Promise<Snapshot> {
    return {
      meals: await this.listMeals(range),
      skinAreas: await this.listAreas(),
      skinEntries: await this.listSkinEntries(range),
    };
  }
  async existingIds(): Promise<ExistingIds> {
    return {
      meals: new Set(this.meals.keys()),
      skinAreas: new Set(this.areas.keys()),
      skinEntries: new Set(this.entries.keys()),
    };
  }
  async importData({ records, settings }: Payload, mode: ImportMode) {
    // Work on copies so a failure leaves the store untouched (atomic).
    const meals = new Map(records && mode === 'replace' ? [] : this.meals);
    const entries = new Map(records && mode === 'replace' ? [] : this.entries);
    const areas = new Map(this.areas);
    for (const a of settings?.skinAreas ?? []) {
      if (mode === 'replace' || !areas.has(a.id)) areas.set(a.id, clone(a));
    }
    for (const m of records?.meals ?? []) if (!meals.has(m.id)) meals.set(m.id, clone(m));
    for (const e of records?.skinEntries ?? []) {
      if (!areas.has(e.areaId)) throw new Error('unknown area');
      if (!entries.has(e.id)) entries.set(e.id, clone(e));
    }
    if (settings && mode === 'replace') {
      const keep = new Set([...settings.skinAreas.map((a) => a.id), ...[...entries.values()].map((e) => e.areaId)]);
      for (const [id, a] of areas) if (!a.predefined && !keep.has(id)) areas.delete(id);
    }
    this.meals = meals;
    this.areas = areas;
    this.entries = entries;
    this.seed();
  }
}
