import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { NettleError } from '../model/errors';
import type { Payload } from '../model/types';
import type { DataJson } from './schema';
import { parseDataJson } from './validate';

export const DATA_FILE = 'data.json';
/** Reject absurdly large data.json before parsing (zip-bomb guard). 50 MB is far above years of text-only diary data. */
const MAX_DATA_BYTES = 50 * 1024 * 1024;

/** The ZIP holds data.json only for now; photos/ and report.pdf arrive with SK-4 and EX-3. */
export function packBundle(data: DataJson): Uint8Array {
  return zipSync({ [DATA_FILE]: strToU8(JSON.stringify(data, null, 2)) });
}

export function unpackBundle(bytes: Uint8Array): Payload {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => f.name === DATA_FILE && f.originalSize <= MAX_DATA_BYTES });
  } catch {
    throw new NettleError('import_corrupt_zip');
  }
  const file = files[DATA_FILE];
  if (!file) throw new NettleError('import_missing_data');
  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(file));
  } catch {
    throw new NettleError('import_invalid_json');
  }
  return parseDataJson(parsed);
}
