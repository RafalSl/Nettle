import type { IngredientSource } from './source';
import type { Allergen, MedicationCategory } from './types';

/** IN-14: a favorite keeps a snapshot, so it survives when its entries are deleted. `key` is the suggestion identity. */
export interface FavoriteMeal {
  key: string;
  description: string;
  ingredients: string[];
  allergens: Allergen[];
  barcode: string | null;
  source: IngredientSource;
}
export interface FavoriteDrink {
  key: string;
  name: string;
  amountMl: number;
  alcohol: boolean;
  ingredients: string[];
  allergens: Allergen[];
  barcode: string | null;
  source: IngredientSource;
}
export interface FavoriteMedication {
  key: string;
  category: MedicationCategory;
  name: string;
  dose: string | null;
}

/** SK-7: the four daily scores of the check-in; each can be switched off in Settings. */
export const CHECKIN_SCORES = ['wellbeing', 'stress', 'sleep', 'abdominalPain'] as const;
export type CheckInScore = (typeof CHECKIN_SCORES)[number];
export type CheckInScoreSettings = Record<CheckInScore, boolean>;

export const WINDOW_DAYS = [7, 14, 30, 60] as const;
export type WindowDays = (typeof WINDOW_DAYS)[number];

/** IN-14 settings: rows shown, look-back window, and "save on tap" (drinks and medication only, never meals). */
export interface SuggestionSettings {
  rows: number;
  windowDays: WindowDays;
  saveOnTap: boolean;
  /** IN-3: the meal photo prompt prefers ingredient names already used in the diary (off by default). */
  knownNames: boolean;
}

/** UX-2: the quick actions Today can show; the layout is order plus the hidden ones. */
export const QUICK_ACTIONS = ['meal', 'skin', 'treatment', 'checkin', 'stool', 'more'] as const;
export type QuickAction = (typeof QUICK_ACTIONS)[number];
export interface QuickActionLayout {
  order: QuickAction[];
  hidden: QuickAction[];
}

/** EX-1: preferences travel in the settings part of an export. The API key never does. */
export interface Preferences {
  favorites: { meals: FavoriteMeal[]; drinks: FavoriteDrink[]; medications: FavoriteMedication[] };
  suggestions: SuggestionSettings;
  quickActions: QuickActionLayout;
  /** NF-7: the hour a diary day starts at, 0 to 6 (default midnight). */
  dayStartHour: number;
  /** SK-7: a score that is off is not asked and not recorded. All on by default. */
  checkInScores: CheckInScoreSettings;
}

export const MAX_SUGGESTION_ROWS = 20;

export const DEFAULT_PREFERENCES: Preferences = {
  favorites: { meals: [], drinks: [], medications: [] },
  suggestions: { rows: 5, windowDays: 30, saveOnTap: false, knownNames: false },
  quickActions: { order: [...QUICK_ACTIONS], hidden: [] },
  dayStartHour: 0,
  checkInScores: { wellbeing: true, stress: true, sleep: true, abdominalPain: true },
};

/** A fresh copy of the defaults, so callers can change it freely. */
export const defaultPreferences = (): Preferences => structuredClone(DEFAULT_PREFERENCES);
