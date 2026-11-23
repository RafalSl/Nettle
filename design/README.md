# Design files

Design work for the app's UI. The written spec is `docs/design-system.md`; the decisions are in `docs/requirements.md` (UX-2, UX-3, UX-12, UX-13, IN-10).

- `canvas/`: a copy of the design canvas's files (one `.dc.html` per artboard, plus `canvas.json` with the layout). The live canvas is https://claude.ai/artifact/BVCSSjDYjDDMVcKrshmazt. Approved: the "Aurora ring" boards. The other Today boards (light floating in teal, blue and violet, dots, Aurora, Day ring, Signal) are kept for comparison.
- `generator/`: Python 3 scripts that draw the generated boards from shared parts, so new boards match. Run from this folder, for example `python3 generator/reference.py`; output goes to `canvas/` (or `$DESIGN_OUT`).
  - `screens.py`: the shared head, icons and glass styles, and the Treatment quick sheet, Meal choose, Meal review and More boards.
  - `reference.py`: the reference screens (Skin, Daily health, Review, Area timeline, Settings, Regular item, Delete sheet, empty Review) and the building blocks (`btn`, `chip`, `score_row`, `toggle_row`, `nav_row`, `group`, `pushed_header`, `tabbar`, `photo`).
  - `components.py`: the Design system board.
  - `icons_nails.py`: the Nails icon options.
  - `group1.py` … `group8.py`: one group of boards each, built with `python3 generator/build.py <n>` (writes the boards and the group's row into `canvas.json`). Group 8 (2026-11-23) is the first-use review: skin check, nail map, steady Today, Edit Today preview, score tables, stool rows, drinks by name, area order, Polish layout fixes.
  - `lint.py`: static checks over the boards (`python3 generator/lint.py canvas G8`).

The boards contain invented example data only (no diary data).
