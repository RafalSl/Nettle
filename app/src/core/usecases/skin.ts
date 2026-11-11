import { NettleError } from '../model/errors';
import { makeStamp } from '../model/time';
import { SCORE_KEYS, type SkinArea, type SkinEntry, type SkinScores } from '../model/types';
import type { Deps } from './deps';

export interface LogSkinEntryInput {
  areaId: string;
  scores: SkinScores;
  at?: Date;
  note?: string;
}

export const isScore = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 10;

/** SK-3: separate 0-10 scores per area and entry. */
export async function logSkinEntry(deps: Deps, input: LogSkinEntryInput): Promise<SkinEntry> {
  for (const key of SCORE_KEYS) {
    if (!isScore(input.scores[key])) throw new NettleError('invalid_score', key);
  }
  const area = (await deps.repo.listAreas()).find((a) => a.id === input.areaId);
  if (!area) throw new NettleError('unknown_area', input.areaId);
  if (area.archived) throw new NettleError('area_archived', input.areaId);
  const entry: SkinEntry = {
    id: deps.ids(),
    at: makeStamp(deps.clock, input.at),
    areaId: input.areaId,
    scores: { ...input.scores },
    note: input.note?.trim() || null,
  };
  await deps.repo.addSkinEntry(entry);
  return entry;
}

/** SK-1/SK-2: areas the user can currently log against. */
export async function listActiveAreas(deps: Deps): Promise<SkinArea[]> {
  return (await deps.repo.listAreas()).filter((a) => !a.archived);
}

export async function addSkinArea(deps: Deps, name: string): Promise<SkinArea> {
  const trimmed = name.trim();
  if (!trimmed) throw new NettleError('empty_area_name');
  const area: SkinArea = {
    id: deps.ids(),
    name: trimmed,
    predefined: false,
    archived: false,
    sensitiveDefault: false,
  };
  await deps.repo.upsertArea(area);
  return area;
}

async function findArea(deps: Deps, id: string): Promise<SkinArea> {
  const area = (await deps.repo.listAreas()).find((a) => a.id === id);
  if (!area) throw new NettleError('unknown_area', id);
  return area;
}

/** Predefined areas keep their localized names, so only user areas can be renamed. */
export async function renameSkinArea(deps: Deps, id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new NettleError('empty_area_name');
  const area = await findArea(deps, id);
  if (area.predefined) throw new NettleError('predefined_area_locked', id);
  await deps.repo.upsertArea({ ...area, name: trimmed });
}

export async function archiveSkinArea(deps: Deps, id: string, archived = true): Promise<void> {
  const area = await findArea(deps, id);
  await deps.repo.upsertArea({ ...area, archived });
}
