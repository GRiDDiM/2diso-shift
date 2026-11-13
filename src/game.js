// 2DISO SHIFT — pure simulation. No DOM. Fixed 60 Hz step. Randomness only from the seed.
// World axes: x = left/right, y = altitude, z = forward (relative to the scrolling camera).
// The four views flatten different axes, and what a view flattens does not exist for collisions.
export const VIEWS = ['SIDE', 'ISO', 'CHASE', 'TOP'];
export const MASK = [[0, 1, 1], [1, 1, 1], [1, 1, 1], [1, 0, 1]]; // which of x,y,z count in each view
export const AR = { x: 12.5, z0: 0.8, z1: 33 }; // the bonus arena floor
export const B = { x: 8.2, y0: 0.6, y1: 9.1, z0: 0.5, z1: 26, zb: 20 }; // z1: how far up the screen the ship can fly; zb: the same in a boss or miniboss fight, whose attacks are built for the shorter field
export const BAR = ['DRONE', 'MISSILE', 'LASER', 'WAVE', 'BOLT', 'SPREAD', 'SHIELD', 'BOMB', 'HYPER'];
export const BARMAX = [6, 3, 3, 3, 3, 3, 3, 3, 1];
export const hyperOk = p => p.up[0] >= 6 && p.up[1] >= 3 && p.up[2] >= 3 && p.up[3] >= 3 && p.up[4] >= 3 && p.up[5] >= 3 && p.up[7] >= 3; // HYPERDRIVE opens once drones, every weapon and the bomb are maxed (shields come and go, so they do not count)
const EFF = [0, 2, 4, 5]; // three ranks per weapon: the weak early ranks are skipped, rank 3 is still the full max effect
export const U = { DRONE: 0, MISSILE: 1, LASER: 2, WAVE: 3, BOLT: 4, SPREAD: 5, SHIELD: 6, BOMB: 7, WILD: 8 };
export const TIER = { 5: [, 'TWIN FAN', 'STAR FAN', 'NOVA FAN'], 2: [, 'FOCUS', 'LANCE', 'PRISM'], 3: [, 'WIDE', 'TIDAL', 'TSUNAMI'], 4: [, 'FORK', 'CHAIN', 'STORM'], 1: [, 'SWARM', 'BARRAGE', 'CLUSTER'], 7: [, 'SWEEP BOMB', 'SCATTER BOMB', 'MEGA NUKE'] };
export const DRONE_MODES = ['TRAIL', 'ORBIT', 'WALL', 'HUNT'];
export const GEARS = ['SLOW', 'CRUISE', 'FAST', 'TURBO', 'HYPER'], GEARMUL = [0.58, 0.82, 1.2, 1.7, 2.4];
export const SK = 1 / 1.3; // ships, enemies, shots and pickups are this much smaller than the level they fly through: the camera is in effect 30% further back, with the level built 30% bigger to match
export const SCROLL = 7, DT = 1 / 60, SPAWN_Z = 39, INTRO = 132, INTRO_RUN = 46;

function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function newPlayer(i, s, coop) {
  return { i, x: coop ? (i ? 1.5 : -1.5) : 0, y: 4.5, z: 3, mvx: 0, mvy: 0, ivx: 0, ivy: 0, inv: 120, dead: 0, lives: s?.lives ?? 3, bombs: s?.bombs ?? 3,
    up: BARMAX.map((mx, k) => Math.min(s?.up?.[k] || 0, mx)), shield: s?.shield ?? 1, cursor: s?.cursor ?? -1, drones: [], dmode: s?.dmode ?? 0,
    hist: [], fireT: 0, laserT: 0, waveT: 20, boltT: 40, missT: 30, god: 0, over: 0, prev: {}, ax: 0, az: 1 };
}

export const makeWing = v => ({ x: -1.6, y: 5.2, z: 1.6, view: v ?? 3, from: v ?? 3, st: 0, dir: 1, dead: 0, inv: 0, t: 0 });
export function createGame({ seed = 1, level, start = null, players = 1, wing = false, mut = null } = {}) {
  const z0 = start?.z || 0;
  const g = { seed, rand: rng(seed), tick: 0, camZ: z0 - INTRO_RUN, level, evi: 0, view: 3, viewFrom: 3, shiftT: 0, shiftDir: 1, shiftCd: 0, intro: INTRO, gear: start?.gear ?? 0,
    players: [], enemies: [], shots: [], ebul: [], obs: [], rings: [], pods: [], parts: [], pops: [], beams: [], shocks: [], blasts: [], blastId: 0, warns: [], forceGear: null, fx: [], groups: {},
    score: start?.score || 0, chain: 0, chainT: 0, bestChain: 0, state: 'play', boss: null, hint: null, hintT: 0, zone: null, recView: 0, heat: 0,
    flags: { warp: !!start?.warp || !!mut?.bug, arena: !!start?.arena || !!mut?.bug, warpNow: false } /* bug test runs have no warps to fall into */, stats: Object.assign({ kills: 0, shifts: 0, deaths: 0, hits: 0, perfect: 0, ticks: 0, order: 0 }, start?.stats), coop: players > 1, mut: mut || {}, loop: mut?.loop || 0, perfT: 0,
    wing: wing && players === 1 ? makeWing() : null, shake: 0, flash: 0, endT: 0, speedMul: 3, checkpoint: z0, cpSnap: null };
  for (let i = 0; i < players; i++) { const p = newPlayer(i, start, players > 1); if (i) p.up = g.players[0].up; for (let k = 0; k < p.up[U.DRONE]; k++) p.drones.push({ x: p.x, y: p.y, z: p.z }); g.players.push(p); }
  g.z0 = z0; while (g.evi < level.events.length && level.events[g.evi].z < z0 - 20) g.evi++;
  if (level.rules?.arena) { g.intro = 70; g.camZ = 0; for (const p of g.players) { p.y = 4.5; p.z = 16; p.shield = Math.max(p.shield, 2); } }
  // reality shifts: once or twice a planet the fold flips your view for you, somewhere random in the middle half of the level (never near its start or end, never at a change of view)
  if (!level.bonus && !level.rules?.arena && level.boss && level.len) { const r = rng(seed * 7 + 13), L = level.len, n = 1 + (r() < 0.5 ? 1 : 0), zs = [];
    for (let k = 0; k < n * 6 && zs.length < n; k++) { let z = L * (0.25 + r() * 0.5); if (zs.some(q => Math.abs(q - z) < L * 0.15)) continue; while ((level.zones || []).some(q => Math.abs(q.z0 - z) < 40)) z += 20; if (z < L * 0.75) zs.push(z); }
    g.rs = zs.sort((a, b) => a - b).filter(z => z > z0 + 10); g.rsR = r; g.rsT = 0; }
  g.cpSnap = snapshot(g);
  return g;
}
// what "save and quit" (and a level hand-over) stores: where you are and everything you carry
export function snapshot(g) { const p = g.players[0]; return { level: g.level.id, z: g.checkpoint, score: g.score, lives: Math.max(p.lives, 0), bombs: p.bombs, up: [...p.up], shield: p.shield, cursor: p.cursor, dmode: p.dmode, gear: g.gear, warp: g.flags.warp, arena: g.flags.arena }; }

// ---------- helpers the level scripts use ----------
// loops: every time round the enemy is tougher, shoots faster and more often, and shoots back when it dies
export const LOOP = { hp: [1, 1.7, 2.6, 4], bs: [1, 1.3, 1.6, 1.95], fire: [1, 0.65, 0.45, 0.3], rev: [0, 4, 8, 10], boss: [0, 80, 40, 24], bfan: [0, 3, 5, 7], all: [0, 75, 38, 28], fan: [0, 1, 2, 3], scroll: [1, 1.15, 1.3, 1.5], inv: [90, 70, 50, 30], hunt: [0, 170, 80, 60] }, lp = g => Math.min(3, g.loop || 0);
export function addEnemy(g, e) {
  const o = Object.assign({ type: 'pop', x: 0, y: 4.5, z: SPAWN_Z, vx: 0, vy: 0, vz: -8, hp: 2, r: 0.6, t: 0, col: '#ff3df0', score: 100, x0: e.x ?? 0, y0: e.y ?? 4.5, ax: 0, ay: 0, w: 2, ph: 0, fire: 0, rel: true }, e);
  if (o.type !== 'boss' && o.type !== 'bomb' && !o.mini) { const p = g.players[0], k = p ? p.up[0] * 0.1 + p.up[1] + p.up[2] + p.up[3] + p.up[4] + p.up[5] : 0; o.hp = Math.round(o.hp * Math.min(5.2, 1.6 + 0.24 * k)); } // sturdier, and sturdier still as your guns grow (about 4x by mid-game, 5x at full power), so you see them take the hits
  if (g.loop) { const l = lp(g), h = LOOP.hp[l] + Math.max(0, g.loop - 3); o.hp = Math.round(o.hp * h); if (o.hpMax) o.hpMax = Math.round(o.hpMax * h); if (o.fire) o.fire = Math.max(18, Math.round(o.fire * LOOP.fire[l])); else if (o.type !== 'boss' && o.type !== 'bomb' && o.type !== 'rock' && !o.mini) o.fire = LOOP.all[l]; /* everything shoots */ if (o.fire && LOOP.fan[l]) o.fan = (o.fan || (o.type === 'saucer' ? 3 : 1)) + LOOP.fan[l]; }
  if (o.type !== 'boss' && !o.mini) o.r *= SK;
  o.max = o.hp; if (o.group) { const gr = g.groups[o.group] ||= { n: 0, k: 0, next: -1, ord: true, dead: [] }; o.gi = gr.n++; }
  g.enemies.push(o); return o;
}
// the ground is not flat: levels list hills (a rise, a top, a fall) and this gives the ground height at a spot z ahead of the camera
export function groundAt(g, z) { const hs = g.level.hills; if (!hs) return 0; const wz = z + g.camZ; let y = 0; for (const h of hs) { if (wz <= h[0] || wz >= h[1]) continue; const u = (wz - h[0]) / (h[1] - h[0]), r = Math.min(1, u / 0.3, (1 - u) / 0.3); y = Math.max(y, h[2] * r * r * (3 - 2 * r)); } return y; }
export function addObs(g, o) { const b = Object.assign({ x: 0, y: 4.7, z: SPAWN_Z, hx: 1, hy: 1, hz: 1, vx: 0, vy: 0, vz: 0, rel: false, col: '#2ee6ff', warm: 0, kind: 'box' }, o); b.bx = b.x; b.by = b.y; b.warm0 = b.warm; if (b.hp != null) b.hpMax = b.hp; g.obs.push(b); return b; }
export function addRing(g, r) { const o = Object.assign({ x: 0, y: 4.5, z: SPAWN_Z, r: 1.6, kind: 'bonus', got: false }, r); g.rings.push(o); return o; }
export function addPod(g, x, y, z, kind = 'pod') { g.pods.push({ x: clamp(x, -7, 7), y: clamp(y, 1, 8.5), z, kind, t: 0 }); }
export function bullet(g, x, y, z, vx, vy, vz, col = '#ff8a2b') { if (g.loop) { const s = LOOP.bs[lp(g)]; vx *= s; vy *= s; vz *= s; } if (g.ebul.length < (g.loop ? 360 : 260)) g.ebul.push({ x, y, z, vx, vy, vz, r: 0.28 * SK, col, life: 420 }); }
export const near = (g, e) => { let b = g.players[0], bd = 1e9; for (const p of g.players) if (p.dead <= 0) { const d = Math.hypot(p.x - e.x, p.z - e.z); if (d < bd) { bd = d; b = p; } } return b; };
export function aimed(g, e, speed = 9, spread = 0, col) {
  const p = near(g, e), m = MASK[g.view]; let dx = (p.x - e.x) * m[0], dy = (p.y - e.y) * m[1], dz = p.z - e.z;
  const d = Math.hypot(dx, dy, dz) || 1; dx /= d; dy /= d; dz /= d;
  if (spread) { const c = Math.cos(spread), s = Math.sin(spread); if (m[0]) { const nx = dx * c - dz * s; dz = dx * s + dz * c; dx = nx; } else { const ny = dy * c - dz * s; dz = dy * s + dz * c; dy = ny; } }
  bullet(g, e.x, e.y, e.z, dx * speed, dy * speed, dz * speed, col);
}
export function explode(g, x, y, z, col, n = 14, pow = 9, splat = false) {
  for (let i = 0; i < n && g.parts.length < 800; i++) { const a = g.rand() * 6.283, b = g.rand() * 2 - 1, s = pow * (0.35 + g.rand()), c = Math.sqrt(1 - b * b); g.parts.push({ x, y, z, vx: Math.cos(a) * c * s, vy: b * s, vz: Math.sin(a) * c * s, life: 26 + g.rand() * 30 | 0, max: 56, col, splat }); }
  g.shocks.push({ x, y, z, r: 0.3, vr: pow * 0.9, life: 18, max: 18, col });
}
export function pop(g, txt, x, y, z, col = '#fff', big = false) { g.pops.push({ txt, x, y, z, col, life: big ? 80 : 46, max: big ? 80 : 46, big }); }
export function hint(g, msg, t = 200) { g.hint = msg; g.hintT = t; g.hintMax = t; g.fx.push('hint'); }

