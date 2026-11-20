# UX design: information architecture

Status: accepted 2026-11-14 and built, then revised 2026-11-15 after the first phone tests (requirements v0.6). The revised parts are decided but not built; `docs/open-questions.md` ("Status of the decided work", "Decided in v0.6, not built") lists what is built and what is not. Revised again 2026-11-16 (requirements v0.7): everything marked "(v0.7)" is decided but not built. Revised again 2026-11-16 (requirements v0.8): everything marked "(v0.8)" is decided but not built, and what is marked "(Later)" is designed but not planned. Revised again 2026-11-21 (requirements v0.9): the Today redesign and the visual design, everything marked "(v0.9)" is decided but not built. Requirements are in `docs/requirements.md` (v0.9). Flows and edge cases: `docs/user-flows.md`. This file holds the screen map, the rules behind it and the HIG audit.

## Why

The first screens carried too much on one page: More held eight forms, Today about forty controls, Data mixed unrelated concerns, and every form repeated time, note, hints and "Recent" lists. Goals: a simple start screen, daily actions in a few taps, everything else nested.

## Screen map

```
Tabs:  Today | Review                      gear on both tabs -> Settings (pushed above the tabs)

Today (start)  (v0.9, UX-2, UX-12)                                   gear (top right)
  day ring        24 h dial from the day start; date in the centre (tap: date picker)
                  outer track: intake dots (filled)   inner track: body and care dots (hollow)
                  arc up to now; close dots merge with a count; tap a dot: Edit / Delete
                  swipe left / right: previous / next day (faint arrows too); past day: "Back to today"
  context pills   at most two: flare > Daily health (from its reminder time) > backup > AI suggestions
                  first-run card on an empty diary replaces them
  quick actions   at most 5 pinned circles (3 x 2 grid) + More   (default: Meal Skin Treatment Daily health Stool)
                  tap: quick sheet or form; long press: full form
  the day's log   newest first, latest 8, "Show all (n)"; tap a row: Edit / Delete; swipe left: Delete
  (no search field, no treatment shortcut row)

Edit Today (row in More, v0.9)   On Today: ordered list, up / down, Move to More
                                 In More:  Pin to Today (disabled while 5 are pinned)

More (pushed list)  (v0.9) search field on top: filters entry types and "Where do I log...?" situations
                    every entry type that is not pinned, each row with a one-line subtitle
                    (catalog: Meal, Drink, Medication or supplement, Skin, Nails, Treatment,
                    Daily health, Stool, Reaction, Routine change, Medical event (v0.7))
                    + "Where do I log...?" (guide, UX-11)  + "Edit Today" (v0.9)

Quick sheets (tile tap; a floating glass panel over Today)
  Medication: regular items, one tap each, + "Other or earlier..."
  Treatment: Regular, then (v0.9) Often used (the former shortcuts), + "Other or earlier..."
  Stool (only while pinned): types, + "Earlier..."

Forms (full-height modal, one at a time)
  Cancel | title                 time chip "Now"
  (v0.9) Save: a floating pill at the bottom, above the keyboard; disabled with a "missing" line above it
  Skin and Nails forms carry a photos control (SK-4)
  (v0.7) Skin form: "Cracks or open wounds" switch; size in mm behind a Details row (SK-3)
  (v0.7) Treatment application, edit screen only: Reaction  None | Mild | Strong (IN-11)
  (v0.7) Medical event form: kind, title, date, note; an illness adds an optional end date (IN-18)
  (v0.8) Meal and Drink review phase: "Suggest ingredients from the name" next to the photo and label
         buttons, shown once a description is typed (IN-19)
  (Later) Meal and Drink: "Fill later with AI" switch (IN-20)

Review
  Doctor report (export preset)  |  AI analysis
  [ Days | Areas ]
    Days:  month with < > and a jump picker, calendar grid (entries, Daily health, flare days),
           the month's days; filter "Incomplete days"
    Areas: Skin / Nails groups with last score or stage and date; flaring areas first
  per-area timeline (SK-8): trend chart, photo comparison, entries by day
         (v0.8) "Go to date" row with an inline date picker; a tap on an entry opens Edit / Delete (EN-1)
  (Later) AI analysis screen: "Use my Claude plan" -> Prepare a pack | Import a result;
          Suggestions to review (LL-15, IN-20)
  (v0.7) photos on the timeline and in the report carry a caption: time since the last treatment
         on that area (SK-4); the report adds time to relapse (SK-12) and medical events (IN-18)

Settings (pushed above the tabs, Back, no Done; grouped list, chevrons)
  Logging: Suggestions, Day start, Flare threshold, Daily health items, Skin and nail areas,
           Treatments, Regular items, Routine categories, Favorites
  Reminders and privacy: Reminders (summary of regular items), Privacy and photos
  AI analysis (key, model per action)
  Data and backup: Export and Import (each: records / settings / both), Delete data (last)
  About (incl. "Where do I log...?")
```

