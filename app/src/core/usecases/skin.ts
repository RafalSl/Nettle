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
  await assertNameFree(deps, trimmed);
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

const shownName = (a: SkinArea) => a.nameOverride ?? a.name;
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** SK-2: active area names are unique, compared without regard to case. `exceptId` is the area being changed. */
async function assertNameFree(deps: Deps, name: string, exceptId?: string): Promise<void> {
  const taken = (await deps.repo.listAreas()).some((a) => !a.archived && a.id !== exceptId && sameName(shownName(a), name));
  if (taken) throw new NettleError('duplicate_area_name', name);
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
  if (!area.archived) await assertNameFree(deps, trimmed, id);
  await deps.repo.upsertArea(
    area.predefined ? { ...area, nameOverride: trimmed } : { ...area, name: trimmed },
  );
}

/** Back to the localized default name for a predefined area. */
export async function resetSkinAreaName(deps: Deps, id: string): Promise<void> {
  const area = await findArea(deps, id);
  if (!area.archived) await assertNameFree(deps, area.name, id);
  await deps.repo.upsertArea({ ...area, nameOverride: null });
}

/** SK-5: photos added to this area start as sensitive (or not). Existing photos keep their own flag. */
export async function setAreaSensitiveDefault(deps: Deps, id: string, sensitiveDefault: boolean): Promise<void> {
  const area = await findArea(deps, id);
  await deps.repo.upsertArea({ ...area, sensitiveDefault });
}

export async function archiveSkinArea(deps: Deps, id: string, archived = true): Promise<void> {
  const area = await findArea(deps, id);
  if (!archived) await assertNameFree(deps, shownName(area), id); // unarchiving must not create a duplicate
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

/** SK-3: the scores of the area's most recent entry, to prefill a new one; null when there is none yet. */
export async function lastSkinScores(deps: Deps, areaId: string): Promise<SkinScores | null> {
  const last = (await deps.repo.listSkinEntries()).find((e) => e.areaId === areaId); // newest first
  return last ? { ...last.scores } : null;
}

/** SK-3 "no change": saves a new entry with the area's last scores in one call. */
export async function repeatSkinEntry(deps: Deps, areaId: string, at?: Date): Promise<SkinEntry> {
  const scores = await lastSkinScores(deps, areaId);
  if (!scores) throw new NettleError('no_previous_entry', areaId);
  return logSkinEntry(deps, { areaId, scores, at });
}

/** SK-3 "no change" for a nail area: a new entry with the area's last stage and extent. */
export async function repeatNailEntry(deps: Deps, areaId: string, at?: Date): Promise<NailEntry> {
  const last = (await deps.repo.listRecords('nailEntries')).find((e) => e.areaId === areaId); // newest first
  if (!last) throw new NettleError('no_previous_entry', areaId);
  return logNailEntry(deps, { areaId, stage: last.stage, extent: last.extent, at });
}

export interface RepeatAllResult {
  saved: (SkinEntry | NailEntry)[];
  /** Active areas that have no earlier entry, so they need a first one. */
  needFirstEntry: SkinArea[];
}

/**
 * SK-3 "no change for all areas": saves one entry per active area (skin and nail) that has an earlier entry,
 * all at the same time, and lists the areas that still need a first entry.
 */
export async function repeatAllAreas(deps: Deps, at?: Date): Promise<RepeatAllResult> {
  const result: RepeatAllResult = { saved: [], needFirstEntry: [] };
  const when = at ?? deps.clock.now();
  for (const area of await listActiveAreas(deps)) {
    try {
      result.saved.push(
        area.kind === 'nail' ? await repeatNailEntry(deps, area.id, when) : await repeatSkinEntry(deps, area.id, when),
      );
    } catch (e) {
      if (e instanceof NettleError && e.code === 'no_previous_entry') result.needFirstEntry.push(area);
      else throw e;
    }
  }
  return result;
}
