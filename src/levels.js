// 2DISO SHIFT — every level. Four planets, each with a hidden warp to a bonus stage.
// Each stretch is built so one view is the way through; the banner and the flashing view pip say which.
import { addEnemy, addObs, addRing, addPod, bullet, aimed, explode, hint, doShift, pop, near, SPAWN_Z, DT, VIEWS } from './game.js';
const SIDE = 0, ISO = 1, CHASE = 2, TOP = 3;

const FAR = 48;
// ---------- builder kit ----------
function kit(id) {
  const ev = [], zones = [], checkpoints = []; let gid = 0;
  const at = (z, fn) => ev.push({ z: z - SPAWN_Z, fn });
  const far = (z, fn, ob) => ev.push({ z: z - FAR, lim: z - SPAWN_Z, fn, oz: ob ? z : null }); // scenery is placed well beyond the old horizon and fades in, so nothing pops up in your face
  const obs = (z, o) => far(z, g => addObs(g, { ...o, z: z - g.camZ }), true);
  const ring = (z, r) => far(z, g => addRing(g, { ...r, z: z - g.camZ }));
  const en = (z, o) => at(z, g => addEnemy(g, o));
  const ground = (z, o) => far(z, g => addEnemy(g, { rel: false, z: z - g.camZ, y: 0.5, y0: 0.5, type: 'turret', ...o }));
  const wing = (z, n, o, gap = 2.2) => { const gr = id + (++gid); for (let i = 0; i < n; i++) at(z + i * gap, g => addEnemy(g, { type: 'pop', group: gr, gn: n, hp: 2, ph: i * 0.5, ...o })); };
  const warp = (z, x, y) => ev.push({ z, fn: g => { if (g.flags.warp) return; addRing(g, { x, y, z: 10, r: 2, kind: 'warp', stay: true, t: 0, life: 900 }); hint(g, 'ANOMALY - SHIFT TO CHASE VIEW AND FLY INTO IT', 320); g.fx.push('ring'); } });
  // extra waves: every `step` units a flight of the level's own enemy, shaped for the view that stretch is played in, with divers in between
  const fill = (tmpl, from, to, step, clut = 'billboard', gshape = 'tank') => { for (let i = 0, z = from; z < to; z += step, i++) { const v = (zones.find(q => z >= q.z0 && z < q.z1) || {}).view, h = Math.abs(Math.sin(z * 12.9898)) % 1, h2 = Math.abs(Math.sin(z * 78.233)) % 1;
    const o = v === 0 ? { x: 0, y: 2.4 + h * 5, ay: 1.2 + h2 } : v === 3 ? { x: h * 9 - 4.5, ax: 3 + h2 * 2, y: 5 } : { x: h * 6 - 3, y: 3 + h2 * 4, ax: 2.5, ay: 1 };
    if (i % 4 === 1) { const cy = v === 3 ? 5 : 2.2 + h2 * 5, cx = v === 0 ? 0 : h * 10 - 5; obs(z + step / 2, { x: cx, y: cy, hx: 0.8, hy: 0.8, hz: 0.8, col: tmpl.col, kind: clut, hp: 3, score: 60, gem: i % 8 === 1, pod: i % 8 === 5 }); } // and something small to blast in the gaps
    if (i % 5 === 3 || i % 10 === 8) { const up = i % 10 === 8, yy = up ? 8.9 : 0.75; ground(z + step * 0.3, { type: 'walker', x: h2 * 12 - 6, vx: (h > 0.5 ? 1 : -1) * (1.2 + h2), y: yy, y0: yy, col: tmpl.col, hp: 4, r: 0.85, score: 200, fire: 150, bs: 6, shape: gshape, ceil: up, pod: i % 10 === 3 }); } // ground troops: they walk or drive the floor (and sometimes the ceiling) and shoot
    if (i % 3 === 2) for (let k = 0; k < 3; k++) en(z + k * 2.5, { ...tmpl, type: 'kami', hp: 1, vz: -6, score: 80, x: v === 0 ? 0 : (k - 1) * 3 + o.x * 0.5, y: v === 3 ? 5 : 2.5 + ((k + i) % 3) * 2.2 }); else wing(z, 4 + (i % 2), { ...tmpl, ...o }); } };
  const zone = (z0, z1, view, msg) => zones.push({ z0, z1, view, msg });
  const gate = (z, hx, hy, o = {}) => { const w = o.w || 2.2, h = o.h || 1.9, k = { hz: 0.5, kind: 'gate', col: '#ffe14a', ...o }, X = 11, T = 12.5, Bm = -3;
    obs(z, { x: (-X + hx - w) / 2, y: 4.75, hx: (hx - w + X) / 2, hy: 7.75, ...k }); obs(z, { x: (X + hx + w) / 2, y: 4.75, hx: (X - hx - w) / 2, hy: 7.75, ...k });
    obs(z, { x: hx, y: (T + hy + h) / 2, hx: w, hy: (T - hy - h) / 2, ...k }); obs(z, { x: hx, y: (hy - h + Bm) / 2, hx: w, hy: (hy - h - Bm) / 2, ...k });
    obs(z, { x: hx, y: hy, hx: w, hy: h, hz: 0.5, ghost: true, kind: 'safe', osc: k.osc }); if (!o.noRing && !k.osc) ring(z, { x: hx, y: hy, r: 1.5 }); };
  const done = extra => { // nothing solid sits right around a change of view: you get a clear run to make the shift
    for (let i = ev.length - 1; i >= 0; i--) { const e = ev[i]; if (e.oz != null && zones.some((q, k) => k > 0 && e.oz > q.z0 - 30 && e.oz < q.z0 + 8)) ev.splice(i, 1); }
    ev.sort((a, b) => a.z - b.z); return { id, events: ev, zones, checkpoints, len: extra.endZ || zones.find(q => q.z1 > 1e8)?.z0 || 0, ...extra }; };
  return { at, obs, ring, en, ground, wing, zone, gate, warp, fill, checkpoints, done };
}

// ---------- boss engine: stages that are only open from one view, attacks that fill the screen in the wrong one ----------
const RED = '#ff4d6d';
function sheetH(g, gapY, gapH, o = {}) { const k = { rel: true, x: 0, z: 9, hx: 9, hz: 11, warm: 100, life: 46, col: RED, kind: 'sheet', ...o };
  addObs(g, { ...k, y: gapY - gapH - 6, hy: 6 }); addObs(g, { ...k, y: gapY + gapH + 6, hy: 6 }); addObs(g, { ...k, y: gapY, hy: gapH, ghost: true, kind: 'safe', life: k.warm + k.life, warm: 0 }); g.fx.push('charge'); }
function sheetV(g, gapX, gapW, o = {}) { const k = { rel: true, y: 4.8, z: 9, hy: 5, hz: 11, warm: 100, life: 46, col: RED, kind: 'sheet', ...o };
  addObs(g, { ...k, x: gapX - gapW - 10, hx: 10 }); addObs(g, { ...k, x: gapX + gapW + 10, hx: 10 }); addObs(g, { ...k, x: gapX, hx: gapW, ghost: true, kind: 'safe', life: k.warm + k.life, warm: 0 }); g.fx.push('charge'); }
function throwGate(g, b, o = {}) { const hx = -4 + g.rand() * 8, hy = 2.8 + g.rand() * 3.8, w = 2.3, h = 2, k = { rel: true, z: b.z - 2, hz: 0.45, vz: -8, col: '#ffe14a', kind: 'gate', ...o };
  addObs(g, { ...k, x: (-9 + hx - w) / 2, y: 4.8, hx: (hx - w + 9) / 2, hy: 5 }); addObs(g, { ...k, x: (9 + hx + w) / 2, y: 4.8, hx: (9 - hx - w) / 2, hy: 5 }); addObs(g, { ...k, x: hx, y: (9.8 + hy + h) / 2, hx: w, hy: (9.8 - hy - h) / 2 }); addObs(g, { ...k, x: hx, y: (hy - h) / 2, hx: w, hy: (hy - h) / 2 });
  addObs(g, { ...k, x: hx, y: hy, hx: w, hy: h, ghost: true, kind: 'safe' }); g.fx.push('charge'); }
// the boss looks straight at you: 'y' = a flat beam at your height (for SIDE), 'x' = a column at your x (for TOP), 'xy' = a narrow shaft (for CHASE / ISO). It aims, locks, then fires.
// c = ticks since the stare began. The boss turns to face the nearest ship, following it, then holds still for a moment and fires one big beam straight out of its eye.
function stare(g, b, c, o = {}) { const p = near(g, b), hz = (b.z - 2.5) / 2;
  if (c === 0) { b.ovx = b.x; b.ovy = b.y; b.ray = addObs(g, { rel: true, kind: 'beam', x: b.x, y: b.y, z: hz + 0.5, hx: 1.15, hy: 0.95, hz, warm: 115, life: 55, col: '#ffffff', ...o }); g.fx.push('charge'); }
  if (c < 88) { if (o.trackX !== false) b.ovx += (Math.max(-6, Math.min(6, p.x)) - b.ovx) * 0.07; b.ovy += (Math.max(1.6, Math.min(8, p.y)) - b.ovy) * 0.07; }
  if (c === 115) { g.fx.push('hyper'); g.shake = Math.max(g.shake, 8); }
  if (c < 172) { b.ovOn = true; const r = b.ray; if (r && !r.dead) { r.x = r.bx = b.x; r.y = r.by = b.y; } } }
