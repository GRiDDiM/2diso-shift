// 2DISO SHIFT — neon vector renderer. Everything is glowing lines; four projections of the same 3D world.
import { VIEWS, BAR, BARMAX, DRONE_MODES } from './game.js';
import { text, textWidth } from './font.js';
export const W = 960, H = 540;
const TAU = Math.PI * 2;
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ---------- projection ----------
let cam = { x: 0, y: 2, z: -7 }, vA = 0, vB = 0, mix = 1, rollA = 0;
let X = 0, Y = 0, S = 1, OK = true;
function p1(v, x, y, z) {
  if (v === 0) { X = 60 + z * 34; Y = 470 - y * 42; S = 1; return true; }
  if (v === 1) { X = 150 + z * 26 + x * 14; Y = 400 - z * 11 + x * 10 - y * 18; S = 0.72; return true; }
  if (v === 3) { X = 480 + x * 40; Y = 480 - z * 19; S = 0.95; return true; }
  let d = z - cam.z, ok = true; if (d < 0.5) { d = 0.5; ok = false; }
  X = 480 + (x - cam.x) / d * 440; Y = 300 - (y - cam.y) / d * 440; S = 440 / d / 34; return ok;
}
function P(x, y, z) {
  if (mix >= 1) { OK = p1(vB, x, y, z); return; }
  const okA = p1(vA, x, y, z), ax = X, ay = Y, as = S, okB = p1(vB, x, y, z);
  let px = ax + (X - ax) * mix, py = ay + (Y - ay) * mix; S = as + (S - as) * mix; OK = mix < 0.5 ? okA : okB;
  const c = Math.cos(rollA), s = Math.sin(rollA), dx = px - 480, dy = py - 270; X = 480 + dx * c - dy * s; Y = 270 + dx * s + dy * c;
}

// ---------- line batching: one path per colour, stroked twice (glow + core) ----------
const buckets = new Map();
function seg(x1, y1, z1, x2, y2, z2, col, a = 1) {
  P(x1, y1, z1); if (!OK) return; const ax = X, ay = Y; P(x2, y2, z2); if (!OK) return;
  if ((ax < -200 && X < -200) || (ax > W + 200 && X > W + 200) || (ay < -200 && Y < -200) || (ay > H + 200 && Y > H + 200)) return;
  const k = col + (a >= 1 ? '' : '|' + a); let b = buckets.get(k); if (!b) { b = { col, a, d: [] }; buckets.set(k, b); } b.d.push(ax, ay, X, Y);
}
function flush(ctx, glow) {
  ctx.lineCap = 'round';
  for (const b of buckets.values()) {
    const d = b.d; if (!d.length) continue; ctx.beginPath(); for (let i = 0; i < d.length; i += 4) { ctx.moveTo(d[i], d[i + 1]); ctx.lineTo(d[i + 2], d[i + 3]); }
    ctx.strokeStyle = b.col; if (glow) { ctx.globalAlpha = 0.2 * b.a; ctx.lineWidth = 6; ctx.stroke(); }
    ctx.globalAlpha = b.a; ctx.lineWidth = 1.5; ctx.stroke(); d.length = 0;
  }
  ctx.globalAlpha = 1;
}
function box(o, col, a = 1, bands = 0) {
  const x0 = o.x - o.hx, x1 = o.x + o.hx, y0 = o.y - o.hy, y1 = o.y + o.hy, z0 = o.z - o.hz, z1 = o.z + o.hz;
  seg(x0, y0, z0, x1, y0, z0, col, a); seg(x1, y0, z0, x1, y0, z1, col, a); seg(x1, y0, z1, x0, y0, z1, col, a); seg(x0, y0, z1, x0, y0, z0, col, a);
  seg(x0, y1, z0, x1, y1, z0, col, a); seg(x1, y1, z0, x1, y1, z1, col, a); seg(x1, y1, z1, x0, y1, z1, col, a); seg(x0, y1, z1, x0, y1, z0, col, a);
  seg(x0, y0, z0, x0, y1, z0, col, a); seg(x1, y0, z0, x1, y1, z0, col, a); seg(x1, y0, z1, x1, y1, z1, col, a); seg(x0, y0, z1, x0, y1, z1, col, a);
  for (let i = 1; i <= bands; i++) { const y = y0 + (y1 - y0) * i / (bands + 1); seg(x0, y, z0, x1, y, z0, col, a * 0.45); seg(x0, y, z0, x0, y, z1, col, a * 0.45); seg(x1, y, z0, x1, y, z1, col, a * 0.45); }
}
// mesh = list of polylines of [x,y,z]; rotated by yaw (around y), pitch (around x), roll (around z)
function mesh(M, x, y, z, s, yaw, pitch, roll, col, a = 1) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  for (const pl of M) { let lx = 0, ly = 0, lz = 0; for (let i = 0; i < pl.length; i++) { let [px, py, pz] = pl[i];
    let t = px * cr - py * sr; py = px * sr + py * cr; px = t; t = py * cp - pz * sp; pz = py * sp + pz * cp; py = t; t = px * cy + pz * sy; pz = -px * sy + pz * cy; px = t;
    px = x + px * s; py = y + py * s; pz = z + pz * s; if (i) seg(lx, ly, lz, px, py, pz, col, a); lx = px; ly = py; lz = pz; } }
}
function circle(x, y, z, r, col, a = 1, n = 18, plane = 0, rot = 0) {
  let lx, ly, lz; for (let i = 0; i <= n; i++) { const t = rot + i / n * TAU, c = Math.cos(t) * r, s = Math.sin(t) * r; const px = plane === 2 ? x : x + c, py = plane === 1 ? y : y + (plane === 2 ? c : s), pz = plane === 0 ? z : z + s; if (i) seg(lx, ly, lz, px, py, pz, col, a); lx = px; ly = py; lz = pz; }
}

