import { deriveFlares, type FlarePeriod } from '../model/flares';
import type { Deps } from './deps';
import { flareRule } from '../model/preferences';
import { getPreferences } from './preferences';

/** SK-6: the flare periods derived from the skin entries and the threshold in the preferences, oldest first. */
export async function flarePeriods(deps: Deps): Promise<FlarePeriod[]> {
  const threshold = flareRule(await getPreferences(deps));
  return deriveFlares(await deps.repo.listSkinEntries(), threshold);
}

/**
 * SK-6, UX-2: the flare that has no later entry below the threshold, if any. Several can be open (an area whose last
 * entry was high and that was not logged again); the most recent one is the current flare.
 */
export async function openFlare(deps: Deps): Promise<FlarePeriod | null> {
  return (await flarePeriods(deps)).filter((p) => p.end === null).pop() ?? null;
}

export interface OpenFlare {
  period: FlarePeriod;
  /** The latest severity of each area in the flare (areas that never reached the threshold are not listed), highest first. */
  areas: { areaId: string; severity: number }[];
}

/** UX-2: the open flare with the latest severity of its areas, for the Today card ("Flare in N areas, worst: X"). */
export async function openFlareSummary(deps: Deps): Promise<OpenFlare | null> {
  const period = await openFlare(deps);
  if (!period) return null;
  const entries = (await deps.repo.listSkinEntries()).filter((e) => period.areaIds.includes(e.areaId));
  const latest = new Map<string, { at: string; severity: number }>();
  for (const e of entries) {
    const cur = latest.get(e.areaId);
    if (!cur || e.at.utc >= cur.at) latest.set(e.areaId, { at: e.at.utc, severity: e.scores.severity });
  }
  const areas = [...latest].map(([areaId, v]) => ({ areaId, severity: v.severity })).sort((a, b) => b.severity - a.severity || a.areaId.localeCompare(b.areaId));
  return { period, areas };
}
