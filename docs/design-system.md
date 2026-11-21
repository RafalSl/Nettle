# Design system: Aurora ring

Status: approved 2026-11-21 on the design canvas, not built (requirements v0.9.2, UX-12). This file is the written spec. The canvas shows every part in use; `design/canvas/` in this repo holds a copy of its files and `design/generator/` the script that draws the generated boards.

- Canvas: https://claude.ai/artifact/BVCSSjDYjDDMVcKrshmazt (private to the owner)
- Requirements: `docs/requirements.md` (UX-2, UX-3, UX-12, UX-13, IN-10). Screen map and rules: `docs/ux-design.md`.

## Principles

1. **Floating, never attached.** Controls are pills, circles and rounded panels in glass, with space around them. Nothing touches a screen edge: the tab bar, quick sheets, action sheets and the form Save float.
2. **One accent, one alert.** Mint marks what you can do and what is selected; coral marks flares, urgent advice and deletion. Entry types are told apart by icon and label, never by colour.
3. **Calm by default.** A near-black ground with a slow aurora behind it. Motion only on first load.
4. **The app proposes, the user decides.** Suggestions (allergens, meals, ingredients) appear by themselves but are never selected or saved without a tap (IN-7, IN-10).
5. **Gestures are shortcuts.** Every gesture has a visible tap alternative.

## Tokens

### Colour

| Token | Value | Use |
| --- | --- | --- |
| `ground` | `#070B12` | every screen |
| `aurora.a` | accent | the top-left glow |
| `aurora.b` | `#6D4AE0` | the right glow |
| `aurora.c` | `#2563EB` | the bottom glow |
| `dotGrid` | white 6 %, 1 pt dots every 24 pt | over the aurora |
| `glass.fill` | white 7 % (rest), 8–9 % (raised: fields, quick-action circles) | surfaces |
| `glass.line` | white 12 % (rest), 14–16 % (raised), as a 1 pt inner line | surfaces |
| `glass.blur` | 18 (pills), 22 (ring, fields), 30 (sheets) | background blur behind glass |
| `sheet.fill` | `rgba(13,19,29,0.86)` to `rgba(16,22,33,0.9)` | modal sheets, quick sheets, action sheets |
| `text` | `#F2F5F9` | titles, values, icons |
| `text.soft` | `#C9D0DA` | secondary text, unselected chips |
| `text.muted` | `#9AA4B2` | captions, hints, units, inactive tab |
| `accent` | `#5EEAD4` | primary actions, selection, current time, newest entry |
| `onAccent` | `#062A26` | text and icons on the accent |
| `accent.soft` | accent 16 % | glow behind a highlighted row or the Save pill |
| `accent.line` | accent 45 % | focused field, outline buttons |
| `alert` | `#FF8A6B` | flare, urgent advice, delete |
| `onAlert` | `#2A0D04` | text on the alert colour |
| `alert.soft` | alert 12–14 % fill, 38–40 % line | flare pill, danger button |

The accent is a single value so a theme switch stays possible; alternatives tried on the canvas were lime `#A3E635` and lavender `#C4B5FD`.

### Type

Gabarito, weights 400 to 800. Tabular figures for times, scores and dates in lists.

| Style | Size / weight | Example |
| --- | --- | --- |
| Date | 38–40 / 800, tracking −1.2 | "14 Nov" in the ring |
| Weekday | 12.5 / 600, capitals, tracking 1.8, accent | "SATURDAY" |
| Screen title | 30–34 / 800, tracking −1 | "Review", "Settings" |
| Form title | 17 / 700 | "Log a meal" |
| Row title | 15.5–16 / 600 | "Chicken salad" |
| Body | 15 / 400, soft | explanations, empty states |
| Section label | 13 / 600, capitals, tracking 1.4, muted | "INGREDIENTS" |
| Caption | 12.5–13 / 400–500, muted | "egg, mustard", "12:40" |

Nothing below 11 pt.

### Shape and space

- Pills and circles radius 999; panels 26–30; sheets 34–40; photos 22.
- Screen margin 20. Gap 8 inside a group, 14–18 between groups.
- Touch targets at least 44 pt; list rows 52–56 pt; quick-action circles 56; the form Save 56 high.
- Icon circles: 34 (settings rows), 40 (log and list rows), 44 (sheets), 56–64 (quick actions).

