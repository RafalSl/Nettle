import { LIST_KINDS, type ListKind, type Records } from './types';

/**
 * Ids that records point at. Used to refuse imports with dangling references and to keep a user-defined
 * area or list item that is still in use when settings are replaced (EX-10).
 */
export interface RecordRefs {
  areas: Set<string>;
  items: Record<ListKind, Set<string>>;
  meals: Set<string>;
  skinEntries: Set<string>;
  nailEntries: Set<string>;
}

export function recordRefs(records: Records): RecordRefs {
  const refs: RecordRefs = {
    areas: new Set(),
    items: Object.fromEntries(LIST_KINDS.map((k) => [k, new Set<string>()])) as RecordRefs['items'],
    meals: new Set(),
    skinEntries: new Set(),
    nailEntries: new Set(),
  };
  for (const e of records.skinEntries) refs.areas.add(e.areaId);
  for (const e of records.nailEntries) refs.areas.add(e.areaId);
  for (const f of records.flareMarkers) refs.areas.add(f.areaId);
  for (const c of records.checkIns) c.tags.forEach((t) => refs.items.dailyTags.add(t));
  for (const a of records.treatmentApplications) {
    refs.items.treatments.add(a.treatmentId);
    a.areaIds.forEach((id) => refs.areas.add(id));
  }
  for (const r of records.reactions) refs.meals.add(r.mealId);
  for (const p of records.photos) (p.entryKind === 'skinEntry' ? refs.skinEntries : refs.nailEntries).add(p.entryId);
  return refs;
}
