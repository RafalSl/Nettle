import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { PhotoStore } from '@/core/ports/platform';

/** NF-5: long edge in pixels and JPEG quality for stored photos (a phone photo of 3 to 5 MB becomes a few hundred KB). */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.7;

/** SK-4, SE-7: photos live in the app's private document folder, never in the shared photo library. */
const dir = () => {
  const d = new Directory(Paths.document, 'photos');
  if (!d.exists) d.create();
  return d;
};

async function writeNew(bytes: Uint8Array): Promise<string> {
  const name = `${randomUUID()}.jpg`;
  const file = new File(dir(), name);
  file.create();
  await file.write(bytes);
  return name;
}

export const expoPhotoStore: PhotoStore = {
  async saveFromUri(sourceUri) {
    // Re-encoding through the manipulator also drops the original EXIF metadata, location included.
    const loaded = await ImageManipulator.manipulate(sourceUri).renderAsync();
    let context = ImageManipulator.manipulate(loaded);
    if (Math.max(loaded.width, loaded.height) > MAX_EDGE) {
      context = context.resize(loaded.width >= loaded.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
    }
    const out = await (await context.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
    const temp = new File(out.uri);
    try {
      return await writeNew(await temp.bytes());
    } finally {
      if (temp.exists) temp.delete();
    }
  },

  saveBytes: writeNew,

  async read(file) {
    return new File(dir(), file).bytes();
  },

  async remove(file) {
    const f = new File(dir(), file);
    if (f.exists) f.delete();
  },

  uri(file) {
    return new File(dir(), file).uri;
  },
};
