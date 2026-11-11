import type { StorageRepository } from '@/core/ports/storage';
import { syntheticEntry, syntheticMeal } from '../helpers/fixtures';

/** Behaviour every StorageRepository must have; run against the fake and the SQLite adapter. */
export function storageContract(name: string, make: () => Promise<StorageRepository>) {
  describe(`${name} storage contract`, () => {
    let repo: StorageRepository;
    beforeEach(async () => {
      repo = await make();
    });

    it('SK-1 seeds the six predefined areas, intimate area sensitive by default', async () => {
      const areas = await repo.listAreas();
      expect(areas.map((a) => a.id).sort()).toEqual([
        'area-behind-ears',
        'area-chin',
        'area-ears-inside',
        'area-intimate',
        'area-neck',
        'area-sternum',
      ]);
      expect(areas.filter((a) => a.sensitiveDefault).map((a) => a.id)).toEqual(['area-intimate']);
    });

    it('IN-1 stores a meal with ordered ingredients and UTC + timezone', async () => {
      const meal = syntheticMeal('m1', '2026-01-15T08:00:00.000Z', ['b', 'a', 'c']);
      await repo.addMeal(meal);
      expect(await repo.listMeals()).toEqual([meal]);
    });

    it('IN-1 lists meals newest first and filters by inclusive range', async () => {
      await repo.addMeal(syntheticMeal('m1', '2026-01-10T08:00:00.000Z'));
      await repo.addMeal(syntheticMeal('m2', '2026-01-12T08:00:00.000Z'));
      await repo.addMeal(syntheticMeal('m3', '2026-01-14T08:00:00.000Z'));
      expect((await repo.listMeals()).map((m) => m.id)).toEqual(['m3', 'm2', 'm1']);
      const ranged = await repo.listMeals({ from: '2026-01-12T08:00:00.000Z', to: '2026-01-14T08:00:00.000Z' });
      expect(ranged.map((m) => m.id)).toEqual(['m3', 'm2']);
    });

    it('SK-3 stores separate 0-10 scores per area entry', async () => {
      const entry = syntheticEntry('e1', '2026-01-15T08:00:00.000Z', 'area-neck');
      await repo.addSkinEntry(entry);
      expect(await repo.listSkinEntries()).toEqual([entry]);
    });

    it('SK-3 rejects an entry for an unknown area', async () => {
      await expect(repo.addSkinEntry(syntheticEntry('e1', '2026-01-15T08:00:00.000Z', 'nope'))).rejects.toThrow();
    });

    it('SK-2 upsert adds, renames and archives areas', async () => {
      const area = { id: 'a-custom', name: 'Synthetic elbow', predefined: false, archived: false, sensitiveDefault: false };
      await repo.upsertArea(area);
      await repo.upsertArea({ ...area, name: 'Synthetic knee', archived: true });
      const found = (await repo.listAreas()).find((a) => a.id === 'a-custom');
      expect(found).toEqual({ ...area, name: 'Synthetic knee', archived: true });
    });

    it('EX-10 merge adds new rows and skips ids that already exist', async () => {
      await repo.addMeal(syntheticMeal('m1', '2026-01-10T08:00:00.000Z', ['original']));
      const incoming = {
        meals: [
          syntheticMeal('m1', '2026-01-10T08:00:00.000Z', ['changed', 'extra']),
          syntheticMeal('m2', '2026-01-11T08:00:00.000Z'),
        ],
        skinAreas: await repo.listAreas(),
        skinEntries: [syntheticEntry('e1', '2026-01-11T09:00:00.000Z')],
      };
      await repo.importSnapshot(incoming, 'merge');
      await repo.importSnapshot(incoming, 'merge'); // idempotent
      const meals = await repo.listMeals();
      expect(meals.map((m) => m.id)).toEqual(['m2', 'm1']);
      expect(meals.find((m) => m.id === 'm1')?.ingredients).toEqual(['original']);
      expect(await repo.listSkinEntries()).toHaveLength(1);
    });

    it('EX-10 replace wipes existing data and keeps predefined areas', async () => {
      await repo.addMeal(syntheticMeal('old', '2026-01-01T08:00:00.000Z'));
      await repo.addSkinEntry(syntheticEntry('old-e', '2026-01-01T09:00:00.000Z'));
      await repo.importSnapshot(
        { meals: [syntheticMeal('new', '2026-01-02T08:00:00.000Z')], skinAreas: [], skinEntries: [] },
        'replace',
      );
      expect((await repo.listMeals()).map((m) => m.id)).toEqual(['new']);
      expect(await repo.listSkinEntries()).toEqual([]);
      expect(await repo.listAreas()).toHaveLength(6);
    });

    it('EX-10 import is atomic: a bad row leaves the store unchanged', async () => {
      await repo.addMeal(syntheticMeal('keep', '2026-01-01T08:00:00.000Z'));
      const broken = {
        meals: [syntheticMeal('new', '2026-01-02T08:00:00.000Z')],
        skinAreas: [],
        skinEntries: [syntheticEntry('bad', '2026-01-02T09:00:00.000Z', 'missing-area')],
      };
      await expect(repo.importSnapshot(broken, 'replace')).rejects.toThrow();
      expect((await repo.listMeals()).map((m) => m.id)).toEqual(['keep']);
    });

    it('EX-1 snapshot filters entries by range but always includes all areas', async () => {
      await repo.addMeal(syntheticMeal('m1', '2026-01-01T08:00:00.000Z'));
      await repo.addMeal(syntheticMeal('m2', '2026-02-01T08:00:00.000Z'));
      const snap = await repo.snapshot({ from: '2026-01-15T00:00:00.000Z' });
      expect(snap.meals.map((m) => m.id)).toEqual(['m2']);
      expect(snap.skinAreas).toHaveLength(6);
    });
  });
}
