/** A copy of `set` with `id` added, or removed when it was there: what a chip or a photo check does. */
export function toggled<T>(set: ReadonlySet<T>, id: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(id)) next.add(id);
  return next;
}

/** A selection of at most one id, for single-choice chips. */
export const one = (id: string | null): Set<string> => new Set(id ? [id] : []);
