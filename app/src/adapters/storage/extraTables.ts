import { analysisResultFromJson, analysisResultToJson } from '@/core/llm/analysisResult';
import type {
  Allergen,
  Analysis,
  Drink,
  Photo,
  PhotoEntryKind,
  MedicationCategory,
  MedicationEntry,
  ChangeAction,
  ChangeEvent,
  CheckIn,
  ExtraKind,
  NailEntry,
  NailExtent,
  NailStage,
  Reaction,
  Records,
  ReportSummary,
  StoolEntry,
  Symptom,
  TreatmentApplication,
  TreatmentReaction,
} from '@/core/model/types';
import { normalizeSource } from '@/core/model/source';
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
  columns: ['day', 'values_json', 'note'],
  toValues: (c) => [c.day, JSON.stringify(c.values), c.note],
  fromRow: (r) => ({
    id: r.id as string,
    at: { utc: r.ts_utc as string, tz: r.tz as string },
    day: r.day as string,
    values: JSON.parse(r.values_json as string) as Record<string, number | boolean>,
    note: r.note as string | null,
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
  columns: ['treatment_id', 'area_ids_json', 'reaction', 'note'],
  toValues: (a) => [a.treatmentId, JSON.stringify(a.areaIds), a.reaction, a.note],
  fromRow: (r) => ({
    id: r.id as string,
    at: { utc: r.ts_utc as string, tz: r.tz as string },
    treatmentId: r.treatment_id as string,
    areaIds: JSON.parse(r.area_ids_json as string) as string[],
    reaction: r.reaction as TreatmentReaction | null,
    note: r.note as string | null,
  }),
};

const changeEvent: ExtraTable<ChangeEvent> = {
  table: 'change_event',
  columns: ['action', 'category', 'name', 'date_unknown', 'note'],
  toValues: (e) => [e.action, e.category, e.name, +e.dateUnknown, e.note],
  fromRow: (r) => ({
    id: r.id as string,
    at: { utc: r.ts_utc as string, tz: r.tz as string },
    action: r.action as ChangeAction,
    category: r.category as string,
    name: r.name as string,
    dateUnknown: !!r.date_unknown,
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

const drink: ExtraTable<Drink> = {
  table: 'drink',
  columns: ['name', 'amount_ml', 'alcohol', 'ingredients_json', 'allergens_json', 'barcode', 'source_json', 'note'],
  toValues: (e) => [e.name, e.amountMl, +e.alcohol, JSON.stringify(e.ingredients), JSON.stringify(e.allergens), e.barcode, JSON.stringify(e.source), e.note],
  fromRow: (r) => ({
    id: r.id as string,
    at: { utc: r.ts_utc as string, tz: r.tz as string },
    name: r.name as string,
    amountMl: r.amount_ml as number,
    alcohol: !!r.alcohol,
    ingredients: JSON.parse(r.ingredients_json as string) as string[],
    allergens: JSON.parse(r.allergens_json as string) as Allergen[],
    barcode: r.barcode as string | null,
    source: normalizeSource(JSON.parse(r.source_json as string)),
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

const reportSummary: ExtraTable<ReportSummary> = {
  table: 'report_summary',
  columns: ['day_from', 'day_to', 'language', 'model', 'prompt_version', 'counts_json', 'generated', 'text'],
  toValues: (s) => [s.dayFrom, s.dayTo, s.language, s.model, s.promptVersion, JSON.stringify(s.counts), s.generated, s.text],
  fromRow: (r) => ({
    id: r.id as string,
    at: { utc: r.ts_utc as string, tz: r.tz as string },
    dayFrom: r.day_from as string,
    dayTo: r.day_to as string,
    language: r.language as 'en' | 'pl',
    model: r.model as string,
    promptVersion: r.prompt_version as string,
    counts: JSON.parse(r.counts_json as string) as Record<string, number>,
    generated: r.generated as string,
    text: r.text as string,
  }),
};

export const EXTRA_TABLES: { [K in ExtraKind]: ExtraTable<Records[K][number]> } = {
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
  reportSummaries: reportSummary,
};
