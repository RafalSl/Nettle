// Spike: WinZip AES-256 (AE-2) ZIP writer + reader on pure-JS crypto (noble) + fflate deflate.
import { ecb } from '@noble/ciphers/aes.js';
import { hmac } from '@noble/hashes/hmac.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha1 } from '@noble/hashes/legacy.js';
import { deflateSync, inflateSync } from 'fflate';

const enc = new TextEncoder();
const dec = new TextDecoder();
const SALT = 16; // AES-256
const KEY = 32;
const BLOCKS_PER_CHUNK = 4096; // 64 KiB of keystream per ECB call

function deriveKeys(password, salt) {
  const out = pbkdf2(sha1, enc.encode(password), salt, { c: 1000, dkLen: 2 * KEY + 2 });
  return { encKey: out.subarray(0, KEY), macKey: out.subarray(KEY, 2 * KEY), verifier: out.subarray(2 * KEY) };
}

// WinZip AES-CTR: little-endian 128-bit counter starting at 1 (noble's ctr is big-endian, so build it on ECB).
function ctrXor(encKey, data) {
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
    for (let i = 0; i < len; i++) out[off + i] = data[off + i] ^ ks[i];
  }
  return out;
}

const eq = (a, b) => {
  let d = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ (b[i] ?? 0);
  return d === 0;
};

/** files: { name: Uint8Array }. randomBytes injected (expo-crypto in the app). */
export function zipAes(files, password, randomBytes, { deflate = true } = {}) {
  const parts = [];
  const central = [];
  let offset = 0;
  const push = (u8) => {
    parts.push(u8);
    offset += u8.length;
  };
  for (const [name, plain] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const method = deflate ? 8 : 0;
    const body = deflate ? deflateSync(plain) : plain;
    const salt = randomBytes(SALT);
    const { encKey, macKey, verifier } = deriveKeys(password, salt);
    const cipher = ctrXor(encKey, body);
    const mac = hmac(sha1, macKey, cipher).subarray(0, 10);
    const payloadLen = SALT + 2 + cipher.length + 10;
    const extra = new Uint8Array([0x01, 0x99, 7, 0, 2, 0, 0x41, 0x45, 3, method, 0]); // AE-2, "AE", AES-256, real method
    const dv = (n) => new DataView(new ArrayBuffer(n));

    const lh = dv(30);
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 51, true);
    lh.setUint16(6, 0x0801, true); // encrypted + UTF-8 names
    lh.setUint16(8, 99, true);
    lh.setUint16(10, 0, true);
    lh.setUint16(12, 0x21, true); // date 1980-01-01
    lh.setUint32(14, 0, true); // AE-2: CRC is 0
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

    const ch = dv(46);
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 51, true);
    ch.setUint16(6, 51, true);
    ch.setUint16(8, 0x0801, true);
    ch.setUint16(10, 99, true);
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
  const cdSize = offset - cdStart;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, Object.keys(files).length, true);
  end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, cdSize, true);
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

function findAesExtra(extra) {
  const dv = new DataView(extra.buffer, extra.byteOffset, extra.byteLength);
  for (let o = 0; o + 4 <= extra.length; ) {
    const id = dv.getUint16(o, true);
    const len = dv.getUint16(o + 2, true);
    if (id === 0x9901 && len >= 7) return { strength: dv.getUint8(o + 8), method: dv.getUint16(o + 9, true) };
    o += 4 + len;
  }
  return null;
}

/** Reads ZIPs with AES entries (AE-1/AE-2, 256-bit only here). Throws on bad password or tampering. */
export function unzipAes(zip, password) {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let e = zip.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('not a zip');
  const count = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const result = {};
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('bad central directory');
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const xlen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = dec.decode(zip.subarray(p + 46, p + 46 + nlen));
    const extra = zip.subarray(p + 46 + nlen, p + 46 + nlen + xlen);
    p += 46 + nlen + xlen + clen;

    const lnlen = dv.getUint16(lho + 26, true);
    const lxlen = dv.getUint16(lho + 28, true);
    const data = zip.subarray(lho + 30 + lnlen + lxlen, lho + 30 + lnlen + lxlen + csize);
    if (method !== 99) {
      result[name] = method === 8 ? inflateSync(data) : data.slice();
      continue;
    }
    const aes = findAesExtra(extra);
    if (!aes) throw new Error('missing AES extra field');
    if (aes.strength !== 3) throw new Error('unsupported AES strength');
    const real = aes.method;
    const salt = data.subarray(0, SALT);
    const { encKey, macKey, verifier } = deriveKeys(password, salt);
    if (!eq(data.subarray(SALT, SALT + 2), verifier)) throw new Error('wrong password');
    const cipher = data.subarray(SALT + 2, data.length - 10);
    if (!eq(hmac(sha1, macKey, cipher).subarray(0, 10), data.subarray(data.length - 10))) throw new Error('corrupt or tampered');
    const body = ctrXor(encKey, cipher);
    result[name] = real === 8 ? inflateSync(body) : body;
  }
  return result;
}

