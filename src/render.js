// 2DISO SHIFT — neon vector renderer. Everything is glowing lines; four projections of the same 3D world.
import { VIEWS, BAR, BARMAX, DRONE_MODES, GEARS, MASK, U, solid } from './game.js';
import { text, textWidth } from './font.js';
export const W = 960, H = 540;
const TAU = Math.PI * 2;
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
const RAINBOW = ['#ff4d6d', '#ff8a2b', '#ffe14a', '#3dffb0', '#2ee6ff', '#b06bff', '#ff3df0'];
const VCOL = ['#2ee6ff', '#3dffb0', '#ffe14a', '#ff3df0'];

// ---------- projection ----------
let cam = { x: 0, y: 2, z: -7 }, vA = 0, vB = 0, mix = 1, rollA = 0, wob = 0;
let X = 0, Y = 0, S = 1, OK = true;
function p1(v, x, y, z) {
  if (v === 0) { X = 60 + z * 34; Y = 470 - y * 42; S = 1; return true; }
  if (v === 1) { X = 150 + z * 26 + x * 14; Y = 400 - z * 11 + x * 10 - y * 18; S = 0.72; return true; }
  if (v === 3) { X = 480 + x * 40; Y = 480 - z * 19; S = 0.95; return true; }
  let d = z - cam.z, ok = true; if (d < 0.5) { d = 0.5; ok = false; }
  X = 480 + (x - cam.x) / d * 440; Y = 300 - (y - cam.y) / d * 440; S = 440 / d / 34; return ok;
}
function P(x, y, z) {
  if (mix >= 1) { OK = p1(vB, x, y, z); if (wob) { const c = Math.cos(wob), s = Math.sin(wob), dx = X - 480, dy = Y - 270; X = 480 + dx * c - dy * s; Y = 270 + dx * s + dy * c; } return; }
  const okA = p1(vA, x, y, z), ax = X, ay = Y, as = S, okB = p1(vB, x, y, z);
  let px = ax + (X - ax) * mix, py = ay + (Y - ay) * mix; S = as + (S - as) * mix; OK = mix < 0.5 ? okA : okB;
  const c = Math.cos(rollA), s = Math.sin(rollA), dx = px - 480, dy = py - 270; X = 480 + dx * c - dy * s; Y = 270 + dx * s + dy * c;
}

// ---------- line batching: one path per colour, stroked as a neon tube (wide halo, glow, core) ----------
// lines and filled faces are sorted into depth layers (far to near) so a solid obstacle hides what is behind it
const NL = 26, layers = Array.from({ length: NL }, () => new Map()), qlay = Array.from({ length: NL }, () => []); let LAY = 0, OCC = false, buckets = layers[0];
function depth(x, z) { if (!OCC) return; const d = vOcc === 1 ? z - 0.5 * x : z; LAY = Math.max(2, Math.min(NL - 1, ((40 - d) / 1.8) | 0)); buckets = layers[LAY]; }
function depth0() { LAY = 0; buckets = layers[0]; }
let vOcc = 0;
let LW = 1; // tube thickness for what is drawn next (1 = normal)
function seg(x1, y1, z1, x2, y2, z2, col, a = 1) {
  P(x1, y1, z1); if (!OK) return; const ax = X, ay = Y; P(x2, y2, z2); if (!OK) return;
  if ((ax < -200 && X < -200) || (ax > W + 200 && X > W + 200) || (ay < -200 && Y < -200) || (ay > H + 200 && Y > H + 200)) return;
  const k = (a >= 1 ? col : col + '|' + (a * 10 | 0)) + (LW !== 1 ? '~' + LW : ''); let b = buckets.get(k); if (!b) { b = { col, a: a >= 1 ? 1 : Math.max(0.05, (a * 10 | 0) / 10), w: LW, d: [] }; buckets.set(k, b); } b.d.push(ax, ay, X, Y);
}
const rotCache = new Map();
function hueRot(hex, deg) { const k = hex + deg; let r = rotCache.get(k); if (r) return r;
  let c = hex.slice(1); if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]; const R = parseInt(c.slice(0, 2), 16) / 255, G = parseInt(c.slice(2, 4), 16) / 255, Bl = parseInt(c.slice(4, 6), 16) / 255, mx = Math.max(R, G, Bl), mn = Math.min(R, G, Bl), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0; if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === R ? ((G - Bl) / d) % 6 : mx === G ? (Bl - R) / d + 2 : (R - G) / d + 4; h *= 60; } r = `hsl(${(h + deg + 360) % 360 | 0},${s * 100 | 0}%,${l * 100 | 0}%)`; rotCache.set(k, r); return r; }
function flush(ctx, glow, trip, L = 0) {
  ctx.lineCap = 'round';
  for (const b of layers[L].values()) {
    const d = b.d; if (!d.length) continue; ctx.beginPath(); for (let i = 0; i < d.length; i += 4) { ctx.moveTo(d[i], d[i + 1]); ctx.lineTo(d[i + 2], d[i + 3]); }
    ctx.strokeStyle = trip ? hueRot(b.col, trip) : b.col; const w = b.w || 1; if (glow) { ctx.globalAlpha = 0.07 * b.a; ctx.lineWidth = 13 * Math.min(w, 2.2); ctx.stroke(); ctx.globalAlpha = 0.2 * b.a; ctx.lineWidth = 6 * w; ctx.stroke(); }
    ctx.globalAlpha = b.a; ctx.lineWidth = 1.6 * w; ctx.stroke(); d.length = 0;
  }
  ctx.globalAlpha = 1;
}
// ---------- optional solid look: shaded faces and ground shadows under the wireframe (painter-sorted, drawn before the lines) ----------
let FILL = false, lastFilled = null; const rgbaCache = new Map();
function rgba(hex, a) { const k = hex + (a * 50 | 0); let r = rgbaCache.get(k); if (r) return r; let c = hex.slice(1); if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]; r = `rgba(${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)},${(a * 50 | 0) / 50})`; rgbaCache.set(k, r); return r; }
function quad(p, col, a0, a1, key, dark = 0.93) { const q = []; for (let i = 0; i < 12; i += 3) { P(p[i], p[i + 1], p[i + 2]); if (!OK) return; q.push(X, Y); } if (Math.min(q[0], q[2], q[4], q[6]) > W + 100 || Math.max(q[0], q[2], q[4], q[6]) < -100) return; qlay[key === 1e6 ? 1 : LAY].push({ q, col, a0, a1, key, dark }); if (col && OCC) for (let i = 0; i < 12; i += 3) { const j = (i + 3) % 12; seg(p[i], p[i + 1], p[i + 2], p[j], p[j + 1], p[j + 2], col); } }
function drawQuads(ctx, L) { const quads = qlay[L]; if (!quads.length) return; quads.sort((a, b) => b.key - a.key); ctx.globalCompositeOperation = 'source-over';
  for (const f of quads) { const q = f.q; ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[2], q[3]); ctx.lineTo(q[4], q[5]); ctx.lineTo(q[6], q[7]); ctx.closePath(); if (f.dark) { ctx.fillStyle = '#02010a'; ctx.globalAlpha = f.dark; ctx.fill(); ctx.globalAlpha = 1; }
    if (f.col) { const gr = ctx.createLinearGradient((q[0] + q[2]) / 2, (q[1] + q[3]) / 2, (q[4] + q[6]) / 2, (q[5] + q[7]) / 2); gr.addColorStop(0, rgba(f.col, f.a0)); gr.addColorStop(1, rgba(f.col, f.a1)); ctx.fillStyle = gr; ctx.fill(); } }
  quads.length = 0; ctx.globalCompositeOperation = 'lighter'; }
// shaded faces for a box: the faces the current view can see, lit from above, plus a shadow on the ground
function fillBox(o, col, k = 1, shadow = true) {
  if (!FILL) return; const v = mix < 0.5 ? vA : vB; depth(o.x + o.hx, o.z - o.hz); const x0 = Math.max(-10.5, o.x - o.hx), x1 = Math.min(10.5, o.x + o.hx), y0 = Math.max(0, o.y - o.hy), y1 = Math.min(9.6, o.y + o.hy), z0 = o.z - o.hz, z1 = o.z + o.hz; if (x1 <= x0 || y1 <= y0 || z1 < -4 || z0 > 32) return;
  lastFilled = o; const far = z0 > 27 ? 0.55 : 1, key = v === 3 ? -y1 * 100 + z0 : z0; k *= far;
  if (shadow && v !== 0 && y1 < 9.5) { const sx = y0 > 0.3 ? 0.5 : 0, len = y0 > 0.3 ? 0 : Math.min(2.2, (y1 - y0) * 0.3); if (y0 > 0.3 || len > 0.2) quad([x0 + sx, 0.02, z0, x1 + sx + len, 0.02, z0, x1 + sx + len, 0.02, z1, x0 + sx, 0.02, z1], null, 0, 0, 1e6, 0.5 * far); }
  if (v === 0) { quad([o.x, y1, z0, o.x, y1, z1, o.x, y0, z1, o.x, y0, z0], col, 0.46 * k, 0.16 * k, key); return; }
  if (v === 3) { quad([x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0], col, 0.42 * k, 0.2 * k, key); return; }
  if (v === 1) { quad([x1, y1, z0, x1, y1, z1, x1, y0, z1, x1, y0, z0], col, 0.24 * k, 0.07 * k, key + 0.2); quad([x0, y1, z0, x1, y1, z0, x1, y0, z0, x0, y0, z0], col, 0.42 * k, 0.12 * k, key + 0.1); quad([x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0], col, 0.6 * k, 0.42 * k, key); return; }
  if (z0 < cam.z + 0.6) return;
  if (cam.x < x0) quad([x0, y1, z0, x0, y1, z1, x0, y0, z1, x0, y0, z0], col, 0.24 * k, 0.07 * k, key + 0.2); else if (cam.x > x1) quad([x1, y1, z0, x1, y1, z1, x1, y0, z1, x1, y0, z0], col, 0.24 * k, 0.07 * k, key + 0.2);
  if (cam.y > y1) quad([x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0], col, 0.6 * k, 0.42 * k, key + 0.15); else if (cam.y < y0) quad([x0, y0, z1, x1, y0, z1, x1, y0, z0, x0, y0, z0], col, 0.12 * k, 0.06 * k, key + 0.15);
  quad([x0, y1, z0, x1, y1, z0, x1, y0, z0, x0, y0, z0], col, 0.44 * k, 0.12 * k, key);
}
function box(o, col, a = 1, bands = 0) {
  const hid = OCC && lastFilled === o, L0 = LAY; if (hid) { LAY = Math.max(2, L0 - 1); buckets = layers[LAY]; } // a filled box hides its own far edges: they go one layer back, under the fill
  const x0 = o.x - o.hx, x1 = o.x + o.hx, y0 = Math.max(0, o.y - o.hy), y1 = Math.min(9.6, o.y + o.hy), z0 = o.z - o.hz, z1 = o.z + o.hz;
  seg(x0, y0, z0, x1, y0, z0, col, a); seg(x1, y0, z0, x1, y0, z1, col, a); seg(x1, y0, z1, x0, y0, z1, col, a); seg(x0, y0, z1, x0, y0, z0, col, a);
  seg(x0, y1, z0, x1, y1, z0, col, a); seg(x1, y1, z0, x1, y1, z1, col, a); seg(x1, y1, z1, x0, y1, z1, col, a); seg(x0, y1, z1, x0, y1, z0, col, a);
  seg(x0, y0, z0, x0, y1, z0, col, a); seg(x1, y0, z0, x1, y1, z0, col, a); seg(x1, y0, z1, x1, y1, z1, col, a); seg(x0, y0, z1, x0, y1, z1, col, a);
  if (hid) { LAY = L0; buckets = layers[L0]; }
  for (let i = 1; i <= bands; i++) { const y = y0 + (y1 - y0) * i / (bands + 1); seg(x0, y, z0, x1, y, z0, col, a * 0.45); if (!hid || cam.x < x0 && vOcc === 2) seg(x0, y, z0, x0, y, z1, col, a * 0.45); if (!hid || vOcc === 1 || cam.x > x1) seg(x1, y, z0, x1, y, z1, col, a * 0.45); }
}
// hatch the face that comes at you, so a wall reads as a wall
function hatch(o, col, a, n) { const x0 = Math.max(-9, o.x - o.hx), x1 = Math.min(9, o.x + o.hx), y0 = Math.max(0, o.y - o.hy), y1 = Math.min(9.6, o.y + o.hy), z = o.z - o.hz; if (x1 <= x0 || y1 <= y0) return;
  const st = Math.max(0.9, (x1 - x0) / n); for (let x = x0 + st; x < x1 - 0.1; x += st) seg(x, y0, z, x, y1, z, col, a); const sy = Math.max(0.9, (y1 - y0) / Math.max(2, n / 3)); for (let y = y0 + sy; y < y1 - 0.1; y += sy) seg(x0, y, z, x1, y, z, col, a); }
