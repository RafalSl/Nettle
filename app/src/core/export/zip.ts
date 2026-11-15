import { ecb } from '@noble/ciphers/aes.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha1 } from '@noble/hashes/legacy.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { inflateSync, strFromU8, strToU8, deflateSync, zipSync } from 'fflate';
import { NettleError } from '../model/errors';
import type { RandomBytes } from '../ports/platform';

/**
 * ZIP container with optional WinZip AES-256 (AE-2) encryption (EX-6), in pure JS so it runs in Expo Go.
 * Spike and interop checks against 7-Zip: docs/spikes/aes-zip.md.
 * Format limits: file names stay readable, and PBKDF2 uses a fixed 1000 rounds, so passphrases must be long.
 */

/** Long passphrase required because the format fixes key derivation at 1000 rounds. */
export const MIN_PASSWORD_LENGTH = 12;

const SALT_LEN = 16; // AES-256
const KEY_LEN = 32;
const AES_METHOD = 99;
const BLOCKS_PER_CHUNK = 4096; // 64 KiB of keystream per AES call

function deriveKeys(password: string, salt: Uint8Array) {
  const out = pbkdf2(sha1, strToU8(password), salt, { c: 1000, dkLen: 2 * KEY_LEN + 2 });
  return {
    encKey: out.subarray(0, KEY_LEN),
    macKey: out.subarray(KEY_LEN, 2 * KEY_LEN),
    verifier: out.subarray(2 * KEY_LEN),
  };
}

/** WinZip AES-CTR: little-endian counter from 1 (noble's own CTR is big-endian), built on AES-ECB over counter blocks. */
function ctrXor(encKey: Uint8Array, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  const counters = new Uint8Array(BLOCKS_PER_CHUNK * 16);
  let counter = 1;
  for (let off = 0; off < data.length; off += counters.length) {
    const len = Math.min(counters.length, data.length - off);
    const blocks = Math.ceil(len / 16);
    for (let b = 0; b < blocks; b++, counter++) {
      const o = b * 16;
      counters.fill(0, o, o + 16);
      let c = counter;
      for (let i = 0; i < 6; i++, c = Math.floor(c / 256)) counters[o + i] = c % 256;
    }
    // noble ciphers are one-shot per instance, so build one per chunk (key expansion is cheap).
    const ks = ecb(encKey, { disablePadding: true }).encrypt(counters.subarray(0, blocks * 16));
    for (let i = 0; i < len; i++) out[off + i] = data[off + i]! ^ ks[i]!;
  }
  return out;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ (b[i] ?? 0);
  return diff === 0;
}

export interface WriteOptions {
  /** When set, every entry is AES-256 encrypted. */
  password?: string;
  randomBytes?: RandomBytes;
  /** Names for which compression is skipped (already compressed data such as JPEG photos). */
  stored?: (name: string) => boolean;
}

export function writeZip(files: Record<string, Uint8Array>, opts: WriteOptions = {}): Uint8Array {
  const { password, randomBytes, stored } = opts;
  if (password === undefined) {
    return zipSync(
      Object.fromEntries(Object.entries(files).map(([name, data]) => [name, [data, { level: stored?.(name) ? 0 : 6 }]])) as never,
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) throw new NettleError('password_too_short');
  if (!randomBytes) throw new Error('randomBytes is required for encrypted ZIPs');

  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const push = (u8: Uint8Array) => {
    parts.push(u8);
    offset += u8.length;
  };
  const view = (n: number) => new DataView(new ArrayBuffer(n));

  const names = Object.keys(files);
  for (const name of names) {
    const plain = files[name]!;
    const nameBytes = strToU8(name);
    const isStored = stored?.(name) ?? false;
    const body = isStored ? plain : deflateSync(plain);
    const salt = randomBytes(SALT_LEN);
    const { encKey, macKey, verifier } = deriveKeys(password, salt);
    const cipher = ctrXor(encKey, body);
    const mac = hmac(sha1, macKey, cipher).subarray(0, 10);
    const payloadLen = SALT_LEN + 2 + cipher.length + 10;
    // 0x9901: AE-2, vendor "AE", AES-256, real compression method (deflate, or stored).
    const extra = new Uint8Array([0x01, 0x99, 7, 0, 2, 0, 0x41, 0x45, 3, isStored ? 0 : 8, 0]);

    const lh = view(30);
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 51, true);
    lh.setUint16(6, 0x0801, true); // encrypted + UTF-8 names
    lh.setUint16(8, AES_METHOD, true);
    lh.setUint16(12, 0x21, true); // date 1980-01-01
    lh.setUint32(14, 0, true); // AE-2: CRC is 0, integrity comes from the HMAC
    lh.setUint32(18, payloadLen, true);
    lh.setUint32(22, plain.length, true);
    lh.setUint16(26, nameBytes.length, true);
    lh.setUint16(28, extra.length, true);
    const localOffset = offset;
    push(new Uint8Array(lh.buffer));
    push(nameBytes);
    push(extra);
    push(salt);
    push(verifier);
    push(cipher);
    push(mac);

    const ch = view(46);
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 51, true);
    ch.setUint16(6, 51, true);
    ch.setUint16(8, 0x0801, true);
    ch.setUint16(10, AES_METHOD, true);
    ch.setUint16(14, 0x21, true);
    ch.setUint32(16, 0, true);
    ch.setUint32(20, payloadLen, true);
    ch.setUint32(24, plain.length, true);
    ch.setUint16(28, nameBytes.length, true);
    ch.setUint16(30, extra.length, true);
    ch.setUint32(42, localOffset, true);
    central.push(new Uint8Array(ch.buffer), nameBytes, extra);
  }

  const cdStart = offset;
  central.forEach(push);
  const end = view(22);
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, names.length, true);
  end.setUint16(10, names.length, true);
  end.setUint32(12, offset - cdStart, true);
  end.setUint32(16, cdStart, true);
  push(new Uint8Array(end.buffer));

  const out = new Uint8Array(offset);
  let p = 0;
  for (const part of parts) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}

