# Food Allergy & Skin Condition Diary: Requirements v0.4.2

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
| IN-3 | Log a meal from a photo: the LLM estimates ingredients, the user reviews and edits before saving. The estimate arrives as an editable list: the user can add all of it or pick items, rename or remove them and add their own, and it never overwrites what was typed. Allergen tags suggested by the LLM stay unselected until the user selects them. The wait is shown inline and can be cancelled (LL-12) | Must |
| IN-4 | Log alcohol (type, amount) | Must |
| IN-5 | Log medications and supplements (name, dose). Topical treatments are logged per area (IN-11) | Must |
| IN-6 | Daily tags: a user-editable list of yes/no tags, toggled in the daily check-in (SK-7). Seeded with illness or infection, antibiotics, shaving, heavy sweating, sauna or pool, sun exposure, travel, nicotine and joint symptoms. New products (cosmetics, detergents, clothing, jewelry) are change events (IN-12); stress and sleep are check-in scores (SK-7) | Must |
| IN-7 | Reuse earlier entries to speed up logging. The meal form has two phases: choose (suggestions from IN-14, or type a new meal) and review (description, ingredient list and allergen tags, all editable). Choosing a suggestion moves to review with the ingredients and tags of its latest use. "Change meal" returns to choose and asks first if anything was edited. Nothing is saved until the user saves, and the result is a new, independent entry: editing it never changes the earlier one | Must |
| IN-8 | Barcode not found or product data incomplete: fall back to manual ingredient entry | Must |
| IN-9 | Barcode lookup sits behind a small interface (barcode in; name, ingredients and allergens out), with Open Food Facts as the first adapter, so another source can replace it | Must |
| IN-10 | Allergen tags on meals: the 14 EU allergens (cereals containing gluten, crustaceans, eggs, fish, peanuts, soybeans, milk, tree nuts, celery, mustard, sesame, sulphites, lupin, molluscs). Suggested from Open Food Facts, the LLM or the ingredient text, and confirmed by the user. Tags that come from the diary's own history (IN-7, IN-14) count as confirmed when they are visible and pre-selected on the form before saving; tags from Open Food Facts or the LLM need an explicit review step | Must |
| IN-11 | Treatments: a saved list of topical treatments; applying one to one or more areas is a single tap and is timestamped. Frequently used combinations of treatment and areas are offered as one-tap shortcuts on Today (IN-14) | Must |
| IN-12 | Change events: "started" or "stopped" a product, medication or diet, with a date and a name, shown as markers on the timeline. Choosing "stopped" offers the items that were started and not yet stopped | Should |
| IN-13 | Immediate reaction: symptoms within about 2 hours of a meal (hives, lip or mouth tingling, swelling, stomach symptoms), linked to that meal with the time of onset. The screen shows advice to seek urgent care for swelling of the face or throat or trouble breathing | Should |
| IN-14 | Suggestions for repeated input, computed on the device from existing entries (nothing extra is stored and nothing leaves the device). For meals, alcohol and medications or supplements the form shows a short ranked list: favorites first, then a mix of the most frequent items in a recent window and the most recent ones, without duplicates. Each row has a hint (for example a count, "yesterday" or a star); typing filters the whole history. The number of rows (default 5) and the window (7, 14, 30 or 60 days; default 30) are settings. A meal is identified by its normalized description (trimmed, lowercase, single spaces). Other inputs use fixed lists, prefill or shortcuts: treatments (IN-11), skin and nails (SK-3), the check-in (SK-7), stool, reactions and flares. Suggestions appear only in the choose phase of the meal form (IN-7). Ranking sits behind one pure function so the formula can change later | Must |

Ingredients and allergen tags from a photo or from a database are suggestions. Nothing from the LLM or a database is saved until the user confirms it.

## Skin and health logging

Skin status is logged per body area, with several separate scores, so the analysis can tell itching from scaling and a flare from a calm day. Nails are their own kind of area, and a daily check-in holds everything that is recorded once a day.

