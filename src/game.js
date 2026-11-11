// 2DISO SHIFT — pure simulation. No DOM. Fixed 60 Hz step. Randomness only from the seed.
// World axes: x = left/right, y = altitude, z = forward (relative to the scrolling camera).
// The four views flatten different axes, and what a view flattens does not exist for collisions.
export const VIEWS = ['SIDE', 'ISO', 'CHASE', 'TOP'];
export const MASK = [[0, 1, 1], [1, 1, 1], [1, 1, 1], [1, 0, 1]]; // which of x,y,z count in each view
export const B = { x: 7.5, y0: 0.6, y1: 8.8, z0: 0.5, z1: 12 };
export const BAR = ['SPEED', 'SPREAD', 'LASER', 'MISSILE', 'DRONE', 'SHIELD', '???'];
export const BARMAX = [5, 5, 5, 5, 5, 3, 99];
export const DRONE_MODES = ['TRAIL', 'ORBIT', 'WALL', 'HUNT'];
export const SCROLL = 7, DT = 1 / 60, SPAWN_Z = 30;

function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function newPlayer(i, s) {
  return { i, x: i ? 2 : 0, y: 4.5, z: 3, mvx: 0, mvy: 0, inv: 120, dead: 0, lives: s?.lives ?? 3, bombs: s?.bombs ?? 3,
    up: s?.up ? [...s.up] : [0, 0, 0, 0, 0, 0, 0], shield: s?.shield ?? 0, cursor: -1, drones: [], dmode: s?.dmode ?? 0,
    hist: [], fireT: 0, laserT: 0, missT: 30, god: 0, over: 0, prev: {}, roll: 0 };
}

export function createGame({ seed = 1, level, start = null, players = 1 } = {}) {
  const g = { seed, rand: rng(seed), tick: 0, camZ: start?.z || 0, level, evi: 0, view: start?.view ?? 0, viewFrom: start?.view ?? 0, shiftT: 0, shiftDir: 1, shiftCd: 0,
    players: [], enemies: [], shots: [], ebul: [], obs: [], rings: [], pods: [], parts: [], pops: [], beams: [], shocks: [], fx: [], groups: {},
    score: start?.score || 0, chain: 0, chainT: 0, bestChain: 0, state: 'play', boss: null, hint: null, hintT: 0, zone: null, recView: 0,
    flags: { warp: !!start?.warp }, stats: { kills: 0, shifts: 0, deaths: 0 }, shake: 0, flash: 0, endT: 0, speedMul: 1, checkpoint: start?.z || 0, cpSnap: null, gid: 1 };
  for (let i = 0; i < players; i++) { const p = newPlayer(i, start); for (let k = 0; k < p.up[4]; k++) p.drones.push({ x: p.x, y: p.y, z: p.z }); g.players.push(p); }
  while (g.evi < level.events.length && level.events[g.evi].z < g.camZ - 0.01) g.evi++;
  g.cpSnap = snapshot(g);
  return g;
}

// what "save & quit" stores: where you are and everything you carry
export function snapshot(g) { const p = g.players[0]; return { z: g.checkpoint, score: g.score, lives: Math.max(p.lives, 0), bombs: p.bombs, up: [...p.up], shield: p.shield, dmode: p.dmode, view: g.view, warp: g.flags.warp }; }