function findAesExtra(extra: Uint8Array): { strength: number; method: number } | null {
  const dv = new DataView(extra.buffer, extra.byteOffset, extra.byteLength);
  for (let o = 0; o + 4 <= extra.length; ) {
    const id = dv.getUint16(o, true);
    const len = dv.getUint16(o + 2, true);
    if (id === 0x9901 && len >= 7 && o + 4 + len <= extra.length) {
      return { strength: dv.getUint8(o + 8), method: dv.getUint16(o + 9, true) };
    }
    o += 4 + len;
  }
  return null;
}

export interface ReadOptions {
  password?: string;
  /** Only these entry names are read; others are skipped without decrypting or inflating. */
  names: string[];
  /** Reject entries that claim to inflate, or actually inflate, beyond this many bytes (zip-bomb guard). */
  maxBytes: number;
}

/** Reads plain and AES-256 ZIPs. Throws NettleError for corrupt files, missing or wrong password, and oversize entries. */
export function readZip(zip: Uint8Array, opts: ReadOptions): Record<string, Uint8Array> {
  const corrupt = (detail?: string) => new NettleError('import_corrupt_zip', detail);
  try {
    return read(zip, opts);
  } catch (e) {
    if (e instanceof NettleError) throw e;
    throw corrupt();
  }
}

/**
 * Inflates into a buffer of the declared size plus one byte, so a stream that is larger than its header says
 * stops there instead of growing without limit, and is refused.
 */
function inflateBounded(data: Uint8Array, declared: number, name: string): Uint8Array {
  const out = inflateSync(data, { out: new Uint8Array(declared + 1) });
  if (out.length !== declared) throw new NettleError('import_corrupt_zip', `size mismatch: ${name}`);
  return out;
}

function read(zip: Uint8Array, opts: ReadOptions): Record<string, Uint8Array> {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let e = zip.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new NettleError('import_corrupt_zip');
  const count = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const result: Record<string, Uint8Array> = {};

  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new NettleError('import_corrupt_zip');
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true);
    const xlen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = strFromU8(zip.subarray(p + 46, p + 46 + nlen));
    const extra = zip.subarray(p + 46 + nlen, p + 46 + nlen + xlen);
    p += 46 + nlen + xlen + clen;
    if (!opts.names.includes(name)) continue;
    if (usize > opts.maxBytes) throw new NettleError('import_too_large', name);

    const dataStart = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    const data = zip.subarray(dataStart, dataStart + csize);

    if (method !== AES_METHOD) {
      if (flags & 1) throw new NettleError('import_corrupt_zip', 'legacy ZIP encryption is not supported');
      result[name] = method === 8 ? inflateBounded(data, usize, name) : data.slice();
      continue;
    }

    const aes = findAesExtra(extra);
    if (!aes || aes.strength !== 3) throw new NettleError('import_corrupt_zip', 'unsupported AES strength');
    if (opts.password === undefined) throw new NettleError('import_password_required');
    const salt = data.subarray(0, SALT_LEN);
    const { encKey, macKey, verifier } = deriveKeys(opts.password, salt);
    if (!sameBytes(data.subarray(SALT_LEN, SALT_LEN + 2), verifier)) throw new NettleError('import_wrong_password');
    const cipher = data.subarray(SALT_LEN + 2, data.length - 10);
    const mac = hmac(sha1, macKey, cipher).subarray(0, 10);
    if (!sameBytes(mac, data.subarray(data.length - 10))) throw new NettleError('import_corrupt_zip', 'authentication failed');
    const body = ctrXor(encKey, cipher);
    result[name] = aes.method === 8 ? inflateBounded(body, usize, name) : body;
  }
  return result;
}
