// Vector stroke font: every glyph is a few polylines on a 4x6 grid. No font files, pure neon lines.
const G = {
  A:'0602204246 0343',B:'06003041423303 3344453606',C:'4130100105163645',D:'06002042442606',E:'40000646 0333',F:'400006 0333',
  G:'41301001051636454323',H:'0006 4046 0343',I:'1030 1636 2026',J:'4045361605',K:'0006 400346',L:'000646',M:'0600234046',N:'06004640',
  O:'103041453616050110',P:'06003041423303',Q:'103041453616050110 2446',R:'06003041423303 2346',S:'413010010213334445361605',
  T:'0040 2026',U:'000516364540',V:'002640',W:'0016233640',X:'0046 4006',Y:'002340 2326',Z:'00400646',
  0:'103041453616050110',1:'112026 1636',2:'01103041420646',3:'01103041423313 334445361605',4:'36300444',5:'4000033344453606',
  6:'40100105163645443303',7:'004016',8:'13020110304142331304051636454433',9:'43130201103041453606',
  '-':'1333','.':'2526',':':'2122 2425','!':'2023 2526','?':'011030414223 2526','/':'0640','+':'0343 2125','>':'003306','<':'400346',
  "'":'2021',',':'2516','=':'0242 0444','(':'30121436',')':'10323416','%':'0640 0011 3546','*':'0343 1135 3115','_':'0646','#':'1016 3036 0242 0444','i':'2226 2021','|':'2026','@':'10300141451636150501 10'
};
const P = {};
for (const k in G) P[k] = G[k].split(' ').map(s => { const a = []; for (let i = 0; i < s.length; i += 2) a.push(+s[i], +s[i + 1]); return a; });
export const ADV = 5.6 / 6;
export function textWidth(str, size, bold) { return str.length * size * ADV * (bold ? 1.1 : 1) - size * 1.6 / 6; }
// draws str with cap height `size` px; (x,y) is the top-left (or top-center / top-right with align)
let TG = 2; export const setTextGlow = n => { TG = n; }; // 2: full neon text, 1: one halo, 0: plain strokes (the cheapest)
export function text(ctx, str, x, y, size, col, o = {}) {
  str = o.raw ? String(str) : String(str).toUpperCase();
  const B = !!o.bold, u = size / 6, sk = o.italic ? 0.3 : B ? 0.16 : 0.09, w = textWidth(str, size, B), adv = size * ADV * (B ? 1.1 : 1);
  if (o.align === 'center') x -= w / 2; else if (o.align === 'right') x -= w;
  ctx.beginPath();
  for (let i = 0; i < str.length; i++) {
    const g = P[str[i]]; const ox = x + i * adv;
    if (!g) continue;
    for (const pl of g) { // every corner is rounded off, so the strokes read as bent neon tube instead of calculator segments
      const n = pl.length >> 1, X = k => ox + (pl[k * 2] + (6 - pl[k * 2 + 1]) * sk) * u, Y = k => y + pl[k * 2 + 1] * u, R = 0.62 * u;
      if (n < 3) { ctx.moveTo(X(0), Y(0)); for (let k = 1; k < n; k++) ctx.lineTo(X(k), Y(k)); continue; }
      const closed = pl[0] === pl[n * 2 - 2] && pl[1] === pl[n * 2 - 1], bend = (a, b, c) => { const bx = X(b), by = Y(b), l1 = Math.hypot(X(a) - bx, Y(a) - by) || 1, l2 = Math.hypot(X(c) - bx, Y(c) - by) || 1, f1 = Math.min(0.5, R / l1), f2 = Math.min(0.5, R / l2); ctx.lineTo(bx + (X(a) - bx) * f1, by + (Y(a) - by) * f1); if (B) ctx.lineTo(bx + (X(c) - bx) * f2, by + (Y(c) - by) * f2); else ctx.quadraticCurveTo(bx, by, bx + (X(c) - bx) * f2, by + (Y(c) - by) * f2); }; // bold cuts its corners square-on, the neon style bends them
      if (closed) { ctx.moveTo((X(0) + X(1)) / 2, Y(0) / 2 + Y(1) / 2); for (let k = 1; k < n - 1; k++) bend(k - 1, k, k + 1); bend(n - 2, 0, 1); ctx.closePath(); }
      else { ctx.moveTo(X(0), Y(0)); for (let k = 1; k < n - 1; k++) bend(k - 1, k, k + 1); ctx.lineTo(X(n - 1), Y(n - 1)); } }
  }
  ctx.lineJoin = B ? 'miter' : 'round'; ctx.lineCap = B ? 'square' : 'round'; ctx.miterLimit = 3;
  const a = o.alpha == null ? 1 : o.alpha, lw = o.weight || (B ? Math.max(2, size / 4.6) : Math.max(1.2, size / 9));
  if (o.glow !== false && TG) { ctx.strokeStyle = col; if (o.tube && TG > 1) { ctx.globalAlpha = a * 0.1; ctx.lineWidth = lw * (B ? 3.6 : 7); ctx.stroke(); } ctx.globalAlpha = a * (B ? 0.22 : 0.28); ctx.lineWidth = lw * (B ? 2 : 3.4); ctx.stroke(); }
  ctx.globalAlpha = a; ctx.strokeStyle = o.core || col; ctx.lineWidth = lw; ctx.stroke();
  ctx.globalAlpha = 1;
  return w;
}

