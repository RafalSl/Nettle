import { localDateTime, localDay, addDays } from '../model/time';
import type { Allergen, ListItem, Records, SkinArea } from '../model/types';

/** LL-3: how far before the analysed period illness, antibiotics, stress, sleep and change events are looked up. */
export const LOOKBACK_DAYS = 21;

export interface AnalysisSource extends Records {
  skinAreas: SkinArea[];
  dailyTags: ListItem[];
  treatments: ListItem[];
}

type Row = Record<string, unknown>;
interface Day {
  date: string;
  /** True for days before the period that are included only for the lookback. */
  context?: true;
  /** Closed with "day complete" (SK-11); null when there is no check-in. */
  complete: boolean | null;
  [key: string]: unknown;
}

export interface BuiltInput {
  /** Compact JSON the model receives. */
  json: string;
  /** Records sent, by kind, plus `days`, `completeDays` and `lookbackDays`. */
  counts: Record<string, number>;
  /** Days of the period (not the lookback). */
  days: number;
  completeDays: number;
  /** Records inside the period itself, not counting the lookback. Zero means there is nothing to analyse. */
  periodRecords: number;
}

const label = (x: { name: string; nameOverride: string | null }) => x.nameOverride ?? x.name;
const time = (utc: string, tz: string) => localDateTime(utc, tz).slice(11);
const dayOf = (at: { utc: string; tz: string }) => localDay(at.utc, at.tz);

/**
 * LL-2 to LL-4: the diary as one timeline by local day, with exact local times, so the model can read same-day,
 * 24 / 48 / 72 hour and 7 / 21 day relations itself. Also precomputes how often each ingredient and allergen
 * was eaten, so "eaten on most days" cannot be missed (LL-4). Records of the lookback window before the
 * period are limited to the kinds the lookbacks need.
 */
