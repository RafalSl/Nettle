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

/** The ZIP holds data.json only for now; photos/ and report.pdf arrive with SK-4 and EX-3. */
export function packBundle(data: DataJson, password?: string, randomBytes?: RandomBytes): Uint8Array {
  return writeZip({ [DATA_FILE]: strToU8(JSON.stringify(data, null, 2)) }, { password, randomBytes });
}

export function unpackBundle(bytes: Uint8Array, password?: string): Payload {
  const files = readZip(bytes, { names: [DATA_FILE], maxBytes: MAX_DATA_BYTES, password });
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