// ---- two real typefaces, for the places the stroke font looked plain: titles (Zen Dots) and the people talking (Chakra Petch) ----
// Both are SIL Open Font License fonts, subset to plain ASCII (see fonts/OFL-*.txt). Until they load, everything falls back to the stroke font.
const FACES = { d: ['ZenDots2D', 'ZenDots-Regular.woff', 0.715], p: ['ChakraPetch2D', 'ChakraPetch-Bold.woff', 0.7] };
const READY = { d: false, p: false };
export function loadFaces() { if (typeof FontFace === 'undefined' || !document.fonts) return;
  for (const k in FACES) { const [fam, file] = FACES[k]; if (READY[k]) continue; try { const f = new FontFace(fam, `url(${new URL('./fonts/' + file, import.meta.url)})`); f.load().then(ff => { document.fonts.add(ff); READY[k] = true; }).catch(() => { }); } catch { } } }
const px = (k, size) => size / FACES[k][2]; // size is the cap height, as for text()
function setFont(ctx, k, size) { ctx.font = `${px(k, size).toFixed(2)}px ${FACES[k][0]}`; ctx.textBaseline = 'alphabetic'; }
// big display text: a chrome gradient through the colour, a dark rim and a neon halo. Same arguments as text(); returns the width
export function dtext(ctx, str, x, y, size, col, o = {}) {
  str = String(str).toUpperCase(); if (!READY.d) return text(ctx, str, x, y, size, col, { bold: true, weight: o.weight || Math.max(2, size / 9), tube: true, align: o.align, alpha: o.alpha });
  ctx.save(); setFont(ctx, 'd', size); const sp = o.track ?? size * 0.06; if ('letterSpacing' in ctx) ctx.letterSpacing = sp.toFixed(1) + 'px';
  const w = ctx.measureText(str).width - (('letterSpacing' in ctx) ? sp : 0); if (o.align === 'center') x -= w / 2; else if (o.align === 'right') x -= w; ctx.textAlign = 'left';
  const base = y + size, a = o.alpha == null ? 1 : o.alpha; if (o.skew) ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([1, 0, -o.skew, 1, o.skew * base, 0])));
  ctx.lineJoin = 'round'; ctx.strokeStyle = col; if (o.glow !== false && TG) { ctx.globalAlpha = a * 0.16; ctx.lineWidth = size * 0.55; ctx.strokeText(str, x, base); ctx.globalAlpha = a * 0.3; ctx.lineWidth = size * 0.26; ctx.strokeText(str, x, base); }
  ctx.globalAlpha = a; ctx.strokeStyle = o.rim || '#05020f'; ctx.lineWidth = Math.max(2, size * 0.14); ctx.strokeText(str, x + size * 0.04, base + size * 0.06); // a drop rim
  const gr = ctx.createLinearGradient(0, y - size * 0.05, 0, base + size * 0.05); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.42, o.top || '#ffffff'); gr.addColorStop(0.5, col); gr.addColorStop(1, o.low || col); ctx.fillStyle = gr; ctx.fillText(str, x, base); // chrome: white sky over the colour, split at the horizon
  ctx.strokeStyle = col; ctx.globalAlpha = a * 0.9; ctx.lineWidth = Math.max(1, size * 0.035); ctx.strokeText(str, x, base);
  ctx.restore(); return w; }
// people talking (RIVET-9's comms, the story cards): a clean, squared-off sans. Same arguments as text(); returns the width
export function ptext(ctx, str, x, y, size, col, o = {}) {
  str = String(str); if (!READY.p) return text(ctx, str.toUpperCase(), x, y, size, col, { bold: true, glow: o.glow, align: o.align, alpha: o.alpha });
  ctx.save(); setFont(ctx, 'p', size); ctx.textAlign = o.align || 'left'; const a = o.alpha == null ? 1 : o.alpha, base = y + size;
  if (o.glow && TG) { ctx.globalAlpha = a * 0.25; ctx.strokeStyle = col; ctx.lineWidth = size * 0.3; ctx.lineJoin = 'round'; ctx.strokeText(str, x, base); }
  ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillText(str, x, base); const w = ctx.measureText(str).width; ctx.restore(); return w; }
export function pWidth(ctx, str, size) { if (!READY.p) return textWidth(String(str).toUpperCase(), size, true); ctx.save(); setFont(ctx, 'p', size); const w = ctx.measureText(String(str)).width; ctx.restore(); return w; }
export const facesReady = () => READY.d && READY.p;
