// 2DISO SHIFT — pure simulation. No DOM. Fixed 60 Hz step. Randomness only from the seed.
// World axes: x = left/right, y = altitude, z = forward (relative to the scrolling camera).
// The four views flatten different axes, and what a view flattens does not exist for collisions.
export const VIEWS = ['SIDE', 'ISO', 'CHASE', 'TOP'];
export const MASK = [[0, 1, 1], [1, 1, 1], [1, 1, 1], [1, 0, 1]]; // which of x,y,z count in each view
export const B = { x: 7.5, y0: 0.6, y1: 8.8, z0: 0.5, z1: 12 };
export const BAR = ['DRONE', 'SPREAD', 'LASER', 'WAVE', 'BOLT', 'MISSILE', 'SHIELD', '???'];
export const BARMAX = [5, 5, 5, 5, 5, 5, 3, 99];
export const U = { DRONE: 0, SPREAD: 1, LASER: 2, WAVE: 3, BOLT: 4, MISSILE: 5, SHIELD: 6, WILD: 7 };
export const TIER = { 1: [, , 'TWIN FAN', 'TRI FAN', 'STAR FAN', 'NOVA FAN'], 2: [, , 'FOCUS', 'TRIDENT', 'LANCE', 'PRISM'], 3: [, , 'WIDE', 'HELIX', 'TIDAL', 'TSUNAMI'], 4: [, , 'FORK', 'TWIN SNAKE', 'CHAIN', 'STORM'], 5: [, , 'SWARM', 'BLAST', 'BARRAGE', 'CLUSTER'] };
export const DRONE_MODES = ['TRAIL', 'ORBIT', 'WALL', 'HUNT'];
export const GEARS = ['SLOW', 'CRUISE', 'FAST'], GEARMUL = [0.7, 1, 1.7];
export const SCROLL = 7, DT = 1 / 60, SPAWN_Z = 30, INTRO = 132, INTRO_RUN = 46;

function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function newPlayer(i, s, coop) {
  return { i, x: coop ? (i ? 1.5 : -1.5) : 0, y: 4.5, z: 3, mvx: 0, mvy: 0, ivx: 0, ivy: 0, inv: 120, dead: 0, lives: s?.lives ?? 3, bombs: s?.bombs ?? 3,
    up: s?.up ? [...s.up] : [0, 0, 0, 0, 0, 0, 0, 0], shield: s?.shield ?? 1, cursor: s?.cursor ?? -1, drones: [], dmode: s?.dmode ?? 0,
    hist: [], fireT: 0, laserT: 0, waveT: 20, boltT: 40, missT: 30, god: 0, over: 0, prev: {}, ax: 0, az: 1 };
}

export const makeWing = v => ({ x: -1.6, y: 5.2, z: 1.6, view: v ?? 3, from: v ?? 3, st: 0, dir: 1, dead: 0, inv: 0, t: 0 });
export function createGame({ seed = 1, level, start = null, players = 1, wing = false, mut = null } = {}) {
  const z0 = start?.z || 0;
  const g = { seed, rand: rng(seed), tick: 0, camZ: z0 - INTRO_RUN, level, evi: 0, view: 3, viewFrom: 3, shiftT: 0, shiftDir: 1, shiftCd: 0, intro: INTRO, gear: start?.gear ?? 0,
    players: [], enemies: [], shots: [], ebul: [], obs: [], rings: [], pods: [], parts: [], pops: [], beams: [], shocks: [], fx: [], groups: {},
    score: start?.score || 0, chain: 0, chainT: 0, bestChain: 0, state: 'play', boss: null, hint: null, hintT: 0, zone: null, recView: 0, heat: 0,
    flags: { warp: !!start?.warp, warpNow: false }, stats: Object.assign({ kills: 0, shifts: 0, deaths: 0, hits: 0, perfect: 0 }, start?.stats), coop: players > 1, mut: mut || {}, perfT: 0,
    wing: wing && players === 1 ? makeWing() : null, shake: 0, flash: 0, endT: 0, speedMul: 3, checkpoint: z0, cpSnap: null };
  for (let i = 0; i < players; i++) { const p = newPlayer(i, start, players > 1); if (i) p.up = g.players[0].up; for (let k = 0; k < p.up[U.DRONE]; k++) p.drones.push({ x: p.x, y: p.y, z: p.z }); g.players.push(p); }
  while (g.evi < level.events.length && level.events[g.evi].z < z0 - 0.01) g.evi++;
  if (level.rules?.arena) { g.intro = 70; g.camZ = 0; for (const p of g.players) { p.y = 4.5; p.z = 11; p.shield = Math.max(p.shield, 2); } }
  g.cpSnap = snapshot(g);
  return g;
}
// what "save and quit" (and a level hand-over) stores: where you are and everything you carry
export function snapshot(g) { const p = g.players[0]; return { level: g.level.id, z: g.checkpoint, score: g.score, lives: Math.max(p.lives, 0), bombs: p.bombs, up: [...p.up], shield: p.shield, cursor: p.cursor, dmode: p.dmode, gear: g.gear, warp: g.flags.warp }; }

// ---------- helpers the level scripts use ----------
export function addEnemy(g, e) {
  const o = Object.assign({ type: 'pop', x: 0, y: 4.5, z: SPAWN_Z, vx: 0, vy: 0, vz: -8, hp: 2, r: 0.6, t: 0, col: '#ff3df0', score: 100, x0: e.x ?? 0, y0: e.y ?? 4.5, ax: 0, ay: 0, w: 2, ph: 0, fire: 0, rel: true }, e);
  o.max = o.hp; if (o.group) { (g.groups[o.group] ||= { n: 0, k: 0 }).n++; }
  g.enemies.push(o); return o;
}
export function addObs(g, o) { const b = Object.assign({ x: 0, y: 4.7, z: SPAWN_Z, hx: 1, hy: 1, hz: 1, vx: 0, vy: 0, vz: 0, rel: false, col: '#2ee6ff', warm: 0, kind: 'box' }, o); b.bx = b.x; b.by = b.y; g.obs.push(b); return b; }
export function addRing(g, r) { const o = Object.assign({ x: 0, y: 4.5, z: SPAWN_Z, r: 1.6, kind: 'bonus', got: false }, r); g.rings.push(o); return o; }
export function addPod(g, x, y, z, kind = 'pod') { g.pods.push({ x: clamp(x, -7, 7), y: clamp(y, 1, 8.5), z, kind, t: 0 }); }
export function bullet(g, x, y, z, vx, vy, vz, col = '#ff8a2b') { if (g.ebul.length < 260) g.ebul.push({ x, y, z, vx, vy, vz, r: 0.28, col, life: 420 }); }
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
export const lv = (p, i) => p.god > 0 && i < 6 ? 5 : p.up[i];

