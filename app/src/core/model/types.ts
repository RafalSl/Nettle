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

export interface SkinArea {
  id: string;
  name: string;
  predefined: boolean;
  archived: boolean;
  sensitiveDefault: boolean;
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

export interface Snapshot {
  meals: Meal[];
  skinAreas: SkinArea[];
  skinEntries: SkinEntry[];
}

/** Inclusive bounds on Stamp.utc; either side may be open. */
export interface DateRange {
  from?: string;
  to?: string;
}

export const SCORE_KEYS = ['severity', 'itch', 'pain', 'dryness', 'scaling'] as const;
