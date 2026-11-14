# Open questions and gaps

Undecided items only. Decisions go into `docs/requirements.md` (canonical, edited directly) and are removed from here.

The file has four parts: undecided questions, accepted limits, decided work that is not built yet, and the phone checklist.

## Open (undecided)

- **AES export speed (EX-6).** Pure JS, verified against 7-Zip (`docs/spikes/aes-zip.md`). Photos are stored, not deflated, so only AES and the MAC cost time. V8 does about 26 MiB/s; Hermes is unmeasured. Measure an encrypted export of 30 or more photos on the phone.
- **Long LLM runs (LL-12).** The single request with a 10 minute timeout stays. If analyses time out in practice, choose between streaming (`expo/fetch`, unverified in Expo Go) and the Message Batches API.
- **Anthropic refusal fallback.** Not used (needs the beta request shape); a refusal shows a message. Revisit once a real call has worked.
- **Merge keeps local settings.** Merging into a fresh install skips the six pre-seeded predefined areas, so a renamed or archived predefined area from the file is not applied; Replace (settings) restores them. Revisit with EX-12, or adopt incoming values for areas still at factory state.
- **Polish strings.** Review at the end of the project. First draft: `app/src/i18n/pl.json`.
- **Unused template dependencies.** Prune when moving to a standalone build (reanimated, gesture-handler, expo-image, expo-glass-effect, `@expo/ui`, ...). No effect in Expo Go.

## Accepted limits

- **`expo-sqlite` wrapper is untested in code.** Storage logic is tested through the `SqlDb` seam on `node:sqlite`; the ~20-line `app/src/adapters/storage/expoSqliteDb.ts` is verified on a phone only.
- **One check-in per day is enforced by the use case only.** No database constraint, so a merge from another phone could add a second one for the same day; the newest is shown. Revisit with EX-12.
- **`schema_version` stays 1 in development.** Exports made before the current required sections will not import.
- **Export memory.** Photos are read one at a time, but the whole ZIP is held in memory (about the sum of the photos). Fine for months of daily photos; watch it on a large archive.
- **Backup exclusion of photos (SE-7).** Expo Go cannot mark files as excluded from iOS backup; revisit in a standalone build (`isExcludedFromBackup` through a config plugin or native code).

## Status of the decided work

Requirements and flows are in `docs/requirements.md`, `docs/ux-design.md` and `docs/user-flows.md`. The information architecture (two tabs, Settings behind a gear, modal forms, action sheets, the tombstone model) is built; each line below says what exists and what does not. Everything marked built is covered by tests and bundles for iOS, but none of it has run on a device (see the checklist at the end).

