# First-use review (2026-11-23)

The user has started using the app day to day, before any formal release. This file collects their remarks and the notes from the phone test plan (`docs/phone-test-plan.md`, run in progress). For each item it gives what the code does now, the cause where one was found, and a proposed fix. The proposals are not built yet. Items marked **Decide** were answered on 2026-11-23 (see the end of this file).

Code read: `develop` at a9a5d7c. Nothing was run on a phone for this review.

## 0. Ground rule: the diary now holds real data

**User's decision (2026-11-23):** every change to a data structure ships with a data migration. This replaces the "Prototyping phase" rule in CLAUDE.md (no migrations until the first release). CLAUDE.md, `docs/requirements.md` (NF-8) and `docs/open-questions.md` are updated in this branch.

What that covers, and where we are now:

| Store | Today | Needed |
| --- | --- | --- |
| SQLite schema (`adapters/storage/migrations.ts`) | Append-only steps, `PRAGMA user_version`, one transaction per step. Good. | Keep it that way. A step that changes data (not just adds a column) gets a test that upgrades a database at the previous version with synthetic rows and checks the result. No more "prototype data only" steps like the `area-intimate` one. |
| Preferences JSON (`preference` table) | No version. Missing keys are filled from the defaults on read (`sqliteRepo.getPreferences`). This works for additions only. | A `version` field and a chain of pure upgrade functions in `core/model/preferences.ts`, run on read and on import. First real use: re-keying drink favorites (item 11) and adding `moreOrder` (item 9). |
| Export `data.json` (`schema_version` 1) | The reader refuses anything that is not exactly the current shape. | Bump `schema_version` to 2 when the skin check and area order land. The reader keeps accepting 1 and upgrades it in memory (no check id, default area order), so every backup made so far still imports. |
| Photos | Files keyed by entry id. | Unchanged by anything below: photos stay attached to the per-area skin entry. |

Two safety nets, proposed:
- **Copy the database before migrating.** When `migrate()` finds pending steps on an existing database, it copies the SQLite file to `nettle-before-v<N>.db` first and keeps only the latest copy. Cheap, and it covers a bad migration that a test missed. (Like taking a snapshot before running a schema migration on a production database.)
- **Full backup before each new build.** Add one line to the test plan's Setup and to the README: export a Full backup before installing a build or restarting the dev server on a changed branch.

**Test plan conflict.** `docs/phone-test-plan.md` Setup says "start from a clean state: Delete data" and "use only synthetic data". With a real diary on the phone, the destructive checks (S0 setup, E6 Delete data, E7 Replace import, E8) would wipe it. Proposal: run them only right after a Full backup, and restore afterwards; or add a developer-only "test diary" switch that opens a second database file (the import test on 2026-11-12 already did this by hand). **Decide** which.

## 1. Skin: one check for all areas (most important)

### What the user hit
- Each area is a separate entry: pick a chip, set scores, Save, the form closes. Then Skin again, and you have to remember which areas are done (you check the log), and which one comes next.
- The form never says which area you are editing, except for the selected chip.
- Each area is its own dot on the ring and its own row in the log.
- The order is not yours to set.

### Cause in the code
- `SkinForm` saves one `SkinEntry` and calls `router.back()`. Each save is a new row in `dayLog` and a new dot in `ringDots`.
- The area chips come from `listAreas()`, which reads `SELECT * FROM skin_area ORDER BY id`. So the order is alphabetical by id: behind the ears, between the buttocks, chin, ears, neck, penis, perineum, sternum, then user areas by their random ids. That is why the order feels arbitrary.
- The header title is a fixed `nav.skin` ("Skin" / "Skóra").

### Data model proposal
Keep one `SkinEntry` per area. The flares (SK-6), time to relapse (SK-12), area timelines (SK-8), photos (SK-4), the report and the analysis all work per area and need no change. Add a grouping:
- `skin_entry.check_id TEXT NOT NULL` and `nail_entry.check_id TEXT NOT NULL`: all entries saved together share one id and one timestamp. A check is not a table of its own: it is the set of entries with the same `check_id`. (Like a batch id on rows written by one request.)
- `skin_area.position INTEGER NOT NULL`: the user's order, used everywhere areas are listed.