function mesh(M, x, y, z, s, yaw, pitch, roll, col, a = 1) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  for (const pl of M) { let lx = 0, ly = 0, lz = 0; for (let i = 0; i < pl.length; i++) { let [px, py, pz] = pl[i];
    let t = px * cr - py * sr; py = px * sr + py * cr; px = t; t = py * cp - pz * sp; pz = py * sp + pz * cp; py = t; t = px * cy + pz * sy; pz = -px * sy + pz * cy; px = t;
    px = x + px * s; py = y + py * s; pz = z + pz * s; if (i) seg(lx, ly, lz, px, py, pz, col, a); lx = px; ly = py; lz = pz; } }
}
function circle(x, y, z, r, col, a = 1, n = 18, plane = 0, rot = 0) {
  let lx, ly, lz; for (let i = 0; i <= n; i++) { const t = rot + i / n * TAU, c = Math.cos(t) * r, s = Math.sin(t) * r; const px = plane === 2 ? x : x + c, py = plane === 1 ? y : y + (plane === 2 ? c : s), pz = plane === 0 ? z : z + s; if (i) seg(lx, ly, lz, px, py, pz, col, a); lx = px; ly = py; lz = pz; }
}
function zig(x1, y1, z1, x2, y2, z2, col, a, n, amp, t) { let lx = x1, ly = y1, lz = z1; for (let i = 1; i <= n; i++) { const f = i / n, j = i < n ? amp : 0, px = x1 + (x2 - x1) * f + (hash(i * 7 + t) - 0.5) * j, py = y1 + (y2 - y1) * f + (hash(i * 13 + t) - 0.5) * j, pz = z1 + (z2 - z1) * f; seg(lx, ly, lz, px, py, pz, col, a); lx = px; ly = py; lz = pz; } }

// ---------- models ----------
const N = [0, 0, 1.5], Ct = [0, 0.24, 0.35], Sr = [0, 0.13, -0.75], Bk = [0, -0.14, -0.45];
const wing = s => [[[s * 0.18, 0, 0.5], [s * 0.78, -0.06, -0.85], [s * 0.78, -0.06, -0.2]], [[s * 0.78, -0.06, -0.85], [s * 0.26, 0, -0.62]], [[s * 0.42, -0.02, -0.25], [s * 0.26, 0, -0.62]]];
export const SHIP_HULL = [[N, [-0.18, 0, 0.5], [-0.26, 0, -0.62], [-0.26, 0, -0.9]], [N, [0.18, 0, 0.5], [0.26, 0, -0.62], [0.26, 0, -0.9]], [N, Ct, Sr], [N, Bk, Sr], [[-0.26, 0, -0.9], Sr, [0.26, 0, -0.9]], [[-0.18, 0, 0.5], Ct, [0.18, 0, 0.5]]];
export const SHIP_WING = [...wing(-1), ...wing(1)];
export const SHIP_FIN = [[[-0.26, 0, -0.62], [-0.42, 0.55, -1.05], Sr], [[0.26, 0, -0.62], [0.42, 0.55, -1.05], Sr], [[-0.17, 0, 1], [-0.34, 0, 0.7], [-0.17, 0, 0.66]], [[0.17, 0, 1], [0.34, 0, 0.7], [0.17, 0, 0.66]]];
const OCT = [[[0, 1, 0], [1, 0, 0], [0, -1, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, -1, 0], [0, 0, -1], [0, 1, 0]], [[1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1], [1, 0, 0]]];
const DART = [[[0, 0, -1.2], [0.8, 0, 0.6], [0, 0.3, 0.2], [-0.8, 0, 0.6], [0, 0, -1.2], [0, 0.3, 0.2]], [[0.8, 0, 0.6], [0, -0.2, 0.9], [-0.8, 0, 0.6]]];
const hex = (r, y, n = 6) => { const a = []; for (let i = 0; i <= n; i++) a.push([Math.cos(i / n * TAU) * r, y, Math.sin(i / n * TAU) * r]); return a; };
const SAUCER = [hex(1, 0), hex(0.5, 0.4), hex(0.5, -0.3), [[1, 0, 0], [0.5, 0.4, 0]], [[-1, 0, 0], [-0.5, 0.4, 0]], [[0, 0, 1], [0, 0.4, 0.5]], [[0, 0, -1], [0, 0.4, -0.5]]];
const KAMI = [[[0, 0, -1.3], [0.5, 0.5, 0.6], [-0.5, 0.5, 0.6], [0, 0, -1.3], [0.5, -0.5, 0.6], [-0.5, -0.5, 0.6], [0, 0, -1.3]], [[0.5, 0.5, 0.6], [0.5, -0.5, 0.6]], [[-0.5, 0.5, 0.6], [-0.5, -0.5, 0.6]]];
const TURRET = [[[-1, -0.7, -1], [1, -0.7, -1], [1, -0.7, 1], [-1, -0.7, 1], [-1, -0.7, -1], [0, 0.6, 0], [1, -0.7, 1]], [[1, -0.7, -1], [0, 0.6, 0], [-1, -0.7, 1]], [[0, 0.6, 0], [0, 1.2, -1.2]]];
const CUBE = [[[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1], [-1, -1, 1]], [[1, -1, -1], [1, -1, 1]], [[1, 1, -1], [1, 1, 1]], [[-1, 1, -1], [-1, 1, 1]]];
const DRONE = [[[0, 0, 0.7], [0.45, 0, -0.4], [0, 0.3, -0.3], [-0.45, 0, -0.4], [0, 0, 0.7], [0, 0.3, -0.3]], [[0.45, 0, -0.4], [-0.45, 0, -0.4]]];
const EMBER = [[[0, 0, -1], [0.5, 0, 0], [0, 0.9, 0.3], [-0.5, 0, 0], [0, 0, -1], [0, -0.5, 0.2], [0.5, 0, 0]], [[-0.5, 0, 0], [0, -0.5, 0.2], [0, 0.9, 0.3]], [[0, 0.9, 0.3], [0.25, 1.5, 0.9]], [[0, 0.9, 0.3], [-0.3, 1.3, 1.1]]];
const SPARK = [[[0, 1.2, 0], [0.25, 0.25, 0], [1.2, 0, 0], [0.25, -0.25, 0], [0, -1.2, 0], [-0.25, -0.25, 0], [-1.2, 0, 0], [-0.25, 0.25, 0], [0, 1.2, 0]], [[0, 0, -1], [0, 0, 1]]];
const JELLY = [hex(1, 0, 8), hex(0.7, 0.6, 8), hex(0.3, 0.95, 8), [[1, 0, 0], [0.7, 0.6, 0], [0.3, 0.95, 0]], [[-1, 0, 0], [-0.7, 0.6, 0], [-0.3, 0.95, 0]], [[0.5, 0, 0.3], [0.6, -0.8, 0.3], [0.4, -1.5, 0.3]], [[-0.5, 0, 0.3], [-0.6, -0.8, 0.3], [-0.4, -1.5, 0.3]], [[0, 0, -0.6], [0.1, -0.9, -0.6], [-0.1, -1.7, -0.6]]];
const SPIT = [hex(0.9, 0, 6), [[-0.9, 0, 0], [-1.3, -0.5, -0.9], [-0.6, -0.2, -1.2]], [[0.9, 0, 0], [1.3, -0.5, -0.9], [0.6, -0.2, -1.2]], [[0, 0.6, 0], [0.45, 0, -0.78], [-0.45, 0, -0.78], [0, 0.6, 0], [0, 0, 0.9]]];
const SAT = [...CUBE.map(pl => pl.map(([x, y, z]) => [x * 0.5, y * 0.5, z * 0.5])), [[-0.5, 0, 0], [-1.8, 0.5, 0], [-1.8, -0.5, 0], [-0.5, 0, 0]], [[0.5, 0, 0], [1.8, 0.5, 0], [1.8, -0.5, 0], [0.5, 0, 0]]];
const ROCK = [[[0, 1, 0.2], [0.9, 0.2, 0], [0.2, -0.9, 0.3], [-0.9, -0.1, 0], [0, 1, 0.2], [0.3, 0.1, 1], [0.2, -0.9, 0.3], [-0.2, 0, -1], [0, 1, 0.2]], [[0.9, 0.2, 0], [0.3, 0.1, 1], [-0.9, -0.1, 0], [-0.2, 0, -1], [0.9, 0.2, 0]]];
const mir = pl => pl.map(([x, y, z]) => [-x, y, z]);
const HEAD_L = [[[-0.45, 0.42, -0.56], [-0.12, 0.42, -0.56], [-0.16, 0.2, -0.52], [-0.42, 0.2, -0.52], [-0.45, 0.42, -0.56]], [[-0.6, 0.35, 0], [-0.74, 0.3, 0.05], [-0.74, -0.42, 0.05], [-0.56, -0.47, 0], [-0.6, 0.35, 0]], [[-0.6, 0.5, -0.55], [-0.45, 1, 0.4]], [[-0.42, -1, -0.45], [-0.4, -1, 0.45]], [[-0.62, 0.5, -0.72], [-0.6, 0.5, -0.55]], [[0, -0.25, -0.95], [-0.17, -0.3, -0.6], [0, 0.45, -0.72]]];
// a long-faced stone head: heavy brow, long nose, deep eye sockets, long ears, a crystal crest
const HEAD = [[[-0.42, -1, -0.45], [-0.55, -0.45, -0.5], [-0.5, 0.25, -0.5], [-0.6, 0.5, -0.55], [-0.48, 1, -0.4], [0.48, 1, -0.4], [0.6, 0.5, -0.55], [0.5, 0.25, -0.5], [0.55, -0.45, -0.5], [0.42, -1, -0.45], [-0.42, -1, -0.45]],
  [[-0.4, -1, 0.45], [-0.45, 1, 0.4], [0.45, 1, 0.4], [0.4, -1, 0.45], [-0.4, -1, 0.45]], [[-0.62, 0.5, -0.72], [0.62, 0.5, -0.72]], [[0, 0.45, -0.72], [0, -0.25, -0.95]], [[-0.28, -0.58, -0.55], [0.28, -0.58, -0.55]], [[-0.2, -0.7, -0.5], [0.2, -0.7, -0.5]],
  [[0, 1, 0], [0.13, 1.35, 0], [0, 1.65, 0], [-0.13, 1.35, 0], [0, 1, 0]], ...HEAD_L, ...HEAD_L.map(mir)];
const EYES = [[[-0.4, 0.31, -0.57], [-0.17, 0.31, -0.57]], [[0.4, 0.31, -0.57], [0.17, 0.31, -0.57]], [[-0.36, 0.36, -0.57], [-0.2, 0.26, -0.57]], [[0.36, 0.36, -0.57], [0.2, 0.26, -0.57]]];
const SHAPES = { saucer: [SAUCER, 1.1, 1], kami: [KAMI, 1.1, 2], shard: [KAMI, 1.1, 2], turret: [TURRET, 1, 0], vent: [TURRET, 0.8, 0], ember: [EMBER, 1, 3], spark: [SPARK, 0.9, 2], jelly: [JELLY, 1, 1], wraith: [SAUCER, 1.1, 1], spore: [OCT, 0.9, 1], spitter: [SPIT, 1.1, 0], sat: [SAT, 0.8, 1], rock: [ROCK, 1, 4], plasma: [OCT, 0.9, 4], worm: [OCT, 1, 1], bomb: [OCT, 0.8, 4], forge: [CUBE, 0.7, 4], head: [HEAD, 1, 0] };

