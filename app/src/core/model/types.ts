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

/** SK-7: a Daily health item is a 0-10 score or a yes/no. */
export type ItemValueKind = 'score' | 'yesno';

/**
 * SK-7, SK-11: the Daily health record, one per local day (the table and type keep the older name CheckIn).
 * `at` is when it is about (editable like every entry) and `day` its local day in `at.tz`. `values` is keyed by
 * Daily health item id: a score 0-10, or `true` for a yes. An item with no key was not recorded (a score) or is
 * a no (a yes/no). Saving the record logs the day (SK-11); there is no separate mark.
 */
export interface CheckIn {
  id: string;
  at: Stamp;
  day: LocalDay;
  values: Record<string, number | boolean>;
  note: string | null;
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

/**
 * IN-12: a routine change: a product or diet started or stopped on a date, shown as a marker on the timeline.
 * `category` is the id of an item of the `changeCategories` list (predefined `cat-product` and `cat-diet`, plus the
 * user's own). `dateUnknown` marks "started" for something already in use before the diary: `at` is then only when
 * it was logged.
 */
export interface ChangeEvent {
  id: string;
  at: Stamp;
  action: ChangeAction;
  category: string;
  name: string;
  dateUnknown: boolean;
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
];

/**
 * A user-editable list entry: Daily health items (SK-7, IN-6) and treatments (IN-11). Predefined items keep a stable id and a localized name,
 * and renaming one stores `nameOverride`, as for areas (SK-2).
 */
export interface ListItem {
  id: string;
  name: string;
  predefined: boolean;
  archived: boolean;
  nameOverride: string | null;
  /** SK-7: Daily health items are scores or yes/no; other lists keep 'yesno' and ignore it. */
  valueKind: ItemValueKind;
  /** SK-7, UX-11: a short description of a user item; predefined items are described in the i18n files by id. */
  description: string | null;
}

/** User configuration (EX-1 "settings"). */
export interface Settings {
  skinAreas: SkinArea[];
  /** SK-7, IN-6: the Daily health items (scores and yes/no, daily tags included). */
  dailyItems: ListItem[];
  /** IN-12: the categories of routine changes (Product and Diet, plus the user's own). */
  changeCategories: ListItem[];
  /** IN-11: the saved list of topical treatments. */
  treatments: ListItem[];
}

/** Settings collections that are plain lists of ListItem. */
export type ListKind = Exclude<keyof Settings, 'skinAreas'>;
export const LIST_KINDS: readonly ListKind[] = ['dailyItems', 'changeCategories', 'treatments'];

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