function ov(a, b, m, pad = 0) {
  const ax = a.hx ?? a.r, ay = a.hy ?? a.r, az = a.hz ?? a.r, bx = b.hx ?? b.r, by = b.hy ?? b.r, bz = b.hz ?? b.r;
  return (!m[0] || Math.abs(a.x - b.x) < ax + bx + pad) && (!m[1] || Math.abs(a.y - b.y) < ay + by + pad) && Math.abs(a.z - b.z) < az + bz + pad;
}
const live = (o, v) => o.phase == null || o.phase === v;
export const solid = (o, v) => !o.dead && !o.ghost && !o.idle && o.warm <= 0 && live(o, v);
export const lv = (p, i) => i >= 1 && i <= 5 ? (p.god > 0 ? 5 : EFF[Math.min(3, p.up[i])]) : p.up[i];

function addScore(g, base, x, y, z, col) {
  const mult = 1 + Math.min(9, g.chain / 5 | 0); g.score += base * mult;
  if (x != null) pop(g, mult > 1 ? base * mult + ' X' + mult : '' + base, x, y, z, col || '#ffe14a');
}
// where a wave pulse is after travelling d: forward, plus a sine swing that opens up as it leaves the ship
export const WAVECOL = ['#7df9ff', '#b06bff', '#ffe14a'];
export function waveAt(s, d) { const o = Math.sin(d * s.fq + s.ph) * s.amp * Math.min(1, d / 2.5); if (s.dir) return [s.ox + s.dir[0] * d + s.dir[1] * o, s.oy, s.oz + s.dir[1] * d - s.dir[0] * o]; return s.axis === 'x' ? [s.ox + o, s.oy, s.oz + d] : [s.ox, Math.max(0.3, Math.min(9.4, s.oy + o)), s.oz + d]; }
function groupNext(gr, e) { gr.dead[e.gi] = 1; const n = Math.max(gr.n, e.gn || 0); gr.next = -1; for (let k = 1; k <= n; k++) { const i = (e.gi + k) % n; if (!gr.dead[i]) { gr.next = i; break; } } }
function kill(g, e) {
  e.hp = -999; g.stats.kills++; g.chain++; g.chainT = 190; if (g.chain > g.bestChain) g.bestChain = g.chain;
  if (g.chain === 10 || g.chain === 25 || g.chain === 50 || g.chain === 100) { g.fx.push('say:chain ' + g.chain, 'ring'); pop(g, 'CHAIN ' + g.chain + '!', e.x, e.y + 1.5, e.z, '#ffe14a', true); }
  addScore(g, e.score, e.x, e.y, e.z); explode(g, e.x, e.y, e.z, e.col, e.big ? 40 : 16, e.big ? 14 : 9, g.level.theme?.splat); g.fx.push(e.big ? 'boom2' : 'boom'); g.shake = Math.max(g.shake, e.big ? 10 : 3); if (e.big) for (let i = 1; i < 4; i++) g.shocks.push({ x: e.x, y: e.y, z: e.z, r: 0.4, vr: 10 + i * 9, life: 26, max: 26, col: i % 2 ? '#ffffff' : e.col });
  if (e.burst) for (let i = 0; i < e.burst; i++) { const a = i / e.burst * 6.283; bullet(g, e.x, e.y, e.z, Math.cos(a) * 5, Math.sin(a) * 5, -3, e.col); }
  if (e.type === 'rock' && e.size > 1) for (let i = 0; i < 2 + (g.rand() < 0.4); i++) addEnemy(g, { type: 'rock', rel: false, size: e.size - 1, x: e.x, y: e.y, z: e.z, vx: (g.rand() - 0.5) * 6, vy: (g.rand() - 0.5) * 5, vz: (g.rand() - 0.3) * 4, hp: e.size === 3 ? 4 : 2, r: e.size === 3 ? 1 : 0.6, col: e.col, score: 30, shape: 'rock', pod: e.size === 2 && g.rand() < 0.22 });
  if (e.pod) addPod(g, e.x, e.y, e.z);
  if (g.loop && e.type !== 'rock' && e.type !== 'bomb' && e.type !== 'boss' && e.z > 5) { const n = LOOP.rev[lp(g)]; for (let i = 0; i < n; i++) aimed(g, e, 7, (i - (n - 1) / 2) * 0.22, '#ff4d6d'); }
  if (e.group) { const gr = g.groups[e.group]; if (gr.next >= 0 && e.gi !== gr.next) gr.ord = false; groupNext(gr, e); // the first kill starts the order; after that the marked one is next
    if (++gr.k >= gr.n) { addPod(g, e.x, e.y, e.z); if (gr.ord && gr.n > 2) { const b = 300 * gr.n; g.score += b; g.stats.order++; pop(g, 'TARGET ORDER +' + b, e.x, e.y + 1.4, e.z, '#ffe14a'); g.fx.push('ring'); } else pop(g, 'WIPEOUT', e.x, e.y + 1, e.z, '#3dffb0'); } }
  else if (!e.pod && g.rand() < 0.01) addPod(g, e.x, e.y, e.z, 'god');
  else if (!e.pod && g.rand() < 0.02) addPod(g, e.x, e.y, e.z, 'bomb');
  if (e.type !== 'rock' && e.type !== 'bomb' && (g.rand() < 0.004 || g.stats.kills - (g.lifeAt || 0) >= 160)) { g.lifeAt = g.stats.kills; addPod(g, e.x, e.y + 0.6, e.z, 'life'); } /* 1UP: rare, but one is due every 160 kills */
}
export function damage(g, e, d) {
  if (e.hp <= 0) return;
  if (e.type === 'boss' && !(e.vuln || []).includes(g.view)) { if (g.tick % 8 === 0) g.fx.push('ting'); e.deflect = 6; return; }
  if (g.players[0].up[U.WILD]) d *= 1.15; /* hyperdrive */
  e.hp -= d; e.hit = 9; e.hbT = 75; e.dAcc = (e.dAcc || 0) + d; // a health bar while it is being hit, and the damage floats off it in batches
  if (g.tick - (e.dT || -99) >= 10 && g.pops.length < 70) { e.dT = g.tick; const j = ((g.tick * 7) % 11 - 5) * 0.09; pop(g, '' + Math.max(1, Math.round(e.dAcc * 10)), e.x + j, e.y + (e.hy ?? e.r) * 0.6, e.z, '#ffffff'); g.pops[g.pops.length - 1].sm = true; e.dAcc = 0; }
  if (e.hp <= 0) { if (e.type === 'boss') e.hp = 0; else kill(g, e); }
}
function hurt(g, p) {
  if (p.inv > 0 || p.dead > 0) return;
  if (g.mut.bug) { g.stats.bugHits = (g.stats.bugHits || 0) + 1; p.inv = 40; g.fx.push('shield'); g.shake = Math.max(g.shake, 4); return; } // bug test: nothing is lost, the hit is only marked
  g.stats.hits++;
  if (p.shield > 0 && g.loop < 3) { p.shield = g.loop >= 2 ? 0 : p.shield - 1; p.inv = LOOP.inv[lp(g)]; /* loop 3: one hit strips every layer. loop 4: shields do nothing */ g.fx.push('shield'); explode(g, p.x, p.y, p.z, '#5ee7ff', 12, 7); g.shake = 6; return; }
  explode(g, p.x, p.y, p.z, '#ffffff', 46, 15); explode(g, p.x, p.y, p.z, '#ff3df0', 30, 10); g.fx.push('die'); g.shake = 14; g.flash = 10; g.chain = 0; g.stats.deaths++;
  if (g.level.bonus && !g.mut.rush) { p.dead = 1e9; g.state = 'over'; g.endT = 0; return; } // a bonus stage just ends; it never costs a ship (in boss rush it costs one like anywhere else)
  p.lives--; p.dead = 70; if (g.gear) { g.gear = 0; g.apGear = false; } /* back to SLOW, so the next ship is not thrown straight into traffic */
  for (let k = 1; k <= 5; k++) p.up[k] = 0; g.players[0].cursor = -1; for (let k = 0, n = g.boss ? 4 : 2; k < n; k++) addPod(g, (k - (n - 1) / 2) * 2.6, 4.6, 13 + k * 2.5); /* a few pods to start rebuilding with, more in a boss fight */ pop(g, 'WEAPONS LOST', p.x, p.y + 2, p.z + 2, '#ff4d6d', true); // a lost ship takes its weapons with it: drones stay, the guns start over
}
function startGod(g, p) { p.god = 660; g.fx.push('god', 'say:god mode'); pop(g, 'GOD MODE!', p.x, p.y + 1, p.z + 2, '#ffffff', true); while (p.drones.length < 6) p.drones.push({ x: p.x, y: p.y, z: p.z, tmp: true }); }
function buy(g, p) { // in co-op the upgrade bar is the team's: one cursor, one loadout, both ships get the goods
  const o = g.players[0], c = o.cursor; if (c < 0) return;
  const lvl = c === U.SHIELD ? o.shield : o.up[c];
  if (lvl >= BARMAX[c]) { g.fx.push('deny'); pop(g, 'MAXED', p.x, p.y + 1, p.z + 1, '#ff4d6d'); return; }
  if (c === U.WILD && !hyperOk(o)) { g.fx.push('deny'); pop(g, 'LOCKED - MAX EVERYTHING ELSE FIRST', p.x, p.y + 1, p.z + 1, '#ff4d6d'); return; }
  if (c === U.SHIELD) for (const q of g.players) q.shield++;
  else if (c === U.WILD) { o.up[c] = 1; pop(g, 'HYPERDRIVE ONLINE', p.x, p.y + 1, p.z + 2, '#ffffff', true); g.fx.push('say:hyperdrive online', 'god'); g.flash = 10; for (let i = 0; i < 4; i++) g.shocks.push({ x: p.x, y: p.y, z: p.z, r: 0.4, vr: 10 + i * 7, life: 26, max: 26, col: ['#ffffff', '#ffe14a', '#7df9ff', '#ff3df0'][i] }); } // one point, for good: 15% more damage from everything, and it survives losing a ship
  else { o.up[c]++; if (c === U.DRONE) for (const q of g.players) { const t = q.drones.find(d => d.tmp); if (t) t.tmp = false; else if (q.drones.length < 6) q.drones.push({ x: q.x, y: q.y, z: q.z }); } }
  if (c !== U.WILD) { const l = c === U.SHIELD ? o.shield : o.up[c], nm = TIER[c]?.[l]; pop(g, (nm || BAR[c]) + (nm ? '' : ' ' + l), p.x, p.y + 1, p.z + 2, '#3dffb0', true); g.fx.push('say:' + (nm || BAR[c] + (l >= BARMAX[c] ? ' maxed' : ' level ' + l))); }
  o.cursor = -1; g.fx.push('upgrade'); addScore(g, 500, p.x, p.y + 1.6, p.z, '#ffe14a'); // spending a pod always pays, so pods still matter once everything is maxed
}
function bombHit(g, e, d, bd) { if (e.type === 'boss') { if ((e.vuln || []).includes(g.view)) { e.hp = Math.max(0, e.hp - bd * (g.players[0].up[U.WILD] ? 1.15 : 1)); e.hit = 9; e.hbT = 75; } } else damage(g, e, d); }
function blastArea(g, b, test, d, bd) { // everything a blast touches: shots vanish, each enemy and breakable is hit once per blast
  for (const q of g.ebul) if (q.life > 0 && test(q, 0.3)) { q.life = 0; if (g.parts.length < 600) g.parts.push({ x: q.x, y: q.y, z: q.z, vx: 0, vy: 3, vz: 0, life: 8, max: 8, col: '#ffe14a' }); }
  for (let i = 0, n = g.enemies.length; i < n; i++) { const e = g.enemies[i]; if (e.hp > 0 && e.bh !== b.id && e.z < SPAWN_Z + 6 && test(e, e.type === 'boss' ? 3 : e.r || 0.6)) { e.bh = b.id; bombHit(g, e, d, bd); } }
  for (const o of g.obs) if (o.hp && o.bh !== b.id && test(o, Math.max(o.hx, o.hz))) { o.bh = b.id; o.hp -= d; o.hit = o.kind === 'blob' ? 7 : 3; }
}
function nuke(g, p, spend = true) { // the bomb grows with its upgrades: a short burst, a sweeping wall, a scatter of diamonds, then the whole screen
  if (spend) { if (p.bombs <= 0) { g.fx.push('deny'); return; } p.bombs--; }
  const lv = g.players[0].up[U.BOMB] || 0, b = { kind: ['ring', 'sweep', 'scatter', 'mega'][lv], id: ++g.blastId, x: p.x, y: p.y, z: p.z, t: 0, life: [16, 40, 60, 112][lv], n: 0 };
  g.blasts.push(b); p.inv = Math.max(p.inv, lv === 3 ? 170 : 75);
  if (lv === 3) { g.fx.push('charge'); return; }
  for (let i = 0; i < 3; i++) g.shocks.push({ x: p.x, y: p.y, z: p.z, r: 0.5, vr: lv ? 20 + i * 8 : 16 + i * 5, life: 22, max: 22, col: i % 2 ? '#ff8a2b' : '#ffe14a' });
  explode(g, p.x, p.y, p.z + 1, '#ffe14a', lv ? 50 : 30, lv ? 20 : 13); g.flash = lv ? 9 : 6; g.shake = lv ? 13 : 9; g.fx.push('bomb');
}
function blastStep(g, m) {
  for (const b of g.blasts) { b.t++; const f = b.t / b.life;
    if (b.kind === 'ring') { const r = b.r = 7.5 * Math.min(1, b.t / 9); blastArea(g, b, (q, pad) => Math.hypot((q.x - b.x) * m[0], (q.y - b.y) * m[1], q.z - b.z) < r + pad, 25, 40); }
    else if (b.kind === 'sweep') { const e = 1 - (1 - f) * (1 - f); b.hx = 2 + 11 * e; b.hy = 1.5 + 8 * e; b.z0 = b.z - 1.5 - 4 * e; b.z1 = b.z + 2 + 30 * e;
      blastArea(g, b, (q, pad) => Math.abs(q.x - b.x) * m[0] < b.hx + pad && Math.abs(q.y - b.y) * m[1] < b.hy + pad && q.z > b.z0 - pad && q.z < b.z1 + pad, 34, 55);
      if (b.t % 3 === 0) explode(g, b.x + (g.rand() * 2 - 1) * b.hx, b.y + (g.rand() * 2 - 1) * b.hy * m[1], b.z1, b.t % 2 ? '#ff8a2b' : '#ffe14a', 8, 9); }
    else if (b.kind === 'scatter') { if (b.t % 3 === 1 && b.n < 18) { b.n++; let x, y, z; const live = g.enemies.filter(e => e.hp > 0 && e.z < SPAWN_Z && e.z > 0);
        if (b.n % 2 && live.length) { const e = live[g.rand() * live.length | 0]; x = e.x; y = e.y; z = e.z; } else { x = (g.rand() * 2 - 1) * (B.x + 1); y = 1 + g.rand() * (B.y1 - 1.5); z = 2 + g.rand() * (SPAWN_Z - 3); }
        g.blasts.push({ kind: 'dia', id: ++g.blastId, x, y, z, t: 0, life: 20, col: ['#ffe14a', '#ff8a2b', '#ff3df0', '#7df9ff'][b.n % 4] }); explode(g, x, y, z, '#ffe14a', 14, 11); g.shake = Math.max(g.shake, 6); if (b.n % 2) g.fx.push('boom'); } }
    else if (b.kind === 'dia') { const r = b.r = 5 * Math.min(1, b.t / 8); if (b.t <= 12) blastArea(g, b, (q, pad) => Math.abs(q.x - b.x) * m[0] + Math.abs(q.y - b.y) * m[1] + Math.abs(q.z - b.z) < r * 1.3 + pad, 20, 15); }
    else if (b.kind === 'mega') { const C = 36; // a held breath while everything is pulled in, then the lot goes up
      if (b.t < C) { g.shake = Math.max(g.shake, 2 + b.t / 5); for (const q of g.ebul) { q.vx *= 0.9; q.vy *= 0.9; q.vz *= 0.9; } }
      else { if (b.t === C) { blastArea(g, b, () => true, 140, 130); g.flash = 46; g.shake = 34; g.fx.push('mega', 'boom2', 'say:mega nuke'); pop(g, 'MEGA NUKE', b.x, b.y + 2, b.z + 4, '#ffffff', true);
          for (let i = 0; i < 7; i++) g.shocks.push({ x: b.x, y: b.y, z: b.z + 6, r: 0.5, vr: 14 + i * 9, life: 46, max: 46, col: ['#ffffff', '#ffe14a', '#ff8a2b', '#ff3df0', '#7df9ff', '#ffffff', '#ffe14a'][i] }); }
        g.ebul.length = 0; if (b.t < C + 50) { g.shake = Math.max(g.shake, 9); if (b.t % 2 === 0) explode(g, (g.rand() * 2 - 1) * (B.x + 2), 1 + g.rand() * B.y1, 1 + g.rand() * SPAWN_Z, ['#ffe14a', '#ff8a2b', '#ff3df0', '#ffffff'][b.t / 2 % 4 | 0], 18, 14); if (b.t % 6 === 0) g.fx.push('boom'); } } }
  }
  for (let i = g.blasts.length - 1; i >= 0; i--) if (g.blasts[i].t >= g.blasts[i].life) g.blasts.splice(i, 1);
}
function beam(g, x, y, z, w, dmg, col, o = {}) {
  const m = MASK[g.view]; let zEnd = SPAWN_Z + 8; // to the far edge of the field and a bit beyond
  if (o.dx != null && !(o.dx === 0 && o.dz === 1)) { const len = 30, dx = o.dx, dz = o.dz; // aimed beam (arena): a ray in the ground plane
    if (!o.pierce) { let best = null, bt = len, isObs = false; for (const e of g.enemies) { if (e.hp <= 0 || !live(e, g.view)) continue; const ex = e.x - x, ez = e.z - z, t = ex * dx + ez * dz; if (t > 0 && t < bt && Math.abs(ex * dz - ez * dx) < (e.hx ?? e.r) + w) { bt = t; best = e; } }
      for (const b of g.obs) if (solid(b, g.view)) { const ex = b.x - x, ez = b.z - z, t = ex * dx + ez * dz; if (t > 0 && t < bt && Math.abs(ex * dz - ez * dx) < b.hx + w) { bt = t; best = b; isObs = true; } }
      if (best) { if (isObs) { if (best.hp != null) { best.hp -= dmg; best.hit = 2; } } else damage(g, best, dmg); }
      g.beams.push({ x, y, z0: z, z1: z + dz * bt, ex: x + dx * bt, life: o.life || 5, max: o.life || 5, col, w: 0, lw: o.lw || 0 }); return; } // an ordinary beam ends at the first thing in its way
    for (const e of g.enemies) { if (e.hp <= 0 || !live(e, g.view)) continue; const ex = e.x - x, ez = e.z - z, t = ex * dx + ez * dz; if (t < 0 || t > len) continue; if (Math.abs(ex * dz - ez * dx) < (e.hx ?? e.r) + w) { damage(g, e, dmg); if (o.hyper) explode(g, e.x, e.y, e.z, '#ffffff', 8, 9); } }
    for (const b of g.obs) if (b.hp != null && solid(b, g.view)) { const ex = b.x - x, ez = b.z - z, t = ex * dx + ez * dz; if (t > 0 && t < len && Math.abs(ex * dz - ez * dx) < b.hx + w) b.hp -= dmg; }
    if (o.eat) for (const b of g.ebul) { const ex = b.x - x, ez = b.z - z, t = ex * dx + ez * dz; if (t > 0 && t < len && Math.abs(ex * dz - ez * dx) < w + 0.3) b.life = 0; }
    g.beams.push({ x, y, z0: z, z1: z + dz * len, ex: x + dx * len, life: o.life || 5, max: o.life || 5, col, w: o.hyper ? w : 0, lw: o.lw || 0 }); return; }
  if (!o.pierce) { let blk = null; for (const b of g.obs) { if (!solid(b, g.view)) continue; if (b.z - b.hz > z && (!m[0] || Math.abs(b.x - x) < b.hx + w) && (!m[1] || Math.abs(b.y - y) < b.hy + w) && b.z - b.hz < zEnd) { zEnd = b.z - b.hz; blk = b; } } if (blk && blk.hp != null) { blk.hp -= dmg; blk.hit = 2; } }
  else for (const b of g.obs) if (b.hp != null && solid(b, g.view) && b.z > z && (!m[0] || Math.abs(b.x - x) < b.hx + w) && (!m[1] || Math.abs(b.y - y) < b.hy + w)) b.hp -= dmg;
  if (!o.pierce) { let best = null; for (const e of g.enemies) { if (e.hp <= 0 || !live(e, g.view) || e.z < z || e.z - (e.hz ?? e.r) > zEnd) continue; if ((!m[0] || Math.abs(e.x - x) < (e.hx ?? e.r) + w) && (!m[1] || Math.abs(e.y - y) < (e.hy ?? e.r) + w) && (!best || e.z < best.z)) best = e; }
    if (best) { damage(g, best, dmg); zEnd = Math.min(zEnd, Math.max(z + 0.5, best.z)); } } // stops at the nearest enemy
  else for (const e of g.enemies) { if (e.hp <= 0 || !live(e, g.view) || e.z < z || e.z > zEnd + 1) continue; if ((!m[0] || Math.abs(e.x - x) < (e.hx ?? e.r) + w) && (!m[1] || Math.abs(e.y - y) < (e.hy ?? e.r) + w)) { damage(g, e, dmg); if (o.hyper) explode(g, e.x, e.y, e.z, '#ffffff', 8, 9); } }
  if (o.eat) for (const b of g.ebul) if (b.z > z && (!m[0] || Math.abs(b.x - x) < w + 0.3) && (!m[1] || Math.abs(b.y - y) < w + 0.3)) b.life = 0;
  g.beams.push({ x, y, z0: z, z1: zEnd, life: o.life || 5, max: o.life || 5, col, w: o.hyper ? w : 0, lw: o.lw || 0 });
}
function fire(g, p) { // everything is fired relative to where the ship points: f = forward, r = right (straight ahead outside the arena)
  const v = g.view, sp = lv(p, U.SPREAD), od = p.over > 0 || p.god > 0, fx = p.ax, fz = p.az, rx = fz, rz = -fx, side = v === 0 && !g.level.rules?.arena;
  const rank = sp >= 5 ? 3 : sp >= 4 ? 2 : sp >= 2 ? 1 : 0, dmg = rank ? 2.3 : 3.4; // SPREAD upgrades the main gun: 1 bullet, then 3 ahead, then 3 ahead + 1 behind, then 3 ahead + 3 behind. Nothing passes through what it hits
  const S = (dir, a) => { if (g.shots.length < 420) g.shots.push({ x: p.x + fx * 0.62 * dir, y: p.y, z: p.z + fz * 0.62 * dir, vx: fx * 40 * dir + (side ? 0 : rx * a), vy: side ? a : 0, vz: fz * 40 * dir + (side ? 0 : rz * a), dmg, r: 0.3 * SK, kind: 0, life: 60 }); };
  S(1, 0); if (rank >= 1) { S(1, 6.5); S(1, -6.5); } if (rank >= 2) S(-1, 0); if (rank >= 3) { S(-1, 6.5); S(-1, -6.5); }
  p.fireT = (10 - rank) * (od ? 0.6 : 1) | 0; g.fx.push('shot');
}

