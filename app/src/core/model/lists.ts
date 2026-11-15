import type { ItemValueKind, ListItem, ListKind } from './types';

const item = (id: string, valueKind: ItemValueKind): ListItem => ({
  id,
  name: id.replace(/^[a-z]+-/, '').replace(/-/g, ' '),
  predefined: true,
  archived: false,
  nameOverride: null,
  valueKind,
  description: null,
});

/** SK-7, IN-6: the seeded Daily health items. Names here are English seed values; the UI localizes predefined items by id. */
export const PREDEFINED_ITEMS: Record<ListKind, readonly ListItem[]> = {
  dailyItems: [
    item('item-wellbeing', 'score'),
    item('item-stress', 'score'),
    item('item-sleep', 'score'),
    item('item-abdominal-pain', 'score'),
    item('item-bloating', 'yesno'),
    ...[
      'tag-illness-or-infection',
      'tag-antibiotics',
      'tag-shaving',
      'tag-heavy-sweating',
      'tag-sauna-or-pool',
      'tag-sun-exposure',
      'tag-travel',
      'tag-nicotine',
      'tag-joint-symptoms',
    ].map((id) => item(id, 'yesno')),
  ],
  // IN-11: no seeded treatments; the user saves their own.
  treatments: [],
};
