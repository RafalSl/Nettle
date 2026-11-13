/** UTC instant (canonical ISO-8601, always 24 chars) plus the IANA timezone it was recorded in (NF-4). */
export interface Stamp {
  utc: string;
  tz: string;
}

export interface Meal {
  id: string;
  at: Stamp;
  description: string;
  ingredients: string[];
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

/** What the user logged (EX-1 "records"). */
export interface Records {
  meals: Meal[];
  skinEntries: SkinEntry[];
  nailEntries: NailEntry[];
  checkIns: CheckIn[];
  stoolEntries: StoolEntry[];
}

/**
 * Record collections that are flat, dated rows with an `id` and an `at` stamp. Storage, import and export
 * handle them generically; meals and skin entries predate this and have their own methods.
 */
export type ExtraKind = Exclude<keyof Records, 'meals' | 'skinEntries'>;
export const EXTRA_KINDS: readonly ExtraKind[] = ['nailEntries', 'checkIns', 'stoolEntries'];

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
}

/** Settings collections that are plain lists of ListItem. */
export type ListKind = Exclude<keyof Settings, 'skinAreas'>;
export const LIST_KINDS: readonly ListKind[] = ['dailyTags'];

export interface Snapshot extends Records, Settings {}

/** Either part may be absent: an export or import can carry records, settings or both. */
export interface Payload {
  records?: Records;
  settings?: Settings;
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