// a lightning strike (or anything else that comes straight down): a ring on the ground warns you, then the column fills
const strike = (g, x, z, o = {}) => addObs(g, { rel: true, kind: 'strike', x, y: 4.75, z, hx: 0.95, hy: 4.75, hz: 0.95, warm: 70, life: 28, col: '#7df9ff', ...o });
// a ring of fire with one gap in it, widening as it comes
function fireRing(g, b, col, n = 16, sp = 2.6, hole = 4) { const gap = g.rand() * n | 0; for (let i = 0; i < n; i++) if ((i - gap + n) % n >= hole) { const a = i / n * 6.283; bullet(g, b.x, b.y, b.z - 2, Math.cos(a) * sp, Math.sin(a) * sp, -6, col); } g.fx.push('eshot'); }
const fan = (g, b, n, sp = 8, col) => { for (let i = 0; i < n; i++) aimed(g, b, sp, (i - (n - 1) / 2) * 0.17, col); g.fx.push('eshot'); };
function boss(spec) {
  const update = (g, b, dt) => {
    const S = spec.stages[b.stage], p = g.players[0];
    if (b.dying) { b.dying++; g.lockShift = true; for (const q of g.players) q.inv = Math.max(q.inv, 40); // the finisher: the fold rolls through all four views while it comes apart
      if (b.dying % 36 === 2 && b.dying < 146) { g.viewFrom = g.view; g.view = (g.view + 1) % 4; g.shiftT = 1; g.shiftDir = 1; g.fx.push('shift', 'boom2'); g.flash = 8; for (let i = 0; i < 3; i++) g.shocks.push({ x: b.x, y: b.y, z: b.z, r: 0.5, vr: 14 + i * 10, life: 30, max: 30, col: ['#ffffff', '#ff3df0', '#2ee6ff'][i] }); }
      if (b.dying % 6 === 0) { explode(g, b.x + (g.rand() - 0.5) * 5, b.y + (g.rand() - 0.5) * 5, b.z + (g.rand() - 0.5) * 3, ['#ff3df0', '#ffe14a', '#2ee6ff', '#ffffff'][b.dying / 6 & 3], 26, 14, spec.splat); g.fx.push('boom2'); g.shake = 12; }
      if (b.dying > 150) { explode(g, b.x, b.y, b.z, '#ffffff', 90, 26, spec.splat); g.flash = 20; g.shake = 22; b.gone = true; g.boss = null; g.lockShift = false; g.score += b.score; g.state = 'clear'; g.endT = 0; g.fx.push('clear', 'say:' + spec.name + ' destroyed. sector clear.', 'toast:LEVEL COMPLETE|' + spec.toast); } return; }
    g.recView = S.rec; if (b.z > 29) { b.z -= 6 * dt; b.st = 0; return; }
    b.vuln = S.vuln; b.col = S.col; b.st++;
    b.x = Math.sin(b.st * 0.011) * (S.sway ?? 1.5); b.y = 4.6 + Math.sin(b.st * 0.017) * (S.bob ?? 0.8);
    b.ovk = Math.max(0, Math.min(1, (b.ovk || 0) + (b.ovOn ? 0.05 : -0.03))); b.ovOn = false; if (b.st % 400 === 240) addPod(g, (g.rand() - 0.5) * 10, 2 + g.rand() * 5, b.z - 2); if (b.ovk > 0) { b.x += (b.ovx - b.x) * b.ovk; b.y += (b.ovy - b.y) * b.ovk; } // an attack can take over where the boss is (the Eye turning to face you)
    if (b.hp <= 0) {
      if (b.stage < spec.stages.length - 1) { b.stage++; b.hp = b.max; b.st = -110; g.obs.length = 0; g.ebul.length = 0; explode(g, b.x, b.y, b.z, S.col, 60, 18, spec.splat); g.shake = 14; g.flash = 8; g.fx.push('boom2'); addPod(g, b.x - 1, b.y, b.z - 2); addPod(g, b.x + 1, b.y, b.z - 3); g.score += 5000; hint(g, 'SHELL DOWN - SHIFT TO ' + VIEWS[spec.stages[b.stage].rec] + ' VIEW', 220); }
      else { b.dying = 1; g.obs.length = 0; g.ebul.length = 0; hint(g, spec.name + ' DESTROYED', 200); } return; }
    if (b.st < 0) return;
    S.attack(g, b, b.st);
    if (b.deflect === 5 && g.tick % 90 < 8) pop(g, 'SHIELDED - SHIFT TO ' + VIEWS[S.rec], p.x, p.y + 1.5, p.z + 3, RED);
  };
  return { update, stages: spec.stages, name: spec.name };
}
const spawnBoss = (K, z, o) => K.at(z, g => { g.boss = addEnemy(g, { type: 'boss', x: 0, y: 4.6, z: 42, hx: 2.6, hy: 2.8, hz: 1.8, r: 2.6, hp: 520, col: '#ff3df0', score: 20000, big: true, stage: 0, vuln: [], st: 0, ...o }); g.fx.push('bossin'); });

// =====================================================================================
// LEVEL 1 — EARTH // NEO TERRA: neon cyber-city
// =====================================================================================
function earth() {
  const K = kit('earth'), { at, obs, ring, en, ground, wing, zone, gate } = K;
  const C = { tower: '#2ee6ff', sky: '#ff3df0', car: '#ff8a2b', pylon: '#b06bff' };
  const dart = { col: '#ff3df0' }, carrier = (z, o) => en(z, { type: 'pop', pod: true, col: '#ff8a2b', hp: 6, r: 0.8, score: 300, vz: -6, shape: 'carrier', ...o });
  const saucer = (z, o) => en(z, { type: 'saucer', col: '#3dffb0', hp: 7, r: 0.9, score: 400, hold: 15, dur: 420, ax: 4, ay: 1, fire: 110, shape: 'saucer', ...o });
  const kami = (z, o) => en(z, { type: 'kami', col: RED, hp: 2, r: 0.55, score: 150, vz: -11, shape: 'kami', ...o });
  const turret = (z, x) => ground(z, { x, x0: x, col: '#ffe14a', hp: 4, r: 0.7, score: 200, fire: 120, shape: 'turret', ph: (x + 9) * 0.37 });
  const tower = (z, x, h, o) => obs(z, { x, y: h / 2, hx: 1.3, hy: h / 2, hz: 1.3, col: C.tower, kind: 'tower', ...o });
  const slab = (z, low, o) => obs(z, low ? { x: 0, y: 2.1, hx: 8.6, hy: 2.1, hz: 1.2, col: C.sky, kind: 'slab', ...o } : { x: 0, y: 6.95, hx: 8.6, hy: 2.55, hz: 1.2, col: C.sky, kind: 'slab', ...o });
  const car = (z, x, y, vx, hx = 1.3) => obs(z, { x, y, hx, hy: hx > 2 ? 0.6 : 0.45, hz: 0.7, vx, wrap: 11, col: hx > 2 ? '#ffe14a' : C.car, kind: 'car' });
  const sign = (z, x, y) => obs(z, { x, y, hx: 1.6, hy: 0.8, hz: 0.3, col: '#ff3df0', kind: 'billboard', hp: 5, score: 150, gem: true }); // neon billboards: shoot them down for gems
  const lift = (z, ph) => obs(z, { x: 0, y: 4.75, hx: 2.2, hy: 0.55, hz: 1.1, col: '#3dffb0', kind: 'elevator', osc: { ax: 0, ay: 2.7, w: 1.1, ph } }); // freight lifts riding up and down between the skyways
  const fence = (z, x, ph) => obs(z, { x, y: 4.75, hx: 0.4, hy: 4.75, hz: 0.5, col: '#ff4d6d', kind: 'bolt', pulse: [60, 80, ph] }); // security laser fences that blink on and off

  zone(-99, 110, SIDE, 'SECTOR 1 // NEO TERRA');
  at(40, g => hint(g, 'L / R  SHIFT VIEW     B  CHANGE SPEED', 240));
  for (let z = 30; z < 108; z += 9) tower(z, ((z * 7) % 13) - 6, 1.4 + (z % 4) * 0.45);
  sign(48, 2, 7.6); sign(78, -3, 2.6); sign(96, 0, 7.2);
  wing(38, 5, { ...dart, y: 6.5, ay: 1.6, x: 0 }); wing(58, 5, { ...dart, y: 4.2, ay: 1.4, x: -2 }); carrier(72, { y: 6, x: 2 }); wing(86, 6, { ...dart, y: 7, ay: 1.5, x: 3 }); carrier(100, { y: 5, x: -2 });

  zone(110, 335, TOP, 'SKYSCRAPERS - SHIFT TO TOP VIEW');
  for (let i = 0, z = 146; z < 322; z += 16, i++) { for (const x of i % 2 ? [-3.2, 3.2] : [-6.4, 0, 6.4]) tower(z, x, 9.5);
    if (i % 2) { obs(z, { x: -8.1, y: 4.75, hx: 0.5, hy: 4.75, hz: 1.3, col: C.tower, kind: 'tower' }); obs(z, { x: 8.1, y: 4.75, hx: 0.5, hy: 4.75, hz: 1.3, col: C.tower, kind: 'tower' }); }
    if (i % 3 === 1) turret(z + 8, i % 2 ? 0 : 3.2); if (i % 3 === 2) turret(z + 8, -3.2);
    if (i % 4 === 0 && i) car(z + 8, -8 + i, 5, i % 8 ? 2.6 : -2.6, 2.4); if (i % 4 === 2) fence(z + 8, i % 8 === 2 ? 6.4 : -6.4, i * 30); } // cross traffic and laser fences between the towers
  wing(162, 5, { ...dart, x: 0, ax: 4, y: 5 }); saucer(192, { x: 0, y: 6 }); wing(228, 6, { ...dart, x: -2, ax: 5, y: 3 }); carrier(252, { x: 3.2, y: 5 }); wing(278, 5, { ...dart, x: 2, ax: 4, y: 6 }); carrier(305, { x: -3.2, y: 5 });
  K.checkpoints.push(338);

  zone(335, 565, SIDE, 'SKYWAYS AHEAD - SHIFT TO SIDE VIEW');
  for (let i = 0, z = 372; z < 550; z += 18, i++) { slab(z, i % 2 === 0); if (i % 3 === 2) slab(z + 6, i % 2 === 0); if (i % 3 === 0 && i) lift(z + 9, i); if (i % 3 === 1) sign(z + 10, 0, i % 2 ? 7.4 : 2.2); }
  wing(384, 4, { ...dart, y: 5.6, ay: 0.6, x: 0 }); wing(418, 5, { ...dart, y: 3, ay: 0.8, x: 2 }); carrier(444, { y: 5, x: -2 }); kami(476, { x: 0, y: 5 }); wing(504, 6, { ...dart, y: 5, ay: 1.8, x: 0 }); carrier(534, { y: 4.6, x: 1 });
  K.checkpoints.push(568);

  zone(565, 800, CHASE, 'FIREWALL GATES - SHIFT TO CHASE VIEW');
  const holes = [[0, 4.5], [3.5, 6], [-3.5, 3.2], [3, 3], [-3, 6.4], [0, 5], [4.5, 4.4], [-4.5, 5.2], [0, 3.2]];
  holes.forEach(([x, y], i) => { const z = 604 + i * 22; gate(z, x, y); if (i % 2) kami(z + 11, { x: x * 0.5, y }); else if (i % 4 === 2) carrier(z + 11, { x: holes[i + 1][0], y: holes[i + 1][1], vz: -5 }); });
  wing(588, 4, { ...dart, x: 0, y: 4.5, ax: 2, ay: 1 });
  K.checkpoints.push(804);

  // a tower going up: half-built girders at every height, crane loads swinging across the lane, crate stacks to shoot through. Only ISO shows it all
  zone(800, 1010, ISO, 'CONSTRUCTION ZONE - SHIFT TO ISO VIEW');
  const girder = (z, x, y, hx = 4.3) => obs(z, { x, y, hx, hy: 0.42, hz: 0.7, col: '#ffe14a', kind: 'girder' });
  const crate = (z, x, y, o) => obs(z, { x, y, hx: 1, hy: 1, hz: 1, col: '#ff8a2b', kind: 'crate', hp: 7, score: 120, ...o });
  const crane = (z, x, ph) => { obs(z, { x, y: 4.75, hx: 0.45, hy: 4.75, hz: 0.45, col: '#ffe14a', kind: 'crane', jib: x > 0 ? -1 : 1 }); obs(z, { x: x > 0 ? x - 4.6 : x + 4.6, y: 4.4, hx: 1.1, hy: 1, hz: 1.1, col: '#ff8a2b', kind: 'load', osc: { ax: 3.3, ay: 0.5, w: 1.3, ph } }); };
  for (let i = 0, z = 838; z < 1000; z += 13, i++) { const m = i % 4, sd = i % 8 < 4 ? 1 : -1;
    if (m === 0) { girder(z, -4.3 * sd, 2.5); girder(z, 4.3 * sd, 6.9); }
    else if (m === 1) crane(z, 7.4 * sd, i * 1.3);
    else if (m === 2) { girder(z, 4.3 * sd, 3.4); girder(z, -4.3 * sd, 7.4); crate(z + 6, -2.4 * sd, 1, { gem: true }); crate(z + 6, -2.4 * sd, 3, { pod: i % 8 === 2 }); }
    else { girder(z, 0, 5, 3); crate(z, -6 * sd, 1); crate(z, 6 * sd, 1); crate(z, 6 * sd, 3, { gem: true }); turret(z + 6, 3.5 * sd); } }
  wing(850, 5, { ...dart, x: 0, y: 5, ax: 3, ay: 1.2 }); carrier(880, { x: -3, y: 6 }); kami(905, { x: 2, y: 4 }); wing(930, 6, { ...dart, x: -2, y: 4, ax: 4, ay: 1.4 }); saucer(958, { x: 2, y: 6.4 }); carrier(985, { x: 3, y: 4 });
  K.checkpoints.push(1014);

  zone(1010, 1220, CHASE, 'HOVER TRAFFIC - SHIFT TO CHASE VIEW');
  for (let i = 0, z = 1048; z < 1210; z += 10, i++) { const y = [2.4, 5, 7.4][i % 3], d = i % 2 ? 4 : -4; car(z, -8 + (i * 5) % 16, y, d); car(z, 2 - (i * 3) % 10, y, d); car(z + 5, 6 - (i * 7) % 14, [5, 7.4, 2.4][i % 3], -d * 1.4, i % 3 === 0 ? 2.4 : 1.3); car(z + 2.5, -6 + (i * 4) % 13, [7.4, 2.4, 5][i % 3], d * 0.8); car(z + 7.5, 5 - (i * 6) % 12, [2.4, 5, 7.4][(i + 1) % 3], -d); if (i % 4 === 1) obs(z + 5, { x: ((i * 5) % 11) - 5, y: 4.75, hx: 0.7, hy: 4.75, hz: 0.7, col: C.pylon, kind: 'pylon' }); if (i % 6 === 3 && z < 900) slab(z + 5, false, { hz: 0.8 }); }
  K.warp(58, 3, 6.4);
  wing(1062, 5, { ...dart, x: 0, y: 6, ax: 3, ay: 1 }); saucer(1094, { x: -2, y: 6.5 }); carrier(1126, { x: -4, y: 4 }); wing(1162, 6, { ...dart, x: 2, y: 3.5, ax: 4, ay: 1.5 }); carrier(1190, { x: 2, y: 6 });
  K.checkpoints.push(1224);

  zone(1220, 1290, TOP, 'LOCKDOWN - TOP VIEW!');
  for (let i = 0, z = 1254; z < 1286; z += 16, i++) { for (const x of i % 2 ? [-3.2, 3.2] : [-6.4, 0, 6.4]) tower(z, x, 9.5); turret(z + 8, i % 2 ? 0 : -3.2); }
  zone(1290, 1360, SIDE, 'SIDE VIEW!'); for (let i = 0, z = 1322; z < 1356; z += 16, i++) slab(z, i % 2 === 1);
  zone(1360, 1435, CHASE, 'CHASE VIEW!'); [[-3, 5], [3, 3.4], [0, 6]].forEach(([x, y], i) => gate(1390 + i * 19, x, y));
  at(1240, g => addPod(g, 0, 5, SPAWN_Z, 'god')); wing(1244, 4, { ...dart, x: 0, y: 5, ax: 4 }); kami(1335, { x: 0, y: 6 }); carrier(1370, { x: -3, y: 5 }); carrier(1425, { x: 0, y: 6 });
  K.checkpoints.push(1438);

  zone(1435, 1e9, SIDE, 'WARNING // OVERSEER CORE ONLINE');
  spawnBoss(K, 1486, { name: 'OVERSEER', look: 'overseer', hp: 1100 });
  const B = boss({ name: 'OVERSEER', toast: 'EARTH DEFENDED', stages: [
    { name: 'FIREWALL', vuln: [SIDE], rec: SIDE, col: '#ff3df0', bob: 2, attack(g, b, t) { if (t % 330 === 40) sheetH(g, 2 + g.rand() * 5.2, 1.6, { warm: 150 }); if (t % 140 === 100) fan(g, b, 3, 6.5); } },
    { name: 'GRIDLOCK', vuln: [TOP], rec: TOP, col: '#2ee6ff', sway: 4, attack(g, b, t) { if (t % 330 === 40) sheetV(g, -5 + g.rand() * 10, 1.9, { warm: 150 }); if (t % 330 === 220) for (let i = 0; i < 4; i++) addEnemy(g, { type: 'pop', x: -5 + i * 3.3, y: 4.6, z: b.z - 1, vz: -5, ax: 1.5, hp: 2, col: '#ff3df0', ph: i }); if (t % 165 === 120) for (let i = -2; i <= 2; i++) bullet(g, b.x, 4.6, b.z - 2, i * 2.2, 0, -6); } },
    { name: 'CORE BREACH', vuln: [CHASE, ISO], rec: CHASE, col: '#ffe14a', attack(g, b, t) { if (t % 270 === 30) throwGate(g, b, { vz: -5.5 }); if (t % 22 === 0 && t % 270 > 200) { const a = t * 0.09; bullet(g, b.x, b.y, b.z - 2, Math.cos(a) * 3, Math.sin(a) * 3, -6, '#ff3df0'); } } }] });
  K.fill(dart, 125, 1400, 50, 'billboard');
  return K.done({ name: 'EARTH', title: 'NEO TERRA', boss: B, warpName: 'THE MOON', theme: { sky: 'city', grid: '#2443c8' } });
}