### Motion

- First load only: sections rise 14 pt and fade in, 0.6–0.7 s, with a 0.1–0.15 s stagger. The ring arc draws in over 1.4 s; entry dots pop in after it.
- Sheets slide up 60 pt and fade in, 0.5 s.
- The aurora drifts in 18–26 s loops.
- A new entry's row keeps an accent line and glow for 3 s (UX-5). No toasts, no other animation.

### Icons

24 pt grid, outline, stroke 1.6, round caps and joins, in `text`. A closed shape carries a wash: the accent fading in from transparent at the middle to about 70 % at the bottom. On the accent (the Save pill, the active tab) icons use `onAccent`. Nails is the Skin hand with only the four nails tinted, stronger at the top. The full set is on the Design system board; new icons follow the same grid and stroke.

## Components

Each is drawn on the Design system board and used on the reference boards.

| Component | Rule |
| --- | --- |
| **Glass surface** | The base of everything: `glass.fill`, `glass.line`, `glass.blur`. Raised (fields, quick actions) uses the higher values. |
| **Button: primary** | Accent pill with `onAccent` text. One per screen. In forms it is the floating Save at the bottom. |
| **Button: glass** | Every ordinary action ("Other or earlier…", "Compare two photos"). |
| **Button: outline** | An accent-outlined pill for a secondary action that should stand out ("No change", "Same as yesterday"). |
| **Button: danger** | Coral tint and line, at the end of a screen ("Stop regular item"). It never acts directly: it opens a confirmation sheet. |
| **Button: danger solid** | Coral fill, only inside a confirmation sheet ("Delete"). |
| **Disabled** | White 7 % fill, text at 38 %, and a line above it saying what is missing (UX-3). |
| **Chip** | 38 high. Selected: accent with a tick. Unselected: 1.5 pt white 22 % outline. Suggested: dashed accent with a plus, never selected until tapped. Editable item: glass with a remove cross. Add: dashed white outline, accent text. More than about eight options: show the selected and suggested ones plus "+ N more" (UX-4), except Daily health's yes/no items, which are all shown because each must be answered. |
| **Field** | A pill, 52–58 high. The focused field gets `accent.line`. A search field leads with the magnifier. |
| **Switch row** | The whole pill is the control (`role="switch"`); iOS-sized switch, accent when on. An optional hint sits under the title. |
| **Score row** | Label and value on top; −, a slider in whole steps, + below. An optional score shows "–" and "not set" until set, then "Clear" (UX-3). |
| **Segmented control** | Two options in one glass pill; the selected one is a lighter pill. For two views of the same thing (Days, Areas). |
| **Grouped list** | A section label above a glass panel of rows with hairlines between them. A row: icon circle, title, optional value in muted, chevron. A destructive row is coral, last in its group, without a chevron. |
| **Output card** | Half-width glass card with an icon circle, a title and a status line (Doctor report, AI analysis). |
| **Context pill** | Short status notice on Today: at most two, in the order flare, Daily health, backup, AI suggestions (UX-2). The flare pill is coral with the severity in a coral circle. |
| **Quick action** | Glass circle 56 with an icon and a label under it; More is an outline circle, always last. At most 5 plus More, in a 3 by 2 grid. |
| **Log row** | Glass pill: icon circle, title, optional detail, time. The newest one gets the accent line and glow for 3 s. |
| **Day ring** | 256 pt glass circle. Outer track: intake, filled dots. Inner track: body and care, hollow dots. Accent arc up to now with a glow; hour labels 00, 06, 12, 18 from the day start. Date and entry count in the centre. Dots close together merge with a count. |
| **Photo** | 64–76 pt rounded square with a time caption; a sensitive photo is blurred with a lock badge. |
| **Tab bar** | Floating dark glass pill, 26 pt above the bottom; the active tab is an accent pill with icon and label. |

## Patterns

