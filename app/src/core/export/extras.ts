import {
  ALLERGENS,
  CHANGE_ACTIONS,
  FLARE_KINDS,
  type FlareMarker,
  MEDICATION_CATEGORIES,
  type Drink,
  type Analysis,
  type Photo,
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
import { analysisResultFromJson, analysisResultToJson } from '../llm/analysisResult';
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

const drink: Codec<Drink> = {
  key: 'drinks',
  toJson: (e) => ({
    id: e.id,
    utc: e.at.utc,
    tz: e.at.tz,
    name: e.name,
    amount_ml: e.amountMl,
    alcohol: e.alcohol,
    ingredients: [...e.ingredients],
    allergens: [...e.allergens],
    note: e.note,
  }),
  parse: (o, w) => {
    const ml = o.amount_ml;
    if (typeof ml !== 'number' || !Number.isInteger(ml) || ml <= 0) bad(`${w}.amount_ml`);
    if (typeof o.alcohol !== 'boolean') bad(`${w}.alcohol`);
    const ing = o.ingredients;
    if (!Array.isArray(ing) || ing.some((x) => typeof x !== 'string')) bad(`${w}.ingredients`);
    return {
      id: str(o, 'id', w),
      at: { utc: utc(o, w), tz: str(o, 'tz', w) },
      name: str(o, 'name', w),
      amountMl: ml as number,
      alcohol: o.alcohol as boolean,
      ingredients: ing as string[],
      allergens: enumList(o, 'allergens', ALLERGENS, w),
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

/**
 * SK-4: in data.json `file` is the photo's path inside the ZIP (EX-2); the export code rewrites it from the
 * store key before writing and the import code turns it back into a store key after reading the bytes.
 */
/** Only plain names inside photos/ are accepted, so a crafted file cannot point outside the ZIP. */
const PHOTO_PATH = /^photos\/[A-Za-z0-9._-]+$/;
const photoPath = (o: Obj, w: string): string => {
  const v = str(o, 'file', w);
  return PHOTO_PATH.test(v) && !v.includes('..') ? v : bad(`${w}.file`);
};

const photo: Codec<Photo> = {
  key: 'photos',
  toJson: (p) => ({
    id: p.id,
    utc: p.at.utc,
    tz: p.at.tz,
    entry_kind: p.entryKind,
    entry_id: p.entryId,
    sensitive: p.sensitive,
    file: p.file,
  }),
  parse: (o, w) => ({
    id: str(o, 'id', w),
    at: { utc: utc(o, w), tz: str(o, 'tz', w) },
    entryKind: oneOf(o, 'entry_kind', ['skinEntry', 'nailEntry'] as const, w),
    entryId: str(o, 'entry_id', w),
    sensitive: bool(o, 'sensitive', w),
    file: photoPath(o, w),
  }),
};

/** LL-7, EX-4: stored analyses travel in data.json; the result keeps the shape the model answered with. */
const analysis: Codec<Analysis> = {
  key: 'analyses',
  toJson: (a) => ({
    id: a.id,
    utc: a.at.utc,
    tz: a.at.tz,
    day_from: a.dayFrom,
    day_to: a.dayTo,
    model: a.model,
    prompt_version: a.promptVersion,
    language: a.language,
    counts: a.counts,
    result: analysisResultToJson(a.result),
  }),
  parse: (o, w) => {
    const counts = o.counts;
    if (typeof counts !== 'object' || counts === null || Object.values(counts).some((n) => typeof n !== 'number')) bad(`${w}.counts`);
    const result = analysisResultFromJson(o.result);
    if (!result) bad(`${w}.result`);
    const day = (k: string) => {
      const v = str(o, k, w);
      return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : bad(`${w}.${k}`);
    };
    return {
      id: str(o, 'id', w),
      at: { utc: utc(o, w), tz: str(o, 'tz', w) },
      dayFrom: day('day_from'),
      dayTo: day('day_to'),
      model: str(o, 'model', w),
      promptVersion: str(o, 'prompt_version', w),
      language: oneOf(o, 'language', ['en', 'pl'] as const, w),
      counts: counts as Record<string, number>,
      result: result!,
    };
  },
};

const flare: Codec<FlareMarker> = {
  key: 'flare_markers',
  toJson: (f) => ({ id: f.id, utc: f.at.utc, tz: f.at.tz, area_id: f.areaId, kind: f.kind, note: f.note }),
  parse: (o, w) => ({
    id: str(o, 'id', w),
    at: { utc: utc(o, w), tz: str(o, 'tz', w) },
    areaId: str(o, 'area_id', w),
    kind: oneOf(o, 'kind', FLARE_KINDS, w),
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
  drinks: drink,
  medicationEntries: medication,
  photos: photo,
  analyses: analysis,
  flareMarkers: flare,
};

export { EXTRA_KINDS };
