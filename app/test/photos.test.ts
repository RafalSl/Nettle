import { SqliteRepo } from '@/adapters/storage/sqliteRepo';
import { NettleError } from '@/core/model/errors';
import type { StorageRepository } from '@/core/ports/storage';
import { deleteData } from '@/core/usecases/deleteData';
import { addPhoto, attachPhotos, listPhotos, removePhoto, setPhotoSensitive } from '@/core/usecases/photos';
import { addArea, logNailEntry, logSkinEntry } from '@/core/usecases/skin';
import { MemoryPhotoStore } from './fakes/memoryPhotoStore';
import { MemoryRepo } from './fakes/memoryRepo';
import { createNodeSqliteDb } from './helpers/nodeSqliteDb';
import { makeDeps } from './helpers/fixtures';

const repos: [string, () => Promise<StorageRepository>][] = [
  ['in-memory', async () => new MemoryRepo()],
  ['sqlite', async () => SqliteRepo.open(createNodeSqliteDb())],
];
const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );
const scores = { severity: 1, itch: 2, pain: 3, dryness: 4, scaling: 5 };

describe.each(repos)('photos (%s)', (_name, make) => {
  async function setup() {
    const repo = await make();
    const deps = makeDeps(repo);
    const store = deps.photos as MemoryPhotoStore;
    return { repo, deps, store };
  }

  it('SK-4 attaches several photos to one skin entry, in the order they were added', async () => {
    const { deps, store } = await setup();
    const entry = await logSkinEntry(deps, { areaId: 'area-chin', scores });
    const a = await addPhoto(deps, { entryKind: 'skinEntry', entryId: entry.id, sourceUri: 'one', at: new Date('2026-01-15T10:00:00.000Z') });
    const b = await addPhoto(deps, { entryKind: 'skinEntry', entryId: entry.id, sourceUri: 'two', at: new Date('2026-01-15T10:05:00.000Z') });
    expect((await listPhotos(deps, 'skinEntry', entry.id)).map((p) => p.id)).toEqual([a.id, b.id]);
    expect(new TextDecoder().decode(await store.read(a.file))).toBe('one');
    expect(await listPhotos(deps, 'nailEntry', entry.id)).toEqual([]);
  });

  it('SK-4 attaches a photo to a nail entry', async () => {
    const { deps } = await setup();
    const nail = await addArea(deps, 'Synthetic thumb', 'nail');
    const entry = await logNailEntry(deps, { areaId: nail.id, stage: 'white', extent: 'none' });
    const p = await addPhoto(deps, { entryKind: 'nailEntry', entryId: entry.id, sourceUri: 'nail' });
    expect(p).toMatchObject({ entryKind: 'nailEntry', entryId: entry.id, sensitive: false });
  });

  it('SK-5 the sensitive flag starts from the area default and can be overridden per photo', async () => {
    const { deps } = await setup();
    const intimate = await logSkinEntry(deps, { areaId: 'area-intimate', scores });
    const chin = await logSkinEntry(deps, { areaId: 'area-chin', scores });
    const a = await addPhoto(deps, { entryKind: 'skinEntry', entryId: intimate.id, sourceUri: 'a' });
    const b = await addPhoto(deps, { entryKind: 'skinEntry', entryId: intimate.id, sourceUri: 'b', sensitive: false });
    const c = await addPhoto(deps, { entryKind: 'skinEntry', entryId: chin.id, sourceUri: 'c' });
    expect([a.sensitive, b.sensitive, c.sensitive]).toEqual([true, false, false]);
    await setPhotoSensitive(deps, c.id, true);
    expect((await listPhotos(deps, 'skinEntry', chin.id))[0]?.sensitive).toBe(true);
    expect(await code(setPhotoSensitive(deps, 'nope', true))).toBe('unknown_photo');
  });

  it('SK-4 refuses an unknown entry without storing a file', async () => {
    const { deps, store } = await setup();
    expect(await code(addPhoto(deps, { entryKind: 'skinEntry', entryId: 'nope', sourceUri: 'x' }))).toBe('unknown_entry');
    expect(store.files.size).toBe(0);
  });

  it('NF-3 a failed save changes nothing and reports photo_failed', async () => {
    const { deps, repo, store } = await setup();
    const entry = await logSkinEntry(deps, { areaId: 'area-chin', scores });
    store.failNextSave = true;
    expect(await code(addPhoto(deps, { entryKind: 'skinEntry', entryId: entry.id, sourceUri: 'x' }))).toBe('photo_failed');
    expect(await repo.listRecords('photos')).toEqual([]);
    expect(store.files.size).toBe(0);
  });

  it('SK-4 photos picked in a form are attached to the saved entry, dated like it; a failed one does not undo the rest', async () => {
    const { deps, repo, store } = await setup();
    const at = new Date('2026-01-10T08:00:00.000Z');
    const entry = await logSkinEntry(deps, { areaId: 'area-chin', scores, at });
    expect(await attachPhotos(deps, 'skinEntry', entry.id, ['a', 'b'], at)).toEqual({ saved: 2, failed: 0 });
    expect((await repo.listRecords('photos')).map((p) => p.at.utc)).toEqual([at.toISOString(), at.toISOString()]);
    store.failNextSave = true;
    expect(await attachPhotos(deps, 'skinEntry', entry.id, ['c', 'd'])).toEqual({ saved: 1, failed: 1 });
    expect(await attachPhotos(deps, 'skinEntry', entry.id, [])).toEqual({ saved: 0, failed: 0 });
    expect(await repo.listRecords('photos')).toHaveLength(3);
  });

  it('SK-4 removing a photo removes its record and its file', async () => {
    const { deps, repo, store } = await setup();
    const entry = await logSkinEntry(deps, { areaId: 'area-chin', scores });
    const a = await addPhoto(deps, { entryKind: 'skinEntry', entryId: entry.id, sourceUri: 'a' });
    const b = await addPhoto(deps, { entryKind: 'skinEntry', entryId: entry.id, sourceUri: 'b' });
    await removePhoto(deps, a.id);
    expect((await repo.listRecords('photos')).map((p) => p.id)).toEqual([b.id]);
    expect([...store.files.keys()]).toEqual([b.file]);
    expect(await code(removePhoto(deps, a.id))).toBe('unknown_photo');
  });

  it('SE-9 deleting an entry deletes its photos and their files, and no others', async () => {
    const { deps, repo, store } = await setup();
    const e1 = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-10T08:00:00.000Z') });
    const e2 = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-12T08:00:00.000Z') });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: e1.id, sourceUri: 'old' });
    const keep = await addPhoto(deps, { entryKind: 'skinEntry', entryId: e2.id, sourceUri: 'new' });
    const counts = await deleteData(deps, { kinds: ['skinEntries'], range: { to: '2026-01-11T00:00:00.000Z' } });
    expect(counts).toMatchObject({ skinEntries: 1, photos: 1 });
    expect((await repo.listRecords('photos')).map((p) => p.id)).toEqual([keep.id]);
    expect([...store.files.keys()]).toEqual([keep.file]);
  });

  it('SE-9 deleting all photos by kind leaves the entries', async () => {
    const { deps, repo, store } = await setup();
    const e = await logSkinEntry(deps, { areaId: 'area-chin', scores });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: e.id, sourceUri: 'x' });
    await deleteData(deps, { kinds: ['photos'] });
    expect(store.files.size).toBe(0);
    expect(await repo.listSkinEntries()).toHaveLength(1);
  });
});

describe('removing a photo leaves a tombstone (EN-1, EX-13)', () => {
  it('EX-13 a removed photo has a tombstone, so a merge cannot bring it back', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    const entry = await logSkinEntry(deps, { areaId: 'area-chin', scores });
    const photo = await addPhoto(deps, { entryKind: 'skinEntry', entryId: entry.id, sourceUri: 'x' });
    await removePhoto(deps, photo.id);
    expect(await repo.listTombstones()).toMatchObject([{ id: photo.id, kind: 'photos' }]);
    expect(await repo.listRecords('photos')).toEqual([]);
  });
});