function drawShip(g, p, t) {
  const blink = p.inv > 0 && p.god <= 0 && (t >> 2) % 2; if (blink) return;
  const god = p.god > 0, c1 = god ? RAINBOW[(t >> 2) % 7] : p.i ? '#ffe14a' : '#ffffff', c2 = god ? RAINBOW[((t >> 2) + 2) % 7] : p.i ? '#3dffb0' : '#2ee6ff', c3 = god ? RAINBOW[((t >> 2) + 4) % 7] : p.i ? '#ff8a2b' : '#ff3df0';
  const roll = -p.mvx * 0.55 + (g.shiftT > 0 ? g.shiftDir * ease(1 - g.shiftT) * TAU : 0), pitch = -p.mvy * 0.3;
  const yaw = Math.atan2(p.ax || 0, p.az ?? 1), fx = p.ax || 0, fz = p.az ?? 1;
  mesh(SHIP_HULL, p.x, p.y, p.z, 1, yaw, pitch, roll, c1); mesh(SHIP_WING, p.x, p.y, p.z, 1, yaw, pitch, roll, c2); mesh(SHIP_FIN, p.x, p.y, p.z, 1, yaw, pitch, roll, c3);
  const fl = 0.35 + (g.speedMul - 0.7) * 1.1 + Math.random() * 0.3; for (const s of [-0.22, 0.22]) { const bx = p.x + fz * s - fx * 0.85, bz = p.z - fx * s - fz * 0.85; seg(bx, p.y, bz, bx - fx * fl, p.y, bz - fz * fl, '#ff8a2b'); seg(bx, p.y, bz, bx - fx * fl * 0.6 - fz * s * 0.6, p.y, bz - fz * fl * 0.6 + fx * s * 0.6, '#ffe14a', 0.7); }
  if (g.level.rules?.arena) seg(p.x + fx * 1.6, p.y, p.z + fz * 1.6, p.x + fx * (p.manual ? 5 : 3.2), p.y, p.z + fz * (p.manual ? 5 : 3.2), '#ffffff', p.manual ? 0.7 : 0.35);
  if (p.shield > 0) for (let i = 0; i < p.shield; i++) circle(p.x, p.y, p.z, 1.2 + i * 0.22, '#5ee7ff', 0.5, 12, vB === 3 ? 1 : vB === 0 ? 2 : 0, t * 0.05 + i);
  if (vB === 1 || vB === 2 || mix < 1) { seg(p.x - 0.5, 0, p.z, p.x + 0.5, 0, p.z, '#2ee6ff', 0.4); seg(p.x, 0, p.z - 0.6, p.x, 0, p.z + 0.6, '#2ee6ff', 0.4); if (vB === 1) seg(p.x, 0, p.z, p.x, p.y, p.z, '#2ee6ff', 0.2); }
}

// ---------- backdrop per planet ----------
function backdrop(g, th, t) {
  const gc = th.grid || '#2443c8', off = g.camZ % 3, base = Math.floor(g.camZ / 4), sky = th.sky, dim = vB === 0 ? 0.2 : 0.5;
  if (!th.nofloor) { for (let k = 0; k < 12; k++) { const z = -3 - off + k * 3; if (sky === 'sun' || th.trippy) { let lx = -9, ly = Math.sin(z * 0.5 + t * 0.05 - 9 * 0.6) * 0.3; for (let x = -6; x <= 9; x += 3) { const y = Math.sin(z * 0.5 + t * 0.05 + x * 0.6) * 0.3; seg(lx, ly + 0.3, z, x, y + 0.3, z, gc, 0.6); lx = x; ly = y; } } else seg(-9, 0, z, 9, 0, z, gc, 0.55); } for (let x = -9; x <= 9; x += 3) seg(x, 0, -3, x, 0, 30, gc, 0.55); }
  if (th.arena) { const c = th.arena, pu = 0.7 + 0.3 * Math.sin(t * 0.08); for (const y of [0.02, 4.5]) { const al = y < 1 ? 1 : 0.35 * pu; seg(-9.2, y, -1.6, 9.2, y, -1.6, c, al); seg(9.2, y, -1.6, 9.2, y, 25.2, c, al); seg(9.2, y, 25.2, -9.2, y, 25.2, c, al); seg(-9.2, y, 25.2, -9.2, y, -1.6, c, al); } for (const [x, z] of [[-9.2, -1.6], [9.2, -1.6], [9.2, 25.2], [-9.2, 25.2]]) seg(x, 0, z, x, 4.5, z, c, 0.8); circle(0, 0.02, 11.8, 3 + Math.sin(t * 0.04), c, 0.4, 24, 1, t * 0.01); circle(0, 0.02, 11.8, 6.5, c, 0.2, 30, 1, -t * 0.006); }
  for (let k = -1; k < 9; k++) { const id = base + k, z = id * 4 - g.camZ + 2; for (const s of [-1, 1]) { const r1 = hash(id * 2 + s), r2 = hash(id + s * 9), x = s * (11 + hash(id * 3 + s) * 2);
    if (sky === 'city') { const h = 2 + r1 * 7; box({ x, y: h / 2, z, hx: 1 + r2 * 0.8, hy: h / 2, hz: 1.5 }, s > 0 ? '#7a2bd6' : '#2b56d6', dim, vB === 0 ? 0 : 2); }
    else if (sky === 'volcano') { const h = 2 + r1 * 5, w = 1.6 + r2; for (const [dx, dz] of [[-w, -w], [w, -w], [w, w], [-w, w]]) seg(x + dx, 0, z + dz, x + dx * 0.3, h, z + dz * 0.3, '#8a2a12', dim); seg(x - w * 0.3, h, z, x + w * 0.3, h, z, r2 > 0.6 ? '#ff8a2b' : '#8a2a12', dim + 0.2); if (r2 > 0.6) seg(x, h, z, x + (hash(t >> 3) - 0.5), h + 1 + hash((t >> 3) + id), z, '#ffe14a', 0.6); }
    else if (sky === 'cloud' || sky === 'space') { if (sky === 'cloud') for (const y of [-0.5, 10.3]) { let lx = x - 3, ly = y; for (let i = 1; i <= 4; i++) { const px = x - 3 + i * 1.5, py = y + Math.sin(id + i * 1.3 + t * 0.02) * 0.6; seg(lx, ly, z, px, py, z, s > 0 ? '#c98a4a' : '#a85a2a', dim); lx = px; ly = py; } } else if (r1 > 0.5) mesh(ROCK, x + s * 2, r2 * 9, z, 0.6 + r1, id, t * 0.01, 0, '#5a5a7a', dim); }
    else if (sky === 'bio') { let lx = s * 9, ly = 0, lz = z; for (let i = 1; i <= 5; i++) { const f = i / 5, px = s * (9 + Math.sin(f * 2.2) * 3 + Math.sin(t * 0.03 + id) * 0.5 * f), py = f * (5 + r1 * 4); seg(lx, ly, lz, px, py, z, i % 2 ? '#3dffb0' : '#ff3df0', dim); lx = px; ly = py; } }
    else if (sky === 'ice') { const h = 3 + r1 * 6, w = 0.7 + r2 * 0.6; for (const [dx, dz] of [[-w, 0], [w, 0], [0, -w], [0, w]]) seg(x + dx, 0, z + dz, x, h, z, '#5ea0ff', dim); }
    else if (sky === 'moon') { if (r1 > 0.4) circle(s * (3 + r2 * 8), 0.02, z, 0.6 + r1 * 1.2, '#5a6480', 0.5, 10, 1); }
    else if (sky === 'sun') { // flares: fans of wavy tendrils bursting outward from the surface in every direction
      const phi = r1 * TAU + t * 0.004 * s, hx = Math.cos(phi), hz = Math.sin(phi), n = 6, len = 3.5 + r2 * 4 + Math.sin(t * 0.03 + id) * 1.2, ox = s * (9.6 + r1 * 1.5);
      for (let i = 0; i < n; i++) { const an = 0.25 + i / (n - 1) * (Math.PI - 0.5), ca = Math.cos(an), sa = Math.sin(an); let lx = ox, ly = 0, lz = z;
        for (let k = 1; k <= 7; k++) { const d = k / 7 * len, wv = Math.sin(k * 1.1 + t * 0.09 + i * 1.7 + id) * 0.55 * (k / 7), px = ox + hx * (ca * d - sa * wv), py = Math.max(0, sa * d + ca * wv), pz = z + hz * (ca * d - sa * wv); seg(lx, ly, lz, px, py, pz, k > 4 ? '#ffe14a' : i % 2 ? '#ffb02e' : '#ff5a1f', (dim + 0.25) * (1 - k / 9)); lx = px; ly = py; lz = pz; } }
      let fx = ox + 1.6, fz = z; for (let k = 1; k <= 12; k++) { const a2 = k / 12 * TAU, rr = 1.6 + Math.sin(a2 * 5 + t * 0.07 + id) * 0.35, px = ox + Math.cos(a2) * rr, pz = z + Math.sin(a2) * rr; seg(fx, 0.03, fz, px, 0.03, pz, '#ff8a2b', dim + 0.15); fx = px; fz = pz; } } } }
  if (th.nofloor && sky === 'cloud') for (let k = 0; k < 8; k++) { const z = -3 - (g.camZ % 4) + k * 4; let lx = -9, ly = -0.3; for (let x = -6; x <= 9; x += 3) { const y = -0.3 + Math.sin(x * 0.7 + k + t * 0.015) * 0.4; seg(lx, ly, z, x, y, z, '#7a4a1e', 0.4); lx = x; ly = y; } }
}

