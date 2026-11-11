import { zipAes, unzipAes } from './winzipAes.mjs';
import { randomBytes } from 'node:crypto';
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
const rb = (n) => new Uint8Array(randomBytes(n));
const PW = 'synthetic-pass-123';
const json = new TextEncoder().encode(JSON.stringify({ schema_version: 1, meals: Array.from({length:2000},(_,i)=>({id:`m${i}`,description:'Synthetic meal '+i})) }));
const jpg = rb(3_000_001); // incompressible, odd length to exercise partial blocks
rmSync('out', { recursive: true, force: true }); mkdirSync('out');

// 1. our writer -> 7-Zip / 7zz extract
for (const deflate of [true, false]) {
  const zip = zipAes({ 'data.json': json, 'photos/2026-01-01_chin_01.jpg': jpg }, PW, rb, { deflate });
  writeFileSync(`out/ours-${deflate}.zip`, zip);
  for (const tool of ['7z', '7zz']) {
    const dir = `out/x-${tool}-${deflate}`;
    execSync(`${tool} x -y -p${PW} -o${dir} out/ours-${deflate}.zip`, { stdio: 'pipe' });
    const okJ = Buffer.compare(readFileSync(`${dir}/data.json`), Buffer.from(json)) === 0;
    const okP = Buffer.compare(readFileSync(`${dir}/photos/2026-01-01_chin_01.jpg`), Buffer.from(jpg)) === 0;
    console.log(`ours(deflate=${deflate}) -> ${tool}: data.json ${okJ ? 'OK' : 'MISMATCH'}, photo ${okP ? 'OK' : 'MISMATCH'}`);
  }
}
console.log(execSync('7z l -slt -pwrong out/ours-true.zip 2>&1 | grep -E "Method|Encrypted" | sort | uniq -c').toString());

// wrong password in 7z must fail
try { execSync(`7z t -pwrong out/ours-true.zip`, { stdio: 'pipe' }); console.log('7z accepted WRONG password (bad)'); } catch { console.log('7z rejects wrong password: OK'); }

// 2. 7-Zip writer -> our reader
writeFileSync('out/plain.json', json); writeFileSync('out/photo.bin', jpg);
execSync(`cd out && 7z a -tzip -mem=AES256 -p${PW} sevenzip.zip plain.json photo.bin`, { stdio: 'pipe' });
const r = unzipAes(new Uint8Array(readFileSync('out/sevenzip.zip')), PW);
console.log('7z -> ours: json', Buffer.compare(Buffer.from(r['plain.json']), Buffer.from(json)) === 0 ? 'OK' : 'MISMATCH', 'photo', Buffer.compare(Buffer.from(r['photo.bin']), Buffer.from(jpg)) === 0 ? 'OK' : 'MISMATCH');

// 3. ours -> ours, wrong password, tamper
const z = zipAes({ 'data.json': json }, PW, rb);
console.log('roundtrip', Buffer.compare(Buffer.from(unzipAes(z, PW)['data.json']), Buffer.from(json)) === 0 ? 'OK' : 'MISMATCH');
try { unzipAes(z, 'nope'); console.log('wrong pw accepted (bad)'); } catch (e) { console.log('wrong password ->', e.message); }
const t = z.slice(); t[100] ^= 1;
try { unzipAes(t, PW); console.log('tamper accepted (bad)'); } catch (e) { console.log('tampered ->', e.message); }

// 4. throughput (V8; Hermes will be much slower)
const big = rb(50 * 1024 * 1024);
let t0 = performance.now(); const bz = zipAes({ 'p.bin': big }, PW, rb, { deflate: false }); let ms = performance.now() - t0;
console.log(`encrypt 50 MiB (V8): ${ms.toFixed(0)} ms = ${(50 / (ms / 1000)).toFixed(1)} MiB/s`);
t0 = performance.now(); unzipAes(bz, PW); ms = performance.now() - t0;
console.log(`decrypt 50 MiB (V8): ${ms.toFixed(0)} ms`);