export function step(g, inputs) {
  g.fx.length = 0; g.tick++;
  if (g.hintT > 0) g.hintT--; if (g.shake > 0) g.shake *= 0.86; if (g.flash > 0) g.flash--; if (g.perfFx > 0) g.perfFx--;
  if (g.shiftT > 0) g.shiftT = Math.max(0, g.shiftT - 1 / 15); if (g.shiftCd > 0) g.shiftCd--;
  if (g.chainT > 0 && --g.chainT === 0) g.chain = 0; if (g.perfT > 0) g.perfT--;
  const lvd = g.level, rules = lvd.rules || {}, P = g.players; const pull = g.pull; g.pull = null;
  const playing = g.state === 'play';
  // launch: hyperspace in, rolling through every view, then hand over in SIDE
  if (g.intro > 0) {
    g.intro--; const k = INTRO - g.intro; if (rules.arena) { g.speedMul = 1; for (const p of P) { p.inv = Math.max(p.inv, 100); p.prev = inputs[p.i] || {}; } if (g.intro === 0) g.fx.push('go'); return g; }
    if (k === 33 || k === 66 || k === 99) { g.viewFrom = g.view; g.view = g.view - 1; g.shiftT = 1; g.shiftDir = -1; g.fx.push('shift'); }
    g.camZ += INTRO_RUN / INTRO; g.speedMul = 1 + 2 * g.intro / INTRO; for (const p of P) { p.inv = Math.max(p.inv, 100); p.prev = inputs[p.i] || {}; }
    for (const q of g.parts) q.life--; if (g.intro === 0) { g.speedMul = GEARMUL[g.gear]; g.fx.push('go'); } if (g.wing) wingStep(g, DT, false); return g;
  }
  const dt = DT * (g.boss?.dying ? 0.3 : g.shiftT > 0 ? 0.4 : 1); if (g.state === 'play' && !g.boss?.dying) g.stats.ticks++; // the world slows while you roll, so there is time to line up

  { const zt = g.boss || g.mini ? B.zb : B.z1; g.zLim = (g.zLim ?? zt) + (zt - (g.zLim ?? zt)) * 0.04; }
  // ----- players: shift, move, shoot -----
  if (playing) for (const p of P) {
    const inp = inputs[p.i] || {}, pv = p.prev, edge = k => inp[k] && !pv[k];
    if (p.dead > 0) { if (--p.dead === 0) { if (p.lives < 0) { p.dead = 1e9; p.out = true; if (P.every(q => q.out)) { g.state = 'over'; g.endT = 0; g.fx.push('over', 'say:game over'); } } else { p.x = g.coop ? (p.i ? 1.5 : -1.5) : 0; p.y = 4.5; p.z = rules.arena ? 16 : 3; p.inv = 190; } } p.prev = inp; continue; }
    const dir = edge('shiftR') ? 1 : edge('shiftL') ? -1 : 0;
    if (dir && g.shiftCd <= 0 && !g.lockShift) doShift(g, rules.arena ? (g.view === 3 ? 1 : 3) : (g.recView - g.view + 4) % 4 === 2 ? g.recView : (g.view + dir + 4) % 4, dir, p); // when the view you need is two rolls away, one press goes straight to it
    if (edge('upgrade')) buy(g, p);
    if (edge('bomb')) nuke(g, p);
    if (edge('drone')) { p.dmode = (p.dmode + 1) % 4; pop(g, 'DRONES: ' + DRONE_MODES[p.dmode], p.x, p.y + 1, p.z, '#b06bff'); g.fx.push('blip'); }
    if (edge('gear') && g.forceGear == null) { g.gear = (g.gear + 1) % GEARS.length; const up = g.gear > 0; pop(g, (up ? 'SHIFTING UP - ' : 'SHIFTING DOWN - ') + GEARS[g.gear], p.x, p.y + 1.2, p.z + 2, up ? '#ffe14a' : '#5ee7ff', true); g.fx.push('gear', up ? 'say:shifting up' : 'say:shifting down'); }
    const sp = (8.5 + g.gear * 1.2) * DT, mx = clamp(inp.mx || 0, -1, 1), my = clamp(inp.my || 0, -1, 1), v = g.view, ox = p.x, oy = p.y;
    let ax = mx, ay = my; if (rules.inertia) { p.ivx += (mx - p.ivx) * 0.045; p.ivy += (my - p.ivy) * 0.045; ax = p.ivx; ay = p.ivy; }
    if (rules.arena) { // free flight over a fixed arena; the guns fire the way the ship is facing, and it faces the way it moves
      p.x = clamp(p.x + ax * sp, -AR.x, AR.x); p.z = clamp(p.z - ay * sp, AR.z0, AR.z1); p.y = 4.5;
      let tx = p.ax, tz = p.az; p.manual = false; if (inp.aim && Math.hypot(inp.aim[0], inp.aim[1]) > 0.3) { const d = Math.hypot(inp.aim[0], inp.aim[1]); tx = inp.aim[0] / d; tz = inp.aim[1] / d; p.manual = true; } else if (Math.hypot(mx, my) > 0.25) { const d = Math.hypot(mx, my); tx = mx / d; tz = -my / d; }
      { const k = p.manual ? 0.6 : 0.4; p.ax += (tx - p.ax) * k; p.az += (tz - p.az) * k; } const n = Math.hypot(p.ax, p.az) || 1; p.ax /= n; p.az /= n; }
    else { if (v === 0) { p.z += ax * sp; p.y -= ay * sp; } else if (v === 3) { p.x += ax * sp; p.z -= ay * sp; } else { p.x += ax * sp; p.y -= ay * sp; }
      if (rules.wind) { const w = rules.wind(g); p.x += w[0] * DT; p.y += w[1] * DT; } if (pull) { p.x += pull[0] * DT; p.y += pull[1] * DT; p.z += pull[2] * DT; }
      p.x = clamp(p.x, -B.x, B.x); p.y = clamp(p.y, B.y0 + (rules.arena ? 0 : groundAt(g, p.z)), B.y1); p.z = clamp(p.z, B.z0, g.zLim); } /* the ship rides up over hills */
    p.mvx += (clamp((p.x - ox) / sp, -1, 1) - p.mvx) * 0.22; p.mvy += (clamp((p.y - oy) / sp, -1, 1) - p.mvy) * 0.22; // the ship banks when it slides sideways and noses up or down when it climbs or dives
    p.hist.push(p.x, p.y, p.z); if (p.hist.length > 3 * 80) p.hist.splice(0, 3);
    if (p.inv > 0) p.inv--; if (p.over > 0) p.over--;
    if (p.god > 0) { p.god--; p.inv = Math.max(p.inv, 2); if (p.god === 0) { p.drones = p.drones.filter(d => !d.tmp); p.inv = 90; pop(g, 'GOD MODE OVER', p.x, p.y + 1, p.z, '#9fb0ff'); } }
    // weapons: everything starts slow and speeds up with its own level
    const firing = inp.fire, od = p.over > 0 || p.god > 0; if (p.fireT > 0) p.fireT--;
    if (firing && p.fireT <= 0) fire(g, p);
    if (p.god > 0 && p.god % 16 === 0) { beam(g, p.x + p.ax, p.y, p.z + p.az, 1.9, 20, '#ffffff', { pierce: true, eat: true, hyper: true, life: 11, dx: p.ax, dz: p.az }); g.fx.push('hyper'); g.shake = Math.max(g.shake, 6); explode(g, p.x + p.ax * 1.6, p.y, p.z + p.az * 1.6, '#ffffff', 12, 9); for (let i = 1; i < 4; i++) g.shocks.push({ x: p.x + p.ax * i * 6, y: p.y, z: p.z + p.az * i * 6, r: 0.6, vr: 12, life: 14, max: 14, col: i % 2 ? '#ffffff' : '#ffe14a' }); }
    const L = lv(p, U.LASER);
    if (L && firing && --p.laserT <= 0) { p.laserT = (11 - L) * (od ? 0.6 : 1) | 0; const r = L >= 5 ? 3 : L >= 4 ? 2 : 1; beam(g, p.x + p.ax * SK, p.y, p.z + p.az * SK, (0.3 + 0.28 * r) * SK, [2.4, 4.8, 7.5][r - 1], '#3dffb0', { dx: p.ax, dz: p.az, lw: r }); if (g.tick % 12 < 6) g.fx.push('laser'); } // one beam: each rank makes it thicker and harder-hitting
    const Wv = lv(p, U.WAVE);
    if (Wv && firing && --p.waveT <= 0) { p.waveT = od ? 3 : 5; const rk = Wv >= 5 ? 2 : Wv >= 3 ? 1 : 0; // one wave: a stream of pulses riding a sine. Each rank winds the frequency tighter, swings it wider and hits harder
      g.shots.push({ kind: 3, x: p.x, y: p.y, z: p.z + 1, ox: p.x, oy: p.y, oz: p.z + 1, vx: 0, vy: 0, vz: 22, amp: [1.1, 1.7, 2.3][rk], fq: [0.55, 0.85, 1.2][rk], rk, ph: -g.tick * 0.07, t: 0, d: 0, dmg: [0.2, 0.38, 0.62][rk], r: [0.55, 0.65, 0.78][rk] * SK, life: 110, axis: v === 0 ? 'y' : 'x', dir: rules.arena ? [p.ax, p.az] : null }); if ((p.waveN = (p.waveN || 0) + 1) % 4 === 1) g.fx.push('wave'); }
    const Bo = lv(p, U.BOLT);
    if (Bo && firing && --p.boltT <= 0) { p.boltT = (Bo >= 5 ? 26 : Bo >= 4 ? 40 : 64) * (od ? 0.6 : 1) | 0; const n = 1; for (let k = 0; k < n; k++) g.shots.push({ kind: 4, x: p.x, y: p.y, z: p.z + 1, vx: 0, vy: 0, vz: 0, t: 0, ph: g.rand() * 6.283 + k * 2.1, own: p.i, dmg: 5 + 3 * Bo, chain: 0, r: 0.5 * SK, life: 150, trail: [] }); g.fx.push('bolt'); }
    const M = lv(p, U.MISSILE);
    if (M && firing && --p.missT <= 0) { p.missT = (od ? 0.6 : 1) * (104 - 10 * M) | 0; const rear = M >= 4 ? 2 : 0; for (let k = 0; k < 2 + rear && g.shots.length < 420; k++) { const back = k >= 2, j = back ? k - 2 : k, nn = back ? rear : 2, a = (j - (nn - 1) / 2) * 0.55, fw = back ? -7 : 6, hug = !rules.arena, dr = j % 2 ? -1 : 1, sideways = v === 3; g.shots.push({ x: p.x, y: p.y, z: p.z, hug, vx: hug ? (sideways ? dr * 13 : 0) : p.az * Math.sin(a) * 9 + p.ax * fw, vy: hug ? (sideways ? 0 : dr * 13) : 0, vz: hug ? (back ? -6 - (j >> 1) * 5 : 5) : -p.ax * Math.sin(a) * 9 + p.az * fw, dmg: 9 + 3 * M, r: 0.4 * SK, kind: 2, life: 150, aoe: 1.4 + 0.4 * M, split: M >= 5 }); } g.fx.push('missile'); }
    // drones
    const n = p.drones.length, vw = g.view;
    for (let k = 0; k < n; k++) {
      const d = p.drones[k]; let tx = p.x, ty = p.y, tz = p.z;
      if (p.dmode === 0) { const i = p.hist.length - 3 * (k + 1) * 9; if (i >= 0) { tx = p.hist[i]; ty = p.hist[i + 1]; tz = p.hist[i + 2]; } }
      else if (p.dmode === 1) { const a = g.tick * 0.06 + k * 6.283 / n, c = Math.cos(a) * 1.35, s = Math.sin(a) * 1.35; if (vw === 0) { ty += c; tz += s; } else if (vw === 3) { tx += c; tz += s; } else { tx += c; ty += s; } }
      else if (p.dmode === 2) { const o = ((k + 2) >> 1) * 1.05 * (k % 2 ? 1 : -1); tz += 1.3; if (vw === 0) ty += o; else tx += o; }
      else { let best = null, bd = 1e9; for (const e of g.enemies) { if (e.hp <= 0 || e.z > 34 || e.z < 0) continue; const dd = Math.hypot(e.x - d.x, e.y - d.y, e.z - d.z); if (dd < bd) { bd = dd; best = e; } } if (best) { tx = best.x; ty = best.y; tz = Math.max(p.z, best.z - 4); } else { tx += (k - n / 2) * 1.2; tz += 1; } }
      if (rules.arena) ty = 4.5; d.x += (tx - d.x) * 0.16; d.y += (clamp(ty, 0.4, 9) - d.y) * 0.16; d.z += (tz - d.z) * 0.16;
      if (firing && (g.tick + k * 4) % (od ? 9 : 17) === 0 && g.shots.length < 420) g.shots.push({ x: d.x, y: d.y, z: d.z + 0.3, vx: p.ax * 40, vy: 0, vz: p.az * 40, dmg: 0.6, r: 0.25 * SK, kind: 1, life: 50 });
      if (firing && L >= 2 && (g.tick + k * 5) % 16 === 0) beam(g, d.x, d.y, d.z + 0.3, 0.2, 0.2 * L, '#b06bff', { dx: p.ax, dz: p.az });
      if (p.dmode === 1) for (const b of g.ebul) if (Math.abs(b.x - d.x) < 0.6 && Math.abs(b.y - d.y) < 0.6 && Math.abs(b.z - d.z) < 0.6) b.life = 0;
    }
    p.prev = inp;
  }
  if (g.wing) wingStep(g, dt, playing);
  if (g.forceGear != null) g.gear = g.forceGear; for (const w of g.warns) w.t--; if (g.warns.length) g.warns = g.warns.filter(w => w.t > 0); // a forced speed (the hyper run) and the flashing wave warnings

  // ----- scroll + level script -----
  g.speedMul += (GEARMUL[g.gear] * (g.mut.turbo ? 1.25 : 1) * LOOP.scroll[lp(g)] * (g.overLava ? 0.6 : 1) - g.speedMul) * 0.06;
  const dz = rules.arena ? 0 : playing ? SCROLL * g.speedMul * dt : SCROLL * 0.4 * dt;
  if (playing) {
    g.camZ += dz;
    if (g.rs?.length && !g.boss && g.intro <= 0 && g.camZ >= g.rs[0]) { g.rs.shift(); g.rsT = 55; hint(g, 'REALITY SHIFT!', 70); g.fx.push('charge'); }
    if (g.rsT > 0 && --g.rsT === 0) { doShift(g, (g.view + 1 + (g.rsR() * 3 | 0)) % 4, 1, null); g.flash = 6; g.shake = Math.max(g.shake, 6); } // the fold rolls you into some other view: roll back yourself
    if (!g.boss) while (g.evi < lvd.events.length && lvd.events[g.evi].z <= g.camZ) { const e = lvd.events[g.evi++]; if ((e.lim ?? e.z) >= g.z0 - 0.01) e.fn(g); }
    const zn = lvd.zones.find(z => g.camZ + 32 >= z.z0 && g.camZ + 32 < z.z1);
    if (zn && zn !== g.zone) { g.zone = zn; if (zn.msg) hint(g, zn.msg, 260); }
    if (!g.boss && g.zone) g.recView = g.zone.view;
    for (const c of lvd.checkpoints) if (g.camZ >= c && c > g.checkpoint) { g.checkpoint = c; g.cpSnap = snapshot(g); g.fx.push('blip', 'toast:CHECKPOINT|PROGRESS SAVED'); }
    if (g.loop && g.boss && g.boss.hp > 0 && !g.boss.dying && g.boss.z < 30 && g.state === 'play' && g.tick % LOOP.boss[lp(g)] === 0) { const n = LOOP.bfan[lp(g)]; for (let i = 0; i < n; i++) aimed(g, g.boss, 7, (i - (n - 1) / 2) * 0.2, '#ff4d6d'); g.fx.push('eshot'); }
    if (g.loop && g.state === 'play' && g.intro <= 0 && !rules.arena && g.tick % LOOP.hunt[lp(g)] === 0) addEnemy(g, { type: 'kami', col: '#ff4d6d', hp: 2, r: 0.55, score: 150, vz: -11 - 2 * lp(g), shape: 'kami', x: (g.rand() * 2 - 1) * 7, y: 1.5 + g.rand() * 6.5 }); // hunters dive at you all level long // on later loops the bosses shoot at you as well
    if (lvd.endZ && g.camZ >= lvd.endZ && !g.boss && !(g.mini && g.mini.hp > 0)) { g.state = 'clear'; g.endT = 0; g.score += lvd.endBonus || 0; g.fx.push('clear', 'toast:BONUS COMPLETE|+' + (lvd.endBonus || 0)); }
    if (!rules.heat) { const p = P[0]; let over = false; for (const o of g.obs) if (o.kind === 'lava' && Math.abs(p.z - o.z) < o.hz) { over = true; break; } // lava underfoot cooks the hull and drags the ship: shift up, or dash forward, to get across
      if (over && !g.overLava) { pop(g, 'LAVA - SPEED UP', p.x, p.y + 1.3, p.z + 2, '#ff8a2b', true); g.fx.push('gear'); } g.overLava = over; g.heat = clamp((g.heat || 0) + (over ? 0.46 : -0.4), 0, 100);
      if (g.heat >= 100 && p.dead <= 0) { g.heat = 45; g.cause = 'lava'; hurt(g, p); pop(g, 'OVERHEAT', p.x, p.y + 1, p.z, '#ff4d6d', true); } }
    if (rules.heat && g.camZ > 26 && !g.mini && !g.mut.rush) { /* no cooking during the miniboss: there is no shade left by then */ const p = P[0], m = MASK[g.view]; let shade = false; for (const o of g.obs) if (o.kind === 'shade' && ov({ x: p.x, y: p.y, z: p.z, r: 0.1 }, o, m)) { shade = true; break; }
      g.heat = clamp(g.heat + (shade ? -1.2 : 0.42), 0, 100); if (g.heat >= 100 && p.dead <= 0) { g.heat = 45; hurt(g, p); pop(g, 'OVERHEAT', p.x, p.y + 1, p.z, '#ff4d6d', true); } }
    if (lvd.tick) lvd.tick(g);
  }
  const vw = g.view, m = MASK[vw];

  // ----- enemies -----
  for (const e of g.enemies) {
    e.t++; if (e.hit > 0) e.hit--; if (e.hbT > 0) e.hbT--; if (e.deflect > 0) e.deflect--;
    if (e.type === 'boss') { lvd.boss.update(g, e, dt); continue; }
    if (!e.rel) e.z -= dz;
    if ((e.type === 'walker' || e.type === 'turret') && e.y0 < 4 && g.level.hills) e.y = e.y0 + groundAt(g, e.z); // ground troops stand on the slope
    if (e.type === 'walker') { e.x += e.vx * dt; if (Math.abs(e.x) > 7.2) { e.vx = -e.vx; e.x = clamp(e.x, -7.2, 7.2); } } // things that walk or drive along the floor or the ceiling
    else if (e.type === 'pop') { e.z += e.vz * dt; e.x = e.x0 + e.ax * Math.sin(e.t * 0.02 * e.w + e.ph); e.y = e.y0 + e.ay * Math.sin(e.t * 0.02 * e.w + e.ph + (e.ax ? 1.57 : 0)); if (e.zig) e.x = e.x0 + e.ax * (Math.abs(((e.t * 0.02 * e.w + e.ph) % 2) - 1) * 2 - 1); }
    else if (e.type === 'saucer') { if (e.t < e.dur) { e.z += (e.hold - e.z) * 0.03; e.x = e.x0 + e.ax * Math.sin(e.t * 0.025 + e.ph); e.y = e.y0 + e.ay * Math.sin(e.t * 0.031 + e.ph); } else { e.z -= 14 * dt; } }
    else if (e.type === 'kami') { const p = near(g, e), s = 4.6 * dt; e.z += e.vz * dt; if (e.z > p.z) { e.x += clamp(p.x - e.x, -s, s) * m[0]; e.y += clamp(p.y - e.y, -s, s) * m[1]; } }
    else if (e.type === 'seek') { const p = near(g, e), dx = p.x - e.x, dzz = p.z - e.z, d = Math.hypot(dx, dzz) || 1, sp = (e.sp || 4) * dt, wv = Math.sin(e.t * 0.07 + e.ph) * (e.wob || 0) * dt; if (d > (e.keep || 0)) { e.x += dx / d * sp - dzz / d * wv; e.z += dzz / d * sp + dx / d * wv; } else { e.x += -dzz / d * sp * 0.6; e.z += dx / d * sp * 0.6; } e.y = 4.5; }
    else if (e.type === 'bomb') { e.vy -= 7 * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt; if (e.y < 0.3) { explode(g, e.x, 0.3, e.z, e.col, 12, 7); e.hp = -999; g.fx.push('boom'); } }
    else if (e.type === 'rock') { e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt; if (Math.abs(e.x) > 8) e.vx *= -1; if (e.y < 0.8 || e.y > 9) e.vy *= -1; }
    if (playing && e.fire && e.z > 4 && e.z < 27 && e.y > 0 && (e.haunt || live(e, vw)) && (e.t + e.ph * 10 | 0) % e.fire === e.fire - 1) { if (e.lob) { const p = near(g, e), T = 1.5; addEnemy(g, { type: 'bomb', rel: false, x: e.x, y: e.y + 1, z: e.z, vx: (p.x - e.x) / T * m[0], vy: 7 + g.rand() * 2, vz: (p.z + 1 - e.z) / T + SCROLL * g.speedMul, hp: 1, r: 0.5, col: '#ff8a2b', score: 50, shape: 'bomb' }); g.fx.push('missile'); } else { const n = e.fan || (e.type === 'saucer' ? 3 : 1); for (let i = 0; i < n; i++) aimed(g, e, e.bs || 9, (i - (n - 1) / 2) * 0.22, e.bcol); g.fx.push('eshot'); } }
    if (e.z < -4 && e.hp > 0) { e.hp = -999; if (e.group) { const gr = g.groups[e.group]; gr.ord = false; if (gr.next === e.gi) groupNext(gr, e); else gr.dead[e.gi] = 1; gr.n = 1e9; } }
  }
  // ----- shots -----
  for (const s of g.shots) {
    if (s.kind === 3) { s.t++; s.d += s.vz * dt; const w = waveAt(s, s.d); s.x = w[0]; s.y = w[1]; s.z = w[2]; if (s.t % 4 === 0 && g.parts.length < 500) g.parts.push({ x: s.x, y: s.y, z: s.z, vx: (g.rand() - 0.5) * 2, vy: (g.rand() - 0.5) * 2, vz: 3, life: 10, max: 10, col: WAVECOL[s.rk] }); if (--s.life <= 0 || s.z > 44 || s.z < -4 || Math.abs(s.x) > 13) { s.life = 0; continue; }
      for (const e of g.enemies) if (e.hp > 0 && live(e, vw) && ov(s, e, m)) damage(g, e, s.dmg); for (const o2 of g.obs) if (o2.hp != null && solid(o2, vw) && ov(s, o2, m)) { o2.hp -= s.dmg; o2.hit = 2; } for (const b of g.ebul) if (Math.abs(b.z - s.z) < 0.8 && ov(s, b, m)) b.life = 0; continue; }
    if (s.kind === 4) { s.t++; s.trail.push(s.x, s.y, s.z); if (s.trail.length > 210) s.trail.splice(0, 3); const p = P[s.own || 0];
      if (s.t < 52) { const a = s.t * 0.19 + s.ph, R = 2 + s.t * 0.09; const tx = clamp(p.x + Math.cos(a) * R * 1.3, -7.5, 7.5), ty = clamp(p.y + Math.sin(a * 1.3) * R * 0.7, 0.6, 9), tz = p.z + 2 + s.t * 0.16 + Math.sin(a * 0.7) * 2; s.x += (tx - s.x) * 0.3; s.y += (ty - s.y) * 0.3; s.z += (tz - s.z) * 0.3; }
      else { let best = null, bd = 1e9; for (const e of g.enemies) { if (e.hp <= 0 || !live(e, vw) || e.z > 40 || e.z < 0 || e === s.skip) continue; const d = Math.hypot(e.x - s.x, e.y - s.y, e.z - s.z) - (e.type === 'boss' ? 6 : 0); if (d < bd) { bd = d; best = e; } }
        if (best) { const d = Math.hypot(best.x - s.x, best.y - s.y, best.z - s.z) || 1, sp = 46 * dt; if (d < sp + (best.hx ?? best.r)) { damage(g, best, s.dmg); explode(g, best.x, best.y, best.z, '#7df9ff', 8, 8); g.fx.push('zap'); if (s.chain > 0) { s.chain--; s.dmg *= 0.7; s.skip = best; s.x = best.x; s.y = best.y; s.z = best.z; } else s.life = 0; } else { s.x += (best.x - s.x) / d * sp; s.y += (best.y - s.y) / d * sp; s.z += (best.z - s.z) / d * sp; } }
        else { s.z += 30 * dt; if (s.z > 34) s.life = 0; } }
      if (s.t >= 52) for (const o2 of g.obs) if (solid(o2, vw) && ov(s, o2, m)) { s.life = 1; if (o2.hp != null) { o2.hp -= s.dmg; o2.hit = 3; } break; }
      if (--s.life <= 0) s.life = 0; continue; }
    if (s.kind === 2 && s.hug) { // not a homing missile: it drops (or climbs) to the nearest surface and runs along it
      if (!s.on) { if (s.y <= 0.55 || s.y >= 9.15 || Math.abs(s.x) >= 8.4) { s.on = 1; s.y = clamp(s.y, 0.55, 9.15); s.x = clamp(s.x, -8.4, 8.4); s.vx = 0; s.vy = 0; s.vz = 5; } } else s.vz = Math.min(26, s.vz + 1.1);
      if (g.tick % 5 === 0 && g.parts.length < 500) g.parts.push({ x: s.x, y: s.y, z: s.z, vx: (g.rand() - 0.5) * 1.5, vy: (g.rand() - 0.5) * 1.5, vz: -4, life: 9, max: 9, col: g.tick % 4 ? '#ff8a2b' : '#ffe14a' }); }
    else if (s.kind === 2) { let best = null, bd = 1e9; for (const e of g.enemies) { if (e.hp <= 0 || !live(e, vw) || e.z > 40) continue; const d = Math.hypot((e.x - s.x) * m[0], (e.y - s.y) * m[1], e.z - s.z); if (d < bd) { bd = d; best = e; } }
      if (best) { const d = bd || 1, a = 2.2; s.vx += (best.x - s.x) / d * a * m[0]; s.vy += (best.y - s.y) / d * a * m[1]; s.vz += (best.z - s.z) / d * a; } else s.vz += 1.2; const sp = Math.hypot(s.vx, s.vy, s.vz), mx = 30; if (sp > mx) { s.vx *= mx / sp; s.vy *= mx / sp; s.vz *= mx / sp; }
      if (g.tick % 5 === 0 && g.parts.length < 500) g.parts.push({ x: s.x, y: s.y, z: s.z, vx: (g.rand() - 0.5) * 1.5, vy: (g.rand() - 0.5) * 1.5, vz: -4, life: 9, max: 9, col: g.tick % 4 ? '#ff8a2b' : '#ffe14a' }); }
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; if (--s.life <= 0 || s.z > 46 || s.z < -3 || Math.abs(s.x) > 13 || s.y < -1 || s.y > 12) { s.life = 0; continue; }
    for (const e of g.enemies) { if (e.hp <= 0 || !live(e, vw) || e === s.last) continue; if (ov(s, e, m)) { damage(g, e, s.dmg); if (s.pierce > 0) { s.pierce--; s.last = e; } else s.life = 0;
      if (s.aoe) { explode(g, s.x, s.y, s.z, '#ff8a2b', 16, 9); explode(g, s.x, s.y, s.z, '#ffe14a', 8, 5); g.fx.push('boom'); g.shake = Math.max(g.shake, 2); for (const q of g.enemies) if (q !== e && q.hp > 0 && Math.hypot(q.x - s.x, q.y - s.y, q.z - s.z) < s.aoe + q.r) damage(g, q, s.dmg * 0.5); if (s.split) for (let i = 0; i < 3; i++) g.shots.push({ x: s.x, y: s.y, z: s.z, vx: Math.cos(i * 2.1) * 12, vy: Math.sin(i * 2.1) * 12, vz: 4, dmg: 3, r: 0.35, kind: 2, life: 60, aoe: 1.2 }); }
      else if (g.parts.length < 800) g.parts.push({ x: s.x, y: s.y, z: s.z, vx: 0, vy: 3, vz: -6, life: 8, max: 8, col: '#ffffff' }); break; } }
    if (s.life > 0) for (const o of g.obs) { if (!solid(o, vw)) continue; if (ov(s, o, m)) { s.life = 0; if (o.hp != null) { o.hp -= s.dmg; o.hit = o.kind === 'blob' ? 7 : 3; } if (g.parts.length < 800) g.parts.push({ x: s.x, y: s.y, z: s.z, vx: 0, vy: 2, vz: -8, life: 7, max: 7, col: o.col }); break; } }
  }
  // ----- obstacles -----
  for (const o of g.obs) {
    if (!o.rel) o.z -= o.par ? dz * (1 - o.par) : dz; /* gas clouds drift at half the scroll, so the deck slides past behind them */ o.bx += o.vx * dt; o.by += o.vy * dt; o.z += o.vz * dt; if (o.hit > 0) o.hit--;
    if (o.wrap && Math.abs(o.bx) > o.wrap) o.bx = -Math.sign(o.bx) * o.wrap;
    if (o.osc) { const a = g.tick * 0.02 * o.osc.w + o.osc.ph; o.x = o.bx + o.osc.ax * Math.sin(a); o.y = o.by + o.osc.ay * Math.sin(a); } else { o.x = o.bx; o.y = o.by; }
    if (o.drop != null && !o.dead) { if (o.z < o.drop) o.vy -= 0.3; if (o.by - o.hy <= 0.05) { o.dead = true; explode(g, o.x, 0.6, o.z, o.col, 14, 8); g.fx.push('boom'); g.shake = Math.max(g.shake, 3); } } // a rock in the cave roof lets go as you get near and smashes on the floor
    if (o.pulse) { const c = (g.tick + o.pulse[2]) % (o.pulse[0] + o.pulse[1]); o.idle = c >= o.pulse[0]; o.soon = o.idle && c > o.pulse[0] + o.pulse[1] - 45; if (!o.idle && c === 0 && o.z > 0 && o.z < 28) g.fx.push('zap'); }
    if (o.warm > 0) { if (--o.warm === 0) g.fx.push('zap'); } else if (o.life != null && --o.life <= 0) o.dead = true;
    if (o.hp != null && o.hp <= 0 && !o.dead) { o.dead = true; explode(g, clamp(o.x, -7, 7), clamp(o.y, 1, 8.5), o.z, o.col, o.kind === 'blob' ? 46 : 18, o.kind === 'blob' ? 13 : 9, o.kind === 'blob'); if (o.kind === 'blob') { g.shake = Math.max(g.shake, 7); g.fx.push('boom2'); } g.chain++; g.chainT = 190; addScore(g, o.score || 50, o.x, o.y, o.z); g.fx.push('boom'); if (o.pod) addPod(g, o.x, o.y, o.z); if (o.gem) addPod(g, o.x, o.y, o.z, 'gem'); }
    if (o.z + o.hz < -5) o.dead = true;
  }
  // ----- enemy bullets -----
  for (const b of g.ebul) { b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; if (--b.life <= 0 || b.z < -3 || b.z > 46 || Math.abs(b.x) > (rules.arena ? 15 : 12) || b.y < -1 || b.y > 11) b.life = 0; }
  // ----- pods + rings -----
  if (g.blasts.length) blastStep(g, m);
  for (const q of g.pods) { q.t++; q.z -= dz * 0.75; if (q.z < -3) q.dead = true; for (const p of P) { if (p.dead > 0) continue; const dx = (p.x - q.x) * m[0], dy = (p.y - q.y) * m[1], dzz = p.z - q.z, d = Math.hypot(dx, dy, dzz); if (d < 5) { q.x += dx / (d + 0.01) * 9 * dt; q.y += dy / (d + 0.01) * 9 * dt; q.z += dzz / (d + 0.01) * 9 * dt; }
    if (d < 1.2 && !q.dead) { q.dead = true; if (q.kind === 'pod') { const o = P[0]; let c = o.cursor; for (let k = 0; k < BAR.length; k++) { c = (c + 1) % BAR.length; if ((c === U.SHIELD ? o.shield : o.up[c]) < BARMAX[c] && (c !== U.WILD || hyperOk(o))) break; } o.cursor = c; /* maxed slots are skipped */ g.fx.push('pod'); addScore(g, 50); } else if (q.kind === 'god') startGod(g, p); else if (q.kind === 'bomb') { p.bombs = Math.min(9, p.bombs + 1); pop(g, '+BOMB', p.x, p.y + 1, p.z, '#ff8a2b'); g.fx.push('pod'); } else if (q.kind === 'life') { if (p.lives < 9) { p.lives++; pop(g, '1UP!', p.x, p.y + 1.2, p.z, '#3dffb0', true); } else { g.score += 5000; pop(g, '+5000', p.x, p.y + 1.2, p.z, '#3dffb0', true); } g.fx.push('pod', 'ring', 'say:extra ship'); g.shocks.push({ x: p.x, y: p.y, z: p.z, r: 0.4, vr: 14, life: 24, max: 24, col: '#b06bff' }); } else if (q.kind === 'gem') { g.chain++; g.chainT = 190; addScore(g, 200, q.x, q.y, q.z, '#7df9ff'); g.fx.push('ring'); } } } }
  for (const r of g.rings) { if (r.stay) { // a warp: fades in, hangs in front of you for a while, fades out. Only CHASE view lines you up with it
      r.t++; if (r.until != null && g.camZ > r.until && r.life - r.t > 90) r.t = r.life - 90; /* fade out before a chase stretch */ if (r.t > r.life) r.dead = true; if (!r.got && vw === 2 && r.t > 45 && playing) for (const p of P) if (p.dead <= 0 && Math.hypot(p.x - r.x, p.y - r.y) < r.r * 1.15) { r.got = true; r.dead = true; if (r.to) { g.flags.arena = true; g.flags.warpTo = r.to; } else g.flags.warp = true; g.flags.warpNow = true; g.score += 5000; pop(g, 'WARP!', p.x, p.y + 1.5, p.z + 3, '#b06bff', true); g.fx.push('warp', 'say:warp found', r.to ? 'toast:ARENA WARP FOUND|' + (lvd.arenaName || 'BONUS ARENA') : 'toast:WARP FOUND|' + (lvd.warpName || '')); g.flash = 16; explode(g, r.x, r.y, p.z, '#b06bff', 60, 16); p.inv = 240; break; } continue; }
    const pz = r.z; r.z -= dz; if (r.z < -4) r.dead = true; if (r.got) continue; for (const p of P) { if (p.dead > 0) continue; if (pz >= p.z && r.z < p.z && live(r, vw) && Math.hypot((p.x - r.x) * m[0], (p.y - r.y) * m[1]) < r.r) { r.got = true;
    if (r.kind === 'warp') { g.flags.warp = true; g.flags.warpNow = true; g.score += 5000; pop(g, 'WARP!', p.x, p.y + 1.5, p.z + 3, '#b06bff', true); g.fx.push('warp', 'say:warp found', 'toast:WARP FOUND|' + (lvd.warpName || '')); g.flash = 16; explode(g, r.x, r.y, p.z, '#b06bff', 60, 16); p.inv = 240; }
    else { g.chain += 2; g.chainT = 190; addScore(g, 300, r.x, r.y, p.z, '#3dffb0'); g.fx.push('ring'); } } } }

  // ----- player collisions -----
  if (playing) for (const p of P) {
    if (p.dead > 0) continue; const pb = { x: p.x, y: p.y, z: p.z + 0.08, hx: 0.21 * SK, hy: 0.18 * SK, hz: 0.32 * SK }; // the hull only: wing tips and the tail do not count
    for (const b of g.ebul) if (b.life > 0 && ov(pb, b, m, -0.08)) { b.life = 0; g.cause = 'bullet'; hurt(g, p); }
    for (const e of g.enemies) if (e.hp > 0 && live(e, vw) && e.y > 0 && ov(pb, e, m, -0.1)) { if (p.god > 0) { if (e.type !== 'boss') damage(g, e, 50); } else { if (e.type !== 'boss') damage(g, e, 3); g.cause = e.shape || e.type; hurt(g, p); } }
    for (const o of g.obs) if (solid(o, vw) && ov(pb, o, m, -0.05)) { if (p.god > 0 && o.hp != null) o.hp = 0; else if (p.god <= 0) { g.cause = o.kind; hurt(g, p); } }
  }
  // ----- effects + cleanup -----
  for (const q of g.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt - dz * 0.5; q.vx *= 0.96; q.vy *= 0.96; q.vz *= 0.96; if (q.splat) q.vy -= 9 * dt; q.life--; }
  for (const s of g.shocks) { s.r += s.vr * dt; s.life--; }
  for (const b of g.beams) b.life--;
  for (const q of g.pops) { q.y += 1.2 * dt; q.life--; }
  const keep = (a, f) => { let j = 0; for (let i = 0; i < a.length; i++) if (f(a[i])) a[j++] = a[i]; a.length = j; };
  keep(g.enemies, e => e.hp > 0 || e.type === 'boss' && !e.gone); keep(g.shots, s => s.life > 0); keep(g.ebul, b => b.life > 0); keep(g.obs, o => !o.dead);
  keep(g.pods, q => !q.dead); keep(g.rings, r => !r.dead); keep(g.parts, q => q.life > 0); keep(g.shocks, s => s.life > 0); keep(g.beams, b => b.life > 0); keep(g.pops, q => q.life > 0);
  if (g.state !== 'play') g.endT++;
  return g;
}
// RIVET-9, the assist wingman. He holds formation, rolls when you roll, fires a light gun, and reboots a few seconds after a hit.
function wingStep(g, dt, playing) {
  const w = g.wing, p = g.players[0], v = g.view, m = MASK[v], arena = g.level.rules?.arena; w.t++;
  w.view = g.view;
  if (w.dead > 0) { if (--w.dead === 0) { w.x = p.x; w.y = p.y; w.z = Math.max(0.6, p.z - 2); w.inv = 150; g.fx.push('blip'); } return; }
  if (w.inv > 0) w.inv--;
  let tx = p.x - 1.35, ty = p.y + 0.65, tz = p.z - 1; if (arena) { tx = p.x - p.az * 1.35 - p.ax * 0.95; ty = 4.5; tz = p.z + p.ax * 1.35 - p.az * 0.95; } else if (v === 0) { tx = p.x; ty = p.y + 1.05; tz = p.z - 1.2; }
  ty += Math.sin(w.t * 0.05) * 0.15; w.x += (clamp(tx, -8, 8) - w.x) * 0.09; w.y += (clamp(ty, 0.7, 9) - w.y) * 0.09; w.z += (Math.max(0.5, tz) - w.z) * 0.09;
  if (!playing || p.dead > 0) return;
  if (w.t % 13 === 0 && g.shots.length < 420) { g.shots.push({ x: w.x, y: w.y, z: w.z + 0.5, vx: p.ax * 40, vy: 0, vz: p.az * 40, dmg: 0.8, r: 0.28 * SK, kind: 1, life: 55 }); }
  if (w.inv > 0) return; const wb = { x: w.x, y: w.y, z: w.z, hx: 0.3 * SK, hy: 0.22 * SK, hz: 0.5 * SK }; let hit = false;
  for (const b of g.ebul) if (b.life > 0 && ov(wb, b, m, -0.08)) { b.life = 0; hit = true; break; }
  if (!hit) for (const e of g.enemies) if (e.hp > 0 && e.type !== 'boss' && live(e, v) && e.y > 0 && ov(wb, e, m, -0.1)) { damage(g, e, 3); hit = true; break; }
  if (hit) { w.dead = 210; explode(g, w.x, w.y, w.z, '#ffb070', 22, 9); g.fx.push('boom'); pop(g, 'R9 REBOOTING', w.x, w.y + 1, w.z, '#ffb070'); }
}
export function doShift(g, to, dir, p) {
  // PERFECT SHIFT: roll out of the way of something that was about to hit you and the fold bites back
  let perfect = false; if (p && g.perfT <= 0 && p.inv <= 0) { const mo = MASK[g.view], mn = MASK[to];
    for (const b of g.ebul) if (Math.hypot((b.x - p.x) * mo[0], (b.y - p.y) * mo[1], b.z - p.z) < 1.5) { perfect = true; break; }
    const inWay = (o, m, zp) => (!m[0] || Math.abs(o.x - p.x) < o.hx + 0.3) && (!m[1] || Math.abs(o.y - p.y) < o.hy + 0.22) && Math.abs(o.z - p.z) < o.hz + 0.5 + zp;
    if (!perfect) for (const o of g.obs) { const zp = o.rel ? 2.5 : 2.8 * g.speedMul; if (solid(o, g.view) && inWay(o, mo, zp) && !(solid(o, to) && inWay(o, mn, zp))) { perfect = true; break; } }
    if (!perfect) for (const e of g.enemies) if (e.hp > 0 && e.type !== 'boss' && live(e, g.view) && Math.hypot((e.x - p.x) * mo[0], (e.y - p.y) * mo[1], e.z - p.z) < e.r + 1.3) { perfect = true; break; } }
  g.viewFrom = g.view; g.view = to; g.shiftT = 1; g.shiftDir = dir; g.shiftCd = 10; g.stats.shifts++; g.fx.push('shift');
  let n = 0; for (const q of g.players) { q.inv = Math.max(q.inv, 32); for (const b of g.ebul) if (Math.hypot(b.x - q.x, b.y - q.y, b.z - q.z) < 3.4) { b.life = 0; n++; explode(g, b.x, b.y, b.z, '#5ee7ff', 3, 4); } g.shocks.push({ x: q.x, y: q.y, z: q.z, r: 0.4, vr: 14, life: 14, max: 14, col: '#5ee7ff' }); }
  if (n && p) { g.chain += n; g.chainT = 190; addScore(g, 50 * n, p.x, p.y + 1, p.z, '#5ee7ff'); if (!perfect) pop(g, 'PHASE DODGE', p.x, p.y + 1.8, p.z, '#5ee7ff'); }
  if (perfect) { g.perfT = 90; g.stats.perfect++; g.chain += 3; g.chainT = 190; addScore(g, 500, p.x, p.y + 1, p.z, '#ffffff'); pop(g, 'PERFECT SHIFT!', p.x, p.y + 2, p.z + 1, '#ffffff', true); g.fx.push('perfect', 'say:perfect shift'); g.flash = Math.max(g.flash, 6); g.perfFx = 24;
    p.over = Math.max(p.over, 180); p.inv = Math.max(p.inv, 50);
    for (const e of g.enemies) if (e.hp > 0 && e.z < 30 && Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z) < (e.type === 'boss' ? 18 : 9)) damage(g, e, e.type === 'boss' ? 25 : 8);
    for (let i = 0; i < 4; i++) g.shocks.push({ x: p.x, y: p.y, z: p.z, r: 0.4, vr: 12 + i * 8, life: 22, max: 22, col: ['#ffffff', '#2ee6ff', '#ff3df0', '#ffe14a'][i] }); }
}

