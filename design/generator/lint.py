"""Static checks over the generated boards (no rendering): balanced tags, template holes, font sizes, colours, touch heights.
Usage: python3 lint.py <folder> [prefix]   (default prefix G; pass '' for every board)"""
import os, re, sys
from html.parser import HTMLParser

VOID = {'meta', 'link', 'input', 'img', 'br', 'hr', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'stop', 'ellipse'}
HOLES = {'accent', 'accentSoft', 'accentLine', 'glowA', 'glowB', 'glowC', 'accentGlow', 'accentGlowSoft'}
TOKENS = {'#070B12', '#F2F5F9', '#C9D0DA', '#9AA4B2', '#5EEAD4', '#062A26', '#FF8A6B', '#2A0D04', '#6D4AE0', '#2563EB', '#FFFFFF', '#E6EAF0',
          '#0E141E', '#000', '#C9A39A', '#8E6E68', '#3B302F', '#A3E635', '#C4B5FD',
          '#E8C468'}  # nail stage yellow (SK-10, design-system.md, Nail stage colours)

class P(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack, self.errors = [], []
    def handle_starttag(self, tag, attrs):
        if tag not in VOID:
            self.stack.append(tag)
    def handle_startendtag(self, tag, attrs):
        pass
    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack or self.stack[-1] != tag:
            self.errors.append(f'unexpected </{tag}> (open: {self.stack[-3:]})')
            if tag in self.stack:
                while self.stack and self.stack.pop() != tag:
                    pass
        else:
            self.stack.pop()

def check(path):
    s = open(path).read()
    body = s[s.index('<x-dc>'):s.index('</x-dc>')]
    msgs = []
    p = P()
    p.feed(body)
    msgs += p.errors
    if [t for t in p.stack if t != 'x-dc']:
        msgs.append(f'unclosed: {p.stack}')
    for h in set(re.findall(r'\{\{([^}]*)\}\}', body)):
        if h not in HOLES:
            msgs.append(f'unknown hole {{{{{h}}}}}')
    if '@A@' in s or '@S@' in s or '@L@' in s:
        msgs.append('unreplaced placeholder')
    for m in re.finditer(r'font-size: ([0-9.]+)px', body):
        if float(m.group(1)) < 11:
            msgs.append(f'font-size {m.group(1)} < 11')
            break
    for m in re.finditer(r'font-size="([0-9.]+)"', body):
        if float(m.group(1)) < 11:
            msgs.append(f'svg font-size {m.group(1)} < 11')
            break
    for c in set(re.findall(r'#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b', body)):
        if c.upper() not in {t.upper() for t in TOKENS}:
            msgs.append(f'colour outside tokens {c}')
    if re.search(r'[\U0001F300-\U0001FAFF☀-➿]', body):
        msgs.append('emoji')
    small = []
    for m in re.finditer(r'<(button|a)\b[^>]*style="([^"]*)"', body):
        st = m.group(2)
        hh = re.search(r'(?<![-a-z])height: (\d+)px', st)
        ww = re.search(r'(?<![-a-z])width: (\d+)px', st)
        if hh and int(hh.group(1)) < 44 and 'position: absolute; inset' not in st:
            small.append(f'h{hh.group(1)}')
    if small:
        msgs.append('buttons under 44 high: ' + ', '.join(sorted(set(small))) + f' ({len(small)})')
    return msgs

if __name__ == '__main__':
    folder = sys.argv[1]
    prefix = sys.argv[2] if len(sys.argv) > 2 else 'G'
    bad = 0
    for f in sorted(os.listdir(folder)):
        if f.endswith('.dc.html') and f.startswith(prefix):
            m = check(os.path.join(folder, f))
            hard = [x for x in m if not x.startswith('buttons under')]
            if m:
                print(f, '->', '; '.join(m))
            bad += len(hard)
    print('hard problems:', bad)