| ID | Requirement | Priority |
| --- | --- | --- |
| SK-1 | Predefined skin areas: chin, neck, ears (inside), behind the ears, sternum, intimate area | Must |
| SK-2 | The user can add, rename and archive areas. Predefined areas keep a stable id and show a localized name; renaming one stores a `name_override` that takes precedence until cleared. Active area names are unique, compared without regard to case | Must |
| SK-3 | Per skin area and entry, separate 0–10 scores for severity, itch, pain, dryness and scaling. A new entry is prefilled with the area's last values, and "no change" saves it in one tap, for skin and nail entries alike. "No change for all areas" saves every area in two taps | Must |
| SK-4 | Dated photos attached to an area entry, several per entry | Must |
| SK-5 | Each photo has a sensitive flag; areas can be sensitive by default (intimate area is) and the user can override per photo | Must |
| SK-6 | Flare marker, separate from the scores: the user marks a flare start and end | Must |
| SK-7 | Daily check-in, one screen and one record per local day: wellbeing, stress, sleep quality and abdominal pain (each 0–10), bloating (yes/no), daily tags (IN-6) and a free-text note. Stool entries stay separate (Bristol type 1–7, timestamped, several per day). The check-in offers an explicit "same as yesterday"; values are never filled in silently, and a score the user has switched off in Settings is not asked or recorded | Must |
| SK-8 | Timeline view per area showing scores and photos side by side across dates | Should |
| SK-9 | Reminders as local notifications: a daily one for the check-in, and a weekly one to photograph nails while nail areas exist, and a monthly one to export. Tapping a reminder opens its target: the check-in form for the day the reminder was delivered, the nail update form, or the Full backup screen (EX-14). It does nothing while a form has unsaved changes and is handled once per reminder. Reminder texts never contain entries | Should |
| SK-10 | Nail areas: every area has a kind, skin or nail. The user adds one nail area per affected nail. A nail entry has a stage (red or dark edge, separation, yellow, white, clear), a rough extent (none, under a quarter, up to half, more than half) and photos (SK-4, SK-5), instead of the five scores | Must |
| SK-11 | Day complete: closing the daily check-in marks that local day as fully logged for meals and other intake. The mark can be removed. Closing a day with no meals logged asks for confirmation first | Must |

Photos are stored on the device, in the app's private storage, and never leave it except through an export or an LLM run the user explicitly confirms.

## Editing and deleting entries

Until now only bulk delete (SE-9) existed, so one wrong entry could not be corrected.

| ID | Requirement | Priority |
| --- | --- | --- |
| EN-1 | Any single entry can be opened from the day's log (Today or Review), edited and deleted. Editing keeps the entry id and the rules of creating: a reaction cannot be before its meal, a day has one check-in, and flare markers keep start before end. Deleting asks for confirmation in an action sheet that names what goes with the entry (a meal's reactions, an entry's photos) and leaves a tombstone (EX-13). Deleting a flare start also removes its end; deleting an end alone reopens the flare. Areas, treatments and tags that entries use are archived, not deleted | Must |

## LLM features

The LLM is the Anthropic API, paid per use through a Console account. A Claude Pro subscription does not cover API calls. The app calls the API directly from the phone; no backend is assumed.