Migration (one SQL step plus a data step, with an upgrade test):
- `position`: predefined areas in the SK-1 order (chin, neck, ears inside, behind the ears, sternum, penis, perineum and groin, between the buttocks), then user skin areas by name, then nail areas by name.
- `check_id` for existing entries. **Decide**:
  - **A (safe):** entries with the exact same timestamp (what "No change for all areas" saves) share one check; every other entry becomes a check of one area.
  - **B (recommended for your diary):** as A, plus entries of different areas saved within 15 minutes of each other on the same local day are grouped into one check, keeping each entry's own time. This turns what you logged area by area so far into checks. It cannot be undone cleanly after the fact, so the database copy above matters.
- Export: `check_id` on skin and nail entries, `position` on areas (schema 2, version 1 upgraded on import as in section 0).

### UX proposal: a stepper, one area per screen
Opening Skin starts a **skin check** over all active areas in your order (skin areas first, then nails, if any).

```
 Cancel        Skin · Neck  2/8
 ───────────────────────────────────────
 [✓Chin] [●Neck] [ Ears] [ Behind] [ St…  ← area strip (scrolls)
 Neck
 Last: yesterday 21:40 · severity 6
 Severity   ──────●──────  6   − +
 Itch       ────●────────  4   − +
 ...  cracks, size (Details), photos, note
 ───────────────────────────────────────
 [ No change ]  [ Skip ]   [ Next → ]       ← floating bar
```

- **Title shows the area and the step**: "Skin · Neck 2/8" ("Skóra · Szyja 2/8"), set through the screen's header title, so it is always visible while scrolling. The area name also opens the body of the step in large type.
- **Area strip** under the header: one chip per area in your order, with its state: pending, current (accent), changed (✓), no change (=), skipped (–). Tap a chip to jump there. It scrolls itself to keep the current chip visible.
- **One step = one area**: the same fields as now (five scores, cracks, size, photos, note), prefilled from that area's last values, with "Last: yesterday 21:40 · severity 6" so you know what you are comparing against.
- **Floating bar** instead of a single Save: *No change* (keeps the last values, marks =, moves on; hidden for an area with no earlier entry), *Skip* (not logged this time), *Next* (keeps what you set). Any of the three moves to the next pending area, so you never have to choose the next one yourself.
- **Summary step** at the end: a table (area, the five scores, ✓ = –), one time field for the whole check (default now), and **Save**. Tap a row to go back to that area. Areas you did not reach are listed as "Not logged: …" with a "No change for these" button.
- **No change for all areas** stays as the first button of step 1: it marks every area with an earlier entry as = and jumps to the summary (still two taps, SK-3, NF-2).
- Leaving with unsaved steps shows the Discard Changes sheet (UX-3). No draft is kept across launches (simplest; say if you want one).

One check = one entry:
- **Ring**: one hollow dot for the check.
- **Log**: one row, "Skin check · 6 areas · worst: Neck 7" (plus "· 1 skipped" when relevant).
- **Tap**: Edit opens the same stepper with the check's areas; areas skipped that time can be added. Delete removes the whole check and names what goes with it ("6 areas, 2 photos").
- **Area timeline** (SK-8) keeps one line per area entry; a tap on it opens the check's editor at that area.

### Area order
Settings, Logging, Skin and nail areas gets up and down buttons per area (the Edit Today pattern, no dragging). The same order drives the stepper, the strip, Review, Areas, the report and the area pickers of the treatment form. Order lives in `position` and travels with the settings export.

### Requirements affected
SK-3 (the form), SK-2 (order), UX-2 (ring and log rows), EN-1 (editing a check), SK-8 (tap from the timeline), EX-1 (two new fields), NF-2 (tap budget unchanged).

## 2. Form titles not translated to Polish

- Every registered title (`_layout.tsx` and the three nested stacks) uses a `nav.*` key, and all 36 `nav.*` keys have Polish values; `pl.json` has no missing keys. So it is not a missing string.
- Suspect: titles are computed when the navigator mounts. After the in-app language switch (task 17) the root `Stack` is remounted by its key, but the work log already flagged that this was never checked on the phone (S5). If the switch does not remount every nested stack, the titles keep the old language while the screen bodies (rendered again) switch.
- **Needed from you:** which titles stayed English, and whether they are Polish after killing and reopening the app with Polski chosen (S7). If they are, it is the live switch.
- Fix either way: a small `useScreenTitle(key, params)` hook that sets the header title from the screen itself and re-runs on a language change; a screen test that renders every route in Polish and compares each header title with `pl.json`.

