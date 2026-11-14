import { addIngredients } from '@/core/model/allergens';


describe('adding estimated ingredients (IN-3)', () => {
  it('IN-3 keeps what is typed, skips repeats ignoring case and spacing, and leaves one empty row', () => {
    expect(addIngredients(['Rice ', '', 'milk'], ['rice', ' Soy  sauce', 'soy sauce', '', 'Oats'])).toEqual(['Rice', 'milk', 'Soy  sauce', 'Oats', '']);
    expect(addIngredients([''], [])).toEqual(['']);
    expect(addIngredients([], ['a'])).toEqual(['a', '']);
  });
});
