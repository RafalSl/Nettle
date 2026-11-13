import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, strToU8 } from 'fflate';
import { MIN_PASSWORD_LENGTH, readZip, writeZip } from '@/core/export/zip';
import { NettleError } from '@/core/model/errors';

const rb = (n: number) => new Uint8Array(randomBytes(n)); // getRandomValues caps at 64 KiB
const PW = 'synthetic-passphrase-1';
const opts = { names: ['a.bin', 'b.txt'], maxBytes: 10_000_000 };
const codeOf = (fn: () => unknown) => {
  try {
    fn();
    return 'no error';
  } catch (e) {
    return e instanceof NettleError ? e.code : 'other';
  }
};

describe('stored entries (EX-2)', () => {
  const isPhoto = (name: string) => name.startsWith('photos/');
  const files = { 'a.bin': rb(5000), 'photos/x.jpg': rb(70001) };
  const names = ['a.bin', 'photos/x.jpg'];

  it.each([undefined, PW])('round-trips stored and deflated entries together (password: %s)', (password) => {
    const zip = writeZip(files, { password, randomBytes: rb, stored: isPhoto });
    const out = readZip(zip, { names, maxBytes: 10_000_000, password });
    for (const n of names) expect(Buffer.compare(Buffer.from(out[n]!), Buffer.from(files[n as keyof typeof files]))).toBe(0);
    expect(zip.length).toBeGreaterThan(70001 + 5000); // random bytes: no shrinking, and the photo is not deflated
  });
});

describe('EX-6 AES-256 ZIP', () => {
  it.each([0, 1, 15, 16, 17, 255, 65536, 70001])('round-trips an entry of %i bytes', (size) => {
    const data = rb(size);
    const zip = writeZip({ 'a.bin': data, 'b.txt': strToU8('synthetic text') }, { password: PW, randomBytes: rb });
    const out = readZip(zip, { ...opts, password: PW });
    expect(Buffer.compare(Buffer.from(out['a.bin']!), Buffer.from(data))).toBe(0);
    expect(strFromU8(out['b.txt']!)).toBe('synthetic text');
  });

  it('does not leave plaintext in the encrypted file', () => {
    const zip = writeZip({ 'a.bin': strToU8('synthetic-marker-'.repeat(50)) }, { password: PW, randomBytes: rb });
    expect(Buffer.from(zip).includes('synthetic-marker')).toBe(false);
  });

  it('uses a fresh salt each time, so two exports of the same data differ', () => {
    const files = { 'a.bin': strToU8('same') };
    const a = writeZip(files, { password: PW, randomBytes: rb });
    const b = writeZip(files, { password: PW, randomBytes: rb });
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).not.toBe(0);
  });

  it('rejects a missing password and a wrong password with distinct errors', () => {
    const zip = writeZip({ 'a.bin': rb(100) }, { password: PW, randomBytes: rb });
    expect(codeOf(() => readZip(zip, opts))).toBe('import_password_required');
    expect(codeOf(() => readZip(zip, { ...opts, password: 'synthetic-wrong-pass' }))).toBe('import_wrong_password');
  });

  it('detects tampering with the encrypted data', () => {
    const zip = writeZip({ 'a.bin': rb(500) }, { password: PW, randomBytes: rb });
    const bad = zip.slice();
    bad[100] = bad[100]! ^ 1;
    expect(codeOf(() => readZip(bad, { ...opts, password: PW }))).toBe('import_corrupt_zip');
  });

  it(`requires at least ${MIN_PASSWORD_LENGTH} characters`, () => {
    expect(codeOf(() => writeZip({ 'a.bin': rb(1) }, { password: 'short', randomBytes: rb }))).toBe('password_too_short');
  });

  it('writes a plain ZIP when no password is given, and reads it with or without one', () => {
    const zip = writeZip({ 'b.txt': strToU8('plain') });
    expect(strFromU8(readZip(zip, opts)['b.txt']!)).toBe('plain');
    expect(strFromU8(readZip(zip, { ...opts, password: PW })['b.txt']!)).toBe('plain');
  });

  it('skips entries that were not asked for, even encrypted ones', () => {
    const zip = writeZip({ 'a.bin': rb(10), 'other.bin': rb(10) }, { password: PW, randomBytes: rb });
    expect(Object.keys(readZip(zip, { ...opts, names: ['a.bin'], password: PW }))).toEqual(['a.bin']);
  });

  it('refuses entries that claim to be larger than the limit', () => {
    const zip = writeZip({ 'a.bin': rb(2000) }, { password: PW, randomBytes: rb });
    expect(codeOf(() => readZip(zip, { ...opts, password: PW, maxBytes: 1000 }))).toBe('import_too_large');
  });

  it('treats garbage as a corrupt ZIP', () => {
    expect(codeOf(() => readZip(strToU8('not a zip at all'), opts))).toBe('import_corrupt_zip');
  });
});

// Interop with an independent implementation. Skipped where 7-Zip is not installed (see docs/spikes/aes-zip.md).
const sevenZip = ['7z', '7zz'].find((bin) => spawnSync(bin, ['i'], { stdio: 'ignore' }).status === 0);
(sevenZip ? describe : describe.skip)('EX-6 interop with 7-Zip', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nettle-zip-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('7-Zip opens our encrypted ZIP and we open 7-Zip\'s', () => {
    const data = rb(100_003);
    const zip = writeZip({ 'a.bin': data, 'b.txt': strToU8('synthetic text') }, { password: PW, randomBytes: rb });
    writeFileSync(join(dir, 'ours.zip'), zip);
    const x = spawnSync(sevenZip!, ['x', '-y', `-p${PW}`, `-o${join(dir, 'x')}`, join(dir, 'ours.zip')]);
    expect(x.status).toBe(0);
    expect(Buffer.compare(readFileSync(join(dir, 'x', 'a.bin')), Buffer.from(data))).toBe(0);

    writeFileSync(join(dir, 'a.bin'), data);
    writeFileSync(join(dir, 'b.txt'), 'synthetic text');
    const a = spawnSync(sevenZip!, ['a', '-tzip', '-mem=AES256', `-p${PW}`, 'theirs.zip', 'a.bin', 'b.txt'], { cwd: dir });
    expect(a.status).toBe(0);
    const out = readZip(new Uint8Array(readFileSync(join(dir, 'theirs.zip'))), { ...opts, password: PW });
    expect(Buffer.compare(Buffer.from(out['a.bin']!), Buffer.from(data))).toBe(0);
  });

  it('7-Zip opens an encrypted ZIP that has stored photo entries', () => {
    const photo = rb(60_001);
    const zip = writeZip({ 'data.json': strToU8('{}'), 'photos/2026-01-10_chin_01.jpg': photo }, {
      password: PW,
      randomBytes: rb,
      stored: (n) => n.startsWith('photos/'),
    });
    writeFileSync(join(dir, 'photos.zip'), zip);
    const x = spawnSync(sevenZip!, ['x', '-y', `-p${PW}`, `-o${join(dir, 'y')}`, join(dir, 'photos.zip')]);
    expect(x.status).toBe(0);
    expect(Buffer.compare(readFileSync(join(dir, 'y', 'photos', '2026-01-10_chin_01.jpg')), Buffer.from(photo))).toBe(0);
  });
});
