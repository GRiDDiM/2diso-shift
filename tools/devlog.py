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
# the in-game devlog: tabs (backstory, each day, to do), each holding entries that fold open one at a time, with their screenshots
def clean(t):
    t = t.replace('**', '').replace('*', '').replace('`', '').replace('—', '-').replace('"', "'")
    return re.sub(r"[^A-Za-z0-9 \-.:!?/+<>',=()%#_]", '', t)
def wrap(kind, t, width):
    res, cur, first = [], '', True
    for w in t.split(' '):
        if len(cur) + len(w) + 1 > width and cur: res.append([kind if first else kind + '+', cur]); first = False; cur = w
        else: cur = (cur + ' ' + w).strip()
    res.append([kind if first else kind + '+', cur]); return res
TABN = {'Backstory': 'STORY', 'Still to do': 'TO DO'}
tabs, tab, ent, lastH2 = [], None, None, ''
shotdir = os.path.join(root, 'src', 'shots'); os.makedirs(shotdir, exist_ok=True); used = set()
try:
    from PIL import Image
except Exception:
    Image = None
for ln in s.split('\n'):
    t = ln.strip()
    if t.startswith('# '): tab = {'name': 'ABOUT', 'entries': []}; tabs.append(tab); ent = {'title': 'ABOUT THIS DEVLOG', 'lines': []}; tab['entries'].append(ent); continue
    if t.startswith('## '):
        h = t[3:]; key = h.split(' — ')[0].split(' - ')[0]; lastH2 = (h.split(' — ') + [''])[1] or h
        name = TABN.get(key, key.upper()); tab = {'name': name, 'entries': []}; tabs.append(tab)
        ent = None
        if name == 'TO DO': ent = {'title': 'WHAT IS LEFT TO DO', 'lines': []}; tab['entries'].append(ent)
        continue
    if t.startswith('### '): ent = {'title': clean(t[4:]).upper(), 'lines': []}; tab['entries'].append(ent); continue
    if ent is None:
        if not t: continue
        ent = {'title': clean(lastH2).upper(), 'lines': []}; tab['entries'].append(ent)
    m = re.match(r'^!\[(.*?)\]\((.*?)\)', t)
    if m:
        cap, src = m.group(1), m.group(2); fn = os.path.basename(src); used.add(fn)
        if Image and os.path.exists(os.path.join(root, src)):
            im = Image.open(os.path.join(root, src)).convert('RGB'); w = 560; im = im.resize((w, round(im.height * w / im.width))); im.save(os.path.join(shotdir, fn), quality=80)
            ent['lines'].append(['img', 'shots/' + fn, clean(cap).upper(), im.width, im.height])
        continue
    if not t: (ent['lines'] and ent['lines'][-1] != '') and ent['lines'].append(''); continue
    kind = 'p'
    if t.startswith('> '): kind, t = 'q', t[2:]
    elif t.startswith('- '): kind, t = 'b', t[2:]
    elif re.match(r'^\d+\. ', t): kind = 'b'
    elif t.startswith('#### '): kind, t = 'h3', t[5:]
    ent['lines'] += wrap(kind, clean(t), {'q': 86, 'b': 88, 'p': 92, 'h3': 70}[kind])
for fn in os.listdir(shotdir):
    if fn not in used: os.remove(os.path.join(shotdir, fn))
# the ABOUT intro joins the STORY tab
if tabs and tabs[0]['name'] == 'ABOUT' and len(tabs) > 1: tabs[1]['entries'] = tabs[0]['entries'] + tabs[1]['entries']; tabs.pop(0)
for tb in tabs:
    for e in tb['entries']:
        while e['lines'] and e['lines'][-1] == '': e['lines'].pop()
js = "// generated from DEVLOG.md by tools/devlog.py. In-game DEVLOG (tabs of fold-open entries) and CREDITS text.\nexport const DEVLOG = " + json.dumps(out, separators=(',', ':')) + ";\n"
js += "export const DEVLOG_TABS = " + json.dumps(tabs, separators=(',', ':')) + ";\n"
js += '''export const CREDITS = [['h1','2DISO SHIFT'],'',['h3','GAME DESIGN AND DIRECTION'],['p','BENJAMIN CAMPBELL (BDC)'],'',['h3','PROGRAMMING, VECTOR ART, SOUND'],['p','CLAUDE (ANTHROPIC), DIRECTED BY BDC'],'',['h3','BASED ON'],['p','2DISO, THE ORIGINAL GAMEMAKER GAME BY BDC / SYCX1'],'',['h3','MADE FOR'],['p','GITHUB GAME OFF 2026 - THEME: SHIFT'],'',['h3','TECH'],['p','PLAIN JAVASCRIPT. CANVAS 2D AND WEB AUDIO.'],['p','NO ENGINE, NO ART FILES, NO AUDIO FILES.'],'',['h3','THANKS'],['p','EVERYONE ON THE GRIDDIM NETWORK'],'',['q','(C) 2026 GRIDDIM / ARCADEGRIDZ / BDC'],['p','CODE RELEASED UNDER THE MIT LICENSE']];\n'''
open(os.path.join(root, 'src', 'devlog.js'), 'w').write(js)
