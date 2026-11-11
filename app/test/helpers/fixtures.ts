import type { Deps } from '@/core/usecases/deps';
import type { Meal, SkinEntry } from '@/core/model/types';
import type { StorageRepository } from '@/core/ports/storage';

/** Clearly synthetic data only. */
export const TZ = 'Europe/Warsaw';

export function makeDeps(repo: StorageRepository, now = '2026-01-15T10:00:00.000Z'): Deps {
  let n = 0;
  return {
    repo,
    ids: () => `id-${++n}`,
    clock: { now: () => new Date(now), timeZone: () => TZ },
  };
}

export const syntheticMeal = (id: string, utc: string, ingredients = ['Synthetic oats', 'Synthetic milk']): Meal => ({
  id,
  at: { utc, tz: TZ },
  description: `Synthetic breakfast ${id}`,
  ingredients,
  note: null,
});

export const syntheticEntry = (id: string, utc: string, areaId = 'area-chin'): SkinEntry => ({
  id,
  at: { utc, tz: TZ },
  areaId,
  scores: { severity: 3, itch: 5, pain: 0, dryness: 2, scaling: 10 },
  note: 'synthetic note',
});
