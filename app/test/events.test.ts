import { NettleError } from '@/core/model/errors';
import { suggestAllergens } from '@/core/model/allergens';
import { ALLERGENS } from '@/core/model/types';
import { logAlcohol, logMedication } from '@/core/usecases/intake';
import { applyTreatment, logChangeEvent, logReaction } from '@/core/usecases/events';
import { addListItem, archiveListItem } from '@/core/usecases/lists';
import { logMeal } from '@/core/usecases/logMeal';
import { addArea, archiveSkinArea } from '@/core/usecases/skin';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';

const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );

describe('allergen tags (IN-10)', () => {
  it('IN-10 lists the 14 EU allergens', () => {
    expect(ALLERGENS).toHaveLength(14);
    expect(new Set(ALLERGENS).size).toBe(14);
  });

  it('IN-10 saves confirmed allergens once each and rejects unknown ones', async () => {
    const deps = makeDeps(new MemoryRepo());
    const meal = await logMeal(deps, { description: 'Synthetic', ingredients: [], allergens: ['milk', 'milk', 'eggs'] });
    expect(meal.allergens).toEqual(['milk', 'eggs']);
    expect((await logMeal(deps, { description: 'Plain', ingredients: [] })).allergens).toEqual([]);
    expect(await code(logMeal(deps, { description: 'x', ingredients: [], allergens: ['dust' as never] }))).toBe('invalid_value');
  });

  it('IN-10 suggests allergens from English and Polish ingredient text, as a suggestion only', () => {
    expect(suggestAllergens(['wheat flour', 'whole milk', 'sesame seeds'])).toEqual(['gluten', 'milk', 'sesame']);
    expect(suggestAllergens(['mąka pszenna', 'jajka', 'masło'])).toEqual(['gluten', 'eggs', 'milk']);
    expect(suggestAllergens(['water', 'salt', 'rice'])).toEqual([]);
    expect(suggestAllergens([])).toEqual([]);
  });
});