// ---------- helpers the level script uses ----------
export function addEnemy(g, e) {
  const o = Object.assign({ type: 'pop', x: 0, y: 4.5, z: SPAWN_Z, vx: 0, vy: 0, vz: -8, hp: 2, r: 0.6, t: 0, col: '#ff3df0', score: 100, x0: e.x ?? 0, y0: e.y ?? 4.5, ax: 0, ay: 0, w: 2, ph: 0, fire: 0, rel: true }, e);
  o.max = o.hp; if (o.group) { (g.groups[o.group] ||= { n: 0, k: 0 }).n++; }
  g.enemies.push(o); return o;
}
export function addObs(g, o) { const b = Object.assign({ x: 0, y: 4.7, z: SPAWN_Z, hx: 1, hy: 1, hz: 1, vx: 0, vy: 0, vz: 0, rel: false, col: '#2ee6ff', warm: 0, kind: 'box' }, o); g.obs.push(b); return b; }
export function addRing(g, r) { const o = Object.assign({ x: 0, y: 4.5, z: SPAWN_Z, r: 1.6, kind: 'bonus', got: false }, r); g.rings.push(o); return o; }
export function addPod(g, x, y, z, kind = 'pod') { g.pods.push({ x, y: clamp(y, 1, 8.5), z, kind, t: 0 }); }
export function bullet(g, x, y, z, vx, vy, vz, col = '#ff8a2b') { if (g.ebul.length < 260) g.ebul.push({ x, y, z, vx, vy, vz, r: 0.28, col, life: 420 }); }
export function aimed(g, e, speed = 11, spread = 0) {
  const p = g.players[0], m = MASK[g.view]; let dx = (p.x - e.x) * m[0], dy = (p.y - e.y) * m[1], dz = p.z - e.z;
  const d = Math.hypot(dx, dy, dz) || 1; dx /= d; dy /= d; dz /= d;
  if (spread) { const c = Math.cos(spread), s = Math.sin(spread); const lat = m[0] ? 'x' : 'y'; if (lat === 'x') { const nx = dx * c - dz * s; dz = dx * s + dz * c; dx = nx; } else { const ny = dy * c - dz * s; dz = dy * s + dz * c; dy = ny; } }
  bullet(g, e.x, e.y, e.z, dx * speed, dy * speed, dz * speed);
}
export function explode(g, x, y, z, col, n = 14, pow = 9) {
  for (let i = 0; i < n && g.parts.length < 700; i++) { const a = g.rand() * 6.283, b = g.rand() * 2 - 1, s = pow * (0.35 + g.rand()), c = Math.sqrt(1 - b * b); g.parts.push({ x, y, z, vx: Math.cos(a) * c * s, vy: b * s, vz: Math.sin(a) * c * s, life: 26 + g.rand() * 30 | 0, max: 56, col }); }
  g.shocks.push({ x, y, z, r: 0.3, vr: pow * 0.9, life: 18, max: 18, col });
}
export function pop(g, txt, x, y, z, col = '#fff', big = false) { g.pops.push({ txt, x, y, z, col, life: big ? 80 : 46, max: big ? 80 : 46, big }); }
export function hint(g, msg, t = 200) { g.hint = msg; g.hintT = t; g.fx.push('hint'); }

function ov(a, b, m, pad = 0) {
  const ax = a.hx ?? a.r, ay = a.hy ?? a.r, az = a.hz ?? a.r, bx = b.hx ?? b.r, by = b.hy ?? b.r, bz = b.hz ?? b.r;
  return (!m[0] || Math.abs(a.x - b.x) < ax + bx + pad) && (!m[1] || Math.abs(a.y - b.y) < ay + by + pad) && Math.abs(a.z - b.z) < az + bz + pad;
}
const live = (o, v) => o.phase == null || o.phase === v;

function addScore(g, base, x, y, z, col) {
  const mult = 1 + Math.min(9, g.chain / 5 | 0); g.score += base * mult;
  if (x != null) pop(g, mult > 1 ? base * mult + ' X' + mult : '' + base, x, y, z, col || '#ffe14a');
}
function kill(g, e) {
  e.hp = -999; g.stats.kills++; g.chain++; g.chainT = 170; if (g.chain > g.bestChain) g.bestChain = g.chain;
  if (g.chain === 10 || g.chain === 25 || g.chain === 50 || g.chain === 100) { g.fx.push('say:chain ' + g.chain, 'ring'); pop(g, 'CHAIN ' + g.chain + '!', e.x, e.y + 1.5, e.z, '#ffe14a', true); }
  addScore(g, e.score, e.x, e.y, e.z); explode(g, e.x, e.y, e.z, e.col, e.big ? 40 : 16, e.big ? 14 : 9); g.fx.push(e.big ? 'boom2' : 'boom'); g.shake = Math.max(g.shake, e.big ? 10 : 3);
  if (e.pod) addPod(g, e.x, e.y, e.z);
  if (e.group) { const gr = g.groups[e.group]; if (++gr.k >= gr.n) { addPod(g, e.x, e.y, e.z); pop(g, 'WIPEOUT', e.x, e.y + 1, e.z, '#3dffb0'); } }
  else if (!e.pod && g.rand() < 0.012) addPod(g, e.x, e.y, e.z, 'god');
  else if (!e.pod && g.rand() < 0.02) addPod(g, e.x, e.y, e.z, 'bomb');
}
function damage(g, e, d) {
  if (e.hp <= 0) return;
  if (e.type === 'boss' && !(e.vuln || []).includes(g.view)) { if (g.tick % 8 === 0) { g.fx.push('ting'); } e.deflect = 6; return; }
  e.hp -= d; e.hit = 4; if (e.hp <= 0) { if (e.type === 'boss') e.hp = 0; else kill(g, e); }
}

function hurt(g, p) {
  if (p.inv > 0 || p.dead > 0) return;
  if (p.shield > 0) { p.shield--; p.inv = 70; g.fx.push('shield'); explode(g, p.x, p.y, p.z, '#5ee7ff', 12, 7); g.shake = 6; return; }
  explode(g, p.x, p.y, p.z, '#ffffff', 46, 15); explode(g, p.x, p.y, p.z, '#ff3df0', 30, 10); g.fx.push('die'); g.shake = 14; g.flash = 10; g.chain = 0; g.stats.deaths++;
  p.lives--; p.dead = 70;
}

