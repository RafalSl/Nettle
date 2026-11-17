import { NettleError } from '../model/errors';
import { CANONICAL_UTC } from '../model/time';
import { MAX_SIZE_MM } from '../model/types';

export type Obj = Record<string, unknown>;

export const bad = (detail: string): never => {
  throw new NettleError('import_invalid_data', detail);
};
export const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
export const str = (o: Obj, k: string, where: string): string =>
  typeof o[k] === 'string' && (o[k] as string).length > 0 ? (o[k] as string) : bad(`${where}.${k}`);
export const text = (o: Obj, k: string, where: string): string =>
  typeof o[k] === 'string' ? (o[k] as string) : bad(`${where}.${k}`);
export const bool = (o: Obj, k: string, where: string): boolean =>
  typeof o[k] === 'boolean' ? (o[k] as boolean) : bad(`${where}.${k}`);
export const nullableText = (o: Obj, k: string, where: string): string | null =>
  o[k] === null || o[k] === undefined ? null : text(o, k, where);
/** An IANA timezone the runtime knows: an unknown one would make every later day grouping throw. */
export const tz = (o: Obj, where: string): string => {
  const v = str(o, 'tz', where);
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: v });
    return v;
  } catch {
    return bad(`${where}.tz`);
  }
};
export const utc = (o: Obj, where: string): string => {
  const v = str(o, 'utc', where);
  return CANONICAL_UTC.test(v) && !Number.isNaN(Date.parse(v)) ? v : bad(`${where}.utc`);
};
export const list = (o: Obj, k: string): Obj[] => {
  const v = o[k];
  if (!Array.isArray(v)) return bad(k);
  return v.map((x, i) => (isObj(x) ? x : bad(`${k}[${i}]`)));
};
export const unique = (ids: string[], where: string) => {
  if (new Set(ids).size !== ids.length) bad(`${where} duplicate id`);
};

export const oneOf = <T extends string>(o: Obj, k: string, allowed: readonly T[], where: string): T =>
  typeof o[k] === 'string' && (allowed as readonly string[]).includes(o[k] as string)
    ? (o[k] as T)
    : bad(`${where}.${k}`);
export const nullableScore = (o: Obj, k: string, where: string): number | null => {
  const v = o[k];
  if (v === null) return null;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10 ? v : bad(`${where}.${k}`);
};
/** IN-20 / LL-15: an optional flag (fill_later, manual) that is only ever written as true; absent and false both mean no. */
export const optionalFlag = (o: Obj, k: string, where: string): boolean => (o[k] === undefined ? false : bool(o, k, where));
export const parseFillLater = (o: Obj, where: string): boolean => optionalFlag(o, 'fill_later', where);

/** SK-3: a size in whole millimetres from 1 to 500, or null. */
export const nullableSize = (o: Obj, k: string, where: string): number | null => {
  const v = o[k];
  if (v === null) return null;
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= MAX_SIZE_MM ? v : bad(`${where}.${k}`);
};
export const stringList = (o: Obj, k: string, where: string): string[] => {
  const v = o[k];
  return Array.isArray(v) && v.every((x) => typeof x === 'string' && x.length > 0) ? (v as string[]) : bad(`${where}.${k}`);
};
export const enumList = <T extends string>(o: Obj, k: string, allowed: readonly T[], where: string): T[] => {
  const v = o[k];
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || !(allowed as readonly string[]).includes(x))) {
    return bad(`${where}.${k}`);
  }
  return v as T[];
};
