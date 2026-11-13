import { strFromU8, strToU8 } from 'fflate';
import { NettleError } from '../model/errors';
import type { Payload } from '../model/types';
import type { RandomBytes } from '../ports/platform';
import type { DataJson } from './schema';
import { parseDataJson } from './validate';
import { readZip, writeZip } from './zip';

export const DATA_FILE = 'data.json';
/** Reject absurdly large data.json before parsing (zip-bomb guard). 50 MB is far above years of text-only diary data. */
const MAX_DATA_BYTES = 50 * 1024 * 1024;

export const PHOTO_DIR = 'photos/';
/** One photo may not inflate beyond this (zip-bomb guard); stored photos are a few hundred KB. */
const MAX_PHOTO_BYTES = 30 * 1024 * 1024;

/**
 * The ZIP holds data.json and, when photos are exported, photos/ (EX-2). Photos are JPEG already, so they are
 * stored without compression. report.pdf arrives with EX-3.
 */
export function packBundle(
  data: DataJson,
  photoFiles: Record<string, Uint8Array> = {},
  password?: string,
  randomBytes?: RandomBytes,
): Uint8Array {
  return writeZip(
    { [DATA_FILE]: strToU8(JSON.stringify(data, null, 2)), ...photoFiles },
    { password, randomBytes, stored: (name) => name.startsWith(PHOTO_DIR) },
  );
}

export interface UnpackedBundle {
  payload: Payload;
  /** Reads one photo by its path in data.json; undefined when the ZIP does not contain it. Reads on demand. */
  readPhoto: (path: string) => Uint8Array | undefined;
}

export function unpackBundle(bytes: Uint8Array, password?: string): UnpackedBundle {
  const files = readZip(bytes, { names: [DATA_FILE], maxBytes: MAX_DATA_BYTES, password });
  const file = files[DATA_FILE];
  if (!file) throw new NettleError('import_missing_data');
  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(file));
  } catch {
    throw new NettleError('import_invalid_json');
  }
  return {
    payload: parseDataJson(parsed),
    readPhoto: (path) => readZip(bytes, { names: [path], maxBytes: MAX_PHOTO_BYTES, password })[path],
  };
}
