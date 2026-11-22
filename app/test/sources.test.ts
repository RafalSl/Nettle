import { afterEdit, assertSource, sameIngredients, typedSource } from '@/core/model/source';
import { NettleError } from '@/core/model/errors';
import { editDrink, editMeal } from '@/core/usecases/entries';
import { logDrink } from '@/core/usecases/intake';
import { logMeal } from '@/core/usecases/logMeal';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';

const llm = { model: 'synthetic-model', at: '2026-01-01T00:00:00.000Z', promptVersion: 'ingredients-2' };
const photo = { kind: 'photo_estimate' as const, edited: false, llm, aiTags: false };

describe('source of ingredients (IN-16)', () => {
  it('IN-16 a new entry is typed unless it says otherwise, and a source must be consistent', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect((await logMeal(deps, { description: 'Synthetic', ingredients: [] })).source).toEqual(typedSource());
    const bad = (s: object) => logMeal(deps, { description: 'x', ingredients: [], source: s as never });
    for (const s of [
      { kind: 'photo_estimate', edited: false, llm: null, aiTags: false },
      { kind: 'name_estimate', edited: false, llm: null, aiTags: false },
      { kind: 'typed', edited: false, llm },
      { kind: 'typed', edited: true, llm: null, aiTags: false },
      { kind: 'gps', edited: false, llm: null, aiTags: false },
    ]) {
      await expect(bad(s)).rejects.toBeInstanceOf(NettleError);
    }
  });

  it('IN-16 editing the ingredients or tags of a filled entry marks it edited; editing the note or a typed entry does not', async () => {
    const deps = makeDeps(new MemoryRepo());
    const meal = await logMeal(deps, {
      description: 'Synthetic',
      ingredients: ['rice', 'oil'],
      allergens: ['milk'],
      source: photo,
      barcode: '5900000000008',
    });
    const same = await editMeal(deps, meal.id, { description: 'Renamed', ingredients: [' rice', 'oil '], allergens: ['milk'], note: 'n' });
    expect(same.source).toEqual(photo);
    expect(same.barcode).toBe('5900000000008');
    const changed = await editMeal(deps, meal.id, { description: 'Renamed', ingredients: ['rice'], allergens: ['milk'] });
    expect(changed.source).toEqual({ ...photo, edited: true });
    const typed = await logMeal(deps, { description: 'Typed', ingredients: ['a'] });
    expect((await editMeal(deps, typed.id, { description: 'Typed', ingredients: ['b'] })).source).toEqual(typedSource());
    const drink = await logDrink(deps, {
      name: 'Synthetic tea',
      amountMl: 200,
      allergens: [],
      source: { kind: 'open_food_facts', edited: false, llm: null, aiTags: false },
      barcode: '5900000000008',
    });
    expect((await editDrink(deps, drink.id, { name: 'Synthetic tea', amountMl: 200, allergens: ['milk'] })).source).toEqual({
      kind: 'open_food_facts',
      edited: true,
      llm: null,
      aiTags: false,
    });
  });

  it('IN-16 helpers: tag order does not matter, ingredient order does', () => {
    expect(
      sameIngredients({ ingredients: ['a', 'b'], allergens: ['milk', 'eggs'] }, { ingredients: ['a', 'b'], allergens: ['eggs', 'milk'] }),
    ).toBe(true);
    expect(sameIngredients({ ingredients: ['a', 'b'], allergens: [] }, { ingredients: ['b', 'a'], allergens: [] })).toBe(false);
    expect(afterEdit(typedSource(), true)).toEqual(typedSource());
    expect(() => assertSource({ kind: 'label_scan', edited: false, llm, aiTags: false })).not.toThrow();
  });
});