// ---------- obstacles, drawn so their shape tells you how to get past ----------
function drawObs(g, b, t) {
  depth(b.x + Math.min(b.hx, 3), b.z - b.hz);
  const ghost = b.phase != null && b.phase !== g.view; let a = ghost ? 0.18 : 1, col = b.hit > 0 ? '#ffffff' : b.col; const k = b.kind;
  if (b.z > 34) a *= Math.max(0.12, (48 - b.z) / 14); // far scenery fades in
  if (k === 'safe') { if (b.z - b.hz > 26) return; const x0 = Math.max(-9, b.x - b.hx), x1 = Math.min(9, b.x + b.hx), y0 = Math.max(0.1, b.y - b.hy), y1 = Math.min(9.5, b.y + b.hy), c = '#3dffb0', al = 0.65 + 0.35 * Math.sin(t * 0.2), zs = b.hz > 3 ? [b.z - b.hz, b.z, b.z + b.hz] : [b.z - b.hz];
    for (const z of zs) { seg(x0, y0, z, x1, y0, z, c, al); seg(x1, y0, z, x1, y1, z, c, al); seg(x1, y1, z, x0, y1, z, c, al); seg(x0, y1, z, x0, y0, z, c, al); }
    if (b.hz > 3) { const z0 = b.z - b.hz, z1 = b.z + b.hz; seg(x0, y0, z0, x0, y0, z1, c, al); seg(x1, y0, z0, x1, y0, z1, c, al); seg(x0, y1, z0, x0, y1, z1, c, al); seg(x1, y1, z0, x1, y1, z1, c, al); const mx = (x0 + x1) / 2, my = (y0 + y1) / 2; for (let z = z0 + 2 + (t * 0.08 % 3); z < z1 - 1; z += 3) { if (b.hx > 5) { seg(-1, my, z, 0, my, z + 1, c, al * 0.8); seg(1, my, z, 0, my, z + 1, c, al * 0.8); seg(-9, my - 0.5, z, -9, my, z + 1, c, al * 0.8); seg(-9, my + 0.5, z, -9, my, z + 1, c, al * 0.8); } else { seg(mx - 0.6, 0.05, z, mx, 0.05, z + 1, c, al * 0.8); seg(mx + 0.6, 0.05, z, mx, 0.05, z + 1, c, al * 0.8); seg(mx - 0.6, 4.7, z, mx, 4.7, z + 1, c, al * 0.5); seg(mx + 0.6, 4.7, z, mx, 4.7, z + 1, c, al * 0.5); } } }
    return; }
  if (k === 'sheet') { // a solid slab of grid: every face is cross-hatched so the gap beside it reads as empty space in any view
    const warm = b.warm > 0; a = warm ? 0.5 + 0.3 * ((t >> 2) % 2) : 1; if (!warm) col = (t >> 1) % 2 ? '#ffffff' : b.col;
    const x0 = Math.max(-9, b.x - b.hx), x1 = Math.min(9, b.x + b.hx), y0 = Math.max(0, b.y - b.hy), y1 = Math.min(9.6, b.y + b.hy), z0 = b.z - b.hz, z1 = b.z + b.hz; if (x1 - x0 < 0.2 || y1 - y0 < 0.2) return;
    fillBox(b, b.col, warm ? 0.5 : 1.5, false);
    const g2 = a * 0.7, sx = Math.max(1.5, (x1 - x0) / 6), sy = Math.max(0.8, (y1 - y0) / 5), sz = 2;
    for (const x of [x0, x1]) { for (let y = y0; y <= y1 + 0.01; y += sy) seg(x, y, z0, x, y, z1, col, y === y0 || y + sy > y1 ? a : g2); for (let z = z0; z <= z1 + 0.01; z += sz) seg(x, y0, z, x, y1, z, col, g2); seg(x, y1, z0, x, y1, z1, col, a); }
    for (const y of [y0, y1]) { for (let x = x0 + sx; x < x1 - 0.01; x += sx) seg(x, y, z0, x, y, z1, col, g2); for (let z = z0; z <= z1 + 0.01; z += sz) seg(x0, y, z, x1, y, z, col, g2); }
    for (const z of [z0, z1]) { for (let x = x0 + sx; x < x1 - 0.01; x += sx) seg(x, y0, z, x, y1, z, col, g2); for (let y = y0 + sy; y < y1 - 0.01; y += sy) seg(x0, y, z, x1, y, z, col, g2); seg(x0, y0, z, x1, y0, z, col, a); seg(x0, y1, z, x1, y1, z, col, a); seg(x0, y0, z, x0, y1, z, col, a); seg(x1, y0, z, x1, y1, z, col, a); }
    return; }
  if (k === 'geyser') { circle(b.x, 0.05, b.z, b.hx, col, 0.9, 10, 1); if (b.warm > 0) { circle(b.x, 0.05, b.z, b.hx * (0.3 + 0.7 * (b.warm % 20) / 20), '#ffe14a', 0.9, 10, 1); seg(b.x - b.hx, 0.05, b.z - b.hz, b.x + b.hx, 0.05, b.z + b.hz, '#ffe14a', 0.8); seg(b.x + b.hx, 0.05, b.z - b.hz, b.x - b.hx, 0.05, b.z + b.hz, '#ffe14a', 0.8); }
    if (b.idle || b.warm > 0) { if ((b.soon || b.warm > 0 && b.warm < 50) && (t >> 2) % 2) box(b, col, 0.3); for (let i = 0; i < 2; i++) seg(b.x + (hash(i + (t >> 3)) - 0.5), 0, b.z, b.x + (hash(i + (t >> 3)) - 0.5), 0.5 + hash(i * 3 + (t >> 3)), b.z, '#ffe14a', 0.7); return; }
    fillBox(b, col, 1.3, false); box(b, col, 0.7); for (let i = 0; i < 4; i++) { const ox = (i % 2 ? 1 : -1) * b.hx * 0.5, oz = (i < 2 ? 1 : -1) * b.hz * 0.5; zig(b.x + ox, 0, b.z + oz, b.x + ox, 9.5, b.z + oz, i % 2 ? '#ffe14a' : '#ffffff', 1, 7, 0.7, i + (t >> 1)); } return; }
  if (k === 'bolt') { const hz = b.hx > b.hy, x0 = b.x - (hz ? b.hx : 0), x1 = b.x + (hz ? b.hx : 0), y0 = b.y - (hz ? 0 : b.hy), y1 = b.y + (hz ? 0 : b.hy); mesh(OCT, x0, Math.max(0.3, y0), b.z, 0.35, t * 0.1, 0, 0, col); mesh(OCT, x1, Math.min(9.3, y1), b.z, 0.35, -t * 0.1, 0, 0, col);
    if (b.idle) { if (b.soon) { if ((t >> 2) % 2) seg(x0, y0, b.z, x1, y1, b.z, col, 0.5); } else seg(x0, y0, b.z, x1, y1, b.z, col, 0.12); return; } zig(x0, y0, b.z, x1, y1, b.z, '#ffffff', 1, 12, 1, t >> 1); zig(x0, y0, b.z, x1, y1, b.z, col, 1, 9, 1.4, (t >> 1) + 50); return; }
  if (k === 'tide') { // a rising sea of lava, or a falling roof of ash: the wavy edge is the part that kills
    const up = !b.ash, edge = up ? b.y + b.hy : b.y - b.hy, c2 = up ? '#ffe14a' : '#8a5a3a', a2 = b.warm > 0 ? 0.5 : 1; if (edge < -0.3 || edge > 10) return;
    fillBox(up ? { x: 0, y: edge / 2, z: b.z, hx: 9, hy: edge / 2, hz: b.hz } : { x: 0, y: (edge + 9.6) / 2, z: b.z, hx: 9, hy: (9.6 - edge) / 2, hz: b.hz }, col, 1.3, false);
    for (const z of [b.z - b.hz, b.z - b.hz / 2, b.z, b.z + b.hz / 2, b.z + b.hz]) { let lx = -9, ly = edge + Math.sin(z + t * 0.12) * 0.25; for (let x = -7.5; x <= 9; x += 1.5) { const py = edge + Math.sin(x * 0.9 + z + t * 0.12) * 0.25; seg(lx, ly, z, x, py, z, (x / 1.5 | 0) % 2 ? col : c2, a2); lx = x; ly = py; } }
    for (let x = -9; x <= 9; x += 3) { seg(x, edge, b.z - b.hz, x, edge, b.z + b.hz, col, a2 * 0.7); for (const z of [b.z - b.hz, b.z + b.hz]) seg(x, edge, z, x, up ? 0 : 9.6, z, col, a2 * 0.5); }
    for (let i = 1; up ? edge - i * 0.9 > 0 : edge + i * 0.9 < 9.6; i++) { const y = up ? edge - i * 0.9 : edge + i * 0.9; seg(-9, y, b.z - b.hz, 9, y, b.z - b.hz, col, a2 * 0.5); seg(-9, y, b.z - b.hz, -9, y, b.z + b.hz, col, a2 * 0.6); seg(-9, y, b.z + b.hz, 9, y, b.z + b.hz, col, a2 * 0.3); }
    for (let z = b.z - b.hz; z <= b.z + b.hz + 0.01; z += 2) { seg(-9, edge, z, -9, up ? 0 : 9.6, z, col, a2 * 0.6); seg(9, edge, z, 9, up ? 0 : 9.6, z, col, a2 * 0.4); }
    return; }
  if (k === 'firearc') { let lx = b.x - b.hx, ly = b.y; for (let i = 1; i <= 12; i++) { const px = b.x - b.hx + i * b.hx / 6, py = b.y + Math.sin(i * 1.3 + t * 0.3) * 0.4; seg(lx, ly, b.z, px, py, b.z, i % 2 ? '#ffe14a' : col, 1); seg(lx, ly - 0.3, b.z + 0.5, px, py - 0.3, b.z + 0.5, col, 0.6); lx = px; ly = py; } box(b, col, 0.3); return; }
  if (k === 'cone' || k === 'crater') { const w = b.hx, h = b.y + b.hy, tw = k === 'crater' ? 0.75 : 0.3; for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) seg(b.x + dx * w, 0, b.z + dz * w, b.x + dx * w * tw, h, b.z + dz * w * tw, col, a); circle(b.x, 0.03, b.z, w * 1.3, col, a * 0.7, 10, 1); circle(b.x, h, b.z, w * tw * 1.3, k === 'crater' ? col : '#ff8a2b', a, 8, 1, t * 0.02); return; }
  if (k === 'cloud') { for (let i = 0; i < 5; i++) { const y = 1 + i * 1.9; let lx = b.x - b.hx, ly = y; for (let j = 1; j <= 4; j++) { const px = b.x - b.hx + j * b.hx / 2, py = y + Math.sin(j * 2 + i + t * 0.02) * 0.5; seg(lx, ly, b.z - b.hz + i * 2, px, py, b.z - b.hz + i * 2, col, 0.3); lx = px; ly = py; } } return; }
  if (k === 'shade') { // the shadow lane: a dense cool-blue hatch with bright rails, against a hot orange world
    const pl = g.players[0], inside = pl && Math.abs(pl.z - b.z) < b.hz && (!MASK[g.view][0] || Math.abs(pl.x - b.x) < b.hx) && (!MASK[g.view][1] || Math.abs(pl.y - b.y) < b.hy), c = inside ? '#ffffff' : '#7df9ff', c2 = '#2e7bff';
    const x0 = Math.max(-9, b.x - b.hx), x1 = Math.min(9, b.x + b.hx), y0 = Math.max(0, b.y - b.hy), y1 = Math.min(9.6, b.y + b.hy), z0 = b.z - b.hz, z1 = b.z + b.hz;
    if (b.hx < 5) { for (const y of [0.05, 9.5]) { const al = y < 1 ? 1 : 0.45; for (const x of [x0, x1]) { seg(x, y, z0, x, y, z1, c, al); seg(x + (x === x0 ? 0.25 : -0.25), y, z0, x + (x === x0 ? 0.25 : -0.25), y, z1, c, al * 0.6); } for (let z = z0; z < z1 - 0.01; z += 0.8) seg(x0, y, z, x1, y, z, c2, al * 0.75); for (let x = x0 + 0.9; x < x1 - 0.1; x += 0.9) seg(x, y, z0, x, y, z1, c2, al * 0.5); }
      for (let z = z0; z <= z1 + 0.01; z += 4) { seg(x0, 0.05, z, x0, 9.5, z, c, 0.35); seg(x1, 0.05, z, x1, 9.5, z, c, 0.35); } }
    else { for (const x of [-9, 0, 9]) { const al = x === 0 ? 1 : 0.5; for (const y of [y0, y1]) { seg(x, y, z0, x, y, z1, c, al); seg(x, y + (y === y0 ? 0.15 : -0.15), z0, x, y + (y === y0 ? 0.15 : -0.15), z1, c, al * 0.6); } for (let z = z0; z < z1 - 0.01; z += 0.8) seg(x, y0, z, x, y1, z, c2, al * 0.75); for (let y = y0 + 0.6; y < y1 - 0.1; y += 0.6) seg(x, y, z0, x, y, z1, c2, al * 0.5); } }
    return; }
  if (k === 'statue') { const hs = b.hx / 0.62, top = Math.min(9.6, b.y + b.hy), neck = top - hs * 2; fillBox({ x: b.x, y: neck / 2, z: b.z, hx: b.hx * 0.7, hy: neck / 2, hz: b.hz * 0.7 }, col); fillBox({ x: b.x, y: neck + hs, z: b.z, hx: hs * 0.5, hy: hs, hz: hs * 0.45 }, col, 0.8, false); box({ x: b.x, y: neck / 2, z: b.z, hx: b.hx * 0.7, hy: neck / 2, hz: b.hz * 0.7 }, col, a, 3); mesh(HEAD, b.x, neck + hs, b.z, hs, 0, 0, 0, col, a); mesh(EYES, b.x, neck + hs, b.z, hs, 0, 0, 0, '#ff3df0', a); circle(b.x, 0.04, b.z, b.hx * 1.3, col, 0.7, 8, 1); if (vB === 3) { seg(b.x - b.hx, 9.5, b.z - b.hz, b.x + b.hx, 9.5, b.z + b.hz, col, 0.6); seg(b.x + b.hx, 9.5, b.z - b.hz, b.x - b.hx, 9.5, b.z + b.hz, col, 0.6); } return; }
  if (k === 'tentacle') { for (let s = -1; s <= 1; s++) { let lx = b.x + s * 0.4, ly = 0; for (let i = 1; i <= 7; i++) { const py = i * 1.37, px = b.x + s * 0.4 + Math.sin(i * 0.9 + t * 0.05 + s) * 0.35; seg(lx, ly, b.z, px, py, b.z, s ? col : '#ff3df0', a); lx = px; ly = py; } } circle(b.x, 0.05, b.z, b.hx * 1.2, col, 0.6, 8, 1); return; }
  if (k === 'ice') { fillBox(b, col, 1.2); box(b, col, a); const x0 = Math.max(-9, b.x - b.hx), x1 = Math.min(9, b.x + b.hx), y0 = Math.max(0, b.y - b.hy), y1 = Math.min(9.6, b.y + b.hy), z = b.z - b.hz, n = Math.max(1, (x1 - x0) / 3 | 0); for (let i = 0; i < n; i++) { const xa = x0 + (x1 - x0) * i / n, xb = x0 + (x1 - x0) * (i + 1) / n; seg(xa, y0, z, xb, y1, z, '#ffffff', a * 0.6); seg(xb, y0, z, xa, y1, z, col, a * 0.5); } return; }
  if (!ghost) fillBox(b, b.col, k === 'car' ? 1.3 : 1);
  box(b, col, a, k === 'tower' || k === 'thunderhead' || k === 'rockwall' ? Math.min(5, b.hy | 0) : 0);
  if (k === 'gate') hatch(b, col, a * 0.4, 6); else if (k === 'slab' || k === 'arch' || k === 'clouddeck' || k === 'membrane') hatch(b, col, a * 0.35, 10);
  else if (k === 'tower' || k === 'spire' || k === 'pylon' || k === 'thunderhead') { seg(b.x, 0, b.z - b.hz, b.x, Math.min(9.6, b.y + b.hy), b.z - b.hz, col, a * 0.5); if (vB === 3) { seg(b.x - b.hx, 9.5, b.z - b.hz, b.x + b.hx, 9.5, b.z + b.hz, col, a * 0.5); seg(b.x + b.hx, 9.5, b.z - b.hz, b.x - b.hx, 9.5, b.z + b.hz, col, a * 0.5); } }
  else if (k === 'car') seg(b.x - Math.sign(b.vx) * b.hx, b.y, b.z, b.x - Math.sign(b.vx) * (b.hx + 1.4), b.y, b.z, '#ffe14a', 0.6);
}

