import { deriveFlares, type FlarePeriod } from '../model/flares';
import type { Deps } from './deps';
import { getPreferences } from './preferences';

/** SK-6: the flare periods derived from the skin entries and the threshold in the preferences, oldest first. */
export async function flarePeriods(deps: Deps): Promise<FlarePeriod[]> {
  const threshold = (await getPreferences(deps)).flareThreshold;
  return deriveFlares(await deps.repo.listSkinEntries(), threshold);
}

/** SK-6, UX-2: the flare that has no later entry below the threshold, if any (at most one after merging). */
export async function openFlare(deps: Deps): Promise<FlarePeriod | null> {
  return (await flarePeriods(deps)).find((p) => p.end === null) ?? null;
}
