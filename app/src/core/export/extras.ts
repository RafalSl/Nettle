import {
  EXTRA_KINDS,
  NAIL_EXTENTS,
  NAIL_STAGES,
  type CheckIn,
  type ExtraKind,
  type NailEntry,
  type Records,
  type StoolEntry,
} from '../model/types';
import { CANONICAL_UTC } from '../model/time';
import { bad, bool, nullableScore, nullableText, oneOf, str, stringList, utc, type Obj } from './guards';

/**
 * data.json wire format for the flat record kinds (see ExtraKind): `key` is the snake_case array name inside
 * `records`, `toJson` and `parse` convert one row. Adding a kind means adding one entry here.
 */
interface Codec<T> {
  key: string;
  toJson(record: T): Obj;
  parse(o: Obj, where: string): T;
}

const nail: Codec<NailEntry> = {
  key: 'nail_entries',
  toJson: (e) => ({
    id: e.id,
    utc: e.at.utc,
    tz: e.at.tz,
    area_id: e.areaId,
    stage: e.stage,
    extent: e.extent,
    note: e.note,
  }),
  parse: (o, w) => ({
    id: str(o, 'id', w),
    at: { utc: utc(o, w), tz: str(o, 'tz', w) },
    areaId: str(o, 'area_id', w),
    stage: oneOf(o, 'stage', NAIL_STAGES, w),
    extent: oneOf(o, 'extent', NAIL_EXTENTS, w),
    note: nullableText(o, 'note', w),
  }),
};

const LOCAL_DAY = /^\d{4}-\d{2}-\d{2}$/;

const checkIn: Codec<CheckIn> = {
  key: 'check_ins',
  toJson: (c) => ({
    id: c.id,
    utc: c.at.utc,
    tz: c.at.tz,
    day: c.day,
    wellbeing: c.wellbeing,
    stress: c.stress,
    sleep: c.sleep,
    abdominal_pain: c.abdominalPain,
    bloating: c.bloating,
    tags: [...c.tags],
    note: c.note,
    completed_utc: c.completedAt?.utc ?? null,
    completed_tz: c.completedAt?.tz ?? null,
  }),
  parse: (o, w) => {
    const day = str(o, 'day', w);
    if (!LOCAL_DAY.test(day) || Number.isNaN(Date.parse(day))) bad(`${w}.day`);
    const completedUtc = nullableText(o, 'completed_utc', w);
    if (completedUtc !== null && (!CANONICAL_UTC.test(completedUtc) || Number.isNaN(Date.parse(completedUtc)))) {
      bad(`${w}.completed_utc`);
    }
    const completedTz = nullableText(o, 'completed_tz', w);
    if ((completedUtc === null) !== (completedTz === null)) bad(`${w}.completed_tz`);
    return {
      id: str(o, 'id', w),
      at: { utc: utc(o, w), tz: str(o, 'tz', w) },
      day,
      wellbeing: nullableScore(o, 'wellbeing', w),
      stress: nullableScore(o, 'stress', w),
      sleep: nullableScore(o, 'sleep', w),
      abdominalPain: nullableScore(o, 'abdominal_pain', w),
      bloating: bool(o, 'bloating', w),
      tags: stringList(o, 'tags', w),
      note: nullableText(o, 'note', w),
      completedAt: completedUtc === null ? null : { utc: completedUtc, tz: completedTz! },
    };
  },
};

const stool: Codec<StoolEntry> = {
  key: 'stool_entries',
  toJson: (e) => ({ id: e.id, utc: e.at.utc, tz: e.at.tz, bristol: e.bristol, note: e.note }),
  parse: (o, w) => {
    const b = o.bristol;
    if (typeof b !== 'number' || !Number.isInteger(b) || b < 1 || b > 7) bad(`${w}.bristol`);
    return {
      id: str(o, 'id', w),
      at: { utc: utc(o, w), tz: str(o, 'tz', w) },
      bristol: b as number,
      note: nullableText(o, 'note', w),
    };
  },
};

export const EXTRA_CODECS: { [K in ExtraKind]: Codec<Records[K][number]> } = {
  nailEntries: nail,
  checkIns: checkIn,
  stoolEntries: stool,
};

export { EXTRA_KINDS };
