"""Adds a group's boards, its title and its 'Needs approval' sticky to canvas.json.
Rows start at y = 7900 and go down; boards are 390 wide and 470 apart; at most 8 boards per line."""
import json, os

PER_LINE = 8

def add_group(canvas_path, num, title, boards, sticky_text, sticky_fill='orange'):
    c = json.load(open(canvas_path))
    bottom = max(b['y'] + b['h'] for b in c['boards'].values())
    has_groups = any(k.startswith('g') and k[1:-1].isdigit() for k in c['notes'])
    y0 = bottom + 520 if has_groups else 7900
    gid = f'g{num}'
    if gid + 't' in c['notes']:  # re-run of a group: reuse its position
        y0 = c['notes'][gid + 't']['y'] + 300
    # remove this group's earlier boards from the index so a re-run does not duplicate them
    for k in [k for k in c['boards'] if k.startswith(f'G{num}-')]:
        del c['boards'][k]
        if k in c['order']:
            c['order'].remove(k)
    y = y0
    line_h = 0
    first_line_cols = 1
    for i, b in enumerate(boards):
        col = i % PER_LINE
        if col == 0 and i:
            y += line_h + 160
            line_h = 0
        c['boards'][b['file']] = {'x': col * 470, 'y': y, 'w': b['w'], 'h': b['h'], 'title': b['title'], 'radius': 44}
        c['order'].append(b['file'])
        line_h = max(line_h, b['h'])
        if i < PER_LINE:
            first_line_cols = col + 1
    width = min(len(boards), PER_LINE) * 470 - 80
    c['notes'][gid + 't'] = {'x': 0, 'y': y0 - 300, 'text': title, 'kind': 'title1', 'maxW': max(width, 1800)}
    c['notes'][gid + 's'] = {'x': first_line_cols * 470, 'y': y0, 'w': 340, 'fill': sticky_fill, 'size': 's', 'text': sticky_text}
    json.dump(c, open(canvas_path, 'w'), ensure_ascii=False)
    return y0
