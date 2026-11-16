import { PREDEFINED_AREAS } from '@/core/model/areas';
import type { StorageRepository } from '@/core/ports/storage';
import { noExtra, noItems, syntheticCheckIn, syntheticEntry, syntheticMeal, syntheticNailEntry, syntheticStool } from '../helpers/fixtures';

/** Behaviour every StorageRepository must have; run against the fake and the SQLite adapter. */
export function storageContract(name: string, make: () => Promise<StorageRepository>) {
  describe(`${name} storage contract`, () => {
    let repo: StorageRepository;
    beforeEach(async () => {
      repo = await make();
    });

    it('SK-1, SK-5 seeds the eight predefined areas; the three intimate ones are sensitive by default and there is no single intimate area', async () => {
      const areas = await repo.listAreas();
      expect(areas.map((a) => a.id).sort()).toEqual([
        'area-behind-ears',
        'area-between-buttocks',
        'area-chin',
        'area-ears-inside',
        'area-neck',
        'area-penis',
        'area-perineum-groin',
        'area-sternum',
      ]);
      expect(areas.filter((a) => a.sensitiveDefault).map((a) => a.id).sort()).toEqual(['area-between-buttocks', 'area-penis', 'area-perineum-groin']);
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
      await repo.importData({ settings: { skinAreas: [], ...noItems } }, 'replace');
      const ids = (await repo.listAreas()).map((a) => a.id);
      expect(ids).toContain('a-nail');
      expect(ids).not.toContain('a-nail-unused');
      await repo.importData({ records: { meals: [], skinEntries: [], ...noExtra } }, 'replace');
      expect(await repo.listRecords('nailEntries')).toEqual([]);
    });

    const myTag = { id: 'tag-mine', name: 'Synthetic tag', predefined: false, archived: false, nameOverride: null, valueKind: 'yesno' as const, description: null };

    it('IN-6, SK-7 seeds fourteen predefined Daily health items and stores user tags', async () => {
      const seeded = await repo.listItems('dailyItems');
      expect(seeded).toHaveLength(14);
      expect(seeded.every((t) => t.predefined)).toBe(true);
      await repo.upsertItem('dailyItems', myTag);
      await repo.upsertItem('dailyItems', { ...myTag, name: 'Renamed', archived: true });
      expect((await repo.listItems('dailyItems')).find((t) => t.id === 'tag-mine')).toEqual({ ...myTag, name: 'Renamed', archived: true });
    });

    it('SK-7 stores a Daily health record keyed by item id, and replaces it by id', async () => {
      const c = syntheticCheckIn('c1', '2026-01-15T20:00:00.000Z', '2026-01-15', ['tag-travel']);
      await repo.addRecord('checkIns', c);
      expect(await repo.listRecords('checkIns')).toEqual([c]);
      await expect(repo.addRecord('checkIns', c)).rejects.toThrow();
      const open = { ...c, values: { 'item-stress': 9 } };
      await repo.putRecord('checkIns', open);
      expect(await repo.listRecords('checkIns')).toEqual([open]);
      await repo.putRecord('checkIns', syntheticCheckIn('c2', '2026-01-16T20:00:00.000Z', '2026-01-16'));
      expect((await repo.listRecords('checkIns')).map((x) => x.id)).toEqual(['c2', 'c1']);
    });

    it('EX-10 replace settings keeps a user tag that a check-in uses and drops an unused one', async () => {
      await repo.upsertItem('dailyItems', myTag);
      await repo.upsertItem('dailyItems', { ...myTag, id: 'tag-unused' });
      await repo.addRecord('checkIns', syntheticCheckIn('c1', '2026-01-15T20:00:00.000Z', '2026-01-15', ['tag-mine']));
      await repo.importData({ settings: { skinAreas: [], ...noItems } }, 'replace');
      const ids = (await repo.listItems('dailyItems')).map((t) => t.id);
      expect(ids).toContain('tag-mine');
      expect(ids).not.toContain('tag-unused');
      expect(ids).toHaveLength(15); // fourteen predefined always stay
    });

    it('EX-10 merge settings keeps local tag values; replace overwrites by id and re-seeds predefined tags', async () => {
      const travel = (await repo.listItems('dailyItems')).find((t) => t.id === 'tag-travel')!;
      await repo.importData({ settings: { skinAreas: [], ...noItems, dailyItems: [{ ...travel, nameOverride: 'ignored' }] } }, 'merge');
      expect((await repo.listItems('dailyItems')).find((t) => t.id === 'tag-travel')?.nameOverride).toBeNull();
      await repo.importData({ settings: { skinAreas: [], ...noItems, dailyItems: [{ ...travel, nameOverride: 'Trip', archived: true }] } }, 'replace');
      expect((await repo.listItems('dailyItems')).find((t) => t.id === 'tag-travel')).toMatchObject({ nameOverride: 'Trip', archived: true });
    });

    it('IN-10 stores allergen tags on a meal', async () => {
      const meal = { ...syntheticMeal('m1', '2026-01-15T08:00:00.000Z'), allergens: ['milk' as const, 'sesame' as const] };
      await repo.addMeal(meal);
      expect(await repo.listMeals()).toEqual([meal]);
    });

    it('IN-11 stores a treatment list and applications with several areas', async () => {
      await repo.upsertItem('treatments', { id: 'tr1', name: 'Synthetic cream', predefined: false, archived: false, nameOverride: null, valueKind: 'yesno' as const, description: null });
      expect(await repo.listItems('treatments')).toHaveLength(1);
      const app = { id: 'ta1', at: { utc: '2026-01-15T07:00:00.000Z', tz: 'Europe/Warsaw' }, treatmentId: 'tr1', areaIds: ['area-chin', 'area-neck'], note: null };
      await repo.addRecord('treatmentApplications', app);
      expect(await repo.listRecords('treatmentApplications')).toEqual([app]);
    });

    it('IN-12 stores change events', async () => {
      const e = { id: 'ce1', at: { utc: '2026-01-10T00:00:00.000Z', tz: 'UTC' }, action: 'stopped' as const, category: 'cat-diet', name: 'Synthetic diet', dateUnknown: true, note: 'n' };
      await repo.addRecord('changeEvents', e);
      expect(await repo.listRecords('changeEvents')).toEqual([e]);
    });

    it('IN-13 stores a reaction linked to its meal and refuses an unknown meal', async () => {
      await repo.addMeal(syntheticMeal('m1', '2026-01-15T12:00:00.000Z'));
      const r = { id: 'r1', at: { utc: '2026-01-15T13:00:00.000Z', tz: 'UTC' }, mealId: 'm1', symptoms: ['hives' as const, 'swelling' as const], note: null };
      await repo.addRecord('reactions', r);
      expect(await repo.listRecords('reactions')).toEqual([r]);
      await expect(repo.addRecord('reactions', { ...r, id: 'r2', mealId: 'nope' })).rejects.toThrow();
    });

    it('EX-10 replace records wipes reactions together with their meals', async () => {
      await repo.addMeal(syntheticMeal('m1', '2026-01-15T12:00:00.000Z'));
      await repo.addRecord('reactions', { id: 'r1', at: { utc: '2026-01-15T13:00:00.000Z', tz: 'UTC' }, mealId: 'm1', symptoms: ['hives'], note: null });
      await repo.importData({ records: { meals: [syntheticMeal('m9', '2026-02-01T12:00:00.000Z')], skinEntries: [], ...noExtra } }, 'replace');
      expect(await repo.listRecords('reactions')).toEqual([]);
      expect((await repo.listMeals()).map((m) => m.id)).toEqual(['m9']);
    });

    it('EX-10 replace settings keeps a treatment that an application uses', async () => {
      await repo.upsertItem('treatments', { id: 'tr1', name: 'Synthetic cream', predefined: false, archived: false, nameOverride: null, valueKind: 'yesno' as const, description: null });
      await repo.upsertItem('treatments', { id: 'tr2', name: 'Unused', predefined: false, archived: false, nameOverride: null, valueKind: 'yesno' as const, description: null });
      await repo.addRecord('treatmentApplications', { id: 'ta1', at: { utc: '2026-01-15T07:00:00.000Z', tz: 'UTC' }, treatmentId: 'tr1', areaIds: ['area-chin'], note: null });
      await repo.importData({ settings: { skinAreas: [], ...noItems } }, 'replace');
      expect((await repo.listItems('treatments')).map((t) => t.id)).toEqual(['tr1']);
    });

    it('EX-10 replace records wipes check-ins and stool entries', async () => {
      await repo.addRecord('checkIns', syntheticCheckIn('c1', '2026-01-15T20:00:00.000Z', '2026-01-15'));
      await repo.addRecord('stoolEntries', syntheticStool('s1', '2026-01-15T07:00:00.000Z'));
      await repo.importData({ records: { meals: [], skinEntries: [], ...noExtra } }, 'replace');
      expect(await repo.listRecords('checkIns')).toEqual([]);
      expect(await repo.listRecords('stoolEntries')).toEqual([]);
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
          ...noExtra,
        },
        settings: { skinAreas: await repo.listAreas(), ...noItems },
      };
      await repo.importData(payload, 'merge');
      await repo.importData(payload, 'merge'); // idempotent
      const meals = await repo.listMeals();
      expect(meals.map((m) => m.id)).toEqual(['m2', 'm1']);
      expect(meals.find((m) => m.id === 'm1')?.ingredients).toEqual(['original']);
      expect(await repo.listSkinEntries()).toHaveLength(1);
    });

    it('EX-10 merge leaves an existing meal without ingredients as it is', async () => {
      await repo.addMeal(syntheticMeal('m1', '2026-01-10T08:00:00.000Z', []));
      await repo.addMeal(syntheticMeal('m2', '2026-01-11T08:00:00.000Z', ['kept', 'order']));
      const payload = {
        records: { meals: [syntheticMeal('m1', '2026-01-10T08:00:00.000Z', ['from file']), syntheticMeal('m3', '2026-01-12T08:00:00.000Z', ['new'])], skinEntries: [], ...noExtra },
        settings: { skinAreas: await repo.listAreas(), ...noItems },
      };
      await repo.importData(payload, 'merge');
      const byId = new Map((await repo.listMeals()).map((m) => [m.id, m.ingredients]));
      expect(byId.get('m1')).toEqual([]);
      expect(byId.get('m3')).toEqual(['new']);
      const ranged = await repo.listMeals({ from: '2026-01-11T00:00:00.000Z', to: '2026-01-11T23:59:59.000Z' });
      expect(ranged.map((m) => [m.id, m.ingredients])).toEqual([['m2', ['kept', 'order']]]);
    });

    it('EX-10 replace records wipes meals and entries but leaves areas untouched', async () => {
      await repo.upsertArea(custom);
      await repo.addMeal(syntheticMeal('old', '2026-01-01T08:00:00.000Z'));
      await repo.addSkinEntry(syntheticEntry('old-e', '2026-01-01T09:00:00.000Z', 'a-custom'));
      await repo.importData(
        { records: { meals: [syntheticMeal('new', '2026-01-02T08:00:00.000Z')], skinEntries: [], ...noExtra } },
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
        { settings: { skinAreas: [{ ...chin, nameOverride: 'Synthetic jaw', archived: true }], ...noItems } },
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
      await repo.importData({ settings: { skinAreas: [], ...noItems } }, 'replace');
      const ids = (await repo.listAreas()).map((a) => a.id);
      expect(ids).toContain('a-custom'); // still referenced by e1
      expect(ids).not.toContain('a-unused');
      expect(ids).toContain('area-chin');
      expect(ids).toHaveLength(PREDEFINED_AREAS.length + 1);
    });

    it('EX-10 merge settings adds new areas and keeps local versions of existing ones', async () => {
      const chin = (await repo.listAreas()).find((a) => a.id === 'area-chin')!;
      await repo.importData({ settings: { skinAreas: [{ ...chin, nameOverride: 'ignored' }, custom], ...noItems } }, 'merge');
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
          ...noExtra,
        },
      };
      await expect(repo.importData(broken, 'replace')).rejects.toThrow();
      expect((await repo.listMeals()).map((m) => m.id)).toEqual(['keep']);
    });

    it('EN-1 putMeal replaces description, time, tags and ingredients in order, keeping the id', async () => {
      await repo.addMeal(syntheticMeal('m1', '2026-01-15T08:00:00.000Z', ['a', 'b', 'c']));
      const edited = {
        ...syntheticMeal('m1', '2026-01-15T09:30:00.000Z', ['z', 'a']),
        description: 'Synthetic edited meal',
        allergens: ['milk' as const],
        note: 'edited',
      };
      await repo.putMeal(edited);
      expect(await repo.listMeals()).toEqual([edited]);
    });

    it('EN-1 putMeal and putSkinEntry refuse an id that does not exist', async () => {
      await expect(repo.putMeal(syntheticMeal('nope', '2026-01-15T08:00:00.000Z'))).rejects.toThrow();
      await expect(repo.putSkinEntry(syntheticEntry('nope', '2026-01-15T08:00:00.000Z'))).rejects.toThrow();
    });

    it('EN-1 putSkinEntry replaces scores, area and time, and refuses an unknown area', async () => {
      await repo.addSkinEntry(syntheticEntry('e1', '2026-01-15T08:00:00.000Z', 'area-neck'));
      const edited = {
        ...syntheticEntry('e1', '2026-01-15T10:00:00.000Z', 'area-chin'),
        scores: { severity: 1, itch: 2, pain: 3, dryness: 4, scaling: 5 },
        note: 'edited',
      };
      await repo.putSkinEntry(edited);
      expect(await repo.listSkinEntries()).toEqual([edited]);
      await expect(repo.putSkinEntry({ ...edited, areaId: 'nope' })).rejects.toThrow();
      expect(await repo.listSkinEntries()).toEqual([edited]);
    });

    const at = { utc: '2026-03-01T12:00:00.000Z', tz: 'Europe/Warsaw' };

    it('EX-13 deleteWithTombstones removes the records and stores id, kind and time of each', async () => {
      await repo.addMeal(syntheticMeal('m1', '2026-01-15T08:00:00.000Z'));
      await repo.addSkinEntry(syntheticEntry('e1', '2026-01-15T08:00:00.000Z'));
      await repo.addRecord('stoolEntries', syntheticStool('s1', '2026-01-15T09:00:00.000Z'));
      await repo.deleteWithTombstones({ meals: ['m1'], stoolEntries: ['s1'] }, at);
      expect(await repo.listMeals()).toEqual([]);
      expect(await repo.listRecords('stoolEntries')).toEqual([]);
      expect((await repo.listSkinEntries()).map((e) => e.id)).toEqual(['e1']);
      expect(await repo.listTombstones()).toEqual([
        { id: 'm1', kind: 'meals', deletedAt: at },
        { id: 's1', kind: 'stoolEntries', deletedAt: at },
      ]);
    });

    it('EX-13 ids that do not exist get no tombstone, and deleting twice stores one', async () => {
      await repo.addMeal(syntheticMeal('m1', '2026-01-15T08:00:00.000Z'));
      await repo.deleteWithTombstones({ meals: ['m1', 'ghost'] }, at);
      await repo.deleteWithTombstones({ meals: ['m1'] }, { ...at, utc: '2026-03-02T12:00:00.000Z' });
      expect(await repo.listTombstones()).toEqual([{ id: 'm1', kind: 'meals', deletedAt: at }]);
    });

    it('SE-9, EX-13 bulk delete leaves no tombstones', async () => {
      await repo.addMeal(syntheticMeal('m1', '2026-01-15T08:00:00.000Z'));
      await repo.deleteRecords({ meals: ['m1'] });
      expect(await repo.listTombstones()).toEqual([]);
    });

    it('EX-1 snapshot filters entries by range but always includes all areas', async () => {
      await repo.addMeal(syntheticMeal('m1', '2026-01-01T08:00:00.000Z'));
      await repo.addMeal(syntheticMeal('m2', '2026-02-01T08:00:00.000Z'));
      const snap = await repo.snapshot({ from: '2026-01-15T00:00:00.000Z' });
      expect(snap.meals.map((m) => m.id)).toEqual(['m2']);
      expect(snap.skinAreas).toHaveLength(PREDEFINED_AREAS.length);
    });
  });
}
