import type { Allergen } from './types';

/**
 * IN-10: lowercase word stems per allergen, English and Polish, matched anywhere in an ingredient.
 * This is a rough helper to pre-select tags; the user confirms or edits them, and a database or LLM can
 * add suggestions through the same path. A miss is possible and a match may be wrong.
 */
const STEMS: Record<Allergen, string[]> = {
  gluten: ['wheat', 'rye', 'barley', 'oat', 'spelt', 'gluten', 'flour', 'bread', 'pasta', 'pszeni', 'żyt', 'jęczmie', 'owies', 'orkisz', 'mąk', 'chleb', 'makaron'],
  crustaceans: ['shrimp', 'prawn', 'crab', 'lobster', 'krewet', 'krab', 'homar', 'rak '],
  eggs: ['egg', 'jaj', 'jajk', 'albumin', 'mayonnaise', 'majonez'],
  fish: ['fish', 'salmon', 'tuna', 'cod', 'herring', 'anchov', 'ryb', 'łosoś', 'tuńczyk', 'dorsz', 'śledz'],
  peanuts: ['peanut', 'arachid', 'orzeszk', 'orzechy ziemne'],
  soybeans: ['soy', 'tofu', 'edamame', 'sój', 'soj'],
  milk: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'whey', 'casein', 'lactose', 'mlek', 'ser ', 'masł', 'śmietan', 'jogurt', 'serwatk', 'kazeina', 'laktoz'],
  tree_nuts: ['almond', 'hazelnut', 'walnut', 'cashew', 'pecan', 'pistachio', 'migdał', 'orzech laskow', 'orzech włoski', 'nerkowc', 'pistacj'],
  celery: ['celery', 'seler'],
  mustard: ['mustard', 'musztard'],
  sesame: ['sesame', 'tahini', 'sezam'],
  sulphites: ['sulphite', 'sulfite', 'siarczyn', 'dwutlenek siarki'],
  lupin: ['lupin', 'łubin'],
  molluscs: ['mussel', 'oyster', 'squid', 'snail', 'octopus', 'małż', 'ostryg', 'kalmar', 'ślimak', 'ośmiornic'],
};

export function suggestAllergens(ingredients: string[]): Allergen[] {
  const text = ` ${ingredients.join(' , ').toLowerCase()} `;
  return (Object.keys(STEMS) as Allergen[]).filter((a) => STEMS[a].some((stem) => text.includes(stem)));
}

/**
 * IN-3: add estimated ingredient names to the list the user is editing. Nothing typed is changed or removed;
 * names already in the list (ignoring case and spacing) are not repeated, and one empty row stays at the end
 * for the next ingredient.
 */
export function addIngredients(current: readonly string[], names: readonly string[]): string[] {
  const clean = (s: string) => s.trim();
  const kept = current.map(clean).filter(Boolean);
  const have = new Set(kept.map((s) => s.toLowerCase().replace(/\s+/g, ' ')));
  const added: string[] = [];
  for (const raw of names) {
    const name = clean(raw);
    const key = name.toLowerCase().replace(/\s+/g, ' ');
    if (name && !have.has(key)) {
      have.add(key);
      added.push(name);
    }
  }
  return [...kept, ...added, ''];
}