| ID | Requirement | Priority |
| --- | --- | --- |
| LL-1 | Photo to ingredients: send a meal photo, get an ingredient estimate back, shown for review (see IN-3) | Must |
| LL-2 | On-demand pattern analysis over a user-chosen date range, over all record types: intake, allergen tags, treatments, change events, daily check-ins, stool, skin and nail entries, and flares. It asks for the order and lag between flare start, digestive changes and nail changes | Must |
| LL-3 | Analysis windows: same day, 24 h, 48 h and 72 h after intake, not only the previous meal; plus 7-day and 21-day lookbacks for illness, antibiotics, stress, sleep and change events | Must |
| LL-4 | The prompt asks for tentative hypotheses with stated uncertainty and the data behind each one, never conclusions. It treats treatments as confounders, counts and discounts days not marked complete (SK-11), and says so when the data cannot answer a question, for example for a food eaten on most days | Must |
| LL-5 | Before every run, a confirmation screen lists exactly what will be sent: date range, entry counts, and which photos. It also states that the run is billed separately by Anthropic to the user's API account and is not covered by a Claude subscription. The confirmation for a photo estimate (IN-3) carries the same notice | Must |
| LL-6 | Photos are excluded from analysis by default; the user opts in per run and selects some or all, sensitive photos included only by explicit choice | Must |
| LL-7 | Each analysis is stored as its own object: date range, model, run date, prompt version, result. Raw entries are never modified | Must |
| LL-8 | Failures (no network, invalid key, rate limit, spend cap reached) show a clear message and lose no data | Must |
| LL-9 | Model name is a setting, not hard-coded | Must |
| LL-10 | LLM provider abstraction: one interface for photo-to-ingredients and one for analysis, with a separate adapter per provider (Anthropic first). Provider, model and key are settings, and prompts are provider-agnostic | Must |
| LL-11 | LLM output language follows the app language, which is the device language (English or Polish; UX-7) | Should |
| LL-12 | While an LLM call runs, the app stays usable and the state is visible. An analysis shows a progress screen with elapsed time (no invented percentage) and a Cancel button, and keeps the screen awake. Leaving the screen inside the app does not stop the run, and Review shows a running or ready card. A photo estimate runs inline in the form, which stays editable, and offers Cancel after 30 seconds. Cancel, failure and interruption (for example the app was left) store nothing and offer a one-tap retry. A timeout is never retried automatically; only connection errors and 429 or 5xx responses are, at most twice | Must |

Photo selection for LLM runs is independent of photo selection for exports (see Export).

## Export

Export is the backup and the way to share data with a doctor. It produces one ZIP for a chosen date range.

| ID | Requirement | Priority |
| --- | --- | --- |
| EX-1 | `data.json`: full raw data, with a `schema_version` field, stable entry IDs, and UTC timestamps plus local timezone. It is a snapshot of the chosen range, not the live store. Records (meals with allergen tags, other intake, treatment applications, change events, reactions, daily check-ins, stool, skin and nail entries, flares) and settings (areas with their kind, the daily tag list, the treatment list) are separate sections, and the user chooses to export records, settings or both. Deleted single entries are listed in a `tombstones` section of the records (EX-13). Settings also hold favorites, the quick-action layout and the suggestion settings (IN-14, UX-2) | Must |
| EX-2 | `photos/` folder with predictable file names (for example `2026-11-11_chin_01.jpg`), referenced from `data.json` by relative path | Must |
| EX-3 | `report.pdf`: readable summary for a doctor with a flare timeline, per-area trends, photo comparisons including a per-nail photo timeline, check-in and digestion trends, treatments, change events and the intake log, in a selectable language (English or Polish) that defaults to the app language | Must |
| EX-4 | LLM analyses appear in a separate, clearly labeled section of the PDF as AI-generated, tentative hypotheses | Must |
| EX-5 | Optional CSV files, one per table, for spreadsheet use | Should |
| EX-6 | Optional password protection, off by default, entered at export time (twice) and never stored; AES-256 encryption (WinZip AES), not the legacy ZIP scheme; at least 12 characters. Import asks for the password when the file is protected | Must |
| EX-7 | Photo selection for export: all, none, non-sensitive only, or a custom selection by area, date range or single photo; default excludes sensitive photos | Must |
| EX-8 | The selection applies to everything in the bundle, including photos shown in the PDF | Must |
| EX-9 | Delivery through the iOS share sheet (Files, AirDrop, email) | Must |
| EX-10 | Import of a `data.json` export (the ZIP) to restore or migrate: Expo Go to a standalone build, or an old phone to a new one. Import checks schema\_version, shows entry counts before applying, offers merge or replace, and skips duplicates by entry ID. The user chooses what to import (records, settings or both) when the file contains both; replace affects only the chosen parts: replacing records leaves areas untouched; replacing settings overwrites areas by id and removes user areas that are not in the file and not used by any remaining entry (predefined areas always stay). When a merge would skip entries because of a tombstone, the preview says how many and a switch restores them anyway (for example after deleting something by mistake); restoring removes the tombstone. Replace brings back everything in the file, tombstones included. Merge keeps local values of areas that already exist, and of favorites, the quick-action layout and the suggestion settings; replace overwrites them. Merge applies incoming tombstones and never restores an entry whose id has a tombstone (EX-13). The API key is not part of an export, so it is re-entered after a migration. Rejects a `data.json` over 50 MB (text only; photos are not subject to this limit) | Must |
| EX-11 | Export “since last export” as an alternative to a date range, to keep files small over months of logging | Should |
| EX-12 | Newest-wins merge for edited entries: each record gets a modified timestamp and merge keeps the newest version. Until then, merge skips ids that already exist (tombstones excepted, EX-13) | Later |
| EX-13 | Tombstones: deleting a single entry (EN-1) stores a tombstone with the entry id, its kind and the deletion time, and nothing else. Tombstones are exported (EX-1). An id with a tombstone is never restored by a merge import, and an incoming tombstone deletes the local entry with that id. Entry ids are never reused. Bulk delete (SE-9) leaves no tombstones, so a wipe can be followed by a restore from a backup | Must |
| EX-14 | Two export presets. Doctor report (Review): a date range, the PDF report, sensitive photos excluded by default (EX-7). Full backup (Settings, Data and backup): records and settings, all photos including sensitive ones, optional password (EX-6), for backup and migration | Must |