// ---------- models ----------
const N = [0, 0, 1.35], Ct = [0, 0.24, 0.3], Sr = [0, 0.13, -0.75], Bk = [0, -0.14, -0.45];
const wing = s => [[[s * 0.2, 0, 0.45], [s * 1.1, -0.06, -0.8], [s * 1.1, -0.06, -0.15]], [[s * 1.1, -0.06, -0.8], [s * 0.3, 0, -0.62]], [[s * 0.55, -0.02, -0.25], [s * 0.3, 0, -0.62]]];
export const SHIP_HULL = [[N, [-0.2, 0, 0.45], [-0.3, 0, -0.62], [-0.3, 0, -0.9]], [N, [0.2, 0, 0.45], [0.3, 0, -0.62], [0.3, 0, -0.9]], [N, Ct, Sr], [N, Bk, Sr], [[-0.3, 0, -0.9], Sr, [0.3, 0, -0.9]], [[-0.2, 0, 0.45], Ct, [0.2, 0, 0.45]]];
export const SHIP_WING = [...wing(-1), ...wing(1)];
export const SHIP_FIN = [[[-0.3, 0, -0.62], [-0.5, 0.55, -1.05], Sr], [[0.3, 0, -0.62], [0.5, 0.55, -1.05], Sr], [[-0.2, 0, 0.9], [-0.42, 0, 0.62], [-0.2, 0, 0.6]], [[0.2, 0, 0.9], [0.42, 0, 0.62], [0.2, 0, 0.6]]];
const OCT = [[[0, 1, 0], [1, 0, 0], [0, -1, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, -1, 0], [0, 0, -1], [0, 1, 0]], [[1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1], [1, 0, 0]]];
const DART = [[[0, 0, -1.2], [0.8, 0, 0.6], [0, 0.3, 0.2], [-0.8, 0, 0.6], [0, 0, -1.2], [0, 0.3, 0.2]], [[0.8, 0, 0.6], [0, -0.2, 0.9], [-0.8, 0, 0.6]]];
const hex = (r, y) => { const a = []; for (let i = 0; i <= 6; i++) a.push([Math.cos(i / 6 * TAU) * r, y, Math.sin(i / 6 * TAU) * r]); return a; };
const SAUCER = [hex(1, 0), hex(0.5, 0.4), hex(0.5, -0.3), [[1, 0, 0], [0.5, 0.4, 0]], [[-1, 0, 0], [-0.5, 0.4, 0]], [[0, 0, 1], [0, 0.4, 0.5]], [[0, 0, -1], [0, 0.4, -0.5]]];
const KAMI = [[[0, 0, -1.3], [0.5, 0.5, 0.6], [-0.5, 0.5, 0.6], [0, 0, -1.3], [0.5, -0.5, 0.6], [-0.5, -0.5, 0.6], [0, 0, -1.3]], [[0.5, 0.5, 0.6], [0.5, -0.5, 0.6]], [[-0.5, 0.5, 0.6], [-0.5, -0.5, 0.6]]];
const TURRET = [[[-1, -0.7, -1], [1, -0.7, -1], [1, -0.7, 1], [-1, -0.7, 1], [-1, -0.7, -1], [0, 0.6, 0], [1, -0.7, 1]], [[1, -0.7, -1], [0, 0.6, 0], [-1, -0.7, 1]], [[0, 0.6, 0], [0, 1.2, -1.2]]];
const CUBE = [[[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1], [-1, -1, 1]], [[1, -1, -1], [1, -1, 1]], [[1, 1, -1], [1, 1, 1]], [[-1, 1, -1], [-1, 1, 1]]];
const DRONE = [[[0, 0, 0.7], [0.45, 0, -0.4], [0, 0.3, -0.3], [-0.45, 0, -0.4], [0, 0, 0.7], [0, 0.3, -0.3]], [[0.45, 0, -0.4], [-0.45, 0, -0.4]]];
const RAINBOW = ['#ff4d6d', '#ff8a2b', '#ffe14a', '#3dffb0', '#2ee6ff', '#b06bff', '#ff3df0'];

