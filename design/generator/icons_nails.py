import os
# reuse HEAD/TAIL/helpers without regenerating the other boards
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screens.py')).read().split('# ---------------------------------------------------------------- 1.')[0]
ns = {'__file__': os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screens.py')}
exec(src, ns)
HEAD, TAIL, svg, GLASS, write = ns['HEAD'], ns['TAIL'], ns['svg'], ns['GLASS'], ns['write']

OPTIONS = [
    ('D', 'Hand, tinted nails (chosen)', 'Your idea: the Skin hand with only the fingertips tinted; Skin tints the palm instead.', ns['IC']['nails']),
    ('A', 'Three fingertips', 'Fingers seen from the back, the nails tinted. Reads as "fingers and nails" at a glance.',
     '<path d="M3.5 21v-9.5a2.6 2.6 0 0 1 5.2 0V21"/><path d="M9.4 21V7.5a2.6 2.6 0 0 1 5.2 0V21"/><path d="M15.3 21v-9.5a2.6 2.6 0 0 1 5.2 0V21"/>'
     '<path d="M4.7 11.6a1.4 1.4 0 0 1 2.8 0v1.6H4.7Z" fill="url(#axWash2)"/><path d="M10.6 7.6a1.4 1.4 0 0 1 2.8 0v1.6h-2.8Z" fill="url(#axWash2)"/><path d="M16.5 11.6a1.4 1.4 0 0 1 2.8 0v1.6h-2.8Z" fill="url(#axWash2)"/>'),
    ('B', 'Polish bottle', 'The usual "nails" symbol in icon sets. Clear, but it says cosmetics rather than health.',
     '<rect x="9" y="2.5" width="6" height="6" rx="1.6"/><path d="M10 8.5v2M14 8.5v2"/><rect x="5.5" y="10.5" width="13" height="11" rx="3.5"/>'
     '<path d="M5.5 15.5h13v2.5a3.5 3.5 0 0 1-3.5 3.5H9a3.5 3.5 0 0 1-3.5-3.5Z" fill="url(#axWash)" stroke="none"/>'),
    ('C', 'Stages in a row', 'Four small nails, the last ones changing, like the stages you log (SK-10). Abstract, ties to the feature.',
     '<rect x="2" y="8" width="4.2" height="8" rx="2.1"/><rect x="7.3" y="8" width="4.2" height="8" rx="2.1"/><rect x="12.5" y="8" width="4.2" height="8" rx="2.1"/><rect x="17.8" y="8" width="4.2" height="8" rx="2.1"/>'
     '<path d="M12.5 10.1a2.1 2.1 0 0 1 4.2 0V12h-4.2Z" fill="url(#axWash2)" stroke="none"/><path d="M17.8 10.1a2.1 2.1 0 0 1 4.2 0V14h-4.2Z" fill="url(#axWash2)" stroke="none"/>'),
]

cards = []
for letter, name, note, paths in OPTIONS:
    cards.append(f'''<div style="display: flex; align-items: center; gap: 16px; padding: 14px 18px 14px 14px; border-radius: 32px; {GLASS}">
<span style="font-size: 28px; font-weight: 800; width: 26px; text-align: center; color: {{{{accent}}}}">{letter}</span>
<span style="width: 64px; height: 64px; border-radius: 999px; background: rgba(255,255,255,0.08); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14); display: flex; align-items: center; justify-content: center; flex: none">{svg(paths, 30)}</span>
<span style="width: 40px; height: 40px; border-radius: 999px; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; flex: none">{svg(paths, 22)}</span>
<span style="flex: 1; min-width: 0"><span style="display: block; font-size: 16px; font-weight: 700">{name}</span><span style="display: block; font-size: 13px; line-height: 18px; color: #9AA4B2; margin-top: 2px">{note}</span></span>
</div>''')

body = f'''<svg aria-hidden="true" width="0" height="0" style="position: absolute"><defs>
<linearGradient id="axWash2" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="16"><stop offset="0" stop-color="{{{{accent}}}}" stop-opacity="0.85"/><stop offset="1" stop-color="{{{{accent}}}}" stop-opacity="0.35"/></linearGradient>
</defs></svg>
<div style="position: absolute; inset: 0; padding: 54px 20px 0 20px; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px">
<h1 style="margin: 0; font-size: 30px; font-weight: 800; letter-spacing: -0.8px">Nails icon</h1>
<p style="margin: 0; font-size: 14.5px; line-height: 21px; color: #C9D0DA">D is the chosen one. A to C stay for comparison. Each at quick-action size and at list size.</p>
{"".join(cards)}
</div>
'''
write('Icons-Nails.dc.html', 'Nails icon options', body)
print('ok')