// ---------- world ----------
export function drawWorld(ctx, g, o = {}) {
  const t = g.tick, p0 = g.players[0], th = g.level.theme || {};
  vA = g.viewFrom; vB = g.view; mix = g.shiftT > 0 ? ease(1 - g.shiftT) : 1; rollA = g.shiftT > 0 ? g.shiftDir * mix * TAU : 0; wob = th.trippy ? Math.sin(t * 0.013) * 0.05 : 0;
  { const al = g.players.filter(q => q.dead <= 0), n = al.length || 1, cx = al.length ? al.reduce((a, q) => a + q.x, 0) / n : p0.x, cy = al.length ? al.reduce((a, q) => a + q.y, 0) / n : p0.y, cz = al.length ? Math.min(...al.map(q => q.z)) : p0.z; cam.x = cx * 0.55; cam.y = cy * 0.55 + 1.9; cam.z = cz - 7.5; } const tags = [];
  ctx.save();
  if (g.shake > 0.5 && o.shake !== false) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  ctx.globalCompositeOperation = 'lighter';
  const warp = Math.max(0, g.speedMul - 1.75) * 30; ctx.strokeStyle = '#8fa8ff'; ctx.fillStyle = '#8fa8ff'; ctx.lineWidth = 1;
  for (let i = 0; i < 70; i++) { const sp = 0.3 + hash(i) * 1.5, x = ((hash(i + 50) * W - g.camZ * sp * (vB === 0 ? 6 : 2)) % W + W) % W, y = ((hash(i + 99) * H + (vB === 3 ? g.camZ * sp * 6 : 0)) % H + H) % H; ctx.globalAlpha = 0.25 + hash(i + 7) * 0.5; if (warp > 1) { const dx = x - 480, dy = y - 270, d = Math.hypot(dx, dy) || 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx / d * warp * sp, y + dy / d * warp * sp); ctx.stroke(); } else ctx.fillRect(x, y, sp > 1.2 ? 2 : 1, sp > 1.2 ? 2 : 1); } ctx.globalAlpha = 1;
  FILL = !!o.fill; vOcc = mix < 0.5 ? vA : vB; OCC = FILL && (vOcc === 1 || vOcc === 2); depth0(); backdrop(g, th, t); LAY = 2; buckets = layers[2]; // layer 0 = floor and skyline, 1 = ground shadows, 2+ = everything else, far to near
  for (const b of g.obs) drawObs(g, b, t);
  if (FILL) for (const e of g.enemies) if (e.type === 'boss' && e.z < 30) { const hs = e.look === 'colossus' ? 3.3 : 0; if (hs) fillBox({ x: e.x, y: Math.max(hs, e.y - 0.2), z: e.z, hx: hs * 0.52, hy: hs, hz: hs * 0.45 }, e.col, 0.9); }
  for (const r of g.rings) { if (r.got) continue; depth(r.x, r.z);
    if (r.kind === 'warp') { if (g.view === r.phase && r.z < 17) { const y = MASK[g.view][1] ? r.y : 4.7, x = MASK[g.view][0] ? r.x : 0, f = Math.min(1, (17 - r.z) / 5); for (let i = 0; i < 4; i++) circle(x, y, r.z, r.r * (1 - i * 0.2), i % 2 ? '#ffffff' : '#b06bff', f, 20, vB === 3 ? 1 : 0, t * 0.05 * (i % 2 ? 1 : -1)); for (let i = 0; i < 6; i++) { const a = t * 0.04 + i / 6 * TAU; if (vB === 3) seg(x, y, r.z, x + Math.cos(a) * r.r, y, r.z + Math.sin(a) * r.r, '#b06bff', 0.6 * f); else seg(x, y, r.z, x + Math.cos(a) * r.r, y + Math.sin(a) * r.r, r.z, '#b06bff', 0.6 * f); } }
      else if (r.z < 14 && (t + (r.z | 0) * 7) % 41 < 2) { const a = hash(t) * TAU, x = Math.max(-8.5, Math.min(8.5, r.x)), y = Math.max(0.3, r.y); seg(x, y, r.z, x + Math.cos(a) * 0.4, y + Math.sin(a) * 0.4, r.z, '#b06bff', 0.35); } }
    else { circle(r.x, r.y, r.z, r.r, '#3dffb0', 0.8, 14, 0, t * 0.03); circle(r.x, r.y, r.z, r.r * 0.7, '#3dffb0', 0.35, 14, 0, -t * 0.03); } }
  for (const e of g.enemies) {
    if (e.y <= 0 && e.type !== 'boss') continue; depth(e.x, e.z - (e.hz || 0)); const ghost = e.phase != null && e.phase !== g.view, a = ghost ? (e.haunt ? 0.06 : 0.2) : 1, col = e.hit > 0 ? '#ffffff' : e.col;
    if (e.type === 'boss') { if (e.dying) { const j = e.dying / 150 * 1.7, ox = e.x, oy = e.y; e.x = ox - j; e.y = oy + Math.sin(t * 0.9) * 0.15; drawBoss(g, e, t); e.x = ox + j; e.y = oy - Math.sin(t * 0.9) * 0.15; drawBoss(g, e, t); e.x = ox; e.y = oy; } else drawBoss(g, e, t); continue; }
    const sh = SHAPES[e.shape];
    if (e.shape === 'carrier') { mesh(CUBE, e.x, e.y, e.z, e.r * 0.8, t * 0.03, t * 0.02, 0, col, a); mesh(OCT, e.x, e.y, e.z, e.r * 0.45, -t * 0.06, 0, 0, '#ffe14a', a); }
    else if (sh) { const sp = sh[2], yaw = sp === 1 || sp === 4 ? t * 0.05 + e.ph : e.shape === 'head' ? Math.max(-0.7, Math.min(0.7, (e.x - p0.x) * 0.12)) : 0, pit = sp === 4 ? t * 0.03 : 0, rol = sp === 2 ? t * 0.2 : sp === 3 ? Math.sin(e.t * 0.08) * 0.5 : 0; mesh(sh[0], e.x, e.y, e.z, e.r * sh[1], yaw, pit, rol, col, a);
      if (e.shape === 'head') mesh(EYES, e.x, e.y, e.z, e.r, 0, 0, 0, e.fire && (e.t + e.ph * 10 | 0) % e.fire > e.fire - 25 ? '#ffffff' : '#ff3df0', a); if (e.shape === 'forge') mesh(OCT, e.x, e.y, e.z, e.r * 0.5, -t * 0.08, 0, 0, '#ff5a1f', a); if (e.shape === 'plasma') circle(e.x, e.y, e.z, e.r * (1.1 + Math.sin(t * 0.2) * 0.2), col, 0.6, 10); if (e.shape === 'bomb') seg(e.x, e.y, e.z, e.x - e.vx * 0.06, e.y - e.vy * 0.06, e.z, '#ffe14a', 0.8); }
    else if (e.shape === 'eye') { const top = e.y > 5; seg(e.x, top ? 9.6 : 0, e.z, e.x, e.y, e.z, '#ff3df0', a); circle(e.x, e.y, e.z, e.r, col, a, 10); circle(e.x + (p0.x - e.x) * 0.02, e.y + (p0.y - e.y) * 0.03, e.z - 0.1, e.r * 0.4, '#b6ff3d', a, 6); }
    else mesh(DART, e.x, e.y, e.z, e.r * 1.05, 0, 0, Math.sin(e.t * 0.05) * 0.6, col, a);
  }
  for (const q of g.pods) { depth(q.x, q.z); const col = q.kind === 'god' ? RAINBOW[(t >> 2) % 7] : q.kind === 'bomb' ? '#ff8a2b' : q.kind === 'gem' ? '#7df9ff' : '#ffe14a'; mesh(OCT, q.x, q.y, q.z, (q.kind === 'gem' ? 0.35 : 0.5) + Math.sin(q.t * 0.15) * 0.08, q.t * 0.08, q.t * 0.05, 0, col); if (q.kind === 'god' || q.kind === 'bomb') circle(q.x, q.y, q.z, 0.8, col, 0.6, 10, 0, -q.t * 0.1); }
  { const pl = vB === 3 ? 1 : vB === 0 ? 2 : 0; for (const b of g.ebul) { depth(b.x, b.z); const r = 0.36 + 0.07 * Math.sin(t * 0.4 + b.x * 3), k = 0.03; LW = 2; circle(b.x, b.y, b.z, r, b.col, 1, 6, pl, t * 0.15); LW = 1.6; seg(b.x - r * 0.6, b.y, b.z, b.x + r * 0.6, b.y, b.z, '#ffffff'); seg(b.x, b.y - r * 0.6, b.z, b.x, b.y + r * 0.6, b.z, '#ffffff'); seg(b.x, b.y, b.z - r * 0.6, b.x, b.y, b.z + r * 0.6, '#ffffff'); LW = 1; circle(b.x, b.y, b.z, r * 1.7, b.col, 0.35, 6, pl, -t * 0.1); seg(b.x, b.y, b.z, b.x - b.vx * k * 2, b.y - b.vy * k * 2, b.z - b.vz * k * 2, b.col, 0.5); } }
  for (const s of g.shots) { depth(s.x, s.z);
    if (s.kind === 3) { const n = 6, R = s.r * 1.3; let lx, ly, lz; for (let i = 0; i <= n; i++) { const f = i / n * 2 - 1, d = f * R, zz = s.z - Math.abs(f) * 0.9, px = s.axis === 'x' ? s.x + d : s.x, py = s.axis === 'y' ? s.y + d : s.y; if (i) seg(lx, ly, lz, px, py, zz, i % 2 ? '#ff3df0' : '#7df9ff'); lx = px; ly = py; lz = zz; } continue; }
    if (s.kind === 4) { const tr = s.trail; let lx = s.x, ly = s.y, lz = s.z; for (let i = tr.length - 3; i >= 0; i -= 3) { const j = 0.25 + 0.5 * (1 - i / tr.length), px = tr[i] + (hash(i + t) - 0.5) * j, py = tr[i + 1] + (hash(i * 3 + t) - 0.5) * j, pz = tr[i + 2]; seg(lx, ly, lz, px, py, pz, i % 6 ? '#7df9ff' : '#ffffff', 0.15 + 0.85 * i / tr.length); if (i % 18 === 0 && i > 9) seg(px, py, pz, px + (hash(i * 5 + (t >> 1)) - 0.5) * 1.6, py + (hash(i * 7 + (t >> 1)) - 0.5) * 1.6, pz - 0.4, '#b06bff', 0.5 * i / tr.length); lx = px; ly = py; lz = pz; } mesh(SPARK, s.x, s.y, s.z, 0.35, 0, 0, t * 0.5, '#ffffff'); continue; }
    const k = s.kind === 2 ? 0.03 : s.kind === 0 ? 0.034 : 0.022; LW = s.kind === 0 ? 2.4 : s.kind === 2 ? 1.6 : 1.3; seg(s.x, s.y, s.z, s.x - s.vx * k, s.y - s.vy * k, s.z - s.vz * k, s.kind === 2 ? '#ff8a2b' : s.kind === 1 ? '#b06bff' : '#7df9ff'); if (s.kind === 0) { LW = 1; seg(s.x, s.y, s.z, s.x - s.vx * k * 0.5, s.y - s.vy * k * 0.5, s.z - s.vz * k * 0.5, '#ffffff'); } LW = 1; }
  for (const b of g.beams) { depth(b.x, b.z0); const a = b.life / b.max; if (b.w) { for (let i = 0; i < 7; i++) { const an = i / 7 * TAU + t * 0.3, ox = Math.cos(an) * b.w * 0.8, oy = Math.sin(an) * b.w * 0.8; const qx = b.ex != null ? ox * 0.6 : vB === 0 ? 0 : ox, qy = b.ex != null ? 0 : vB === 3 ? 0 : vB === 0 ? ox : oy, qz = b.ex != null ? oy * 0.6 : 0; seg(b.x + qx, b.y + qy, b.z0 + qz, (b.ex ?? b.x) + qx, b.y + qy, b.z1 + qz, RAINBOW[(i + (t >> 1)) % 7], a); } seg(b.x, b.y, b.z0, b.ex ?? b.x, b.y, b.z1, '#ffffff', a); } else { LW = 4; seg(b.x, b.y, b.z0, b.ex ?? b.x, b.y, b.z1, b.col, a * 0.6); LW = 2; seg(b.x, b.y, b.z0, b.ex ?? b.x, b.y, b.z1, b.col, a); LW = 1; seg(b.x, b.y, b.z0, b.ex ?? b.x, b.y, b.z1, '#ffffff', a); } }
  for (const p of g.players) { if (p.dead > 0) continue; depth(p.x, p.z - 1); drawShip(g, p, t); for (let k = 0; k < p.drones.length; k++) { const d = p.drones[k]; depth(d.x, d.z); mesh(DRONE, d.x, d.y, d.z, 0.7, 0, 0, t * 0.1 + k, p.god > 0 ? RAINBOW[(k + (t >> 2)) % 7] : d.tmp ? '#ffffff' : '#b06bff'); } }
  { const w = g.wing; if (w && w.dead <= 0 && !(w.inv > 0 && (t >> 2) % 2)) { // RIVET-9, the assist wingman
      depth(w.x, w.z); const roll = g.shiftT > 0 ? g.shiftDir * ease(1 - g.shiftT) * TAU : Math.sin(w.t * 0.05) * 0.15, yaw = Math.atan2(p0.ax || 0, p0.az ?? 1), vc = VCOL[g.view];
      mesh(SHIP_HULL, w.x, w.y, w.z, 0.78, yaw, 0, roll, '#ffb070'); mesh(SHIP_WING, w.x, w.y, w.z, 0.78, yaw, 0, roll, vc); mesh(SHIP_FIN, w.x, w.y, w.z, 0.78, yaw, 0, roll, '#ffe14a');
      P(w.x, w.y + 1.1, w.z); if (OK && g.shiftT <= 0) tags.push([X, Y - (vB === 3 ? 30 : 8), 'R9', '#ffb070']); }
    const gh = o.ghost; if (gh && gh.z > -2 && gh.z < 30) { depth(gh.x, gh.z); mesh(SHIP_HULL, gh.x, gh.y, gh.z, 1, 0, 0, 0, '#3dffb0', 0.32); mesh(SHIP_WING, gh.x, gh.y, gh.z, 1, 0, 0, 0, '#3dffb0', 0.2); P(gh.x, gh.y + 0.9, gh.z); if (OK) tags.push([X, Y - 4, 'BEST', '#2a9a70']); } }
  for (const q of g.parts) { depth(q.x, q.z); if (q.splat) { seg(q.x, q.y, q.z, q.x - q.vx * 0.05, q.y - q.vy * 0.05 + 0.15, q.z - q.vz * 0.05, q.col, Math.min(1, q.life / q.max * 1.6)); seg(q.x - 0.12, q.y, q.z, q.x + 0.12, q.y, q.z, q.col, Math.min(1, q.life / q.max * 1.6)); } else seg(q.x, q.y, q.z, q.x - q.vx * 0.035, q.y - q.vy * 0.035, q.z - q.vz * 0.035, q.col, Math.min(1, q.life / q.max * 1.6)); }
  for (const s of g.shocks) { depth(s.x, s.z); circle(s.x, s.y, s.z, s.r, s.col, s.life / s.max, 16, vB === 3 ? 1 : vB === 0 ? 2 : 0); }
  { const trip = th.trippy ? ((t * 0.8) % 360 / 30 | 0) * 30 : 0; for (let L = 0; L < NL; L++) { if (FILL) drawQuads(ctx, L); flush(ctx, o.glow !== false, trip, L); } depth0(); }
  for (const q of g.pops) { P(q.x, q.y, q.z); if (!OK) continue; text(ctx, q.txt, X, Y, q.big ? 15 : 9, q.col, { align: 'center', alpha: Math.min(1, q.life / 20), glow: q.big }); }
  for (const q of tags) text(ctx, q[2], q[0], q[1], 7, q[3], { align: 'center', glow: false });
  ctx.restore();
  if (g.level.rules?.heat && g.heat > 5) { ctx.fillStyle = '#ff5a1f'; ctx.globalAlpha = Math.min(0.3, g.heat / 100 * 0.3); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (g.flash > 0) { ctx.fillStyle = '#fff'; ctx.globalAlpha = Math.min(0.6, g.flash / 20); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (g.shiftT > 0) { ctx.fillStyle = '#5ee7ff'; ctx.globalAlpha = 0.1 * g.shiftT; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}
const STAGE_COLS = ['#ff3df0', '#2ee6ff', '#ffe14a'];
// the weak spot: a hatched, pulsing target disc facing the camera. Bright gold when it can be hurt, a dim red cross when it is shielded.
function weak(x, y, z, r, open, t) {
  const pl = vB === 3 ? 1 : vB === 0 ? 2 : 0, U = pl === 2 ? [0, 0, 1] : [1, 0, 0], V = pl === 1 ? [0, 0, 1] : [0, 1, 0], pt = (u, v) => [x + U[0] * u + V[0] * v, y + U[1] * u + V[1] * v, z + U[2] * u + V[2] * v], ln = (a, b2, c, d, col, al) => { const p = pt(a, b2), q = pt(c, d); seg(p[0], p[1], p[2], q[0], q[1], q[2], col, al); };
  if (!open) { LW = 2; circle(x, y, z, r, '#ff4d6d', 0.7, 14, pl); ln(-r * 0.6, -r * 0.6, r * 0.6, r * 0.6, '#ff4d6d', 0.7); ln(-r * 0.6, r * 0.6, r * 0.6, -r * 0.6, '#ff4d6d', 0.7); LW = 1; return; }
  const pu = 1 + 0.12 * Math.sin(t * 0.25), R = r * pu; LW = 2.4; circle(x, y, z, R, '#ffe14a', 1, 18, pl); LW = 1.4;
  for (let i = -4; i <= 4; i++) { const v = i / 5 * R, h = Math.sqrt(R * R - v * v); ln(-h, v, h, v, i % 2 ? '#ffffff' : '#ffe14a', 0.85); } // the texture: a hatched disc
  LW = 1; circle(x, y, z, R * (1.5 + 0.25 * Math.sin(t * 0.25)), '#ffffff', 0.6, 18, pl, t * 0.04);
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + t * 0.03, c = Math.cos(a), s = Math.sin(a); LW = 2; ln(c * R * 1.9, s * R * 1.9, c * R * 2.5, s * R * 2.5, '#ffe14a', 1); } LW = 1;
}
function drawBoss(g, b, t) {
  const open = (b.vuln || []).includes(g.view), col = b.hit > 0 ? '#ffffff' : b.col, s = b.dying ? 1 + Math.sin(t) * 0.1 : 1, core = open ? '#ffffff' : '#ff4d6d', L = b.look;
  if (L === 'colossus') { // a colossal alien stone head rising out of the ground, eyes burning, rune stones circling it
    const hs = 3.3 * s, cy = Math.max(hs, b.y - 0.2), eye = open ? '#ffffff' : '#ff4d6d', yaw = Math.max(-0.5, Math.min(0.5, (b.x - g.players[0].x) * 0.07));
    mesh(HEAD, b.x, cy, b.z, hs, yaw, 0, 0, col); mesh(EYES, b.x, cy, b.z, hs, yaw, 0, 0, eye); mesh(EYES, b.x, cy + 0.12, b.z, hs, yaw, 0, 0, eye, 0.6);
    for (const sd of [-1, 1]) { seg(b.x + sd * 0.42 * hs, cy - hs, b.z, b.x + sd * 1.5 * hs, 0, b.z + 1, col, 0.8); seg(b.x + sd * 1.5 * hs, 0, b.z + 1, b.x + sd * 1.5 * hs, 0, b.z - 1.5, col, 0.6); zig(b.x + sd * 0.3 * hs, cy + 0.2 * hs, b.z - 0.56 * hs, b.x + sd * 0.36 * hs, cy - 0.5 * hs - ((t * 0.03) % 1) * hs * 0.4, b.z - 0.52 * hs, '#ff8a2b', 0.8, 4, 0.25, sd + (t >> 3)); }
    seg(b.x - 1.5 * hs, 0, b.z - 1.5, b.x + 1.5 * hs, 0, b.z - 1.5, col, 0.6);
    for (let i = 1; i < 4; i++) { const y = cy - hs + i * hs * 0.5; seg(b.x - 0.5 * hs, y, b.z - 0.5 * hs, b.x - 0.42 * hs, y, b.z + 0.45 * hs, col, 0.35); seg(b.x + 0.5 * hs, y, b.z - 0.5 * hs, b.x + 0.42 * hs, y, b.z + 0.45 * hs, col, 0.35); }
    if (b.st % 200 > 150 || b.deflect > 0) for (let i = 0; i < 3; i++) zig(b.x + (i - 1) * 0.3, cy - 0.62 * hs, b.z - 0.56 * hs, b.x + (i - 1) * 1.2, cy - 0.62 * hs - 0.5, b.z - 0.56 * hs - 2.5, '#ffe14a', 0.9, 4, 0.5, i + (t >> 2));
    for (let i = 0; i < 5; i++) { const a = t * 0.02 + i / 5 * TAU; mesh(ROCK, b.x + Math.cos(a) * 5.2, cy + Math.sin(a * 2 + i) * 1.4, b.z + Math.sin(a) * 2.4, 0.55, a, t * 0.03, 0, i % 2 ? '#c0532a' : '#ff8a2b'); } }
  else if (L === 'eye') { for (let i = 0; i < 4; i++) circle(b.x, b.y, b.z - i * 0.3, (3.3 - i * 0.7) * s, i % 2 ? '#ffffff' : col, 1, 20, 0, t * 0.02 * (i % 2 ? 1 : -1)); mesh(OCT, b.x + (g.players[0].x - b.x) * 0.04, b.y + (g.players[0].y - b.y) * 0.05, b.z - 1.2, 0.9 * s, t * 0.06, 0, 0, core); for (let i = 0; i < 8; i++) { const a = t * 0.015 + i / 8 * TAU; zig(b.x + Math.cos(a) * 3.3, b.y + Math.sin(a) * 3.3, b.z, b.x + Math.cos(a) * 5, b.y + Math.sin(a) * 5, b.z + 1, '#7df9ff', 0.6, 4, 0.6, i + (t >> 2)); } }
  else if (L === 'bloom') { for (let i = 0; i < 3; i++) mesh(ROCK, b.x, b.y, b.z, (2.5 - i * 0.6) * s * (1 + Math.sin(t * 0.08 + i) * 0.08), t * 0.02 * (i + 1), t * 0.013 * (i % 2 ? 1 : -1), 0, i === 1 ? '#3dffb0' : col); mesh(OCT, b.x, b.y, b.z, 0.9 * s, -t * 0.07, t * 0.04, 0, core); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.sin(t * 0.02) * 0.3; let lx = b.x + Math.cos(a) * 2, ly = b.y + Math.sin(a) * 2; for (let j = 1; j <= 5; j++) { const r = 2 + j * 0.8, w = Math.sin(t * 0.06 + i + j * 0.7) * 0.35, px = b.x + Math.cos(a + w) * r, py = b.y + Math.sin(a + w) * r; seg(lx, ly, b.z, px, py, b.z - j * 0.2, j % 2 ? '#ff3df0' : '#b6ff3d'); lx = px; ly = py; } } }
  else { mesh(OCT, b.x, b.y, b.z, 1.3 * s, t * 0.04, t * 0.03, 0, core); mesh(CUBE, b.x, b.y, b.z, 1.9 * s, t * 0.012, t * 0.008, 0, col); mesh(CUBE, b.x, b.y, b.z, 2.5 * s, -t * 0.009, 0, t * 0.011, col, 0.6);
    for (let i = 0; i < 4; i++) { const a = t * 0.02 + i / 4 * TAU, r = 3.6, px = b.x + Math.cos(a) * r, py = b.y + Math.sin(a) * r; mesh(OCT, px, py, b.z, 0.5, a, 0, 0, STAGE_COLS[i % 3]); seg(b.x, b.y, b.z, px, py, b.z, col, 0.3); } seg(b.x - 1.2, 0, b.z, b.x - 0.6, b.y - 2.6, b.z, col, 0.5); seg(b.x + 1.2, 0, b.z, b.x + 0.6, b.y - 2.6, b.z, col, 0.5); }
  if (!b.dying && b.z <= 19.5) { if (L === 'colossus') { const hs = 3.3 * s, cy = Math.max(hs, b.y - 0.2); weak(b.x, cy + 0.31 * hs, b.z - 0.6 * hs, 0.75, open, t); } else if (L === 'eye') weak(b.x, b.y, b.z - 1.3, 1, open, t); else weak(b.x, b.y, b.z - (L === 'bloom' ? 0.4 : 0.2), 1.05, open, t); }
  if (!open || b.deflect > 0) { const n = 6; for (let i = 0; i < n; i++) { const a0 = i / n * TAU + t * 0.01, a1 = (i + 1) / n * TAU + t * 0.01, r = 3.4; seg(b.x + Math.cos(a0) * r, b.y + Math.sin(a0) * r, b.z - 2, b.x + Math.cos(a1) * r, b.y + Math.sin(a1) * r, b.z - 2, '#5ee7ff', b.deflect > 0 ? 1 : 0.4); } }
}