Route sketch (expo-router): `(tabs)/today`, `(tabs)/review`, `today/more` as stack screens, a root-level `settings/*` stack above the tabs (so the tab bar is hidden and Back returns to the originating tab), and the forms in a modal group (`presentation: 'modal'`). Moving Settings out of `today/settings/*` means two links change: the Today backup card and the monthly reminder target (SK-9), both of which pointed at `/today/settings/data`.

## Density rules (UX-4)

- One purpose per screen; at most about five visible controls before Save.
- Defaults over fields; time defaults to now.
- No always-visible hints and no "Recent" lists on forms (suggestions are the only exception).
- More than about eight chips collapse into a summary plus Edit.
- Rare and destructive actions only at the bottom of Settings; details behind switches.
- (v0.7) The Skin form already shows five scores, so it gets one more visible control at most: the "Cracks or open wounds" switch. Size in mm sits behind a Details row, which opens by itself only for an area that already has a size (SK-3).
- (v0.7) A reaction to a treatment is never asked at logging time, so one-tap logging keeps its budget; it is a field on the application's edit screen (IN-11).
- (v0.8) The name estimate is one button in the review phase, beside the photo and label buttons, so the three ways to get an ingredient list sit together. It appears only once a description is typed and has no hint text (IN-19).
- Tap budgets (NF-2): repeated meal 3 taps, often used or regular treatment 2 (tile, item; v0.9, was 1 for a shortcut), stool 2, regular medication 2 (tile, item), skin "no change for all" 2.
- (v0.9) Today keeps at most 5 pinned quick actions and at most two context pills, so its height stays fixed whatever the user logs; only the log grows, and the ring already shows the whole day.

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
| Treatment | (v0.9) the Treatment quick sheet: regular items, then often used combinations of treatment plus areas |
| Routine change | "Stopped" offers items in use now; "Started" offers "already using, date unknown"; categories Product and Diet plus user categories, each with a description |
| Skin and nails | prefilled with the last values, "No change" per area and for all areas |
| Daily health | explicit "same as yesterday" for all items, never a silent prefill; scores use a slider with − and + |
| Regular medication, regular treatment | quick sheet of regular items; reminder button Taken or Applied (IN-17) |
| Stool, reaction | fixed lists |
| Treatment reaction (v0.7) | three choices on the edit screen, empty by default; no suggestion |
| Skin cracks and size (v0.7) | prefilled with the last values and carried by "No change", like the scores |
| Medical event (v0.7) | fixed list of kinds (visit, test result, diagnosis, illness, other); title typed, no suggestions |

## Editing, deleting, tombstones (EN-1, EX-13)

Any entry can be edited or deleted from the day's log and, (v0.8) for a skin or nail entry, from its area's timeline, with the same action sheet (SK-8). A delete leaves a tombstone (id, kind, deletion time, nothing else), exported in `data.json` under `tombstones`. A merge import never restores a tombstoned id and applies incoming tombstones to local entries. Bulk delete (SE-9) leaves no tombstones so that a wipe followed by a restore works. A single entry deleted by mistake can be restored from a backup: the merge preview counts the entries skipped because of a tombstone and offers a switch to restore them anyway (EX-10); Replace restores everything in the file. Newest-wins merge for edits (EX-12) stays Later. `schema_version` stays 1 in development, so exports made before this section will not import (decided: versioning starts after the first release).

