# Design consistency report (overnight run, 2026-11-21)

Scope: all boards on the design canvas, old and new (125 boards: 102 new `G1-` to `G6-`, the rest earlier). Reviewer: a fresh general-purpose agent that did not draw the boards. It got only `docs/design-system.md` (the copy available in the sandbox, which did not yet contain the "Remaining screens" list), the board sources, `canvas.json`, and a contrast script. It reported; the fixes were made afterwards in the generator scripts and the changed boards republished. I also ran `design/generator/lint.py` (static checks) and `contrast.py` (computed ratios). No board was rendered.

Result: 4 blocking findings, all fixed. Of the 13 should-fix items, 8 are fixed (8 to 12, 14 to 16), 2 partly (5, 6), 1 needs no change (7) and 2 wait for approval (13, 17). Nits 18 to 25: one fixed (23), the rest left.

## Contrast, computed (glass over #070B12)

All text colours pass 4.5:1 on ground, glass 7 %, glass 9 %, selected-segment fill 16 % and the sheet fill: text 14.8 to 18.0, soft 8.3 to 12.7, muted 5.1 to 7.8, accent 8.7 to 13.3, alert 5.6 to 8.5. On-colour text: onAccent on accent 10.4, onAlert on alert 7.9. Weakest passing text: coral "flare" on its coral wash 5.83.
Exempt (inactive components): disabled text 3.15 to 3.36, future calendar days 2.6, text behind scrims.
Not passing as UI component boundaries (3:1): white 22 % chip outline 1.9, switch off-track 1.65, unselected radio ring 2.4, glass line 1.3 to 1.6, slider track 1.65. See finding 6.

## Blocking (all fixed)

1. Photo selection not drawn, sensitive exclusion unprovable (G4-PhotoPick, G4-Analysis, G4-Analysis-Confirm, G4-Analysis-Progress). Fixed: thumbnails now have a selected look (accent ring and tick, `aria-checked`); sensitive photos are blurred, unselected and captioned "left out"; Analysis shows one chosen non-sensitive photo and the Confirm and Progress boards list only that photo.
2. No confirmation or wait for "Write a summary with AI" (LL-5, LL-12). Fixed: new boards G4-ReportSummary-Confirm (billing note, exact list, no photos) and G4-ReportSummary-Waiting (elapsed time, Cancel).
3. Inline primary button inside forms (G3-Scan-NotFound, G3-Scan-Denied). Fixed: the primary is the floating bottom button; the second button of the denied screen (duplicate of Open iPhone settings) is gone.
4. A suggestion pre-selected (G2-Drink, Milk). Fixed: now a dashed suggested chip.

## Should fix