Date ranges are chosen as local calendar days and converted to UTC bounds using the device's current timezone at export time (inclusive at both ends). A later setting may change this.

The API key is never included in any export. The export screen warns that photos may be sensitive, and that a forgotten ZIP password cannot be recovered. Some tools do not open AES-encrypted ZIPs natively, so the recipient may need a tool such as 7-Zip. In an encrypted ZIP the file names, sizes and dates stay readable (a limitation of the ZIP format), so photo file names must not reveal more than necessary, and the password key derivation is weak by design (1000 PBKDF2 rounds), so the export screen asks for a long passphrase.

## User interface and navigation

The design follows Apple's Human Interface Guidelines (audited 2026-11-14, see `docs/ux-design.md`). Screens stay simple: daily actions are close at hand, and everything else is nested.

| ID | Requirement | Priority |
| --- | --- | --- |
| UX-1 | Navigation: two tabs, Today and Review. Settings opens from a gear icon on Today as a pushed screen with the tab bar visible. Titles are short (under 15 characters) and never the app name. Tabs are never hidden or disabled; an empty section explains why it is empty | Must |
| UX-2 | Today is the start screen: a day switcher (previous, next, jump to a date), a grid of quick actions (Meal, Skin, Treatment, Check-in, Stool, More), one-tap treatment shortcuts, context cards (an open flare, a day not yet complete) and the day's log. Quick actions can be reordered and hidden in an Edit mode on Today itself, with up and down buttons instead of dragging. More is a pushed list: alcohol, medication or supplement, reaction after a meal, nail update, flare start or end, started or stopped. Today can show any day: a new entry for a past day defaults to the current clock time on that day, future times are blocked, and after midnight the app returns to today unless the user chose another day. A card shows the time since the last export once it passes 7 days | Must |
| UX-3 | Entry forms are full-height modals with a title that names the task, Cancel on the leading edge and Save on the trailing edge. Save stays disabled until the required data is present and the form shows what is missing. Time defaults to now. Swiping down with unsaved changes opens an action sheet (Discard Changes, Cancel). One modal at a time and no nested screens inside a form. The meal form has two phases, choose and review (IN-7). Quick sheets (stool, treatment shortcuts) are the exception: picking an item saves it at the current time, and "Earlier…" opens the full form | Must |
| UX-4 | Density rules: one purpose per screen; at most about five visible controls before Save; defaults over fields; no always-visible hints; groups of more than about eight chips collapse into a summary with an Edit action; rare and destructive actions only at the bottom of Settings; details behind switches | Should |
| UX-5 | One-tap logging (treatment shortcuts, stool, and suggestion taps for alcohol and medication when "save on tap" is on) shows the new entry in Today's log, scrolled into view and highlighted, with edit and delete (EN-1). There are no timed toasts. "Save on tap" is off by default and never applies to meals: a meal suggestion always leads to the review phase (IN-7) | Must |
| UX-6 | Settings is a grouped list with chevron rows, in these groups: Logging (suggestions, daily check-in scores, skin and nail areas, treatments, favorites), Reminders (with a button to the system settings when notifications are denied), Privacy and photos, AI analysis (key, model), Data and backup (export and import, each with a choice of records, settings or both, and Delete data last behind an action sheet and a second confirmation), About. Every setting ships with a sensible default. Task-specific options (Review filters, Home layout) live in their own screen. Settings never duplicate system settings such as appearance, text size or language | Must |
| UX-7 | The UI language is the device language. There is no in-app language setting. The report language is chosen per export (EX-3) and analysis answers follow the app language (LL-11). In Expo Go the language is whatever Expo Go serves for the device. A standalone build may later declare its languages so iOS offers a per-app language | Must |
| UX-8 | Accessibility, deferred and not planned unless the app is ever distributed or commercialized: touch targets at least 44 by 44 points; body text 17 points and nothing below 11; Dynamic Type up to at least 200 percent with layouts that reflow (fewer grid columns, no fixed-height text containers, meal names not truncated); contrast at least 4.5 to 1 in light and dark; meaning never carried by color alone; VoiceOver labels on icon-only buttons; every swipe or drag has a button alternative; no auto-dismissing interface elements | Later |
| UX-9 | Destructive actions (delete an entry, bulk delete, discard changes) use an action sheet with the destructive choice at the top and Cancel at the bottom | Must |

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
| SE-9 | Bulk delete on request: by date range, by entry type, or everything including photos. A confirmation states what will be removed and that it cannot be undone, and offers an export first. Data is otherwise kept until the user deletes it. Bulk delete leaves no tombstones (EX-13) | Must |

