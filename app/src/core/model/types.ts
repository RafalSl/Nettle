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

/** What the user logged (EX-1 "records"). */
export interface Records {
  meals: Meal[];
  skinEntries: SkinEntry[];
  nailEntries: NailEntry[];
}

/**
 * Record collections that are flat, dated rows with an `id` and an `at` stamp. Storage, import and export
 * handle them generically; meals and skin entries predate this and have their own methods.
 */
export type ExtraKind = Exclude<keyof Records, 'meals' | 'skinEntries'>;
export const EXTRA_KINDS: readonly ExtraKind[] = ['nailEntries'];

/** User configuration (EX-1 "settings"). */
export interface Settings {
  skinAreas: SkinArea[];
}

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