// ---------- HUD ----------
export function drawHUD(ctx, g, o = {}) {
  const p = g.players[0], t = g.tick, vw = g.view, m = MASK[vw]; ctx.globalCompositeOperation = 'source-over';
  text(ctx, 'SCORE', 18, 12, 8, '#7d8bd6', { glow: false }); text(ctx, String(g.score).padStart(8, '0'), 18, 25, 16, '#ffffff'); if (o.hi) text(ctx, 'HI ' + String(o.hi).padStart(8, '0'), 150, 12, 8, '#7d8bd6', { glow: false });
  const mult = 1 + Math.min(9, g.chain / 5 | 0); if (g.chain > 1) { text(ctx, 'CHAIN ' + g.chain + '  X' + mult, 18, 48, 9, '#ffe14a'); ctx.fillStyle = '#ffe14a'; ctx.globalAlpha = 0.8; ctx.fillRect(18, 62, 110 * g.chainT / 190, 2); ctx.globalAlpha = 1; }
  const pw = 78, px0 = W / 2 - pw * 2;
  for (let i = 0; i < 4; i++) { const on = vw === i, rec = g.recView === i && !on && (t >> 3) % 2; ctx.strokeStyle = on ? VCOL[i] : rec ? '#ffe14a' : '#3a4380'; ctx.lineWidth = on || rec ? 2 : 1; ctx.globalAlpha = on || rec ? 1 : 0.7; ctx.strokeRect(px0 + i * pw + 3, 10, pw - 6, 20); if (on || rec) { ctx.fillStyle = on ? VCOL[i] : '#ffe14a'; ctx.globalAlpha = 0.2; ctx.fillRect(px0 + i * pw + 3, 10, pw - 6, 20); } ctx.globalAlpha = 1;
    text(ctx, VIEWS[i], px0 + i * pw + pw / 2, 15, 10, on ? '#ffffff' : rec ? '#ffe14a' : '#5a66b0', { align: 'center', glow: on }); }
  text(ctx, '< L', px0 - 8, 15, 9, '#5a66b0', { align: 'right', glow: false }); text(ctx, 'R >', px0 + pw * 4 + 8, 15, 9, '#5a66b0', { glow: false });
  if (!g.level.bonus) for (let i = 0; i < Math.min(p.lives, 6); i++) { const x = W - 26 - i * 24, y = 22; ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 6, y + 7); ctx.lineTo(x, y + 3); ctx.lineTo(x - 6, y + 7); ctx.closePath(); ctx.strokeStyle = '#2ee6ff'; ctx.lineWidth = 1.5; ctx.stroke(); }
  if (g.level.bonus) text(ctx, 'BONUS STAGE', W - 18, 16, 10, '#b06bff', { align: 'right' });
  if (g.coop) { const q = g.players[1]; text(ctx, q.out ? 'P2 OUT' : 'P2 SHIPS ' + Math.max(0, q.lives), W - 18, 98, 8, '#ffe14a', { align: 'right', glow: false }); }
  if (g.wing) text(ctx, g.wing.dead > 0 ? 'RIVET-9 REBOOTING ' + Math.ceil(g.wing.dead / 60) : 'RIVET-9 WINGMAN', W - 18, 98, 8, g.wing.dead > 0 ? '#7d8bd6' : '#ffb070', { align: 'right', glow: false });
  text(ctx, 'BOMB ' + p.bombs, W - 18, 40, 9, '#ff8a2b', { align: 'right' }); text(ctx, 'DRONES ' + DRONE_MODES[p.dmode], W - 18, 56, 7, '#b06bff', { align: 'right', glow: false });
  // speed gear
  text(ctx, 'SPEED', W - 18, 72, 7, '#7d8bd6', { align: 'right', glow: false }); for (let i = 0; i < 3; i++) { ctx.fillStyle = i <= g.gear ? '#ffe14a' : '#26306e'; ctx.fillRect(W - 100 + i * 14, 72, 11, 6); } text(ctx, GEARS[g.gear], W - 18, 84, 7, '#ffe14a', { align: 'right', glow: false });
  if (p.god > 0) text(ctx, 'GOD MODE ' + Math.ceil(p.god / 60), W / 2, 86, 12, RAINBOW[(t >> 2) % 7], { align: 'center' }); else if (p.over > 0) text(ctx, 'OVERDRIVE ' + Math.ceil(p.over / 60), W / 2, 86, 10, '#ffe14a', { align: 'center' });
  if (g.level.rules?.heat) { const w = 300, x = W / 2 - w / 2, hot = g.heat > 70; text(ctx, hot && (t >> 3) % 2 ? 'OVERHEATING - FIND SHADE' : 'HEAT', W / 2, 40, 8, hot ? '#ff4d6d' : '#ffb02e', { align: 'center', glow: false }); ctx.strokeStyle = '#ffb02e'; ctx.lineWidth = 1; ctx.strokeRect(x, 54, w, 7); ctx.fillStyle = hot ? '#ff4d6d' : '#ffb02e'; ctx.fillRect(x, 54, w * g.heat / 100, 7);
    const cool = g.obs.some(ob => ob.kind === 'shade' && Math.abs(p.z - ob.z) < ob.hz && (!m[0] || Math.abs(p.x - ob.x) < ob.hx) && (!m[1] || Math.abs(p.y - ob.y) < ob.hy)); text(ctx, cool ? 'IN SHADE - COOLING' : 'EXPOSED', W / 2, 68, 9, cool ? '#7df9ff' : (t >> 3) % 2 ? '#ff8a2b' : '#ffe14a', { align: 'center', glow: cool }); }
  const b = g.boss; if (b && b.z <= 19.5 && !b.dying) { const st = g.level.boss.stages[b.stage], w = 360, x = W / 2 - w / 2, n = g.level.boss.stages.length; text(ctx, b.name + ' // ' + st.name, W / 2, 40, 9, st.col, { align: 'center' }); ctx.strokeStyle = st.col; ctx.lineWidth = 1; ctx.strokeRect(x, 54, w, 7); ctx.fillStyle = st.col; ctx.fillRect(x, 54, w * Math.max(0, b.hp) / b.max, 7);
    for (let i = 0; i < n; i++) { ctx.fillStyle = i >= b.stage ? '#ffffff' : '#30345a'; ctx.fillRect(x + w + 8 + i * 9, 54, 6, 7); }
    const open = b.vuln.includes(vw); text(ctx, open ? 'CORE EXPOSED' : 'CORE SHIELDED - SHIFT TO ' + VIEWS[st.rec], W / 2, 68, 8, open ? '#3dffb0' : (t >> 3) % 2 ? '#ff4d6d' : '#ffe14a', { align: 'center', glow: false }); }
  if (g.ar) { text(ctx, g.ar.wave ? 'WAVE ' + g.ar.wave + ' / ' + g.ar.total : 'GET READY', W / 2, 40, 10, '#ffe14a', { align: 'center' }); text(ctx, g.ar.left + ' LEFT' + (g.recView !== vw && g.ar.left ? '   -   SHIFT TO ' + VIEWS[g.recView] : ''), W / 2, 56, 8, g.recView !== vw && g.ar.left ? '#ffffff' : '#9fb0ff', { align: 'center', glow: false }); }
  if (g.hintT > 0 && g.hint) { const a = Math.min(1, g.hintT / 25, ((g.hintMax || 230) - g.hintT) / 8 + 0.3); const sz = Math.min(20, 760 / (g.hint.length * 0.94)); text(ctx, g.hint, W / 2 + 2, 122, sz, '#ff3df0', { align: 'center', alpha: a * 0.5, glow: false }); text(ctx, g.hint, W / 2, 120, sz, '#ffffff', { align: 'center', alpha: a, tube: true }); }
  // altitude bar: where you are, what is blocked just ahead (red), and the way through (green)
  { const x = 14, y0 = 430, hgt = 300, Yp = y => y0 - Math.max(0, Math.min(9.6, y)) / 9.6 * hgt, flat = vw === 3; ctx.globalAlpha = flat ? 0.35 : 1; ctx.strokeStyle = '#3a4cb8'; ctx.lineWidth = 1; ctx.strokeRect(x, y0 - hgt, 8, hgt); text(ctx, 'ALT', x - 2, y0 + 6, 6, '#7d8bd6', { glow: false });
    if (!flat) { let near = 1e9; for (const ob of g.obs) if ((solid(ob, vw) || ob.warm > 0 || ob.soon) && ob.z + ob.hz > p.z + 0.4 && ob.z - ob.hz < p.z + 15 && ob.kind !== 'car' && (!m[0] || Math.abs(ob.x - p.x) < ob.hx + 0.5)) near = Math.min(near, ob.z - ob.hz);
      if (near < 1e9) { ctx.fillStyle = '#ff4d6d'; for (const ob of g.obs) if ((solid(ob, vw) || ob.warm > 0 || ob.soon) && Math.abs(ob.z - ob.hz - near) < 2.5 && ob.kind !== 'car' && (!m[0] || Math.abs(ob.x - p.x) < ob.hx + 0.5)) { const a = Yp(ob.y + ob.hy), bq = Yp(ob.y - ob.hy); ctx.globalAlpha = 0.8; ctx.fillRect(x + 1, a, 6, Math.max(2, bq - a)); } ctx.fillStyle = '#3dffb0'; for (const ob of g.obs) if (ob.kind === 'safe' && Math.abs(ob.z - ob.hz - near) < 2.5) { const a = Yp(ob.y + ob.hy), bq = Yp(ob.y - ob.hy); ctx.globalAlpha = 0.9; ctx.fillRect(x + 1, a, 6, Math.max(2, bq - a)); } ctx.globalAlpha = 1; }
      for (const r of g.rings) if (r.kind === 'warp' && !r.got && r.phase === vw && r.z < 17 && r.y > 0) { ctx.fillStyle = '#b06bff'; ctx.fillRect(x - 3, Yp(r.y) - 1, 14, 3); } }
    const py = Yp(p.y); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x + 22, py - 5); ctx.lineTo(x + 10, py); ctx.lineTo(x + 22, py + 5); ctx.closePath(); ctx.fill(); ctx.fillRect(x - 2, py - 1, 12, 2); ctx.globalAlpha = 1; }
  // upgrade bar
  const n = BAR.length, cw = 100, x0 = W / 2 - cw * n / 2, y0 = H - 34;
  for (let i = 0; i < n; i++) { const on = p.cursor === i, lvl = i === U.SHIELD ? p.shield : p.up[i], full = lvl >= BARMAX[i], x = x0 + i * cw;
    ctx.fillStyle = on ? '#ffe14a' : '#0a0f2c'; ctx.globalAlpha = on ? 0.9 : 0.75; ctx.fillRect(x + 2, y0, cw - 4, 22); ctx.globalAlpha = 1; ctx.strokeStyle = on ? '#ffffff' : full ? '#3dffb0' : '#3a4cb8'; ctx.lineWidth = on ? 2 : 1; ctx.strokeRect(x + 2, y0, cw - 4, 22);
    text(ctx, BAR[i], x + cw / 2, y0 + 5, 9, on ? '#140a2a' : full ? '#3dffb0' : lvl ? '#ffffff' : '#7d8bd6', { align: 'center', glow: false, weight: on ? 2 : 1.3 });
    if (i < 7) for (let k = 0; k < BARMAX[i]; k++) { ctx.fillStyle = k < lvl ? (on ? '#140a2a' : p.god > 0 && i < 6 ? RAINBOW[(k + (t >> 2)) % 7] : '#3dffb0') : (on ? '#b89a20' : p.god > 0 && i < 6 ? '#ffffff' : '#26306e'); ctx.fillRect(x + 8 + k * ((cw - 16) / BARMAX[i]), y0 + 17, (cw - 16) / BARMAX[i] - 2, 2); } }
  if (p.cursor >= 0 && (t >> 4) % 2) text(ctx, (o.upgLabel || 'SELECT') + ' = ' + BAR[p.cursor], W / 2, y0 - 14, 9, '#ffe14a', { align: 'center' });
}