function addScore(g, base, x, y, z, col) {
  const mult = 1 + Math.min(9, g.chain / 5 | 0); g.score += base * mult;
  if (x != null) pop(g, mult > 1 ? base * mult + ' X' + mult : '' + base, x, y, z, col || '#ffe14a');
}
function kill(g, e) {
  e.hp = -999; g.stats.kills++; g.chain++; g.chainT = 190; if (g.chain > g.bestChain) g.bestChain = g.chain;
  if (g.chain === 10 || g.chain === 25 || g.chain === 50 || g.chain === 100) { g.fx.push('say:chain ' + g.chain, 'ring'); pop(g, 'CHAIN ' + g.chain + '!', e.x, e.y + 1.5, e.z, '#ffe14a', true); }
  addScore(g, e.score, e.x, e.y, e.z); explode(g, e.x, e.y, e.z, e.col, e.big ? 40 : 16, e.big ? 14 : 9, g.level.theme?.splat); g.fx.push(e.big ? 'boom2' : 'boom'); g.shake = Math.max(g.shake, e.big ? 10 : 3); if (e.big) for (let i = 1; i < 4; i++) g.shocks.push({ x: e.x, y: e.y, z: e.z, r: 0.4, vr: 10 + i * 9, life: 26, max: 26, col: i % 2 ? '#ffffff' : e.col });
  if (e.burst) for (let i = 0; i < e.burst; i++) { const a = i / e.burst * 6.283; bullet(g, e.x, e.y, e.z, Math.cos(a) * 5, Math.sin(a) * 5, -3, e.col); }
  if (e.type === 'rock' && e.size > 1) for (let i = 0; i < 2 + (g.rand() < 0.4); i++) addEnemy(g, { type: 'rock', rel: false, size: e.size - 1, x: e.x, y: e.y, z: e.z, vx: (g.rand() - 0.5) * 6, vy: (g.rand() - 0.5) * 5, vz: (g.rand() - 0.3) * 4, hp: e.size === 3 ? 4 : 2, r: e.size === 3 ? 1 : 0.6, col: e.col, score: 30, shape: 'rock', pod: e.size === 2 && g.rand() < 0.22 });
  if (e.pod) addPod(g, e.x, e.y, e.z);
  if (e.group) { const gr = g.groups[e.group]; if (++gr.k >= gr.n) { addPod(g, e.x, e.y, e.z); pop(g, 'WIPEOUT', e.x, e.y + 1, e.z, '#3dffb0'); } }
  else if (!e.pod && g.rand() < 0.01) addPod(g, e.x, e.y, e.z, 'god');
  else if (!e.pod && g.rand() < 0.02) addPod(g, e.x, e.y, e.z, 'bomb');
}
export function damage(g, e, d) {
  if (e.hp <= 0) return;
  if (e.type === 'boss' && !(e.vuln || []).includes(g.view)) { if (g.tick % 8 === 0) g.fx.push('ting'); e.deflect = 6; return; }
  e.hp -= d; e.hit = 4; if (e.hp <= 0) { if (e.type === 'boss') e.hp = 0; else kill(g, e); }
}
function hurt(g, p) {
  if (p.inv > 0 || p.dead > 0) return; g.stats.hits++;
  if (p.shield > 0) { p.shield--; p.inv = 90; g.fx.push('shield'); explode(g, p.x, p.y, p.z, '#5ee7ff', 12, 7); g.shake = 6; return; }
  explode(g, p.x, p.y, p.z, '#ffffff', 46, 15); explode(g, p.x, p.y, p.z, '#ff3df0', 30, 10); g.fx.push('die'); g.shake = 14; g.flash = 10; g.chain = 0; g.stats.deaths++;
  if (g.level.bonus) { p.dead = 1e9; g.state = 'over'; g.endT = 0; return; } // a bonus stage just ends; it never costs a ship
  p.lives--; p.dead = 70;
}
function startGod(g, p) { p.god = 660; g.fx.push('god', 'say:god mode'); pop(g, 'GOD MODE!', p.x, p.y + 1, p.z + 2, '#ffffff', true); while (p.drones.length < 5) p.drones.push({ x: p.x, y: p.y, z: p.z, tmp: true }); }
function buy(g, p) { // in co-op the upgrade bar is the team's: one cursor, one loadout, both ships get the goods
  const o = g.players[0], c = o.cursor; if (c < 0) return;
  const lvl = c === U.SHIELD ? o.shield : o.up[c];
  if (lvl >= BARMAX[c]) { g.fx.push('deny'); pop(g, 'MAXED', p.x, p.y + 1, p.z + 1, '#ff4d6d'); return; }
  if (c === U.SHIELD) for (const q of g.players) q.shield++;
  else if (c === U.WILD) { const r = g.rand(); if (r < 0.34) { nuke(g, p, false); pop(g, 'NUKE!', p.x, p.y + 1, p.z + 2, '#ff8a2b', true); g.fx.push('say:nuke'); } else if (r < 0.67) { p.over = 720; pop(g, 'OVERDRIVE!', p.x, p.y + 1, p.z + 2, '#ffe14a', true); g.fx.push('say:overdrive'); } else startGod(g, p); }
  else { o.up[c]++; if (c === U.DRONE) for (const q of g.players) { const t = q.drones.find(d => d.tmp); if (t) t.tmp = false; else if (q.drones.length < 5) q.drones.push({ x: q.x, y: q.y, z: q.z }); } }
  if (c !== U.WILD) { const l = c === U.SHIELD ? o.shield : o.up[c], nm = TIER[c]?.[l]; pop(g, (nm || BAR[c]) + (nm ? '' : ' ' + l), p.x, p.y + 1, p.z + 2, '#3dffb0', true); g.fx.push('say:' + (nm || BAR[c] + (l >= BARMAX[c] ? ' maxed' : ' level ' + l))); }
  o.cursor = -1; g.fx.push('upgrade');
}
function nuke(g, p, spend = true) {
  if (spend) { if (p.bombs <= 0) { g.fx.push('deny'); return; } p.bombs--; }
  g.ebul.length = 0; for (const e of g.enemies) if (e.z < 34) { if (e.type === 'boss') { if ((e.vuln || []).includes(g.view)) e.hp = Math.max(0, e.hp - 40); } else damage(g, e, 25); }
  for (const o of g.obs) if (o.hp) o.hp -= 25;
  for (let i = 0; i < 5; i++) g.shocks.push({ x: p.x, y: p.y, z: p.z + i * 4, r: 0.5, vr: 26, life: 30, max: 30, col: i % 2 ? '#ff8a2b' : '#ffe14a' });
  explode(g, p.x, p.y, p.z + 6, '#ffe14a', 60, 22); g.flash = 12; g.shake = 16; p.inv = Math.max(p.inv, 60); g.fx.push('bomb');
}
function beam(g, x, y, z, w, dmg, col, o = {}) {
  const m = MASK[g.view]; let zEnd = 34;
  if (o.dx != null && !(o.dx === 0 && o.dz === 1)) { const len = 30, dx = o.dx, dz = o.dz; // aimed beam (arena): a ray in the ground plane
    for (const e of g.enemies) { if (e.hp <= 0 || !live(e, g.view)) continue; const ex = e.x - x, ez = e.z - z, t = ex * dx + ez * dz; if (t < 0 || t > len) continue; if (Math.abs(ex * dz - ez * dx) < (e.hx ?? e.r) + w) damage(g, e, dmg); }
    for (const b of g.obs) if (b.hp != null && solid(b, g.view)) { const ex = b.x - x, ez = b.z - z, t = ex * dx + ez * dz; if (t > 0 && t < len && Math.abs(ex * dz - ez * dx) < b.hx + w) b.hp -= dmg; }
    if (o.eat) for (const b of g.ebul) { const ex = b.x - x, ez = b.z - z, t = ex * dx + ez * dz; if (t > 0 && t < len && Math.abs(ex * dz - ez * dx) < w + 0.3) b.life = 0; }
    g.beams.push({ x, y, z0: z, z1: z + dz * len, ex: x + dx * len, life: o.life || 5, max: o.life || 5, col, w: o.hyper ? w : 0 }); return; }
  if (!o.pierce) for (const b of g.obs) { if (!solid(b, g.view)) continue; if (b.z - b.hz > z && (!m[0] || Math.abs(b.x - x) < b.hx + w) && (!m[1] || Math.abs(b.y - y) < b.hy + w) && b.z - b.hz < zEnd) zEnd = b.z - b.hz; }
  else for (const b of g.obs) if (b.hp != null && solid(b, g.view) && b.z > z && (!m[0] || Math.abs(b.x - x) < b.hx + w) && (!m[1] || Math.abs(b.y - y) < b.hy + w)) b.hp -= dmg;
  for (const e of g.enemies) { if (e.hp <= 0 || !live(e, g.view) || e.z < z || e.z > zEnd + 1) continue; if ((!m[0] || Math.abs(e.x - x) < (e.hx ?? e.r) + w) && (!m[1] || Math.abs(e.y - y) < (e.hy ?? e.r) + w)) damage(g, e, dmg); }
  if (o.eat) for (const b of g.ebul) if (b.z > z && (!m[0] || Math.abs(b.x - x) < w + 0.3) && (!m[1] || Math.abs(b.y - y) < w + 0.3)) b.life = 0;
  g.beams.push({ x, y, z0: z, z1: zEnd, life: o.life || 5, max: o.life || 5, col, w: o.hyper ? w : 0 });
}
function fire(g, p) { // everything is fired relative to where the ship points: f = forward, r = right (straight ahead outside the arena)
  const v = g.view, sp = lv(p, U.SPREAD), od = p.over > 0 || p.god > 0, fx = p.ax, fz = p.az, rx = fz, rz = -fx, side = v === 0 && !g.level.rules?.arena;
  const S = (off, fwd, lat, vy, dmg) => { if (g.shots.length < 420) g.shots.push({ x: p.x + rx * off + fx * fwd, y: p.y, z: p.z + rz * off + fz * fwd, vx: fx * 40 + rx * lat, vy, vz: fz * 40 + rz * lat, dmg, r: 0.3, kind: 0, life: 60, pierce: sp >= 4 ? 1 : 0 }); };
  S(-0.26, 0.8, 0, 0, 1.15); S(0.26, 0.8, 0, 0, 1.15);
  for (let k = 1; k <= sp; k++) { const a = Math.sin(k * 0.13) * 40; if (side) { S(0, 0.6, 0, a, 0.8); S(0, 0.6, 0, -a, 0.8); } else { S(0, 0.6, a, 0, 0.8); S(0, 0.6, -a, 0, 0.8); if (k >= 3 && v !== 3 && !g.level.rules?.arena) { const b = Math.sin((k - 2) * 0.13) * 40; S(0, 0.6, 0, b, 0.8); S(0, 0.6, 0, -b, 0.8); } } }
  p.fireT = Math.max(6, 13 - sp) * (od ? 0.6 : 1) | 0; g.fx.push('shot');
}

