import { NettleError } from '../model/errors';
import { localDay, makeStamp } from '../model/time';
import type { CheckIn, ListItem, LocalDay, StoolEntry } from '../model/types';
import type { Deps } from './deps';
import { isScore } from './skin';

export interface CheckInInput {
  /** The moment the record is about (editable); decides its local day. Defaults to the existing entry's time, else now. */
  at?: Date;
  /** Daily health values by item id: a score 0-10, or a boolean. A score left out is "not recorded"; a false is dropped. */
  values?: Record<string, number | boolean | null | undefined>;
  note?: string;
  /** SK-11: saving a day with no meals logged throws `day_has_no_meals` unless this is true. */
  confirmEmptyDay?: boolean;
}

/** SK-7: the Daily health record of one local day, or null. If a merge ever left two, the newest wins. */
export async function getCheckIn(deps: Deps, day: LocalDay): Promise<CheckIn | null> {
  const all = (await deps.repo.listRecords('checkIns')).filter((c) => c.day === day);
  return all[0] ?? null; // listRecords is newest first
}

/** SK-11: saving a day with no meals asks first, because the analysis discounts days without intake (LL-4). */
async function assertDayHasMeals(deps: Deps, day: LocalDay, confirmed?: boolean): Promise<void> {
  if (confirmed) return;
  const any = (await deps.repo.listMeals()).some((m) => localDay(m.at.utc, m.at.tz, deps.dayStart.get()) === day);
  if (!any) throw new NettleError('day_has_no_meals', day);
}

/**
 * SK-7: checks the values against the items (known id, score 0-10 for a score item, boolean for a yes/no) and
 * returns the record's values. An archived item is no longer asked, so it keeps what the day already had.
 */
export async function cleanValues(deps: Deps, input: CheckInInput, previous: CheckIn | null): Promise<Record<string, number | boolean>> {
  const items = new Map((await deps.repo.listItems('dailyItems')).map((i) => [i.id, i]));
  const out: Record<string, number | boolean> = {};
  for (const [id, v] of Object.entries(input.values ?? {})) {
    if (v === null || v === undefined) continue;
    const item = items.get(id);
    if (!item) throw new NettleError('unknown_item', id);
    if (item.archived) continue; // never asked, so never changed
    if (item.valueKind === 'score') {
      if (typeof v !== 'number' || !isScore(v)) throw new NettleError('invalid_score', id);
      out[id] = v;
    } else {
      if (typeof v !== 'boolean') throw new NettleError('invalid_value', id);
      if (v) out[id] = true;
    }
  }
  for (const [id, v] of Object.entries(previous?.values ?? {})) if (items.get(id)?.archived) out[id] = v;
  return out;
}

/**
 * SK-7, SK-11: creates or updates the single Daily health record of the local day. The input is the full state of
 * the screen, so a missing score becomes "not recorded". Saving logs the day.
 */
export async function saveCheckIn(deps: Deps, input: CheckInInput): Promise<CheckIn> {
  const probe = makeStamp(deps.clock, input.at);
  const existing = await getCheckIn(deps, localDay(probe.utc, probe.tz, deps.dayStart.get()));
  const at = input.at || !existing ? probe : existing.at;
  const day = localDay(at.utc, at.tz, deps.dayStart.get());
  const values = await cleanValues(deps, input, existing);
  if (!existing) await assertDayHasMeals(deps, day, input.confirmEmptyDay);
  const record: CheckIn = { id: existing?.id ?? deps.ids(), at, day, values, note: input.note?.trim() || null };
  await deps.repo.putRecord('checkIns', record);
  return record;
}

/** SK-7: what "Same as yesterday" copies: the values of the previous day for the items that can still be asked. */
export function askableValues(items: ListItem[], previous: CheckIn): Record<string, number | boolean> {
  const active = new Set(items.filter((i) => !i.archived).map((i) => i.id));
  return Object.fromEntries(Object.entries(previous.values).filter(([id]) => active.has(id)));
}

/** SK-7: Bristol type 1-7, timestamped, several per day. */
export async function logStool(deps: Deps, input: { bristol: number; at?: Date; note?: string }): Promise<StoolEntry> {
  if (!Number.isInteger(input.bristol) || input.bristol < 1 || input.bristol > 7) {
    throw new NettleError('invalid_stool_type', String(input.bristol));
  }
  const entry: StoolEntry = {
    id: deps.ids(),
    at: makeStamp(deps.clock, input.at),
    bristol: input.bristol,
    note: input.note?.trim() || null,
  };
  await deps.repo.addRecord('stoolEntries', entry);
  return entry;
}