// =====================================================================================
// LEVEL 2 — MARS // THE FORGE: lava geysers, fire arcs, magma worms
// =====================================================================================
function mars() {
  const K = kit('mars'), { at, obs, ring, en, ground, wing, zone, gate } = K;
  const ember = { col: '#ff8a2b', shape: 'ember' }, FIRE = '#ff5a1f', ROCK = '#c0532a';
  const cone = (z, x, h = 2.2) => obs(z, { x, y: h / 2, hx: 1.4, hy: h / 2, hz: 1.4, col: ROCK, kind: 'cone' });
  const STONE = '#d98a5a';
  // stone heads: sentinels planted in the ground that lob fire, and smaller ones that float and stare you down
  const volcano = (z, x) => ground(z, { x, x0: x, y: 1.1, y0: 1.1, col: STONE, hp: 6, r: 1.1, score: 250, fire: 150, lob: true, shape: 'head', ph: (x + 9) * 0.3, pod: true });
  const geyser = (z, x, ph) => obs(z, { x, y: 4.75, hx: 1.05, hy: 4.75, hz: 1.05, col: FIRE, kind: 'geyser', pulse: [80, 70, ph] });
  const spire = (z, x) => obs(z, { x, y: 4.75, hx: 0.9, hy: 4.75, hz: 0.9, col: STONE, kind: 'statue' });
  const arc = (z, y, o) => obs(z, { x: 0, y, hx: 8.6, hy: 0.55, hz: 0.9, col: FIRE, kind: 'firearc', ...o });
  const worm = (z, x, n = 6) => { const gr = 'worm' + z; for (let i = 0; i < n; i++) at(z + i * 0.9, g => addEnemy(g, { type: 'pop', rel: false, z: 30 + i * 0.9, vz: 0, group: gr, gn: n, x, y: 0, y0: 0.2, ay: 5.2, w: 1.6, ph: -i * 0.33, hp: 2, r: 0.6, col: i ? '#ff5a1f' : '#ffe14a', score: 80, shape: 'worm' })); };
  const river = (z, x, ph) => obs(z, { x: 0, y: 0.2, hx: 9.6, hy: 0.2, hz: 4.2, col: FIRE, kind: 'lava', ghost: true, flow: x < 0 ? -1 : 1 }); // a wide river of lava flowing across the lane: it does not block, it cooks and drags
  const fall = (z, ph) => obs(z, { x: 0, y: 4.75, hx: 8.6, hy: 4.75, hz: 1.05, col: FIRE, kind: 'lavafall', pulse: [70, 115, ph] }); // lavafalls that pour, stop, and pour again
  const boulder = (z, x, y, o) => obs(z, { x, y, hx: 1.1, hy: 1.1, hz: 1.1, col: ROCK, kind: 'boulder', hp: 7, score: 120, ...o }); // basalt you can blast apart
  const forge = (z, o) => en(z, { type: 'saucer', col: STONE, hp: 8, r: 0.95, score: 400, hold: 15, dur: 420, ax: 3, ay: 1.5, fire: 120, fan: 2, shape: 'head', pod: true, ...o });

  zone(-99, 95, SIDE, 'SECTOR 2 // MARS - THE FORGE');
  for (let z = 44; z < 92; z += 24) obs(z, { x: ((z * 3) % 11) - 5, y: 1.3, hx: 0.8, hy: 1.3, hz: 0.8, col: STONE, kind: 'statue' });
  for (let z = 30; z < 92; z += 13) cone(z, ((z * 5) % 13) - 6, 1.6 + (z % 3) * 0.5);
  river(58, 0, 0); river(82, 0, 2); river(404, 0, 1);
  boulder(50, 0, 4.6, { gem: true }); boulder(68, 0, 6.8); boulder(88, 0, 3, { pod: true });
  wing(36, 5, { ...ember, y: 6.5, ay: 1.8 }); volcano(54, -3); wing(62, 5, { ...ember, y: 5, ay: 2 }); volcano(80, 4); worm(72, 0, 5);

  zone(95, 300, TOP, 'LAVA GEYSERS - SHIFT TO TOP VIEW');
  for (let i = 0, z = 130; z < 272; z += 14, i++) { const xs = i % 2 ? [-5, 0, 5] : [-2.5, 2.5, 7]; xs.forEach((x, k) => k === i % 3 ? spire(z, x) : geyser(z, x, i * 37 + k * 50)); if (i % 3 === 0) volcano(z + 7, i % 2 ? 2.5 : -6); if (i % 3 === 1 && z < 258) river(z + 7, i % 2 ? -3.5 : 3.5, i); if (i % 4 === 3) boulder(z + 7, i % 8 === 3 ? 6 : -6, 1.1, { vx: i % 8 === 3 ? -2.4 : 2.4, wrap: 9, hp: 9 }); }
  wing(150, 5, { ...ember, x: 0, ax: 4, y: 5 }); forge(185, { x: 0, y: 6 }); wing(225, 6, { ...ember, x: -2, ax: 5, y: 4 }); wing(265, 5, { ...ember, x: 2, ax: 4, y: 6 });
  K.checkpoints.push(303);

  // the Sun warp sits down inside a crater: nothing but TOP view can reach it
  zone(300, 520, SIDE, 'FIRE ARCS - SHIFT TO SIDE VIEW');
  for (let i = 0, z = 334; z < 420; z += 15, i++) arc(z, i % 2 ? 6.6 : 2.6, { osc: { ax: 0, ay: 1.5, w: 2, ph: i } });
  K.warp(42, -3, 6); fall(424, 0); fall(446, 85); fall(468, 170); at(398, g => hint(g, 'LAVAFALLS - WAIT FOR THEM TO STOP', 200));
  for (let i = 0, z = 472; z < 512; z += 15, i++) arc(z, i % 2 ? 2.4 : 6.8, { osc: { ax: 0, ay: 1.6, w: 2.4, ph: i * 2 } });
  worm(350, 0); worm(388, 0, 7); wing(410, 5, { ...ember, y: 5, ay: 1.2 }); forge(436, { x: 0, y: 6.5, ax: 1 }); worm(486, 0, 7);
  K.checkpoints.push(523);

  zone(520, 740, CHASE, 'MAGMA TUBES - SHIFT TO CHASE VIEW');
  [[0, 4.5], [3.5, 5.5], [-3.5, 3.5], [0, 6], [4, 3.4], [-4, 5.6], [0, 4], [3, 6]].forEach(([x, y], i) => { const z = 556 + i * 23; gate(z, x, y, { col: FIRE, kind: 'gate', osc: i > 2 ? { ax: 1.3, ay: 0, w: 1.5, ph: i } : null }); if (i % 2) wing(z + 11, 3, { ...ember, x: x * 0.5, y, ax: 1.5 }); else if (i % 4 === 2) forge(z + 10, { x: 0, y: 5 }); else boulder(z + 11, -6, 1.1, { vx: 3, wrap: 9, hp: 9, gem: true }); if (i % 3 !== 2) river(z + 12, i % 2 ? 3 : -3, i); });
  at(700, g => addPod(g, 0, 5, SPAWN_Z, 'god'));
  K.checkpoints.push(744);

  zone(740, 1e9, TOP, 'WARNING // THE COLOSSUS WAKES');
  spawnBoss(K, 790, { name: 'THE COLOSSUS', look: 'colossus', hp: 2400, col: STONE });
  // THE COLOSSUS: a giant alien stone head. It makes the ground erupt, floods the lane with lava and ash, then spits rings of fire and its own small heads.
  const B = boss({ name: 'THE COLOSSUS', toast: 'MARS COOLED', stages: [
    { name: 'ERUPTION', vuln: [TOP], rec: TOP, col: STONE, sway: 2.5, bob: 0.3, attack(g, b, t) {
      if (t % 200 === 30) { const lanes = [-6, -3, 0, 3, 6], skip = g.rand() * 5 | 0; lanes.forEach((x, i) => { if (i !== skip) addObs(g, { rel: true, kind: 'geyser', x: x + (g.rand() - 0.5), y: 4.75, hx: 1.15, hy: 4.75, hz: 1.15, z: 1.5 + g.rand() * 9.5, warm: 95, life: 70, col: FIRE }); }); g.fx.push('charge'); }
      if (t % 200 === 130) for (let i = 0; i < 4; i++) addEnemy(g, { type: 'bomb', x: b.x, y: b.y + 2, z: b.z - 1, vx: -5 + i * 3.3, vy: 6 + g.rand() * 2, vz: -8 - g.rand() * 3, hp: 1, r: 0.5, col: '#ff8a2b', score: 50, shape: 'bomb' }); } },
    { name: 'LAVA TIDE', vuln: [SIDE], rec: SIDE, col: '#ffe14a', sway: 1, bob: 0.5, attack(g, b, t) {
      const c = t % 520; if (c === 30) { addObs(g, { rel: true, kind: 'tide', x: 0, y: -4.2, hx: 9, hy: 4, hz: 11, z: 9, vy: 1.45, warm: 40, life: 190, col: FIRE }); hint(g, 'LAVA RISING - CLIMB!', 110); g.fx.push('charge'); }
      if (c === 290) { addObs(g, { rel: true, kind: 'tide', ash: true, x: 0, y: 13.8, hx: 9, hy: 4, hz: 11, z: 9, vy: -1.45, warm: 40, life: 190, col: '#c0532a' }); hint(g, 'ASH FALLING - DIVE!', 110); g.fx.push('charge'); }
      if (c === 150 || c === 410) { const lowArc = c === 150; for (let i = 0; i < 7; i++) addEnemy(g, { type: 'pop', x: 0, y: 0, y0: lowArc ? 6.6 : 2.6, ay: 2, w: 2.2, ph: -i * 0.45, z: b.z - 2 + i * 0.9, vz: -6, hp: 2, r: 0.6, col: i ? FIRE : '#ffe14a', shape: 'worm', score: 80 }); }
      if (t % 120 === 100) fan(g, b, 2, 7); } },
    { name: 'THE GAZE', vuln: [CHASE, ISO], rec: CHASE, col: '#ff8a2b', attack(g, b, t) { if (t % 150 === 20) fireRing(g, b, FIRE); if (t % 300 === 95) fireRing(g, b, '#ffe14a', 12, 1.5, 3); if (t % 240 === 170) for (let i = 0; i < 2; i++) addEnemy(g, { type: 'kami', x: b.x + (i ? 3 : -3), y: b.y + (i ? 1.5 : -1.5), z: b.z - 2, vz: -8, hp: 3, r: 0.7, col: STONE, score: 150, shape: 'head' }); } }] });
  K.fill(ember, 105, 740, 42, 'boulder', 'walker');
  return K.done({ name: 'MARS', title: 'THE FORGE', boss: B, warpName: 'THE SUN', theme: { sky: 'volcano', grid: '#8a2a12' } });
}

