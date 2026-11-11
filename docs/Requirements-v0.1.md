# Food Allergy & Skin Condition Diary: Requirements v0.1

Nov 11, 2026 · @Rafal

## Overview and goals

A private iPhone diary where one person logs what they eat and take and how their skin and health feel, so patterns can be reviewed with a doctor. All data stays on the device.

- **Problem:** recurring scaling, itchy and sometimes painful skin patches with no confirmed diagnosis. Doctors recommended a diary to find out whether food or other triggers are involved.
- **User:** a single person, on their own iPhone. The app is never distributed.
- **Done means:** daily logging takes about a minute, the full log exports as a doctor-ready bundle, and an on-demand LLM analysis suggests possible patterns.
- **Not a goal:** diagnosis or medical advice. LLM output is always presented as tentative hypotheses.

Priorities used below: **Must** (v1), **Should** (v1 if cheap), **Later** (after v1).

## Intake logging

Every entry has a timestamp (editable, so past meals can be added) and an optional note. Reactions can lag a trigger by a day or more, so exact times matter.

| ID | Requirement | Priority |
| --- | --- | --- |
| IN-1 | Log a meal manually: free-text description plus an editable ingredient list | Must |
| IN-2 | Log a packaged product by scanning its barcode; ingredients and allergens fetched from Open Food Facts (Polish codes start with 590). In-store codes (restricted circulation numbers, e.g. many Lidl own-brand items) are ambiguous, so the app warns and asks the user to confirm the match | Must |
| IN-3 | Log a meal from a photo: the LLM estimates ingredients, the user reviews and edits before saving | Must |
| IN-4 | Log alcohol (type, amount) | Must |
| IN-5 | Log medications and supplements (name, dose), including topical treatments | Must |
| IN-6 | Log other possible triggers: cosmetics and hair products, detergents, new clothing or jewelry, stress, sleep | Should |
| IN-7 | Reuse earlier entries (recent and favorite meals) to speed up logging | Must |
| IN-8 | Barcode not found or product data incomplete: fall back to manual ingredient entry | Must |
| IN-9 | Barcode lookup sits behind a small interface (barcode in; name, ingredients and allergens out), with Open Food Facts as the first adapter, so another source can replace it | Must |

Ingredients from a photo or from a database are suggestions. Nothing from the LLM or a database is saved until the user confirms it.

## Skin and health logging

Skin status is logged per body area, with several separate scores, so the analysis can tell itching from scaling and a flare from a calm day.

| ID | Requirement | Priority |
| --- | --- | --- |
| SK-1 | Predefined skin areas: chin, neck, ears (inside), behind the ears, sternum, intimate area | Must |
| SK-2 | The user can add, rename and archive their own areas | Must |
| SK-3 | Per area and entry, separate 0–10 scores for severity, itch, pain, dryness and scaling | Must |
| SK-4 | Dated photos attached to an area entry, several per entry | Must |
| SK-5 | Each photo has a sensitive flag; areas can be sensitive by default (intimate area is) and the user can override per photo | Must |
| SK-6 | Flare marker, separate from the scores: the user marks a flare start and end | Must |
| SK-7 | Overall health entry: general wellbeing score, free-text note, sleep and stress scores, and stool entries (Bristol type 1–7, timestamped, several per day) | Must |
| SK-8 | Timeline view per area showing scores and photos side by side across dates | Should |
| SK-9 | Daily reminder to log, as a local notification | Should |

Photos are stored on the device, in the app's private storage, and never leave it except through an export or an LLM run the user explicitly confirms.

## LLM features

The LLM is the Anthropic API, paid per use through a Console account. A Claude Pro subscription does not cover API calls. The app calls the API directly from the phone; no backend is assumed.

| ID | Requirement | Priority |
| --- | --- | --- |
| LL-1 | Photo to ingredients: send a meal photo, get an ingredient estimate back, shown for review (see IN-3) | Must |
| LL-2 | On-demand pattern analysis over a user-chosen date range, over intake, skin and health data | Must |
| LL-3 | Analysis windows: look at same day, 24 h, 48 h and 72 h after intake, not only the previous meal | Must |
| LL-4 | The prompt asks for tentative hypotheses with stated uncertainty and the data behind each one, never conclusions | Must |
| LL-5 | Before every run, a confirmation screen lists exactly what will be sent: date range, entry counts, and which photos | Must |
| LL-6 | Photos are excluded from analysis by default; the user opts in per run and selects some or all, sensitive photos included only by explicit choice | Must |
| LL-7 | Each analysis is stored as its own object: date range, model, run date, prompt version, result. Raw entries are never modified | Must |
| LL-8 | Failures (no network, invalid key, rate limit, spend cap reached) show a clear message and lose no data | Must |
| LL-9 | Model name is a setting, not hard-coded | Must |
| LL-10 | LLM provider abstraction: one interface for photo-to-ingredients and one for analysis, with a separate adapter per provider (Anthropic first). Provider, model and key are settings, and prompts are provider-agnostic | Must |
| LL-11 | LLM output language follows the selected language (English or Polish) | Should |