**Built since the IA (v0.4.2)**
- Editing and deleting (EN-1, EX-13): `core/usecases/entries.ts`, tombstones (migration 11, the `records.tombstones` section of `data.json`), merge skips and applies them, the restore switch (EX-10) in the import preview. Today's log rows open an action sheet with Edit and Delete (cascades named); `form/edit` has one small form per kind on `FormModal`. Removing a photo leaves a tombstone too. `schema_version` stays 1 while prototyping, so exports made earlier do not import.
- Navigation (UX-1 to UX-3, UX-9): Today and Review tabs with a stack each, Settings and More pushed inside Today, modal forms under `form/`, `chooseAction` and `confirmDestructive` action sheets.
- Today (UX-2, UX-5): day switcher, quick actions with an Edit mode (up and down, hide; More stays), stool quick sheet, treatment shortcuts, cards (open flare, incomplete day, backup), the day's log.
- Review (UX-1): Doctor report (EX-14), the days list, an Areas list with the per-area timeline (SK-8), AI analysis with a running card (LL-12).
- Settings (UX-6): Logging (tags, treatments), Suggestions, Privacy (app lock), Reminders, AI analysis, Data and backup (Full backup preset, custom export with a photo picker, import with the tombstone switch, Delete data last).
- Intake: two-phase meal form with suggestions and favorites (IN-7, IN-14), history tags pre-selected (IN-10), barcode scan and lookup (IN-2, IN-8, IN-9), inline editable photo estimate (IN-3), alcohol and medication suggestions with "save on tap". Preferences (favorites, suggestion settings, quick-action layout) travel in `settings.preferences`.
- Drinks (IN-4, IN-10, IN-14): `Drink` replaces `AlcoholEntry` (migration 13): any beverage with an alcohol switch, optional ingredients and allergen tags; More lists "Drink"; suggestions and favorites carry the whole snapshot; report, analysis input and `data.json` (`drinks`) follow.
- Sources (IN-2, IN-16): `barcode` and `source` (typed, Open Food Facts, label scan, photo estimate; edited flag; model, time and prompt version for the two AI sources) on meals, drinks and favorites (migration 14, `data.json`). A scanned code is looked up in the diary first (`findInHistory`), then Open Food Facts; the drink form scans too. The entry row shows the source, the PDF marks AI-read intake with a legend (EX-4), the analysis input carries `ingredients_source` (prompt `analysis-2`). The label scan itself (IN-15) is not built, so `label_scan` is never produced yet.
- Model per action (LL-9): `LLM_ACTIONS` (label scan, meal photo, analysis, report summary), one setting `llm_model.<action>` each, chosen from the list the provider adapter offers (`ANTHROPIC_MODELS`, Haiku 5.5 first and the default); Settings, AI analysis has a chip row per action. The old single `llm_model` setting is ignored. Label scan and report summary have a setting but no action yet.
- Label scan (IN-15, LL-13): `labelPrompt`/`parseLabelScan`/`scanLabel` (action `label_scan`), the shared `useIngredientRun` hook and `IngredientRunPanel` (meal photo and label scan run inline, Cancel after 30 s, retry), a "Read the ingredient label" button on the meal and drink forms. The answer shows the text read beside the list to add from; declared allergens and traces are suggestions until selected; the failed barcode stays on the entry. The picked photo is deleted (`PhotoStore.discardTemp`) when the answer arrives, on cancel, dismiss, decline or leaving. Ingredient edit fields split on commas outside brackets (`splitIngredients`).
- Day start (NF-7): `localDay`, `localDaysToRange` and `atOnDay` take a start hour (wall-clock shift, so a daylight saving switch cannot move an entry); `DayStart` (in `Deps`) holds the current hour, loaded from `Preferences.dayStartHour` at start and after an import; every grouping goes through it (day log, days list, check-in, timelines, analysis input, report, export and delete ranges, reminders). Settings, Logging has "Day starts at" 00:00 to 06:00. Suggestion windows (IN-14) stay rolling spans of 24 hours, not calendar days. Date pickers stay calendar dates.
- Today log cap (UX-2): Today shows the newest 8 entries and "Show all (n)"; `review/day` shows a day's full log with the same Edit and Delete sheet (shared `DayLog` component) and a button that opens the day on Today. The Review days list opens `review/day`.
- Report summary (LL-14, EX-3, EX-4): `ReportSummary` record (migration 15, `data.json` `report_summaries`, delete group "AI"), `summaryPrompt` and `parseSummary`, `prepareSummary` (same input builder as the analysis, never photos), `runSummary` (stores nothing), `saveSummary` (stores what the person kept next to what the model wrote). The Doctor report screen has the panel: billing confirmation, elapsed time and Cancel, an editable text, "Use in the report"; the PDF opens with it under the AI label, and a summary for another period or language is refused (`summary_mismatch`). Unlike the analysis the run is inline on the screen, so leaving the screen cancels it.
- Known names (IN-3): `Preferences.suggestions.knownNames` (off by default, in the Suggestions settings); `knownIngredientNames` collects the distinct names from meals and drinks, most used first (up to 150); the meal photo prompt (`ingredients-2`) prefers them, and the confirmation says how many go with the photo. The label scan never uses them.
- Flares (SK-6, UX-2): More lists "Flare start or end" (`form/flare`, `FlareSection`): pick a skin area, the kind follows the area (start when none is open, end when one is), time and note, Save. The Skin form no longer has flare buttons.
- Favorite stars (IN-14): the drink and medication forms have a Favorite / Remove favorite button; a drink favorite keeps its amount, alcohol switch, ingredients, tags, barcode and source.
- Settings screens (SK-2, SK-7, IN-14, UX-6): "Skin and nail areas" (add, rename with override and "Default name", archive, restore), "Favorites" (list and remove), and "Daily check-in scores" in Logging (four switches in `Preferences.checkInScores`, exported with the settings). A switched-off score is not shown in the check-in forms and not recorded: saving keeps what the day already had.
- Export first (UX-6, SE-9): Replace (import) and Delete data are action sheets with "Export first" above the destructive action; choosing it makes a full backup (no password) and asks again. Delete data then asks a second time ("Delete for good"). Shared helper `confirmWithExport` and `exportEverything` (`ui/exportFirst.ts`).
- Date jump (UX-2): the day heading on Today opens an inline date picker (no future dates); a pick shows that day, today returns to the live day.
- AI allergen suggestion (IN-10, LL-5, LL-9): action `allergen_suggest` (own model setting), prompt `allergens-1`, `suggestAllergensWithAi` (names only, no photo). A button on the meal and drink forms shows the ingredient names in the billing confirmation, runs inline with Cancel, and returns suggested tags that stay unselected until "Select the listed allergens". Nothing is stored by the call. Answers are saved per ingredient name in the device settings store (`allergen_cache`, not exported, invalidated by a new prompt version `allergens-2`, cleared with Delete data, AI): a name asked before is never sent again, and a list with nothing new makes no call and shows no billing confirmation.
- AI marks in exports (IN-16, EX-4): `IngredientSource.aiTags` is set when the person selects tags from a label scan or an allergen suggestion. `data.json` has `source.ai_tags`; the CSV for meals and drinks has plain columns (`ingredients_source`, `ingredients_ai`, `ingredients_edited`, `allergens_ai`, `ai_model`, `ai_at`, `ai_prompt_version`); the PDF marks `[AI]` after the ingredients (label scan, photo estimate) and after the allergens (AI-suggested tags), with a legend; the analysis input has `ingredients_source` and `allergens_source`.
- Privacy and photos, About (UX-6, SK-5): Skin and nail areas has "New photos of this area are sensitive" (`setAreaSensitiveDefault`); Privacy explains where photos live and what is blurred or left out; About shows the version, where the data lives and that the app is not a medical device.
- Highlighted new row (UX-2): an entry that appears in Today's log after the first look at a day is tinted for 3 seconds. "Earlier…" opens the stool form (it had been built; the note here was stale).
- Polish ingredient text (IN-2): the Open Food Facts adapter also asks for `ingredients_text_pl` and `lang`, prefers the Polish text and marks it `translated` when the product was entered in another language; the form then says to check it against the pack. Coverage of Polish products is unmeasured (phone checklist).
- Skin and health: unique area names (SK-2), no change for nails and all areas (SK-3), empty-day confirmation (SK-11), reminder taps (SK-9), "Same as yesterday" (SK-7).
- LLM: elapsed time, Cancel, billing notice, no retry of a timeout, the run in `AnalysisRunner` (survives leaving the screen, interrupted state with retry, keep-awake).
- Security: app lock (SE-8) with `expo-local-authentication`.

