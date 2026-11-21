# Build plan: Aurora ring design

Status: built 2026-11-21 (all 16 tasks merged into `develop`); the phone run is still to do. Deviations are in the work log: gestures use `PanResponder` and motion uses React Native's `Animated` instead of gesture-handler and reanimated; the confirmations and action sheets stay native iOS sheets; the missing states were built only where a pattern fit. Design: `docs/design-system.md` (approved parts and the "Proposed additions" list), boards in `design/canvas/`, review in `design/consistency-report.md`. Rules in CLAUDE.md apply to every task: one `feature/<name>` branch per task cut from `develop`, `npm run check` passing, a work-log entry, requirement IDs in commits, merge into `develop` when the checks pass, never into `main`. The prototyping decision holds: no migrations or old-data handling; a plain new SQL step is fine.

Phase 1 builds the approved design. Phase 2 builds the "Proposed additions" (boards `G1-` to `G6-`) and starts when phase 1 is done.

## Phase 1: the approved design

1. **fix-known-bugs.** The reminder time zone bug (SK-9, pin `TZ` in the test run) and Jest not exiting. Remove both from "Known bugs" in `open-questions.md`.
2. **design-spike.** A throwaway Expo Go screen: `expo-blur` over a drifting aurora, `react-native-svg` ring and icons, Gabarito through `expo-font`, a `gesture-handler` swipe, a Save pill floating over the keyboard. Result in `docs/spikes/design-stack.md`. Needs one run on the phone. Fallback for slow blur: a flat translucent fill. If it fails, change the spec before building screens.
3. **theme-foundation.** `npx expo install expo-blur react-native-svg`, add `@expo-google-fonts/gabarito`, `userInterfaceStyle` dark. `app/src/ui/theme.ts` holds every token; no colour literals left in screens. Components: `GlassSurface`, aurora background, `Icon` (SVG set), `PillButton`, `IconCircle`, `Chip`, `Field`, `SwitchRow`, `ScoreRow`, `Segmented`, `NavGroup` and `NavRow`, `Sheet`, `ConfirmSheet`, `FloatingSave`, `EmptyState`. Existing components keep their names, roles and labels, so the screens re-skin and `test/ui` keeps passing. The review-driven defaults go in here as single tokens: 34 % control outlines, tabular figures at the root.
4. **today-core.** Pure logic with tests: ring dot positions from the day start (NF-7) and merging of close dots, the context-pill choice (at most two, fixed order, Daily health from its reminder time), the pinned layout (at most 5, defaults, More last), the More search over entry types and "Where do I log…?" situations. No Expo imports.
5. **today-redesign.** `DayRing`, context pills, quick actions (3 by 2), `LogRow` with swipe-left delete, swipe the ring for the day, the floating tab bar. Edit Today keeps its current editor, re-skinned.
6. **quick-sheets-more.** Treatment quick sheet (Regular, Often used, "Other or earlier…"), long-press on a quick action, More with search.
7. **forms-reskin.** Modal form chrome, floating Save above the keyboard, the Meal choose and review boards, the reference Skin and Daily health boards.
8. **review-settings-reskin.** Review (Days, Areas, Area timeline), Settings, Regular item, the delete sheet and the empty state, from the reference boards.

## Phase 2: proposed additions

