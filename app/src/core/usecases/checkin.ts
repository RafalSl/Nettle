import { NettleError } from '../model/errors';
import { localDay, makeStamp } from '../model/time';
import type { CheckIn, LocalDay, OptionalScore, StoolEntry } from '../model/types';
import type { Deps } from './deps';
import { isScore } from './skin';

export interface CheckInInput {
  /** The moment the check-in is about (editable); decides its local day. Defaults to the existing entry's time, else now. */
  at?: Date;
  wellbeing?: OptionalScore;
  stress?: OptionalScore;
  sleep?: OptionalScore;
  abdominalPain?: OptionalScore;
  bloating?: boolean;
  /** Ids of daily tags that are "yes" today. */
  tags?: string[];
  note?: string;
  /** SK-11: true closes the day, false reopens it, omitted leaves the mark as it is. */
  complete?: boolean;
}

const SCORES = ['wellbeing', 'stress', 'sleep', 'abdominalPain'] as const;

/** SK-7: the check-in of one local day, or null. If a merge ever left two, the newest wins. */
export async function getCheckIn(deps: Deps, day: LocalDay): Promise<CheckIn | null> {
  const all = (await deps.repo.listRecords('checkIns')).filter((c) => c.day === day);
  return all[0] ?? null; // listRecords is newest first
}

/**
 * SK-7, SK-11: creates or updates the single check-in of the local day. The input is the full state of the
 * screen, so omitted scores become "not recorded", bloating false and tags empty.
 */
export async function saveCheckIn(deps: Deps, input: CheckInInput): Promise<CheckIn> {
  for (const key of SCORES) {
    const v = input[key] ?? null;
    if (v !== null && !isScore(v)) throw new NettleError('invalid_score', key);
  }
  const tags = [...new Set(input.tags ?? [])];
  const known = new Set((await deps.repo.listItems('dailyTags')).map((t) => t.id));
  for (const id of tags) if (!known.has(id)) throw new NettleError('unknown_item', id);

  const probe = makeStamp(deps.clock, input.at);
  const existing = await getCheckIn(deps, localDay(probe.utc, probe.tz));
  const at = input.at || !existing ? probe : existing.at;
  const day = localDay(at.utc, at.tz);
  const completedAt =
    input.complete === undefined ? (existing?.completedAt ?? null) : input.complete ? (existing?.completedAt ?? makeStamp(deps.clock)) : null;
  const record: CheckIn = {
    id: existing?.id ?? deps.ids(),
    at,
    day,
    wellbeing: input.wellbeing ?? null,
    stress: input.stress ?? null,
    sleep: input.sleep ?? null,
    abdominalPain: input.abdominalPain ?? null,
    bloating: input.bloating ?? false,
    tags,
    note: input.note?.trim() || null,
    completedAt,
  };
  await deps.repo.putRecord('checkIns', record);
  return record;
}

/** SK-11: mark a day complete or remove the mark. The check-in must exist. */
export async function setDayComplete(deps: Deps, day: LocalDay, complete: boolean): Promise<CheckIn> {
  const existing = await getCheckIn(deps, day);
  if (!existing) throw new NettleError('checkin_not_found', day);
  const record = { ...existing, completedAt: complete ? (existing.completedAt ?? makeStamp(deps.clock)) : null };
  await deps.repo.putRecord('checkIns', record);
  return record;
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
