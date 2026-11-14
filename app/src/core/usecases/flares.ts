import { NettleError } from '../model/errors';
import { makeStamp } from '../model/time';
import type { FlareKind, FlareMarker } from '../model/types';
import type { Deps } from './deps';

/** The areas that currently have an open flare: the latest marker of the area is a start. */
export async function openFlareAreas(deps: Deps): Promise<Set<string>> {
  const latest = new Map<string, FlareKind>();
  for (const m of [...(await deps.repo.listRecords('flareMarkers'))].reverse()) latest.set(m.areaId, m.kind); // oldest first
  return new Set([...latest].filter(([, kind]) => kind === 'start').map(([id]) => id));
}

/**
 * SK-6: mark the start or the end of a flare for one area. A start needs no open flare in that area and an
 * end needs one. Scores are separate and stay as they are.
 */
export async function markFlare(
  deps: Deps,
  input: { areaId: string; kind: FlareKind; at?: Date; note?: string },
): Promise<FlareMarker> {
  const area = (await deps.repo.listAreas()).find((a) => a.id === input.areaId);
  if (!area) throw new NettleError('unknown_area', input.areaId);
  if (area.archived) throw new NettleError('area_archived', input.areaId);
  const open = (await openFlareAreas(deps)).has(input.areaId);
  if (input.kind === 'start' && open) throw new NettleError('flare_already_started', input.areaId);
  if (input.kind === 'end' && !open) throw new NettleError('flare_not_started', input.areaId);
  const marker: FlareMarker = {
    id: deps.ids(),
    at: makeStamp(deps.clock, input.at),
    areaId: input.areaId,
    kind: input.kind,
    note: input.note?.trim() || null,
  };
  await deps.repo.addRecord('flareMarkers', marker);
  return marker;
}