## Meal name estimate (v0.8, IN-19)

- **Where:** the review phase of the meal form and the drink form, beside "From photo" and "Read the ingredient label". Hidden while the description is empty.
- **What is sent:** the description as typed, plus the number of known names when that setting is on (IN-3). Text only, no photo. The confirmation (LL-5) shows the description and the billing notice before anything leaves the phone.
- **Result:** the same inline panel as a photo estimate: a list with Add all, pick items or Dismiss, never overwriting typed text. Allergen tags stay unselected; the separate AI allergen button (IN-10, cached per ingredient) can follow. A name too vague to list ingredients (for example "lunch") returns an empty list and the model's note, which the panel shows.
- **Source:** the entry records "name estimate" (IN-16). The report marks it as AI (EX-4) and the analysis treats it as the roughest source (LL-4).
- **Trade-off:** a name gives the typical recipe, not what was eaten, so a list can look more certain than it is. Nothing is pre-selected, the source is marked, and the analysis discounts it. No separate cache: a meal eaten before already comes from history (IN-7, IN-14).
- **Waiting:** inline and cancellable like the photo estimate (LL-12). Save uses the fields as they are and drops the estimate; leaving the form aborts it.

## Area timeline (v0.8, SK-8, EN-1)

Review, Areas, one area. Top to bottom: the area name, a "Go to date" row, the trend chart, "Compare two photos", then the days, newest first.

- **Go to date:** a row that opens an inline date picker, like the date jump on Today (no future dates). Picking a date scrolls to that day. With no entry that day it scrolls to the nearest earlier day that has one and says so ("No entry on 5 Nov, showing 3 Nov"); before the first entry it shows the oldest day and says so. It is navigation, not a filter: the chart and the list stay complete. A range filter is not planned; revisit if the list gets too long to scroll.
- **Entry actions:** a tap on an entry's line (time and scores or stage) opens the same action sheet as the day's log: its title, a line naming what goes with it (its photos), Edit, Delete (destructive, on top, UX-9) and Cancel. Edit opens the edit form; after Save or Delete the timeline reloads and keeps its scroll position. Flare lines are derived and not tappable (SK-6).
- **Compare mode:** while comparing photos, taps pick photos and the entry sheet is off until compare mode ends.
- **Why:** EN-1 promised editing only from the day's log, but a wrong score is easiest to spot on the timeline.

## Using my Claude plan (Later, LL-15, IN-20)

Designed, not planned. The idea: spend a Claude subscription, not API money, on a stronger model for deep analysis and for filling gaps.

- **Mark:** on a meal or drink, a "Fill later with AI" switch under the description. The entry saves with what was typed; its log row says "waiting for AI".
- **Prepare:** Review, AI analysis, "Use my Claude plan", then "Prepare a pack". One screen: date range, photo selection (the export picker; sensitive photos off), what is inside (counts, marked entries), the privacy note (the file leaves the phone by your act; consumer terms; no billing by the app), and a Prepare button that opens the share sheet. Meal photos are not part of it.
- **Hand over:** outside the app. The user gives the ZIP to a model in a Claude chat; `INSTRUCTIONS.md` says what to do and which file to return.
- **Import:** "Import a result" picks `result.json`, validates it and shows a preview: the analysis (range, model), the report summary if any, the number of suggestions and how many are skipped. Import stores the analysis like any other, labelled manual, and queues the suggestions.
- **Review suggestions:** a Today card ("3 AI suggestions to review") opens a list. A row opens the entry's edit screen with the suggestion in the photo-estimate panel. Save confirms; Dismiss removes it.
- **Why a result file and not data.json:** a model rewriting a large JSON can corrupt it, and raw entries are never modified (LL-7). A separate result is validated, previewed and reversible.
- **Unverified:** how a Claude chat takes the pack (a ZIP with photos, file count and size), and the plan's models and limits. Test with a synthetic pack first.