function drawShip(g, p, t) {
  const blink = p.inv > 0 && p.god <= 0 && (t >> 2) % 2; if (blink) return;
  const god = p.god > 0, c1 = god ? RAINBOW[(t >> 2) % 7] : '#ffffff', c2 = god ? RAINBOW[((t >> 2) + 2) % 7] : '#2ee6ff', c3 = god ? RAINBOW[((t >> 2) + 4) % 7] : '#ff3df0';
  const roll = -p.mvx * 0.55 + (g.shiftT > 0 ? g.shiftDir * ease(1 - g.shiftT) * TAU : 0), pitch = -p.mvy * 0.3;
  mesh(SHIP_HULL, p.x, p.y, p.z, 1, 0, pitch, roll, c1); mesh(SHIP_WING, p.x, p.y, p.z, 1, 0, pitch, roll, c2); mesh(SHIP_FIN, p.x, p.y, p.z, 1, 0, pitch, roll, c3);
  const fl = 0.5 + (g.speedMul - 1) * 1.3 + Math.random() * 0.35; for (const s of [-0.25, 0.25]) { seg(p.x + s, p.y, p.z - 0.75, p.x + s, p.y, p.z - 0.75 - fl, '#ff8a2b'); seg(p.x + s, p.y, p.z - 0.75, p.x + s * 0.4, p.y, p.z - 0.75 - fl * 0.6, '#ffe14a', 0.7); }
  if (p.shield > 0) for (let i = 0; i < p.shield; i++) circle(p.x, p.y, p.z, 1.15 + i * 0.22, '#5ee7ff', 0.55, 12, vB === 3 ? 1 : vB === 0 ? 2 : 0, t * 0.05 + i);
  if (vB === 1 || vB === 2 || mix < 1) { seg(p.x - 0.5, 0, p.z, p.x + 0.5, 0, p.z, '#2ee6ff', 0.35); seg(p.x, 0, p.z - 0.6, p.x, 0, p.z + 0.6, '#2ee6ff', 0.35); if (vB === 1) seg(p.x, 0, p.z, p.x, p.y, p.z, '#2ee6ff', 0.14); }
}

