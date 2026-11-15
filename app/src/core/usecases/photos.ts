import { NettleError } from '../model/errors';
import { makeStamp } from '../model/time';
import type { Photo, PhotoEntryKind } from '../model/types';
import type { Deps } from './deps';

export interface AddPhotoInput {
  entryKind: PhotoEntryKind;
  entryId: string;
  /** A picked or captured image on the device. */
  sourceUri: string;
  /** Overrides the area's default (SK-5). */
  sensitive?: boolean;
  at?: Date;
}

/** The area an entry belongs to, or an error when the entry does not exist. */
async function areaOfEntry(deps: Deps, kind: PhotoEntryKind, entryId: string) {
  const entry =
    kind === 'skinEntry'
      ? (await deps.repo.listSkinEntries()).find((e) => e.id === entryId)
      : (await deps.repo.listRecords('nailEntries')).find((e) => e.id === entryId);
  if (!entry) throw new NettleError('unknown_entry', entryId);
  const area = (await deps.repo.listAreas()).find((a) => a.id === entry.areaId);
  if (!area) throw new NettleError('unknown_area', entry.areaId);
  return area;
}

/**
 * SK-4, SK-5: attach a photo to a skin or nail entry. It is compressed and copied into private storage; its
 * sensitive flag starts from the area's default unless given. If saving the record fails the file is removed.
 */
export async function addPhoto(deps: Deps, input: AddPhotoInput): Promise<Photo> {
  const area = await areaOfEntry(deps, input.entryKind, input.entryId);
  let file: string;
  try {
    file = await deps.photos.saveFromUri(input.sourceUri);
  } catch {
    throw new NettleError('photo_failed');
  }
  const photo: Photo = {
    id: deps.ids(),
    at: makeStamp(deps.clock, input.at),
    entryKind: input.entryKind,
    entryId: input.entryId,
    sensitive: input.sensitive ?? area.sensitiveDefault,
    file,
  };
  try {
    await deps.repo.addRecord('photos', photo);
  } catch (e) {
    await deps.photos.remove(file);
    throw e;
  }
  return photo;
}

/**
 * SK-4: attach photos picked in a Skin or Nails form to the entry just saved, dated like the entry. A photo that
 * cannot be saved does not undo the entry or the other photos: the number that failed is returned.
 */
export async function attachPhotos(deps: Deps, entryKind: PhotoEntryKind, entryId: string, uris: readonly string[], at?: Date): Promise<{ saved: number; failed: number }> {
  let saved = 0;
  let failed = 0;
  for (const sourceUri of uris) {
    try {
      await addPhoto(deps, { entryKind, entryId, sourceUri, ...(at ? { at } : {}) });
      saved++;
    } catch {
      failed++;
    }
  }
  return { saved, failed };
}

async function findPhoto(deps: Deps, id: string): Promise<Photo> {
  const photo = (await deps.repo.listRecords('photos')).find((p) => p.id === id);
  if (!photo) throw new NettleError('unknown_photo', id);
  return photo;
}

/** SK-5: change the sensitive flag of one photo. */
export async function setPhotoSensitive(deps: Deps, id: string, sensitive: boolean): Promise<void> {
  await deps.repo.putRecord('photos', { ...(await findPhoto(deps, id)), sensitive });
}

/** Remove one photo: the record first (with a tombstone, EX-13, so a merge cannot bring it back), then its file. */
export async function removePhoto(deps: Deps, id: string): Promise<void> {
  const photo = await findPhoto(deps, id);
  await deps.repo.deleteWithTombstones({ photos: [id] }, makeStamp(deps.clock));
  await deps.photos.remove(photo.file);
}

/** Photos of one entry, oldest first. */
export async function listPhotos(deps: Deps, entryKind: PhotoEntryKind, entryId: string): Promise<Photo[]> {
  return (await deps.repo.listRecords('photos'))
    .filter((p) => p.entryKind === entryKind && p.entryId === entryId)
    .reverse();
}