## HIG audit (2026-11-14)

Read: tab bars, toolbars, sheets, modality, action sheets, settings, entering data, lists and tables, undo and redo, accessibility, steppers, and the Dynamic Type part of typography (developer.apple.com/design/human-interface-guidelines).

| Area | Finding | Resolution |
| --- | --- | --- |
| Tab bar | navigation only; no hidden or disabled tabs; explain empty sections | two tabs; no center "+" tab; empty states explain (UX-1) |
| Settings | infrequent options only; task options belong in the task; do not duplicate system settings; keep the number small | gear icon on both tabs, not a tab; Home layout edited on Today; no language setting; each setting has a default; reminder times live on the item, with a summary in Settings (UX-6, IN-17) |
| Sheets and modality | Cancel leading, Done or Save trailing; Done must be paired with Cancel or Back; confirm before data loss; one sheet at a time; keep modal tasks short; complex flows do not belong in a sheet (verified 2026-11-15) | UX-3; More is a pushed list so forms are the only modals; Settings is a pushed screen with Back and no Done, not a sheet (UX-1) |
| Sliders and steppers | a slider can have side buttons for fine steps, and a stepper can sit alongside it (verified 2026-11-15) | one row: −, slider in steps of 1, +, value (UX-3); feel to be tested on the phone |
| Entering data | prefer choices, prefill defaults, enable the primary action only when data is complete | suggestions, chips, Save disabled until required data is present |
| Undo | show the result of an action; avoid timed UI | highlighted row in the log instead of a toast (UX-5) |
| Destructive actions | action sheet, destructive choice on top | UX-9 |
| Accessibility | 44 pt targets, Dynamic Type to 200 percent, contrast 4.5 to 1, not color alone, gesture alternatives | UX-8, deferred (Later); only if the app is ever distributed |

## Visual design and gestures (v0.9, UX-12)

