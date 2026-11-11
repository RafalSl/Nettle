# Spike: AES-256 ZIP in Expo Go (EX-6)

Date: 2026-11-12. Question: can the app write and read password-protected ZIPs with AES-256 (WinZip AES, not legacy ZipCrypto) using only Expo Go compatible code?

## Result: yes, with pure JS

Prototype in [`docs/spikes/aes-zip/winzipAes.mjs`](aes-zip/winzipAes.mjs) (about 170 lines), test script [`test.mjs`](aes-zip/test.mjs).

- Format: WinZip AES, AE-2, 256-bit. Key derivation PBKDF2-HMAC-SHA1 with 1000 rounds (fixed by the format), AES-CTR with a little-endian counter, HMAC-SHA1 authentication (10 bytes), 2-byte password verifier.
- Libraries: `@noble/ciphers` (AES) and `@noble/hashes` (PBKDF2, HMAC, SHA-1), both pure JS, no native code, audited. `fflate` (already used) does the deflate/inflate. Random salt comes from an injected function (`expo-crypto` in the app).
- noble's own `ctr` counts big-endian, WinZip needs little-endian, so CTR is built on noble's AES-ECB over generated counter blocks (64 KiB per call).

### Verified
- Our writer, opened by two independent 7-Zip builds (`7z` and `7zz`): correct contents for a JSON file and a 3 MB binary, both deflated and stored. 7-Zip reports `AES-256 Deflate`.
- 7-Zip's own AES-256 ZIP, read by our reader: correct.
- Wrong password rejected by 7-Zip and by our reader; a flipped byte is detected as corrupt (HMAC).
- Not checked: macOS Archive Utility and Windows Explorer (Explorer cannot open AES ZIPs; Archive Utility cannot either, per the requirements note). A doctor needs 7-Zip or similar.

### Why not the alternatives
- **zip.js:** relies on `crypto.subtle`, which Hermes does not provide. Would need a polyfill. Not tested here.
- **Native zip libraries** (react-native-zip-archive etc.): need a custom native build, not available in Expo Go.
- **Hand-rolled AES:** no.

## Open risk: speed on the phone
In Node (V8) encryption ran at about 26 MiB/s, 50 MiB in 1.9 s. Hermes has no JIT, so expect it to be much slower (my guess: 10 to 50 times, so roughly 0.5 to 3 MiB/s, i.e. 15 to 100 s for 50 MiB of photos). This is a guess, not a measurement; there is no Hermes VM binary for Linux here. Text-only exports (data.json, a few MB) are not affected. Mitigations if photos are slow: stored (not deflated) photos, progress UI with chunking so the screen stays responsive, or a warning on large exports.
To settle it: run the same code on the phone with a temporary benchmark screen (needs `@noble/ciphers` and `@noble/hashes` added to the app).

## Format limitations to tell the user
- File names, sizes and dates are not encrypted. Photo names such as `2026-11-11_chin_01.jpg` reveal area and date. Recorded in requirements (EX-6 note).
- 1000 PBKDF2 rounds is weak against offline guessing, so use a long passphrase. Also recorded.
- AE-2 omits the CRC; integrity comes from the HMAC.

## Next steps (not done)
1. Device benchmark (see above).
2. Move the writer and reader into `app/src/core/export/` behind a `randomBytes` dependency, add tests (round trip, wrong password, tamper, odd sizes, multi-entry), and wire password input into export and import.
3. Decide photo file naming (EX-2) with the filename leak in mind.