## 3. Review day: date and weekday in the title

`ReviewDayScreen` has the fixed stack title "Day" ("Dzień") and shows the raw `2026-11-22` as a heading. Proposal: title "Sunday, 22 November" ("niedziela, 22 listopada"), with the year when it is not the current one, through `dayParts` and the same `useScreenTitle` hook; drop the raw heading.

## 4. Review: scores as a table

The area timeline (SK-8) prints each entry as one line of text: "Severity 7, Itch 5, Pain 2, Dryness 6, Scaling 4, cracks". Proposal, used on the area timeline, the skin check summary and the check's row in the day view:

```
            Sev  Itch Pain Dry  Scal
 22 Nov 21:40  7    5    2    6    4   ⚠ 12 mm  📷2
 21 Nov 20:15  6    5    1    6    4
```

- Fixed columns with tabular figures, short headers with a one-line legend under the table (Polish: Nas., Swędz., Ból, Such., Łusz.).
- A severity at or above the area's flare threshold gets the coral circle used elsewhere.
- Cracks as a mark, size in mm, a photo count; a tap on a row opens its Edit and Delete sheet as now.
- The day view lists a check as one row with one table line per area.

## 5. Today: the layout jumps when leaving today

Cause found in `TodayScreen`: going from today to yesterday changes the structure of the screen, going between two past days does not.
- The "Back to today" button is inserted as a full-width row between the ring and the pills, pushing everything below it down.
- `todayContext` returns no pills for a past day, so the pills row collapses at the same moment.
- (The arc disappears too, but it is drawn inside the ring and does not move anything.)

Fix: keep the same structure on every day.
- "Back to today" becomes a small chip in the top bar, left of the gear (that row is empty on the left now), so it takes no height.
- The pills row keeps its height on a past day and shows a day status pill instead: "Daily health saved ✓" or "Day not fully logged" (SK-11). It is useful in itself and keeps the layout still.
- If anything still changes height, the section uses a short layout animation rather than a jump.

## 6. More: the user sorts the rows

More lists the unpinned types in the fixed `ENTRY_TYPES` order; Edit Today's In More list has only Pin buttons. Proposal: `quickActions.moreOrder` in the preferences (upgrade: the current order), up and down buttons on the In More list in Edit Today, and More follows that order. Pinning takes a type out of the list; unpinning puts it back at the end.

## 7. Edit Today: hard to picture the grid

The pinned list is a vertical list, but Today shows a 3 by 2 grid. Proposal:
- A live **preview of the grid** at the top of Edit Today, the real tiles at a smaller size, with More last. It changes the moment you move or pin something.
- A position number on each pinned row (1 to 5) that matches a number on its preview tile.
- The list rows stay the way you edit (up, down, unpin, pin), so nothing needs dragging.

## 8. Ring: entries of a merged dot cannot be edited or removed

The sheet's rows do have an action: a tap closes the sheet and then calls the native action sheet. Likely cause: the native iOS action sheet is asked for while the quick sheet (a React Native `Modal`) is still closing, and iOS silently refuses to show it then. So the tap looks like it does nothing.