// ---------- world ----------
const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
export function drawWorld(ctx, g, o = {}) {
  const t = g.tick, p0 = g.players[0];
  vA = g.viewFrom; vB = g.view; mix = g.shiftT > 0 ? ease(1 - g.shiftT) : 1; rollA = g.shiftT > 0 ? g.shiftDir * mix * TAU : 0;
  cam.x = p0.x * 0.55; cam.y = p0.y * 0.55 + 1.9; cam.z = p0.z - 7.5;
  ctx.save();
  if (g.shake > 0.5 && o.shake !== false) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  ctx.globalCompositeOperation = 'lighter';
  // stars
  ctx.fillStyle = '#8fa8ff'; for (let i = 0; i < 70; i++) { const sp = 0.3 + hash(i) * 1.5, x = (hash(i + 50) * W - g.camZ * sp * (vB === 0 ? 6 : 2)) % W, y = (hash(i + 99) * H + (vB === 3 ? g.camZ * sp * 6 : 0)) % H; ctx.globalAlpha = 0.25 + hash(i + 7) * 0.5; ctx.fillRect((x + W) % W, (y + H) % H, sp > 1.2 ? 2 : 1, sp > 1.2 ? 2 : 1); } ctx.globalAlpha = 1;
  // floor grid + city skyline along both edges
  const off = g.camZ % 3, gc = '#2443c8';
  for (let k = 0; k < 12; k++) { const z = -3 - off + k * 3; seg(-9, 0, z, 9, 0, z, gc, 0.5); }
  for (let x = -9; x <= 9; x += 3) seg(x, 0, -3, x, 0, 30, gc, 0.5);
  const base = Math.floor(g.camZ / 4);
  for (let k = -1; k < 9; k++) { const id = base + k, z = id * 4 - g.camZ + 2; for (const s of [-1, 1]) { const h = 2 + hash(id * 2 + s) * 7, w = 1 + hash(id + s * 9) * 0.8; box({ x: s * (11 + hash(id * 3 + s) * 2), y: h / 2, z, hx: w, hy: h / 2, hz: 1.5 }, s > 0 ? '#7a2bd6' : '#2b56d6', vB === 0 ? 0.16 : 0.45, vB === 0 ? 0 : 2); } }
  // obstacles
  for (const b of g.obs) {
    const ghost = b.phase != null && b.phase !== g.view; let a = ghost ? 0.18 : 1, col = b.hit > 0 ? '#ffffff' : b.col;
    if (b.kind === 'sheet') { if (b.warm > 0) { a = 0.12 + 0.25 * ((t >> 2) % 2); } else col = (t >> 1) % 2 ? '#ffffff' : b.col; box(b, col, a); if (b.warm <= 0) { const n = 5; for (let i = 1; i < n; i++) { const z = b.z - b.hz + b.hz * 2 * i / n; seg(b.x - b.hx, b.y - b.hy, z, b.x + b.hx, b.y + b.hy, z, col, 0.8); seg(b.x - b.hx, b.y + b.hy, z, b.x + b.hx, b.y - b.hy, z, col, 0.8); } } continue; }
    if (b.z > 31) a *= 0.4;
    box(b, col, a, b.kind === 'tower' ? Math.min(5, b.hy | 0) : 0);
    if (b.kind === 'gate' || b.kind === 'slab') { seg(b.x - b.hx, b.y - b.hy, b.z - b.hz, b.x + b.hx, b.y + b.hy, b.z - b.hz, col, a * 0.35); seg(b.x - b.hx, b.y + b.hy, b.z - b.hz, b.x + b.hx, b.y - b.hy, b.z - b.hz, col, a * 0.35); }
    if (b.kind === 'car') { seg(b.x - b.hx, b.y, b.z, b.x - b.hx - Math.sign(b.vx) * 1.4, b.y, b.z, '#ffe14a', 0.6); }
  }
  // rings
  for (const r of g.rings) { if (r.got) continue;
    if (r.kind === 'warp') { if (g.view === r.phase) { for (let i = 0; i < 4; i++) circle(r.x, r.y, r.z, r.r * (1 - i * 0.2), i % 2 ? '#ffffff' : '#b06bff', 1, 20, 0, t * 0.05 * (i % 2 ? 1 : -1)); for (let i = 0; i < 6; i++) { const a = t * 0.04 + i / 6 * TAU; seg(r.x, r.y, r.z, r.x + Math.cos(a) * r.r, r.y + Math.sin(a) * r.r, r.z, '#b06bff', 0.6); } }
      else if ((t + (r.z | 0) * 7) % 23 < 3) { const a = hash(t) * TAU; seg(r.x, r.y, r.z, r.x + Math.cos(a) * 0.5, r.y + Math.sin(a) * 0.5, r.z, '#b06bff', 0.5); } }
    else { circle(r.x, r.y, r.z, r.r, '#3dffb0', 0.8, 14, 0, t * 0.03); circle(r.x, r.y, r.z, r.r * 0.7, '#3dffb0', 0.35, 14, 0, -t * 0.03); } }
  // enemies
  for (const e of g.enemies) {
    const ghost = e.phase != null && e.phase !== g.view, a = ghost ? 0.2 : 1, col = e.hit > 0 ? '#ffffff' : e.col;
    if (e.type === 'boss') { drawBoss(g, e, t); continue; }
    if (e.shape === 'saucer') mesh(SAUCER, e.x, e.y, e.z, e.r * 1.1, t * 0.05, 0, 0, col, a);
    else if (e.shape === 'kami') mesh(KAMI, e.x, e.y, e.z, e.r * 1.1, 0, 0, t * 0.2, col, a);
    else if (e.shape === 'turret') mesh(TURRET, e.x, e.y, e.z, e.r, 0, 0, 0, col, a);
    else if (e.shape === 'carrier') { mesh(CUBE, e.x, e.y, e.z, e.r * 0.8, t * 0.03, t * 0.02, 0, col, a); mesh(OCT, e.x, e.y, e.z, e.r * 0.45, -t * 0.06, 0, 0, '#ffe14a', a); }
    else mesh(DART, e.x, e.y, e.z, e.r * 1.05, 0, 0, Math.sin(e.t * 0.05) * 0.6, col, a);
  }
  // pods
  for (const q of g.pods) { const col = q.kind === 'god' ? RAINBOW[(t >> 2) % 7] : q.kind === 'bomb' ? '#ff8a2b' : '#ffe14a'; mesh(OCT, q.x, q.y, q.z, 0.5 + Math.sin(q.t * 0.15) * 0.08, q.t * 0.08, q.t * 0.05, 0, col); if (q.kind !== 'pod') circle(q.x, q.y, q.z, 0.8, col, 0.6, 10, 0, -q.t * 0.1); }
  // bullets + shots + beams
  for (const b of g.ebul) { const r = 0.3; seg(b.x - r, b.y, b.z, b.x + r, b.y, b.z, b.col); seg(b.x, b.y - r, b.z, b.x, b.y + r, b.z, b.col); seg(b.x, b.y, b.z - r, b.x, b.y, b.z + r, '#ffffff'); }
  for (const s of g.shots) { const k = s.kind === 2 ? 0.03 : 0.022; seg(s.x, s.y, s.z, s.x - s.vx * k, s.y - s.vy * k, s.z - s.vz * k, s.kind === 2 ? '#ff8a2b' : s.kind === 1 ? '#b06bff' : '#7df9ff'); }
  for (const b of g.beams) { seg(b.x, b.y, b.z0, b.x, b.y, b.z1, b.col, b.life / 5); seg(b.x, b.y, b.z0, b.x, b.y, b.z1, '#ffffff', b.life / 9); }
  // players + drones
  for (const p of g.players) { if (p.dead > 0) continue; drawShip(g, p, t); for (let k = 0; k < p.drones.length; k++) { const d = p.drones[k]; mesh(DRONE, d.x, d.y, d.z, 0.7, 0, 0, t * 0.1 + k, p.god > 0 ? RAINBOW[(k + (t >> 2)) % 7] : '#b06bff'); } }
  // particles + shock rings
  for (const q of g.parts) seg(q.x, q.y, q.z, q.x - q.vx * 0.035, q.y - q.vy * 0.035, q.z - q.vz * 0.035, q.col, Math.min(1, q.life / q.max * 1.6));
  for (const s of g.shocks) { const a = s.life / s.max; circle(s.x, s.y, s.z, s.r, s.col, a, 16, vB === 3 ? 1 : vB === 0 ? 2 : 0); }
  flush(ctx, o.glow !== false);
  // floating text
  for (const q of g.pops) { P(q.x, q.y, q.z); if (!OK) continue; text(ctx, q.txt, X, Y, q.big ? 15 : 9, q.col, { align: 'center', alpha: Math.min(1, q.life / 20), glow: q.big }); }
  ctx.restore();
  if (g.flash > 0) { ctx.fillStyle = '#fff'; ctx.globalAlpha = Math.min(0.6, g.flash / 20); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (g.shiftT > 0) { ctx.fillStyle = '#5ee7ff'; ctx.globalAlpha = 0.1 * g.shiftT; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}
function drawBoss(g, b, t) {
  const open = (b.vuln || []).includes(g.view), col = b.hit > 0 ? '#ffffff' : b.col, s = b.dying ? 1 + Math.sin(t) * 0.1 : 1;
  mesh(OCT, b.x, b.y, b.z, 1.3 * s, t * 0.04, t * 0.03, 0, open ? '#ffffff' : '#ff4d6d');
  mesh(CUBE, b.x, b.y, b.z, 1.9 * s, t * 0.012, t * 0.008, 0, col); mesh(CUBE, b.x, b.y, b.z, 2.5 * s, -t * 0.009, 0, t * 0.011, col, 0.6);
  for (let i = 0; i < 4; i++) { const a = t * 0.02 + i / 4 * TAU, r = 3.6; const px = b.x + Math.cos(a) * r, py = b.y + Math.sin(a) * r; mesh(OCT, px, py, b.z, 0.5, a, 0, 0, STAGE_COLS[i % 3]); seg(b.x, b.y, b.z, px, py, b.z, col, 0.3); }
  seg(b.x - 1.2, 0, b.z, b.x - 0.6, b.y - 2.6, b.z, col, 0.5); seg(b.x + 1.2, 0, b.z, b.x + 0.6, b.y - 2.6, b.z, col, 0.5);
  if (!open || b.deflect > 0) { const n = 6; for (let i = 0; i < n; i++) { const a0 = i / n * TAU + t * 0.01, a1 = (i + 1) / n * TAU + t * 0.01, r = 3.2; seg(b.x + Math.cos(a0) * r, b.y + Math.sin(a0) * r, b.z - 2, b.x + Math.cos(a1) * r, b.y + Math.sin(a1) * r, b.z - 2, '#5ee7ff', b.deflect > 0 ? 1 : 0.4); } }
}
const STAGE_COLS = ['#ff3df0', '#2ee6ff', '#ffe14a'];

// ---------- HUD ----------
const VCOL = ['#2ee6ff', '#3dffb0', '#ffe14a', '#ff3df0'];
export function drawHUD(ctx, g, o = {}) {
  const p = g.players[0], t = g.tick; ctx.globalCompositeOperation = 'source-over';
  text(ctx, 'SCORE', 18, 12, 8, '#7d8bd6', { glow: false }); text(ctx, String(g.score).padStart(8, '0'), 18, 25, 16, '#ffffff'); if (o.hi) text(ctx, 'HI ' + String(o.hi).padStart(8, '0'), 150, 12, 8, '#7d8bd6', { glow: false });
  const mult = 1 + Math.min(9, g.chain / 5 | 0); if (g.chain > 1) { text(ctx, 'CHAIN ' + g.chain + '  X' + mult, 18, 48, 9, '#ffe14a'); ctx.fillStyle = '#ffe14a'; ctx.globalAlpha = 0.8; ctx.fillRect(18, 62, 110 * g.chainT / 170, 2); ctx.globalAlpha = 1; }
  // view pips
  const pw = 78, px0 = W / 2 - pw * 2;
  for (let i = 0; i < 4; i++) { const on = g.view === i, rec = g.recView === i && !on && (t >> 3) % 2; ctx.strokeStyle = on ? VCOL[i] : rec ? '#ffe14a' : '#3a4380'; ctx.lineWidth = on ? 2 : 1; ctx.globalAlpha = on || rec ? 1 : 0.7; ctx.strokeRect(px0 + i * pw + 3, 10, pw - 6, 20); if (on) { ctx.fillStyle = VCOL[i]; ctx.globalAlpha = 0.18; ctx.fillRect(px0 + i * pw + 3, 10, pw - 6, 20); } ctx.globalAlpha = 1;
    text(ctx, VIEWS[i], px0 + i * pw + pw / 2, 15, 10, on ? '#ffffff' : rec ? '#ffe14a' : '#5a66b0', { align: 'center', glow: on }); }
  text(ctx, '< L', px0 - 8, 15, 9, '#5a66b0', { align: 'right', glow: false }); text(ctx, 'R >', px0 + pw * 4 + 8, 15, 9, '#5a66b0', { glow: false });
  // lives + bombs
  for (let i = 0; i < Math.min(p.lives, 6); i++) { const x = W - 26 - i * 24, y = 22; ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 8, y + 7); ctx.lineTo(x, y + 3); ctx.lineTo(x - 8, y + 7); ctx.closePath(); ctx.strokeStyle = '#2ee6ff'; ctx.lineWidth = 1.5; ctx.stroke(); }
  text(ctx, 'BOMB ' + p.bombs, W - 18, 40, 9, '#ff8a2b', { align: 'right' }); text(ctx, 'DRONES ' + DRONE_MODES[p.dmode], W - 18, 56, 7, '#b06bff', { align: 'right', glow: false });
  if (p.god > 0) text(ctx, 'GOD MODE ' + Math.ceil(p.god / 60), W / 2, 70, 12, RAINBOW[(t >> 2) % 7], { align: 'center' });
  else if (p.over > 0) text(ctx, 'OVERDRIVE ' + Math.ceil(p.over / 60), W / 2, 70, 10, '#ffe14a', { align: 'center' });
  // boss bar
  const b = g.boss; if (b && b.z <= 19.5 && !b.dying) { const st = g.level.boss.stages[b.stage], w = 360, x = W / 2 - w / 2; text(ctx, b.name + ' // ' + st.name, W / 2, 40, 9, st.col, { align: 'center' }); ctx.strokeStyle = st.col; ctx.lineWidth = 1; ctx.strokeRect(x, 54, w, 7); ctx.fillStyle = st.col; ctx.fillRect(x, 54, w * Math.max(0, b.hp) / b.max, 7);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i >= b.stage ? '#ffffff' : '#30345a'; ctx.fillRect(x + w + 8 + i * 9, 54, 6, 7); }
    const open = b.vuln.includes(g.view); text(ctx, open ? 'CORE EXPOSED' : 'CORE SHIELDED - SHIFT TO ' + VIEWS[st.rec], W / 2, 68, 8, open ? '#3dffb0' : (t >> 3) % 2 ? '#ff4d6d' : '#ffe14a', { align: 'center', glow: false }); }
  // hint banner
  if (g.hintT > 0 && g.hint) { const a = Math.min(1, g.hintT / 25, (230 - g.hintT) / 8 + 0.3); const sz = Math.min(20, 760 / (g.hint.length * 0.94)); text(ctx, g.hint, W / 2, 118, sz, '#ffffff', { align: 'center', alpha: a, core: '#ffffff' }); text(ctx, g.hint, W / 2 + 2, 120, sz, '#ff3df0', { align: 'center', alpha: a * 0.5, glow: false }); }
  // upgrade bar
  const n = BAR.length, cw = 112, x0 = W / 2 - cw * n / 2, y0 = H - 34;
  for (let i = 0; i < n; i++) { const on = p.cursor === i, lvl = i === 5 ? p.shield : p.up[i], full = lvl >= BARMAX[i], x = x0 + i * cw;
    ctx.fillStyle = on ? '#ffe14a' : '#0a0f2c'; ctx.globalAlpha = on ? 0.9 : 0.75; ctx.fillRect(x + 2, y0, cw - 4, 22); ctx.globalAlpha = 1; ctx.strokeStyle = on ? '#ffffff' : full ? '#3dffb0' : '#3a4cb8'; ctx.lineWidth = on ? 2 : 1; ctx.strokeRect(x + 2, y0, cw - 4, 22);
    text(ctx, BAR[i], x + cw / 2, y0 + 5, 9, on ? '#140a2a' : full ? '#3dffb0' : '#9fb0ff', { align: 'center', glow: false, weight: on ? 2 : 1.3 });
    if (i < 6) for (let k = 0; k < BARMAX[i]; k++) { ctx.fillStyle = k < lvl ? (on ? '#140a2a' : '#3dffb0') : (on ? '#b89a20' : '#26306e'); ctx.fillRect(x + 8 + k * ((cw - 16) / BARMAX[i]), y0 + 17, (cw - 16) / BARMAX[i] - 2, 2); } }
  if (p.cursor >= 0 && (t >> 4) % 2) text(ctx, (o.upgLabel || 'SELECT') + ' = ' + BAR[p.cursor], W / 2, y0 - 14, 9, '#ffe14a', { align: 'center' });
}

