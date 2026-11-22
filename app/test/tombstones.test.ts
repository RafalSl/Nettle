import { SqliteRepo } from '@/adapters/storage/sqliteRepo';
import type { StorageRepository } from '@/core/ports/storage';
import { deleteData } from '@/core/usecases/deleteData';
import { deleteEntry } from '@/core/usecases/entries';
import { applyImport, exportBundle, previewImport } from '@/core/usecases/exchange';
import { logReaction } from '@/core/usecases/events';
import { logMeal } from '@/core/usecases/logMeal';
import { addPhoto } from '@/core/usecases/photos';
import { logSkinEntry } from '@/core/usecases/skin';
import { MemoryPhotoStore } from './fakes/memoryPhotoStore';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';
import { createNodeSqliteDb } from './helpers/nodeSqliteDb';

const repos: [string, () => Promise<StorageRepository>][] = [
  ['in-memory', async () => new MemoryRepo()],
  ['sqlite', async () => SqliteRepo.open(createNodeSqliteDb())],
];
const both = { records: true, settings: true };
const scores = { severity: 1, itch: 2, pain: 3, dryness: 4, scaling: 5 };
const d = (iso: string) => new Date(iso);

describe.each(repos)('tombstones in export and import (%s)', (_name, make) => {
  /** Phone A logs a meal with a reaction and a skin entry with a photo, then backs everything up. */
  async function setup() {
    const a = makeDeps(await make());
    const meal = await logMeal(a, { description: 'Synthetic oats', ingredients: ['oats'], at: d('2026-01-15T08:00:00.000Z') });
    const reaction = await logReaction(a, { mealId: meal.id, symptoms: ['hives'], at: d('2026-01-15T09:00:00.000Z') });
    const entry = await logSkinEntry(a, { areaId: 'area-chin', scores, at: d('2026-01-15T10:00:00.000Z') });
    const photo = await addPhoto(a, { entryKind: 'skinEntry', entryId: entry.id, sourceUri: 'pic', sensitive: false });
    const backup = await exportBundle(a, { parts: both, photos: { mode: 'all' } });
    // Phone B is the same diary restored from that backup.
    const b = makeDeps(await make(), '2026-02-01T10:00:00.000Z');
    await applyImport(b, await previewImport(b, backup), { mode: 'replace', parts: both });
    return { a, b, meal, reaction, entry, photo, backup };
  }
  const ids = async (repo: StorageRepository) => ({
    meals: (await repo.listRecords('meals')).map((m) => m.id),
    reactions: (await repo.listRecords('reactions')).map((r) => r.id),
    skin: (await repo.listRecords('skinEntries')).map((e) => e.id),
    photos: (await repo.listRecords('photos')).map((p) => p.id),
  });

  it('EX-1, EX-13 data.json lists the deleted entries in a tombstones section of the records', async () => {
    const { a, meal, reaction } = await setup();
    await deleteEntry(a, 'meals', meal.id);
    const parsed = await previewImport(a, await exportBundle(a, { parts: both }));
    expect(parsed.payload.tombstones?.map((t) => [t.id, t.kind]).sort()).toEqual(
      [
        [meal.id, 'meals'],
        [reaction.id, 'reactions'],
      ].sort(),
    );
    expect(parsed.payload.tombstones?.[0]?.deletedAt).toEqual({ utc: '2026-01-15T10:00:00.000Z', tz: 'Europe/Warsaw' });
  });

  it('EX-13 a merge never restores an entry with a local tombstone, nor the reactions of a deleted meal', async () => {
    const { b, meal, reaction, backup } = await setup();
    await deleteEntry(b, 'meals', meal.id);
    const parsed = await previewImport(b, backup);
    expect(parsed.preview.tombstones).toEqual({ skipped: 2, restorable: 2, removesLocal: 0 });
    await applyImport(b, parsed, { mode: 'merge', parts: both });
    expect((await ids(b.repo)).meals).toEqual([]);
    expect((await ids(b.repo)).reactions).toEqual([]);
    expect((await b.repo.listTombstones()).map((t) => t.id).sort()).toEqual([meal.id, reaction.id].sort());
  });

  it('EX-10 the restore switch brings back skipped entries and removes their tombstones', async () => {
    const { b, meal, reaction, backup } = await setup();
    await deleteEntry(b, 'meals', meal.id);
    await applyImport(b, await previewImport(b, backup), { mode: 'merge', parts: both, restoreTombstoned: true });
    const now = await ids(b.repo);
    expect(now.meals).toEqual([meal.id]);
    expect(now.reactions).toEqual([reaction.id]);
    expect(await b.repo.listTombstones()).toEqual([]);
  });

  it('EX-13 an incoming tombstone deletes the local entry with its reactions, photos and photo files', async () => {
    const { a, b, meal, entry, photo } = await setup();
    await deleteEntry(a, 'meals', meal.id);
    await deleteEntry(a, 'skinEntries', entry.id);
    const bFile = (await b.repo.listRecords('photos'))[0]!.file;
    const store = b.photos as MemoryPhotoStore;
    expect(await store.read(bFile)).toBeDefined();
    const parsed = await previewImport(b, await exportBundle(a, { parts: both }));
    expect(parsed.preview.tombstones.removesLocal).toBe(4); // meal, reaction, skin entry, photo
    await applyImport(b, parsed, { mode: 'merge', parts: both });
    expect(await ids(b.repo)).toEqual({ meals: [], reactions: [], skin: [], photos: [] });
    await expect(store.read(bFile)).rejects.toThrow();
    expect((await b.repo.listTombstones()).map((t) => t.id)).toContain(photo.id);
  });

  it('EX-10, EX-13 replace brings back everything in the file and takes its tombstones, dropping the local ones', async () => {
    const { b, meal, backup } = await setup();
    await deleteEntry(b, 'meals', meal.id);
    expect((await b.repo.listTombstones()).length).toBe(2);
    await applyImport(b, await previewImport(b, backup), { mode: 'replace', parts: both });
    expect((await ids(b.repo)).meals).toEqual([meal.id]);
    expect(await b.repo.listTombstones()).toEqual([]);
  });

  it('SE-9, EX-13 bulk delete leaves no tombstones, so a restore from a backup is a plain merge', async () => {
    const { b, meal, backup } = await setup();
    await deleteData(b, { kinds: ['meals', 'reactions'] });
    expect(await b.repo.listTombstones()).toEqual([]);
    const parsed = await previewImport(b, backup);
    expect(parsed.preview.tombstones.skipped).toBe(0);
    await applyImport(b, parsed, { mode: 'merge', parts: both });
    expect((await ids(b.repo)).meals).toEqual([meal.id]);
  });

  it('EX-10 importing settings only leaves tombstones and entries alone', async () => {
    const { b, meal, backup } = await setup();
    await deleteEntry(b, 'meals', meal.id);
    await applyImport(b, await previewImport(b, backup), { mode: 'merge', parts: { records: false, settings: true } });
    expect((await ids(b.repo)).meals).toEqual([]);
    expect((await b.repo.listTombstones()).length).toBe(2);
  });
});
