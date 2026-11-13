import type { Records } from './types';

/**
 * Ids that records point at: areas and list items (tags). Used to refuse imports with dangling references
 * and to keep a user-defined area or item that is still in use when settings are replaced (EX-10).
 */
export function recordRefs(records: Records): { areas: Set<string>; items: Set<string> } {
  const areas = new Set<string>();
  const items = new Set<string>();
  for (const e of records.skinEntries) areas.add(e.areaId);
  for (const e of records.nailEntries) areas.add(e.areaId);
  for (const c of records.checkIns) c.tags.forEach((t) => items.add(t));
  return { areas, items };
}
