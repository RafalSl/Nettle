"""Builds one group: python3 build.py <n>. Writes the boards to $DESIGN_OUT and the group into canvas.json there."""
import importlib, os, sys
import lib, canvasjson

n = int(sys.argv[1])
mod = importlib.import_module(f'group{n}')
mod.run()
out = os.environ.get('DESIGN_OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'canvas'))
mine = [b for b in lib.BOARDS]
y0 = canvasjson.add_group(os.path.join(out, 'canvas.json'), n, mod.TITLE, mine, mod.NEEDS)
print(f'group {n}: {len(mine)} boards, row at y={y0}')
print(' '.join(b['file'] for b in mine))
