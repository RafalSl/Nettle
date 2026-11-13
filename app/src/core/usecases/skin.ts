import { NettleError } from '../model/errors';
import { makeStamp } from '../model/time';
import {
  NAIL_EXTENTS,
  NAIL_STAGES,
  SCORE_KEYS,
  type AreaKind,
  type NailEntry,
  type NailExtent,
  type NailStage,
  type SkinArea,
  type SkinEntry,
  type SkinScores,
} from '../model/types';
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
  if (area.kind !== 'skin') throw new NettleError('wrong_area_kind', input.areaId);
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

/** SK-1/SK-2/SK-10: areas the user can currently log against, optionally of one kind. */
export async function listActiveAreas(deps: Deps, kind?: AreaKind): Promise<SkinArea[]> {
  return (await deps.repo.listAreas()).filter((a) => !a.archived && (!kind || a.kind === kind));
}

/** SK-2 / SK-10: a user area of the given kind; one nail area per affected nail. */
export async function addArea(deps: Deps, name: string, kind: AreaKind = 'skin'): Promise<SkinArea> {
  const trimmed = name.trim();
  if (!trimmed) throw new NettleError('empty_area_name');
  const area: SkinArea = {
    id: deps.ids(),
    kind,
    name: trimmed,
    predefined: false,
    archived: false,
    sensitiveDefault: false,
    nameOverride: null,
  };
  await deps.repo.upsertArea(area);
  return area;
}

async function findArea(deps: Deps, id: string): Promise<SkinArea> {
  const area = (await deps.repo.listAreas()).find((a) => a.id === id);
  if (!area) throw new NettleError('unknown_area', id);
  return area;
}

/** SK-2: user areas change `name`; predefined areas keep their id and localized default and get a `nameOverride`. */
export async function renameSkinArea(deps: Deps, id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new NettleError('empty_area_name');
  const area = await findArea(deps, id);
  await deps.repo.upsertArea(
    area.predefined ? { ...area, nameOverride: trimmed } : { ...area, name: trimmed },
  );
}

/** Back to the localized default name for a predefined area. */
export async function resetSkinAreaName(deps: Deps, id: string): Promise<void> {
  const area = await findArea(deps, id);
  await deps.repo.upsertArea({ ...area, nameOverride: null });
}

export async function archiveSkinArea(deps: Deps, id: string, archived = true): Promise<void> {
  const area = await findArea(deps, id);
  await deps.repo.upsertArea({ ...area, archived });
}

export interface LogNailEntryInput {
  areaId: string;
  stage: NailStage;
  extent: NailExtent;
  at?: Date;
  note?: string;
}

/** SK-10: a nail entry has a stage and a rough extent instead of the five scores. */
export async function logNailEntry(deps: Deps, input: LogNailEntryInput): Promise<NailEntry> {
  if (!NAIL_STAGES.includes(input.stage)) throw new NettleError('invalid_nail_value', 'stage');
  if (!NAIL_EXTENTS.includes(input.extent)) throw new NettleError('invalid_nail_value', 'extent');
  const area = (await deps.repo.listAreas()).find((a) => a.id === input.areaId);
  if (!area) throw new NettleError('unknown_area', input.areaId);
  if (area.kind !== 'nail') throw new NettleError('wrong_area_kind', input.areaId);
  if (area.archived) throw new NettleError('area_archived', input.areaId);
  const entry: NailEntry = {
    id: deps.ids(),
    at: makeStamp(deps.clock, input.at),
    areaId: input.areaId,
    stage: input.stage,
    extent: input.extent,
    note: input.note?.trim() || null,
  };
  await deps.repo.addRecord('nailEntries', entry);
  return entry;
}
