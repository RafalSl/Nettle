/** UX-11: the More search. It filters entry types and "Where do I log…?" situations as the user types. */

export interface SearchItem<T> {
  /** What is shown and matched: the title, a subtitle or note, and any extra words. */
  title: string;
  subtitle?: string;
  keywords?: string;
  value: T;
}

/** Lower case, no accents, single spaces, so "Skóra" matches "skora" and case never matters. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').replace(/Ł/g, 'l').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * UX-11: the items whose title, subtitle or keywords contain every word of the query (any order); a title match
 * comes before a match elsewhere. An empty query returns every item in its given order.
 */
export function searchItems<T>(items: readonly SearchItem<T>[], query: string): SearchItem<T>[] {
  const words = normalize(query).split(' ').filter(Boolean);
  if (words.length === 0) return [...items];
  const hits: { item: SearchItem<T>; inTitle: boolean; order: number }[] = [];
  items.forEach((item, order) => {
    const title = normalize(item.title);
    const all = normalize(`${item.title} ${item.subtitle ?? ''} ${item.keywords ?? ''}`);
    if (words.every((w) => all.includes(w))) hits.push({ item, inTitle: words.every((w) => title.includes(w)), order });
  });
  return hits.sort((a, b) => Number(b.inTitle) - Number(a.inTitle) || a.order - b.order).map((h) => h.item);
}