// ---------- autopilot (idle mode + attract demo + headless tests) ----------
const TAU = [0, 0.12, 0.25, 0.4, 0.6, 0.85, 1.15, 1.5, 1.9, 2.4];
export function autopilot(g, i = 0) {
  const p = g.players[i], out = { fire: true, mx: 0, my: 0 }; if (!p || p.dead > 0 || g.intro > 0) return out;
  const want = g.recView, pv = p.prev || {};
  if (g.view !== want && g.shiftCd <= 0 && !g.lockShift) { const d = (want - g.view + 4) % 4; if (d === 3 && !g.level.rules?.arena) out.shiftL = !pv.shiftL; else out.shiftR = !pv.shiftR; }
  const v = g.view, m = MASK[v], rules = g.level.rules || {}, sc = rules.arena ? 0 : SCROLL * g.speedMul;
  const arena = !!rules.arena; let A = v === 0 ? 'z' : 'x', Bx = v === 3 ? 'z' : 'y'; if (arena) { A = 'x'; Bx = 'z'; }
  const ra = A === 'z' ? [1, 2.5, 4, 5.5, 7, 9] : arena ? [-11, -8.25, -5.5, -2.75, 0, 2.75, 5.5, 8.25, 11] : [-7, -5.25, -3.5, -1.75, 0, 1.75, 3.5, 5.25, 7], rb = arena ? [2, 5.5, 9, 12.5, 16, 19.5, 23, 26.5, 30] : Bx === 'z' ? [1, 2.5, 4, 5.5, 7, 9] : [1, 2.1, 3.2, 4.3, 5.4, 6.5, 7.6, 8.5];
  const spd = (8.5 + g.gear * 1.2) * (rules.inertia ? 0.6 : 1);
  let best = null, bc = 1e9; const c = { x: p.x, y: p.y, z: p.z, hx: 0.6, hy: 0.48, hz: 0.72 }, t = { x: 0, y: 0, z: 0, hx: 0, hy: 0, hz: 0 };
  let tgt = null, td = 1e9; for (const e of g.enemies) if (e.hp > 0 && live(e, v) && e.z > p.z + 2 && e.z < 34) { const d = e.z + (e.type === 'boss' ? -50 : 0); if (d < td) { td = d; tgt = e; } }
  let pod = null; for (const q of g.pods) if (q.z > p.z - 1 && q.z < 16) { pod = q; break; }
  let shade = null; if (rules.heat) { let bd = 1e9; for (const o of g.obs) if (o.kind === 'shade' && o.z + o.hz > p.z + 1.5) { const d = o.z; if (d < bd) { bd = d; shade = o; } } }
  for (const a of ra) for (const b of rb) {
    c.x = p.x; c.y = p.y; c.z = p.z; c[A] = a; c[Bx] = b;
    const dist = Math.hypot(c[A] - p[A], c[Bx] - p[Bx]); let cost = dist * 0.5;
    for (const tau of TAU) {
      { const da = a - p[A], db = b - p[Bx], mv = spd * tau; c[A] = p[A] + clamp(da, -mv, mv); c[Bx] = p[Bx] + clamp(db, -mv, mv); }
      const w = 1 / (tau + 0.2);
      for (const o of g.obs) { if (o.ghost || o.dead || !live(o, v) || o.warm > tau * 60 + 6) continue; if (o.life != null && o.warm <= 0 && o.life < tau * 60) continue; if (o.pulse) { const cc = (g.tick + tau * 60 + o.pulse[2]) % (o.pulse[0] + o.pulse[1]); if (cc >= o.pulse[0] + 4 && cc < o.pulse[0] + o.pulse[1] - 6) continue; }
        t.x = o.x + o.vx * tau; t.y = o.y + o.vy * tau; t.z = o.z + (o.vz - (o.rel ? 0 : sc)) * tau; t.hx = o.hx; t.hy = o.hy; t.hz = o.hz; if (o.wrap && Math.abs(t.x) > o.wrap) t.x -= Math.sign(t.x) * o.wrap * 2; if (ov(c, t, m)) cost += 60 * w; }
      if (tau < 1.2) { for (const bl of g.ebul) { t.x = bl.x + bl.vx * tau; t.y = bl.y + bl.vy * tau; t.z = bl.z + bl.vz * tau; t.hx = t.hy = t.hz = 0.3; if (ov(c, t, m)) cost += 30 * w; }
        for (const e of g.enemies) { if (e.hp <= 0 || !live(e, v) || e.y <= 0 || (tau > 0.45 && e.type !== 'boss' && e.hp <= 3)) continue; t.x = e.x + (e.vx || 0) * tau * (e.type === 'rock' || e.type === 'bomb' ? 1 : 0); t.y = e.y; t.z = e.z + (e.type === 'boss' ? 0 : ((e.vz || 0) - (e.rel ? 0 : sc)) * tau); t.hx = e.hx ?? e.r; t.hy = e.hy ?? e.r; t.hz = e.hz ?? e.r; if (ov(c, t, m)) cost += 40 * w; } }
    }
    c[A] = a; c[Bx] = b;
    if (arena) { for (const e of g.enemies) if (e.hp > 0 && live(e, v)) cost += 14 / (Math.hypot(e.x - c.x, e.z - c.z) + 0.6); cost += (Math.abs(c.x) + Math.abs(c.z - 11.5)) * 0.25; }
    else if (shade) cost += (Math.abs(c.x - shade.x) > shade.hx - 0.6 ? 40 * m[0] : 0) + (Math.abs(c.y - shade.y) > shade.hy - 0.5 ? 40 * m[1] : 0) + (Math.abs(c.x - shade.x) * m[0] + Math.abs(c.y - shade.y) * m[1]) * 1.5;
    else if (pod) cost += Math.hypot((c.x - pod.x) * m[0], (c.y - pod.y) * m[1], c.z - pod.z) * 0.25;
    else if (tgt) cost += (Math.abs((c.x - tgt.x) * m[0]) + Math.abs((c.y - tgt.y) * m[1])) * 0.3 + (A === 'z' || Bx === 'z' ? Math.abs(c.z - 3) * 0.2 : 0);
    else cost += Math.abs(c.x) * 0.1 * m[0] + Math.abs(c.y - 4.5) * 0.1 * m[1] + Math.abs(c.z - 3) * 0.15;
    if (p.ap && p.ap.v === v && p.ap.a === a && p.ap.b === b) cost -= 10;
    if (cost < bc) { bc = cost; best = { a, b }; }
  }
  if (best) { p.ap = { v, a: best.a, b: best.b }; const da = best.a - p[A], db = best.b - p[Bx]; out.mx = Math.abs(da) > 0.15 ? Math.sign(da) : 0; out.my = -(Math.abs(db) > 0.15 ? Math.sign(db) : 0); }
  if (bc > 150 && p.bombs > 0 && !pv.bomb && p.inv <= 0) out.bomb = true;
  const cu = p.cursor; if (cu >= 0 && !pv.upgrade) { const lo = Math.min(p.up[1], p.up[2], p.up[3], p.up[4], p.up[5]); if (cu === 8 && hyperOk(p) || cu === 7 && lo >= 2 && p.up[7] < 3 || cu === 0 && p.up[0] <= lo * 2 + 1 && p.up[0] < 6 || cu >= 1 && cu <= 5 && p.up[cu] <= lo && p.up[cu] < 3 || cu === 6 && p.shield < 2) out.upgrade = true; }
  if (arena) { let bd = 1e9, be = null; for (const e of g.enemies) if (e.hp > 0 && live(e, v)) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; be = e; } } if (be) out.aim = [be.x - p.x, be.z - p.z]; } // the autopilot points its guns by hand, like a right stick
  if (g.tick % 8 === 0) { if (g.overLava && g.gear < 3) { out.gear = true; g.apGear = true; } else if (!g.overLava && g.apGear) { if (g.gear !== 0) out.gear = true; else g.apGear = false; } } // idle mode shifts up through lava and back down after
  return out;
}