// =====================================================================================
// LEVEL 3 — JUPITER // STORM DECK: lightning chains, storm walls, wraiths in the cloud
// =====================================================================================
function jupiter() {
  const K = kit('jupiter'), { at, obs, ring, en, wing, zone, gate } = K;
  const ZAP = '#7df9ff', CLOUD = '#c98a4a';
  const spark = { col: ZAP, shape: 'spark', zig: true, vz: -10, w: 3 };
  const jelly = (z, o) => en(z, { type: 'saucer', col: '#b06bff', hp: 6, r: 0.9, score: 350, hold: 14, dur: 380, ax: 2, ay: 1.5, burst: 8, shape: 'jelly', pod: true, ...o });
  const hbolt = (z, y, ph) => obs(z, { x: 0, y, hx: 8.6, hy: 0.4, hz: 0.5, col: ZAP, kind: 'bolt', pulse: [70, 60, ph] });
  const vbolt = (z, x, ph) => obs(z, { x, y: 4.75, hx: 0.45, hy: 4.75, hz: 0.5, col: ZAP, kind: 'bolt', pulse: [70, 60, ph] });
  const head = (z, x) => obs(z, { x, y: 4.75, hx: 1.5, hy: 4.75, hz: 1.5, col: CLOUD, kind: 'thunderhead' });
  const deck = (z, low) => obs(z, low ? { x: 0, y: 1.9, hx: 8.6, hy: 1.9, hz: 1.4, col: CLOUD, kind: 'clouddeck' } : { x: 0, y: 7.2, hx: 8.6, hy: 2.3, hz: 1.4, col: CLOUD, kind: 'clouddeck' });
  const fog = (z, x, y, o) => obs(z, { x, y, hx: 4.5, hy: 2.2, hz: 4, col: CLOUD, kind: 'fog', ghost: true, ...o }); // fog banks: nothing in them hurts, you just cannot see through them
  const crystal = (z, y, o) => obs(z, { x: 0, y, hx: 8.6, hy: 0.85, hz: 0.7, col: '#9fe9ff', kind: 'crystal', hp: 6, score: 120, ...o }); // ammonia ice that grows across a lane: shoot through it
  const funnel = (z, x, ph, ax = 3.2) => obs(z, { x, y: 4.75, hx: 1.15, hy: 4.75, hz: 1.15, col: '#b06bff', kind: 'funnel', osc: { ax, ay: 0, w: 0.9, ph } }); // tornadoes that wander from side to side
  const buoy = (z, x, y) => K.ground(z, { x, x0: x, y, y0: y, col: '#ffe14a', hp: 5, r: 0.75, score: 250, fire: 135, fan: 3, bs: 6.5, bcol: ZAP, shape: 'sat', ph: (x + 9) * 0.3, pod: true }); // storm buoys: floating gun platforms
  const wraith = (z, o) => en(z, { type: 'saucer', col: '#ffffff', hp: 6, r: 0.9, score: 500, hold: 13, dur: 400, ax: 4, ay: 2, fire: 100, fan: 3, shape: 'wraith', phase: ISO, haunt: true, pod: true, ...o });

  zone(-99, 95, SIDE, 'SECTOR 3 // JUPITER - STORM DECK');
  fog(44, 0, 6.5, { vx: 0.6, wrap: 12 }); fog(70, 0, 2.8, { vx: -0.5, wrap: 12 }); crystal(60, 4.8, { gem: true }); crystal(90, 6.4); buoy(78, 3, 3);
  wing(36, 5, { ...spark, y: 6, ax: 3 }); jelly(54, { x: -2, y: 6 }); wing(66, 6, { ...spark, y: 3.5, ax: 4 }); jelly(84, { x: 3, y: 4 });

  zone(95, 300, SIDE, 'LIGHTNING CHAINS - STAY IN SIDE VIEW');
  for (let i = 0, z = 130; z < 290; z += 13, i++) { const lane = i % 3; [2.2, 4.8, 7.4].forEach((y, k) => { if (k !== lane) hbolt(z, y, i * 23 + k * 40); }); if (i % 4 === 3) deck(z + 6, i % 8 === 3); if (i % 4 === 1) crystal(z, [2.2, 4.8, 7.4][lane], { gem: i % 8 === 1 }); if (i % 6 === 2) buoy(z + 6, 0, [7.4, 2.2, 4.8][lane]); if (i % 5 === 4) fog(z + 6, 0, 4.8, { hy: 3.4 }); }
  wing(150, 5, { ...spark, y: 5, ax: 0, ay: 2, zig: false }); jelly(190, { x: 0, y: 5 }); wing(230, 6, { ...spark, y: 4, ax: 0, ay: 2.5, zig: false }); jelly(268, { x: 0, y: 6 });
  K.checkpoints.push(303);

  // the Asteroid warp hangs outside the lane: only SIDE view, which ignores left and right, can touch it
  zone(300, 520, TOP, 'STORM WALLS - SHIFT TO TOP VIEW');
  for (let i = 0, z = 334; z < 410; z += 14, i++) { const xs = i % 2 ? [-5, 0, 5] : [-2.5, 2.5, 7.5]; xs.forEach((x, k) => k === i % 3 ? head(z, x) : vbolt(z, x, i * 31 + k * 45)); }
  K.warp(48, 3.5, 3.4); funnel(420, -4, 0); funnel(434, 4, 2); funnel(448, 0, 4, 4.5); buoy(441, 6.5, 5); at(392, g => hint(g, 'TORNADOES - THEY WANDER', 180));
  for (let i = 0, z = 462; z < 512; z += 14, i++) { const xs = i % 2 ? [-5, 0, 5] : [-2.5, 2.5, 7.5]; xs.forEach((x, k) => k === (i + 1) % 3 ? head(z, x) : vbolt(z, x, i * 29 + k * 45)); }
  wing(350, 5, { ...spark, x: 0, ax: 5, y: 5 }); jelly(392, { x: 0, y: 5 }); wing(474, 6, { ...spark, x: 0, ax: 5, y: 4 });
  K.checkpoints.push(523);

  zone(520, 760, ISO, 'DENSE CLOUD - WRAITHS ONLY SHOW IN ISO VIEW');
  for (let i = 0, z = 556; z < 750; z += 24, i++) { obs(z, { x: (i % 3 - 1) * 4, y: 4.75, hx: 3.2, hy: 4.75, hz: 5, col: CLOUD, kind: 'cloud', ghost: true }); if (i % 2) { hbolt(z + 12, i % 4 === 1 ? 2.6 : 7, i * 40); vbolt(z + 12, i % 4 === 1 ? 4 : -4, i * 40 + 20); } else { funnel(z + 12, (i % 4 ? -1 : 1) * 3, i, 2.4); fog(z + 12, (i % 4 ? 1 : -1) * 3, 4.8, { hy: 4, hx: 3 }); } }
  wraith(560, { x: -3, y: 6 }); wraith(610, { x: 3, y: 3.5 }); wing(640, 5, { ...spark, x: 0, ax: 4, y: 5 }); wraith(670, { x: 0, y: 6.5 }); wraith(715, { x: -2, y: 4 }); at(730, g => addPod(g, 0, 5, SPAWN_Z, 'god'));
  K.checkpoints.push(764);

  zone(760, 1e9, SIDE, 'WARNING // THE EYE OPENS');
  spawnBoss(K, 810, { name: 'THE EYE', look: 'eye', hp: 3200, col: ZAP });
  const B = boss({ name: 'THE EYE', toast: 'JUPITER CALMED', stages: [
    // STATIC: lightning walks down the lane toward you, then the Eye stares: a flat beam at whatever height you are flying
    { name: 'STATIC', vuln: [SIDE], rec: SIDE, col: ZAP, bob: 2.2, attack(g, b, t) { const p = near(g, b), c = t % 360;
      if (c === 30) { hint(g, 'LIGHTNING - WATCH THE RINGS', 110); g.fx.push('charge'); } if (c >= 30 && c < 150 && c % 24 === 6) { const k = (c - 30) / 24 | 0; strike(g, p.x, 11.5 - k * 2.3 + (k % 2 ? 0.6 : 0)); }
      if (c === 185) hint(g, 'THE EYE TURNS TO YOU - MOVE WHEN IT LOCKS', 130); if (c >= 185 && c < 357) stare(g, b, c - 185, { col: ZAP, trackX: false }); if (c === 300) for (let i = 0; i < 3; i++) addEnemy(g, { type: 'pop', x: 0, y: 2.5 + i * 2.2, z: b.z - 1, vz: -8, ay: 1, hp: 2, col: ZAP, shape: 'spark', ph: i }); } },
    // CYCLONE: the storm drags you toward the Eye while two spiral arms of sparks sweep the deck
    { name: 'CYCLONE', vuln: [TOP], rec: TOP, col: '#b06bff', sway: 3, attack(g, b, t) { const p = near(g, b); g.pull = [Math.max(-1.6, Math.min(1.6, (b.x - p.x) * 0.5)), 0, p.z < 9 ? 1.5 : 0];
      if (t % 420 === 5) hint(g, 'CYCLONE - FLY AGAINST THE PULL', 120); if (t % 9 === 0 && t % 420 < 300) for (const k of [0, 3.1416]) { const a = t * 0.045 + k; bullet(g, b.x, 4.6, b.z - 2, Math.cos(a) * 4.2, 0, -3.4 - (Math.sin(a) + 1) * 1.6, k ? '#b06bff' : ZAP); }
      if (t % 420 === 330) { strike(g, p.x, p.z); strike(g, p.x - 2.6, p.z + 1.5); strike(g, p.x + 2.6, p.z + 1.5); g.fx.push('charge'); } } },
    // THE PUPIL: storm orbs circle it and soak up shots, and its stare is now a narrow shaft that follows you
    { name: 'THE PUPIL', vuln: [ISO, CHASE], rec: ISO, col: '#ffffff', attack(g, b, t) { const orbs = g.enemies.filter(e => e.orb && e.hp > 0).length;
      if (t % 480 === 20 && orbs < 2) { for (let i = 0; i < 4; i++) addEnemy(g, { type: 'pop', orb: true, x: b.x, x0: 0, y0: 4.8, ax: 3.3, ay: 3.3, w: 1.3, ph: i * 1.5708, z: b.z - 3, vz: 0, hp: 9, r: 0.8, col: ZAP, score: 300, shape: 'plasma', fire: 170, bs: 6 }); hint(g, 'STORM ORBS - CLEAR THEM TO REACH THE PUPIL', 150); }
      { const c = t % 330; if (c >= 110 && c < 282) stare(g, b, c - 110, { col: ZAP }); } if (t % 480 === 330) { const p = near(g, b); for (let i = -1; i <= 1; i++) strike(g, p.x + i * 3, p.z + 1, { hz: 3 }); g.fx.push('charge'); } } }] });
  K.fill(spark, 108, 735, 42, 'crystal');
  return K.done({ name: 'JUPITER', title: 'STORM DECK', boss: B, warpName: 'THE ASTEROID BELT', theme: { sky: 'cloud', grid: '#7a4a1e', nofloor: true },
    rules: { wind: g => g.camZ > 540 && g.camZ < 760 && !g.boss ? [Math.sin(g.tick * 0.012) * 1.4, 0] : [0, 0] } });
}

