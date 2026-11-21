import { DEFAULT_FLARE_THRESHOLD, type FlareRule } from './flares';
import type { LanguagePreference } from './language';
import type { IngredientSource } from './source';
import type { Allergen, MedicationCategory } from './types';

export const FLARE_SCOPES = ['all', 'perArea'] as const;
export type FlareScope = (typeof FLARE_SCOPES)[number];

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
  /** IN-3: the meal photo prompt prefers ingredient names already used in the diary (off by default). */
  knownNames: boolean;
}

/** UX-2: the ten entry types; the user pins any of them to Today, the rest are listed in More. */
export const ENTRY_TYPES = ['meal', 'drink', 'medication', 'skin', 'nails', 'treatment', 'checkin', 'stool', 'reaction', 'change', 'medical'] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];
/** UX-2: the default pins. */
export const DEFAULT_PINNED: readonly EntryType[] = ['meal', 'skin', 'treatment', 'checkin', 'stool'];
/** UX-2: at most this many entry types are pinned to Today; the More tile comes on top of them. */
export const MAX_PINNED = 5;
/** UX-2: the ordered pins. Nothing is hidden: whatever is not pinned is in More. The More tile itself is always shown. */
export interface QuickActionLayout {
  pinned: EntryType[];
}

/** IN-17: a reminder time of a regular item. */
export interface ReminderTime {
  hour: number;
  minute: number;
}

/**
 * IN-17: a medication, supplement or treatment the user takes or applies regularly. A medication carries its name,
 * category and dose; a treatment points at a saved treatment (IN-11) and the areas it is applied to. `times` are the
 * daily reminder times (none = no reminders); `hideName` keeps the name out of the notification text. Stopping a
 * regular item removes it from this list and leaves the logged entries alone.
 */
export interface RegularItem {
  id: string;
  kind: 'medication' | 'treatment';
  category: MedicationCategory | null;
  name: string | null;
  dose: string | null;
  treatmentId: string | null;
  areaIds: string[];
  times: ReminderTime[];
  hideName: boolean;
}

/** EX-1: preferences travel in the settings part of an export. The API key never does. */
export interface Preferences {
  favorites: { meals: FavoriteMeal[]; drinks: FavoriteDrink[]; medications: FavoriteMedication[] };
  suggestions: SuggestionSettings;
  quickActions: QuickActionLayout;
  /** NF-7: the hour a diary day starts at, 0 to 6 (default midnight). */
  dayStartHour: number;
  /** SK-6: severity at or above which a skin entry counts as a flare (1 to 10, default 8). */
  flareThreshold: number;
  /** SK-8: "all" uses `flareThreshold` for every area; "perArea" uses `flareThresholdByArea` where an area has an entry and `flareThreshold` elsewhere. */
  flareScope: FlareScope;
  /** SK-8: thresholds of single areas (1 to 10), used only while the scope is "perArea". */
  flareThresholdByArea: Record<string, number>;
  /** IN-17: regular medication and treatment (travels in the settings part of an export). */
  regular: RegularItem[];
  /** UX-7: the app language; "system" follows the device. */
  language: LanguagePreference;
}

export const MAX_SUGGESTION_ROWS = 20;

export const DEFAULT_PREFERENCES: Preferences = {
  favorites: { meals: [], drinks: [], medications: [] },
  suggestions: { rows: 5, windowDays: 30, saveOnTap: false, knownNames: false },
  quickActions: { pinned: [...DEFAULT_PINNED] },
  dayStartHour: 0,
  flareThreshold: DEFAULT_FLARE_THRESHOLD,
  flareScope: 'all',
  flareThresholdByArea: {},
  regular: [],
  language: 'system',
};

/** A fresh copy of the defaults, so callers can change it freely. */
export const defaultPreferences = (): Preferences => structuredClone(DEFAULT_PREFERENCES);

/** SK-8: the flare rule these preferences give. */
export const flareRule = (p: Pick<Preferences, 'flareThreshold' | 'flareScope' | 'flareThresholdByArea'>): FlareRule =>
  p.flareScope === 'perArea' ? { fallback: p.flareThreshold, perArea: { ...p.flareThresholdByArea } } : p.flareThreshold;
