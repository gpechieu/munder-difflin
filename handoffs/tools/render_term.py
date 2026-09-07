#!/usr/bin/env python3
"""Render one or more text captures into a single terminal-styled PNG.

usage: render_term.py OUT.png "TITLE" file1.txt [file2.txt ...]
Each file becomes a panel; lines are colour-coded like a test runner:
  'not ok' → red, 'ok ' → green, '# ' summary → yellow, '$ ' prompt → cyan.
"""
import sys
from PIL import Image, ImageDraw, ImageFont

out, title, files = sys.argv[1], sys.argv[2], sys.argv[3:]
FONT = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 15)
BOLD = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 15, index=1)
TITLE = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 17, index=1)
LH, PAD, MAXW = 22, 18, 118  # line height, padding, wrap width (chars)

BG, FG = (24, 26, 32), (212, 214, 220)
COLORS = {
    'notok': (255, 112, 112), 'ok': (120, 220, 140), 'summary': (250, 210, 100),
    'prompt': (110, 200, 240), 'comment': (140, 145, 160), 'title': (255, 255, 255),
    'panel': (48, 52, 62),
}

def classify(line):
    s = line.lstrip()
    if s.startswith('not ok'): return 'notok'
    if s.startswith('ok '): return 'ok'
    if s.startswith('# tests') or s.startswith('# pass') or s.startswith('# fail'): return 'summary'
    if s.startswith('$ '): return 'prompt'
    if s.startswith('#'): return 'comment'
    return None

def wrap(line):
    if len(line) <= MAXW: return [line]
    out, cur = [], line
    while len(cur) > MAXW:
        out.append(cur[:MAXW]); cur = '  ' + cur[MAXW:]
    out.append(cur); return out

panels = []
for f in files:
    lines = []
    for raw in open(f, encoding='utf-8').read().rstrip('\n').split('\n'):
        lines.extend(wrap(raw.rstrip()))
    panels.append(lines)

total_lines = sum(len(p) for p in panels)
width = PAD * 2 + 9 * MAXW
height = PAD * 3 + 30 + total_lines * LH + (len(panels) - 1) * (PAD + 2)
img = Image.new('RGB', (width, height), BG)
d = ImageDraw.Draw(img)
y = PAD
d.text((PAD, y), title, font=TITLE, fill=COLORS['title']); y += 30 + PAD // 2
for i, lines in enumerate(panels):
    if i:
        d.line([(PAD, y), (width - PAD, y)], fill=COLORS['panel'], width=2); y += PAD + 2
    for line in lines:
        kind = classify(line)
        font = BOLD if kind in ('prompt', 'summary', 'notok') else FONT
        d.text((PAD, y), line, font=font, fill=COLORS.get(kind, FG)); y += LH
img.save(out, optimize=True)
print(out, img.size)