**Accepted risks:** anyone who controls the device or its certificate trust settings can see the key in network traffic while it is in use, since Keychain protects the key at rest only. A jailbroken or unlocked phone exposes its contents. Data sent to the API is processed by a third party; Anthropic's current retention and training terms for API usage need checking before the first run.

**Backup:** with local-only storage, a lost or reset phone loses the diary. Regular export is the backup, and the app reminds the user to export: a monthly reminder (SK-9) and a card on Today after 7 days without an export, because free-account builds expire weekly.

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
| NF-2 | A new log entry takes under a minute and a few taps. The daily check-in takes under a minute, and a skin update with no change is one tap per area, or two taps for all areas. Tap budgets: a repeated meal 3 taps (New meal, suggestion, Save), a favorite treatment 1 tap, a stool entry 2 taps | Must |
| NF-3 | No data loss on app restart, crash or failed LLM call | Must |
| NF-4 | Timestamps are stored in UTC with the local timezone, so travel and daylight saving do not scramble the timeline | Must |
| NF-5 | Photos are compressed on save to keep storage use reasonable over months of daily logging | Should |
| NF-6 | All user-facing text is localized in English and Polish, with English shipped first; no hard-coded strings, and dates, units and number formats follow the device locale. The UI language is the device language; there is no in-app language setting (UX-7) | Must |

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
- Areas have a kind (skin or nail); nails are tracked per affected nail with a stage, an extent and photos.
- One daily check-in record per day holds wellbeing, stress, sleep, digestion and daily tags; closing it marks the day complete.
- Skin scores stay 0–10; prefill and "no change" keep logging fast.
- Medical history and notes about a diagnosis are kept outside this repository.
- App text and the doctor-facing PDF support English and Polish; English ships first.
- Bulk delete on user request; data is kept until the user deletes it.
- Designed for extension: ports and adapters, bring your own key, localization from day one.
- Navigation and screens follow the HIG: two tabs (Today, Review), Settings behind a gear icon, full-height modal forms with Cancel and Save, action sheets for destructive actions (UX-1 to UX-9).
- Meal suggestions come from the diary's own history and fill an editable form; choosing one never saves by itself (IN-7, IN-14).
- Single entries can be edited and deleted (EN-1). Deleting leaves a tombstone from the start (EX-13); bulk delete leaves none; the newest-wins merge for edits stays Later (EX-12).
- Favorites, the quick-action layout and the suggestion settings travel in the export's settings part; the API key never does.
- A locally suggested allergen tag counts as confirmed once it is visible and pre-selected on the form (IN-10).
- No in-app language setting: the UI follows the device language (UX-7).
- The PDF report language defaults to the app language and is chosen per export (EX-3).
- Bulk delete leaves no tombstones, so a wipe can be undone by restoring a backup. A single entry deleted by mistake can be restored from a backup with the import switch in EX-10.
- Export and import both let the user choose records, settings or both (EX-1, EX-10); the Data and backup screen keeps these switches.
- The accessibility pass (UX-8) is deferred and not planned unless the app is ever distributed or commercialized.
- Meals are logged in two phases, choose then review; the LLM's ingredient estimate is editable and never overwrites typed text (IN-3, IN-7).
- Every LLM confirmation says the call is billed separately by Anthropic (LL-5). Waits show elapsed time with Cancel, never retry a timeout, and store nothing on cancel or failure (LL-12).
- Tapping a reminder opens its target (SK-9). Backup has its own Full backup preset that includes all photos (EX-14).
- Flow defaults accepted: deleting a meal also deletes its reactions, duplicate active area names are rejected, closing a day with no meals asks first (EN-1, SK-2, SK-11). Details in `docs/user-flows.md`.