// =====================================================================================
// LEVEL 4 — PLANET X // THE BLOOM: the source of the Shift. Everything is alive.
// =====================================================================================
function planetx() {
  const K = kit('x'), { at, obs, ring, en, ground, wing, zone, gate } = K;
  const BIO = '#3dffb0', FLESH = '#ff3df0', ACID = '#b6ff3d';
  const spore = { col: ACID, shape: 'spore', hp: 1, r: 0.4, vz: -4, score: 40, w: 1.2 };
  const spitter = (z, o) => en(z, { type: 'saucer', col: FLESH, hp: 8, r: 0.95, score: 450, hold: 15, dur: 420, ax: 4, ay: 1.5, fire: 115, fan: 4, bs: 7.5, bcol: ACID, shape: 'spitter', pod: true, ...o });
  const eye = (z, x, top) => ground(z, { x, x0: x, y: top ? 9 : 0.6, y0: top ? 9 : 0.6, col: '#ffffff', hp: 4, r: 0.7, score: 220, fire: 125, bcol: ACID, shape: 'eye', ph: (x + 9) * 0.3 });
  const tent = (z, x, ph) => obs(z, { x, y: 4.75, hx: 0.75, hy: 4.75, hz: 0.75, col: BIO, kind: 'tentacle', osc: { ax: 1.4, ay: 0, w: 1.3, ph } });
  const blob = (z, o) => obs(z, { x: 0, y: 4.75, hx: 8.6, hy: 4.75, hz: 0.7, col: FLESH, kind: 'blob', hp: 12, score: 250, ...o }); // a wall of mutant blobs right across the lane: it bursts when you shoot it enough
  const mine = (z, x, y) => ground(z, { x, x0: x, y, y0: y, col: ACID, hp: 3, r: 0.85, score: 120, burst: 10, shape: 'spore' }); // fat spore pods that burst into a ring of acid
  const memb = (z, low, ph) => obs(z, low ? { x: 0, y: 1.8, hx: 8.6, hy: 1.8, hz: 1, col: FLESH, kind: 'membrane', osc: { ax: 0, ay: 0.7, w: 1.6, ph } } : { x: 0, y: 7.3, hx: 8.6, hy: 2.2, hz: 1, col: FLESH, kind: 'membrane', osc: { ax: 0, ay: 0.7, w: 1.6, ph } });

  zone(-99, 85, SIDE, 'SECTOR 4 // PLANET X - THE BLOOM');
  blob(78, { pod: true }); at(46, g => hint(g, 'BLOB WALL - SHOOT IT UNTIL IT BURSTS', 220)); mine(60, 0, 3); mine(68, 0, 7);
  wing(34, 8, { ...spore, y: 5, ay: 2.5, ax: 0 }, 1.4); spitter(52, { x: 0, y: 6 }); wing(64, 8, { ...spore, y: 4, ay: 3 }, 1.4);

  zone(85, 285, TOP, 'TENTACLE FOREST - SHIFT TO TOP VIEW');
  for (let i = 0, z = 120; z < 276; z += 13, i++) (i % 2 ? [-5.2, 0, 5.2] : [-2.6, 2.6, 7.6, -7.6]).forEach((x, k) => i % 3 === 2 && k === 1 ? obs(z, { x, y: 4.75, hx: 0.8, hy: 4.75, hz: 0.8, col: FLESH, kind: 'tentacle', osc: { ax: 2.7, ay: 0, w: 2, ph: i } }) : tent(z, x, i + k * 2));
  for (let z = 152; z < 270; z += 39) { mine(z, -5.2, 4.6); mine(z + 13, 5.2, 4.6); }
  wing(140, 8, { ...spore, x: 0, ax: 5, y: 5 }, 1.4); spitter(180, { x: 0, y: 6 }); wing(215, 8, { ...spore, x: 0, ax: 6, y: 4 }, 1.4); spitter(252, { x: 2, y: 5 });
  K.checkpoints.push(288);

  // the Pluto warp is tucked into the roof here, and only exists in CHASE
  zone(285, 475, SIDE, 'MEMBRANES - SHIFT TO SIDE VIEW');
  for (let i = 0, z = 320; z < 466; z += 17, i++) { memb(z, i % 2 === 0, i); eye(z + 8, (i % 3 - 1) * 4, i % 2 === 1); if (i % 3 === 2) blob(z + 9, { hp: 10, gem: true }); }
  K.warp(38, -3.5, 6.2);
  wing(336, 8, { ...spore, y: 5, ay: 1 }, 1.4); spitter(372, { x: 0, y: 5, ay: 0.5 }); wing(430, 8, { ...spore, y: 4.5, ay: 1.2 }, 1.4);
  K.checkpoints.push(478);

  zone(475, 690, CHASE, 'THE GULLET - SHIFT TO CHASE VIEW');
  [[0, 4.5], [3, 5.5], [-3, 3.6], [0, 6], [3.5, 3.6], [-3.5, 5.6], [0, 4.4], [2, 6]].forEach(([x, y], i) => { const z = 510 + i * 22; gate(z, x, y, { col: FLESH, osc: { ax: 1.6, ay: i % 2 ? 0.8 : 0, w: 1.4, ph: i * 1.3 } }); if (i % 2) wing(z + 11, 5, { ...spore, x: x * 0.5, y, ax: 2 }, 1.2); else if (i % 4 === 2) spitter(z + 10, { x: 0, y: 5 }); else { mine(z + 11, -3, 3.4); mine(z + 11, 3, 6.2); } if (i === 5) blob(z + 12, { hp: 14, pod: true }); });
  K.checkpoints.push(694);

  zone(690, 760, TOP, 'REALITY FOLDS - TOP VIEW!'); for (let i = 0, z = 722; z < 756; z += 14, i++) (i % 2 ? [-5.2, 0, 5.2] : [-2.6, 2.6, 7.6, -7.6]).forEach((x, k) => tent(z, x, i + k));
  zone(760, 830, SIDE, 'SIDE VIEW!'); for (let i = 0, z = 792; z < 826; z += 16, i++) memb(z, i % 2 === 0, i);
  zone(830, 900, ISO, 'ISO VIEW!'); gate(858, -3, 5, { col: FLESH, osc: { ax: 1.5, ay: 0, w: 1.4, ph: 0 } }); gate(880, 3, 4, { col: FLESH, osc: { ax: 1.5, ay: 0, w: 1.4, ph: 2 } });
  at(700, g => addPod(g, 0, 5, SPAWN_Z, 'god')); spitter(770, { x: 0, y: 5.4, ay: 0.4 }); spitter(895, { x: 0, y: 5 });
  K.checkpoints.push(904);

  zone(900, 1e9, SIDE, 'WARNING // THE SHIFTER - SOURCE OF THE FOLD');
  spawnBoss(K, 950, { name: 'THE SHIFTER', look: 'bloom', hp: 4200, col: FLESH, score: 50000 });
  // every stage wants a different view, and between attacks it folds reality and throws you into another one
  const fold = (g, b, t) => { const c = t % 400; if (c === 215) { hint(g, 'REALITY SHIFT!', 70); g.fx.push('charge'); } if (c === 270) { let to = (g.view + 1 + (g.rand() * 3 | 0)) % 4; doShift(g, to, 1, null); g.flash = 6; } };
  const B = boss({ name: 'THE SHIFTER', toast: 'THE SHIFT IS OVER', splat: true, stages: [
    { name: 'FIRST FACE', vuln: [SIDE], rec: SIDE, col: FLESH, bob: 2, attack(g, b, t) { if (t % 400 === 30) { addObs(g, { rel: true, kind: 'blob', x: 0, y: 4.8, hx: 9, hy: 5, hz: 0.7, z: b.z - 3, vz: -2.6, hp: 34, col: FLESH, score: 600, pod: g.rand() < 0.3 }); hint(g, 'BLOB WALL - BURST IT BEFORE IT REACHES YOU', 130); g.fx.push('charge'); } if (t % 100 === 80 && t % 400 > 200) fan(g, b, 3, 6.5, ACID); fold(g, b, t); } },
    { name: 'SECOND FACE', vuln: [TOP], rec: TOP, col: BIO, sway: 4, attack(g, b, t) { if (t % 200 === 30) { const safe = g.rand() * 5 | 0; [-6.4, -3.2, 0, 3.2, 6.4].forEach((x, i) => { if (i !== safe && i !== (safe + 1 + (t % 400 < 200 ? 0 : 2)) % 5) addObs(g, { rel: true, kind: 'slam', x, y: 4.75, hx: 1.25, hy: 4.75, hz: 5.5, z: 6, warm: 95, life: 50, col: BIO }); }); g.fx.push('charge'); } if (t % 400 === 120) for (let i = 0; i < 6; i++) addEnemy(g, { type: 'pop', x: -6 + i * 2.4, y: 4.6, z: b.z - 1, vz: -4, ax: 1, hp: 1, r: 0.4, col: ACID, shape: 'spore', score: 40, ph: i }); fold(g, b, t); } },
    { name: 'THIRD FACE', vuln: [CHASE], rec: CHASE, col: ACID, attack(g, b, t) { if (t % 400 === 20) addObs(g, { rel: true, kind: 'blob', x: 0, y: 4.8, hx: 9, hy: 5, hz: 0.7, z: b.z - 3, vz: -2.4, hp: 46, col: ACID, score: 800 }); if (t % 400 === 150) for (let i = 0; i < 5; i++) addEnemy(g, { type: 'kami', x: -5 + i * 2.5, y: 2.5 + (i % 2) * 4, z: b.z - 2, vz: -6.5, hp: 1, r: 0.45, col: ACID, shape: 'spore', score: 60 }); fold(g, b, t); } },
    { name: 'TRUE FACE', vuln: [ISO], rec: ISO, col: '#ffffff', attack(g, b, t) { if (t % 400 === 20) fireRing(g, b, ACID, 18, 2.3, 4); if (t % 400 === 120) { const p = near(g, b); for (let i = -1; i <= 1; i++) strike(g, p.x + i * 2.8, p.z + (i ? 1.2 : 0), { col: FLESH }); g.fx.push('charge'); } if (t % 12 === 0 && t % 400 > 150 && t % 400 < 205) { const a = t * 0.1; bullet(g, b.x, b.y, b.z - 2, Math.cos(a) * 3.2, Math.sin(a) * 3.2, -6.5, ACID); } fold(g, b, t); } }] });
  K.fill(spore, 100, 880, 42, 'blob', 'walker');
  return K.done({ name: 'PLANET X', title: 'THE BLOOM', boss: B, warpName: 'PLUTO', final: true, theme: { sky: 'bio', grid: '#6a1e8a', trippy: true, splat: true } });
}

