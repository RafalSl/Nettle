export type IdGenerator = () => string;

/** Cryptographically secure random bytes (expo-crypto in the app). */
export type RandomBytes = (length: number) => Uint8Array;

export interface Clock {
  now(): Date;
  /** IANA name, e.g. "Europe/Warsaw". */
  timeZone(): string;
}

/** EX-9 / EX-10: hand a file to the user, and let them pick one back. */
export interface FileShare {
  saveAndShare(fileName: string, bytes: Uint8Array, mimeType: string): Promise<void>;
  /** null when the user cancels. */
  pickFile(): Promise<Uint8Array | null>;
}

/**
 * SK-4, NF-5, SE-7: photos in the app's private storage. Photos never leave it except through an export or a
 * confirmed LLM run. Keys are opaque file names.
 */
export interface PhotoStore {
  /** Compress an image the user picked or took (NF-5) and copy it into private storage. Returns its key. */
  saveFromUri(sourceUri: string): Promise<string>;
  /** Compress an image to JPEG bytes without storing it, for a one-off upload such as IN-3. */
  compress(sourceUri: string, maxEdge?: number): Promise<Uint8Array>;
  /** Store already compressed JPEG bytes, for import (EX-10). Returns the key. */
  saveBytes(bytes: Uint8Array): Promise<string>;
  read(file: string): Promise<Uint8Array>;
  /** Missing files are ignored. */
  remove(file: string): Promise<void>;
  /** A URI the UI can show. */
  uri(file: string): string;
}
