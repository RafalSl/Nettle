import type { PhotoStore } from '@/core/ports/platform';

/** In-memory photo store. A source "uri" is read as the text to store, so tests can make distinct photos. */
export class MemoryPhotoStore implements PhotoStore {
  files = new Map<string, Uint8Array>();
  failNextSave = false;
  private n = 0;

  private put(bytes: Uint8Array) {
    const name = `p${++this.n}.jpg`;
    this.files.set(name, bytes);
    return name;
  }
  async saveFromUri(sourceUri: string) {
    if (this.failNextSave) {
      this.failNextSave = false;
      throw new Error('disk full');
    }
    return this.put(new TextEncoder().encode(sourceUri));
  }
  async compress(sourceUri: string) {
    // A stored photo's uri gives back its content, like re-reading and shrinking the real file.
    const stored = sourceUri.startsWith('memory://') ? this.files.get(sourceUri.slice('memory://'.length)) : undefined;
    return stored ? stored.slice() : new TextEncoder().encode(sourceUri);
  }
  async saveBytes(bytes: Uint8Array) {
    return this.put(bytes.slice());
  }
  async read(file: string) {
    const b = this.files.get(file);
    if (!b) throw new Error('missing file');
    return b.slice();
  }
  async remove(file: string) {
    this.files.delete(file);
  }
  uri(file: string) {
    return `memory://${file}`;
  }
}