// =====================================================================================
// BONUS STAGES — no ships lost here: one hit ends the stage, the end pays a big bonus
// =====================================================================================
function moon() { // low gravity trench run: the ship drifts, nothing shoots back
  const K = kit('moon'), { at, obs, ring, en, zone } = K, GREY = '#c8d0e0';
  zone(-99, 1e9, CHASE, 'BONUS // THE MOON - LOW GRAVITY TRENCH RUN');
  for (let z = 30; z < 330; z += 8) { obs(z, { x: -7.2, y: 1.6, hx: 1.4, hy: 1.6, hz: 4, col: GREY, kind: 'rockwall' }); obs(z, { x: 7.2, y: 1.6, hx: 1.4, hy: 1.6, hz: 4, col: GREY, kind: 'rockwall' }); }
  for (let i = 0; i < 34; i++) { const z = 40 + i * 8.4; ring(z, { x: Math.sin(i * 0.55) * 4, y: 3.5 + Math.sin(i * 0.4) * 2.2, r: 1.5 }); }
  for (let i = 0; i < 7; i++) { const z = 62 + i * 40; obs(z, { x: 0, y: 7.6, hx: 8.6, hy: 1.9, hz: 1, col: GREY, kind: 'arch' }); obs(z + 18, { x: (i % 2 ? 3.4 : -3.4), y: 1.4, hx: 1.2, hy: 1.4, hz: 1.2, col: '#7df9ff', kind: 'ice', hp: 4, gem: true, score: 150 }); }
  for (let i = 0; i < 8; i++) en(50 + i * 36, { type: 'pop', x: (i % 2 ? 4 : -4), y: 6, ax: 2, ay: 1, vz: -5, hp: 3, r: 0.8, col: '#ffe14a', score: 300, shape: 'sat', pod: i % 3 === 1 });
  const tick = stageMini(K, 'moon', 322);
  return K.done({ name: 'THE MOON', title: 'SEA OF QUIET', bonus: true, tick, endZ: 345, endBonus: 10000, rules: { inertia: true }, theme: { sky: 'moon', grid: '#5a6480' } });
}
function sun() { // surf the flares: stay in the shadow lane or cook
  const K = kit('sun'), { at, obs, en, zone } = K, HOT = '#ffb02e';
  zone(-99, 175, TOP, 'BONUS // THE SUN - STAY IN THE SHADE OF THE SOLAR SATELLITES');
  for (let i = 0; i < 12; i++) { const z = 34 + i * 12; obs(z, { x: Math.sin(i * 0.8) * 4.6, y: 4.75, hx: 2.3, hy: 4.75, hz: 6.2, col: '#2ee6ff', kind: 'shade', ghost: true }); if (i % 3 === 1) obs(z, { x: Math.sin(i * 0.8) * 4.6, y: 4.5, hx: 0.7, hy: 0.7, hz: 0.7, col: '#7df9ff', kind: 'ice', hp: 3, gem: true, score: 150 }); }
  for (let i = 0; i < 5; i++) obs(54 + i * 26, { x: 0, y: 4.75, hx: 1.2, hy: 4.75, hz: 3.2, col: HOT, kind: 'flare', osc: { ax: 6.4, ay: 0, w: 0.6 + (i % 2) * 0.15, ph: i * 1.7 } }); // prominences whipping across the lane
  zone(175, 1e9, SIDE, 'SHADOW LANE DIVES - SHIFT TO SIDE VIEW');
  for (let i = 0; i < 4; i++) obs(206 + i * 27, { x: 0, y: 4.75, hx: 8.6, hy: 0.7, hz: 2.7, col: HOT, kind: 'flare', osc: { ax: 0, ay: 3.7, w: 0.85, ph: i * 2.1 } });
  for (let i = 0; i < 12; i++) { const z = 186 + i * 12; obs(z, { x: 0, y: 4.7 + Math.sin(i * 0.9) * 2.6, hx: 8.6, hy: 1.5, hz: 6.2, col: '#2ee6ff', kind: 'shade', ghost: true }); }
  for (let i = 0; i < 9; i++) en(46 + i * 32, { type: 'pop', x: (i % 3 - 1) * 4, y: 3 + (i % 4) * 1.5, ax: 2, ay: 1.5, vz: -5, hp: 3, r: 0.8, col: HOT, score: 250, shape: 'plasma', pod: i % 3 === 0 });
  const tick = stageMini(K, 'sun', 322);
  return K.done({ name: 'THE SUN', title: 'CORONA', bonus: true, tick, endZ: 345, endBonus: 12000, rules: { heat: true }, theme: { sky: 'sun', grid: '#a8480c' } });
}
function asteroids() { // rock-busting frenzy: rocks split, and some carry pods
  const K = kit('belt'), { at, zone } = K, ROCK = '#c8a070';
  zone(-99, 1e9, TOP, 'BONUS // ASTEROID BELT - BREAK EVERYTHING');
  for (let i = 0; i < 46; i++) { const z = 34 + i * 6.6, big = i % 3 === 0; at(z, g => addEnemy(g, { type: 'rock', rel: false, size: big ? 3 : 2, x: -6.5 + g.rand() * 13, y: 1.5 + g.rand() * 6.5, z: SPAWN_Z, vx: (g.rand() - 0.5) * 4, vy: (g.rand() - 0.5) * 2, vz: -g.rand() * 2, hp: big ? 7 : 4, r: big ? 1.5 : 1, col: ROCK, score: big ? 80 : 50, shape: 'rock', pod: i % 7 === 3 })); }
  const tick = stageMini(K, 'belt', 327);
  return K.done({ name: 'ASTEROID BELT', title: 'THE RUBBLE', bonus: true, tick, endZ: 350, endBonus: 10000, theme: { sky: 'space', grid: '#3a3a5a', nofloor: true } });
}
function pluto() { // ice field: shatter a path, thread the spires
  const K = kit('pluto'), { at, obs, en, zone } = K, ICE = '#9fe9ff', DEEP = '#5ea0ff';
  zone(-99, 180, SIDE, 'BONUS // PLUTO - SHATTER THE ICE SHELF');
  for (let i = 0; i < 16; i++) { const z = 34 + i * 9; for (let k = 0; k < 4; k++) if ((i + k) % 4 !== 1) obs(z, { x: 0, y: 1.2 + k * 2.3, hx: 8.6, hy: 1.05, hz: 0.9, col: k % 2 ? ICE : DEEP, kind: 'ice', hp: 5, gem: (i + k) % 3 === 0, score: 80 }); }
  zone(180, 1e9, TOP, 'CRYSTAL SPIRES - SHIFT TO TOP VIEW');
  for (let i = 0; i < 11; i++) { const z = 196 + i * 13; (i % 2 ? [-5, 0, 5] : [-2.5, 2.5, 7.5, -7.5]).forEach((x, k) => (i + k) % 3 === 0 ? obs(z, { x, y: 4.75, hx: 1, hy: 4.75, hz: 1, col: ICE, kind: 'ice', hp: 7, gem: true, score: 120 }) : obs(z, { x, y: 4.75, hx: 0.8, hy: 4.75, hz: 0.8, col: DEEP, kind: 'spire' })); }
  for (let i = 0; i < 8; i++) en(50 + i * 36, { type: 'kami', x: (i % 3 - 1) * 4, y: 3 + (i % 3) * 2, vz: -7, hp: 2, r: 0.55, col: '#ffffff', score: 150, shape: 'shard', pod: i % 3 === 2 });
  const tick = stageMini(K, 'pluto', 322);
  return K.done({ name: 'PLUTO', title: 'THE COLD EDGE', bonus: true, tick, endZ: 345, endBonus: 12000, theme: { sky: 'ice', grid: '#2a5a9a' } });
}

