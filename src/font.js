// Vector stroke font: every glyph is a few polylines on a 4x6 grid. No font files, pure neon lines.
const G = {
  A:'0602204246 0343',B:'06003041423303 3344453606',C:'4130100105163645',D:'06002042442606',E:'40000646 0333',F:'400006 0333',
  G:'41301001051636454323',H:'0006 4046 0343',I:'1030 1636 2026',J:'4045361605',K:'0006 400346',L:'000646',M:'0600234046',N:'06004640',
  O:'103041453616050110',P:'06003041423303',Q:'103041453616050110 2446',R:'06003041423303 2346',S:'413010010213334445361605',
  T:'0040 2026',U:'000516364540',V:'002640',W:'0016233640',X:'0046 4006',Y:'002340 2326',Z:'00400646',
  0:'103041453616050110 0541',1:'112026 1636',2:'01103041420646',3:'01103041423313 334445361605',4:'36300444',5:'4000033344453606',
  6:'40100105163645443303',7:'004016',8:'13020110304142331304051636454433',9:'43130201103041453606',
  '-':'1333','.':'2526',':':'2122 2425','!':'2024 2526','?':'01103041422324 2526','/':'0640','+':'0343 2125','>':'003306','<':'400346',
  "'":'2021',',':'2516','=':'0242 0444','(':'30121436',')':'10323416','%':'0640 0011 3546','*':'0343 1135 3115','_':'0646','#':'1016 3036 0242 0444'
};
const P = {};
for (const k in G) P[k] = G[k].split(' ').map(s => { const a = []; for (let i = 0; i < s.length; i += 2) a.push(+s[i], +s[i + 1]); return a; });
export const ADV = 5.6 / 6;
export function textWidth(str, size) { return str.length * size * ADV - size * 1.6 / 6; }
// draws str with cap height `size` px; (x,y) is the top-left (or top-center / top-right with align)
export function text(ctx, str, x, y, size, col, o = {}) {
  str = String(str).toUpperCase();
  const u = size / 6, sk = o.italic ? 0.28 : 0, w = textWidth(str, size);
  if (o.align === 'center') x -= w / 2; else if (o.align === 'right') x -= w;
  ctx.beginPath();
  for (let i = 0; i < str.length; i++) {
    const g = P[str[i]]; const ox = x + i * size * ADV;
    if (!g) continue;
    for (const pl of g) for (let j = 0; j < pl.length; j += 2) {
      const px = ox + (pl[j] + (6 - pl[j + 1]) * sk) * u, py = y + pl[j + 1] * u;
      if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
  }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const a = o.alpha == null ? 1 : o.alpha, lw = o.weight || Math.max(1.2, size / 9);
  if (o.glow !== false) { ctx.globalAlpha = a * 0.28; ctx.strokeStyle = col; ctx.lineWidth = lw * 3.4; ctx.stroke(); }
  ctx.globalAlpha = a; ctx.strokeStyle = o.core || col; ctx.lineWidth = lw; ctx.stroke();
  ctx.globalAlpha = 1;
  return w;
}