function buy(g, p) {
  const c = p.cursor; if (c < 0) return;
  const lvl = c === 5 ? p.shield : p.up[c];
  if (lvl >= BARMAX[c]) { g.fx.push('deny'); return; }
  if (c === 5) p.shield++;
  else if (c === 6) {
    const r = g.rand(); if (r < 0.34) { nuke(g, p, false); pop(g, 'NUKE!', p.x, p.y + 1, p.z + 2, '#ff8a2b', true); }
    else if (r < 0.67) { p.over = 720; pop(g, 'OVERDRIVE!', p.x, p.y + 1, p.z + 2, '#ffe14a', true); }
    else { p.god = 600; pop(g, 'GOD MODE!', p.x, p.y + 1, p.z + 2, '#ffffff', true); g.fx.push('god', 'say:god mode'); }
    if (r < 0.67) g.fx.push(r < 0.34 ? 'say:nuke' : 'say:overdrive');
  } else { p.up[c]++; if (c === 4) p.drones.push({ x: p.x, y: p.y, z: p.z }); }
  if (c !== 6) { const l = c === 5 ? p.shield : p.up[c]; pop(g, BAR[c] + ' ' + l, p.x, p.y + 1, p.z + 2, '#3dffb0', true); g.fx.push('say:' + BAR[c] + (l >= BARMAX[c] ? ' maxed' : ' level ' + l)); }
  p.cursor = -1; g.fx.push('upgrade');
}
function nuke(g, p, spend = true) {
  if (spend) { if (p.bombs <= 0) { g.fx.push('deny'); return; } p.bombs--; }
  g.ebul.length = 0; for (const e of g.enemies) if (e.z < 34) { if (e.type === 'boss') { if ((e.vuln || []).includes(g.view)) e.hp = Math.max(0, e.hp - 40); } else damage(g, e, 25); }
  for (const o of g.obs) if (o.hp) o.hp -= 25;
  for (let i = 0; i < 5; i++) g.shocks.push({ x: p.x, y: p.y, z: p.z + i * 4, r: 0.5, vr: 26, life: 30, max: 30, col: i % 2 ? '#ff8a2b' : '#ffe14a' });
  explode(g, p.x, p.y, p.z + 6, '#ffe14a', 60, 22); g.flash = 12; g.shake = 16; p.inv = Math.max(p.inv, 60); g.fx.push('bomb');
}

function fire(g, p) {
  const v = g.view, sp = p.up[1], od = p.over > 0;
  const S = (x, y, z, vx, vy, dmg, kind = 0) => { if (g.shots.length < 400) g.shots.push({ x, y, z, vx, vy, vz: 44, dmg, r: 0.3, kind, life: 60 }); };
  S(p.x - 0.28, p.y, p.z + 0.8, 0, 0, 1); S(p.x + 0.28, p.y, p.z + 0.8, 0, 0, 1);
  for (let k = 1; k <= sp; k++) { const a = Math.sin(k * 0.13) * 44; if (v === 0) { S(p.x, p.y, p.z + 0.6, 0, a, 0.8); S(p.x, p.y, p.z + 0.6, 0, -a, 0.8); } else { S(p.x, p.y, p.z + 0.6, a, 0, 0.8); S(p.x, p.y, p.z + 0.6, -a, 0, 0.8); if (k >= 3 && v !== 3) { const b = Math.sin((k - 2) * 0.13) * 44; S(p.x, p.y, p.z + 0.6, 0, b, 0.8); S(p.x, p.y, p.z + 0.6, 0, -b, 0.8); } } }
  p.fireT = od ? 4 : 7; g.fx.push('shot');
}
function beam(g, x, y, z, w, dmg, col) {
  const m = MASK[g.view]; let zEnd = 34;
  for (const o of g.obs) { if (o.warm > 0 || !live(o, g.view) || o.ghost) continue; if (o.z - o.hz > z && (!m[0] || Math.abs(o.x - x) < o.hx + w) && (!m[1] || Math.abs(o.y - y) < o.hy + w)) { if (o.z - o.hz < zEnd) { zEnd = o.z - o.hz; } } }
  for (const e of g.enemies) { if (e.hp <= 0 || !live(e, g.view) || e.z < z || e.z > zEnd + 1) continue; if ((!m[0] || Math.abs(e.x - x) < e.r + w) && (!m[1] || Math.abs(e.y - y) < e.r + w)) damage(g, e, dmg); }
  g.beams.push({ x, y, z0: z, z1: zEnd, life: 5, col });
}