// =====================================================================================
// ARENAS — after each boss, before the jump: a walled arena in that planet's colours. Free flight, guns track
// the nearest target, clear five waves. L / R flips between TOP and ISO: white "phase" enemies only exist in ISO.
// =====================================================================================
// ---------- minibosses: one closes every bonus arena and every warp stage ----------
// a miniboss is an ordinary enemy carrying its own little brain (e.ai), run once a tick by the level
const power = g => 0.5 + 0.25 * g.players[0].up.slice(1, 6).reduce((a, b) => a + b, 0); // minibosses are as tough as your guns are strong
const runMini = g => { const e = g.mini; if (!e) return; if (e.hp > 0) { e.mt = (e.mt || 0) + 1; e.ai(g, e, e.mt); } else if (!e.fin) { e.fin = true; g.score += 5000; g.shake = 14; g.flash = 12; g.fx.push('boom2', 'say:miniboss destroyed', 'toast:' + e.name + ' DESTROYED|+5000'); for (let i = 0; i < 3; i++) addPod(g, e.x + (i - 1) * 2, e.y, e.z + (i - 1)); for (let i = 0; i < 4; i++) explode(g, e.x + (g.rand() - 0.5) * 3, e.y + (g.rand() - 0.5) * 2, e.z, i % 2 ? '#ffffff' : e.col, 30, 13); g.ebul.length = 0; } };
const ring2 = (g, e, n, sp, col, off = 0) => { for (let i = 0; i < n; i++) { const a = i / n * 6.283 + off; bullet(g, e.x, e.y, e.z, Math.cos(a) * sp, 0, Math.sin(a) * sp, col); } g.fx.push('eshot'); }; // a flat ring, for the arenas
const ARENA_MINI = {
  // GRID WARDEN: patrols a square circuit, sweeping four rotating streams, and launches chasers
  earth: { name: 'GRID WARDEN', shape: 'carrier', col: '#ffe14a', hp: 340, r: 2, ai(g, e, t) { const c = (t * 0.006) % 4, k = c | 0, f = c - k, P = [[-8, 8], [8, 8], [8, 26], [-8, 26]], a = P[k], b = P[(k + 1) % 4]; e.x = a[0] + (b[0] - a[0]) * f; e.z = a[1] + (b[1] - a[1]) * f;
      if (t % 7 === 0 && t % 300 < 200) for (let i = 0; i < 4; i++) { const an = t * 0.02 + i * 1.5708; bullet(g, e.x, 4.5, e.z, Math.cos(an) * 5.5, 0, Math.sin(an) * 5.5, '#ffe14a'); } if (t % 300 === 240) for (let i = 0; i < 3; i++) addEnemy(g, { type: 'seek', x: e.x + (i - 1) * 1.5, y: 4.5, z: e.z, sp: 6.5, hp: 2, r: 0.55, col: '#ff4d6d', shape: 'kami', score: 50 }); } },
  // STONE ELDER: marks where you stand, leaps there, and lands in a ring of fire
  mars: { name: 'STONE ELDER', shape: 'head', col: '#d98a5a', hp: 360, r: 2.3, ai(g, e, t) { const c = t % 200, p = near(g, e); if (c === 20) { e.jx = p.x; e.jz = p.z; e.sx = e.x; e.sz = e.z; addObs(g, { rel: true, kind: 'strike', x: e.jx, y: 4.75, z: e.jz, hx: 2.4, hy: 4.75, hz: 2.4, warm: 75, life: 14, col: '#ff5a1f' }); g.fx.push('charge'); }
      if (c > 50 && c <= 95) { const f = (c - 50) / 45, s = f * f * (3 - 2 * f); e.x = e.sx + (e.jx - e.sx) * s; e.z = e.sz + (e.jz - e.sz) * s; e.y = 4.5 + Math.sin(f * 3.1416) * 3.5; } if (c === 96) { e.y = 4.5; ring2(g, e, 14, 5, '#ff5a1f', t); g.shake = Math.max(g.shake, 9); g.fx.push('slam'); } if (c === 150) ring2(g, e, 8, 3.5, '#ffe14a', 0.4); } },
  // THUNDER BLOOM: drifts after you trailing two spiral arms, and calls lightning down where you are
  jupiter: { name: 'THUNDER BLOOM', shape: 'jelly', col: '#b06bff', hp: 340, r: 2.1, ai(g, e, t) { const p = near(g, e), d = Math.hypot(p.x - e.x, p.z - e.z) || 1; if (d > 5) { e.x += (p.x - e.x) / d * 1.6 * DT; e.z += (p.z - e.z) / d * 1.6 * DT; }
      if (t % 8 === 0 && t % 360 < 240) for (const k of [0, 3.1416]) { const an = t * 0.05 + k; bullet(g, e.x, 4.5, e.z, Math.cos(an) * 4.6, 0, Math.sin(an) * 4.6, k ? '#b06bff' : '#7df9ff'); } if (t % 120 === 90) { strike(g, p.x, p.z, { y: 4.75 }); strike(g, p.x + (g.rand() - 0.5) * 7, p.z + (g.rand() - 0.5) * 7); g.fx.push('charge'); } } },
  // BROOD MOTHER: squats in the middle hatching spores and spitting fans of acid, faster as she weakens
  x: { name: 'BROOD MOTHER', shape: 'spitter', col: '#ff3df0', hp: 360, r: 2.3, ai(g, e, t) { const p = near(g, e), rage = e.hp < e.hpMax / 2 ? 0.6 : 1; e.x = Math.sin(t * 0.008) * 4; e.z = 17 + Math.cos(t * 0.006) * 5;
      if (t % (150 * rage | 0) === 40) for (let i = 0; i < 5; i++) addEnemy(g, { type: 'seek', x: e.x + Math.cos(i * 1.26) * 2.4, y: 4.5, z: e.z + Math.sin(i * 1.26) * 2.4, sp: 4.4, wob: 5, hp: 2, r: 0.45, col: '#b6ff3d', shape: 'spore', score: 40, ph: i });
      if (t % (90 * rage | 0) === 10) { const a0 = Math.atan2(p.z - e.z, p.x - e.x); for (let i = -2; i <= 2; i++) bullet(g, e.x, 4.5, e.z, Math.cos(a0 + i * 0.22) * 6.5, 0, Math.sin(a0 + i * 0.22) * 6.5, '#b6ff3d'); g.fx.push('eshot'); } } } };
// the warp stages: the miniboss flies in at the very end and the stage only clears when it is gone
const STAGE_MINI = {
  moon: { name: 'LUNAR SENTINEL', shape: 'sat', col: '#2ee6ff', hp: 150, r: 1.8, ai(g, e, t) { if (t % 110 === 60) { for (const s of [-0.25, 0, 0.25]) aimed(g, e, 6, s, '#2ee6ff'); g.fx.push('eshot'); } if (t % 330 === 250) fireRing(g, e, '#ffffff', 10, 1.8, 3); } },
  sun: { name: 'SOLAR FLARE', shape: 'plasma', col: '#ffe14a', hp: 170, r: 2, ai(g, e, t) { if (t % 150 === 60) fireRing(g, e, '#ff8a2b', 14, 2.4, 4); if (t % 150 === 135) fireRing(g, e, '#ffe14a', 10, 1.4, 3); } },
  belt: { name: 'THE MOTHER ROCK', shape: 'rock', col: '#b0b0d0', hp: 190, r: 2.4, ai(g, e, t) { if (t % 100 === 50) addEnemy(g, { type: 'rock', x: e.x + (g.rand() - 0.5) * 4, y: e.y + (g.rand() - 0.5) * 3, z: e.z - 1, vz: -5.5, vx: (g.rand() - 0.5) * 2, vy: (g.rand() - 0.5) * 2, hp: 3, r: 0.9, col: '#8a8ab0', shape: 'rock', score: 60, size: 2 }); if (t % 200 === 150) { for (const s of [-0.2, 0.2]) aimed(g, e, 6, s, '#ffffff'); g.fx.push('eshot'); } } },
  pluto: { name: 'FROST WARDEN', shape: 'shard', col: '#7df9ff', hp: 180, r: 2, ai(g, e, t) { if (t % 170 === 60) for (let i = 0; i < 4; i++) addEnemy(g, { type: 'kami', x: e.x + (i - 1.5) * 2.2, y: e.y + (i % 2 ? 1.4 : -1.4), z: e.z - 1, vz: -6, hp: 1, r: 0.45, col: '#ffffff', shape: 'shard', score: 60 }); if (t % 170 === 140) { for (const s of [-0.3, 0, 0.3]) aimed(g, e, 6.5, s, '#7df9ff'); g.fx.push('eshot'); } } } };
