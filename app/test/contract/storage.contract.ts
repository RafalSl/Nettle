import type { StorageRepository } from '@/core/ports/storage';
import { syntheticEntry, syntheticMeal, syntheticNailEntry } from '../helpers/fixtures';

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

    const nailArea = {
      id: 'a-nail',
      kind: 'nail' as const,
      name: 'Synthetic left thumb',
      predefined: false,
      archived: false,
      sensitiveDefault: false,
      nameOverride: null,
    };

    it('SK-10 stores an area kind and a nail entry with stage and extent', async () => {
      await repo.upsertArea(nailArea);
      expect((await repo.listAreas()).find((a) => a.id === 'a-nail')?.kind).toBe('nail');
      expect((await repo.listAreas()).filter((a) => a.predefined).every((a) => a.kind === 'skin')).toBe(true);
      const entry = syntheticNailEntry('n1', '2026-01-15T08:00:00.000Z');
      await repo.addRecord('nailEntries', entry);
      expect(await repo.listRecords('nailEntries')).toEqual([entry]);
    });

    it('SK-10 lists nail entries newest first, filters by range and rejects unknown areas', async () => {
      await repo.upsertArea(nailArea);
      await repo.addRecord('nailEntries', syntheticNailEntry('n1', '2026-01-10T08:00:00.000Z'));
      await repo.addRecord('nailEntries', syntheticNailEntry('n2', '2026-01-12T08:00:00.000Z'));
      expect((await repo.listRecords('nailEntries')).map((e) => e.id)).toEqual(['n2', 'n1']);
      expect((await repo.listRecords('nailEntries', { from: '2026-01-11T00:00:00.000Z' })).map((e) => e.id)).toEqual(['n2']);
      await expect(repo.addRecord('nailEntries', syntheticNailEntry('n3', '2026-01-13T08:00:00.000Z', 'nope'))).rejects.toThrow();
    });

    it('EX-10 replace records wipes nail entries; replace settings keeps a nail area that is still used', async () => {
      await repo.upsertArea(nailArea);
      await repo.upsertArea({ ...nailArea, id: 'a-nail-unused' });
      await repo.addRecord('nailEntries', syntheticNailEntry('n1', '2026-01-10T08:00:00.000Z'));
      await repo.importData({ settings: { skinAreas: [] } }, 'replace');
      const ids = (await repo.listAreas()).map((a) => a.id);
      expect(ids).toContain('a-nail');
      expect(ids).not.toContain('a-nail-unused');
      await repo.importData({ records: { meals: [], skinEntries: [], nailEntries: [] } }, 'replace');
      expect(await repo.listRecords('nailEntries')).toEqual([]);
    });

    it('SK-2 upsert adds, renames and archives areas', async () => {
      const area = { id: 'a-custom', kind: 'skin' as const, name: 'Synthetic elbow', predefined: false, archived: false, sensitiveDefault: false, nameOverride: null };
      await repo.upsertArea(area);
      await repo.upsertArea({ ...area, name: 'Synthetic knee', archived: true });
      const found = (await repo.listAreas()).find((a) => a.id === 'a-custom');
      expect(found).toEqual({ ...area, name: 'Synthetic knee', archived: true });
    });

    it('SK-2 stores and clears a name override on a predefined area', async () => {
      const chin = (await repo.listAreas()).find((a) => a.id === 'area-chin')!;
      await repo.upsertArea({ ...chin, nameOverride: 'Synthetic jaw' });
      expect((await repo.listAreas()).find((a) => a.id === 'area-chin')?.nameOverride).toBe('Synthetic jaw');
      await repo.upsertArea({ ...chin, nameOverride: null });
      expect((await repo.listAreas()).find((a) => a.id === 'area-chin')?.nameOverride).toBeNull();
    });

    const custom = {
      id: 'a-custom',
      kind: 'skin' as const,
      name: 'Synthetic elbow',
      predefined: false,
      archived: false,
      sensitiveDefault: false,
      nameOverride: null,
    };

    it('EX-10 merge adds new rows and skips ids that already exist', async () => {
      await repo.addMeal(syntheticMeal('m1', '2026-01-10T08:00:00.000Z', ['original']));
      const payload = {
        records: {
          meals: [
            syntheticMeal('m1', '2026-01-10T08:00:00.000Z', ['changed', 'extra']),
            syntheticMeal('m2', '2026-01-11T08:00:00.000Z'),
          ],
          skinEntries: [syntheticEntry('e1', '2026-01-11T09:00:00.000Z')],
          nailEntries: [],
        },
        settings: { skinAreas: await repo.listAreas() },
      };
      await repo.importData(payload, 'merge');
      await repo.importData(payload, 'merge'); // idempotent
      const meals = await repo.listMeals();
      expect(meals.map((m) => m.id)).toEqual(['m2', 'm1']);
      expect(meals.find((m) => m.id === 'm1')?.ingredients).toEqual(['original']);
      expect(await repo.listSkinEntries()).toHaveLength(1);
    });

    it('EX-10 replace records wipes meals and entries but leaves areas untouched', async () => {
      await repo.upsertArea(custom);
      await repo.addMeal(syntheticMeal('old', '2026-01-01T08:00:00.000Z'));
      await repo.addSkinEntry(syntheticEntry('old-e', '2026-01-01T09:00:00.000Z', 'a-custom'));
      await repo.importData(
        { records: { meals: [syntheticMeal('new', '2026-01-02T08:00:00.000Z')], skinEntries: [], nailEntries: [] } },
        'replace',
      );
      expect((await repo.listMeals()).map((m) => m.id)).toEqual(['new']);
      expect(await repo.listSkinEntries()).toEqual([]);
      expect((await repo.listAreas()).some((a) => a.id === 'a-custom')).toBe(true);
    });

    it('EX-10 replace settings leaves records alone and overwrites areas by id', async () => {
      await repo.addMeal(syntheticMeal('keep', '2026-01-01T08:00:00.000Z'));
      const chin = (await repo.listAreas()).find((a) => a.id === 'area-chin')!;
      await repo.importData(
        { settings: { skinAreas: [{ ...chin, nameOverride: 'Synthetic jaw', archived: true }] } },
        'replace',
      );
      expect((await repo.listMeals()).map((m) => m.id)).toEqual(['keep']);
      expect((await repo.listAreas()).find((a) => a.id === 'area-chin')).toMatchObject({
        nameOverride: 'Synthetic jaw',
        archived: true,
      });
    });

    it('EX-10 replace settings drops unused user areas, keeps used ones and all predefined', async () => {
      await repo.upsertArea(custom);
      await repo.upsertArea({ ...custom, id: 'a-unused', name: 'Synthetic wrist' });
      await repo.addSkinEntry(syntheticEntry('e1', '2026-01-01T09:00:00.000Z', 'a-custom'));
      await repo.importData({ settings: { skinAreas: [] } }, 'replace');
      const ids = (await repo.listAreas()).map((a) => a.id);
      expect(ids).toContain('a-custom'); // still referenced by e1
      expect(ids).not.toContain('a-unused');
      expect(ids).toContain('area-chin');
      expect(ids).toHaveLength(7);
    });

    it('EX-10 merge settings adds new areas and keeps local versions of existing ones', async () => {
      const chin = (await repo.listAreas()).find((a) => a.id === 'area-chin')!;
      await repo.importData({ settings: { skinAreas: [{ ...chin, nameOverride: 'ignored' }, custom] } }, 'merge');
      const areas = await repo.listAreas();
      expect(areas.find((a) => a.id === 'area-chin')?.nameOverride).toBeNull();
      expect(areas.some((a) => a.id === 'a-custom')).toBe(true);
    });

    it('EX-10 import is atomic: a bad row leaves the store unchanged', async () => {
      await repo.addMeal(syntheticMeal('keep', '2026-01-01T08:00:00.000Z'));
      const broken = {
        records: {
          meals: [syntheticMeal('new', '2026-01-02T08:00:00.000Z')],
          skinEntries: [syntheticEntry('bad', '2026-01-02T09:00:00.000Z', 'missing-area')],
          nailEntries: [],
        },
      };
      await expect(repo.importData(broken, 'replace')).rejects.toThrow();
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