export function step(g, inputs) {
  g.fx.length = 0; g.tick++;
  if (g.hintT > 0) g.hintT--; if (g.shake > 0) g.shake *= 0.86; if (g.flash > 0) g.flash--; if (g.perfFx > 0) g.perfFx--;
  if (g.shiftT > 0) g.shiftT = Math.max(0, g.shiftT - 1 / 15); if (g.shiftCd > 0) g.shiftCd--;
  if (g.chainT > 0 && --g.chainT === 0) g.chain = 0; if (g.perfT > 0) g.perfT--;
  const lvd = g.level, rules = lvd.rules || {}, P = g.players;
  const playing = g.state === 'play';
  // launch: hyperspace in, rolling through every view, then hand over in SIDE
  if (g.intro > 0) {
    g.intro--; const k = INTRO - g.intro; if (rules.arena) { g.speedMul = 1; for (const p of P) { p.inv = Math.max(p.inv, 100); p.prev = inputs[p.i] || {}; } if (g.intro === 0) g.fx.push('go'); return g; }
    if (k === 33 || k === 66 || k === 99) { g.viewFrom = g.view; g.view = g.view - 1; g.shiftT = 1; g.shiftDir = -1; g.fx.push('shift'); }
    g.camZ += INTRO_RUN / INTRO; g.speedMul = 1 + 2 * g.intro / INTRO; for (const p of P) { p.inv = Math.max(p.inv, 100); p.prev = inputs[p.i] || {}; }
    for (const q of g.parts) q.life--; if (g.intro === 0) { g.speedMul = GEARMUL[g.gear]; g.fx.push('go'); } if (g.wing) wingStep(g, DT, false); return g;
  }
  const dt = DT * (g.boss?.dying ? 0.3 : g.shiftT > 0 ? 0.4 : 1); // the world slows while you roll, so there is time to line up

  // ----- players: shift, move, shoot -----
  if (playing) for (const p of P) {
    const inp = inputs[p.i] || {}, pv = p.prev, edge = k => inp[k] && !pv[k];
    if (p.dead > 0) { if (--p.dead === 0) { if (p.lives < 0) { p.dead = 1e9; p.out = true; if (P.every(q => q.out)) { g.state = 'over'; g.endT = 0; g.fx.push('over', 'say:game over'); } } else { p.x = g.coop ? (p.i ? 1.5 : -1.5) : 0; p.y = 4.5; p.z = rules.arena ? 11 : 3; p.inv = 190; } } p.prev = inp; continue; }
    const dir = edge('shiftR') ? 1 : edge('shiftL') ? -1 : 0;
    if (dir && g.shiftCd <= 0 && !g.lockShift) doShift(g, rules.arena ? (g.view === 3 ? 1 : 3) : (g.view + dir + 4) % 4, dir, p);
    if (edge('upgrade')) buy(g, p);
    if (edge('bomb')) nuke(g, p);
    if (edge('drone')) { p.dmode = (p.dmode + 1) % 4; pop(g, 'DRONES: ' + DRONE_MODES[p.dmode], p.x, p.y + 1, p.z, '#b06bff'); g.fx.push('blip'); }
    if (edge('gear')) { g.gear = (g.gear + 1) % 3; pop(g, GEARS[g.gear], p.x, p.y + 1, p.z, '#ffe14a'); g.fx.push('gear'); }
    const sp = (8.5 + g.gear * 1.2) * DT, mx = clamp(inp.mx || 0, -1, 1), my = clamp(inp.my || 0, -1, 1), v = g.view;
    let ax = mx, ay = my; if (rules.inertia) { p.ivx += (mx - p.ivx) * 0.045; p.ivy += (my - p.ivy) * 0.045; ax = p.ivx; ay = p.ivy; }
    if (rules.arena) { // free flight over a fixed arena; the guns track the nearest target on their own
      p.x = clamp(p.x + ax * sp, -8.3, 8.3); p.z = clamp(p.z - ay * sp, 0.8, 23); p.y = 4.5;
      let best = null, bd = 1e9; for (const e of g.enemies) { if (e.hp <= 0 || !live(e, v)) continue; const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; best = e; } }
      let tx = p.ax, tz = p.az; p.manual = false; if (inp.aim && Math.hypot(inp.aim[0], inp.aim[1]) > 0.3) { const d = Math.hypot(inp.aim[0], inp.aim[1]); tx = inp.aim[0] / d; tz = inp.aim[1] / d; p.manual = true; } else if (best && bd > 0.1) { tx = (best.x - p.x) / bd; tz = (best.z - p.z) / bd; } else if (mx || my) { const d = Math.hypot(mx, my); tx = mx / d; tz = -my / d; }
      { const k = p.manual ? 0.6 : 0.3; p.ax += (tx - p.ax) * k; p.az += (tz - p.az) * k; } const n = Math.hypot(p.ax, p.az) || 1; p.ax /= n; p.az /= n; }
    else { if (v === 0) { p.z += ax * sp; p.y -= ay * sp; } else if (v === 3) { p.x += ax * sp; p.z -= ay * sp; } else { p.x += ax * sp; p.y -= ay * sp; }
      if (rules.wind) { const w = rules.wind(g); p.x += w[0] * DT; p.y += w[1] * DT; }
      p.x = clamp(p.x, -B.x, B.x); p.y = clamp(p.y, B.y0, B.y1); p.z = clamp(p.z, B.z0, B.z1); }
    p.mvx += (mx - p.mvx) * 0.2; p.mvy += (my - p.mvy) * 0.2;
    p.hist.push(p.x, p.y, p.z); if (p.hist.length > 3 * 80) p.hist.splice(0, 3);
    if (p.inv > 0) p.inv--; if (p.over > 0) p.over--;
    if (p.god > 0) { p.god--; p.inv = Math.max(p.inv, 2); if (p.god === 0) { p.drones = p.drones.filter(d => !d.tmp); p.inv = 90; pop(g, 'GOD MODE OVER', p.x, p.y + 1, p.z, '#9fb0ff'); } }
    // weapons: everything starts slow and speeds up with its own level
    const firing = inp.fire, od = p.over > 0 || p.god > 0; if (p.fireT > 0) p.fireT--;
    if (firing && p.fireT <= 0) fire(g, p);
    if (p.god > 0 && g.tick % 2 === 0) { beam(g, p.x + p.ax, p.y, p.z + p.az, 1.5, 2.2, '#ffffff', { pierce: true, eat: true, hyper: true, life: 3, dx: p.ax, dz: p.az }); if (g.tick % 12 === 0) g.fx.push('hyper'); g.shake = Math.max(g.shake, 2); }
    const L = lv(p, U.LASER);
    if (L && firing && --p.laserT <= 0) { p.laserT = (11 - L) * (od ? 0.6 : 1) | 0; const d = 0.7 + 0.3 * L, w = 0.3 + 0.08 * L, lat = v === 0 ? 'y' : 'x'; beam(g, p.x + p.ax, p.y, p.z + p.az, w, d, '#3dffb0', { pierce: L >= 4, dx: p.ax, dz: p.az });
      const offs = L >= 5 ? [1.3, -1.3, 2.6, -2.6] : L >= 3 ? [1.3, -1.3] : []; for (const o of offs) { if (rules.arena) beam(g, p.x + p.az * o, p.y, p.z - p.ax * o, w * 0.7, d * 0.6, '#3dffb0', { dx: p.ax, dz: p.az }); else beam(g, p.x + (lat === 'x' ? o : 0), p.y + (lat === 'y' ? o : 0), p.z + 0.6, w * 0.7, d * 0.6, '#3dffb0'); } if (g.tick % 12 < 6) g.fx.push('laser'); }
    const Wv = lv(p, U.WAVE);
    if (Wv && firing && --p.waveT <= 0) { p.waveT = (44 - 6 * Wv) * (od ? 0.6 : 1) | 0; const n = Wv >= 5 ? 3 : Wv >= 3 ? 2 : 1; for (let k = 0; k < n; k++) g.shots.push({ kind: 3, x: p.x, y: p.y, z: p.z + 1, ox: p.x, oy: p.y, oz: p.z, vx: 0, vy: 0, vz: 22, amp: 1.2 + 0.45 * Wv, ph: k * 6.283 / n, t: 0, d: 1, dmg: 0.2 + 0.07 * Wv, r: 0.7 + 0.12 * Wv, life: 110, axis: v === 0 ? 'y' : 'x', dir: rules.arena ? [p.ax, p.az] : null }); g.fx.push('wave'); }
    const Bo = lv(p, U.BOLT);
    if (Bo && firing && --p.boltT <= 0) { p.boltT = (96 - 11 * Bo) * (od ? 0.6 : 1) | 0; const n = Bo >= 5 ? 3 : Bo >= 3 ? 2 : 1; for (let k = 0; k < n; k++) g.shots.push({ kind: 4, x: p.x, y: p.y, z: p.z + 1, vx: 0, vy: 0, vz: 0, t: 0, ph: g.rand() * 6.283 + k * 2.1, own: p.i, dmg: 5 + 3 * Bo, chain: Bo >= 4 ? Bo - 1 : Bo >= 2 ? 1 : 0, r: 0.5, life: 190, trail: [] }); g.fx.push('bolt'); }
    const M = lv(p, U.MISSILE);
    if (M && firing && --p.missT <= 0) { p.missT = (od ? 0.6 : 1) * (80 - 9 * M) | 0; for (let k = 0; k < M + 1 && g.shots.length < 420; k++) { const a = (k - M / 2) * 0.5; g.shots.push({ x: p.x, y: p.y, z: p.z, vx: p.az * Math.sin(a) * 9 + p.ax * 6, vy: rules.arena ? 0 : Math.cos(a * 2) * 5, vz: -p.ax * Math.sin(a) * 9 + p.az * 6, dmg: 4 + M, r: 0.4, kind: 2, life: 150, aoe: M >= 3 ? 2 : 0, split: M >= 5 }); } g.fx.push('missile'); }
    // drones
    const n = p.drones.length, vw = g.view;
    for (let k = 0; k < n; k++) {
      const d = p.drones[k]; let tx = p.x, ty = p.y, tz = p.z;
      if (p.dmode === 0) { const i = p.hist.length - 3 * (k + 1) * 9; if (i >= 0) { tx = p.hist[i]; ty = p.hist[i + 1]; tz = p.hist[i + 2]; } }
      else if (p.dmode === 1) { const a = g.tick * 0.06 + k * 6.283 / n, c = Math.cos(a) * 1.7, s = Math.sin(a) * 1.7; if (vw === 0) { ty += c; tz += s; } else if (vw === 3) { tx += c; tz += s; } else { tx += c; ty += s; } }
      else if (p.dmode === 2) { const o = ((k + 2) >> 1) * 1.3 * (k % 2 ? 1 : -1); tz += 1.6; if (vw === 0) ty += o; else tx += o; }
      else { let best = null, bd = 1e9; for (const e of g.enemies) { if (e.hp <= 0 || e.z > 26 || e.z < 0) continue; const dd = Math.hypot(e.x - d.x, e.y - d.y, e.z - d.z); if (dd < bd) { bd = dd; best = e; } } if (best) { tx = best.x; ty = best.y; tz = Math.max(p.z, best.z - 4); } else { tx += (k - n / 2) * 1.2; tz += 1; } }
      if (rules.arena) ty = 4.5; d.x += (tx - d.x) * 0.16; d.y += (clamp(ty, 0.4, 9) - d.y) * 0.16; d.z += (tz - d.z) * 0.16;
      if (firing && (g.tick + k * 4) % (od ? 9 : 17) === 0 && g.shots.length < 420) g.shots.push({ x: d.x, y: d.y, z: d.z + 0.4, vx: p.ax * 40, vy: 0, vz: p.az * 40, dmg: 0.6, r: 0.25, kind: 1, life: 50 });
      if (firing && L >= 2 && (g.tick + k * 5) % 16 === 0) beam(g, d.x, d.y, d.z + 0.4, 0.25, 0.2 * L, '#b06bff', { dx: p.ax, dz: p.az });
      if (p.dmode === 1) for (const b of g.ebul) if (Math.abs(b.x - d.x) < 0.6 && Math.abs(b.y - d.y) < 0.6 && Math.abs(b.z - d.z) < 0.6) b.life = 0;
    }
    p.prev = inp;
  }
  if (g.wing) wingStep(g, dt, playing);

  // ----- scroll + level script -----
  g.speedMul += (GEARMUL[g.gear] * (g.mut.turbo ? 1.25 : 1) - g.speedMul) * 0.06;
  const dz = rules.arena ? 0 : playing ? SCROLL * g.speedMul * dt : SCROLL * 0.4 * dt;
  if (playing) {
    g.camZ += dz;
    if (!g.boss) while (g.evi < lvd.events.length && lvd.events[g.evi].z <= g.camZ) lvd.events[g.evi++].fn(g);
    const zn = lvd.zones.find(z => g.camZ + 24 >= z.z0 && g.camZ + 24 < z.z1);
    if (zn && zn !== g.zone) { g.zone = zn; if (zn.msg) hint(g, zn.msg, 260); }
    if (!g.boss && g.zone) g.recView = g.zone.view;
    for (const c of lvd.checkpoints) if (g.camZ >= c && c > g.checkpoint) { g.checkpoint = c; g.cpSnap = snapshot(g); g.fx.push('blip', 'toast:CHECKPOINT|PROGRESS SAVED'); }
    if (lvd.endZ && g.camZ >= lvd.endZ && !g.boss) { g.state = 'clear'; g.endT = 0; g.score += lvd.endBonus || 0; g.fx.push('clear', 'toast:BONUS COMPLETE|+' + (lvd.endBonus || 0)); }
    if (rules.heat && g.camZ > 26) { const p = P[0], m = MASK[g.view]; let shade = false; for (const o of g.obs) if (o.kind === 'shade' && ov({ x: p.x, y: p.y, z: p.z, r: 0.1 }, o, m)) { shade = true; break; }
      g.heat = clamp(g.heat + (shade ? -1.2 : 0.3), 0, 100); if (g.heat >= 100 && p.dead <= 0) { g.heat = 45; hurt(g, p); pop(g, 'OVERHEAT', p.x, p.y + 1, p.z, '#ff4d6d', true); } }
    if (lvd.tick) lvd.tick(g);
  }
  const vw = g.view, m = MASK[vw];

  // ----- enemies -----
  for (const e of g.enemies) {
    e.t++; if (e.hit > 0) e.hit--; if (e.deflect > 0) e.deflect--;
    if (e.type === 'boss') { lvd.boss.update(g, e, dt); continue; }
    if (!e.rel) e.z -= dz;
    if (e.type === 'pop') { e.z += e.vz * dt; e.x = e.x0 + e.ax * Math.sin(e.t * 0.02 * e.w + e.ph); e.y = e.y0 + e.ay * Math.sin(e.t * 0.02 * e.w + e.ph + (e.ax ? 1.57 : 0)); if (e.zig) e.x = e.x0 + e.ax * (Math.abs(((e.t * 0.02 * e.w + e.ph) % 2) - 1) * 2 - 1); }
    else if (e.type === 'saucer') { if (e.t < e.dur) { e.z += (e.hold - e.z) * 0.03; e.x = e.x0 + e.ax * Math.sin(e.t * 0.025 + e.ph); e.y = e.y0 + e.ay * Math.sin(e.t * 0.031 + e.ph); } else { e.z -= 14 * dt; } }
    else if (e.type === 'kami') { const p = near(g, e), s = 4.6 * dt; e.z += e.vz * dt; if (e.z > p.z) { e.x += clamp(p.x - e.x, -s, s) * m[0]; e.y += clamp(p.y - e.y, -s, s) * m[1]; } }
    else if (e.type === 'seek') { const p = near(g, e), dx = p.x - e.x, dzz = p.z - e.z, d = Math.hypot(dx, dzz) || 1, sp = (e.sp || 4) * dt, wv = Math.sin(e.t * 0.07 + e.ph) * (e.wob || 0) * dt; if (d > (e.keep || 0)) { e.x += dx / d * sp - dzz / d * wv; e.z += dzz / d * sp + dx / d * wv; } else { e.x += -dzz / d * sp * 0.6; e.z += dx / d * sp * 0.6; } e.y = 4.5; }
    else if (e.type === 'bomb') { e.vy -= 7 * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt; if (e.y < 0.3) { explode(g, e.x, 0.3, e.z, e.col, 12, 7); e.hp = -999; g.fx.push('boom'); } }
    else if (e.type === 'rock') { e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt; if (Math.abs(e.x) > 8) e.vx *= -1; if (e.y < 0.8 || e.y > 9) e.vy *= -1; }
    if (playing && e.fire && e.z > 4 && e.z < 27 && e.y > 0 && (e.haunt || live(e, vw)) && (e.t + e.ph * 10 | 0) % e.fire === e.fire - 1) { if (e.lob) { const p = near(g, e), T = 1.5; addEnemy(g, { type: 'bomb', rel: false, x: e.x, y: e.y + 1, z: e.z, vx: (p.x - e.x) / T * m[0], vy: 7 + g.rand() * 2, vz: (p.z + 1 - e.z) / T + SCROLL * g.speedMul, hp: 1, r: 0.5, col: '#ff8a2b', score: 50, shape: 'bomb' }); g.fx.push('missile'); } else { const n = e.fan || (e.type === 'saucer' ? 3 : 1); for (let i = 0; i < n; i++) aimed(g, e, e.bs || 9, (i - (n - 1) / 2) * 0.22, e.bcol); g.fx.push('eshot'); } }
    if (e.z < -4 && e.hp > 0) { e.hp = -999; if (e.group) g.groups[e.group].n = 1e9; }
  }
  // ----- shots -----
  for (const s of g.shots) {
    if (s.kind === 3) { s.t++; const o = Math.sin(s.t * 0.14 + s.ph) * s.amp; if (s.dir) { s.d += s.vz * dt; s.x = s.ox + s.dir[0] * s.d + s.dir[1] * o; s.z = s.oz + s.dir[1] * s.d - s.dir[0] * o; } else { s.z += s.vz * dt; if (s.axis === 'x') { s.x = s.ox + o; } else { s.y = s.oy + o; } } if (--s.life <= 0 || s.z > 34 || s.z < -4 || Math.abs(s.x) > 13) { s.life = 0; continue; }
      for (const e of g.enemies) if (e.hp > 0 && live(e, vw) && ov(s, e, m)) damage(g, e, s.dmg); for (const o2 of g.obs) if (o2.hp != null && solid(o2, vw) && ov(s, o2, m)) { o2.hp -= s.dmg; o2.hit = 2; } for (const b of g.ebul) if (Math.abs(b.z - s.z) < 0.8 && ov(s, b, m)) b.life = 0; continue; }
    if (s.kind === 4) { s.t++; s.trail.push(s.x, s.y, s.z); if (s.trail.length > 210) s.trail.splice(0, 3); const p = P[s.own || 0];
      if (s.t < 52) { const a = s.t * 0.19 + s.ph, R = 2 + s.t * 0.09; const tx = clamp(p.x + Math.cos(a) * R * 1.3, -7.5, 7.5), ty = clamp(p.y + Math.sin(a * 1.3) * R * 0.7, 0.6, 9), tz = p.z + 2 + s.t * 0.16 + Math.sin(a * 0.7) * 2; s.x += (tx - s.x) * 0.3; s.y += (ty - s.y) * 0.3; s.z += (tz - s.z) * 0.3; }
      else { let best = null, bd = 1e9; for (const e of g.enemies) { if (e.hp <= 0 || !live(e, vw) || e.z > 30 || e.z < 0 || e === s.skip) continue; const d = Math.hypot(e.x - s.x, e.y - s.y, e.z - s.z) - (e.type === 'boss' ? 6 : 0); if (d < bd) { bd = d; best = e; } }
        if (best) { const d = Math.hypot(best.x - s.x, best.y - s.y, best.z - s.z) || 1, sp = 46 * dt; if (d < sp + (best.hx ?? best.r)) { damage(g, best, s.dmg); explode(g, best.x, best.y, best.z, '#7df9ff', 8, 8); g.fx.push('zap'); if (s.chain > 0) { s.chain--; s.dmg *= 0.7; s.skip = best; s.x = best.x; s.y = best.y; s.z = best.z; } else s.life = 0; } else { s.x += (best.x - s.x) / d * sp; s.y += (best.y - s.y) / d * sp; s.z += (best.z - s.z) / d * sp; } }
        else { s.z += 30 * dt; if (s.z > 34) s.life = 0; } }
      if (--s.life <= 0) s.life = 0; continue; }
    if (s.kind === 2) { let best = null, bd = 1e9; for (const e of g.enemies) { if (e.hp <= 0 || !live(e, vw) || e.z > 30) continue; const d = Math.hypot((e.x - s.x) * m[0], (e.y - s.y) * m[1], e.z - s.z); if (d < bd) { bd = d; best = e; } }
      if (best) { const d = bd || 1, a = 2.2; s.vx += (best.x - s.x) / d * a * m[0]; s.vy += (best.y - s.y) / d * a * m[1]; s.vz += (best.z - s.z) / d * a; } else s.vz += 1.2; const sp = Math.hypot(s.vx, s.vy, s.vz), mx = 30; if (sp > mx) { s.vx *= mx / sp; s.vy *= mx / sp; s.vz *= mx / sp; }
      if (g.tick % 2 === 0 && g.parts.length < 800) g.parts.push({ x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: -4, life: 10, max: 10, col: '#ff8a2b' }); }
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; if (--s.life <= 0 || s.z > 36 || s.z < -3 || Math.abs(s.x) > 13 || s.y < -1 || s.y > 12) { s.life = 0; continue; }
    for (const e of g.enemies) { if (e.hp <= 0 || !live(e, vw) || e === s.last) continue; if (ov(s, e, m)) { damage(g, e, s.dmg); if (s.pierce > 0) { s.pierce--; s.last = e; } else s.life = 0;
      if (s.aoe) { explode(g, s.x, s.y, s.z, '#ff8a2b', 12, 8); for (const q of g.enemies) if (q !== e && q.hp > 0 && Math.hypot(q.x - s.x, q.y - s.y, q.z - s.z) < s.aoe + q.r) damage(g, q, s.dmg * 0.5); if (s.split) for (let i = 0; i < 3; i++) g.shots.push({ x: s.x, y: s.y, z: s.z, vx: Math.cos(i * 2.1) * 12, vy: Math.sin(i * 2.1) * 12, vz: 4, dmg: 3, r: 0.35, kind: 2, life: 60, aoe: 1.2 }); }
      else if (g.parts.length < 800) g.parts.push({ x: s.x, y: s.y, z: s.z, vx: 0, vy: 3, vz: -6, life: 8, max: 8, col: '#ffffff' }); break; } }
    if (s.life > 0) for (const o of g.obs) { if (!solid(o, vw)) continue; if (ov(s, o, m)) { s.life = 0; if (o.hp != null) { o.hp -= s.dmg; o.hit = 3; } if (g.parts.length < 800) g.parts.push({ x: s.x, y: s.y, z: s.z, vx: 0, vy: 2, vz: -8, life: 7, max: 7, col: o.col }); break; } }
  }
  // ----- obstacles -----
  for (const o of g.obs) {
    if (!o.rel) o.z -= dz; o.bx += o.vx * dt; o.by += o.vy * dt; o.z += o.vz * dt; if (o.hit > 0) o.hit--;
    if (o.wrap && Math.abs(o.bx) > o.wrap) o.bx = -Math.sign(o.bx) * o.wrap;
    if (o.osc) { const a = g.tick * 0.02 * o.osc.w + o.osc.ph; o.x = o.bx + o.osc.ax * Math.sin(a); o.y = o.by + o.osc.ay * Math.sin(a); } else { o.x = o.bx; o.y = o.by; }
    if (o.pulse) { const c = (g.tick + o.pulse[2]) % (o.pulse[0] + o.pulse[1]); o.idle = c >= o.pulse[0]; o.soon = o.idle && c > o.pulse[0] + o.pulse[1] - 45; if (!o.idle && c === 0 && o.z > 0 && o.z < 28) g.fx.push('zap'); }
    if (o.warm > 0) { if (--o.warm === 0) g.fx.push('zap'); } else if (o.life != null && --o.life <= 0) o.dead = true;
    if (o.hp != null && o.hp <= 0 && !o.dead) { o.dead = true; explode(g, o.x, o.y, o.z, o.col, 18, 9); g.chain++; g.chainT = 190; addScore(g, o.score || 50, o.x, o.y, o.z); g.fx.push('boom'); if (o.pod) addPod(g, o.x, o.y, o.z); if (o.gem) addPod(g, o.x, o.y, o.z, 'gem'); }
    if (o.z + o.hz < -5) o.dead = true;
  }
  // ----- enemy bullets -----
  for (const b of g.ebul) { b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; if (--b.life <= 0 || b.z < -3 || b.z > 36 || Math.abs(b.x) > 12 || b.y < -1 || b.y > 11) b.life = 0; }
  // ----- pods + rings -----
  for (const q of g.pods) { q.t++; q.z -= dz * 0.75; if (q.z < -3) q.dead = true; for (const p of P) { if (p.dead > 0) continue; const dx = (p.x - q.x) * m[0], dy = (p.y - q.y) * m[1], dzz = p.z - q.z, d = Math.hypot(dx, dy, dzz); if (d < 5) { q.x += dx / (d + 0.01) * 9 * dt; q.y += dy / (d + 0.01) * 9 * dt; q.z += dzz / (d + 0.01) * 9 * dt; }
    if (d < 1.2 && !q.dead) { q.dead = true; if (q.kind === 'pod') { const o = P[0]; o.cursor = (o.cursor + 1) % BAR.length; g.fx.push('pod'); addScore(g, 50); } else if (q.kind === 'god') startGod(g, p); else if (q.kind === 'bomb') { p.bombs = Math.min(9, p.bombs + 1); pop(g, '+BOMB', p.x, p.y + 1, p.z, '#ff8a2b'); g.fx.push('pod'); } else if (q.kind === 'gem') { g.chain++; g.chainT = 190; addScore(g, 200, q.x, q.y, q.z, '#7df9ff'); g.fx.push('ring'); } } } }
  for (const r of g.rings) { const pz = r.z; r.z -= dz; if (r.z < -4) r.dead = true; if (r.got) continue; for (const p of P) { if (p.dead > 0) continue; if (pz >= p.z && r.z < p.z && live(r, vw) && Math.hypot((p.x - r.x) * m[0], (p.y - r.y) * m[1]) < r.r) { r.got = true;
    if (r.kind === 'warp') { g.flags.warp = true; g.flags.warpNow = true; g.score += 5000; pop(g, 'WARP!', p.x, p.y + 1.5, p.z + 3, '#b06bff', true); g.fx.push('warp', 'say:warp found', 'toast:WARP FOUND|' + (lvd.warpName || '')); g.flash = 16; explode(g, r.x, r.y, p.z, '#b06bff', 60, 16); p.inv = 240; }
    else { g.chain += 2; g.chainT = 190; addScore(g, 300, r.x, r.y, p.z, '#3dffb0'); g.fx.push('ring'); } } } }

  // ----- player collisions -----
  if (playing) for (const p of P) {
    if (p.dead > 0) continue; const pb = { x: p.x, y: p.y, z: p.z, hx: 0.3, hy: 0.22, hz: 0.5 };
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
// RIVET-9, the assist wingman. He reads the level ahead and rolls into the view it calls for before you do,
// so you can see where he ends up. He holds formation, fires a light gun, and reboots a few seconds after a hit.
function wingStep(g, dt, playing) {
  const w = g.wing, p = g.players[0], v = g.view, m = MASK[v], arena = g.level.rules?.arena; w.t++;
  if (w.st > 0) w.st = Math.max(0, w.st - 1 / 18);
  if (w.view !== g.recView && w.st <= 0 && g.intro <= 0 && !g.boss?.dying) { w.from = w.view; w.view = g.recView; w.st = 1; w.dir = (w.view - w.from + 4) % 4 === 3 ? -1 : 1; if (w.dead <= 0) g.fx.push('wshift'); }
  if (g.intro > 0) { w.view = w.from = g.view; w.st = 0; }
  if (w.dead > 0) { if (--w.dead === 0) { w.x = p.x; w.y = p.y; w.z = Math.max(0.6, p.z - 2); w.inv = 150; g.fx.push('blip'); } return; }
  if (w.inv > 0) w.inv--;
  let tx = p.x - 1.7, ty = p.y + 0.8, tz = p.z - 1.3; if (arena) { tx = p.x - p.az * 1.7 - p.ax * 1.2; ty = 4.5; tz = p.z + p.ax * 1.7 - p.az * 1.2; } else if (v === 0) { tx = p.x; ty = p.y + 1.3; tz = p.z - 1.5; }
  ty += Math.sin(w.t * 0.05) * 0.15; w.x += (clamp(tx, -8, 8) - w.x) * 0.09; w.y += (clamp(ty, 0.7, 9) - w.y) * 0.09; w.z += (Math.max(0.5, tz) - w.z) * 0.09;
  if (!playing || p.dead > 0) return;
  if (w.t % 13 === 0 && g.shots.length < 420) { g.shots.push({ x: w.x, y: w.y, z: w.z + 0.5, vx: p.ax * 40, vy: 0, vz: p.az * 40, dmg: 0.8, r: 0.28, kind: 1, life: 55 }); }
  if (w.inv > 0) return; const wb = { x: w.x, y: w.y, z: w.z, hx: 0.3, hy: 0.22, hz: 0.5 }; let hit = false;
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
  const ra = A === 'z' ? [1, 2.5, 4, 5.5, 7, 9] : [-7, -5.25, -3.5, -1.75, 0, 1.75, 3.5, 5.25, 7], rb = arena ? [2, 4.5, 7, 9.5, 12, 14.5, 17, 19.5, 22] : Bx === 'z' ? [1, 2.5, 4, 5.5, 7, 9] : [1, 2.1, 3.2, 4.3, 5.4, 6.5, 7.6, 8.5];
  const spd = (8.5 + g.gear * 1.2) * (rules.inertia ? 0.6 : 1);
  let best = null, bc = 1e9; const c = { x: p.x, y: p.y, z: p.z, hx: 0.75, hy: 0.6, hz: 0.9 }, t = { x: 0, y: 0, z: 0, hx: 0, hy: 0, hz: 0 };
  let tgt = null, td = 1e9; for (const e of g.enemies) if (e.hp > 0 && live(e, v) && e.z > p.z + 2 && e.z < 26) { const d = e.z + (e.type === 'boss' ? -50 : 0); if (d < td) { td = d; tgt = e; } }
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
  const cu = p.cursor; if (cu >= 0 && !pv.upgrade) { const lo = Math.min(p.up[1], p.up[2], p.up[3], p.up[4], p.up[5]); if (cu === 7 || cu === 0 && p.up[0] <= lo + 1 && p.up[0] < 5 || cu >= 1 && cu <= 5 && p.up[cu] <= lo && p.up[cu] < 5 || cu === 6 && p.shield < 2) out.upgrade = true; }
  return out;
}
