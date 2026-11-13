import type { Deps } from '@/core/usecases/deps';
import type { CheckIn, Meal, NailEntry, SkinEntry, StoolEntry } from '@/core/model/types';
import type { StorageRepository } from '@/core/ports/storage';

/** Clearly synthetic data only. */
export const TZ = 'Europe/Warsaw';

export function makeDeps(repo: StorageRepository, now = '2026-01-15T10:00:00.000Z'): Deps {
  let n = 0;
  return {
    repo,
    ids: () => `id-${++n}`,
    clock: { now: () => new Date(now), timeZone: () => TZ },
    randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
  };
}

export const syntheticMeal = (id: string, utc: string, ingredients = ['Synthetic oats', 'Synthetic milk']): Meal => ({
  id,
  at: { utc, tz: TZ },
  description: `Synthetic breakfast ${id}`,
  ingredients,
  allergens: [],
  note: null,
});

export const syntheticEntry = (id: string, utc: string, areaId = 'area-chin'): SkinEntry => ({
  id,
  at: { utc, tz: TZ },
  areaId,
  scores: { severity: 3, itch: 5, pain: 0, dryness: 2, scaling: 10 },
  note: 'synthetic note',
});

export const syntheticNailEntry = (id: string, utc: string, areaId = 'a-nail'): NailEntry => ({
  id,
  at: { utc, tz: TZ },
  areaId,
  stage: 'separation',
  extent: 'under_quarter',
  note: 'synthetic note',
});

/** The flat record kinds (see ExtraKind) with no rows, to complete a Records literal. */
export const noExtra = {
  nailEntries: [],
  checkIns: [],
  stoolEntries: [],
  treatmentApplications: [],
  changeEvents: [],
  reactions: [],
  alcoholEntries: [],
  medicationEntries: [],
};

/** The user lists (see ListKind) with no items, to complete a Settings literal. */
export const noItems = { dailyTags: [], treatments: [] };

export const syntheticCheckIn = (id: string, utc: string, day: string, tags: string[] = []): CheckIn => ({
  id,
  at: { utc, tz: TZ },
  day,
  wellbeing: 6,
  stress: null,
  sleep: 4,
  abdominalPain: 0,
  bloating: true,
  tags,
  note: 'synthetic note',
  completedAt: { utc, tz: TZ },
});

export const syntheticStool = (id: string, utc: string, bristol = 4): StoolEntry => ({
  id,
  at: { utc, tz: TZ },
  bristol,
  note: null,
});