**Open**

- [ ] Barcode data: is Open Food Facts coverage of Polish products good enough in practice? Polish codes are present, but the data is crowd-sourced, so it will be tested in the app on products actually bought. The lookup sits behind an interface, so the source can be swapped.
- [ ] Before starting the project, check which Expo SDK the current App Store version of Expo Go supports, and create the project on that SDK.

## Changelog

- **v0.4.2 (2026-11-14):** user flows and edge cases. New: LL-12 (waiting for the LLM), EX-14 (Doctor report and Full backup presets). Changed: IN-3 (editable estimate), IN-7 (choose and review phases), IN-14, LL-5 (billing notice), SK-2 (unique names), SK-9 (tap targets, monthly reminder), SK-11 (confirm an empty day), EN-1 (edit rules, cascades), UX-2 (past days, backup card), UX-3 (quick sheets), UX-5, Backup paragraph.
- **v0.4.1 (2026-11-14):** EX-3 report language defaults to the app language; EX-10 gets a switch to restore entries skipped because of a tombstone; UX-6 names the records/settings choice for export and import; UX-8 (accessibility) moved to Later.
- **v0.4 (2026-11-14):** information architecture and HIG audit. New: IN-14 (suggestions), EN-1 (edit and delete one entry), EX-13 (tombstones), a User interface and navigation section (UX-1 to UX-9). Changed: IN-7 rewritten (a suggested meal fills an editable form), IN-10 (diary-history tags count as confirmed), IN-11 and IN-12 (shortcuts, "stopped" offers open items), SK-3 (no change for nails and for all areas), SK-7 ("same as yesterday", switchable scores), LL-11 and NF-6 (UI follows the device language, no in-app setting), EX-1 and EX-10 (tombstones, preferences in settings), EX-12 (now only newest-wins for edits), SE-9, NF-2 (tap budgets).
- **v0.3 (2026-11-13):** tracking widened beyond food. Daily check-in with digestion (SK-7) and a day-complete mark (SK-11); daily tags replace free-form triggers (IN-6); allergen tags (IN-10), treatments per area (IN-11, split from IN-5), change events (IN-12) and immediate reactions (IN-13); nail areas (SK-10); prefill and "no change" for skin scores, which stay 0–10 (SK-3); nail photo reminder (SK-9); analysis covers all record types, adds 7- and 21-day lookbacks and must say when the data cannot answer (LL-2, LL-3, LL-4); export and PDF follow (EX-1, EX-3); NF-2 clarified.
- **v0.2.2 (2026-11-12):** EX-6 minimum password length 12 and double entry; import prompts for the password.
- **v0.2.1 (2026-11-12):** EX-10 states the replace/merge rules per part.
- **v0.2 (2026-11-12):** this file is now canonical in the repo (was an exported snapshot). Export/import split into records and settings (EX-1, EX-10); SK-2 gets `name_override` for predefined areas; EX-10 states the 50 MB `data.json` limit; EX-12 (newest-wins merge) added as Later; export date ranges are local days converted to UTC.
