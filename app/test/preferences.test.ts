import { SqliteRepo } from '@/adapters/storage/sqliteRepo';
import { defaultPreferences } from '@/core/model/preferences';
import { NettleError } from '@/core/model/errors';
import { parsePreferences, preferencesToJson } from '@/core/export/preferencesJson';
import type { StorageRepository } from '@/core/ports/storage';
import { applyImport, exportBundle, previewImport } from '@/core/usecases/exchange';
import { logMeal } from '@/core/usecases/logMeal';
import {
  getPreferences,
  moveQuickAction,
  refreshFavoriteMeal,
  setQuickActionHidden,
  toggleFavoriteDrink,
  toggleFavoriteMeal,
  updateSuggestionSettings,
  visibleQuickActions,
} from '@/core/usecases/preferences';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';
import { createNodeSqliteDb } from './helpers/nodeSqliteDb';

const repos: [string, () => Promise<StorageRepository>][] = [
  ['in-memory', async () => new MemoryRepo()],
  ['sqlite', async () => SqliteRepo.open(createNodeSqliteDb())],
];
const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );
const both = { records: true, settings: true };

describe.each(repos)('preferences (%s)', (_name, make) => {
  it('IN-14 starts with the defaults: 5 rows, a 30 day window, save on tap off, all quick actions in order', async () => {
    const deps = makeDeps(await make());
    expect(await getPreferences(deps)).toEqual(defaultPreferences());
    expect(await deps.repo.getPreferences()).toBeNull(); // nothing stored until the user changes something
  });

  it('IN-14 suggestion settings are validated and stored', async () => {
    const deps = makeDeps(await make());
    expect(await updateSuggestionSettings(deps, { rows: 8, windowDays: 14, saveOnTap: true })).toEqual({ rows: 8, windowDays: 14, saveOnTap: true, knownNames: false });
    expect((await getPreferences(deps)).suggestions.rows).toBe(8);
    expect(await code(updateSuggestionSettings(deps, { rows: 0 }))).toBe('invalid_value');
    expect(await code(updateSuggestionSettings(deps, { rows: 21 }))).toBe('invalid_value');
    expect(await code(updateSuggestionSettings(deps, { windowDays: 10 as never }))).toBe('invalid_value');
  });

  it('IN-14 a favorite is a snapshot that survives deleting the meal, and a meal saved again refreshes it', async () => {
    const deps = makeDeps(await make());
    const meal = await logMeal(deps, { description: 'Synthetic  OATS', ingredients: ['oats'], allergens: ['milk'] });
    expect(await toggleFavoriteMeal(deps, meal)).toBe(true);
    expect((await getPreferences(deps)).favorites.meals).toEqual([{ key: 'synthetic oats', description: 'Synthetic  OATS', ingredients: ['oats'], allergens: ['milk'], barcode: null, source: { kind: 'typed', edited: false, llm: null } }]);
    await deps.repo.deleteRecords({ meals: [meal.id] });
    expect((await getPreferences(deps)).favorites.meals).toHaveLength(1);
    await logMeal(deps, { description: 'synthetic oats', ingredients: ['oats', 'honey'], allergens: [] });
    expect((await getPreferences(deps)).favorites.meals[0]).toMatchObject({ description: 'synthetic oats', ingredients: ['oats', 'honey'], allergens: [] });
    expect(await toggleFavoriteMeal(deps, meal)).toBe(false);
    expect((await getPreferences(deps)).favorites.meals).toEqual([]);
  });

  it('IN-14 saving a meal that is not a favorite stores no preferences', async () => {
    const deps = makeDeps(await make());
    await logMeal(deps, { description: 'Synthetic oats', ingredients: [] });
    await refreshFavoriteMeal(deps, { ...(await deps.repo.listMeals())[0]! });
    expect(await deps.repo.getPreferences()).toBeNull();
  });

  it('IN-14 favorite drinks are identified by name and amount', async () => {
    const deps = makeDeps(await make());
    expect(await toggleFavoriteDrink(deps, { name: 'Synthetic beer', amountMl: 500, alcohol: true, ingredients: [], allergens: [], barcode: null, source: { kind: 'typed', edited: false, llm: null } })).toBe(true);
    expect(await toggleFavoriteDrink(deps, { name: 'synthetic BEER', amountMl: 330, alcohol: true, ingredients: [], allergens: [], barcode: null, source: { kind: 'typed', edited: false, llm: null } })).toBe(true);
    expect((await getPreferences(deps)).favorites.drinks.map((a) => a.amountMl)).toEqual([500, 330]);
  });

  it('UX-2 quick actions move with up and down, can be hidden, and More cannot be hidden', async () => {
    const deps = makeDeps(await make());
    expect((await moveQuickAction(deps, 'checkin', -1)).slice(0, 4)).toEqual(['meal', 'skin', 'checkin', 'treatment']);
    expect((await moveQuickAction(deps, 'meal', -1))[0]).toBe('meal'); // already first
    expect((await moveQuickAction(deps, 'more', 1)).at(-1)).toBe('more'); // already last
    await setQuickActionHidden(deps, 'stool', true);
    expect(visibleQuickActions(await getPreferences(deps))).toEqual(['meal', 'skin', 'checkin', 'treatment', 'more']);
    expect(await code(setQuickActionHidden(deps, 'more', true))).toBe('invalid_value');
    await setQuickActionHidden(deps, 'stool', false);
    expect(visibleQuickActions(await getPreferences(deps))).toHaveLength(6);
  });

  it('EX-1, EX-10 preferences export in the settings part; a fresh install takes them, a merge keeps local ones, replace overwrites', async () => {
    const a = makeDeps(await make());
    await updateSuggestionSettings(a, { rows: 9 });
    const meal = await logMeal(a, { description: 'Synthetic oats', ingredients: ['oats'] });
    await toggleFavoriteMeal(a, meal);
    const zip = await exportBundle(a, { parts: both, csv: true });
    const parsed = await previewImport(a, zip);
    expect(parsed.payload.preferences?.suggestions.rows).toBe(9);

    const fresh = makeDeps(await make());
    await applyImport(fresh, await previewImport(fresh, zip), { mode: 'merge', parts: both });
    expect((await getPreferences(fresh)).suggestions.rows).toBe(9);
    expect((await getPreferences(fresh)).favorites.meals).toHaveLength(1);

    const local = makeDeps(await make());
    await updateSuggestionSettings(local, { rows: 3 });
    await applyImport(local, await previewImport(local, zip), { mode: 'merge', parts: both });
    expect((await getPreferences(local)).suggestions.rows).toBe(3); // local values win
    await applyImport(local, await previewImport(local, zip), { mode: 'replace', parts: both });
    expect((await getPreferences(local)).suggestions.rows).toBe(9);

    const recordsOnly = makeDeps(await make());
    await updateSuggestionSettings(recordsOnly, { rows: 3 });
    await applyImport(recordsOnly, await previewImport(recordsOnly, zip), { mode: 'replace', parts: { records: true, settings: false } });
    expect((await getPreferences(recordsOnly)).suggestions.rows).toBe(3); // the settings part was not chosen
  });

  it('EX-1 a file with a bad preferences section is refused', async () => {
    const good = JSON.parse(JSON.stringify(preferencesToJson(defaultPreferences()))) as Record<string, any>;
    expect(() => parsePreferences(good)).not.toThrow();
    for (const bad of [
      { ...good, suggestions: { ...good.suggestions, rows: 99 } },
      { ...good, suggestions: { ...good.suggestions, window_days: 10 } },
      { ...good, quick_actions: { order: ['meal', 'meal'], hidden: [] } },
      { ...good, quick_actions: { order: ['nope'], hidden: [] } },
      { ...good, favorites: { ...good.favorites, drinks: [{ key: 'k', name: 'x', amount_ml: -5, alcohol: false, ingredients: [], allergens: [], barcode: null, source: { kind: 'typed', edited: false, llm: null } }] } },
    ]) {
      expect(() => parsePreferences(bad)).toThrow(NettleError);
    }
  });
});
