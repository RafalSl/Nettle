import { DayStart } from '@/core/model/dayStart';
import { FakeAuth } from '../fakes/fakeAuth';
import { FakeBarcode } from '../fakes/fakeBarcode';
import { FakeNotifier } from '../fakes/fakeNotifier';
import { FakePdf } from '../fakes/fakePdf';
import { FakeLlm } from '../fakes/fakeLlm';
import { MemoryKeyStore } from '../fakes/memoryKeyStore';
import { MemoryPhotoStore } from '../fakes/memoryPhotoStore';
import { MemorySettings } from '../fakes/memorySettings';
import type { LlmProvider } from '@/core/ports/llm';
import type { Deps } from '@/core/usecases/deps';
import type { CheckIn, Meal, NailEntry, SkinEntry, StoolEntry } from '@/core/model/types';
import type { StorageRepository } from '@/core/ports/storage';

/** Clearly synthetic data only. */
export const TZ = 'Europe/Warsaw';

export function makeDeps(repo: StorageRepository, now = '2026-01-15T10:00:00.000Z', llm: LlmProvider = new FakeLlm()): Deps {
  let n = 0;
  return {
    repo,
    ids: () => `id-${++n}`,
    clock: { now: () => new Date(now), timeZone: () => TZ },
    randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    photos: new MemoryPhotoStore(),
    pdf: new FakePdf(),
    notifier: new FakeNotifier(),
    keys: new MemoryKeyStore(),
    settings: new MemorySettings(),
    dayStart: new DayStart(),
    llmFor: () => llm,
    llmModels: [
      { id: 'claude-haiku-5-5', label: 'Haiku' },
      { id: 'claude-sonnet-5-5', label: 'Sonnet' },
    ],
    barcode: new FakeBarcode(),
    auth: new FakeAuth(),
  };
}

export const syntheticMeal = (id: string, utc: string, ingredients = ['Synthetic oats', 'Synthetic milk']): Meal => ({
  id,
  at: { utc, tz: TZ },
  description: `Synthetic breakfast ${id}`,
  ingredients,
  allergens: [],
  barcode: null,
  source: { kind: 'typed', edited: false, llm: null, aiTags: false },
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
  drinks: [],
  medicationEntries: [],
  photos: [],
  analyses: [],
  reportSummaries: [],
};

/** The user lists (see ListKind) with no items, to complete a Settings literal. */
export const noItems = { dailyItems: [], treatments: [] };

export const syntheticCheckIn = (id: string, utc: string, day: string, tags: string[] = []): CheckIn => ({
  id,
  at: { utc, tz: TZ },
  day,
  values: { 'item-wellbeing': 6, 'item-sleep': 4, 'item-abdominal-pain': 0, 'item-bloating': true, ...Object.fromEntries(tags.map((t) => [t, true])) },
  note: 'synthetic note',
});

export const syntheticStool = (id: string, utc: string, bristol = 4): StoolEntry => ({
  id,
  at: { utc, tz: TZ },
  bristol,
  note: null,
});