export function step(g, inputs) {
  g.fx.length = 0; g.tick++;
  if (g.hintT > 0) g.hintT--; if (g.shake > 0) g.shake *= 0.86; if (g.flash > 0) g.flash--;
  if (g.shiftT > 0) g.shiftT = Math.max(0, g.shiftT - 1 / 22); if (g.shiftCd > 0) g.shiftCd--;
  if (g.chainT > 0 && --g.chainT === 0) g.chain = 0;
  const lv = g.level, v0 = g.view;
  const playing = g.state === 'play';

  // ----- players: shift, move, shoot -----
  let thrust = false;
  if (playing) for (const p of g.players) {
    const inp = inputs[p.i] || {}, pv = p.prev, edge = k => inp[k] && !pv[k];
    if (p.dead > 0) { if (--p.dead === 0) { if (p.lives < 0) { g.state = 'over'; g.endT = 0; g.fx.push('over', 'say:game over'); p.dead = 1e9; } else { p.x = 0; p.y = 4.5; p.z = 3; p.inv = 170; } } p.prev = inp; continue; }
    const dir = edge('shiftR') ? 1 : edge('shiftL') ? -1 : 0;
    if (dir && g.shiftCd <= 0) {
      g.viewFrom = g.view; g.view = (g.view + dir + 4) % 4; g.shiftT = 1; g.shiftDir = dir; g.shiftCd = 26; g.stats.shifts++; g.fx.push('shift');
      let n = 0; for (const q of g.players) { q.inv = Math.max(q.inv, 20); for (const b of g.ebul) if (Math.hypot(b.x - q.x, b.y - q.y, b.z - q.z) < 3.2) { b.life = 0; n++; explode(g, b.x, b.y, b.z, '#5ee7ff', 3, 4); } g.shocks.push({ x: q.x, y: q.y, z: q.z, r: 0.4, vr: 14, life: 14, max: 14, col: '#5ee7ff' }); }
      if (n) { g.chain += n; g.chainT = 170; addScore(g, 50 * n, p.x, p.y + 1, p.z, '#5ee7ff'); pop(g, 'PHASE DODGE', p.x, p.y + 1.8, p.z, '#5ee7ff'); }
    }
    if (edge('upgrade')) buy(g, p);
    if (edge('bomb')) nuke(g, p);
    if (edge('drone')) { p.dmode = (p.dmode + 1) % 4; pop(g, 'DRONES: ' + DRONE_MODES[p.dmode], p.x, p.y + 1, p.z, '#b06bff'); g.fx.push('blip'); }
    if (inp.thrust) thrust = true;
    const sp = (7.5 + 1.7 * p.up[0]) * (inp.thrust ? 1.45 : 1) * DT, mx = clamp(inp.mx || 0, -1, 1), my = clamp(inp.my || 0, -1, 1), v = g.view;
    if (v === 0) { p.z += mx * sp; p.y -= my * sp; } else if (v === 3) { p.x += mx * sp; p.z -= my * sp; } else { p.x += mx * sp; p.y -= my * sp; }
    p.x = clamp(p.x, -B.x, B.x); p.y = clamp(p.y, B.y0, B.y1); p.z = clamp(p.z, B.z0, B.z1);
    p.mvx += (mx - p.mvx) * 0.2; p.mvy += (my - p.mvy) * 0.2;
    p.hist.push(p.x, p.y, p.z); if (p.hist.length > 3 * 80) p.hist.splice(0, 3);
    if (p.inv > 0) p.inv--; if (p.god > 0) { p.god--; p.inv = Math.max(p.inv, 2); } if (p.over > 0) p.over--;
    // weapons
    if (p.fireT > 0) p.fireT--; const firing = inp.fire;
    if (firing && p.fireT <= 0) fire(g, p);
    const L = p.up[2];
    if (L && firing && --p.laserT <= 0) { p.laserT = p.over > 0 ? 3 : 5; const d = 0.5 + 0.3 * L, w = 0.35 + 0.1 * L, lat = g.view === 0 ? 'y' : 'x'; beam(g, p.x, p.y, p.z + 1, w, d, '#3dffb0');
      const offs = L >= 5 ? [1.3, -1.3, 2.6, -2.6] : L >= 3 ? [1.3, -1.3] : []; for (const o of offs) beam(g, p.x + (lat === 'x' ? o : 0), p.y + (lat === 'y' ? o : 0), p.z + 0.6, w * 0.7, d * 0.6, '#3dffb0'); if (g.tick % 10 === 0) g.fx.push('laser'); }
    const M = p.up[3];
    if (M && firing && --p.missT <= 0) { p.missT = (p.over > 0 ? 0.5 : 1) * (74 - 9 * M) | 0; for (let k = 0; k < M + 1 && g.shots.length < 400; k++) { const a = (k - M / 2) * 0.5; g.shots.push({ x: p.x, y: p.y, z: p.z, vx: Math.sin(a) * 9, vy: Math.cos(a * 2) * 5, vz: 6, dmg: 4 + M, r: 0.4, kind: 2, life: 150, aoe: M >= 3 ? 2 : 0 }); } g.fx.push('missile'); }
    // drones
    const n = p.drones.length, vw = g.view;
    for (let k = 0; k < n; k++) {
      const d = p.drones[k]; let tx = p.x, ty = p.y, tz = p.z;
      if (p.dmode === 0) { const i = p.hist.length - 3 * (k + 1) * 9; if (i >= 0) { tx = p.hist[i]; ty = p.hist[i + 1]; tz = p.hist[i + 2]; } }
      else if (p.dmode === 1) { const a = g.tick * 0.06 + k * 6.283 / n, c = Math.cos(a) * 1.7, s = Math.sin(a) * 1.7; if (vw === 0) { ty += c; tz += s; } else if (vw === 3) { tx += c; tz += s; } else { tx += c; ty += s; } }
      else if (p.dmode === 2) { const o = ((k + 1) >> 1) * 1.3 * (k % 2 ? 1 : -1); tz += 1.6; if (vw === 0) ty += o; else tx += o; }
      else { let best = null, bd = 1e9; for (const e of g.enemies) { if (e.hp <= 0 || e.z > 26 || e.z < 0) continue; const dd = Math.hypot(e.x - d.x, e.y - d.y, e.z - d.z) + k * 3 * ((e.gid || 0) % n === k ? 0 : 1); if (dd < bd) { bd = dd; best = e; } } if (best) { tx = best.x; ty = best.y; tz = Math.max(p.z, best.z - 4); } else { tx += (k - n / 2) * 1.2; tz += 1; } }
      d.x += (tx - d.x) * 0.16; d.y += (clamp(ty, 0.4, 9) - d.y) * 0.16; d.z += (tz - d.z) * 0.16;
      if (firing && (g.tick + k * 3) % (p.over > 0 ? 6 : 11) === 0 && g.shots.length < 400) g.shots.push({ x: d.x, y: d.y, z: d.z + 0.4, vx: 0, vy: 0, vz: 44, dmg: 0.5 + 0.1 * p.up[1], r: 0.25, kind: 1, life: 50 });
      if (firing && L >= 2 && (g.tick + k * 4) % 12 === 0) beam(g, d.x, d.y, d.z + 0.4, 0.25, 0.25 * L, '#b06bff');
      if (p.dmode === 1) for (const b of g.ebul) if (Math.abs(b.x - d.x) < 0.6 && Math.abs(b.y - d.y) < 0.6 && Math.abs(b.z - d.z) < 0.6) b.life = 0;
    }
    p.prev = inp;
  }

  // ----- scroll + level script -----
  const tm = thrust ? 2.1 : 1; g.speedMul += (tm - g.speedMul) * 0.08;
  const dz = playing ? SCROLL * g.speedMul * DT : SCROLL * 0.4 * DT;
  if (playing) {
    g.camZ += dz;
    if (!g.boss) while (g.evi < lv.events.length && lv.events[g.evi].z <= g.camZ) lv.events[g.evi++].fn(g);
    const zn = lv.zones.find(z => g.camZ + 12 >= z.z0 && g.camZ + 12 < z.z1);
    if (zn && zn !== g.zone) { g.zone = zn; if (zn.msg) hint(g, zn.msg, 230); }
    if (!g.boss && g.zone) g.recView = g.zone.view;
    for (const c of lv.checkpoints) if (g.camZ >= c && c > g.checkpoint) { g.checkpoint = c; g.cpSnap = snapshot(g); pop(g, 'CHECKPOINT', 0, 7, 8, '#3dffb0', true); g.fx.push('blip', 'toast:CHECKPOINT|PROGRESS SAVED'); }
  }
  const vw = g.view, m = MASK[vw], P = g.players;

  // ----- enemies -----
  for (const e of g.enemies) {
    e.t++; if (e.hit > 0) e.hit--; if (e.deflect > 0) e.deflect--;
    if (e.type === 'boss') { lv.boss.update(g, e); continue; }
    if (!e.rel) e.z -= dz;
    if (e.type === 'pop') { e.z += e.vz * DT; e.x = e.x0 + e.ax * Math.sin(e.t * 0.02 * e.w + e.ph); e.y = e.y0 + e.ay * Math.sin(e.t * 0.02 * e.w + e.ph + (e.ax ? 1.57 : 0)); }
    else if (e.type === 'saucer') { if (e.t < e.dur) { e.z += (e.hold - e.z) * 0.03; e.x = e.x0 + e.ax * Math.sin(e.t * 0.025 + e.ph); e.y = e.y0 + e.ay * Math.sin(e.t * 0.031 + e.ph); } else { e.z -= 14 * DT; } }
    else if (e.type === 'kami') { const p = P[0], s = 5.2 * DT; e.z += e.vz * DT; if (e.z > p.z) { e.x += clamp(p.x - e.x, -s, s) * m[0]; e.y += clamp(p.y - e.y, -s, s) * m[1]; } }
    if (playing && e.fire && e.z > 4 && e.z < 27 && live(e, vw) && (e.t + e.ph * 10 | 0) % e.fire === e.fire - 1) { if (e.type === 'saucer') { aimed(g, e, 10, -0.22); aimed(g, e, 10, 0); aimed(g, e, 10, 0.22); } else aimed(g, e, 11); g.fx.push('eshot'); }
    if (e.z < -4 && e.hp > 0) { e.hp = -999; if (e.group) g.groups[e.group].n = 1e9; }
  }
  // ----- shots -----
  for (const s of g.shots) {
    if (s.kind === 2) { let best = null, bd = 1e9; for (const e of g.enemies) { if (e.hp <= 0 || !live(e, vw) || e.z > 30) continue; const d = Math.hypot((e.x - s.x) * m[0], (e.y - s.y) * m[1], e.z - s.z); if (d < bd) { bd = d; best = e; } }
      if (best) { const d = bd || 1, a = 2.2; s.vx += (best.x - s.x) / d * a * m[0]; s.vy += (best.y - s.y) / d * a * m[1]; s.vz += (best.z - s.z) / d * a; } else s.vz += 1.2; const sp = Math.hypot(s.vx, s.vy, s.vz), mx = 30; if (sp > mx) { s.vx *= mx / sp; s.vy *= mx / sp; s.vz *= mx / sp; }
      if (g.tick % 2 === 0 && g.parts.length < 700) g.parts.push({ x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: -4, life: 10, max: 10, col: '#ff8a2b' }); }
    s.x += s.vx * DT; s.y += s.vy * DT; s.z += s.vz * DT; if (--s.life <= 0 || s.z > 36 || s.z < -3 || Math.abs(s.x) > 13 || s.y < -1 || s.y > 12) { s.life = 0; continue; }
    for (const e of g.enemies) { if (e.hp <= 0 || !live(e, vw)) continue; if (ov(s, e, m)) { damage(g, e, s.dmg); s.life = 0; if (s.aoe) { explode(g, s.x, s.y, s.z, '#ff8a2b', 12, 8); for (const q of g.enemies) if (q !== e && q.hp > 0 && Math.hypot(q.x - s.x, q.y - s.y, q.z - s.z) < s.aoe + q.r) damage(g, q, s.dmg * 0.5); } else if (g.parts.length < 700) g.parts.push({ x: s.x, y: s.y, z: s.z, vx: 0, vy: 3, vz: -6, life: 8, max: 8, col: '#ffffff' }); break; } }
    if (s.life > 0) for (const o of g.obs) { if (o.warm > 0 || o.ghost || !live(o, vw)) continue; if (ov(s, o, m)) { s.life = 0; if (o.hp) { o.hp -= s.dmg; o.hit = 3; } if (g.parts.length < 700) g.parts.push({ x: s.x, y: s.y, z: s.z, vx: 0, vy: 2, vz: -8, life: 7, max: 7, col: o.col }); break; } }
  }
  // ----- obstacles -----
  for (const o of g.obs) {
    if (!o.rel) o.z -= dz; o.x += o.vx * DT; o.y += o.vy * DT; o.z += o.vz * DT; if (o.hit > 0) o.hit--;
    if (o.wrap && Math.abs(o.x) > o.wrap) o.x = -Math.sign(o.x) * o.wrap;
    if (o.warm > 0) { if (--o.warm === 0) g.fx.push('zap'); } else if (o.life != null && --o.life <= 0) o.dead = true;
    if (o.hp != null && o.hp <= 0 && !o.dead) { o.dead = true; explode(g, o.x, o.y, o.z, o.col, 18, 9); addScore(g, o.score || 50, o.x, o.y, o.z); g.fx.push('boom'); if (o.pod) addPod(g, o.x, o.y, o.z); }
    if (o.z + o.hz < -5) o.dead = true;
  }
  // ----- enemy bullets -----
  for (const b of g.ebul) { b.x += b.vx * DT; b.y += b.vy * DT; b.z += b.vz * DT; if (--b.life <= 0 || b.z < -3 || b.z > 36 || Math.abs(b.x) > 12 || b.y < -1 || b.y > 11) b.life = 0; }
  // ----- pods + rings -----
  for (const q of g.pods) { q.t++; q.z -= dz * 0.75; if (q.z < -3) q.dead = true; for (const p of P) { if (p.dead > 0) continue; const dx = (p.x - q.x) * m[0], dy = (p.y - q.y) * m[1], dzz = p.z - q.z, d = Math.hypot(dx, dy, dzz); if (d < 4.5) { q.x += dx / (d + 0.01) * 9 * DT; q.y += dy / (d + 0.01) * 9 * DT; q.z += dzz / (d + 0.01) * 9 * DT; }
    if (d < 1.1 && !q.dead) { q.dead = true; if (q.kind === 'pod') { p.cursor = (p.cursor + 1) % BAR.length; g.fx.push('pod'); addScore(g, 50); } else if (q.kind === 'god') { p.god = 600; pop(g, 'GOD MODE!', p.x, p.y + 1, p.z + 2, '#ffffff', true); g.fx.push('god', 'say:god mode'); } else if (q.kind === 'bomb') { p.bombs = Math.min(9, p.bombs + 1); pop(g, '+BOMB', p.x, p.y + 1, p.z, '#ff8a2b'); g.fx.push('pod'); } } } }
  for (const r of g.rings) { const pz = r.z; r.z -= dz; if (r.z < -4) r.dead = true; if (r.got) continue; for (const p of P) { if (p.dead > 0) continue; if (pz >= p.z && r.z < p.z && live(r, vw) && Math.hypot((p.x - r.x) * m[0], (p.y - r.y) * m[1]) < r.r) { r.got = true;
    if (r.kind === 'warp') { g.flags.warp = true; g.score += 5000; pop(g, lv.warpMsg || 'WARP FOUND', p.x, p.y + 1.5, p.z + 3, '#b06bff', true); pop(g, '+5000', p.x, p.y + 0.5, p.z + 3, '#ffe14a', true); g.fx.push('warp', 'say:warp locked in', 'toast:WARP FOUND|' + (lv.warpMsg || '')); g.flash = 14; explode(g, r.x, r.y, p.z, '#b06bff', 50, 14); }
    else { g.chain += 2; g.chainT = 170; addScore(g, 300, r.x, r.y, p.z, '#3dffb0'); g.fx.push('ring'); } } } }

  // ----- player collisions -----
  if (playing) for (const p of P) {
    if (p.dead > 0) continue; const pb = { x: p.x, y: p.y, z: p.z, hx: 0.34, hy: 0.24, hz: 0.5 };
    for (const b of g.ebul) if (b.life > 0 && ov(pb, b, m, -0.08)) { b.life = 0; g.cause = 'bullet'; hurt(g, p); }
    for (const e of g.enemies) if (e.hp > 0 && live(e, vw) && ov(pb, e, m, -0.1)) { if (p.god > 0) { if (e.type !== 'boss') damage(g, e, 50); } else { if (e.type !== 'boss') damage(g, e, 3); g.cause = e.shape || e.type; hurt(g, p); } }
    for (const o of g.obs) if (!o.dead && !o.ghost && o.warm <= 0 && live(o, vw) && ov(pb, o, m, -0.05)) { if (p.god > 0 && o.hp != null) o.hp = 0; else if (p.god <= 0) { g.cause = o.kind; hurt(g, p); } }
  }
  // ----- effects + cleanup -----
  for (const q of g.parts) { q.x += q.vx * DT; q.y += q.vy * DT; q.z += q.vz * DT - dz * 0.5; q.vx *= 0.96; q.vy *= 0.96; q.vz *= 0.96; q.life--; }
  for (const s of g.shocks) { s.r += s.vr * DT; s.life--; }
  for (const b of g.beams) b.life--;
  for (const q of g.pops) { q.y += 1.2 * DT; q.life--; }
  const keep = (a, f) => { let j = 0; for (let i = 0; i < a.length; i++) if (f(a[i])) a[j++] = a[i]; a.length = j; };
  keep(g.enemies, e => e.hp > 0 || e.type === 'boss' && !e.gone); keep(g.shots, s => s.life > 0); keep(g.ebul, b => b.life > 0); keep(g.obs, o => !o.dead);
  keep(g.pods, q => !q.dead); keep(g.rings, r => !r.dead); keep(g.parts, q => q.life > 0); keep(g.shocks, s => s.life > 0); keep(g.beams, b => b.life > 0); keep(g.pops, q => q.life > 0);
  if (g.state !== 'play') g.endT++;
  return g;
}

