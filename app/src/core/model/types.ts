import type { Preferences } from './preferences';
import type { IngredientSource } from './source';
/** UTC instant (canonical ISO-8601, always 24 chars) plus the IANA timezone it was recorded in (NF-4). */
export interface Stamp {
  utc: string;
  tz: string;
}

/** IN-10: the 14 EU allergens. */
export const ALLERGENS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soybeans',
  'milk',
  'tree_nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export interface Meal {
  id: string;
  at: Stamp;
  description: string;
  ingredients: string[];
  /** IN-10: confirmed by the user, never saved straight from a suggestion. */
  allergens: Allergen[];
  /** IN-2: the barcode the entry was made from, if any. */
  barcode: string | null;
  /** IN-16 */
  source: IngredientSource;
  note: string | null;
}

/** SK-10: every area is either a skin area (five scores) or a nail area (stage and extent). */
export type AreaKind = 'skin' | 'nail';

export interface SkinArea {
  id: string;
  kind: AreaKind;
  name: string;
  predefined: boolean;
  archived: boolean;
  sensitiveDefault: boolean;
  /** SK-2: user's own name for a predefined area; null shows the localized default. User areas use `name`. */
  nameOverride: string | null;
}

/** SK-3: separate 0-10 scores. */
export interface SkinScores {
  severity: number;
  itch: number;
  pain: number;
  dryness: number;
  scaling: number;
}

/** One entry = one area at one time (SK-3: "per area and entry"). */
export interface SkinEntry {
  id: string;
  at: Stamp;
  areaId: string;
  scores: SkinScores;
  note: string | null;
}

/** SK-10 */
export const NAIL_STAGES = ['red_edge', 'separation', 'yellow', 'white', 'clear'] as const;
export type NailStage = (typeof NAIL_STAGES)[number];
export const NAIL_EXTENTS = ['none', 'under_quarter', 'up_to_half', 'over_half'] as const;
export type NailExtent = (typeof NAIL_EXTENTS)[number];

/** SK-10: one entry = one nail area at one time; photos attach later (SK-4). */
export interface NailEntry {
  id: string;
  at: Stamp;
  areaId: string;
  stage: NailStage;
  extent: NailExtent;
  note: string | null;
}

/** A local calendar day, "YYYY-MM-DD" (SK-7, SK-11). */
export type LocalDay = string;

/** A 0-10 score, or null when the user left it out. */
export type OptionalScore = number | null;

/**
 * SK-7: one daily check-in per local day. `at` is when it is about (editable like every entry) and `day`
 * its local day in `at.tz`. SK-11: `completedAt` marks the day as fully logged; null while open.
 */
export interface CheckIn {
  id: string;
  at: Stamp;
  day: LocalDay;
  wellbeing: OptionalScore;
  stress: OptionalScore;
  sleep: OptionalScore;
  abdominalPain: OptionalScore;
  bloating: boolean;
  /** Ids of daily tags (IN-6) that were "yes" this day. */
  tags: string[];
  note: string | null;
  completedAt: Stamp | null;
}

/** SK-7: Bristol type 1-7, several per day. */
export interface StoolEntry {
  id: string;
  at: Stamp;
  bristol: number;
  note: string | null;
}

/** IN-11: one tap applies a saved treatment to one or more areas. */
export interface TreatmentApplication {
  id: string;
  at: Stamp;
  treatmentId: string;
  areaIds: string[];
  note: string | null;
}

/** IN-12 */
export const CHANGE_ACTIONS = ['started', 'stopped'] as const;
export type ChangeAction = (typeof CHANGE_ACTIONS)[number];
export const CHANGE_CATEGORIES = ['product', 'medication', 'diet'] as const;
export type ChangeCategory = (typeof CHANGE_CATEGORIES)[number];

/** IN-12: "started" or "stopped" a product, medication or diet on a date; shown as a marker on the timeline. */
export interface ChangeEvent {
  id: string;
  at: Stamp;
  action: ChangeAction;
  category: ChangeCategory;
  name: string;
  note: string | null;
}

