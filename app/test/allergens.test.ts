import { addIngredients, joinIngredients, splitIngredients } from '@/core/model/allergens';


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