Assumption (the user's, 2026-11-21): the proposals need few or no changes. Before starting, re-read `design-system.md` and the canvas for remarks the user made in the meantime. Anything unchanged is built as drawn. Where a proposal changes a requirement, the same branch updates `requirements.md` (with its Changelog entry), `ux-design.md` and `user-flows.md`, and removes the proposal from "Proposed additions". The five review-driven items are built as drawn and each is a one-line change if the user decides otherwise: failure states in coral (add "failures" to the alert row), 3 to 4 option segmented control, tabular figures at the root (already in phase 1), 34 % control outlines (already in phase 1), icon stroke as drawn (a prop on `Icon`).

Tasks, in order. Core changes come first because they are testable without a screen.

9. **additions-core.** The logic the proposals need, with tests and no UI:
   - range filter for the trend charts: 30 days, 90 days, 1 year, All, default 90 days (SK-7, SK-8);
   - flare threshold scope, "Per area" or "Same for all", default Same for all, in the preferences and the flare derivation (SK-8);
   - analysis result with Evidence, Against and Uncertainty per pattern, "What the data cannot show", "Questions for your doctor", no advice: prompt, schema and parser, also for the AI pack result (LL-4, LL-15);
   - a status for output cards: analysis running with elapsed time, analysis ready (LL-12);
   - the split of the two model choices, photo and name estimates versus analysis (LL-2);
   - the rate-limit message with a retry path (LL-8; `llm_rate_limited` exists already).
10. **g1-today-states.** Edit Today as a pushed screen (Up, Down, Move to More, Pin disabled at 5), the merged-dot sheet, the Stool quick sheet grid with "Saved 14:20", the past day with "Back to Today", the first-run card with two buttons, the Medication quick sheet, the date picker. Hit slop of 44 pt on dots and chips.
11. **g2-entry-forms.** Drink, Medication and Treatment (Regular switch and hint), Nails, Stool, Reaction (pinned urgent-care note, "Log a meal first" state), Routine change (Stopped as a single choice), Medical event (Ended on), the treatment application edit with the reaction segmented control.
12. **g3-meal-extras.** One scan screen with a typed code beside the camera, history hit, in-store code sheet, not found with "Read the ingredient label", camera denied, the confirmations that list what is sent with the billing notice and the model, waiting with elapsed time, Cancel and the rotating wait arc, estimate results with nothing preselected, the failed and too-vague states (IN-2, IN-3, IN-8, IN-10, IN-15, IN-19, LL-5, LL-12).
13. **g4-review.** Range switch on the Area timeline and Daily health trends, status lines on the output cards, the analysis result layout and its progress, interrupted and failed states, the floating primary on pushed screens, the Doctor report options (period chips, sensitive photos switch off by default, one-by-one photo picker, language, optional AI summary and its confirmation), the Claude plan pack confirmation, Suggestions to review, the 3-column photo picker.
14. **g5-settings.** Delete data (choose, export-first sheet, final confirmation, SE-9), import preview with the "Restore entries I deleted" switch and the skipped count, flare threshold scope, custom export reusing the report's photo rows, AI key (disabled Save, last 4 characters, "Test the key (sends one request)"), AI models, Reminders denied banner, "Where do I log…?" as a list, and the other Settings boards.
15. **g6-system.** The lock cover and the failed-attempt state, the app-switcher cover, camera and photo denied screens, storage-error and offline banners, the rate-limit screen, the app icon (accent ring on the ground) and the splash. Generating the PNGs needs a tool on this machine; check first, otherwise keep the Expo defaults and say so.
16. **missing-states.** The states the consistency report lists without a board, built from the design-system patterns and marked in the work log as unreviewed: the Discard Changes sheet, label read (waiting, result, failed), name estimate (waiting, failed), the meal-photo camera, import with an unreadable or newer file, export progress and done, delete result, key-test result, empty states for the Review day log, Areas, Favorites, Regular items, Treatments and Skin areas, the Medication quick sheet with no regular items, and the Today card for a regular item's next time.

## Out of this plan

UX-8 (accessibility), the Polish string review, migrations and old data, pruning unused dependencies (reanimated, gesture-handler, `expo-blur` and `react-native-svg` now get used; prune what is left after phase 1), UX-13 (drag around the ring, Later), and everything the user marks as changed on the canvas until the board is redrawn.

## Checks that need the phone

The design spike (task 2), then one run after tasks 5, 7 and 13 (blur and aurora speed, swipe feel, floating Save over the keyboard, wait arc). Add each run to `docs/phone-test-plan.md`.