export function buildAnalysisInput(src: AnalysisSource, dayFrom: string, dayTo: string): BuiltInput {
  const areaName = new Map(src.skinAreas.map((a) => [a.id, label(a)]));
  const tagName = new Map(src.dailyTags.map((t) => [t.id, label(t)]));
  const treatmentName = new Map(src.treatments.map((t) => [t.id, label(t)]));
  const mealById = new Map(src.meals.map((m) => [m.id, m]));

  const lookbackFrom = addDays(dayFrom, -LOOKBACK_DAYS)!;
  const inPeriod = (d: string) => d >= dayFrom && d <= dayTo;
  const inScope = (d: string) => d >= lookbackFrom && d <= dayTo;

  const days = new Map<string, Day>();
  const dayRow = (date: string): Day => {
    let d = days.get(date);
    if (!d) {
      d = { date, complete: null, ...(inPeriod(date) ? {} : { context: true as const }) };
      days.set(date, d);
    }
    return d;
  };
  const counts: Record<string, number> = {};
  let periodRecords = 0;
  const add = (kind: string, date: string, key: string, row: Row, lookbackOnly = false) => {
    if (!inScope(date) || (!inPeriod(date) && !lookbackOnly)) return;
    const d = dayRow(date);
    ((d[key] as Row[] | undefined) ?? (d[key] = [])).push(row);
    counts[kind] = (counts[kind] ?? 0) + 1;
    if (inPeriod(date)) periodRecords++;
  };

  // Lookback kinds: allowed before the period.
  for (const c of src.checkIns) {
    if (!inScope(c.day)) continue;
    const d = dayRow(c.day);
    d.complete = !!c.completedAt;
    d.checkin = {
      wellbeing: c.wellbeing,
      stress: c.stress,
      sleep_quality: c.sleep,
      abdominal_pain: c.abdominalPain,
      bloating: c.bloating,
      tags: c.tags.map((id) => tagName.get(id) ?? id),
      ...(c.note ? { note: c.note } : {}),
    };
    counts.checkIns = (counts.checkIns ?? 0) + 1;
    if (inPeriod(c.day)) periodRecords++;
  }
  for (const e of src.changeEvents) {
    add('changeEvents', dayOf(e.at), 'events', { time: time(e.at.utc, e.at.tz), action: e.action, kind: e.category, name: e.name, ...(e.note ? { note: e.note } : {}) }, true);
  }
  for (const m of src.medicationEntries) {
    add('medicationEntries', dayOf(m.at), 'medication', { time: time(m.at.utc, m.at.tz), kind: m.category, name: m.name, ...(m.dose ? { dose: m.dose } : {}) }, true);
  }

  // Period-only kinds.
  for (const m of src.meals) {
    add('meals', dayOf(m.at), 'meals', { time: time(m.at.utc, m.at.tz), description: m.description, ingredients: m.ingredients, allergens: m.allergens, ...(m.note ? { note: m.note } : {}) });
  }
  for (const a of src.drinks) {
    add('drinks', dayOf(a.at), 'drinks', { time: time(a.at.utc, a.at.tz), name: a.name, ml: a.amountMl, alcohol: a.alcohol, ...(a.ingredients.length ? { ingredients: a.ingredients } : {}), ...(a.allergens.length ? { allergens: a.allergens } : {}), ...(a.note ? { note: a.note } : {}) });
  }
  for (const t of src.treatmentApplications) {
    add('treatmentApplications', dayOf(t.at), 'treatments', { time: time(t.at.utc, t.at.tz), name: treatmentName.get(t.treatmentId) ?? t.treatmentId, areas: t.areaIds.map((id) => areaName.get(id) ?? id) });
  }
  for (const s of src.stoolEntries) {
    add('stoolEntries', dayOf(s.at), 'stool', { time: time(s.at.utc, s.at.tz), bristol: s.bristol });
  }
  for (const e of src.skinEntries) {
    add('skinEntries', dayOf(e.at), 'skin', { time: time(e.at.utc, e.at.tz), area: areaName.get(e.areaId) ?? e.areaId, ...e.scores, ...(e.note ? { note: e.note } : {}) });
  }
  for (const e of src.nailEntries) {
    add('nailEntries', dayOf(e.at), 'nails', { time: time(e.at.utc, e.at.tz), nail: areaName.get(e.areaId) ?? e.areaId, stage: e.stage, extent: e.extent });
  }
  for (const f of src.flareMarkers) {
    add('flareMarkers', dayOf(f.at), 'flares', { time: time(f.at.utc, f.at.tz), area: areaName.get(f.areaId) ?? f.areaId, marker: f.kind });
  }
  for (const r of src.reactions) {
    const meal = mealById.get(r.mealId);
    add('reactions', dayOf(r.at), 'reactions', { onset: time(r.at.utc, r.at.tz), meal: meal ? `${localDateTime(meal.at.utc, meal.at.tz)} ${meal.description}` : null, symptoms: r.symptoms });
  }

  // Every calendar day of the period appears, so days with nothing logged are visible as such.
  const periodDays: string[] = [];
  for (let d: string | null = dayFrom; d && d <= dayTo; d = addDays(d, 1)) {
    periodDays.push(d);
    dayRow(d);
  }
  const completeDays = periodDays.filter((d) => days.get(d)!.complete === true).length;

  // How often each ingredient and allergen was eaten, over the days that have meals.
  const mealDays = new Set<string>();
  const ingredientDays = new Map<string, Set<string>>();
  const allergenDays = new Map<Allergen, Set<string>>();
  for (const m of src.meals) {
    const d = dayOf(m.at);
    if (!inPeriod(d)) continue;
    mealDays.add(d);
    for (const name of m.ingredients) {
      const key = name.trim().toLowerCase();
      if (key) (ingredientDays.get(key) ?? ingredientDays.set(key, new Set()).get(key)!).add(d);
    }
    for (const a of m.allergens) (allergenDays.get(a) ?? allergenDays.set(a, new Set()).get(a)!).add(d);
  }
  const frequency = <K extends string>(map: Map<K, Set<string>>, keyName: string, limit: number) =>
    [...map.entries()]
      .map(([k, set]) => ({ [keyName]: k, days_eaten: set.size, share_of_days_with_meals: Math.round((set.size / Math.max(1, mealDays.size)) * 100) / 100 }))
      .sort((a, b) => (b.days_eaten as number) - (a.days_eaten as number))
      .slice(0, limit);

  const ordered = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  counts.days = periodDays.length;
  counts.completeDays = completeDays;
  counts.lookbackDays = ordered.filter((d) => d.context).length;
  const json = JSON.stringify({
    period: { from: dayFrom, to: dayTo, days: periodDays.length, days_marked_complete: completeDays, days_with_meals: mealDays.size, lookback_days_before: LOOKBACK_DAYS },
    ingredient_frequency: frequency(ingredientDays, 'ingredient', 60),
    allergen_frequency: frequency(allergenDays, 'allergen', 14),
    days: ordered,
  });
  return { json, counts, days: periodDays.length, completeDays, periodRecords };
}
