import { NettleError } from '../model/errors';
import type { ListItem, ListKind } from '../model/types';
import type { Deps } from './deps';

/** Items of a user-editable list that can currently be chosen (not archived). */
export async function listActiveItems(deps: Deps, kind: ListKind): Promise<ListItem[]> {
  return (await deps.repo.listItems(kind)).filter((i) => !i.archived);
}

export async function addListItem(deps: Deps, kind: ListKind, name: string): Promise<ListItem> {
  const trimmed = name.trim();
  if (!trimmed) throw new NettleError('empty_item_name');
  const item: ListItem = { id: deps.ids(), name: trimmed, predefined: false, archived: false, nameOverride: null };
  await deps.repo.upsertItem(kind, item);
  return item;
}

async function find(deps: Deps, kind: ListKind, id: string): Promise<ListItem> {
  const item = (await deps.repo.listItems(kind)).find((i) => i.id === id);
  if (!item) throw new NettleError('unknown_item', id);
  return item;
}

/** Same rule as areas (SK-2): predefined items get a `nameOverride`, user items change `name`. */
export async function renameListItem(deps: Deps, kind: ListKind, id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new NettleError('empty_item_name');
  const item = await find(deps, kind, id);
  await deps.repo.upsertItem(kind, item.predefined ? { ...item, nameOverride: trimmed } : { ...item, name: trimmed });
}

export async function resetListItemName(deps: Deps, kind: ListKind, id: string): Promise<void> {
  await deps.repo.upsertItem(kind, { ...(await find(deps, kind, id)), nameOverride: null });
}

export async function archiveListItem(deps: Deps, kind: ListKind, id: string, archived = true): Promise<void> {
  await deps.repo.upsertItem(kind, { ...(await find(deps, kind, id)), archived });
}