// ---------- autopilot (idle mode + attract demo + headless tests) ----------
const TAU = [0, 0.12, 0.25, 0.4, 0.6, 0.85, 1.15, 1.5, 1.9];
export function autopilot(g, i = 0) {
  const p = g.players[i], out = { fire: true, mx: 0, my: 0 }; if (!p || p.dead > 0) return out;
  const want = g.recView, pv = p.prev || {};
  if (g.view !== want && g.shiftCd <= 0) { const d = (want - g.view + 4) % 4; if (d === 3) out.shiftL = !pv.shiftL; else out.shiftR = !pv.shiftR; }
  const v = g.view, m = MASK[v], sc = SCROLL * g.speedMul;
  const A = v === 0 ? 'z' : 'x', Bx = v === 3 ? 'z' : 'y';
  const ra = A === 'z' ? [1, 2.5, 4, 5.5, 7, 9] : [-7, -5.25, -3.5, -1.75, 0, 1.75, 3.5, 5.25, 7], rb = Bx === 'z' ? [1, 2.5, 4, 5.5, 7, 9] : [1, 2.1, 3.2, 4.3, 5.4, 6.5, 7.6, 8.5];
  const spd = 7.5 + 1.7 * p.up[0];
  let best = null, bc = 1e9; const c = { x: p.x, y: p.y, z: p.z, hx: 0.75, hy: 0.6, hz: 0.9 }, t = { x: 0, y: 0, z: 0, hx: 0, hy: 0, hz: 0 };
  let tgt = null, td = 1e9; for (const e of g.enemies) if (e.hp > 0 && live(e, v) && e.z > p.z + 2 && e.z < 26) { const d = e.z + (e.type === 'boss' ? -50 : 0); if (d < td) { td = d; tgt = e; } }
  let pod = null; for (const q of g.pods) if (q.z > p.z - 1 && q.z < 16) { pod = q; break; }
  for (const a of ra) for (const b of rb) {
    c.x = p.x; c.y = p.y; c.z = p.z; c[A] = a; c[Bx] = b;
    const dist = Math.hypot(c[A] - p[A], c[Bx] - p[Bx]); let cost = dist * 0.5;
    for (const tau of TAU) {
      { const da = a - p[A], db = b - p[Bx], mv = spd * tau; c[A] = p[A] + clamp(da, -mv, mv); c[Bx] = p[Bx] + clamp(db, -mv, mv); } // where the ship really is at that moment: both axes move at full speed
      const w = 1 / (tau + 0.2);
      for (const o of g.obs) { if (o.ghost || !live(o, v) || o.warm > tau * 60 + 6) continue; if (o.life != null && o.warm <= 0 && o.life < tau * 60) continue; t.x = o.x + o.vx * tau; t.y = o.y + o.vy * tau; t.z = o.z + (o.vz - (o.rel ? 0 : sc)) * tau; t.hx = o.hx; t.hy = o.hy; t.hz = o.hz; if (o.wrap && Math.abs(t.x) > o.wrap) t.x -= Math.sign(t.x) * o.wrap * 2; if (ov(c, t, m)) cost += 60 * w; }
      if (tau < 1.2) { for (const bl of g.ebul) { t.x = bl.x + bl.vx * tau; t.y = bl.y + bl.vy * tau; t.z = bl.z + bl.vz * tau; t.hx = t.hy = t.hz = 0.3; if (ov(c, t, m)) cost += 30 * w; }
        for (const e of g.enemies) { if (e.hp <= 0 || !live(e, v) || (tau > 0.45 && e.type !== 'boss' && e.hp <= 3)) continue; t.x = e.x; t.y = e.y; t.z = e.z + (e.type === 'boss' ? 0 : (e.vz || 0) * tau); t.hx = e.hx ?? e.r; t.hy = e.hy ?? e.r; t.hz = e.hz ?? e.r; if (ov(c, t, m)) cost += 40 * w; } }
    }
    c[A] = a; c[Bx] = b;
    if (pod) cost += Math.hypot((c.x - pod.x) * m[0], (c.y - pod.y) * m[1], c.z - pod.z) * 0.25;
    else if (tgt) cost += (Math.abs((c.x - tgt.x) * m[0]) + Math.abs((c.y - tgt.y) * m[1])) * 0.3 + (A === 'z' || Bx === 'z' ? Math.abs(c.z - 3) * 0.2 : 0);
    else cost += Math.abs(c.x) * 0.1 * m[0] + Math.abs(c.y - 4.5) * 0.1 * m[1] + Math.abs(c.z - 3) * 0.15;
    if (p.ap && p.ap.v === v && p.ap.a === a && p.ap.b === b) cost -= 10; // stick with the last plan unless something is clearly better
    if (cost < bc) { bc = cost; best = { a, b }; }
  }
  if (best) p.ap = { v, a: best.a, b: best.b };
  if (best) { const da = best.a - p[A], db = best.b - p[Bx]; const ma = Math.abs(da) > 0.15 ? Math.sign(da) : 0, mb = Math.abs(db) > 0.15 ? Math.sign(db) : 0;
    if (v === 0) { out.mx = ma; out.my = -mb; } else if (v === 3) { out.mx = ma; out.my = -mb; } else { out.mx = ma; out.my = -mb; } }
  if (bc > 150 && p.bombs > 0 && !pv.bomb && p.inv <= 0) out.bomb = true;
  const cu = p.cursor; if (cu >= 0 && !pv.upgrade) { const lo = Math.min(p.up[1], p.up[2], p.up[3], p.up[4]); if (cu === 6 || cu === 0 && p.up[0] < 2 || cu >= 1 && cu <= 4 && p.up[cu] <= lo && p.up[cu] < 5 || cu === 5 && p.shield < 2) out.upgrade = true; }
  return out;
}