| Pattern | How it looks | Reference board |
| --- | --- | --- |
| **Today** | Ring, context pills, quick actions, log; gear top right, floating tab bar. | Aurora ring (Today-AuroraRing) |
| **Tab root** | Large title with the gear on the right, content in glass, floating tab bar. | Review: Days (Ref-Review) |
| **Pushed screen** | Glass back circle and a large title with an optional subtitle; no tab bar inside Settings (UX-1). | Area timeline, Settings, Regular item |
| **Full form (modal)** | Sheet from 54 pt with a grabber; header: glass Cancel, the title; floating Save at the bottom, above the keyboard (UX-3). | Meal review, Skin form, Daily health |
| **Two-phase form** | The choose phase has no Save; a pick or Continue moves to review (IN-7). | Meal choose, Meal review |
| **Quick sheet** | Floating sheet above the bottom edge over a dimmed screen; title, one-tap rows, "Other or earlier…" (UX-3). | Treatment quick sheet |
| **Confirmation** | Floating action sheet: title, what else goes, solid coral Delete, a separate Cancel pill below (UX-9). | Delete: swipe and confirm |
| **Grouped settings** | Section labels and glass panels of chevron rows; Delete data last, coral (UX-6). | Settings |
| **Settings detail** | Pushed screen with chips, switch rows, an info panel and the danger button at the bottom. | Settings detail: regular item |
| **Chart** | Glass card: title, metric chips, a line in the accent with a soft fill, the flare threshold as a dashed coral line and flare days as a coral band; a one-line text summary under it. | Area timeline |
| **Calendar** | Month in a glass panel; a white dot for entries, an accent ring for Daily health, a coral fill for flare days, a white ring for today; future days at 30 %. | Review: Days |
| **Empty state** | Centred: a dashed glass ring, a short title, one sentence, one primary button (UX-1). | Empty state: Review |

## Gestures

Each has a tap alternative (UX-12):

- Swipe the day ring: previous or next day. Alternative: the faint arrow buttons.
- Tap a dot on the ring: that entry's Edit and Delete sheet. Alternative: the log row.
- Swipe a log row left: Delete, then the confirmation sheet. Alternative: tap the row.
- Long-press a quick action: its full form. Alternative: "Other or earlier…" in the quick sheet.
- Swipe down on a form: Cancel, with Discard Changes first when something changed.
- Later (UX-13): press and drag around the ring to choose a time.

There is no save gesture.

## Do not

- Add a colour, a second accent or a per-type colour.
- Put Save in a form header, or a primary button anywhere but at the bottom of a form.
- Attach a bar, sheet or button to a screen edge.
- Select or save a suggestion without a tap.
- Animate anything except what Motion lists.
- Use emoji as icons, or a gesture without a tap alternative.
- Show more than two context pills or more than 5 pinned quick actions.

## Building it (Expo, not verified in Expo Go yet)

- **Tokens:** one `app/src/ui/theme.ts` with the values above; no colour literals in screens (today `#208AEF` and other colours are written inline, for example in `app/src/ui/components.tsx`).
- **Font:** Gabarito through `expo-font`, from bundled files or an `@expo-google-fonts` package if one exists (not checked).
- **Glass:** `expo-blur` `BlurView` with the fill and line on top. Fallback: a flat translucent fill if blur stutters with several layers and the aurora.
- **Ring, icons, chart:** `react-native-svg`.
- **Gestures and motion:** `react-native-gesture-handler` and `react-native-reanimated`, both already in the template.
- **Appearance:** `userInterfaceStyle` in `app.json` moves from `light` to `dark`.
- **Components to write once:** `GlassSurface`, `PillButton` (kinds above), `IconCircle`, `Chip`, `Field`, `SwitchRow`, `ScoreRow`, `Segmented`, `NavGroup` and `NavRow`, `ContextPill`, `QuickAction`, `LogRow`, `DayRing`, `Sheet` and `QuickSheet`, `ConfirmSheet`, `FloatingSave`, `FloatingTabBar`, `EmptyState`, `Icon` (the SVG set).

## Adding a board

`design/generator/` draws the generated boards (`screens.py`: Treatment sheet, Meal choose and review, More; `reference.py`: the eight reference screens; `components.py`: the Design system board; `icons_nails.py`: the icon options). The Today boards were written by hand and are only in `design/canvas/`. To add a screen, use the helpers in `reference.py` (`btn`, `chip`, `score_row`, `toggle_row`, `nav_row`, `group`, `pushed_header`, `modal_top`, `save_bar`, `tabbar`, `photo`) rather than new markup, and run the script; it writes `.dc.html` files into `design/canvas/` (or `$DESIGN_OUT`). A new board then goes onto the canvas with its entry in `canvas.json`.