Photo selection for LLM runs is independent of photo selection for exports (see Export).

## Export

Export is the backup and the way to share data with a doctor. It produces one ZIP for a chosen date range.

| ID | Requirement | Priority |
| --- | --- | --- |
| EX-1 | `data.json`: full raw data, with a `schema_version` field, stable entry IDs, and UTC timestamps plus local timezone. It is a snapshot of the chosen range, not the live store | Must |
| EX-2 | `photos/` folder with predictable file names (for example `2026-11-11_chin_01.jpg`), referenced from `data.json` by relative path | Must |
| EX-3 | `report.pdf`: readable summary for a doctor with a flare timeline, per-area trends, photo comparisons and the intake log, in a selectable language (English or Polish) | Must |
| EX-4 | LLM analyses appear in a separate, clearly labeled section of the PDF as AI-generated, tentative hypotheses | Must |
| EX-5 | Optional CSV files, one per table, for spreadsheet use | Should |
| EX-6 | Optional password protection, off by default, entered at export time and never stored; AES-256 encryption, not the legacy ZIP scheme | Must |
| EX-7 | Photo selection for export: all, none, non-sensitive only, or a custom selection by area, date range or single photo; default excludes sensitive photos | Must |
| EX-8 | The selection applies to everything in the bundle, including photos shown in the PDF | Must |
| EX-9 | Delivery through the iOS share sheet (Files, AirDrop, email) | Must |
| EX-10 | Import of a `data.json` export (the ZIP) to restore or migrate: Expo Go to a standalone build, or an old phone to a new one. Import checks schema\_version, shows entry counts before applying, offers merge or replace, and skips duplicates by entry ID. The API key is not part of an export, so it is re-entered after a migration | Must |
| EX-11 | Export “since last export” as an alternative to a date range, to keep files small over months of logging | Should |

The API key is never included in any export. The export screen warns that photos may be sensitive, and that a forgotten ZIP password cannot be recovered. Some tools do not open AES-encrypted ZIPs natively, so the recipient may need a tool such as 7-Zip.

## Data, privacy and security

All entries and photos live on the phone. The only data that leaves it is what the user sends to the Anthropic API or shares through an export, and each of those is a confirmed, explicit action.

| ID | Requirement | Priority |
| --- | --- | --- |
| SE-1 | Local-only storage; no cloud sync and no analytics or telemetry | Must |
| SE-2 | The API key is entered once by the user in a settings screen and then read from the Keychain and never appears in source code, the app bundle or the repository | Must |
| SE-3 | The key is stored in the iOS Keychain with the "when unlocked, this device only" accessibility class, so it does not migrate through backups | Must |
| SE-4 | Key access sits behind a small interface (get, set, delete) so other stores can replace Keychain later | Must |
| SE-5 | The app uses its own named API key, with a spend limit set in the Console if available. Rotation: create a new key, enter it, delete the old one | Must |
| SE-6 | The key is excluded from logs, crash reports, exports and LLM prompts | Must |
| SE-7 | Photos are stored in the app's private storage and excluded from device backups unless the user chooses otherwise | Should |
| SE-8 | Optional app lock with Face ID or passcode | Should |
| SE-9 | Bulk delete on request: by date range, by entry type, or everything including photos. A confirmation states what will be removed and that it cannot be undone, and offers an export first. Data is otherwise kept until the user deletes it | Must |

**Accepted risks:** anyone who controls the device or its certificate trust settings can see the key in network traffic while it is in use, since Keychain protects the key at rest only. A jailbroken or unlocked phone exposes its contents. Data sent to the API is processed by a third party; Anthropic's current retention and training terms for API usage need checking before the first run.

**Backup:** with local-only storage, a lost or reset phone loses the diary. Regular export is the backup, and the app should remind the user to export, for example monthly.

## Architecture principles