**Decided in v0.5, not built**

**Not built**
- *Create forms.* Done: every create form is on `FormModal` (Cancel and Save in the header, Save disabled with what is missing, Discard Changes sheet, a past-day default through the `day` route parameter). Skin and nail entries get their photos from the entry's edit form (the "recent" lists they hung off are gone). The reminder-tap guard (`unsavedForm`) covers them.
- *Check-in (SK-7).* Built: "Same as yesterday" and a separate "Mark day complete" switch; stool has its own full form behind "Earlier…".
- *No change buttons (SK-3).* Built on the Skin form (all areas) and the nail form (one nail); the Skin form's single-area button existed.
- *Settings.* Settings groups of UX-6 are all present.
- *Today.* The first-run empty states beyond text.
- *Intake details.* Ingredient chips with autocomplete, favorites for scanned products.
- *Export and import.* A free date range picker for the report and the custom export, newest-wins merge (EX-12, Later: needs modified timestamps and a schema bump).
- *Review.* A side-by-side comparison of two photos, trend charts.
- *Other.* The accessibility pass (UX-8, deferred), polishing Polish strings, pruning unused template dependencies.

## To verify on the phone

Nothing below has run on a device.

- **Start-up:** the app starts after the SDK fix; migrations 3 to 12 on the existing database (first launch).
- **Navigation (UX-1 to UX-3):** large titles, `expo-symbols`, the sheet grabber, the JS tab bar next to the iOS floating one, `formSheet` and `modal` presentation. The design does not depend on them.
- **Photos:** camera and library permission prompts and multi-select; thumbnails; blur on sensitive photos; EXIF and location removed from a photo taken with location on (re-encoded by `expo-image-manipulator`). The permission texts in `app.json` apply to the standalone build only.
- **Export:** photos, CSV and PDF; that `expo-print` paginates a long report, renders the inline SVG and images, A4 size; AES export speed with many photos.
- **AI:** a real key, one analysis and one photo-to-ingredients call; the cost and the answer language (English and Polish).
- **App lock (SE-8):** the prompt (Expo Go asks for the passcode; Face ID needs a standalone build), the cover in the app switcher, locking after a minute away, a reminder tap while locked.
- **Barcode (IN-2):** camera permission and scanning a real product in Expo Go; how many of the Polish products you buy Open Food Facts knows.
- **Reminders:** permission prompt; a daily reminder a minute away; weekly and monthly ones by changing the day. Taps (SK-9): from the lock screen and Notification Center, with the app open, in the background and killed; check that `notification.date` exists and the form does not reopen on every launch. Also `expo-keep-awake` in Expo Go.
- **Date pickers:** check-in day, export photo filter, analysis range; the delete confirmation and "Export first".
- **Language:** Expo Go follows the device language (decided: no in-app setting, UX-7); the Polish strings appear when the device is set to Polish.
