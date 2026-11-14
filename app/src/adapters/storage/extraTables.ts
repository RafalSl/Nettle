import { analysisResultFromJson, analysisResultToJson } from '@/core/llm/analysisResult';
import type {
  FlareKind,
  FlareMarker,
  Analysis,
  AlcoholEntry,
  Photo,
  PhotoEntryKind,
  MedicationCategory,
  MedicationEntry,
  ChangeAction,
  ChangeCategory,
  ChangeEvent,
  CheckIn,
  ExtraKind,
  NailEntry,
  NailExtent,
  NailStage,
  Reaction,
  Records,
  StoolEntry,
  Symptom,
  TreatmentApplication,
} from '@/core/model/types';
import type { SqlValue } from './sqlDb';

type Row = Record<string, string | number | null>;

/**
 * How one flat record kind maps to a table (like a tiny ORM mapping). The first three columns are always
 * id, ts_utc, tz so range queries, ordering and id lookups work the same for every kind.
 */
export interface ExtraTable<T> {
  table: string;
  /** Columns after id, ts_utc and tz. */
  columns: string[];
  toValues(record: T): SqlValue[];
  fromRow(row: Row): T;
}

const nail: ExtraTable<NailEntry> = {
  table: 'nail_entry',
  columns: ['area_id', 'stage', 'extent', 'note'],
  toValues: (e) => [e.areaId, e.stage, e.extent, e.note],
  fromRow: (r) => ({
    id: r.id as string,
    at: { utc: r.ts_utc as string, tz: r.tz as string },
    areaId: r.area_id as string,
    stage: r.stage as NailStage,
    extent: r.extent as NailExtent,
    note: r.note as string | null,
  }),
};

const checkIn: ExtraTable<CheckIn> = {
  table: 'check_in',
  columns: [
    'day',
    'wellbeing',
    'stress',
    'sleep',
    'abdominal_pain',
    'bloating',
    'tags_json',
    'note',
    'completed_utc',
    'completed_tz',
  ],
  toValues: (c) => [
    c.day,
    c.wellbeing,
    c.stress,
    c.sleep,
    c.abdominalPain,
    +c.bloating,
    JSON.stringify(c.tags),
    c.note,
    c.completedAt?.utc ?? null,
    c.completedAt?.tz ?? null,
  ],
  fromRow: (r) => ({
    id: r.id as string,
    at: { utc: r.ts_utc as string, tz: r.tz as string },
    day: r.day as string,
    wellbeing: r.wellbeing as number | null,
    stress: r.stress as number | null,
    sleep: r.sleep as number | null,
    abdominalPain: r.abdominal_pain as number | null,
    bloating: !!r.bloating,
    tags: JSON.parse(r.tags_json as string) as string[],
    note: r.note as string | null,
    completedAt: r.completed_utc ? { utc: r.completed_utc as string, tz: r.completed_tz as string } : null,
  }),
};

const stool: ExtraTable<StoolEntry> = {
  table: 'stool_entry',
  columns: ['bristol', 'note'],
  toValues: (e) => [e.bristol, e.note],
  fromRow: (r) => ({
    id: r.id as string,
    at: { utc: r.ts_utc as string, tz: r.tz as string },
    bristol: r.bristol as number,
    note: r.note as string | null,
  }),
};

const treatmentApplication: ExtraTable<TreatmentApplication> = {
  table: 'treatment_application',
  columns: ['treatment_id', 'area_ids_json', 'note'],
  toValues: (a) => [a.treatmentId, JSON.stringify(a.areaIds), a.note],
  fromRow: (r) => ({
    id: r.id as string,
    at: { utc: r.ts_utc as string, tz: r.tz as string },
    treatmentId: r.treatment_id as string,
    areaIds: JSON.parse(r.area_ids_json as string) as string[],
    note: r.note as string | null,
  }),
};

const changeEvent: ExtraTable<ChangeEvent> = {
  table: 'change_event',
  columns: ['action', 'category', 'name', 'note'],
  toValues: (e) => [e.action, e.category, e.name, e.note],
  fromRow: (r) => ({
    id: r.id as string,
    at: { utc: r.ts_utc as string, tz: r.tz as string },
    action: r.action as ChangeAction,
    category: r.category as ChangeCategory,
    name: r.name as string,
    note: r.note as string | null,
  }),
};