// ---------- screen-space helpers for the intro / menus ----------
export function meshScreen(ctx, M, cx, cy, s, yaw, pitch, roll, col, glow = true) {
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  ctx.beginPath();
  for (const pl of M) for (let i = 0; i < pl.length; i++) { let [x, y, z] = pl[i]; let t = x * cr - y * sr; y = x * sr + y * cr; x = t; t = y * cp - z * sp; z = y * sp + z * cp; y = t; t = x * cyw + z * syw; z = -x * syw + z * cyw; x = t;
    const d = 5 / (5 + z * 0.6); const X2 = cx + x * s * d, Y2 = cy - y * s * d; if (i) ctx.lineTo(X2, Y2); else ctx.moveTo(X2, Y2); }
  ctx.strokeStyle = col; ctx.lineJoin = 'round'; if (glow) { ctx.globalAlpha = 0.25; ctx.lineWidth = Math.min(12, Math.max(4, s * 0.06)); ctx.stroke(); } ctx.globalAlpha = 1; ctx.lineWidth = Math.min(3, Math.max(1.4, s * 0.02)); ctx.stroke();
}
export function drawLogo(ctx, cx, y, sc = 1, t = 0) {
  const s1 = 62 * sc, w1 = textWidth('2DISO', s1), s2 = 62 * sc, w2 = textWidth('SHIFT', s2) + s2 * 0.3, gap = 26 * sc, x = cx - (w1 + gap + w2) / 2;
  ctx.globalCompositeOperation = 'lighter';
  text(ctx, '2DISO', x, y, s1, '#2ee6ff', { weight: 5 * sc, core: '#eaffff' });
  text(ctx, 'SHIFT', x + w1 + gap + 4 * sc, y + 3 * sc, s2, '#2ee6ff', { italic: true, weight: 5 * sc, alpha: 0.5, glow: false });
  text(ctx, 'SHIFT', x + w1 + gap, y, s2, '#ff3df0', { italic: true, weight: 5 * sc, core: '#fff0ff' });
  ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 2 * sc; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.moveTo(x, y + s1 + 14 * sc); ctx.lineTo(x + w1 + gap + w2, y + s1 + 14 * sc); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
export { text, textWidth, RAINBOW, VCOL };