// ---------- screen-space pieces for the splash screens, title and menus ----------
export function meshScreen(ctx, M, cx, cy, s, yaw, pitch, roll, col, glow = true) {
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  ctx.beginPath();
  for (const pl of M) for (let i = 0; i < pl.length; i++) { let [x, y, z] = pl[i]; let t = x * cr - y * sr; y = x * sr + y * cr; x = t; t = y * cp - z * sp; z = y * sp + z * cp; y = t; t = x * cyw + z * syw; z = -x * syw + z * cyw; x = t;
    const d = 5 / (5 + z * 0.6); const X2 = cx + x * s * d, Y2 = cy - y * s * d; if (i) ctx.lineTo(X2, Y2); else ctx.moveTo(X2, Y2); }
  ctx.strokeStyle = col; ctx.lineJoin = 'round'; if (glow) { ctx.globalAlpha = 0.09; ctx.lineWidth = Math.min(22, Math.max(9, s * 0.12)); ctx.stroke(); ctx.globalAlpha = 0.25; ctx.lineWidth = Math.min(12, Math.max(4, s * 0.06)); ctx.stroke(); } ctx.globalAlpha = 1; ctx.lineWidth = Math.min(3, Math.max(1.4, s * 0.02)); ctx.stroke();
}
// the title: a stacked neon sign. 2DISO in cyan tube, SHIFT in italics tearing off to the right, with depth, speed lines and a light sweep
export function drawLogo(ctx, cx, y, sc = 1, t = 0) {
  const s1 = 70 * sc, w1 = textWidth('2DISO', s1), s2 = 70 * sc, w2 = textWidth('SHIFT', s2) + s2 * 0.3, gap = 30 * sc, x = cx - (w1 + gap + w2) / 2, xs = x + w1 + gap, wt = 6 * sc;
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 7; k >= 1; k--) { const a = 0.26 - k * 0.03; text(ctx, '2DISO', x + k * 2.2 * sc, y + k * 2.2 * sc, s1, '#1b2f9a', { weight: wt, alpha: a, glow: false }); text(ctx, 'SHIFT', xs + k * 2.2 * sc, y + k * 2.2 * sc, s2, '#6a1280', { italic: true, weight: wt, alpha: a, glow: false }); }
  ctx.lineCap = 'round'; for (let k = 0; k < 7; k++) { const yy = y + 6 * sc + k * 9.6 * sc, len = (60 + ((k * 37 + t * 140) % 90)) * sc, x0 = xs + (6 - k) * 2.6 * sc; const gr = ctx.createLinearGradient(x0 - len, 0, x0, 0); gr.addColorStop(0, 'rgba(255,61,240,0)'); gr.addColorStop(1, 'rgba(255,61,240,.55)'); ctx.strokeStyle = gr; ctx.lineWidth = 2 * sc; ctx.beginPath(); ctx.moveTo(x0 - len, yy); ctx.lineTo(x0 - 6 * sc, yy); ctx.stroke(); }
  const fl = (Math.sin(t * 31) > 0.96 || Math.sin(t * 7.3) > 0.985) ? 0.55 : 1;
  text(ctx, '2DISO', x - 3 * sc, y, s1, '#ff3df0', { weight: wt, alpha: 0.3, glow: false }); text(ctx, '2DISO', x + 3 * sc, y, s1, '#ffe14a', { weight: wt, alpha: 0.22, glow: false });
  text(ctx, '2DISO', x, y, s1, '#2ee6ff', { weight: wt, core: '#eaffff', tube: true, alpha: fl });
  text(ctx, 'SHIFT', xs - 4 * sc, y, s2, '#2ee6ff', { italic: true, weight: wt, alpha: 0.35, glow: false }); text(ctx, 'SHIFT', xs + 4 * sc, y, s2, '#ffe14a', { italic: true, weight: wt, alpha: 0.22, glow: false });
  text(ctx, 'SHIFT', xs, y, s2, '#ff3df0', { italic: true, weight: wt, core: '#fff0ff', tube: true });
  const sw = ((t * 0.45) % 1.6) * (w1 + gap + w2 + 200 * sc) - 100 * sc; ctx.save(); ctx.beginPath(); ctx.moveTo(x + sw, y - 10); ctx.lineTo(x + sw + 46 * sc, y - 10); ctx.lineTo(x + sw + 16 * sc, y + s1 + 10); ctx.lineTo(x + sw - 30 * sc, y + s1 + 10); ctx.closePath(); ctx.clip(); text(ctx, '2DISO', x, y, s1, '#ffffff', { weight: wt * 1.2, glow: false }); text(ctx, 'SHIFT', xs, y, s2, '#ffffff', { italic: true, weight: wt * 1.2, glow: false }); ctx.restore();
  const uy = y + s1 + 16 * sc, uw = w1 + gap + w2; for (let i = 0; i < 4; i++) { ctx.strokeStyle = VCOL[i]; ctx.lineWidth = 3 * sc; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.moveTo(x + uw * i / 4 + 5 * sc, uy); ctx.lineTo(x + uw * (i + 1) / 4 - 5 * sc, uy); ctx.stroke(); ctx.globalAlpha = 0.2; ctx.lineWidth = 9 * sc; ctx.stroke(); } ctx.globalAlpha = 1;
  const hi = (t * 1.2 | 0) % 4; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * sc; ctx.beginPath(); ctx.moveTo(x + uw * hi / 4 + 5 * sc, uy); ctx.lineTo(x + uw * (hi + 1) / 4 - 5 * sc, uy); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
}
export function drawSplash(ctx, which, a, t) {
  ctx.globalCompositeOperation = 'lighter';
  if (which === 0) { const n = Math.min(7, t * 9 | 0), str = 'GRiDDiM', sz = 64, w = textWidth(str, sz), x = 480 - w / 2;
    for (let i = 0; i < 9; i++) { const gx = 480 - 33 + (i % 3) * 24, gy = 150 + (i / 3 | 0) * 24, on = ((t * 6 | 0) % 9) === i; ctx.strokeStyle = on ? '#ffffff' : i % 2 ? '#ff3df0' : '#2ee6ff'; ctx.lineWidth = 2; ctx.globalAlpha = a * (on ? 1 : 0.7); ctx.strokeRect(gx, gy, 18, 18); ctx.globalAlpha = a * 0.18; ctx.lineWidth = 7; ctx.strokeRect(gx, gy, 18, 18); }
    for (let i = 0; i < n; i++) { const fresh = i === n - 1 && t * 9 % 1 < 0.5 && n < 7; text(ctx, str[i], x + i * sz * (5.6 / 6), 250, sz, fresh ? '#ffffff' : '#2ee6ff', { raw: true, weight: 5.5, alpha: a, tube: true, core: '#eaffff' }); }
    if (t > 0.9) text(ctx, 'N E T W O R K', 480, 338, 11, '#ff3df0', { align: 'center', alpha: a * Math.min(1, (t - 0.9) * 3) }); }
  else { const sz = 54, w = textWidth('ARCADEGRiDZ', sz), x = 480 - w / 2, wa = textWidth('ARCADE', sz) + sz * 0.27;
    text(ctx, 'ARCADE', x, 228, sz, '#ff3df0', { weight: 5, alpha: a, tube: true, core: '#fff0ff' }); text(ctx, 'GRiDZ', x + wa, 228, sz, '#ffe14a', { raw: true, weight: 5, alpha: a, tube: true, core: '#fffbe0' });
    const bx = x - 26, by = 200, bw = w + 52, bh = 112, per = 2 * (bw + bh), nb = 44; for (let i = 0; i < nb; i++) { let d = i / nb * per, px, py; if (d < bw) { px = bx + d; py = by; } else if (d < bw + bh) { px = bx + bw; py = by + d - bw; } else if (d < 2 * bw + bh) { px = bx + bw - (d - bw - bh); py = by + bh; } else { px = bx; py = by + bh - (d - 2 * bw - bh); } const on = (i + (t * 10 | 0)) % 3 === 0; ctx.fillStyle = on ? '#ffffff' : '#2ee6ff'; ctx.globalAlpha = a * (on ? 1 : 0.35); ctx.beginPath(); ctx.arc(px, py, on ? 3 : 2, 0, TAU); ctx.fill(); }
    text(ctx, 'P R E S E N T S', 480, 340, 11, '#ffffff', { align: 'center', alpha: a }); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
export { text, textWidth, RAINBOW, VCOL };
