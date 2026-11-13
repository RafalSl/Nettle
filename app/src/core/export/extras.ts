import {
  CHANGE_ACTIONS,
  MEDICATION_CATEGORIES,
  type AlcoholEntry,
  type MedicationEntry,
  CHANGE_CATEGORIES,
  EXTRA_KINDS,
  NAIL_EXTENTS,
  NAIL_STAGES,
  SYMPTOMS,
  type ChangeEvent,
  type CheckIn,
  type ExtraKind,
  type NailEntry,
  type Reaction,
  type Records,
  type StoolEntry,
  type TreatmentApplication,
} from '../model/types';
import { CANONICAL_UTC } from '../model/time';
import { bad, bool, enumList, nullableScore, nullableText, oneOf, str, stringList, utc, type Obj } from './guards';

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

const treatmentApplication: Codec<TreatmentApplication> = {
  key: 'treatment_applications',
  toJson: (a) => ({ id: a.id, utc: a.at.utc, tz: a.at.tz, treatment_id: a.treatmentId, area_ids: [...a.areaIds], note: a.note }),
  parse: (o, w) => {
    const areaIds = stringList(o, 'area_ids', w);
    if (areaIds.length === 0) bad(`${w}.area_ids`);
    return {
      id: str(o, 'id', w),
      at: { utc: utc(o, w), tz: str(o, 'tz', w) },
      treatmentId: str(o, 'treatment_id', w),
      areaIds,
      note: nullableText(o, 'note', w),
    };
  },
};

const changeEvent: Codec<ChangeEvent> = {
  key: 'change_events',
  toJson: (e) => ({ id: e.id, utc: e.at.utc, tz: e.at.tz, action: e.action, category: e.category, name: e.name, note: e.note }),
  parse: (o, w) => ({
    id: str(o, 'id', w),
    at: { utc: utc(o, w), tz: str(o, 'tz', w) },
    action: oneOf(o, 'action', CHANGE_ACTIONS, w),
    category: oneOf(o, 'category', CHANGE_CATEGORIES, w),
    name: str(o, 'name', w),
    note: nullableText(o, 'note', w),
  }),
};

const reaction: Codec<Reaction> = {
  key: 'reactions',
  toJson: (r) => ({ id: r.id, utc: r.at.utc, tz: r.at.tz, meal_id: r.mealId, symptoms: [...r.symptoms], note: r.note }),
  parse: (o, w) => {
    const symptoms = enumList(o, 'symptoms', SYMPTOMS, w);
    if (symptoms.length === 0) bad(`${w}.symptoms`);
    return {
      id: str(o, 'id', w),
      at: { utc: utc(o, w), tz: str(o, 'tz', w) },
      mealId: str(o, 'meal_id', w),
      symptoms,
      note: nullableText(o, 'note', w),
    };
  },
};

const alcohol: Codec<AlcoholEntry> = {
  key: 'alcohol_entries',
  toJson: (e) => ({ id: e.id, utc: e.at.utc, tz: e.at.tz, drink: e.drink, amount_ml: e.amountMl, note: e.note }),
  parse: (o, w) => {
    const ml = o.amount_ml;
    if (typeof ml !== 'number' || !Number.isInteger(ml) || ml <= 0) bad(`${w}.amount_ml`);
    return {
      id: str(o, 'id', w),
      at: { utc: utc(o, w), tz: str(o, 'tz', w) },
      drink: str(o, 'drink', w),
      amountMl: ml as number,
      note: nullableText(o, 'note', w),
    };
  },
};

const medication: Codec<MedicationEntry> = {
  key: 'medication_entries',
  toJson: (e) => ({ id: e.id, utc: e.at.utc, tz: e.at.tz, category: e.category, name: e.name, dose: e.dose, note: e.note }),
  parse: (o, w) => ({
    id: str(o, 'id', w),
    at: { utc: utc(o, w), tz: str(o, 'tz', w) },
    category: oneOf(o, 'category', MEDICATION_CATEGORIES, w),
    name: str(o, 'name', w),
    dose: nullableText(o, 'dose', w),
    note: nullableText(o, 'note', w),
  }),
};

export const EXTRA_CODECS: { [K in ExtraKind]: Codec<Records[K][number]> } = {
  nailEntries: nail,
  checkIns: checkIn,
  stoolEntries: stool,
  treatmentApplications: treatmentApplication,
  changeEvents: changeEvent,
  reactions: reaction,
  alcoholEntries: alcohol,
  medicationEntries: medication,
};

export { EXTRA_KINDS };
