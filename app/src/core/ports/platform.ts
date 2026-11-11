export type IdGenerator = () => string;

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
