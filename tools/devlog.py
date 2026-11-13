# turns DEVLOG.md into src/devlog.js (the in-game DEVLOG and CREDITS text). usage: python3 tools/devlog.py
import re, json, os
root = os.path.join(os.path.dirname(__file__), '..')
s = open(os.path.join(root, 'DEVLOG.md')).read(); out = []
for ln in s.split('\n'):
    t = ln.strip()
    if not t: out.append(''); continue
    if t.startswith('!['): continue  # screenshots are for the web devlog
    kind = 'p'
    if t.startswith('# '): kind, t = 'h1', t[2:]
    elif t.startswith('## '): kind, t = 'h2', t[3:]
    elif t.startswith('### '): kind, t = 'h3', t[4:]
    elif t.startswith('> '): kind, t = 'q', t[2:]
    elif t.startswith('- '): kind, t = 'b', t[2:]
    elif re.match(r'^\d+\. ', t): kind = 'b'
    t = t.replace('**', '').replace('*', '').replace('`', '').replace('—', '-').replace('"', "'")
    t = re.sub(r"[^A-Za-z0-9 \-.:!?/+<>',=()%#_]", '', t)
    width = {'h1': 40, 'h2': 52, 'h3': 60, 'q': 78, 'b': 80, 'p': 84}[kind]; cur = ''; first = True
    for w in t.split(' '):
        if len(cur) + len(w) + 1 > width and cur: out.append([kind if first else kind + '+', cur]); first = False; cur = w
        else: cur = (cur + ' ' + w).strip()
    out.append([kind if first else kind + '+', cur])
js = "// generated from DEVLOG.md by tools/devlog.py. In-game DEVLOG and CREDITS text.\nexport const DEVLOG = " + json.dumps(out, separators=(',', ':')) + ";\n"
js += '''export const CREDITS = [['h1','2DISO SHIFT'],'',['h3','GAME DESIGN AND DIRECTION'],['p','BENJAMIN CAMPBELL (BDC)'],'',['h3','PROGRAMMING, VECTOR ART, SOUND'],['p','CLAUDE (ANTHROPIC), DIRECTED BY BDC'],'',['h3','BASED ON'],['p','2DISO, THE ORIGINAL GAMEMAKER GAME BY BDC / SYCX1'],'',['h3','MADE FOR'],['p','GITHUB GAME OFF 2026 - THEME: SHIFT'],'',['h3','TECH'],['p','PLAIN JAVASCRIPT. CANVAS 2D AND WEB AUDIO.'],['p','NO ENGINE, NO ART FILES, NO AUDIO FILES.'],'',['h3','THANKS'],['p','EVERYONE ON THE GRIDDIM NETWORK'],'',['q','(C) 2026 GRIDDIM / ARCADEGRIDZ / BDC'],['p','CODE RELEASED UNDER THE MIT LICENSE']];\n'''
open(os.path.join(root, 'src', 'devlog.js'), 'w').write(js)