The app serves one user today but is structured so it can later be extended, distributed or ported to another platform.

- **Ports and adapters:** core logic (logging, analysis requests, export) depends on small interfaces, and each external concern has its own adapter: LLM provider, key store, database, photo storage, barcode source, notifications and file sharing. Replacing Anthropic, Keychain or Open Food Facts touches one adapter.
- **Bring your own key:** every user supplies their own LLM key. No shared key and no server holds it, which keeps later distribution possible without a backend.
- **Portable data:** storage is a local database behind a repository interface, and the export schema is versioned and platform-neutral, so data can move to another app or platform.
- **Localization from day one:** all user-facing text lives in translation files. English ships first, Polish next.
- **Out of scope for v1:** App Store release, accounts, sync, a backend and medical-device claims. Distribution to others would need the paid Apple Developer Program, a privacy policy and a medical disclaimer.

## Non-functional requirements and constraints

| ID | Requirement | Priority |
| --- | --- | --- |
| NF-1 | Manual logging and viewing work fully offline; only LLM features and barcode lookups need a network | Must |
| NF-2 | A new log entry takes under a minute and a few taps | Must |
| NF-3 | No data loss on app restart, crash or failed LLM call | Must |
| NF-4 | Timestamps are stored in UTC with the local timezone, so travel and daylight saving do not scramble the timeline | Must |
| NF-5 | Photos are compressed on save to keep storage use reasonable over months of daily logging | Should |
| NF-6 | All user-facing text is localized in English and Polish, with English shipped first; no hard-coded strings, and dates, units and number formats follow the device locale | Must |

**Constraints**

- Development happens on Ubuntu. A Mac is available only occasionally, so day-to-day work must not need one.
- Budget: free tooling where possible. Paid items so far are API usage and possibly the $99 per year Apple Developer Program.
- Free Apple Account builds expire after 7 days. The same account is reused; the app stops opening and must be rebuilt and reinstalled. This is accepted for the standalone phase. Moving to the paid program later (builds last up to a year) is possible, but it may require reinstalling the app, so export and import cover that move.
- EU alternative marketplaces and web distribution require notarized apps from Apple Developer Program members, so they are not a free route.
- No App Store release and no other users for now.

**Platform candidates (undecided)**

- **Expo (React Native), chosen for development:** daily coding on Linux with live reload on the real iPhone through Expo Go, free and with no Apple account. Expo Go is a development sandbox, not a standalone app: it needs the dev server running, supports only the SDK version of its App Store release (which lagged behind new SDKs in 2026), and keeps the app’s data inside Expo Go. A standalone build needs a Mac (free, 7-day expiry) or the paid program (cloud build, up to a year).
- **PWA:** no Apple involvement and no expiry, but weaker photo and key storage, awkward file export on iOS, and limited background behavior.
- **Flutter:** fast on Linux, but no equivalent of Expo Go for iOS, so iPhone problems surface late.

## Decisions and open questions

No decision blocks v0.1; the open items below are checks to run during development.

**Decided**

- Data is stored locally on the phone; no cloud for now.
- No backend at this point.
- Development starts in Expo (React Native) with Expo Go. The standalone app comes later on the free Apple Account (7-day expiry, weekly rebuild on the Mac); moving to the paid program later is possible.
- Import and export together are the migration path between Expo Go, a standalone build and other phones.
- The LLM is the paid Anthropic API (a Pro subscription does not cover it), with the architecture open to other providers.
- Barcode lookup also sits behind a small interface; Open Food Facts is the first source, to be tested on real products.
- The API key is entered once in the app and stored in the iOS Keychain behind an abstraction.
- Export is a must-have: ZIP with raw JSON, photos and a PDF report, optional CSV, optional AES password, per-photo selection.
- LLM photo selection is separate from export photo selection, with a confirmation screen before each run.
- Skin areas are predefined plus user-defined, with dated photos and a sensitive flag per photo.
- App text and the doctor-facing PDF support English and Polish; English ships first.
- Bulk delete on user request; data is kept until the user deletes it.
- Designed for extension: ports and adapters, bring your own key, localization from day one.

**Open**

- [ ] Barcode data: is Open Food Facts coverage of Polish products good enough in practice? Polish codes are present, but the data is crowd-sourced, so it will be tested in the app on products actually bought. The lookup sits behind an interface, so the source can be swapped.
- [ ] Before starting the project, check which Expo SDK the current App Store version of Expo Go supports, and create the project on that SDK.