const reaction: ExtraTable<Reaction> = {
  table: 'reaction',
  columns: ['meal_id', 'symptoms_json', 'note'],
  toValues: (e) => [e.mealId, JSON.stringify(e.symptoms), e.note],
  fromRow: (r) => ({
    id: r.id as string,
    at: { utc: r.ts_utc as string, tz: r.tz as string },
    mealId: r.meal_id as string,
    symptoms: JSON.parse(r.symptoms_json as string) as Symptom[],
    note: r.note as string | null,
  }),
};

const alcohol: ExtraTable<AlcoholEntry> = {
  table: 'alcohol_entry',
  columns: ['drink', 'amount_ml', 'note'],
  toValues: (e) => [e.drink, e.amountMl, e.note],
  fromRow: (r) => ({
    id: r.id as string,
    at: { utc: r.ts_utc as string, tz: r.tz as string },
    drink: r.drink as string,
    amountMl: r.amount_ml as number,
    note: r.note as string | null,
  }),
};

const medication: ExtraTable<MedicationEntry> = {
  table: 'medication_entry',
  columns: ['category', 'name', 'dose', 'note'],
  toValues: (e) => [e.category, e.name, e.dose, e.note],
  fromRow: (r) => ({
    id: r.id as string,
    at: { utc: r.ts_utc as string, tz: r.tz as string },
    category: r.category as MedicationCategory,
    name: r.name as string,
    dose: r.dose as string | null,
    note: r.note as string | null,
  }),
};

const photo: ExtraTable<Photo> = {
  table: 'photo',
  columns: ['entry_kind', 'entry_id', 'sensitive', 'file'],
  toValues: (p) => [p.entryKind, p.entryId, +p.sensitive, p.file],
  fromRow: (r) => ({
    id: r.id as string,
    at: { utc: r.ts_utc as string, tz: r.tz as string },
    entryKind: r.entry_kind as PhotoEntryKind,
    entryId: r.entry_id as string,
    sensitive: !!r.sensitive,
    file: r.file as string,
  }),
};

const analysis: ExtraTable<Analysis> = {
  table: 'analysis',
  columns: ['day_from', 'day_to', 'model', 'prompt_version', 'language', 'counts_json', 'result_json'],
  toValues: (a) => [a.dayFrom, a.dayTo, a.model, a.promptVersion, a.language, JSON.stringify(a.counts), JSON.stringify(analysisResultToJson(a.result))],
  fromRow: (r) => ({
    id: r.id as string,
    at: { utc: r.ts_utc as string, tz: r.tz as string },
    dayFrom: r.day_from as string,
    dayTo: r.day_to as string,
    model: r.model as string,
    promptVersion: r.prompt_version as string,
    language: r.language as 'en' | 'pl',
    counts: JSON.parse(r.counts_json as string) as Record<string, number>,
    // Written by this app from a validated result, so the shape is known.
    result: analysisResultFromJson(JSON.parse(r.result_json as string))!,
  }),
};

const flare: ExtraTable<FlareMarker> = {
  table: 'flare_marker',
  columns: ['area_id', 'kind', 'note'],
  toValues: (f) => [f.areaId, f.kind, f.note],
  fromRow: (r) => ({
    id: r.id as string,
    at: { utc: r.ts_utc as string, tz: r.tz as string },
    areaId: r.area_id as string,
    kind: r.kind as FlareKind,
    note: r.note as string | null,
  }),
};

export const EXTRA_TABLES: { [K in ExtraKind]: ExtraTable<Records[K][number]> } = {
  nailEntries: nail,
  checkIns: checkIn,
  stoolEntries: stool,
  treatmentApplications: treatmentApplication,
  changeEvents: changeEvent,
  reactions: reaction,
  alcoholEntries: alcohol,
  medicationEntries: medication,
  photos: photo,
  analyses: analysis,
  flareMarkers: flare,
};
