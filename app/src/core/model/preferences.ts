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

export const WINDOW_DAYS = [7, 14, 30, 60] as const;
export type WindowDays = (typeof WINDOW_DAYS)[number];

/** IN-14 settings: rows shown, look-back window, and "save on tap" (drinks and medication only, never meals). */
export interface SuggestionSettings {
  rows: number;
  windowDays: WindowDays;
  saveOnTap: boolean;
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
}

export const MAX_SUGGESTION_ROWS = 20;

export const DEFAULT_PREFERENCES: Preferences = {
  favorites: { meals: [], drinks: [], medications: [] },
  suggestions: { rows: 5, windowDays: 30, saveOnTap: false },
  quickActions: { order: [...QUICK_ACTIONS], hidden: [] },
};

/** A fresh copy of the defaults, so callers can change it freely. */
export const defaultPreferences = (): Preferences => structuredClone(DEFAULT_PREFERENCES);