Fix, inside the sheet itself:
- Each row gets two round buttons at its end: Edit (pencil) and Delete (bin).
- Delete turns the row into an inline confirmation in the sheet: "Delete meal 12:05? Also 1 reaction." with Delete and Keep. No second sheet over the first.
- Edit closes the sheet and opens the edit form only after the sheet has finished closing (the `Modal`'s `onDismiss`).
- A skin check in the sheet is one row (section 1).
- The same "wait for the sheet to close" fix goes into any other place that opens a native sheet from a quick sheet.

## 9. Stool form: a different layout

The full form (`StoolForm`) shows seven chips labelled 1 to 7; only the Today quick sheet has the names. Proposal for the form, the edit form and the quick sheet alike:
- Seven full-width rows grouped in three bands: Hard (1–2), Normal (3–4), Loose (5–7).
- Each row: the number in a circle, a small glyph of the shape, the name, and a one-line description, for example
  1 Hard lumps: separate hard lumps, hard to pass ·
  2 Lumpy sausage: sausage-shaped but lumpy ·
  3 Cracked sausage: sausage shape with cracks on the surface ·
  4 Smooth sausage: smooth and soft ·
  5 Soft pieces: soft blobs with clear edges, passed easily ·
  6 Mushy: fluffy pieces with ragged edges ·
  7 Watery: liquid, no solid pieces.
- Glyphs are our own simple shapes in the icon style (round lumps, a lumpy bar, a cracked bar, a smooth bar, blobs, a ragged blob, a puddle), not a copy of any published chart.
- The quick sheet keeps one tap to save; it becomes a list of the same rows (slightly more scrolling, much easier to choose).
- **Decide:** glyphs plus descriptions (proposed), or descriptions only for a first version.

## 10. Drinks: recents by name only

`drinkKey` is `name|amount`, so "Coffee 200 ml" and "Coffee 250 ml" are two suggestions. Proposal: the key is the normalized name alone; picking it fills the amount, alcohol switch and ingredients of the most recent drink with that name; the hint can say "usually 250 ml". Favorites use the same key, so the preferences upgrade re-keys stored drink favorites by name and, where two collide, keeps the newer one.

## 11. From the phone test plan notes

| Check | Note | Proposal |
| --- | --- | --- |
| S2 | "todo check: the last item can be scrolled clear of the tab bar" | Still to run; nothing to change yet. |
| S5 | "want to switch it in the app" | Read as: test the in-app Language setting (task 17), not the phone language. That is what S5 does; it is still unmarked. |
| N4.1 | Polish "Jednakowy dla wszystkich" (flare scope) wraps to two lines, left aligned | `Segmented` labels have no centring and no line limit. Centre them, one line with a slight shrink to fit; if it still does not fit, a shorter Polish label ("Wspólny" / "Osobno"). |
| N4.2 | Privacy "Blokada Face ID albo kodem" and the meal's "Uzupełnij później z AI": text left aligned, too close to the rounded corner, switch at the top | `SwitchRow` is a full pill (radius 999). When the title or its hint wraps, the row grows taller and the round ends eat into the text. Fix: a smaller radius (the 26 pt card radius) for rows that wrap, more left padding, and the switch centred against the whole row. Check every `SwitchRow` in Polish. |
| N4.3 | Privacy may fit better under Data and backup or About | **Open question** (added to `open-questions.md`). |
| L1 | Should Favorite sit just under the name, next to the AI suggestion button? | **Open question** (added). |
| L3 | Placement and order of the pills and the suggestions in the drink form | **Open question** (added). |
| S4, S6, S7 | "checked only in Expo" | Fine for now; the standalone build repeats them. |
| S8 | "later" | Left for later. |

## 12. Proposed order of work

Each is one `feature/` branch from `develop`, with its migration and tests.

1. **migration-safety**: preferences version and upgrade chain, export schema 2 reader that accepts 1, database copy before migrating, Full backup line in the test plan. Everything below depends on it.
2. **area-order**: `position`, up and down in Settings, used by every area list.
3. **skin-check**: `check_id`, the stepper, the summary, the ring and log row, editing and deleting a check, the backfill (after the A or B decision).
4. **ring-sheet-actions**: inline Edit and Delete in the merged-dot sheet, `onDismiss` before any native sheet.
5. **today-steady-layout**: Back to today in the top bar, the past-day status pill.
6. **more-order-and-preview**: `moreOrder`, sorting In More, the live grid preview.
7. **review-day-and-tables**: day title with weekday, the score table.
8. **stool-layout**: the banded rows with descriptions (and glyphs, if chosen).
9. **drink-recents-by-name**: key by name, favorites re-keyed.
10. **polish-titles-and-rows**: the title hook and its test, `Segmented` and `SwitchRow` fixes, checked in Polish.

## Decisions (user, 2026-11-23)

1. Existing skin entries are grouped into checks: entries of different areas within 15 minutes (option B).
2. Destructive phone checks run after a Full backup, which is restored afterwards; no test diary.
3. Stool rows: descriptions only for now, no drawings.
4. Untranslated titles: no list yet. The fix is general (every title follows the language, with a test of every route in Polish); report any title still in English after it lands.
5. The skin stepper design is approved. Requirements v0.9.8 rewrites SK-3 and extends SK-2, SK-7, SK-8, EN-1, EX-1, IN-14, UX-2 and NF-6.

The work plan is `docs/work-plan-2026-11-23.md`.