5. Touch targets under 44. Fixed: the form header Cancel is 44 high on all modal boards (generator `modal_top`, so earlier boards changed too). Left: score steppers 36 (Ref-Skin, Ref-DailyHealth, DesignSystem), Remove 32 (Ref-RegularItem), Meal-Review "Change meal" and "Now" 36, Favorite 40, month arrows 40, Sheet-Treatment Close 40, Ref-AreaTimeline "Go to date" 40, Meal-Choose Continue 42, plus the accepted ring dots 28, chips 38, segmented tabs 40. Reason: they sit on approved boards; raising them changes approved layouts. Needs approval.
6. Control boundaries below 3:1. Fixed for chip outlines, the switch off-track, the radio ring and dashed add buttons (white 34 %, about 3:1). Left: slider track and the 12 to 16 % glass line (decorative, labelled controls). Needs approval as a token.
7. Text contrast: all pass; exemptions recorded above. No change.
8. Tabular figures missing in rows. Fixed globally: `font-variant-numeric: tabular-nums` on the root of every board.
9. Urgent-care note not pinned (G2-Reaction, G2-Reaction-NoMeals). Fixed: the note is `position: sticky; top: 0` and stays first.
10. Enabled primary with nothing chosen. Fixed: G5-Delete has a disabled Continue with "Choose what to delete first"; new board G2-Stool-Empty (disabled Save, "Missing: a Bristol type"). G2-Stool itself already had type 4 chosen.
11. LLM wait without Cancel (G3-Photo-Waiting). Fixed: Cancel is there from the start; the "after 30 s" rule is dropped.
12. "Try again" re-sent an LLM call without confirmation. Fixed: the button reads "Review and try again" with the line "Opens the confirmation. Nothing is sent until you confirm." (G4-Analysis-Failed, -Interrupted, G6-LLM-Offline, G6-LLM-RateLimit). The key test button says "Test the key (sends one request)".
13. Coral used for error and permission states. Not fixed: a spec decision. Recorded under "Proposed additions" (needs approval).
14. Wording. Fixed: "Back to Today" everywhere in G boards; "Ears, inside" (as in Ref-Skin); "AI-generated and tentative"; "Routine categories" (as in Ref-Settings); "Save changes"; "Dismiss" for dismissing suggestions and the summary; the barcode and storage error forms use "Log a meal" and "Save meal"; one "Open iPhone settings" label. Left: "Go to Today" in Ref-ReviewEmpty (approved board), "Earlier…" vs "Other or earlier…" in the Stool quick sheet (a grid with no history, left as is), "Close" on sheets, and the spelling mix "Favorites" (US) with "Analyse" (UK): to settle against `en.json`.
15. UI text pointing at boards that do not exist. Fixed by rewording: "Prefer my ingredient names", "Fill later with AI", the "Time for …" Today card are no longer mentioned. Still no board: the Today card for a regular item's next time, and an entry mark for ingredients to fill later (both named in requirements; left for the next round).
16. G5-ExportCustom chips: now the standard chip with a tick, 38 high.
17. Icon stroke 1.8 to 2.8 and glyphs outside the set (minus, dots, up, down, a clock-hand variant). Left; proposal under "Proposed additions" (needs approval).

## Nits

18. Segmented control with more than two options (range switch, treatment reaction): left, listed for approval. G2-Routine-Stopped starts with its first radio pre-selected: it is a "current state" list, left.
19. Accent on non-interactive ticks in "what is sent" lists: left.
20. Photo stand-in colours (#C9A39A, #8E6E68, #3B302F) are not tokens: to be documented as a placeholder, left.
21. Titles at 20, 22, 26 px and tracking -0.8 on pushed screens are not in the type table: left.
22. G1-DatePicker marks 10 Nov while the screen behind is 14 Nov: left (a sample selection).
23. Analysis result wording "supervised test of milk" read close to advice. Fixed: now a question about the pattern.
24. Sheet side margin 10 px against a 20 px screen margin: left (matches approved Ref-DeleteSheet).
25. Charts use `preserveAspectRatio="none"`, stretching axis text by about 1.07: left.

## Coverage against the checklist

Every item of "Remaining screens to design" has a board (see the ticks in `docs/design-system.md`). The reviewer found these states without a board, all left for the next round: the Discard Changes sheet, label read (waiting, result, failed), name estimate (waiting, failed), a meal-photo camera, import with an unreadable or newer file, export progress and done, delete result, key-test result, empty states of the Review day log, Areas, Favorites, Regular items, Treatments and Skin areas lists, and the Medication quick sheet with no regular items.

## Existing boards changed

By the generator rather than by hand, and only for the findings above:
- All boards drawn by `screens.py`, `reference.py`, `components.py`: tabular figures; form header Cancel 44 high; control outline, switch off-track and dashed add buttons at white 34 %. Boards: Meal-Choose, Meal-Review, More, Sheet-Treatment, DesignSystem, Ref-Skin, Ref-DailyHealth, Ref-Review, Ref-ReviewEmpty, Ref-AreaTimeline, Ref-Settings, Ref-RegularItem, Ref-DeleteSheet.
- Ref-Skin, Ref-AreaTimeline (earlier in the run): photo caption and chart axis text 10.5 and 10 px raised to 11 px; Ref-AreaTimeline "30 days" label changed to "All".
- Not touched: the hand-written Today boards and the exploration boards.

## Layout

125 boards, 125 files, none missing either way. New boards: width 390, 470 apart, rows from y = 7900, group titles 300 px above their rows, no overlaps (checked after the last build). Group 4 grew to four lines, so groups 5 and 6 moved down; nothing was moved that existed before this run.