/** IN-13 */
export const SYMPTOMS = ['hives', 'mouth_tingling', 'swelling', 'stomach'] as const;
export type Symptom = (typeof SYMPTOMS)[number];

/** IN-13: symptoms within about two hours of a meal, linked to it; `at` is the time of onset. */
export interface Reaction {
  id: string;
  at: Stamp;
  mealId: string;
  symptoms: Symptom[];
  note: string | null;
}

/**
 * IN-4: any beverage with its amount in millilitres. `alcohol` marks alcoholic drinks so the report and the
 * analysis can treat them separately; ingredients and allergen tags (IN-10) are optional, as on a meal.
 */
export interface Drink {
  id: string;
  at: Stamp;
  name: string;
  amountMl: number;
  alcohol: boolean;
  ingredients: string[];
  /** IN-10: confirmed by the user, never saved straight from a suggestion. */
  allergens: Allergen[];
  /** IN-2 */
  barcode: string | null;
  /** IN-16 */
  source: IngredientSource;
  note: string | null;
}

/** IN-5 */
export const MEDICATION_CATEGORIES = ['medication', 'supplement'] as const;
export type MedicationCategory = (typeof MEDICATION_CATEGORIES)[number];

/** IN-5: a medication or supplement taken, with a free-text dose. Topical treatments are IN-11. */
export interface MedicationEntry {
  id: string;
  at: Stamp;
  category: MedicationCategory;
  name: string;
  dose: string | null;
  note: string | null;
}

/** SK-4: photos attach to a skin entry or a nail entry. */
export type PhotoEntryKind = 'skinEntry' | 'nailEntry';

/**
 * SK-4, SK-5: a dated photo of one entry. `file` is the key in the photo store (a file in the app's private
 * storage); in an export it is the path inside the ZIP instead. `sensitive` is set per photo and starts
 * from the area's default.
 */
export interface Photo {
  id: string;
  at: Stamp;
  entryKind: PhotoEntryKind;
  entryId: string;
  sensitive: boolean;
  file: string;
}

/** LL-4: hypotheses are never stronger than "moderate". */
export const HYPOTHESIS_STRENGTHS = ['weak', 'moderate'] as const;
export type HypothesisStrength = (typeof HYPOTHESIS_STRENGTHS)[number];

/** LL-4: one tentative hypothesis with the data behind it and its uncertainty. */
export interface Hypothesis {
  title: string;
  explanation: string;
  evidence: string[];
  counterEvidence: string[];
  uncertainty: string;
  /** Typical delay between the possible trigger and the reaction, in hours, when the data suggests one. */
  lagHours: number | null;
  strength: HypothesisStrength;
}

/** LL-2, LL-4: what the model said. Always presented as AI-generated and tentative. */
export interface AnalysisResult {
  summary: string;
  hypotheses: Hypothesis[];
  /** LL-2: order and lag between flare start, digestive changes and nail changes. */
  orderAndLag: string;
  /** LL-4: what the data cannot answer. */
  dataLimits: string[];
  suggestions: string[];
}

/**
 * LL-7: one analysis run, stored as its own object. Raw entries are never modified. `at` is the run date;
 * `dayFrom` and `dayTo` are the local days analysed.
 */
export interface Analysis {
  id: string;
  at: Stamp;
  dayFrom: LocalDay;
  dayTo: LocalDay;
  /** The model that answered, as reported by the provider. */
  model: string;
  promptVersion: string;
  language: 'en' | 'pl';
  /** What was sent: record counts by kind, plus `days`, `completeDays` and `photos`. */
  counts: Record<string, number>;
  result: AnalysisResult;
}

/**
 * LL-14: the optional AI narrative at the start of the doctor report, stored as its own object like an analysis
 * (LL-7). `generated` is what the model wrote, `text` what the person reviewed and kept (equal when unedited).
 */
