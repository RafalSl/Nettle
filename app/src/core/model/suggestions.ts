import type { Drink, MedicationEntry, Meal } from './types';
import { DAY_MS } from './time';

/** IN-14: one earlier use of something the user logs often. `key` is its identity, `payload` what a pick fills in. */
export interface HistoryItem<T> {
  key: string;
  label: string;
  /** UTC time of this use. */
  at: string;
  payload: T;
}

/** IN-14: a favorite keeps a snapshot, so it stays when its entries are deleted. */
export interface Favorite<T> {
  key: string;
  label: string;
  payload: T;
}

export interface Suggestion<T> {
  key: string;
  label: string;
  /** Payload of the latest use, or the favorite's snapshot when there is no history. */
  payload: T;
  favorite: boolean;
  /** Uses inside the window. */
  count: number;
  /** UTC time of the latest use, or null for a favorite never used. The UI turns it into "yesterday" and so on. */
  lastAt: string | null;
}

export interface SuggestionOptions {
  /** Rows to show when nothing is typed (default 5). */
  rows?: number;
  /** Look-back for "most frequent", in days (7, 14, 30 or 60; default 30). */
  windowDays?: number;
  /** Typed text: filters the whole history, not only the window. */
  query?: string;
  /** Rows when filtering (default 20). */
  queryRows?: number;
}

/** IN-14: a meal is its description, trimmed, lowercase, single spaces. */
export const normalizeText = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * IN-14, ranking in one pure function so the formula can change later (for example to frecency).
 * Without a query: favorites first (in the given order), then the items used most often in the window (ties:
 * the more recent first), then the most recent others, without duplicates, up to `rows`. Favorites always
 * show, even beyond `rows`. With a query: every item whose label contains it, ranked the same way.
 */
export function rankSuggestions<T>(
  history: readonly HistoryItem<T>[],
  favorites: readonly Favorite<T>[],
  now: Date,
  options: SuggestionOptions = {},
): Suggestion<T>[] {
  const rows = options.rows ?? 5;
  const since = new Date(now.getTime() - (options.windowDays ?? 30) * DAY_MS).toISOString();
  const query = normalizeText(options.query ?? '');

  // Group the history by identity: the latest use gives the payload, the window gives the count.
  const byKey = new Map<string, Suggestion<T>>();
  for (const h of history) {
    const cur = byKey.get(h.key);
    const inWindow = h.at >= since && h.at <= now.toISOString() ? 1 : 0;
    if (!cur) {
      byKey.set(h.key, { key: h.key, label: h.label, payload: h.payload, favorite: false, count: inWindow, lastAt: h.at });
    } else {
      cur.count += inWindow;
      if (cur.lastAt === null || h.at > cur.lastAt) Object.assign(cur, { label: h.label, payload: h.payload, lastAt: h.at });
    }
  }
  const favKeys = new Set(favorites.map((f) => f.key));
  for (const f of favorites) {
    const cur = byKey.get(f.key);
    if (cur) cur.favorite = true;
    else byKey.set(f.key, { key: f.key, label: f.label, payload: f.payload, favorite: true, count: 0, lastAt: null });
  }

  const matches = (s: Suggestion<T>) => !query || normalizeText(s.label).includes(query);
  const recent = (a: Suggestion<T>, b: Suggestion<T>) => (b.lastAt ?? '').localeCompare(a.lastAt ?? '') || a.key.localeCompare(b.key);
  const frequent = (a: Suggestion<T>, b: Suggestion<T>) => b.count - a.count || recent(a, b);

  const all = [...byKey.values()].filter(matches);
  const favs = favorites.map((f) => byKey.get(f.key)!).filter(matches);
  const rest = all.filter((s) => !favKeys.has(s.key));
  const ordered = [...favs, ...rest.filter((s) => s.count > 0).sort(frequent), ...rest.filter((s) => s.count === 0).sort(recent)];
  const limit = query ? (options.queryRows ?? 20) : rows;
  return ordered.slice(0, Math.max(limit, favs.length));
}

/** IN-14: meals are identified by their normalized description; a pick fills the latest use's meal. */
export const mealHistory = (meals: readonly Meal[]): HistoryItem<Meal>[] =>
  meals.map((m) => ({ key: normalizeText(m.description), label: m.description, at: m.at.utc, payload: m }));

/** IN-14: a drink is identified by its name and amount (the alcohol switch is part of what a pick fills in). */
export const drinkKey = (e: Pick<Drink, 'name' | 'amountMl'>): string => `${normalizeText(e.name)}|${e.amountMl}`;

/** IN-14: a drink suggestion is a drink with its amount. */
export const drinkHistory = (entries: readonly Drink[]): HistoryItem<Drink>[] =>
  entries.map((e) => ({
    key: drinkKey(e),
    label: `${e.name} ${e.amountMl} ml`,
    at: e.at.utc,
    payload: e,
  }));

/** IN-14: a medication suggestion is a name with its dose. */
export const medicationHistory = (entries: readonly MedicationEntry[]): HistoryItem<MedicationEntry>[] =>
  entries.map((e) => ({
    key: `${e.category}|${normalizeText(e.name)}|${normalizeText(e.dose ?? '')}`,
    label: e.dose ? `${e.name} ${e.dose}` : e.name,
    at: e.at.utc,
    payload: e,
  }));