Approved 2026-11-21 on the design canvas (https://claude.ai/artifact/BVCSSjDYjDDMVcKrshmazt), board "Aurora ring". The canvas also holds the earlier proposals (light floating in teal, blue and violet, dots, Aurora, Day ring, Signal) for comparison, and the next screens in the same style: Treatment quick sheet, Meal choose, Meal review, More.

| Token | Value | Use |
| --- | --- | --- |
| Ground | #070B12 | every screen |
| Aurora | accent, #6D4AE0 and #2563EB as large blurred glows, slow drift; faint dot grid (white 6 percent, 24 pt) | behind content only |
| Glass | white 7 to 9 percent, 1 pt inner line white 12 to 16 percent, background blur 18 to 30 | pills, circles, cards, sheets, tab bar |
| Text | #F2F5F9; secondary #9AA4B2 and #C9D0DA | |
| Accent | #5EEAD4 (mint); text on it #062A26 | actions, selection, current time, newest entry |
| Alert | #FF8A6B (coral); text on it #2A0D04 | flare, urgent advice, delete |
| Type | Gabarito 400 to 800; date 38 to 40 pt bold, weekday small capitals in the accent | |
| Shape | pills and circles (radius 999), panels 26 to 40; nothing touches the screen edges | |
| Icons | 24 grid outlines, 1.6 stroke, with an accent wash that fades in over the lower half of the shape | |
| Motion | on first load sections rise in with a stagger, the ring arc draws, dots pop in; the aurora drifts; nothing else animates | |

Gestures are accelerators, each with a tap alternative: swipe the ring for the day (arrow buttons), tap a dot (the log row), swipe a log row left to delete (tap the row, Delete), long-press a quick action to open the full form ("Other or earlier..." in the quick sheet). Later: press and drag around the ring to choose a time, release, pick the entry type (UX-13).

Expo specifics (not verified in Expo Go yet): the font through `expo-font` (bundled font files, or an `@expo-google-fonts` package if one exists for Gabarito; not checked), glass through `expo-blur`, the ring through `react-native-svg`, gestures and the draw-in through `react-native-gesture-handler` and `react-native-reanimated` (already in the template), and `userInterfaceStyle` in `app.json` moves from light to dark. Blur is the most expensive part; if it stutters, glass falls back to a flat translucent fill.

## Not verified

- HIG pages not read: buttons, pickers, toggles, segmented controls, materials and Liquid Glass, VoiceOver.
- "Save" is used on forms; the HIG names "Done" and "saving changes". The trailing placement and the Cancel pairing are verified. (v0.9) Save moves to a floating button at the bottom of the form instead, for thumb reach; this departs from the HIG on purpose (UX-3), and swiping down stays Cancel (no save gesture). Settings has neither, because it is a pushed screen.
- Notification action buttons (Taken, Applied): Expo forum reports for SDK 39 and 42 say they were unreliable when the app was in the background. Untested on the current SDK; the design opens the app and logs, so it does not depend on background logging (IN-17).
- Expo Go: large titles, `expo-symbols`, the sheet grabber, how the JS tab bar looks next to the iOS floating tab bar, and shake to undo are untested. The design does not depend on any of them.
- Language: Expo documents per-app language through the `expo-localization` config plugin (`supportedLocales`), which needs a native build, so it cannot work in Expo Go. The decision is therefore no in-app setting; Expo Go follows the device language.

## Decisions recorded

1. Navigation: Today and Review tabs, Settings behind a gear icon on both tabs, as a pushed screen without Done (revised 2026-11-15).
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
14. Quick actions: one catalog of entry types, an ordered pinned list on Today, everything else in More automatically, nothing hidden (UX-2).
15. Flares are derived from skin severity at or above a threshold (default 8), with no manual markers (SK-6).
16. Routine change replaces "Started or stopped"; regular medication and treatment are marked regular with reminders and a quick sheet (IN-12, IN-17).
17. Daily health replaces the check-in; items are user-defined scores or yes/no; saving logs the day, so there is no complete mark (SK-7, SK-11).
18. Review has Days (month calendar) and Areas; only the "Incomplete days" filter for now (UX-10).
19. Guide: subtitles, descriptions and a "Where do I log...?" screen (UX-11).
20. The intimate area is three predefined areas: penis, perineum and groin, between the buttocks, each sensitive by default; palms are not predefined (SK-1, SK-5).
21. (v0.7) A fixed patch is an ordinary skin area with an optional size in mm; no separate lesion kind. Skin entries get a cracks switch (SK-3).
22. (v0.7) The reaction to a treatment is set after the fact on the edit screen, never in the one-tap path (IN-11).
23. (v0.7) Time since the last treatment (per photo) and time to relapse (per area and treatment) are computed by the program and shown as captions and report rows; photos get no "before or after treatment" field (SK-4, SK-12).
24. (v0.7) Medical event is an entry type in More: visits, test results, diagnoses and named illnesses. The daily tag stays the quick yes/no for an illness day (IN-18, IN-6).
25. (v0.8) Meal name estimate: a text-only button in the review phase, its own source, never pre-selected, discounted by the analysis (IN-19).
26. (v0.8) The area timeline gets a date jump (navigation, not a filter) and the day log's Edit and Delete sheet on each entry (SK-8, EN-1).
27. (Later) Claude plan handoff: a pack out and a `result.json` back, never an edit of `data.json`; fills wait in a review queue; meal photos are ignored for now (LL-15, IN-20).
28. (v0.9) Today is the day ring in the Aurora look: intake and body-and-care tracks, swipe for the day, at most 5 pinned quick actions plus More, at most two context pills, Edit Today in More, no search field and no treatment shortcut row (UX-2, UX-12).
29. (v0.9) The one-tap treatment shortcuts move into the Treatment quick sheet as "Often used" (IN-11, IN-17, NF-2).
30. (v0.9) More gets a search field over entry types and guide situations (UX-11).
31. (v0.9) Gestures always have a tap alternative; logging by dragging around the ring is Later (UX-12, UX-13).