export interface ReportSummary {
  id: string;
  at: Stamp;
  dayFrom: LocalDay;
  dayTo: LocalDay;
  /** The language the report is written in (EX-3). */
  language: 'en' | 'pl';
  model: string;
  promptVersion: string;
  /** What was sent: record counts by kind, plus `days` and `completeDays`. Never photos. */
  counts: Record<string, number>;
  generated: string;
  text: string;
}

/** SK-6 */
export const FLARE_KINDS = ['start', 'end'] as const;
export type FlareKind = (typeof FLARE_KINDS)[number];

/** SK-6: a flare marker for one area, separate from the scores. A start without a later end is an open flare. */
export interface FlareMarker {
  id: string;
  at: Stamp;
  areaId: string;
  kind: FlareKind;
  note: string | null;
}

/** What the user logged (EX-1 "records"). */
export interface Records {
  meals: Meal[];
  skinEntries: SkinEntry[];
  nailEntries: NailEntry[];
  checkIns: CheckIn[];
  stoolEntries: StoolEntry[];
  treatmentApplications: TreatmentApplication[];
  changeEvents: ChangeEvent[];
  reactions: Reaction[];
  drinks: Drink[];
  medicationEntries: MedicationEntry[];
  photos: Photo[];
  analyses: Analysis[];
  reportSummaries: ReportSummary[];
  flareMarkers: FlareMarker[];
}

/** Every record collection, in the order they are listed in `Records`. */
export type RecordKind = keyof Records;

/**
 * EX-13: what is left when one entry is deleted (EN-1): its id, its kind and when it was deleted, nothing else.
 * Kept apart from `Records` so bulk delete (SE-9), which leaves none, and the record codecs are unaffected.
 */
export interface Tombstone {
  id: string;
  kind: RecordKind;
  deletedAt: Stamp;
}

/**
 * Record collections that are flat, dated rows with an `id` and an `at` stamp. Storage, import and export
 * handle them generically; meals and skin entries predate this and have their own methods.
 */
export type ExtraKind = Exclude<keyof Records, 'meals' | 'skinEntries'>;
export const EXTRA_KINDS: readonly ExtraKind[] = [
  'nailEntries',
  'checkIns',
  'stoolEntries',
  'treatmentApplications',
  'changeEvents',
  'reactions',
  'drinks',
  'medicationEntries',
  'photos',
  'analyses',
  'reportSummaries',
  'flareMarkers',
];

/**
 * A user-editable list entry: daily tags (IN-6). Predefined items keep a stable id and a localized name,
 * and renaming one stores `nameOverride`, as for areas (SK-2).
 */
export interface ListItem {
  id: string;
  name: string;
  predefined: boolean;
  archived: boolean;
  nameOverride: string | null;
}

/** User configuration (EX-1 "settings"). */
export interface Settings {
  skinAreas: SkinArea[];
  dailyTags: ListItem[];
  /** IN-11: the saved list of topical treatments. */
  treatments: ListItem[];
}

/** Settings collections that are plain lists of ListItem. */
export type ListKind = Exclude<keyof Settings, 'skinAreas'>;
export const LIST_KINDS: readonly ListKind[] = ['dailyTags', 'treatments'];

export interface Snapshot extends Records, Settings {}

/** Either part may be absent: an export or import can carry records, settings or both. */
export interface Payload {
  records?: Records;
  settings?: Settings;
  /** EX-13: tombstones of the records part (present when `records` is). */
  tombstones?: Tombstone[];
  /** EX-1: favorites, suggestion settings and the quick-action layout (present when `settings` is). */
  preferences?: Preferences;
}

/** Which parts to export or to apply. */
export interface Parts {
  records: boolean;
  settings: boolean;
}

/** Inclusive bounds on Stamp.utc; either side may be open. */
export interface DateRange {
  from?: string;
  to?: string;
}

export const SCORE_KEYS = ['severity', 'itch', 'pain', 'dryness', 'scaling'] as const;

export const RECORD_KINDS: readonly RecordKind[] = ['meals', 'skinEntries', ...EXTRA_KINDS];
