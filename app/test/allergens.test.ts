import { addIngredients, joinIngredients, matchIngredientNames, splitIngredients } from '@/core/model/allergens';


describe('adding estimated ingredients (IN-3)', () => {
  it('IN-3 keeps what is typed, skips repeats ignoring case and spacing, and leaves one empty row', () => {
    expect(addIngredients(['Rice ', '', 'milk'], ['rice', ' Soy  sauce', 'soy sauce', '', 'Oats'])).toEqual(['Rice', 'milk', 'Soy  sauce', 'Oats', '']);
    expect(addIngredients([''], [])).toEqual(['']);
    expect(addIngredients([], ['a'])).toEqual(['a', '']);
  });
});

describe('ingredient text round trip (IN-15)', () => {
  it('IN-15 keeps commas inside brackets and between digits, trims, drops empties', () => {
    expect(splitIngredients('mleko (3,2%), cukier, mąka (pszenna, żytnia) , , sól [E1, E2], 1,5 l wody')).toEqual([
      'mleko (3,2%)',
      'cukier',
      'mąka (pszenna, żytnia)',
      'sól [E1, E2]',
      '1,5 l wody',
    ]);
    const list = ['mleko (3,2%)', 'mąka (pszenna, żytnia)', 'cukier'];
    expect(splitIngredients(joinIngredients(list))).toEqual(list);
    expect(splitIngredients('')).toEqual([]);
    expect(splitIngredients('a)), b')).toEqual(['a))', 'b']); // stray brackets never swallow the rest
  });
});

describe('ingredient autocomplete (IN-1)', () => {
  const known = ['oat milk', 'rice', 'milk chocolate', 'whole milk', 'butter', 'ricotta'];
  it('IN-1 names that start with the text come first, then names with a word that does; used and exact names are left out', () => {
    expect(matchIngredientNames(known, 'mil')).toEqual(['milk chocolate', 'oat milk', 'whole milk']);
    expect(matchIngredientNames(known, 'ric')).toEqual(['rice', 'ricotta']);
    expect(matchIngredientNames(known, 'ric', ['rice'])).toEqual(['ricotta']);
    expect(matchIngredientNames(known, 'RICE')).toEqual([]); // an exact match is not offered back
  });
  it('IN-1 needs two letters and returns at most five', () => {
    expect(matchIngredientNames(known, 'm')).toEqual([]);
    expect(matchIngredientNames(Array.from({ length: 9 }, (_, i) => `milk ${i}`), 'mi')).toHaveLength(5);
  });
});
