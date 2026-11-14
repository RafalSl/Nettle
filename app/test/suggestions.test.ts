import { drinkHistory, mealHistory, normalizeText, rankSuggestions, type HistoryItem } from '@/core/model/suggestions';
import { syntheticMeal } from './helpers/fixtures';

const now = new Date('2026-03-01T12:00:00.000Z');
const day = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
const h = (label: string, daysAgo: number): HistoryItem<string> => ({ key: normalizeText(label), label, at: day(daysAgo), payload: label });
const labels = (s: { label: string }[]) => s.map((x) => x.label);

describe('rankSuggestions (IN-14)', () => {
  it('IN-14 puts favorites first, then the most frequent in the window, then the most recent', () => {
    const history = [h('Oats', 1), h('Oats', 2), h('Oats', 3), h('Soup', 1), h('Soup', 5), h('Eggs', 0.5), h('Old stew', 50), h('Older rice', 90)];
    const favorites = [{ key: 'rice', label: 'Rice', payload: 'Rice' }];
    expect(labels(rankSuggestions(history, favorites, now, { rows: 5 }))).toEqual(['Rice', 'Oats', 'Soup', 'Eggs', 'Old stew']);
  });

  it('IN-14 returns each item once, with its count, latest use and the latest payload', () => {
    const history: HistoryItem<string>[] = [
      { key: 'oats', label: 'Oats', at: day(3), payload: 'old' },
      { key: 'oats', label: 'oats', at: day(1), payload: 'new' },
    ];
    const [only, ...none] = rankSuggestions(history, [], now);
    expect(none).toEqual([]);
    expect(only).toMatchObject({ count: 2, payload: 'new', label: 'oats', lastAt: day(1), favorite: false });
  });

  it('IN-14 counts only the window, which is a setting, and still lists older items as recent', () => {
    const history = [h('A', 10), h('A', 12), h('B', 1)];
    expect(labels(rankSuggestions(history, [], now, { windowDays: 7 }))).toEqual(['B', 'A']);
    expect(labels(rankSuggestions(history, [], now, { windowDays: 14 }))).toEqual(['A', 'B']);
  });

  it('IN-14 limits to the number of rows but never hides a favorite; a favorite without history shows', () => {
    const history = [h('A', 1), h('B', 2), h('C', 3), h('D', 4)];
    expect(rankSuggestions(history, [], now, { rows: 2 })).toHaveLength(2);
    const favs = ['X', 'Y', 'Z'].map((l) => ({ key: l.toLowerCase(), label: l, payload: l }));
    const out = rankSuggestions(history, favs, now, { rows: 2 });
    expect(labels(out)).toEqual(['X', 'Y', 'Z']);
    expect(out[0]).toMatchObject({ favorite: true, count: 0, lastAt: null });
  });

  it('IN-14 a favorite that is also in the history is not repeated and keeps its history payload', () => {
    const out = rankSuggestions([h('Oats', 1)], [{ key: 'oats', label: 'Oats', payload: 'snapshot' }], now);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ favorite: true, count: 1, payload: 'Oats' });
  });

  it('IN-14 typing filters the whole history, not only the window or the top rows', () => {
    const history = [h('Oat porridge', 100), h('Oats with milk', 80), ...['A', 'B', 'C', 'D', 'E', 'F'].map((l) => h(l, 1))];
    expect(labels(rankSuggestions(history, [], now, { query: '  OAT ' }))).toEqual(['Oats with milk', 'Oat porridge']);
    expect(rankSuggestions(history, [], now, { query: 'zzz' })).toEqual([]);
  });

  it('IN-14 ignores uses in the future when counting the window', () => {
    const out = rankSuggestions([h('Future', -3), h('Past', 2)], [], now);
    expect(out.find((s) => s.label === 'Future')?.count).toBe(0);
  });

  it('IN-14 identifies a meal by its normalized description and a drink by name and amount', () => {
    const a = syntheticMeal('m1', day(2));
    const b = { ...syntheticMeal('m2', day(1)), description: `  ${a.description.toUpperCase()}   ` };
    const meals = rankSuggestions(mealHistory([a, b]), [], now);
    expect(meals).toHaveLength(1);
    expect(meals[0]).toMatchObject({ count: 2 });
    expect(meals[0]!.payload.id).toBe('m2'); // the latest use fills the form
    const beer = (id: string, ml: number) => ({ id, at: { utc: day(1), tz: 'Europe/Warsaw' }, name: 'Synthetic beer', amountMl: ml, alcohol: true, ingredients: [], allergens: [], barcode: null, source: { kind: 'typed' as const, edited: false, llm: null }, note: null });
    expect(rankSuggestions(drinkHistory([beer('a', 500), beer('b', 330), beer('c', 500)]), [], now).map((s) => s.count)).toEqual([2, 1]);
  });
});
