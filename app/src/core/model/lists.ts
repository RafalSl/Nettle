import type { ListItem, ListKind } from './types';

const items = (ids: string[]): ListItem[] =>
  ids.map((id) => ({ id, name: id.replace(/^[a-z]+-/, '').replace(/-/g, ' '), predefined: true, archived: false, nameOverride: null }));

/** IN-6: seeded daily tags. Names here are English seed values; the UI localizes predefined items by id. */
export const PREDEFINED_ITEMS: Record<ListKind, readonly ListItem[]> = {
  dailyTags: items([
    'tag-illness-or-infection',
    'tag-antibiotics',
    'tag-shaving',
    'tag-heavy-sweating',
    'tag-sauna-or-pool',
    'tag-sun-exposure',
    'tag-travel',
    'tag-nicotine',
    'tag-joint-symptoms',
  ]),
  // IN-11: no seeded treatments; the user saves their own.
  treatments: [],
};
