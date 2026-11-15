import { NettleError } from '../model/errors';
import type { RegularItem, ReminderTime } from '../model/preferences';
import { normalizeText } from '../model/suggestions';
import { MEDICATION_CATEGORIES, type MedicationCategory } from '../model/types';
import type { Deps } from './deps';
import { applyTreatment } from './events';
import { logMedication } from './intake';
import { change, getPreferences } from './preferences';

export async function listRegular(deps: Deps): Promise<RegularItem[]> {
  return (await getPreferences(deps)).regular;
}

const sameAreas = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

/**
 * IN-17: mark a medication or supplement as regular. The same name, category and dose is one regular item: adding
 * it again changes nothing and returns the existing one.
 */
export async function addRegularMedication(deps: Deps, input: { category: MedicationCategory; name: string; dose?: string | null }): Promise<RegularItem> {
  if (!MEDICATION_CATEGORIES.includes(input.category)) throw new NettleError('invalid_value', 'category');
  const name = input.name.trim();
  if (!name) throw new NettleError('empty_name');
  const dose = input.dose?.trim() || null;
  const prefs = await getPreferences(deps);
  const same = prefs.regular.find((r) => r.kind === 'medication' && r.category === input.category && normalizeText(r.name ?? '') === normalizeText(name) && normalizeText(r.dose ?? '') === normalizeText(dose ?? ''));
  if (same) return same;
  const item: RegularItem = { id: deps.ids(), kind: 'medication', category: input.category, name, dose, treatmentId: null, areaIds: [], times: [], hideName: false };
  await change(deps, (p) => void p.regular.push(item));
  return item;
}

/** IN-17: mark a treatment with its areas as regular. The same treatment and areas is one regular item. */
export async function addRegularTreatment(deps: Deps, input: { treatmentId: string; areaIds: string[] }): Promise<RegularItem> {
  const areaIds = [...new Set(input.areaIds)];
  if (areaIds.length === 0) throw new NettleError('no_areas_selected');
  if (!(await deps.repo.listItems('treatments')).some((t) => t.id === input.treatmentId)) throw new NettleError('unknown_item', input.treatmentId);
  const known = new Set((await deps.repo.listAreas()).map((a) => a.id));
  for (const id of areaIds) if (!known.has(id)) throw new NettleError('unknown_area', id);
  const prefs = await getPreferences(deps);
  const same = prefs.regular.find((r) => r.kind === 'treatment' && r.treatmentId === input.treatmentId && sameAreas(r.areaIds, areaIds));
  if (same) return same;
  const item: RegularItem = { id: deps.ids(), kind: 'treatment', category: null, name: null, dose: null, treatmentId: input.treatmentId, areaIds, times: [], hideName: false };
  await change(deps, (p) => void p.regular.push(item));
  return item;
}

async function edit(deps: Deps, id: string, fn: (r: RegularItem) => void): Promise<RegularItem> {
  let found: RegularItem | undefined;
  await change(deps, (p) => {
    found = p.regular.find((r) => r.id === id);
    if (found) fn(found);
  });
  if (!found) throw new NettleError('unknown_item', id);
  return found;
}

const valid = (t: ReminderTime) => Number.isInteger(t.hour) && t.hour >= 0 && t.hour <= 23 && Number.isInteger(t.minute) && t.minute >= 0 && t.minute <= 59;

/** IN-17: the daily reminder times of a regular item (at most 8, no duplicates), earliest first. */
export async function setRegularTimes(deps: Deps, id: string, times: ReminderTime[]): Promise<RegularItem> {
  if (times.length > 8 || !times.every(valid)) throw new NettleError('invalid_value', 'times');
  const unique = [...new Map(times.map((t) => [t.hour * 60 + t.minute, { hour: t.hour, minute: t.minute }])).values()].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  return edit(deps, id, (r) => void (r.times = unique));
}

/** IN-17: keep the item's name out of its notification text. */
export async function setRegularHideName(deps: Deps, id: string, hide: boolean): Promise<RegularItem> {
  return edit(deps, id, (r) => void (r.hideName = hide));
}

/** IN-17: stop a regular item. Its reminders go (after the next `applyReminders`); entries already logged stay. */
export async function stopRegular(deps: Deps, id: string): Promise<void> {
  if (!(await listRegular(deps)).some((r) => r.id === id)) throw new NettleError('unknown_item', id);
  await change(deps, (p) => void (p.regular = p.regular.filter((r) => r.id !== id)));
}

/** IN-17: log one dose or application of a regular item, at the given time (default now). */
export async function logRegular(deps: Deps, id: string, at?: Date) {
  const item = (await listRegular(deps)).find((r) => r.id === id);
  if (!item) throw new NettleError('unknown_item', id);
  if (item.kind === 'medication') {
    return logMedication(deps, { category: item.category!, name: item.name!, ...(item.dose ? { dose: item.dose } : {}), ...(at ? { at } : {}) });
  }
  return applyTreatment(deps, { treatmentId: item.treatmentId!, areaIds: item.areaIds, ...(at ? { at } : {}) });
}
