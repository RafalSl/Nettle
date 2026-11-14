# UX design: information architecture

Status: accepted 2026-11-14 and built (see `docs/open-questions.md`, "Status of the decided work", for what is still missing). Requirements are in `docs/requirements.md` (v0.4.2). Flows and edge cases: `docs/user-flows.md`. This file holds the screen map, the rules behind it and the HIG audit.

## Why

The first screens carried too much on one page: More held eight forms, Today about forty controls, Data mixed unrelated concerns, and every form repeated time, note, hints and "Recent" lists. Goals: a simple start screen, daily actions in a few taps, everything else nested.

## Screen map

```
Tabs:  Today | Review

Today (start)                              gear -> Settings (pushed)
  day switcher  < date >
  quick actions  Meal  Skin  Treatment  Check-in  Stool  More      [Edit]
  treatment shortcuts  (one tap: treatment + areas)
  context cards  open flare, day not complete
  the day's log  (latest 8, "Show all (n)" opens the day in Review; tap a row: edit / delete)

More (pushed list)  Drink, Medication or supplement, Reaction after a meal,
                    Nail update, Flare start or end, Started or stopped

Forms (full-height modal, one at a time)
  Cancel | title | Save          time chip "Now"

Review
  Doctor report (export preset)  |  AI analysis  |  Days list (edit, delete)  |  per-area timeline (SK-8, later)

Settings (grouped list, chevrons)
  Logging: Suggestions, Day start, Daily check-in scores, Skin and nail areas, Treatments, Favorites
  Reminders
  Privacy and photos
  AI analysis (key, model per action)
  Data and backup: Export and Import (each: records / settings / both), Delete data (last)
  About
```

Route sketch (expo-router): `(tabs)/today`, `(tabs)/review`, `today/more`, `today/settings/*` as stack screens, and the forms in a modal group (`presentation: 'modal'`).

## Density rules (UX-4)

- One purpose per screen; at most about five visible controls before Save.
- Defaults over fields; time defaults to now.
- No always-visible hints and no "Recent" lists on forms (suggestions are the only exception).
- More than about eight chips collapse into a summary plus Edit.
- Rare and destructive actions only at the bottom of Settings; details behind switches.
- Tap budgets (NF-2): repeated meal 3 taps, favorite treatment 1, stool 2, skin "no change for all" 2.

## Suggestions (IN-14)

A pure core function `rankSuggestions(history, favorites, now, options)` over existing entries. No new tables, nothing leaves the device.

- **Order:** favorites first, then the most frequent items in the window (default 30 days), then the most recent distinct items to fill the list (default 5 rows). Deduplicated. Each row shows a hint: count, "yesterday" or a star. Typing filters the whole history.
- **Identity:** a meal is its normalized description. Choosing it copies the latest use's ingredients and allergen tags into the form. The user edits freely and saves a new, independent entry.
- **Settings:** rows (default 5), window (7, 14, 30, 60 days), "save on tap" (off; only for drinks and medication, never for meals).
- **Alternative kept for later:** frecency (one score from frequency and recency, with exponential decay). Only the ranking function would change.

| Input | Approach |
| --- | --- |
| Meal | choose phase (suggestions or typing), then review phase with editable ingredient chips and autocomplete |
| Drink, medication, supplement | recent (item, amount) pairs from the same function |
| Treatment | one-tap shortcuts for treatment plus areas |
| Started or stopped | "stopped" offers items started and not stopped |
| Skin and nails | prefilled with the last values, "No change" per area and for all areas |
| Daily check-in | explicit "same as yesterday", never a silent prefill |
| Stool, reaction, flare | fixed lists |

## Editing, deleting, tombstones (EN-1, EX-13)

Any entry can be edited or deleted from the day's log. A delete leaves a tombstone (id, kind, deletion time, nothing else), exported in `data.json` under `tombstones`. A merge import never restores a tombstoned id and applies incoming tombstones to local entries. Bulk delete (SE-9) leaves no tombstones so that a wipe followed by a restore works. A single entry deleted by mistake can be restored from a backup: the merge preview counts the entries skipped because of a tombstone and offers a switch to restore them anyway (EX-10); Replace restores everything in the file. Newest-wins merge for edits (EX-12) stays Later. `schema_version` stays 1 in development, so exports made before this section will not import (decided: versioning starts after the first release).

## HIG audit (2026-11-14)

Read: tab bars, toolbars, sheets, modality, action sheets, settings, entering data, lists and tables, undo and redo, accessibility, steppers, and the Dynamic Type part of typography (developer.apple.com/design/human-interface-guidelines).

| Area | Finding | Resolution |
| --- | --- | --- |
| Tab bar | navigation only; no hidden or disabled tabs; explain empty sections | two tabs; no center "+" tab; empty states explain (UX-1) |
| Settings | infrequent options only; task options belong in the task; do not duplicate system settings; keep the number small | gear icon, not a tab; Home layout edited on Today; no language setting; each setting has a default (UX-6) |
| Sheets and modality | Cancel leading, Done or Save trailing; confirm before data loss; one sheet at a time; keep modal tasks short | UX-3; More is a pushed list so forms are the only modals |
| Entering data | prefer choices, prefill defaults, enable the primary action only when data is complete | suggestions, chips, Save disabled until required data is present |
| Undo | show the result of an action; avoid timed UI | highlighted row in the log instead of a toast (UX-5) |
| Destructive actions | action sheet, destructive choice on top | UX-9 |
| Accessibility | 44 pt targets, Dynamic Type to 200 percent, contrast 4.5 to 1, not color alone, gesture alternatives | UX-8, deferred (Later); only if the app is ever distributed |

## Not verified

- HIG pages not read: buttons, pickers, toggles, segmented controls, materials and Liquid Glass, VoiceOver.
- "Save" is used on forms; the HIG names "Done" and "saving changes". The trailing placement and the Cancel pairing are verified.
- Expo Go: large titles, `expo-symbols`, the sheet grabber, how the JS tab bar looks next to the iOS floating tab bar, and shake to undo are untested. The design does not depend on any of them.
- Language: Expo documents per-app language through the `expo-localization` config plugin (`supportedLocales`), which needs a native build, so it cannot work in Expo Go. The decision is therefore no in-app setting; Expo Go follows the device language.

## Decisions recorded

1. Navigation: Today and Review tabs, Settings behind a gear icon.
2. Deletion markers are designed in now (EX-13); bulk delete leaves none; newest-wins merge stays Later.
3. Preferences (favorites, quick-action layout, suggestion settings) are exported with the settings part; the API key never is.
4. A locally suggested allergen tag counts as confirmed when visible and pre-selected on the form.
5. No in-app language setting; the UI follows the device language.
6. A suggested meal fills an editable form with the latest ingredients; it never saves by itself.
7. The PDF report language defaults to the app language.
8. The accessibility pass is deferred and not planned unless the app is ever distributed.
9. Export and import keep the choice of records, settings or both (already built on the Data screen).
10. Meals have a choose phase and a review phase; the LLM estimate is editable and added as normal chips.
11. LLM waits show elapsed time and Cancel; every LLM confirmation carries the billing notice.
12. Two export presets: Doctor report and Full backup (all photos).
13. Reminder taps open their target; flow defaults (cascade deletes, unique area names, empty-day confirmation) are accepted.