describe('treatments (IN-11)', () => {
  it('IN-11 applies a saved treatment to several areas in one call, timestamped', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    const cream = await addListItem(deps, 'treatments', 'Synthetic cream');
    const nail = await addArea(deps, 'Synthetic thumb', 'nail');
    const app = await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin', nail.id, 'area-chin'], at: new Date('2026-01-15T07:00:00.000Z') });
    expect(app).toMatchObject({ treatmentId: cream.id, areaIds: ['area-chin', nail.id], at: { utc: '2026-01-15T07:00:00.000Z' } });
    expect(await repo.listRecords('treatmentApplications')).toEqual([app]);
  });

  it('IN-11 needs at least one existing, active area and an active saved treatment', async () => {
    const deps = makeDeps(new MemoryRepo());
    const cream = await addListItem(deps, 'treatments', 'Synthetic cream');
    expect(await code(applyTreatment(deps, { treatmentId: cream.id, areaIds: [] }))).toBe('no_areas_selected');
    expect(await code(applyTreatment(deps, { treatmentId: cream.id, areaIds: ['nope'] }))).toBe('unknown_area');
    expect(await code(applyTreatment(deps, { treatmentId: 'nope', areaIds: ['area-chin'] }))).toBe('unknown_item');
    await archiveSkinArea(deps, 'area-chin');
    expect(await code(applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin'] }))).toBe('area_archived');
    await archiveListItem(deps, 'treatments', cream.id);
    expect(await code(applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-neck'] }))).toBe('area_archived');
  });
});

describe('change events (IN-12)', () => {
  it('IN-12 logs started and stopped events with a date and a name', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    const a = await logChangeEvent(deps, { action: 'started', category: 'medication', name: ' Synthetic pill ', at: new Date('2026-01-10T00:00:00.000Z') });
    const b = await logChangeEvent(deps, { action: 'stopped', category: 'diet', name: 'Synthetic diet', note: ' n ' });
    expect(a).toMatchObject({ action: 'started', category: 'medication', name: 'Synthetic pill', note: null });
    expect(b.note).toBe('n');
    expect((await repo.listRecords('changeEvents')).map((e) => e.id)).toEqual([b.id, a.id]);
  });

  it('IN-12 rejects an empty name and unknown values', async () => {
    const deps = makeDeps(new MemoryRepo());
    const ok = { action: 'started', category: 'product', name: 'x' } as const;
    expect(await code(logChangeEvent(deps, { ...ok, name: '  ' }))).toBe('empty_item_name');
    expect(await code(logChangeEvent(deps, { ...ok, action: 'paused' as never }))).toBe('invalid_value');
    expect(await code(logChangeEvent(deps, { ...ok, category: 'mood' as never }))).toBe('invalid_value');
  });
});

describe('immediate reactions (IN-13)', () => {
  it('IN-13 links a reaction to a meal with the time of onset', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    const meal = await logMeal(deps, { description: 'Synthetic lunch', ingredients: [], at: new Date('2026-01-15T12:00:00.000Z') });
    const r = await logReaction(deps, { mealId: meal.id, symptoms: ['hives', 'hives', 'stomach'], at: new Date('2026-01-15T13:10:00.000Z') });
    expect(r).toMatchObject({ mealId: meal.id, symptoms: ['hives', 'stomach'], at: { utc: '2026-01-15T13:10:00.000Z' } });
    expect(await repo.listRecords('reactions')).toEqual([r]);
  });

  it('IN-13 rejects an unknown meal, no symptoms, an unknown symptom and an onset before the meal', async () => {
    const deps = makeDeps(new MemoryRepo());
    const meal = await logMeal(deps, { description: 'Synthetic lunch', ingredients: [], at: new Date('2026-01-15T12:00:00.000Z') });
    const at = new Date('2026-01-15T13:00:00.000Z');
    expect(await code(logReaction(deps, { mealId: 'nope', symptoms: ['hives'], at }))).toBe('unknown_meal');
    expect(await code(logReaction(deps, { mealId: meal.id, symptoms: [], at }))).toBe('invalid_value');
    expect(await code(logReaction(deps, { mealId: meal.id, symptoms: ['sneezing' as never], at }))).toBe('invalid_value');
    expect(await code(logReaction(deps, { mealId: meal.id, symptoms: ['hives'], at: new Date('2026-01-15T11:59:00.000Z') }))).toBe(
      'reaction_before_meal',
    );
  });
});

describe('alcohol and medications (IN-4, IN-5)', () => {
  it('IN-4 logs a drink with type and amount in ml and rejects bad input', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    const e = await logAlcohol(deps, { drink: ' Synthetic beer ', amountMl: 500, at: new Date('2026-01-15T18:00:00.000Z') });
    expect(e).toMatchObject({ drink: 'Synthetic beer', amountMl: 500, note: null });
    expect(await repo.listRecords('alcoholEntries')).toEqual([e]);
    expect(await code(logAlcohol(deps, { drink: ' ', amountMl: 100 }))).toBe('empty_name');
    for (const bad of [0, -5, 2.5, NaN]) expect(await code(logAlcohol(deps, { drink: 'x', amountMl: bad }))).toBe('invalid_amount');
  });

  it('IN-5 logs a medication or supplement with an optional dose', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    const a = await logMedication(deps, { category: 'supplement', name: ' Synthetic vitamin ', dose: ' 1 tablet ' });
    const b = await logMedication(deps, { category: 'medication', name: 'Synthetic pill' });
    expect(a).toMatchObject({ category: 'supplement', name: 'Synthetic vitamin', dose: '1 tablet' });
    expect(b.dose).toBeNull();
    expect(await repo.listRecords('medicationEntries')).toHaveLength(2);
    expect(await code(logMedication(deps, { category: 'medication', name: '' }))).toBe('empty_name');
    expect(await code(logMedication(deps, { category: 'herb' as never, name: 'x' }))).toBe('invalid_value');
  });
});