function stageMini(K, id, z) { const M = STAGE_MINI[id]; K.at(z, g => { g.mini = addEnemy(g, { type: 'pop', mini: true, name: M.name, ai: M.ai, x: 0, x0: 0, y: 4.8, y0: 4.8, ax: 3, ay: 1.6, w: 0.6, z: 31, vz: -5, hp: Math.round(M.hp * power(g)), hpMax: Math.round(M.hp * power(g)), r: M.r, col: M.col, shape: M.shape, score: 0, big: true, hold: 17 }); hint(g, 'MINIBOSS // ' + M.name, 200); g.fx.push('charge', 'say:miniboss'); }); return g => { const e = g.mini; if (e && e.hp > 0 && e.z <= 17) { e.vz = 0; } runMini(g); }; }
const ARENAS = {
  earth: { name: 'GRID ZERO', title: 'NEO TERRA ARENA', theme: { sky: 'city', grid: '#2443c8' }, col: '#2ee6ff',
    grunt: { col: '#ff3df0', sp: 4.2, hp: 2 }, fast: { col: '#ff4d6d', sp: 6.2, hp: 1, shape: 'kami' }, gun: { col: '#3dffb0', hp: 6, shape: 'saucer', fire: 120, fan: 3 }, champ: { col: '#ffe14a', shape: 'carrier', name: 'GRID WARDEN' },
    hazard(g) { for (let i = 0; i < 4; i++) addObs(g, { rel: true, kind: 'car', x: -9 + i * 5, y: 4.5, z: 5 + i * 8, hx: 1.3, hy: 0.45, hz: 0.7, vx: i % 2 ? 3.6 : -3.6, wrap: 14.5, col: '#ff8a2b' }); } },
  mars: { name: 'THE CRUCIBLE', title: 'FORGE ARENA', theme: { sky: 'volcano', grid: '#8a2a12' }, col: '#ff5a1f',
    grunt: { col: '#ff8a2b', sp: 4, hp: 2, shape: 'ember' }, fast: { col: '#ffe14a', sp: 6, hp: 1, shape: 'ember' }, gun: { col: '#d98a5a', hp: 8, shape: 'head', fire: 130, fan: 2, r: 0.95 }, champ: { col: '#d98a5a', shape: 'head', name: 'STONE ELDER' },
    hazard(g) { [[-7, 6], [7, 12], [-6, 21], [6.5, 28], [0, 17]].forEach(([x, z], i) => addObs(g, { rel: true, kind: 'geyser', x, y: 4.75, z, hx: 1.05, hy: 4.75, hz: 1.05, col: '#ff5a1f', pulse: [70, 110, i * 45] })); } },
  jupiter: { name: 'EYE OF THE STORM', title: 'STORM ARENA', theme: { sky: 'cloud', grid: '#7a4a1e' }, col: '#7df9ff',
    grunt: { col: '#7df9ff', sp: 4.6, hp: 2, shape: 'spark', wob: 5 }, fast: { col: '#ffffff', sp: 6.8, hp: 1, shape: 'spark', wob: 8 }, gun: { col: '#b06bff', hp: 6, shape: 'jelly', burst: 8, fire: 150 }, champ: { col: '#b06bff', shape: 'jelly', name: 'THUNDER BLOOM' },
    hazard(g) { [7, 17, 27].forEach((z, i) => addObs(g, { rel: true, kind: 'bolt', x: 0, y: 4.5, z, hx: 13, hy: 0.4, hz: 0.45, col: '#7df9ff', pulse: [55, 125, i * 60] })); } },
  x: { name: 'THE HEART', title: 'BLOOM ARENA', theme: { sky: 'bio', grid: '#6a1e8a', trippy: true, splat: true }, col: '#3dffb0',
    grunt: { col: '#b6ff3d', sp: 3.6, hp: 1, shape: 'spore', r: 0.42, wob: 4 }, fast: { col: '#ff3df0', sp: 5.8, hp: 1, shape: 'spore', r: 0.42, wob: 7 }, gun: { col: '#ff3df0', hp: 8, shape: 'spitter', fire: 125, fan: 4, bcol: '#b6ff3d', bs: 7 }, champ: { col: '#ff3df0', shape: 'spitter', name: 'BROOD MOTHER' },
    hazard(g) { [[-7, 7], [7, 14], [-4, 23], [6, 29]].forEach(([x, z], i) => addObs(g, { rel: true, kind: 'tentacle', x, y: 4.75, z, hx: 0.75, hy: 4.75, hz: 0.75, col: '#3dffb0', osc: { ax: 1.6, ay: 0, w: 1.2, ph: i * 2 } })); } } };
// each wave: [grunts, fast, gunners, phase grunts]; wave 5 adds the champion
const WAVES = [[14, 0, 0, 0], [14, 8, 2, 0], [12, 8, 3, 8], [16, 10, 4, 10], [14, 14, 4, 10]];
function arena(of) {
  const T = ARENAS[of], K = kit('arena-' + of); K.zone(-99, 1e9, TOP, 'BONUS ARENA // ' + T.name);
  const edge = g => { const a = g.rand() * 6.283, x = Math.cos(a) * 18, z = 17 + Math.sin(a) * 22; return [Math.max(-13.5, Math.min(13.5, x)), Math.max(-0.5, Math.min(34.5, z))]; };
  const spawn = (g, spec, extra) => { const [x, z] = edge(g); return addEnemy(g, { type: 'seek', x, y: 4.5, z, r: 0.6, score: 100, ph: g.rand() * 6, ...spec, ...extra }); };
  const tick = g => {
    const A = g.ar || (g.ar = { wave: 0, total: WAVES.length, t: 40, left: 0, name: T.name, q: [] }), alive = g.enemies.filter(e => e.hp > 0);
    A.left = alive.length + A.q.length; const ph = alive.filter(e => e.phase === 1).length; g.recView = ph > alive.length - ph ? 1 : 3;
    if (A.q.length) { if (g.tick % 30 === 0) for (let i = 0; i < 2 && A.q.length; i++) { const [spec, extra] = A.q.shift(); spawn(g, spec, extra); } return; } // enemies pour in from the edges a few at a time
    runMini(g); if (alive.length) { A.t = 0; return; }
    if (++A.t < 75) return; A.t = 0;
    if (A.wave >= WAVES.length && !A.mini) { A.mini = true; const M = ARENA_MINI[of]; g.mini = addEnemy(g, { type: 'seek', sp: 0, keep: 1e6, mini: true, name: M.name, ai: M.ai, x: 0, y: 4.5, z: 30, hp: Math.round(M.hp * power(g)), hpMax: Math.round(M.hp * power(g)), r: M.r, col: M.col, shape: M.shape, score: 0, big: true }); hint(g, 'MINIBOSS // ' + M.name, 200); g.fx.push('charge', 'say:miniboss'); g.obs.length = 0; return; }
    if (A.wave >= WAVES.length) { g.state = 'clear'; g.endT = 0; g.score += 15000; g.fx.push('clear', 'say:arena clear', 'toast:ALL WAVES CLEARED|+15000'); return; }
    const w = WAVES[A.wave++], hpx = 1 + A.wave * 0.25; hint(g, 'WAVE ' + A.wave + ' / ' + WAVES.length + (A.wave === 3 ? '   WHITE ONES: SHIFT TO ISO' : ''), 150); g.fx.push('charge'); if (A.wave === 1) T.hazard(g);
    const add = (n, spec, extra) => { for (let i = 0; i < n; i++) A.q.push([spec, { ...extra, hp: Math.round((extra.hp || spec.hp) * hpx) }]); };
    add(w[0], T.grunt, { hp: T.grunt.hp * 4, score: 15 }); add(w[1], T.fast, { hp: T.fast.hp * 5, score: 25 }); add(w[3], T.grunt, { col: '#ffffff', phase: 1, hp: T.grunt.hp * 4, score: 30 });
    for (let i = 0; i < w[2]; i++) A.q.push([T.gun, { sp: 2, keep: 7, hp: Math.round(T.gun.hp * 4 * hpx), score: 80, r: T.gun.r || 0.9, pod: i === 0 && A.wave % 2 === 0 }]);
    for (let i = A.q.length - 1; i > 0; i--) { const j = g.rand() * (i + 1) | 0; [A.q[i], A.q[j]] = [A.q[j], A.q[i]]; }
    if (A.wave === WAVES.length) hint(g, 'FINAL WAVE', 150);
  };
  return K.done({ name: T.name, title: T.title, bonus: true, arena: true, tick, rules: { arena: true }, theme: { ...T.theme, arena: T.col } });
}

export const LEVELS = {
  earth: { build: earth, n: 1, name: 'EARTH', sub: 'NEO TERRA', next: 'mars', bonus: 'moon', boss: 'OVERSEER', info: 'CYBER CITY. SKYSCRAPERS, SKYWAYS, FIREWALL GATES.' },
  mars: { build: mars, n: 2, name: 'MARS', sub: 'THE FORGE', next: 'jupiter', bonus: 'sun', boss: 'THE COLOSSUS', info: 'LAVA GEYSERS, FIRE ARCS, ALIEN STONE HEADS.', kit: [1, 1, 1, 0, 0, 1, 0, 0] },
  jupiter: { build: jupiter, n: 3, name: 'JUPITER', sub: 'STORM DECK', next: 'x', bonus: 'belt', boss: 'THE EYE', info: 'LIGHTNING CHAINS, STORM WALLS, HIDDEN WRAITHS.', kit: [2, 2, 1, 1, 1, 1, 0, 0] },
  x: { build: planetx, n: 4, name: 'PLANET X', sub: 'THE BLOOM', next: null, bonus: 'pluto', boss: 'THE SHIFTER', info: 'THE SOURCE OF THE SHIFT. EVERYTHING IS ALIVE.', kit: [3, 2, 2, 2, 2, 2, 0, 0] },
  moon: { build: moon, name: 'THE MOON', sub: 'SEA OF QUIET', isBonus: true, of: 'earth', info: 'LOW GRAVITY TRENCH RUN. NOTHING SHOOTS BACK.', kit: [1, 1, 0, 0, 0, 0, 0, 0] },
  sun: { build: sun, name: 'THE SUN', sub: 'CORONA', isBonus: true, of: 'mars', info: 'SURF THE FLARES. STAY IN THE SHADOW LANE.', kit: [1, 1, 1, 0, 0, 1, 0, 0] },
  belt: { build: asteroids, name: 'ASTEROID BELT', sub: 'THE RUBBLE', isBonus: true, of: 'jupiter', info: 'ROCKS SPLIT. SOME CARRY UPGRADE PODS.', kit: [2, 2, 1, 1, 1, 1, 0, 0] },
  pluto: { build: pluto, name: 'PLUTO', sub: 'THE COLD EDGE', isBonus: true, of: 'x', info: 'SHATTER THE ICE SHELF, THREAD THE SPIRES.', kit: [3, 2, 2, 2, 2, 2, 0, 0] } };
for (const id of ['earth', 'mars', 'jupiter', 'x']) LEVELS['arena-' + id] = { build: () => arena(id), name: ARENAS[id].name, sub: ARENAS[id].title, isBonus: true, isArena: true, of: id, info: 'FIVE WAVES. GUNS AIM THEMSELVES. L / R FLIPS TOP AND ISO.', kit: LEVELS[id].kit ? LEVELS[id].kit.map(v => Math.min(5, v + 1)) : [1, 1, 1, 0, 0, 1, 0, 0] };
export const ORDER = ['earth', 'mars', 'jupiter', 'x'];
export const buildLevel = id => LEVELS[id].build();
