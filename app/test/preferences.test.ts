import { SqliteRepo } from '@/adapters/storage/sqliteRepo';
import { defaultPreferences } from '@/core/model/preferences';
import { NettleError } from '@/core/model/errors';
import { parsePreferences, preferencesToJson } from '@/core/export/preferencesJson';
import type { StorageRepository } from '@/core/ports/storage';
import { applyImport, exportBundle, previewImport } from '@/core/usecases/exchange';
import { logMeal } from '@/core/usecases/logMeal';
import {
  getPreferences,
  movePinnedEntryType,
  pinEntryType,
  pinnedEntryTypes,
  unpinEntryType,
  unpinnedEntryTypes,
  refreshFavoriteMeal,
  toggleFavoriteDrink,
  toggleFavoriteMeal,
  updateSuggestionSettings,
} from '@/core/usecases/preferences';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';
import { createNodeSqliteDb } from './helpers/nodeSqliteDb';
import { errorCode } from './helpers/errors';

const repos: [string, () => Promise<StorageRepository>][] = [
  ['in-memory', async () => new MemoryRepo()],
  ['sqlite', async () => SqliteRepo.open(createNodeSqliteDb())],
];
const both = { records: true, settings: true };

describe.each(repos)('preferences (%s)', (_name, make) => {
  it('IN-14 starts with the defaults: 5 rows, a 30 day window, save on tap off, all quick actions in order', async () => {
    const deps = makeDeps(await make());
    expect(await getPreferences(deps)).toEqual(defaultPreferences());
    expect(await deps.repo.getPreferences()).toBeNull(); // nothing stored until the user changes something
  });

  it('IN-14 suggestion settings are validated and stored', async () => {
    const deps = makeDeps(await make());
    expect(await updateSuggestionSettings(deps, { rows: 8, windowDays: 14, saveOnTap: true })).toEqual({
      rows: 8,
      windowDays: 14,
      saveOnTap: true,
      knownNames: false,
    });
    expect((await getPreferences(deps)).suggestions.rows).toBe(8);
    expect(await errorCode(updateSuggestionSettings(deps, { rows: 0 }))).toBe('invalid_value');
    expect(await errorCode(updateSuggestionSettings(deps, { rows: 21 }))).toBe('invalid_value');
    expect(await errorCode(updateSuggestionSettings(deps, { windowDays: 10 as never }))).toBe('invalid_value');
  });

  it('IN-14 a favorite is a snapshot that survives deleting the meal, and a meal saved again refreshes it', async () => {
    const deps = makeDeps(await make());
    const meal = await logMeal(deps, { description: 'Synthetic  OATS', ingredients: ['oats'], allergens: ['milk'] });
    expect(await toggleFavoriteMeal(deps, meal)).toBe(true);
    expect((await getPreferences(deps)).favorites.meals).toEqual([
      {
        key: 'synthetic oats',
        description: 'Synthetic  OATS',
        ingredients: ['oats'],
        allergens: ['milk'],
        barcode: null,
        source: { kind: 'typed', edited: false, llm: null, aiTags: false },
      },
    ]);
    await deps.repo.deleteRecords({ meals: [meal.id] });
    expect((await getPreferences(deps)).favorites.meals).toHaveLength(1);
    await logMeal(deps, { description: 'synthetic oats', ingredients: ['oats', 'honey'], allergens: [] });
    expect((await getPreferences(deps)).favorites.meals[0]).toMatchObject({
      description: 'synthetic oats',
      ingredients: ['oats', 'honey'],
      allergens: [],
    });
    expect(await toggleFavoriteMeal(deps, meal)).toBe(false);
    expect((await getPreferences(deps)).favorites.meals).toEqual([]);
  });

  it('IN-14 saving a meal that is not a favorite stores no preferences', async () => {
    const deps = makeDeps(await make());
    await logMeal(deps, { description: 'Synthetic oats', ingredients: [] });
    await refreshFavoriteMeal(deps, { ...(await deps.repo.listRecords('meals'))[0]! });
    expect(await deps.repo.getPreferences()).toBeNull();
  });

  it('IN-14 favorite drinks are identified by name and amount', async () => {
    const deps = makeDeps(await make());
    expect(
      await toggleFavoriteDrink(deps, {
        name: 'Synthetic beer',
        amountMl: 500,
        alcohol: true,
        ingredients: [],
        allergens: [],
        barcode: null,
        source: { kind: 'typed', edited: false, llm: null, aiTags: false },
      }),
    ).toBe(true);
    expect(
      await toggleFavoriteDrink(deps, {
        name: 'synthetic BEER',
        amountMl: 330,
        alcohol: true,
        ingredients: [],
        allergens: [],
        barcode: null,
        source: { kind: 'typed', edited: false, llm: null, aiTags: false },
      }),
    ).toBe(true);
    expect((await getPreferences(deps)).favorites.drinks.map((a) => a.amountMl)).toEqual([500, 330]);
  });

  it('UX-2 entry types are pinned, unpinned and moved with up and down; whatever is not pinned is in More', async () => {
    const deps = makeDeps(await make());
    expect((await getPreferences(deps)).quickActions.pinned).toEqual(['meal', 'skin', 'treatment', 'checkin', 'stool']);
    expect((await movePinnedEntryType(deps, 'checkin', -1)).slice(0, 4)).toEqual(['meal', 'skin', 'checkin', 'treatment']);
    expect((await movePinnedEntryType(deps, 'meal', -1))[0]).toBe('meal'); // already first
    expect((await movePinnedEntryType(deps, 'stool', 1)).at(-1)).toBe('stool'); // already last
    expect(await movePinnedEntryType(deps, 'drink', 1)).toHaveLength(5); // not pinned: nothing changes
    await unpinEntryType(deps, 'stool');
    let prefs = await getPreferences(deps);
    expect(pinnedEntryTypes(prefs)).toEqual(['meal', 'skin', 'checkin', 'treatment']);
    expect(unpinnedEntryTypes(prefs)).toEqual(['drink', 'medication', 'nails', 'stool', 'reaction', 'change', 'medical']);
    await pinEntryType(deps, 'drink');
    await pinEntryType(deps, 'drink'); // pinning twice keeps one
    prefs = await getPreferences(deps);
    expect(pinnedEntryTypes(prefs)).toEqual(['meal', 'skin', 'checkin', 'treatment', 'drink']);
    expect(pinnedEntryTypes(prefs).length + unpinnedEntryTypes(prefs).length).toBe(11); // nothing is hidden
    expect(await errorCode(pinEntryType(deps, 'more' as never))).toBe('invalid_value');
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
      {
        ...good,
        favorites: {
          ...good.favorites,
          drinks: [
            {
              key: 'k',
              name: 'x',
              amount_ml: -5,
              alcohol: false,
              ingredients: [],
              allergens: [],
              barcode: null,
              source: { kind: 'typed', edited: false, llm: null, aiTags: false },
            },
          ],
        },
      },
    ]) {
      expect(() => parsePreferences(bad)).toThrow(NettleError);
    }
  });
});
