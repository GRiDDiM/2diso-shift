// 2DISO SHIFT — every level. Nine stages from Earth to Planet X (the Moon is built but shelved); four arenas, switched off for the jam.
// Each stretch is built so one view is the way through; the banner and the flashing view pip say which.
import { glitch, info, addEnemy, addObs, addRing, addPod, bullet, aimed, explode, hint, doShift, pop, near, SPAWN_Z, DT, VIEWS } from './game.js';
const SIDE = 0, ISO = 1, CHASE = 2, TOP = 3;

const FAR = 62;
// ---------- builder kit ----------
function kit(id) {
  const ev = [], zones = [], checkpoints = [], hills = []; let gid = 0; const hill = (z0, z1, h) => hills.push([z0, z1, h]);
  const at = (z, fn) => ev.push({ z: z - SPAWN_Z, src: z, fn });
  const far = (z, fn, ob) => { const e = { z: z - FAR, lim: z - SPAWN_Z, src: z, oz: ob ? z : null }; e.fn = g => fn(g, e.d || 0); ev.push(e); }; // e.d: how far a cut moved it // scenery is placed well beyond the old horizon and fades in, so nothing pops up in your face
  const obs = (z, o) => { far(z, (g, d) => addObs(g, { ...o, z: z + d - g.camZ }), true); if (o.ghost && o.kind !== 'safe' || o.keep) ev[ev.length - 1].keep = true; }; // a gate's safe hole is cleared with its walls, so no gate is ever left as a floating hole // ghosts (fog, clouds, channels) are not cleared around a change of view
  const ring = (z, r) => far(z, (g, d) => addRing(g, { ...r, z: z + d - g.camZ }), true);
  const en = (z, o) => at(z, g => addEnemy(g, o));
  const ground = (z, o) => far(z, (g, d) => addEnemy(g, { rel: false, z: z + d - g.camZ, y: 0.5, y0: 0.5, type: 'turret', ...o }));
  const wing = (z, n, o, gap = 2.2) => { const gr = id + (++gid); if (gid % 3 === 1) ev.push({ z: z - SPAWN_Z - 7, src: z, fn: g => g.warns.push({ x: o.x ?? 0, y: o.y ?? 4.5, t: 80, col: o.col || '#ff4d6d' }) }); /* every third wave flashes a warning where it will come in */ for (let i = 0; i < n; i++) at(z + i * gap, g => addEnemy(g, { type: 'pop', group: gr, gn: n, hp: 2, ph: i * 0.5, ...o })); };
  const form = (z, n, fn, gap = 1.6) => { const gr = id + (++gid); for (let i = 0; i < n; i++) at(z + i * gap, g => addEnemy(g, { type: 'pop', group: gr, gn: n, hp: 2, ...fn(i, n) })); }; // a formation: fn(i) says where each one flies and what it does
  const untilChase = z => { const c = zones.filter(q => q.view === CHASE && q.z0 > z + 20).sort((a, b) => a.z0 - b.z0)[0]; return c ? c.z0 - 45 : null; }; // a warp closes before the next stretch that is played in chase anyway, so nobody falls into it by accident and skips that stretch
  const warp2 = (z, x, y) => ARENAS_ON && ev.push({ z, src: z, fn: g => { if (g.flags.arena) return; addRing(g, { x, y, z: 10, r: 2, kind: 'warp', to: 'arena', stay: true, t: 0, life: 1200, until: untilChase(z) }); info(g, 'anomaly detected. chase view to reach it'); g.fx.push('ring'); } }); // the second warp: it leads to this planet's arena
  const warp = (z, x, y) => ev.push({ z, src: z, fn: g => { if (g.flags.warp) return; addRing(g, { x, y, z: 10, r: 2, kind: 'warp', stay: true, t: 0, life: 1200, until: untilChase(z) }); info(g, 'anomaly detected. chase view to reach it'); g.fx.push('ring'); } });
  // extra waves: every `step` units a flight of the level's own enemy, shaped for the view that stretch is played in, with divers in between
  const fill = (tmpl, from, to, step, clut = 'billboard', gshape = 'tank') => { for (let i = 0, z = from; z < to; z += step, i++) { const v = (zones.find(q => z >= q.z0 && z < q.z1) || {}).view, h = Math.abs(Math.sin(z * 12.9898)) % 1, h2 = Math.abs(Math.sin(z * 78.233)) % 1;
    const o = v === 0 ? { x: 0, y: 2.4 + h * 5, ay: 1.2 + h2 } : v === 3 ? { x: h * 9 - 4.5, ax: 3 + h2 * 2, y: 5 } : { x: h * 6 - 3, y: 3 + h2 * 4, ax: 2.5, ay: 1 };
    if (i % 4 === 1) { const cy = v === 3 ? 5 : 2.2 + h2 * 5, cx = v === 0 ? 0 : h * 10 - 5; obs(z + step / 2, { x: cx, y: cy, hx: 0.8, hy: 0.8, hz: 0.8, col: tmpl.col, kind: clut, hp: 3, score: 60, gem: i % 8 === 1, pod: i % 8 === 5 }); } // and something small to blast in the gaps
    if (i % 3 === 1) { const up = i % 6 === 4, yy = up ? 8.9 : 0.75, n = gshape === 'walker' && !up ? 2 : 1; for (let q = 0; q < n; q++) ground(z + step * 0.3 + q * 2.6, { type: 'walker', x: (h2 * 12 - 6) * (q ? -1 : 1), vx: (h > 0.5 ? 1 : -1) * (q ? -1 : 1) * (1.2 + h2), y: yy, y0: yy, col: tmpl.col, hp: 4, r: gshape === 'walker' ? 1.15 : 0.85, score: 200, fire: 150, bs: 6, shape: gshape, ceil: up, pod: i % 9 === 4 && !q }); } // ground troops: they walk or drive the floor (and sometimes the ceiling) and shoot; crawlers come in pairs // ground troops: they walk or drive the floor (and sometimes the ceiling) and shoot
    if (i % 3 === 2) for (let k = 0; k < 3; k++) en(z + k * 2.5, { ...tmpl, type: 'kami', hp: 1, vz: -6, score: 80, x: v === 0 ? 0 : (k - 1) * 3 + o.x * 0.5, y: v === 3 ? 5 : 2.5 + ((k + i) % 3) * 2.2 }); else wing(z, 4 + (i % 2), { ...tmpl, ...o }); } };
  const zone = (z0, z1, view, msg) => zones.push({ z0, z1, view, msg });
  // tilt(z0, z1, spec): the stage itself moves for a stretch. rot = a fixed turn of the screen, sway = rocking, spin = a steady roll, px / py = drifting left-right and up-down
  const tilts = [], tilt = (z0, z1, spec) => tilts.push({ z0, z1, ...spec });
  const gate = (z, hx, hy, o = {}) => { const w = o.w || 2.2, h = o.h || 1.9, k = { hz: 0.5, kind: 'gate', col: '#ffe14a', org: 1, ...o }, X = 11, T = 12.5, Bm = -3;
    obs(z, { x: (-X + hx - w) / 2, y: 4.75, hx: (hx - w + X) / 2, hy: 7.75, ...k }); obs(z, { x: (X + hx + w) / 2, y: 4.75, hx: (X - hx - w) / 2, hy: 7.75, ...k });
    obs(z, { x: hx, y: (T + hy + h) / 2, hx: w, hy: (T - hy - h) / 2, ...k }); obs(z, { x: hx, y: (hy - h + Bm) / 2, hx: w, hy: (hy - h - Bm) / 2, ...k });
    obs(z, { x: hx, y: hy, hx: w, hy: h, hz: 0.5, ghost: true, kind: 'safe', osc: k.osc, org: ++gid, gcol: k.col }); if (!o.noRing && !k.osc) ring(z, { x: hx, y: hy, r: 1.5 }); };
  // cut(z0, z1): drop a stretch of a level after it is written. Everything in it goes, everything past it slides back
  const cuts = [], cut = (a, b) => cuts.push([a, b]);
  const cmap = (z, keep) => { for (const [a, b] of cuts) if (z >= a && z < b) { if (!keep) return null; z = a; } return z - cuts.reduce((t, [a, b]) => t + (b <= z ? b - a : 0), 0); };
  const applyCuts = () => { if (!cuts.length) return;
    for (let i = ev.length - 1; i >= 0; i--) { const e = ev[i]; if (e.src == null) continue; const nz = cmap(e.src); if (nz == null) { ev.splice(i, 1); continue; } const d = nz - e.src; e.d = d; e.z += d; if (e.lim != null) e.lim += d; if (e.oz != null) e.oz += d; }
    for (let i = zones.length - 1; i >= 0; i--) { const q = zones[i]; q.z0 = q.z0 < -90 ? q.z0 : cmap(q.z0, true); if (q.z1 < 1e8) q.z1 = cmap(q.z1, true); if (q.z1 <= q.z0) zones.splice(i, 1); }
    for (let i = checkpoints.length - 1; i >= 0; i--) { const c = cmap(checkpoints[i]); if (c == null) checkpoints.splice(i, 1); else checkpoints[i] = c; }
    for (let i = hills.length - 1; i >= 0; i--) { const h = hills[i]; h[0] = cmap(h[0], true); h[1] = cmap(h[1], true); if (h[1] - h[0] < 4) hills.splice(i, 1); }
    for (let i = tilts.length - 1; i >= 0; i--) { const q = tilts[i]; q.z0 = cmap(q.z0, true); q.z1 = cmap(q.z1, true); if (q.z1 - q.z0 < 4) tilts.splice(i, 1); } };
  const done = extra => { applyCuts(); if (extra.endZ) extra.endZ = cmap(extra.endZ, true); // nothing solid sits right around a change of view: you get a clear run to make the shift
    for (let i = ev.length - 1; i >= 0; i--) { const e = ev[i]; if (e.oz != null && !e.keep && zones.some((q, k) => k > 0 && e.oz > q.z0 - 30 && e.oz < q.z0 + 8)) ev.splice(i, 1); }
    ev.sort((a, b) => a.z - b.z); return { id, events: ev, zones, checkpoints, hills, tilts, len: extra.endZ || zones.find(q => q.z1 > 1e8)?.z0 || 0, ...extra }; };
  return { at, obs, ring, en, ground, wing, form, zone, gate, warp, warp2, fill, hill, checkpoints, cut, tilt, done };
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
    { const k = bossScale(g); if (b.k && Math.abs(k - b.k) > 1e-3 && !b.dying) { b.hp *= k / b.k; b.max = Math.round(b.max * k / b.k); } b.k = k; } // your firepower changed (an upgrade, or losing guns to a death): health and its cap scale together, so the boss keeps the same share it had
    const S = spec.stages[b.stage], p = g.players[0];
    if (b.dying) { b.dying++; g.lockShift = true; if (spec.glitchy && (b.dying === 2 || b.dying % 36 === 2)) glitch(g, b.dying === 2 ? 50 : 22, b.dying === 2 ? 1 : 0.8); for (const q of g.players) q.inv = Math.max(q.inv, 40); // the finisher: the fold rolls through all four views while it comes apart
      if (b.dying % 36 === 2 && b.dying < 146) { g.viewFrom = g.view; g.view = (g.view + 1) % 4; g.shiftT = 1; g.shiftDir = 1; g.fx.push('shift', 'boom2'); g.flash = 8; for (let i = 0; i < 3; i++) g.shocks.push({ x: b.x, y: b.y, z: b.z, r: 0.5, vr: 14 + i * 10, life: 30, max: 30, col: ['#ffffff', '#ff3df0', '#2ee6ff'][i] }); }
      if (b.dying % 6 === 0) { explode(g, b.x + (g.rand() - 0.5) * 5, b.y + (g.rand() - 0.5) * 5, b.z + (g.rand() - 0.5) * 3, ['#ff3df0', '#ffe14a', '#2ee6ff', '#ffffff'][b.dying / 6 & 3], 26, 14, spec.splat); g.fx.push('boom2'); g.shake = 12; }
      if (b.dying > 150) { explode(g, b.x, b.y, b.z, '#ffffff', 90, 26, spec.splat); g.flash = 20; g.shake = 22; b.gone = true; g.boss = null; g.lockShift = false; g.score += b.score; g.state = 'clear'; g.endT = 0; g.fx.push('clear', 'say:' + spec.name + ' destroyed. sector clear.', 'toast:LEVEL COMPLETE|' + spec.toast); } return; }
    g.recView = S.rec; if (b.z > 29) { b.z -= 6 * dt; b.st = 0; return; }
    b.vuln = S.vuln; b.col = S.col; b.st++;
    b.x = Math.sin(b.st * 0.011) * (S.sway ?? 1.5); b.y = 4.6 + Math.sin(b.st * 0.017) * (S.bob ?? 0.8);
    b.ovk = Math.max(0, Math.min(1, (b.ovk || 0) + (b.ovOn ? 0.05 : -0.03))); b.ovOn = false; if (b.st % 400 === 240) addPod(g, (g.rand() - 0.5) * 10, 2 + g.rand() * 5, b.z - 2); if (b.ovk > 0) { b.x += (b.ovx - b.x) * b.ovk; b.y += (b.ovy - b.y) * b.ovk; } // an attack can take over where the boss is (the Eye turning to face you)
    if (b.hp <= 0) {
      if (b.stage < spec.stages.length - 1) { b.stage++; b.hp = b.max; b.st = -110; g.obs.length = 0; g.ebul.length = 0; explode(g, b.x, b.y, b.z, S.col, 60, 18, spec.splat); g.shake = 14; g.flash = 8; g.fx.push('boom2'); addPod(g, b.x - 1, b.y, b.z - 2); addPod(g, b.x + 1, b.y, b.z - 3); g.score += 5000; hint(g, 'SHELL DOWN - SHIFT TO ' + VIEWS[spec.stages[b.stage].rec] + ' VIEW', 220); if (spec.glitchy) glitch(g, 45, 0.95); }
      else { b.dying = 1; g.obs.length = 0; g.ebul.length = 0;  } return; }
    if (b.st < 0) return;
    if (spec.sig && b.st >= 420) { const c = (b.st - 420) % 1020; if (c === 0) { hint(g, spec.sig.name + ' - INCOMING!', 170); g.fx.push('charge'); g.shake = Math.max(g.shake, 5); } if (c >= 40 && c < 280) spec.sig.fire(g, b, c - 40); } // the boss's signature bullet storm
    if (spec.glitchy && b.st % 540 === 270) { glitch(g, 26, 0.7); g.fx.push('charge'); } // the Shifter reaches out of the fight and scrambles the screen
    S.attack(g, b, b.st);
    if (spec.adds && b.st > 90 && b.st % (spec.addEvery || 560) === 0) { const n = 3 + Math.min(3, b.stage); for (let i = 0; i < n; i++) addEnemy(g, { type: 'pop', hp: 3, x: (i - (n - 1) / 2) * 2.4, y: 2.6 + (i % 3) * 2, z: b.z - 2, vz: -6, ax: 1.6, ay: 1, ph: i * 0.7, score: 120, ...spec.adds }); }
    if (b.deflect === 5 && g.tick % 90 < 8) pop(g, 'SHIELDED - SHIFT TO ' + VIEWS[S.rec], p.x, p.y + 1.5, p.z + 3, RED);
  };
  return { update, stages: spec.stages, name: spec.name };
}
// boss health follows your firepower: each boss's listed health is for a mid-strength loadout, from about 0.8x with
// hardly any upgrades to about 1.9x with every gun and drone maxed. Co-op takes the stronger ship
export const bossScale = g => { let best = 0; for (const p of g.players) { let w = p.up[0] * 0.5; for (let i = 1; i <= 5; i++) w += [0, 1, 2, 3, 4, 4, 5][Math.min(6, p.up[i])]; /* by rank, so a god mode running at the time does not count */ best = Math.max(best, w); } return Math.max(0.75, Math.min(1.9, 0.6 + 0.045 * best)); };
const spawnBoss = (K, z, o) => K.at(z, g => { const hp = Math.round((o.hp || 520) * bossScale(g)); g.boss = addEnemy(g, { type: 'boss', x: 0, y: 4.6, z: 42, hx: 2.6, hy: 2.8, hz: 1.8, r: 2.6, col: '#ff3df0', score: 20000, big: true, stage: 0, vuln: [], st: 0, ...o, hp }); g.fx.push('bossin'); });

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
  for (let z = 30; z < 108; z += 9) { const h = 1.6 + (z % 5) * 0.75; tower(z, ((z * 7) % 13) - 6, h); if (h < 3 && z > 40) { const d = 1.4 + (z % 3) * 0.7; obs(z + 2, { x: ((z * 11) % 13) - 6, y: 9.5 - d / 2, hx: 1.3, hy: d / 2, hz: 1.3, col: C.pylon, kind: 'tower' }); } }
  for (let i = 0, z = 34.5; z < 106; z += 9, i++) { if (i % 2) obs(z, { x: ((z * 5) % 11) - 5, y: 2.4, hx: 0.3, hy: 2.4, hz: 0.3, col: C.pylon, kind: 'pylon' }); else tower(z, ((z * 3) % 13) - 6, 2.2 + (i % 4) * 0.8); } // more city: infill blocks and antenna masts between the towers
  sign(48, 2, 7.6); sign(78, -3, 2.6); sign(96, 0, 7.2);
  wing(38, 5, { ...dart, y: 6.5, ay: 1.6, x: 0 }); wing(58, 5, { ...dart, y: 4.2, ay: 1.4, x: -2 }); carrier(72, { y: 6, x: 2 }); wing(86, 6, { ...dart, y: 7, ay: 1.5, x: 3 }); carrier(100, { y: 5, x: -2 });

  zone(110, 335, ISO, 'SKYSCRAPERS - SHIFT TO ISO VIEW');
  for (let i = 0, z = 146; z < 322; z += 16, i++) { (i % 2 ? [-3.2, 3.2] : [-6.4, 0, 6.4]).forEach((x, k) => tower(z, x, (i + k) % 3 === 0 ? 3.4 + (i % 2) : 9.5)); // some blocks are low enough to fly over
    if (i % 2) { obs(z, { x: -8.1, y: 4.75, hx: 0.5, hy: 4.75, hz: 1.3, col: C.tower, kind: 'tower' }); obs(z, { x: 8.1, y: 4.75, hx: 0.5, hy: 4.75, hz: 1.3, col: C.tower, kind: 'tower' }); }
    if (i % 3 === 1) turret(z + 8, i % 2 ? 0 : 3.2); if (i % 3 === 2) turret(z + 8, -3.2);
    if (i % 4 === 0 && i) car(z + 8, -8 + i, 5, i % 8 ? 2.6 : -2.6, 2.4); if (i % 4 === 2) fence(z + 8, i % 8 === 2 ? 6.4 : -6.4, i * 30);
    if (i % 2) tower(z + 8, i % 4 === 1 ? 6.4 : -6.4, 9.5); else if (i % 3 === 0) tower(z + 8, i % 4 === 0 ? -3.2 : 3.2, 9.5); sign(z + 4, i % 2 ? 0 : (i % 4 ? -3.2 : 3.2), 5); } // cross traffic and laser fences between the towers
  wing(162, 5, { ...dart, x: 0, ax: 4, y: 5 }); saucer(192, { x: 0, y: 6 }); wing(228, 6, { ...dart, x: -2, ax: 5, y: 3 }); carrier(252, { x: 3.2, y: 5 }); wing(278, 5, { ...dart, x: 2, ax: 4, y: 6 }); carrier(305, { x: -3.2, y: 5 });
  K.checkpoints.push(338);

  zone(335, 565, SIDE, 'SKYWAYS AHEAD - SHIFT TO SIDE VIEW');
  for (let i = 0, z = 372; z < 550; z += 18, i++) { slab(z, i % 2 === 0); if (i % 3 === 2) slab(z + 6, i % 2 === 0); if (i % 3 === 0 && i) lift(z + 9, i); if (i % 3 === 1) sign(z + 10, 0, i % 2 ? 7.4 : 2.2); if (i % 3 === 1) tower(z + 14, 0, i % 2 === 0 ? 2 : 1.4); }
  wing(384, 4, { ...dart, y: 5.6, ay: 0.6, x: 0 }); wing(418, 5, { ...dart, y: 3, ay: 0.8, x: 2 }); carrier(444, { y: 5, x: -2 }); kami(476, { x: 0, y: 5 }); wing(504, 6, { ...dart, y: 5, ay: 1.8, x: 0 }); carrier(534, { y: 4.6, x: 1 });
  K.checkpoints.push(568);

  zone(565, 800, CHASE, 'FIREWALL GATES - SHIFT TO CHASE VIEW');
  const holes = [[0, 4.5], [3.5, 6], [-3.5, 3.2], [3, 3], [-3, 6.4], [0, 5], [4.5, 4.4], [-4.5, 5.2], [0, 3.2]];
  holes.forEach(([x, y], i) => { const z = 604 + i * 22; gate(z, x, y); if (i % 2) kami(z + 11, { x: x * 0.5, y }); else if (i % 4 === 2) carrier(z + 11, { x: holes[i + 1][0], y: holes[i + 1][1], vz: -5 }); });
  wing(588, 4, { ...dart, x: 0, y: 4.5, ax: 2, ay: 1 });
  K.checkpoints.push(804);

  // a tower going up: half-built girders at every height, crane loads swinging across the lane, crate stacks to shoot through
  zone(800, 1010, CHASE, 'CONSTRUCTION ZONE - SHIFT TO CHASE VIEW');
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

  zone(1010, 1220, CHASE, 'HOVER TRAFFIC - STAY IN CHASE VIEW'); K.tilt(1030, 1215, { sway: 0.16, w: 0.011, px: 34, py: 16 }); // the whole street banks as you weave through it
  for (let i = 0, z = 1048; z < 1210; z += 10, i++) { const y = [2.4, 5, 7.4][i % 3], d = i % 2 ? 4 : -4; car(z, -8 + (i * 5) % 16, y, d); car(z, 2 - (i * 3) % 10, y, d); car(z + 5, 6 - (i * 7) % 14, [5, 7.4, 2.4][i % 3], -d * 1.4, i % 3 === 0 ? 2.4 : 1.3); car(z + 2.5, -6 + (i * 4) % 13, [7.4, 2.4, 5][i % 3], d * 0.8); car(z + 7.5, 5 - (i * 6) % 12, [2.4, 5, 7.4][(i + 1) % 3], -d); if (i % 4 === 1) obs(z + 5, { x: ((i * 5) % 11) - 5, y: 4.75, hx: 0.7, hy: 4.75, hz: 0.7, col: C.pylon, kind: 'pylon' }); if (i % 6 === 3 && z < 900) slab(z + 5, false, { hz: 0.8 }); }
  K.warp2(342, -3, 6);
  K.hill(56, 86, 1.7); K.hill(636, 700, 1.5); K.hill(880, 940, 1.7); K.hill(1090, 1150, 1.4); K.hill(170, 222, 1.7); K.hill(258, 312, 2.1); K.hill(1238, 1272, 1.3); // overpasses and embankments: the ground rises and the ship rides over
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
  const B = boss({ name: 'OVERSEER', sig: { name: 'DATA STORM', fire(g, b, c) { const dir = (c / 60 | 0) % 2 ? -1 : 1; if (c % 3 === 0) for (let k = 0; k < 4; k++) { const a = dir * c * 0.07 + k * 1.5708; bullet(g, b.x, b.y, b.z - 2, Math.cos(a) * 3.2, Math.sin(a) * 3.2, -5.5, k % 2 ? '#ff3df0' : '#2ee6ff'); }
      if (c % 40 === 20) for (let i = 0; i < 12; i++) { const sd = i / 3 | 0, u = (i % 3 - 1) * 1.4, P = [[u, 2.2], [2.2, u], [u, -2.2], [-2.2, u]][sd]; bullet(g, b.x, b.y, b.z - 2, P[0], P[1], -4.6, '#ffe14a'); } } }, // four spinning arms of data that flip direction, and square packets of yellow
    toast: 'EARTH DEFENDED', adds: { col: '#ff3df0', hp: 3, r: 0.6 }, addEvery: 600, stages: [
    { name: 'FIREWALL', vuln: [SIDE], rec: SIDE, col: '#ff3df0', bob: 2, attack(g, b, t) { if (t % 330 === 40) sheetH(g, 2 + g.rand() * 5.2, 1.6, { warm: 150 }); if (t % 140 === 100) fan(g, b, 3, 6.5); } },
    { name: 'GRIDLOCK', vuln: [TOP], rec: TOP, col: '#2ee6ff', sway: 4, attack(g, b, t) { if (t % 330 === 40) sheetV(g, -5 + g.rand() * 10, 1.9, { warm: 150 }); if (t % 330 === 220) for (let i = 0; i < 4; i++) addEnemy(g, { type: 'pop', x: -5 + i * 3.3, y: 4.6, z: b.z - 1, vz: -5, ax: 1.5, hp: 2, col: '#ff3df0', ph: i }); if (t % 165 === 120) for (let i = -2; i <= 2; i++) bullet(g, b.x, 4.6, b.z - 2, i * 2.2, 0, -6); } },
    { name: 'CORE BREACH', vuln: [CHASE, ISO], rec: CHASE, col: '#ffe14a', attack(g, b, t) { if (t % 270 === 30) throwGate(g, b, { vz: -5.5 }); if (t % 22 === 0 && t % 270 > 200) { const a = t * 0.09; bullet(g, b.x, b.y, b.z - 2, Math.cos(a) * 3, Math.sin(a) * 3, -6, '#ff3df0'); } } }] });
  K.fill(dart, 125, 1400, 50, 'billboard');
  K.cut(270, 318); K.cut(455, 545); K.cut(745, 792); // Earth ran long: shorter skyscrapers, skyways and gate run
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

  zone(-99, 95, SIDE, 'SECTOR 3 // MARS - THE FORGE');
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
  K.warp2(306, 3, 5); K.hill(28, 52, 1.6); K.hill(62, 86, 2); K.hill(590, 642, 1.7); K.hill(968, 1022, 1.4); K.hill(128, 176, 1.9); K.hill(214, 268, 2.3); K.hill(1060, 1100, 1.3); /* dunes and ridges */ fall(424, 0); fall(446, 85); fall(468, 170); at(398, g => hint(g, 'LAVAFALLS - WAIT FOR THEM TO STOP', 200));
  for (let i = 0, z = 472; z < 512; z += 15, i++) arc(z, i % 2 ? 2.4 : 6.8, { osc: { ax: 0, ay: 1.6, w: 2.4, ph: i * 2 } });
  worm(350, 0); worm(388, 0, 7); wing(410, 5, { ...ember, y: 5, ay: 1.2 }); forge(436, { x: 0, y: 6.5, ax: 1 }); worm(486, 0, 7);
  K.checkpoints.push(523);

  // the caves: rock spikes from the floor and the roof, pillars, and rocks that let go of the ceiling as you pass. Only ISO shows where everything is
  zone(520, 730, CHASE, 'THE CAVES - SHIFT TO CHASE VIEW');
  const spike = (z, x, up, h = 4.4) => obs(z, { x, y: up ? h / 2 : 9.6 - h / 2, hx: 0.8, hy: h / 2, hz: 0.8, col: ROCK, kind: 'stalag' });
  const rockfall = (z, x, o) => obs(z, { x, y: 8.6, hx: 0.95, hy: 0.95, hz: 0.95, col: ROCK, kind: 'boulder', hp: 6, score: 120, drop: 13, ...o });
  for (let i = 0, z = 552; z < 716; z += 11, i++) { const m = i % 4, sd = i % 8 < 4 ? 1 : -1;
    if (m === 0) { spike(z, -5 * sd, true); spike(z, 1 * sd, true, 3.6); spike(z, 5.5 * sd, false); }
    else if (m === 1) { rockfall(z, 3 * sd, { gem: true }); rockfall(z + 3, -3.5 * sd); rockfall(z + 6, 0.5 * sd, { pod: i % 8 === 1 }); }
    else if (m === 2) { spike(z, -4 * sd, false); spike(z, 2 * sd, false, 3.8); spike(z, 6 * sd, true); spike(z + 5, -1 * sd, true, 3.2); }
    else { obs(z, { x: 3.5 * sd, y: 4.75, hx: 1.1, hy: 4.75, hz: 1.1, col: ROCK, kind: 'rockwall' }); spike(z, -3 * sd, true, 3); rockfall(z + 5, -6 * sd); volcano(z + 5, -2 * sd); } }
  wing(540, 5, { ...ember, x: 0, y: 5, ax: 3, ay: 1.2 }); forge(590, { x: -2, y: 6 }); wing(630, 6, { ...ember, x: 2, y: 4, ax: 4, ay: 1.4 }); worm(668, 0, 6); wing(700, 5, { ...ember, x: -2, y: 6, ax: 3 });
  at(546, g => hint(g, 'WATCH THE ROOF - ROCKS FALL', 200));
  K.checkpoints.push(733);

  // THE LABYRINTH: a maze of lava rock seen from above, and the forge holds you at SLOW the whole way. One gap per row is the way on;
  // the extra gaps lead into side pockets with gems and pods, walled off at the far end by rock you have to blast through
  zone(730, 900, TOP, 'THE LABYRINTH - SHIFT TO TOP VIEW');
  at(736 + SPAWN_Z, g => { g.gearWas = g.gear; g.forceGear = 0; hint(g, 'THE LABYRINTH - THE FORGE HOLDS YOU AT SLOW. FIND THE WAY THROUGH', 260); g.fx.push('gear'); });
  at(894 + SPAWN_Z, g => { g.forceGear = null; g.gear = Math.min(2, g.gearWas ?? 1); g.fx.push('gear'); });
  { const E = k => -8.6 + k * 3.44, P = [2, 0, 1, 4, 3, 0, 2, 4, 1, 3], DEC = { 0: 3, 2: 0, 4: 4, 6: 1, 8: 4 }, Z0 = 750, ST = 12.5;
    const wall = (z, a, b) => obs(z, { x: (E(a) + E(b)) / 2, y: 4.75, hx: (E(b) - E(a)) / 2, hy: 4.75, hz: 0.6, col: ROCK, kind: 'rockwall' });
    P.forEach((open, r) => { const z = Z0 + r * ST, shut = []; for (let c = 0; c < 5; c++) shut.push(c !== open && DEC[r] !== c);
      const pk = DEC[r - 1]; if (pk != null) { shut[pk] = false; boulder(z, (E(pk) + E(pk + 1)) / 2, 4.75, { hx: 1.72, hy: 4.75, hz: 0.6, hp: 16, score: 200 }); } // the end of a pocket: blast it
      for (let c = 0; c < 5;) { if (!shut[c]) { c++; continue; } let e = c; while (e < 5 && shut[e]) e++; wall(z, c, e); c = e; }
      if (DEC[r] != null && r + 1 < P.length) { const d = DEC[r], lo = Math.min(open, P[r + 1]), edge = d < lo ? d + 1 : d; // a divider between the pocket and the way on
        obs(z + ST / 2, { x: E(edge), y: 4.75, hx: 0.35, hy: 4.75, hz: ST / 2 - 0.4, col: ROCK, kind: 'rockwall' });
        boulder(z + ST / 2, (E(d) + E(d + 1)) / 2, 1.1, { gem: true, hp: 5 }); if (r % 4 === 0) boulder(z + ST / 2 + 3, (E(d) + E(d + 1)) / 2, 3.4, { pod: true, hp: 5 }); }
      if (DEC[r] != null && r % 4 === 2) volcano(z + ST / 2 + 2, (E(DEC[r]) + E(DEC[r] + 1)) / 2); }); // a stone head guarding some of the pockets
    wing(760, 4, { ...ember, x: 0, ax: 5, y: 5 }); wing(814, 4, { ...ember, x: 0, ax: 5, y: 5 }); forge(860, { x: 0, y: 6 }); }
  K.checkpoints.push(904);
  zone(900, 1120, CHASE, 'MAGMA TUBES - SHIFT TO CHASE VIEW'); K.tilt(935, 1110, { spin: 0.0026 }); at(935 + SPAWN_Z, g => hint(g, 'THE TUBE IS ROLLING - HOLD ON', 200)); // the tube turns all the way round as you fly it
  [[0, 4.5], [3.5, 5.5], [-3.5, 3.5], [0, 6], [4, 3.4], [-4, 5.6], [0, 4], [3, 6]].forEach(([x, y], i) => { const z = 936 + i * 23; gate(z, x, y, { col: FIRE, kind: 'gate', osc: i > 2 ? { ax: 1.3, ay: 0, w: 1.5, ph: i } : null }); if (i % 2) wing(z + 11, 3, { ...ember, x: x * 0.5, y, ax: 1.5 }); else if (i % 4 === 2) forge(z + 10, { x: 0, y: 5 }); else boulder(z + 11, -6, 1.1, { vx: 3, wrap: 9, hp: 9, gem: true }); if (i % 3 !== 2) river(z + 12, i % 2 ? 3 : -3, i); });
  at(1080, g => addPod(g, 0, 5, SPAWN_Z, 'god'));
  K.checkpoints.push(1124);

  zone(1120, 1e9, TOP, 'WARNING // THE COLOSSUS WAKES');
  spawnBoss(K, 1170, { name: 'THE COLOSSUS', look: 'colossus', hp: 2400, col: STONE });
  // THE COLOSSUS: a giant alien stone head. It makes the ground erupt, floods the lane with lava and ash, then spits rings of fire and its own small heads.
  const B = boss({ name: 'THE COLOSSUS', sig: { name: 'MAGMA BLOOM', fire(g, b, c) { if (c % 14 === 0) { const n = 20, r0 = c * 0.05; for (let i = 0; i < n; i++) { const a = i / n * 6.2832 + r0, sp = 1.8 + 1.5 * Math.abs(Math.sin(3 * a + r0)); bullet(g, b.x, b.y, b.z - 2, Math.cos(a) * sp, Math.sin(a) * sp, -5, (c / 14 | 0) % 2 ? '#ffe14a' : '#ff5a1f'); } } } }, // rings that open like a turning flower, petal by petal
    toast: 'MARS COOLED', adds: { shape: 'ember', col: '#ff8a2b', hp: 3, r: 0.6 }, addEvery: 540, stages: [
    { name: 'ERUPTION', vuln: [TOP], rec: TOP, col: STONE, sway: 2.5, bob: 0.3, attack(g, b, t) {
      if (t % 200 === 30) { const lanes = [-6, -3, 0, 3, 6], skip = g.rand() * 5 | 0; lanes.forEach((x, i) => { if (i !== skip) addObs(g, { rel: true, kind: 'geyser', x: x + (g.rand() - 0.5), y: 4.75, hx: 1.15, hy: 4.75, hz: 1.15, z: 1.5 + g.rand() * 9.5, warm: 95, life: 70, col: FIRE }); }); g.fx.push('charge'); }
      if (t % 200 === 130) for (let i = 0; i < 4; i++) addEnemy(g, { type: 'bomb', x: b.x, y: b.y + 2, z: b.z - 1, vx: -5 + i * 3.3, vy: 6 + g.rand() * 2, vz: -8 - g.rand() * 3, hp: 1, r: 0.5, col: '#ff8a2b', score: 50, shape: 'bomb' }); } },
    { name: 'LAVA TIDE', vuln: [SIDE], rec: SIDE, col: '#ffe14a', sway: 1, bob: 0.5, attack(g, b, t) {
      const c = t % 730; if (c === 30) { addObs(g, { rel: true, kind: 'tide', x: 0, y: -4.2, hx: 9, hy: 4, hz: 11, z: 9, vy: 1.45, warm: 40, life: 190, col: FIRE }); hint(g, 'LAVA RISING - CLIMB!', 110); g.fx.push('charge'); }
      if (c === 290) { addObs(g, { rel: true, kind: 'tide', ash: true, x: 0, y: 13.8, hx: 9, hy: 4, hz: 11, z: 9, vy: -1.45, warm: 40, life: 190, col: '#c0532a' }); hint(g, 'ASH FALLING - DIVE!', 110); g.fx.push('charge'); }
      if (c === 150 || c === 410) { const lowArc = c === 150; for (let i = 0; i < 7; i++) addEnemy(g, { type: 'pop', x: 0, y: 0, y0: lowArc ? 6.6 : 2.6, ay: 2, w: 2.2, ph: -i * 0.45, z: b.z - 2 + i * 0.9, vz: -6, hp: 2, r: 0.6, col: i ? FIRE : '#ffe14a', shape: 'worm', score: 80 }); }
      if (t % 120 === 100) fan(g, b, 2, 7); } },
    { name: 'THE GAZE', vuln: [CHASE, ISO], rec: CHASE, col: '#ff8a2b', attack(g, b, t) { if (t % 150 === 20) fireRing(g, b, FIRE); if (t % 300 === 95) fireRing(g, b, '#ffe14a', 12, 1.5, 3); if (t % 240 === 170) for (let i = 0; i < 2; i++) addEnemy(g, { type: 'kami', x: b.x + (i ? 3 : -3), y: b.y + (i ? 1.5 : -1.5), z: b.z - 2, vz: -8, hp: 3, r: 0.7, col: STONE, score: 150, shape: 'head' }); } }] });
  K.fill(ember, 105, 730, 42, 'boulder', 'walker'); K.fill(ember, 905, 1120, 42, 'boulder', 'walker');
  return K.done({ name: 'MARS', title: 'THE FORGE', boss: B, warpName: 'THE SUN', theme: { sky: 'volcano', grid: '#8a2a12', cave: [522, 728] } });
}

// =====================================================================================
// LEVEL 3 — JUPITER // STORM DECK: lightning chains, storm walls, wraiths in the cloud
// =====================================================================================
function jupiter() {
  const K = kit('jupiter'), { at, obs, ring, en, wing, zone, gate } = K;
  const ZAP = '#7df9ff', CLOUD = '#9d5bff', DECK = '#e23dff', FOG = '#3dffb0';
  const spark = { col: ZAP, shape: 'spark', zig: true, vz: -10, w: 3 };
  const jelly = (z, o) => en(z, { type: 'saucer', col: '#b06bff', hp: 6, r: 0.9, score: 350, hold: 14, dur: 380, ax: 2, ay: 1.5, burst: 8, shape: 'jelly', pod: true, ...o });
  const hbolt = (z, y, ph) => obs(z, { x: 0, y, hx: 8.6, hy: 0.4, hz: 0.5, col: ZAP, kind: 'bolt', pulse: [70, 60, ph] });
  const vbolt = (z, x, ph) => obs(z, { x, y: 4.75, hx: 0.45, hy: 4.75, hz: 0.5, col: ZAP, kind: 'bolt', pulse: [70, 60, ph] });
  const head = (z, x) => obs(z, { x, y: 4.75, hx: 1.5, hy: 4.75, hz: 1.5, col: CLOUD, kind: 'thunderhead' });
  const deck = (z, low) => obs(z, low ? { x: 0, y: 1.9, hx: 8.6, hy: 1.9, hz: 1.4, col: DECK, kind: 'clouddeck' } : { x: 0, y: 7.2, hx: 8.6, hy: 2.3, hz: 1.4, col: DECK, kind: 'clouddeck' });
  const fog = (z, x, y, o) => obs(z, { x, y, hx: 4.5, hy: 2.2, hz: 4, col: FOG, kind: 'fog', ghost: true, ...o }); // fog banks: nothing in them hurts, you just cannot see through them
  const crystal = (z, y, o) => obs(z, { x: 0, y, hx: 8.6, hy: 0.85, hz: 0.7, col: '#9fe9ff', kind: 'crystal', hp: 6, score: 120, ...o }); // ammonia ice that grows across a lane: shoot through it
  const funnel = (z, x, ph, ax = 3.2) => obs(z, { x, y: 4.75, hx: 1.15, hy: 4.75, hz: 1.15, col: '#b06bff', kind: 'funnel', osc: { ax, ay: 0, w: 0.9, ph } }); // tornadoes that wander from side to side
  const buoy = (z, x, y) => K.ground(z, { x, x0: x, y, y0: y, col: '#ffe14a', hp: 5, r: 0.75, score: 250, fire: 135, fan: 3, bs: 6.5, bcol: ZAP, shape: 'sat', ph: (x + 9) * 0.3, pod: true }); // storm buoys: floating gun platforms
  const wraith = (z, o) => en(z, { type: 'saucer', col: '#ffffff', hp: 6, r: 0.9, score: 500, hold: 13, dur: 400, ax: 4, ay: 2, fire: 100, fan: 3, shape: 'wraith', phase: ISO, haunt: true, pod: true, ...o });

  zone(-99, 95, SIDE, 'SECTOR 5 // JUPITER - STORM DECK');
  fog(44, 0, 6.5, { vx: 0.6, wrap: 12 }); fog(70, 0, 2.8, { vx: -0.5, wrap: 12 }); crystal(60, 4.8, { gem: true }); crystal(90, 6.4); buoy(78, 3, 3);
  const gas = (z, x, y, w, h, c) => obs(z, { x, y, hx: w, hy: h, hz: 3.4, par: 0.5, col: c, kind: 'gas', ghost: true }); // big slow gas clouds drifting through: they move slower than the deck, so things slide in and out behind them
  for (let i = 0, z = 40; z < 1130; z += 31, i++) if (z < 760 || z > 905) gas(z, (i % 2 ? 1 : -1) * (2.5 + (i * 1.7) % 3.5), 3 + (i * 2.3) % 4.5, 4.6 + (i % 3) * 0.9, 2.2 + (i % 2) * 0.9, ['#3dffb0', '#9d5bff', '#e23dff', '#5affd0'][i % 4]);
  const shark = (z, o) => en(z, { type: 'pop', col: '#7df9ff', hp: 4, r: 0.9, score: 250, vz: -12, ax: 3, w: 1.5, shape: 'shark', ...o }); // sharks: fast, weaving, straight at you
  const drift = (z, x, y, o) => en(z, { type: 'pop', col: '#ff9ef2', hp: 3, r: 0.85, score: 120, vz: -2.6, ax: 1.1, ay: 1.4, w: 0.7, shape: 'jelly', x, y, ph: x + y, ...o }); // jellyfish: slow, bobbing, deadly to touch
  wing(36, 5, { ...spark, y: 6, ax: 3 }); jelly(54, { x: -2, y: 6 }); wing(66, 6, { ...spark, y: 3.5, ax: 4 }); jelly(84, { x: 3, y: 4 }); shark(74, { x: 0, y: 3, ax: 0, ay: 1.5 }); wing(90, 4, { ...spark, y: 7, ax: 2 });

  zone(95, 300, SIDE, 'LIGHTNING CHAINS - STAY IN SIDE VIEW');
  for (let i = 0, z = 130; z < 290; z += 13, i++) { const lane = i % 3; [2.2, 4.8, 7.4].forEach((y, k) => { if (k !== lane) hbolt(z, y, i * 23 + k * 40); }); if (i % 4 === 3) deck(z + 6, i % 8 === 3); if (i % 4 === 1) crystal(z, [2.2, 4.8, 7.4][lane], { gem: i % 8 === 1 }); if (i % 6 === 2) buoy(z + 6, 0, [7.4, 2.2, 4.8][lane]); if (i % 5 === 4) fog(z + 6, 0, 4.8, { hy: 3.4 }); }
  wing(150, 5, { ...spark, y: 5, ax: 0, ay: 2, zig: false }); jelly(190, { x: 0, y: 5 }); wing(230, 6, { ...spark, y: 4, ax: 0, ay: 2.5, zig: false }); jelly(268, { x: 0, y: 6 }); shark(170, { x: 0, y: 6, ax: 0, ay: 1 }); shark(212, { x: 0, y: 3, ax: 0, ay: 1.2 }); wing(250, 5, { ...spark, y: 6.5, ax: 0, ay: 1.4, zig: false }); shark(284, { x: 0, y: 5, ax: 0, ay: 2 });
  K.checkpoints.push(303);

  // the Asteroid warp hangs outside the lane: only SIDE view, which ignores left and right, can touch it
  zone(300, 520, TOP, 'STORM WALLS - SHIFT TO TOP VIEW');
  for (let i = 0, z = 334; z < 410; z += 14, i++) { const xs = i % 2 ? [-5, 0, 5] : [-2.5, 2.5, 7.5]; xs.forEach((x, k) => k === i % 3 ? head(z, x) : vbolt(z, x, i * 31 + k * 45)); }
  K.warp2(306, -3, 6); K.hill(30, 62, 1.8); K.hill(128, 172, 1.6); K.hill(598, 652, 1.8); /* swells in the cloud deck */ funnel(420, -4, 0); funnel(434, 4, 2); funnel(448, 0, 4, 4.5); buoy(441, 6.5, 5); at(392, g => hint(g, 'TORNADOES - THEY WANDER', 180));
  for (let i = 0, z = 462; z < 512; z += 14, i++) { const xs = i % 2 ? [-5, 0, 5] : [-2.5, 2.5, 7.5]; xs.forEach((x, k) => k === (i + 1) % 3 ? head(z, x) : vbolt(z, x, i * 29 + k * 45)); }
  wing(350, 5, { ...spark, x: 0, ax: 5, y: 5 }); jelly(392, { x: 0, y: 5 }); wing(474, 6, { ...spark, x: 0, ax: 5, y: 4 }); shark(372, { x: -4, ax: 2 }); shark(456, { x: 4, ax: 2 }); jelly(500, { x: 3, y: 5 }); wing(410, 5, { ...spark, x: 0, ax: 6, y: 5 });
  K.checkpoints.push(523);

  zone(520, 760, ISO, 'DENSE CLOUD - WRAITHS ONLY SHOW IN ISO VIEW');
  for (let i = 0, z = 556; z < 750; z += 24, i++) { obs(z, { x: (i % 3 - 1) * 4, y: 4.75, hx: 3.2, hy: 4.75, hz: 5, col: CLOUD, kind: 'cloud', ghost: true }); if (i % 2) { hbolt(z + 12, i % 4 === 1 ? 2.6 : 7, i * 40); vbolt(z + 12, i % 4 === 1 ? 4 : -4, i * 40 + 20); } else { funnel(z + 12, (i % 4 ? -1 : 1) * 3, i, 2.4); fog(z + 12, (i % 4 ? 1 : -1) * 3, 4.8, { hy: 4, hx: 3 }); } }
  wraith(560, { x: -3, y: 6 }); wraith(610, { x: 3, y: 3.5 }); wing(640, 5, { ...spark, x: 0, ax: 4, y: 5 }); wraith(670, { x: 0, y: 6.5 }); wraith(715, { x: -2, y: 4 }); at(730, g => addPod(g, 0, 5, SPAWN_Z, 'god')); shark(588, { x: 3, y: 5 }); shark(690, { x: -3, y: 4 }); wing(740, 5, { ...spark, x: 0, ax: 4, y: 4 });
  K.checkpoints.push(764);

  // THE DEEP: the storm opens into a living sea. Jellyfish hang in the lanes, sharks come straight at you. Only CHASE shows both
  // THE DESCENT: the deck gives way and the whole stage turns on its side. You fall straight down through Jupiter's bands of gas,
  // threading the gaps in cloud shelves and lightning, until the storm opens into the sea underneath
  zone(760, 900, SIDE, 'THE DESCENT - WE ARE GOING DOWN - SHIFT TO SIDE VIEW');
  K.tilt(772, 892, { rot: 1.5708, sway: 0.05, w: 0.02 }); at(772 + SPAWN_Z, g => { hint(g, 'FALLING THROUGH THE GAS LAYERS - THREAD THE GAPS', 240); g.shake = Math.max(g.shake, 6); });
  { const BAND = ['#ffb070', '#ffe1b0', '#c8743c', '#ffd27a', '#e8946a'];
    for (let i = 0, z = 776; z < 890; z += 9, i++) obs(z, { x: 0, y: 4.8, hx: 8.6, hy: 4.8, hz: 1.6, par: 0.35, col: BAND[i % 5], kind: 'gas', ghost: true }); // the bands of colour rushing past
    for (let i = 0, z = 796; z < 884; z += 14, i++) { const gap = [7.2, 2.4, 5.2, 2.2, 7.4, 4.8, 3][i % 7], gh = 1.45; // a cloud shelf with one gap in it
      if (gap - gh > 0.4) obs(z, { x: 0, y: (gap - gh) / 2, hx: 8.6, hy: (gap - gh) / 2, hz: 1.2, col: DECK, kind: 'clouddeck' }); if (gap + gh < 9.4) obs(z, { x: 0, y: (gap + gh + 9.6) / 2, hx: 8.6, hy: (9.6 - gap - gh) / 2, hz: 1.2, col: DECK, kind: 'clouddeck' });
      if (i % 2) crystal(z + 7, [2.4, 7.2][i % 4 === 1 ? 0 : 1], { gem: true }); else hbolt(z + 7, gap < 4.8 ? 7.4 : 2.2, i * 37); }
    wing(790, 4, { ...spark, y: 5, ax: 0, ay: 2.5, zig: false }); jelly(830, { x: 0, y: 4 }); wing(860, 5, { ...spark, y: 4, ax: 0, ay: 3, zig: false }); }
  K.checkpoints.push(904);
  zone(900, 1140, CHASE, 'THE DEEP - SHARKS AND JELLYFISH - SHIFT TO CHASE VIEW');
  for (let i = 0, z = 936; z < 1125; z += 10, i++) { const a = i * 2.39; drift(z, Math.sin(a) * 5.5, 4.8 + Math.cos(a * 1.3) * 3); if (i % 2) drift(z + 5, Math.sin(a + 2) * 5.5, 4.8 + Math.cos(a * 0.7 + 1) * 3); if (i % 3 === 0) fog(z + 3, Math.sin(a + 1) * 4, 4.8, { hy: 3.4, hx: 2.4 }); }
  for (let i = 0, z = 952; z < 1120; z += 21, i++) { const n = 2 + (i % 3); for (let k = 0; k < n; k++) shark(z + k * 1.6, { x: (k - (n - 1) / 2) * 3.2, y: 2.6 + ((k + i) % 3) * 2.2, ax: i % 2 ? 2.8 : 1.4, ph: k }); }
  // two giant squid, one rising from the deep and one diving from above, sweeping right across the lane: shoot them for a big bonus or get out of the way
  const squid = (z, x, up) => en(z, { type: 'swim', shape: 'squid', x, x0: x, y: up ? -6 : 15.5, vy: up ? 2.3 : -2.3, vz: -2.2, ax: 1.8, ph: x, hp: 60, r: 3.4, col: '#ff6ec7', score: 3000, pod: true });
  at(996, g => hint(g, 'SOMETHING HUGE IS MOVING IN THE DEEP...', 200)); squid(1010, -2.5, true); squid(1085, 3, false);
  jelly(990, { x: 0, y: 5 }); jelly(1070, { x: 2, y: 6 }); at(940, g => hint(g, 'THE DEEP - JELLYFISH STING, SHARKS CHARGE', 200)); K.hill(964, 1008, 1.4); K.hill(1060, 1102, 1.7); K.tilt(940, 1130, { sway: 0.1, w: 0.007, py: 22 }); // the sea swells
  K.checkpoints.push(1144);

  zone(1140, 1e9, SIDE, 'WARNING // THE EYE OPENS');
  K.cut(220, 270); K.cut(484, 512); // room for the descent
  spawnBoss(K, 1190, { name: 'THE EYE', look: 'eye', hp: 2600, col: ZAP });
  const B = boss({ name: 'THE EYE', sig: { name: 'IRIS STORM', fire(g, b, c) { if (c % 38 === 0) { const R = 5.4, rot = c * 0.012, col = (c / 38 | 0) % 2 ? '#b06bff' : '#7df9ff'; for (let sd = 0; sd < 6; sd++) { const a0 = sd * 1.0472 + rot, a1 = a0 + 1.0472; for (let i = 0; i < 4; i++) { const f = (i + 0.5) / 4, px = (Math.cos(a0) * (1 - f) + Math.cos(a1) * f) * R, py = (Math.sin(a0) * (1 - f) + Math.sin(a1) * f) * R * 0.85, d = Math.hypot(px, py) || 1; bullet(g, b.x + px, b.y + py, b.z - 3, -px / d * 1.7, -py / d * 1.7, -5.2, i % 3 ? col : '#ffffff'); } } g.fx.push('eshot'); } } }, // an iris closing: six blades of shot draw a hexagon and pull it shut on the middle, then it opens out behind you
    stages: [
    // STATIC: lightning walks down the lane toward you, then the Eye stares: a flat beam at whatever height you are flying
    { name: 'STATIC', vuln: [SIDE], rec: SIDE, col: ZAP, bob: 2.2, attack(g, b, t) { const p = near(g, b), c = t % 360;
      if (c === 30) { hint(g, 'LIGHTNING - WATCH THE RINGS', 110); g.fx.push('charge'); } if (c >= 30 && c < 126 && c % 24 === 6) { const k = (c - 30) / 24 | 0; strike(g, p.x, 11.5 - k * 2.3 + (k % 2 ? 0.6 : 0)); }
      if (c === 185) hint(g, 'THE EYE TURNS TO YOU - MOVE WHEN IT LOCKS', 130); if (c >= 185 && c < 357) stare(g, b, c - 185, { col: ZAP, trackX: false }); if (c === 300) for (let i = 0; i < 3; i++) addEnemy(g, { type: 'pop', x: 0, y: 2.5 + i * 2.2, z: b.z - 1, vz: -8, ay: 1, hp: 2, col: ZAP, shape: 'spark', ph: i }); } },
    // CYCLONE: the storm drags you toward the Eye while two spiral arms of sparks sweep the deck
    { name: 'CYCLONE', vuln: [TOP], rec: TOP, col: '#b06bff', sway: 3, attack(g, b, t) { const p = near(g, b); g.pull = [Math.max(-1.2, Math.min(1.2, (b.x - p.x) * 0.4)), 0, p.z < 9 ? 1.1 : 0];
      if (t % 420 === 5) hint(g, 'CYCLONE - FLY AGAINST THE PULL', 120); if (t % 12 === 0 && t % 420 < 280) for (const k of [0, 3.1416]) { const a = t * 0.045 + k; bullet(g, b.x, 4.6, b.z - 2, Math.cos(a) * 4.2, 0, -3.4 - (Math.sin(a) + 1) * 1.6, k ? '#b06bff' : ZAP); }
      if (t % 420 === 330) { strike(g, p.x, p.z); strike(g, p.x + (p.x > 0 ? -3 : 3), p.z + 1.5); g.fx.push('charge'); } } },
    // THE PUPIL: storm orbs circle it and soak up shots, and its stare is now a narrow shaft that follows you
    { name: 'THE PUPIL', vuln: [ISO, CHASE], rec: ISO, col: '#ffffff', attack(g, b, t) { const orbs = g.enemies.filter(e => e.orb && e.hp > 0).length;
      if (t % 480 === 20 && orbs < 2) { for (let i = 0; i < 4; i++) addEnemy(g, { type: 'pop', orb: true, x: b.x, x0: 0, y0: 4.8, ax: 3.3, ay: 3.3, w: 1.3, ph: i * 1.5708, z: b.z - 3, vz: 0, hp: 6, r: 0.8, col: ZAP, score: 300, shape: 'plasma', fire: 230, bs: 5 }); hint(g, 'STORM ORBS - CLEAR THEM TO REACH THE PUPIL', 150); }
      { const c = t % 420; if (c >= 160 && c < 332) stare(g, b, c - 160, { col: ZAP }); } if (t % 480 === 400) { const p = near(g, b); strike(g, p.x, p.z + 1, { hz: 2.2, warm: 95 }); g.fx.push('charge'); } } }] });
  K.fill(spark, 108, 735, 32, 'crystal'); K.hill(330, 380, 1.6); K.hill(690, 730, 1.3);
  return K.done({ name: 'JUPITER', title: 'STORM DECK', boss: B, warpName: 'THE ASTEROID BELT', theme: { sky: 'cloud', grid: '#1e7a5a', nofloor: true },
    rules: { wind: g => g.camZ > 462 && g.camZ < 682 && !g.boss /* (after the cuts) */ ? [Math.sin(g.tick * 0.012) * 1.4, 0] : [0, 0] } });
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
  const blob = (z, o) => obs(z, { x: 0, y: 4.75, hx: 8.6, hy: 4.75, hz: 0.7, col: FLESH, kind: 'blob', hp: 8, score: 250, ...o }); // a wall of mutant blobs right across the lane: it bursts when you shoot it enough
  const mine = (z, x, y) => ground(z, { x, x0: x, y, y0: y, col: ACID, hp: 3, r: 0.85, score: 120, burst: 10, shape: 'spore' }); // fat spore pods that burst into a ring of acid
  const memb = (z, low, ph) => obs(z, low ? { x: 0, y: 1.8, hx: 8.6, hy: 1.8, hz: 1, col: FLESH, kind: 'membrane', osc: { ax: 0, ay: 0.7, w: 1.6, ph } } : { x: 0, y: 7.3, hx: 8.6, hy: 2.2, hz: 1, col: FLESH, kind: 'membrane', osc: { ax: 0, ay: 0.7, w: 1.6, ph } });

  zone(-99, 85, SIDE, 'SECTOR 9 // PLANET X - THE BLOOM');
  blob(78, { pod: true }); at(46, g => hint(g, 'BLOB WALL - SHOOT IT UNTIL IT BURSTS', 220)); mine(60, 0, 3); mine(68, 0, 7); mine(40, 0, 2.4); mine(48, 0, 7.4);
  wing(24, 6, { ...spore, y: 6.5, ay: 1.5, ax: 0 }, 1.4); wing(34, 8, { ...spore, y: 5, ay: 2.5, ax: 0 }, 1.4); spitter(52, { x: 0, y: 6 }); wing(64, 8, { ...spore, y: 4, ay: 3 }, 1.4); spitter(72, { x: 0, y: 3 });
  for (let z = 30; z < 82; z += 11) eye(z, 0, (z / 11 | 0) % 2 === 0); // eyes on stalks, floor and roof, watching you come in
  for (let i = 0, z = 32; z < 76; z += 9, i++) obs(z, { x: 0, y: i % 2 ? 8.4 : 1.2, hx: 8.6, hy: 1.2, hz: 0.6, col: i % 2 ? FLESH : BIO, kind: 'membrane', osc: { ax: 0, ay: 0.5, w: 1.4, ph: i } }); // folds of tissue pinching the lane

  // THE WRITHING GROVE: a forest of tentacles you fly through in ISO. Some grow from the floor and some hang from the roof, pumping up and down,
  // so the way through is a gap in height as well as in the lane. Big ones lash right across, eyes on stalks shoot from both ends
  zone(85, 285, ISO, 'THE WRITHING GROVE - SHIFT TO ISO VIEW'); K.tilt(110, 280, { sway: 0.18, w: 0.009, px: 40, py: 18 }); // the grove breathes: the whole floor heaves and turns
  { const grow = (z, x, h, roof, ph, col = BIO) => obs(z, { x, y: roof ? 9.6 - h / 2 : h / 2, hx: 0.7, hy: h / 2, hz: 0.7, col, kind: 'tentacle', hang: roof, osc: { ax: 0.5, ay: 1.1, w: 1.5, ph } });
    const LANES = [-6.4, -2.2, 2.2, 6.4];
    for (let i = 0, z = 116; z < 276; z += 10, i++) { const roof = i % 2 === 1, open = (i * 3 + (i >> 1)) % 4; // one lane each row stays clear; the rest are tentacles from the floor or the roof
      LANES.forEach((x, k) => { if (k !== open) grow(z + (k % 2) * 2, x, 4.4 + ((i + k) % 3) * 0.8, roof, i + k * 1.7); });
      if (i % 5 === 2) obs(z + 5, { x: 0, y: 4.75, hx: 0.8, hy: 4.75, hz: 0.8, col: FLESH, kind: 'tentacle', osc: { ax: 4.6, ay: 0, w: 1.1, ph: i } }); // a big one lashing right across
      if (i % 3 === 0) eye(z + 5, LANES[open], i % 2 === 0); if (i % 4 === 1) mine(z + 5, LANES[(open + 2) % 4], 4.6); }
    at(112, g => hint(g, 'TENTACLES FROM THE FLOOR AND THE ROOF - FIND THE GAP IN ISO', 240)); }
  wing(124, 8, { ...spore, x: 0, ax: 5, y: 5 }, 1.4); spitter(160, { x: 0, y: 6 }); wing(196, 8, { ...spore, x: 0, ax: 6, y: 4 }, 1.4); spitter(226, { x: 3, y: 5 }); wing(250, 8, { ...spore, x: -2, ax: 5, y: 6 }, 1.4); spitter(264, { x: -3, y: 4 });
  K.checkpoints.push(288);

  // the Pluto warp is tucked into the roof here, and only exists in CHASE
  zone(285, 475, SIDE, 'MEMBRANES - SHIFT TO SIDE VIEW'); K.tilt(352, 462, { rot: 3.1416, sway: 0.06, w: 0.015 }); at(352 + SPAWN_Z, g => hint(g, 'THE FOLD JUST TURNED US UPSIDE DOWN!', 220)); // the fold flips the whole stage over
  for (let i = 0, z = 320; z < 466; z += 17, i++) { memb(z, i % 2 === 0, i); eye(z + 8, (i % 3 - 1) * 4, i % 2 === 1); if (i % 3 === 2) blob(z + 9, { hp: 7, gem: true }); }
  K.warp2(292, 3, 4); K.hill(28, 60, 1.8); K.hill(518, 572, 1.5); K.hill(606, 652, 1.3); /* mounds of tissue */
  wing(336, 8, { ...spore, y: 5, ay: 1 }, 1.4); spitter(372, { x: 0, y: 5, ay: 0.5 }); wing(430, 8, { ...spore, y: 4.5, ay: 1.2 }, 1.4);
  K.checkpoints.push(478);

  zone(475, 690, CHASE, 'THE GULLET - SHIFT TO CHASE VIEW'); K.tilt(495, 680, { rot: -0.5, sway: 0.35, w: 0.006 }); // swallowed: the gullet twists as it carries you down
  [[0, 4.5], [3, 5.5], [-3, 3.6], [0, 6], [3.5, 3.6], [-3.5, 5.6], [0, 4.4], [2, 6]].forEach(([x, y], i) => { const z = 510 + i * 22; gate(z, x, y, { col: FLESH, osc: { ax: 1.6, ay: i % 2 ? 0.8 : 0, w: 1.4, ph: i * 1.3 } }); if (i % 2) wing(z + 11, 5, { ...spore, x: x * 0.5, y, ax: 2 }, 1.2); else if (i % 4 === 2) spitter(z + 10, { x: 0, y: 5 }); else { mine(z + 11, -3, 3.4); mine(z + 11, 3, 6.2); } if (i === 5) blob(z + 12, { hp: 14, pod: true }); });
  K.checkpoints.push(694);

  zone(690, 760, TOP, 'REALITY FOLDS - TOP VIEW!'); for (let i = 0, z = 722; z < 756; z += 14, i++) (i % 2 ? [-5.2, 0, 5.2] : [-2.6, 2.6, 7.6, -7.6]).forEach((x, k) => tent(z, x, i + k));
  zone(760, 830, SIDE, 'SIDE VIEW!'); for (let i = 0, z = 792; z < 826; z += 16, i++) memb(z, i % 2 === 0, i);
  zone(830, 900, ISO, 'ISO VIEW!'); gate(858, -3, 5, { col: FLESH, osc: { ax: 1.5, ay: 0, w: 1.4, ph: 0 } }); gate(880, 3, 4, { col: FLESH, osc: { ax: 1.5, ay: 0, w: 1.4, ph: 2 } });
  at(700, g => addPod(g, 0, 5, SPAWN_Z, 'god')); spitter(770, { x: 0, y: 5.4, ay: 0.4 }); spitter(895, { x: 0, y: 5 });
  K.checkpoints.push(904);

  // THE HYPER RUN: the fold throws you to full speed. Every wall flashes where it is about to be before it turns solid
  zone(900, 1130, SIDE, 'HYPER RUN - FULL SPEED - WATCH FOR THE FLASHES');
  at(900 + SPAWN_Z, g => { g.gearWas = g.gear; g.forceGear = 4; hint(g, 'HYPER RUN - THE FLASHES SHOW WHERE THE WALLS WILL BE', 220); g.fx.push('say:hyper run', 'gear'); });
  at(1128 + SPAWN_Z, g => { g.forceGear = null; g.gear = Math.min(2, g.gearWas ?? 1); g.fx.push('gear'); });
  { const W = { col: FLESH, kind: 'slab', warm: 128 }; for (let i = 0, z = 944; z < 1112; z += 8, i++) { const k = (i * 7 + (i >> 2)) % 6, gy = [2.2, 4.8, 7.2, 3.4, 6.2, 4.8][k], gh = i > 12 ? 1.25 : 1.5;
      if (k === 5 && i % 2) { obs(z, { ...W, x: 0, y: 1.6, hx: 8.6, hy: 1.6, hz: 0.6 }); obs(z, { ...W, x: 0, y: 8.4, hx: 8.6, hy: 1.4, hz: 0.6 }); obs(z + 4, { ...W, col: ACID, x: 0, y: 4.8, hx: 8.6, hy: 0.7, hz: 0.5 }); continue; } // pinch top and bottom, then a bar through the middle
      if (gy - gh > 0.4) obs(z, { ...W, x: 0, y: (gy - gh) / 2, hx: 8.6, hy: (gy - gh) / 2, hz: 0.6 }); if (gy + gh < 9.4) obs(z, { ...W, x: 0, y: (gy + gh + 9.6) / 2, hx: 8.6, hy: (9.6 - gy - gh) / 2, hz: 0.6 }); }
    for (let z = 960; z < 1100; z += 34) mine(z, 0, 2 + ((z / 34) % 3) * 2.6); }
  K.hill(940, 990, 1.2); K.checkpoints.push(1134);

  zone(1130, 1e9, SIDE, 'WARNING // THE SHIFTER - SOURCE OF THE FOLD');
  spawnBoss(K, 1180, { name: 'THE SHIFTER', look: 'bloom', hp: 4200, col: FLESH, score: 50000 });
  // every stage wants a different view, and between attacks it folds reality and throws you into another one
  const fold = (g, b, t) => { const c = t % 400; if (c === 215) { hint(g, 'REALITY SHIFT!', 70); g.fx.push('charge'); } if (c === 270) { let to = (g.view + 1 + (g.rand() * 3 | 0)) % 4; doShift(g, to, 1, null); g.flash = 6; } };
  const B = boss({ name: 'THE SHIFTER', sig: { name: 'FRACTAL FOLD', fire(g, b, c) { const R = ['#ff4d6d', '#ff8a2b', '#ffe14a', '#3dffb0', '#2ee6ff', '#b06bff', '#ff3df0'], flip = (c / 80 | 0) % 2 ? -1 : 1; for (let k = 0; k < 2; k++) { const n = c * 2 + k, a = n * 2.39996 * flip, sp = 1.6 + (n % 5) * 0.45; bullet(g, b.x, b.y, b.z - 2, Math.cos(a) * sp, Math.sin(a) * sp, -5.4, R[n % 7]); bullet(g, b.x, b.y, b.z - 2, -Math.cos(a) * sp, Math.sin(a) * sp, -5.4, R[(n + 3) % 7]); } } }, // a golden-angle spiral in every colour, mirrored, folding back on itself
    toast: 'THE SHIFT IS OVER', splat: true, glitchy: true, adds: { shape: 'spore', col: '#b6ff3d', hp: 3, r: 0.6, score: 80 }, addEvery: 480, stages: [
    { name: 'FIRST FACE', vuln: [SIDE], rec: SIDE, col: FLESH, bob: 2, attack(g, b, t) { if (t % 400 === 30) { addObs(g, { rel: true, kind: 'blob', x: 0, y: 4.8, hx: 9, hy: 5, hz: 0.7, z: b.z - 3, vz: -2.6, hp: Math.round(252 * power(g)), col: FLESH, score: 600, pod: g.rand() < 0.3 }); if (!g.blobTold) { g.blobTold = 1; hint(g, 'BLOB WALL - BURST IT BEFORE IT REACHES YOU', 130); } g.fx.push('charge'); } if (t % 100 === 80 && t % 400 > 200) fan(g, b, 3, 6.5, ACID); fold(g, b, t); } },
    { name: 'SECOND FACE', vuln: [TOP], rec: TOP, col: BIO, sway: 4, attack(g, b, t) { if (t % 200 === 30) { const safe = g.rand() * 5 | 0; [-6.4, -3.2, 0, 3.2, 6.4].forEach((x, i) => { if (i !== safe && i !== (safe + 1 + (t % 400 < 200 ? 0 : 2)) % 5) addObs(g, { rel: true, kind: 'slam', x, y: 4.75, hx: 1.25, hy: 4.75, hz: 5.5, z: 6, warm: 95, life: 50, col: BIO }); }); g.fx.push('charge'); } if (t % 400 === 120) for (let i = 0; i < 6; i++) addEnemy(g, { type: 'pop', x: -6 + i * 2.4, y: 4.6, z: b.z - 1, vz: -4, ax: 1, hp: 1, r: 0.4, col: ACID, shape: 'spore', score: 40, ph: i }); fold(g, b, t); } },
    { name: 'THIRD FACE', vuln: [CHASE], rec: CHASE, col: ACID, attack(g, b, t) { if (t % 400 === 20) addObs(g, { rel: true, kind: 'blob', x: 0, y: 4.8, hx: 9, hy: 5, hz: 0.7, z: b.z - 3, vz: -2.4, hp: Math.round(336 * power(g)), col: ACID, score: 800 }); if (t % 400 === 150) for (let i = 0; i < 5; i++) addEnemy(g, { type: 'kami', x: -5 + i * 2.5, y: 2.5 + (i % 2) * 4, z: b.z - 2, vz: -6.5, hp: 1, r: 0.45, col: ACID, shape: 'spore', score: 60 }); fold(g, b, t); } },
    { name: 'TRUE FACE', vuln: [ISO], rec: ISO, col: '#ffffff', attack(g, b, t) { if (t % 400 === 20) fireRing(g, b, ACID, 18, 2.3, 4); if (t % 400 === 120) { const p = near(g, b); for (let i = -1; i <= 1; i++) strike(g, p.x + i * 2.8, p.z + (i ? 1.2 : 0), { col: FLESH }); g.fx.push('charge'); } if (t % 12 === 0 && t % 400 > 150 && t % 400 < 205) { const a = t * 0.1; bullet(g, b.x, b.y, b.z - 2, Math.cos(a) * 3.2, Math.sin(a) * 3.2, -6.5, ACID); } fold(g, b, t); } }] });
  K.fill(spore, 100, 880, 38, 'blob', 'walker'); K.hill(126, 176, 1.8); K.hill(214, 262, 1.6);
  return K.done({ name: 'PLANET X', title: 'THE BLOOM', boss: B, warpName: 'PLUTO', final: true, theme: { sky: 'bio', grid: '#6a1e8a', trippy: true, splat: true } });
}

// =====================================================================================
// STAGE-SPECIFIC ENEMIES: each stage's own craft fly their own paths (e.move) and fire their own attacks (e.atk)
// =====================================================================================
const tri = u => Math.abs(((u % 2) + 2) % 2 - 1) * 2 - 1;
const fly = fn => (g, e, dt) => { e.z += e.vz * dt; const q = fn(e.t * 0.02 * (e.w || 1) + e.ph, e); e.x = Math.max(-8.5, Math.min(8.5, q[0])); e.y = Math.max(0.7, Math.min(9, q[1])); };
const PATH = {
  eight: fly((u, e) => [e.x0 + Math.sin(u) * e.ax, e.y0 + Math.sin(u * 2) * e.ay]), // a figure of eight
  hop: fly((u, e) => [e.x0 + Math.sin(u * 0.4) * e.ax, 0.9 + Math.abs(Math.sin(u)) * e.ay]), // bounding along the ground in low gravity
  cork: fly((u, e) => { const r = Math.max(0.6, 1 - e.t / 420); return [e.x0 + Math.cos(u) * e.ax * r, e.y0 + Math.sin(u) * e.ay * r]; }), // a corkscrew that tightens as it comes
  pincer: fly((u, e) => { const k = Math.max(0, 1 - e.t / 150); return [e.x0 * k + Math.sin(u) * 0.8, e.y0 + Math.sin(u * 1.3) * e.ay]; }), // sweeps in from the side to the middle
  dive: fly((u, e) => { const k = Math.min(1, e.t / 140); return [e.x0 + Math.sin(u) * e.ax, e.y0 + (e.y1 - e.y0) * k * k * (3 - 2 * k)]; }), // comes in high (or low) and swoops across
  saw: fly((u, e) => [e.x0 + Math.sin(u * 0.5) * e.ax, e.y0 + tri(u * 0.6) * e.ay]) }; // straight zigzags, top to bottom
const ATK = {
  laser: (col = '#ff3df0', w = 0.3) => (g, e) => { const hz = Math.max(1, (e.z - 1.5) / 2); addObs(g, { rel: true, kind: 'beam', x: e.x, y: e.y, z: hz + 0.5, hx: w, hy: w, hz, warm: 66, life: 20, col }); g.fx.push('charge'); }, // a thin laser straight down the lane: it sights, locks, fires
  ring: (n = 8, sp = 3, col) => (g, e) => { for (let i = 0; i < n; i++) { const a = i / n * 6.283 + e.t * 0.01; bullet(g, e.x, e.y, e.z, Math.cos(a) * sp, Math.sin(a) * sp, -5, col || e.col); } g.fx.push('eshot'); },
  cross: (sp = 3.5, col) => (g, e) => { for (const [vx, vy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) bullet(g, e.x, e.y, e.z, vx * sp, vy * sp, -5.5, col || e.col); g.fx.push('eshot'); },
  twin: (sp = 8, col) => (g, e) => { aimed(g, e, sp, -0.1, col); aimed(g, e, sp, 0.1, col); g.fx.push('eshot'); },
  rain: (n = 5, col) => (g, e) => { for (let i = 0; i < n; i++) bullet(g, e.x + (i - (n - 1) / 2) * 1.2, e.y, e.z, 0, -2.5, -4.5, col || e.col); g.fx.push('eshot'); }, // a curtain dropped straight down
  shard: col => (g, e) => { for (let i = -1; i <= 1; i++) addEnemy(g, { type: 'kami', x: e.x + i * 1.2, y: e.y, z: e.z - 0.5, vz: -8, hp: 1, r: 0.4, col: col || '#ffffff', shape: 'shard', score: 40 }); g.fx.push('missile'); } }; // splits off three homing shards
const shot = (g, x, y, z, vx, vy, vz, col, extra) => { const n0 = g.ebul.length; bullet(g, x, y, z, vx, vy, vz, col); if (g.ebul.length > n0) Object.assign(g.ebul[n0], extra); }; // a boss shot with something extra: a curl, a fall, a split
// lodestones: glowing rocks that drag the ship towards them while they are close
const magPull = g => { const p = g.players[0]; for (const o of g.obs) if (o.kind === 'magnet' && !o.dead && Math.abs(o.z - p.z) < 9) { const dx = o.x - p.x, dy = o.y - p.y; g.pull = [Math.sign(dx) * Math.min(1.7, Math.abs(dx) * 0.5), Math.sign(dy) * Math.min(1, Math.abs(dy) * 0.3), 0]; return; } };
const gearAt = (K, z, gear, msg, say) => K.at(z + SPAWN_Z, g => { if (g.forceGear == null) g.gearWas = g.gear; g.forceGear = gear; if (msg) hint(g, msg, 230); g.fx.push('gear'); if (say) g.fx.push('say:' + say); });
const gearFree = (K, z) => K.at(z + SPAWN_Z, g => { g.forceGear = null; g.gear = Math.min(2, g.gearWas ?? 1); g.fx.push('gear'); });
// the space whale of Saturn's rings: it crosses the stage three times. Hurt it and the damage carries over to its next pass
const WHALE = [
  (g, e, dt) => { e.x += 3.4 * dt; e.z = 17 + Math.sin(e.t * 0.01) * 2; e.y = 5 + Math.sin(e.t * 0.02) * 1.2; e.hd = [1, 0.12 * Math.cos(e.t * 0.02), 0]; e.hpk = e.hp / e.max; if (e.x > 24) { e.left = true; e.z = -50; } },
  (g, e, dt) => { e.z -= 7.5 * dt; e.x = Math.sin(e.t * 0.012) * 2.5; e.y = 7.9 + Math.sin(e.t * 0.02) * 0.5; e.hd = [0, 0, -1]; e.hpk = e.hp / e.max; if (e.z < -3) e.left = true; },
  (g, e, dt) => { e.y += 2.4 * dt; e.z = 16 - e.t * 0.012; e.x = Math.sin(e.t * 0.01) * 2; e.hd = [0, 1, -0.25]; e.hpk = e.hp / e.max; if (e.y > 17) { e.left = true; e.z = -50; } }];
const whale = (K, z, pass) => K.at(z, g => { const old = g.whale; if (old && !old.left && old.hp <= 0) return; /* it was killed on an earlier pass */
  const e = addEnemy(g, { type: 'pop', shape: 'whale', x: pass === 0 ? -24 : 0, y: pass === 2 ? -6 : pass ? 7.9 : 5, z: pass === 1 ? 62 : 17, vz: 0, hp: 110, r: 2.6, big: true, col: '#9fe9ff', score: 20000, pod: true, move: WHALE[pass], hd: [1, 0, 0] });
  if (old && old.hpk) e.hp = Math.max(1, Math.round(e.max * old.hpk)); g.whale = e; g.fx.push('bossin'); g.shake = Math.max(g.shake, 6); });

// =====================================================================================
// LEVEL 2 — THE MOON // SEA OF QUIET: low gravity, a dead base, the mass driver, a meteor shower
// =====================================================================================
function moon() {
  const K = kit('moon'), { at, obs, ring, en, ground, zone, gate, form } = K, GREY = '#c8d0e0', DUSK = '#9aa4c0', BASE = '#2ee6ff', WARN = '#ffe14a';
  const probe = { col: WARN, shape: 'probe', hp: 2, r: 0.7, score: 120 }, hopper = { col: '#ff9ef2', shape: 'orb', hp: 3, r: 0.75, score: 150, move: PATH.hop, vz: -5 };
  const walls = (a, b) => { for (let z = a, i = 0; z < b; z += 6, i++) for (const sd of [-1, 1]) { const h = 1.1 + Math.abs(Math.sin(i * 1.7 + sd)) * 1.6, w = 1.1 + Math.abs(Math.sin(i * 2.3 - sd)) * 0.7; obs(z, { x: sd * (7.6 - w * 0.4 + Math.sin(i * 0.9) * 0.4), y: h, hx: w, hy: h, hz: 3.2, col: i % 3 ? GREY : DUSK, kind: 'rockwall' }); } }; // the trench walls: a ragged line of boulders of all sizes
  const crater = (z, x, w = 1.6) => obs(z, { x, y: 0.55, hx: w, hy: 0.55, hz: w, col: GREY, kind: 'crater' });
  const needle = (z, x) => obs(z, { x, y: 4.75, hx: 0.8, hy: 4.75, hz: 0.8, col: DUSK, kind: 'spire' });
  const jet = (z, x, ph) => obs(z, { x, y: 4.75, hx: 1.05, hy: 4.75, hz: 1.05, col: '#e8ecff', kind: 'geyser', pulse: [70, 90, ph] }); // dust jets venting from under the crust
  const bounce = (z, x, big) => at(z, g => addEnemy(g, { type: 'rock', rel: false, size: big ? 3 : 2, x, y: 2 + g.rand() * 5, z: SPAWN_Z, vx: (g.rand() - 0.5) * 2, vy: (g.rand() < 0.5 ? -1 : 1) * (2.5 + g.rand() * 2), vz: -1, hp: big ? 7 : 4, r: big ? 1.5 : 1, col: GREY, score: big ? 80 : 50, shape: 'rock', pod: big })); // boulders bouncing slowly in the low gravity
  const rover = (z, x, o) => ground(z, { type: 'walker', x, vx: x > 0 ? -1.4 : 1.4, y: 0.75, y0: 0.75, col: WARN, hp: 5, r: 0.9, score: 220, fire: 140, bs: 6, shape: 'tank', ...o });
  const slab = (z, low) => obs(z, low ? { x: 0, y: 2, hx: 8.6, hy: 2, hz: 1.2, col: BASE, kind: 'slab', man: true } : { x: 0, y: 7.1, hx: 8.6, hy: 2.4, hz: 1.2, col: BASE, kind: 'slab', man: true });
  const crate = (z, x, y, o) => obs(z, { x, y, hx: 1, hy: 1, hz: 1, col: WARN, kind: 'crate', hp: 6, score: 150, gem: true, man: true, ...o });
  const guard = (z, o) => en(z, { type: 'saucer', col: BASE, hp: 7, r: 0.9, score: 400, hold: 15, dur: 400, ax: 2, ay: 2.4, fire: 110, atk: ATK.cross(3.4, BASE), shape: 'sat', pod: true, ...o }); // base defence satellites: they fire a cross of four

  // 1. the trench: a calm run in. Nothing shoots; thread the rings and get used to the drift
  zone(-99, 185, CHASE, 'LUNAR SECTOR // THE MOON - LOW GRAVITY TRENCH RUN'); K.tilt(30, 180, { sway: 0.07, w: 0.006, px: 20, py: 18 }); at(40, g => hint(g, 'LOW GRAVITY - THE SHIP DRIFTS A LITTLE. STEER EARLY', 220));
  walls(30, 182);
  for (let i = 0; i < 16; i++) ring(42 + i * 8.6, { x: Math.sin(i * 0.5) * 3.6, y: 4.6 + Math.sin(i * 0.38) * 1.8, r: 1.6 });
  for (let i = 0; i < 3; i++) { const z = 70 + i * 34; obs(z, { x: 0, y: 8, hx: 8.6, hy: 1.6, hz: 1, col: GREY, kind: 'arch' }); obs(z + 17, { x: (i % 2 ? 3.6 : -3.6), y: 1.3, hx: 1.2, hy: 1.3, hz: 1.2, col: '#7df9ff', kind: 'ice', hp: 4, gem: true, score: 150 }); }
  form(60, 5, i => ({ ...probe, x: 0, y: 5, ax: 2.6, ay: 2.4, w: 1.1, ph: i * 1.25, vz: -6 })); form(130, 5, i => ({ ...probe, x: 0, y: 4.6, ax: 3, ay: 2, w: 1, ph: i * 1.05, vz: -6, move: PATH.eight, pod: i === 4 }));
  K.checkpoints.push(188);

  // 2. the crater field: one idea at a time. A row of dust jets with one lane open, then a crater with a wrecked lander beside it, and so on
  zone(185, 390, ISO, 'CRATER FIELD - SHIFT TO ISO VIEW'); K.hill(236, 268, 1.3); K.hill(322, 356, 1.5); at(196 + SPAWN_Z, g => hint(g, 'DUST JETS BLOW IN ROWS - ONE LANE IS ALWAYS CLEAR', 220));
  for (let i = 0, z = 222; z < 384; z += 14, i++) {
    if (i % 2 === 0) { const open = [0, 2, 1, 2, 0, 1][(i / 2) % 6]; [-5.4, 0, 5.4].forEach((x, k) => { if (k !== open) jet(z, x, i * 20 + k * 30); }); }
    else { const sd = i % 4 === 1 ? 1 : -1; crater(z, 4.5 * sd, 2.2); crater(z + 3, -3 * sd, 1.5); crate(z, -5.6 * sd, 1.2); if (i % 4 === 3) rover(z + 6, 3 * sd); } }
  form(240, 5, i => ({ ...hopper, x: -5 + i * 2.5, ax: 1.5, ay: 5, ph: i * 0.6 })); form(310, 5, i => ({ ...hopper, x: 5 - i * 2.5, ax: 1.5, ay: 5.5, ph: i * 0.5, pod: i === 4 })); form(356, 4, i => ({ ...probe, x: (i % 2 ? 6 : -6), y: 3.4 + i, ay: 1, vz: -6, move: PATH.pincer }));
  K.checkpoints.push(393);

  // 3. the base: deck, lift, deck, cargo, over and over like the modules of a station. Halfway through its gravity plant fails and the whole thing hangs upside down
  zone(390, 590, SIDE, 'TRANQUILITY BASE - SHIFT TO SIDE VIEW'); K.tilt(486, 582, { rot: 3.1416, sway: 0.03, w: 0.012 }); at(486 + SPAWN_Z, g => { hint(g, 'THE GRAVITY PLANT JUST FAILED - UP IS DOWN!', 220); g.shake = Math.max(g.shake, 6); });
  for (let i = 0, z = 424; z < 584; z += 22, i++) { slab(z, i % 2 === 0); if (i % 3 === 2) { obs(z + 11, { x: 0, y: i % 2 ? 6.2 : 3.2, hx: 8.6, hy: 0.42, hz: 0.7, col: WARN, kind: 'girder', man: true }); crate(z + 16, 0, i % 2 ? 2.4 : 7.2, { pod: i === 2 }); } else obs(z + 11, { x: 0, y: 4.75, hx: 2.2, hy: 0.55, hz: 1.1, col: '#3dffb0', kind: 'elevator', man: true, osc: { ax: 0, ay: 2.4, w: 0.9, ph: i } }); }
  guard(452, { y: 5, fire: 150 }); form(500, 5, i => ({ ...probe, x: 0, y: 4.8, ax: 0, ay: 2.6, w: 1, ph: i * 0.9, vz: -6, move: PATH.saw })); guard(544, { y: 4.5, fire: 150 });
  K.checkpoints.push(593);

  // 4. the mass driver: the base's launch rail. It grabs the ship and throws it down the barrel, coil after coil
  zone(590, 780, CHASE, 'THE MASS DRIVER - SHIFT TO CHASE VIEW');
  gearAt(K, 604, 2, 'MASS DRIVER FIRING - HOLD ON AND THREAD THE COILS', 'mass driver'); gearFree(K, 772);
  for (let i = 0; i < 6; i++) { const z = 630 + i * 24, x = Math.sin(i * 0.8) * 2.8, y = 4.8 + Math.cos(i * 0.6) * 1.3; gate(z, x, y, { col: BASE, man: true, org: 0, w: 2.9, h: 2.5 }); if (i % 2) crate(z + 12, -x * 1.4, y, { pod: i === 3 }); }
  form(616, 4, i => ({ ...probe, x: 0, y: 4.8, ax: 2.5, ay: 2.5, w: 1.6, ph: i * 1.57, vz: -9 }));
  K.checkpoints.push(783);

  // 5. the Sea of Storms: open ground, low craters, and meteors. A ring on the ground shows where each one will land
  zone(780, 970, ISO, 'SEA OF STORMS - METEOR SHOWER - SHIFT TO ISO VIEW'); K.hill(846, 884, 1.4);
  at(790 + SPAWN_Z, g => hint(g, 'METEORS! THE RINGS ON THE GROUND SHOW WHERE THEY LAND', 230));
  for (let i = 0, z = 816; z < 964; z += 14, i++) { const sd = i % 2 ? 1 : -1; crater(z, 5 * sd, 2.2); crater(z + 7, -1.5 * sd, 1.6); if (i % 3 === 1) crate(z + 4, -6 * sd, 1.2); if (i % 5 === 4) rover(z + 4, 5.5 * sd); }
  form(836, 5, i => ({ ...hopper, x: -5 + i * 2.5, ax: 1, ay: 5.5, ph: i * 0.5 })); form(900, 5, i => ({ ...probe, x: (i % 2 ? 7 : -7), y: 3 + i * 0.9, ay: 1, vz: -6, move: PATH.pincer })); form(940, 5, i => ({ ...probe, x: 0, y: 5, ax: 3.2, ay: 2.2, w: 1.1, ph: i * 1.25, vz: -6, move: PATH.cork, pod: i === 0 }));
  K.checkpoints.push(973);
  const tick = g => { if (g.camZ > 792 && g.camZ < 958 && !g.boss && g.tick % 62 === 0) { const p = g.players[0]; addObs(g, { kind: 'strike', x: g.rand() < 0.25 ? p.x : -7 + g.rand() * 14, y: 4.75, z: p.z + 13 + g.rand() * 11, hx: 1.2, hy: 4.75, hz: 1.2, warm: 95, life: 14, col: '#ffb070' }); } };

  zone(970, 1e9, SIDE, 'WARNING // THE SENTINEL WAKES');
  spawnBoss(K, 1020, { name: 'THE SENTINEL', look: 'sentinel', hp: 900, col: BASE });
  const boomerang = (g, e) => { const u = e.t / 210; e.z = e.z0 - (e.z0 - 3.5) * Math.sin(Math.PI * Math.min(1, u)); e.y = Math.max(0.8, Math.min(9, e.y0 + Math.sin(e.t * 0.05 + e.ph) * 1.3)); if (u >= 1) e.z = -50; }; // a shield plate thrown down the lane: out, and back to its owner
  const B = boss({ name: 'THE SENTINEL', toast: 'THE MOON IS QUIET AGAIN', adds: { ...probe, hp: 3 }, addEvery: 700,
    sig: { name: 'CRESCENT MOONS', fire(g, b, c) { if (c % 34 === 0) { const k = c / 34, a0 = k * 1.1, n = 15; for (let i = 0; i < n; i++) { const a = a0 + (i / (n - 1) - 0.5) * 3.9, sp = 2 + 1.3 * Math.cos(a - a0); bullet(g, b.x, b.y, b.z - 2, Math.cos(a) * sp, Math.sin(a) * sp, -5, k % 2 ? '#ffffff' : BASE); } g.fx.push('eshot'); } } }, // crescents: each arc flies faster in the middle than at its horns, and each one faces a new way
    stages: [
    { name: 'SHIELD PLATES', vuln: [SIDE], rec: SIDE, col: BASE, bob: 2, attack(g, b, t) { if (t % 170 === 40) { for (const dy of [-2.2, 2.2]) addEnemy(g, { type: 'pop', shape: 'echo', col: WARN, hp: 4, r: 0.8, x: b.x, y: Math.max(1.2, Math.min(8.4, b.y + dy)), z: b.z - 2, z0: b.z - 2, vz: 0, ph: dy, move: boomerang, score: 150, pod: t % 510 === 40 && dy > 0 }); g.fx.push('missile'); } if (t % 150 === 110) { aimed(g, b, 5.5, 0, BASE); g.fx.push('eshot'); } } },
    { name: 'MISSILE BATTERY', vuln: [ISO, CHASE], rec: CHASE, col: WARN, sway: 3, attack(g, b, t) { if (t === 20) hint(g, 'MISSILES - SHOOT THEM DOWN OR SLIP PAST THEM', 200); if (t % 150 === 50) { for (let i = -1; i <= 1; i++) addEnemy(g, { type: 'kami', shape: 'lancer', col: '#ff4d6d', hp: 2, r: 0.5, vz: -6, x: b.x + i * 2.6, y: b.y + 1.4, z: b.z - 1, score: 60 }); g.fx.push('missile'); } } },
    { name: 'CORE', vuln: [CHASE], rec: CHASE, col: '#ffffff', attack(g, b, t) { if (t % 10 === 0) { const a = t * 0.37; shot(g, b.x, b.y, b.z - 2, Math.sin(a) * 2.6, 2.2 + Math.cos(a * 1.7) * 0.7, -6, t % 20 ? WARN : '#ffffff', { gy: 1.6 }); } if (t % 60 === 0) g.fx.push('eshot'); } }] }); // the mass driver's slugs, lobbed high and falling slowly in the low gravity
  K.fill(probe, 200, 950, 75, 'crate', 'tank');
  return K.done({ name: 'THE MOON', title: 'SEA OF QUIET', boss: B, tick, rules: { inertia: g => !g.boss && (g.camZ < 182 || (g.camZ > 784 && g.camZ < 966)) ? 0.1 : 0 }, theme: { sky: 'moon', grid: '#5a6480' } });
}

// =====================================================================================
// LEVEL 3 — THE SUN // CORONA: plasma fog with one clear channel, sunspots, solar wind, a storm of fire
// =====================================================================================
function sun() {
  const K = kit('sun'), { at, obs, en, zone, gate, form } = K, HOT = '#ffb02e', FOG = '#ff3b1f', FIRE = '#ff5a1f', GOLD = '#ffe14a';
  const chan = (z, x, y, hx, hy, full) => { obs(z, { x, y, hx, hy, hz: 3.1, col: HOT, kind: 'shade', ghost: true, fog: 1 }); // the channel itself (cool), and the fog packed around it
    const f = { col: FOG, kind: 'redfog', ghost: true, hz: 3.1 }, L0 = -9.6, R0 = 9.6, B0 = 0, T0 = 9.8;
    if (!full) { if (x - hx > L0 + 0.2) obs(z, { ...f, x: (L0 + x - hx) / 2, y: 4.9, hx: (x - hx - L0) / 2, hy: 4.9 }); if (x + hx < R0 - 0.2) obs(z, { ...f, x: (x + hx + R0) / 2, y: 4.9, hx: (R0 - x - hx) / 2, hy: 4.9 }); }
    const xl = full ? 0 : x, xw = full ? 9.6 : hx; if (y - hy > B0 + 0.2) obs(z, { ...f, x: xl, y: (B0 + y - hy) / 2, hx: xw, hy: (y - hy - B0) / 2 }); if (y + hy < T0 - 0.2) obs(z, { ...f, x: xl, y: (y + hy + T0) / 2, hx: xw, hy: (T0 - y - hy) / 2 }); };
  const ember = { col: FIRE, shape: 'ember', hp: 2, r: 0.65, score: 120 }, plasma = (z, o) => en(z, { type: 'saucer', col: GOLD, hp: 7, r: 0.9, score: 400, hold: 15, dur: 400, ax: 3, ay: 1.5, fire: 120, atk: ATK.ring(8, 2.8, HOT), shape: 'plasma', pod: true, ...o }); // plasma knots: they burst a ring of fire
  const flareX = (z, i) => obs(z, { x: 0, y: 4.75, hx: 1.2, hy: 4.75, hz: 3.2, col: HOT, kind: 'flare', osc: { ax: 6.4, ay: 0, w: 0.55 + (i % 2) * 0.12, ph: i * 1.7 } }); // prominences whipping across the channel
  const flareY = (z, i) => obs(z, { x: 0, y: 4.75, hx: 8.6, hy: 0.7, hz: 2.7, col: HOT, kind: 'flare', osc: { ax: 0, ay: 3.7, w: 0.85, ph: i * 2.1 } });
  const erupt = (z, x, ph) => obs(z, { x, y: 4.75, hx: 1.05, hy: 4.75, hz: 1.05, col: FIRE, kind: 'geyser', pulse: [70, 80, ph] });
  const knot = (z, x, y) => obs(z, { x, y, hx: 1.1, hy: 1.1, hz: 1.1, col: HOT, kind: 'boulder', hp: 7, score: 120, gem: true }); // a knot of cooling plasma you can blast apart

  zone(-99, 190, CHASE, 'SECTOR 2 // THE SUN - PLASMA FOG - FOLLOW THE CLEAR CHANNEL'); at(40, g => hint(g, 'OUTSIDE THE CHANNEL YOU OVERHEAT', 200)); K.hill(60, 104, 1.2);
  for (let i = 0; i < 26; i++) { const z = 34 + i * 6, x = Math.sin(i * 0.42) * 4.4, y = 4.8 + Math.sin(i * 0.31 + 1) * 2.1; chan(z, x, y, 2.5, 1.9, false); if (i % 5 === 2) obs(z, { x, y, hx: 0.7, hy: 0.7, hz: 0.7, col: GOLD, kind: 'ice', hp: 3, gem: true, score: 150 }); }
  for (let i = 0; i < 4; i++) flareX(64 + i * 28, i);
  for (let i = 0; i < 5; i++) { const z = 46 + i * 30, k = (z - 34) / 6; form(z, 3, j => ({ ...ember, x: Math.sin(k * 0.42) * 4.4, y: 4.8 + Math.sin(k * 0.31 + 1) * 2.1, ax: 1.2, ay: 1, w: 1.5, ph: j * 2.1, vz: -5, pod: i % 2 === 0 && j === 2 })); }
  K.checkpoints.push(193);

  zone(190, 385, SIDE, 'THE CHANNEL DIVES - SHIFT TO SIDE VIEW'); K.tilt(200, 372, { rot: 0.42, sway: 0.08, w: 0.01 }); // the dive: the whole stage tips nose-down
  for (let i = 0; i < 31; i++) { const z = 193 + i * 6; chan(z, 0, 4.8 + Math.sin(i * 0.45) * 2.6, 9.6, 1.6, true); }
  for (let i = 0; i < 5; i++) flareY(222 + i * 30, i);
  for (let i = 0; i < 4; i++) { const z = 214 + i * 40, k = (z - 193) / 6; form(z, 3, j => ({ ...ember, x: 0, y: 4.8 + Math.sin(k * 0.45) * 2.6, ay: 0.9, w: 1.6, ph: j * 2, vz: -5, pod: i === 2 && j === 2 })); }
  K.checkpoints.push(388);

  // sunspots: darker, cooler ground between eruptions. No fog here, but rivers of plasma cross the lane and the surface keeps bursting
  zone(385, 585, CHASE, 'SUNSPOT FIELD - COOLER GROUND - SHIFT TO CHASE VIEW'); K.hill(440, 480, 1.5); K.hill(530, 566, 1.3);
  for (let i = 0, z = 418; z < 578; z += 12, i++) { const m = i % 4, sd = i % 8 < 4 ? 1 : -1;
    if (m === 0) { erupt(z, -5 * sd, i * 30); erupt(z, 0, i * 30 + 50); erupt(z, 5 * sd, i * 30 + 100); }
    else if (m === 1) { obs(z, { x: 0, y: 0.2, hx: 9.6, hy: 0.2, hz: 3.6, col: FIRE, kind: 'lava', ghost: true, flow: sd }); knot(z + 6, 3 * sd, 2); }
    else if (m === 2) { obs(z, { x: 0, y: 4.75, hx: 1.1, hy: 4.75, hz: 1.4, col: HOT, kind: 'flare', osc: { ax: 6, ay: 0, w: 0.7, ph: i } }); knot(z + 6, -4 * sd, 6.5); }
    else for (const x of [-6.5, -2.2, 2.2, 6.5]) if (x !== 2.2 * sd) obs(z, { x, y: 4.75, hx: 1, hy: 4.75, hz: 1, col: '#a8480c', kind: 'spire' }); }
  form(430, 6, i => ({ ...ember, x: (i % 2 ? 6 : -6), y: 8, y1: 2.5, ax: 1.5, vz: -6, ph: i * 0.8, move: PATH.dive })); plasma(470, { x: -2, y: 6 }); form(510, 6, i => ({ ...ember, x: 0, y: 5, ax: 4, ay: 2.5, w: 1.2, ph: i * 1.05, vz: -6, move: PATH.eight })); plasma(548, { x: 3, y: 5 });
  K.checkpoints.push(588);

  zone(585, 785, ISO, 'CORONAL LOOP - SOLAR WIND - SHIFT TO ISO VIEW'); K.tilt(610, 775, { sway: 0.14, w: 0.008, py: 14 }); at(610 + SPAWN_Z, g => hint(g, 'SOLAR WIND! IT BLOWS IN GUSTS - LEAN INTO IT', 220));
  for (let i = 0, z = 622; z < 778; z += 13, i++) { const sd = i % 2 ? 1 : -1, m = i % 3; if (m === 0) flareX(z, i); else if (m === 1) { knot(z, 4.5 * sd, 3); knot(z, -2 * sd, 6.5); } else { erupt(z, -5.5 * sd, i * 30); erupt(z, 1.5 * sd, i * 30 + 70); } }
  form(600, 5, i => ({ ...ember, x: 0, y: 4.8, ax: 3, ay: 3, w: 1.3, ph: i * 1.25, vz: -7 })); plasma(690, { x: 0, y: 6.5 }); form(740, 6, i => ({ ...ember, x: 0, y: 4.8, ax: 3.5, ay: 3, w: 1, ph: i * 1.05, vz: -7, move: PATH.cork, pod: i === 5 }));
  K.checkpoints.push(788);

  zone(785, 960, SIDE, 'SOLAR STORM - SHIFT TO SIDE VIEW'); K.tilt(800, 950, { rot: -0.3, sway: 0.06, w: 0.012 });
  const serpent = (z, n = 8) => { const gr = 'sp' + z; for (let i = 0; i < n; i++) at(z + i * 0.9, g => addEnemy(g, { type: 'pop', rel: false, z: 30 + i * 0.9, vz: 0, group: gr, gn: n, x: 0, y: 0, y0: 0.2, ay: 7.5, w: 1.3, ph: -i * 0.3, hp: 2, r: 0.6, col: i ? HOT : '#ffffff', score: 80, shape: 'worm' })); }; // fire serpents arcing out of the surface
  for (let i = 0, z = 816; z < 950; z += 15, i++) { const m = i % 3; if (m === 0) { obs(z, { x: 0, y: 2.2, hx: 8.6, hy: 0.55, hz: 0.9, col: FIRE, kind: 'firearc' }); obs(z + 6, { x: 0, y: 7.4, hx: 8.6, hy: 0.55, hz: 0.9, col: FIRE, kind: 'firearc' }); } else if (m === 1) obs(z, { x: 0, y: 4.75, hx: 8.6, hy: 4.75, hz: 1.05, col: HOT, kind: 'lavafall', pulse: [70, 110, i * 35] }); else { serpent(z); flareY(z + 8, i); } }
  form(830, 5, i => ({ ...ember, x: 0, y: 8.5, y1: 1.5 + i, vz: -6, ph: i, ax: 0, move: PATH.dive })); plasma(880, { y: 5, ax: 0 }); form(920, 6, i => ({ ...ember, x: 0, y: 4.8, ay: 3.2, ax: 0, w: 1.1, ph: i * 0.9, vz: -6, move: PATH.saw }));
  at(940, g => addPod(g, 0, 5, SPAWN_Z, 'god'));
  K.checkpoints.push(963);

  zone(960, 1e9, SIDE, 'WARNING // HELIOS RISES');
  spawnBoss(K, 1010, { name: 'HELIOS', look: 'helios', hp: 1500, col: HOT });
  const B = boss({ name: 'HELIOS', toast: 'THE SUN SETTLES', adds: { ...ember, hp: 3 }, addEvery: 600,
    sig: { name: 'CORONAL LOOPS', fire(g, b, c) { if (c % 16 === 0) { const a = c * 0.045; for (const sd of [1, -1]) for (let j = 0; j < 3; j++) shot(g, b.x, b.y, b.z - 2, Math.cos(a * sd + j * 2.094) * 3.4, Math.sin(a * sd + j * 2.094) * 3.4, -5, sd > 0 ? GOLD : FIRE, { w: sd * (j === 1 ? 0.018 : 0.011) }); g.fx.push('eshot'); } } }, // magnetic loops: every shot curves round in a great circle and comes back through the middle
    stages: [
    { name: 'PROMINENCE', vuln: [SIDE], rec: SIDE, col: HOT, bob: 1.6, attack(g, b, t) { if (t % 420 === 30) { addObs(g, { rel: true, kind: 'flare', x: 0, y: 4.75, z: 12, hx: 8.6, hy: 0.7, hz: 8, col: HOT, osc: { ax: 0, ay: 2.6, w: 0.9, ph: g.rand() * 6 }, warm: 70, life: 300 }); hint(g, 'A PROMINENCE - IT WHIPS UP AND DOWN THE WHOLE LANE', 170); g.fx.push('charge'); } if (t % 110 === 70) for (let i = -1; i <= 1; i++) bullet(g, b.x, b.y + i * 1.6, b.z - 2, 0, i * 0.8, -6.5, GOLD); } },
    { name: 'SOLAR WIND', vuln: [ISO, CHASE], rec: CHASE, col: FIRE, sway: 3.5, attack(g, b, t) { const c = t % 300, dir = (t / 300 | 0) % 2 ? -1 : 1; if (c === 0) { hint(g, 'SOLAR WIND FROM THE ' + (dir > 0 ? 'LEFT' : 'RIGHT') + '!', 130); g.fx.push('charge'); } if (c > 30 && c < 190) { g.pull = [dir * 1.5, 0, 0]; if (c % 9 === 0) bullet(g, -dir * 10, 1 + g.rand() * 8, 5 + g.rand() * 15, dir * 4.6, 0, -1.5, c % 18 ? GOLD : HOT); } } }, // it blows the ship sideways, and sparks come streaking across with it
    { name: 'THE CORE', vuln: [CHASE], rec: CHASE, col: '#ffffff', attack(g, b, t) { if (t % 4 === 0) { const th = t * 0.11, r = 2.2 + 0.6 * Math.sin(t * 0.013); for (const k of [0, 3.1416]) bullet(g, b.x + Math.cos(th + k) * r, b.y + Math.sin(th + k) * r * 0.85, b.z - 2, 0, 0, -6.5, k ? GOLD : FIRE); } } }] }); // a double helix of fire coming straight down the lane
  K.fill(ember, 400, 940, 60, 'boulder', 'tank');
  return K.done({ name: 'THE SUN', title: 'CORONA', boss: B, theme: { sky: 'sun', grid: '#a8480c' },
    rules: { heat: g => g.camZ < 368 && !g.boss, wind: g => g.camZ > 610 && g.camZ < 778 && !g.boss ? [Math.sin(g.tick * 0.015) * 1.3, Math.cos(g.tick * 0.011) * 0.5] : [0, 0] } });
}

// =====================================================================================
// LEVEL 5 — ASTEROID BELT // THE RUBBLE: rock storms, a mining colony, lodestones, a collapsing bore, the crushers
// =====================================================================================
function asteroids() {
  const K = kit('belt'), { at, obs, en, zone, gate, form } = K, ROCK = '#c8a070', DARK = '#9a7a50', ORE = '#ffb02e', LAMP = '#3dffb0';
  const rocks = (from, to, step) => { for (let i = 0, z = from; z < to; z += step, i++) { const big = i % 3 === 0; at(z, g => addEnemy(g, { type: 'rock', rel: false, size: big ? 3 : 2, x: -6.5 + g.rand() * 13, y: 1.5 + g.rand() * 6.5, z: SPAWN_Z, vx: (g.rand() - 0.5) * 4, vy: (g.rand() - 0.5) * 2, vz: -g.rand() * 2, hp: big ? 7 : 4, r: big ? 1.5 : 1, col: ROCK, score: big ? 80 : 50, shape: 'rock', pod: i % 7 === 3 })); } };
  const drone = { col: LAMP, shape: 'probe', hp: 2, r: 0.7, score: 120 }, driller = { col: ORE, shape: 'lancer', hp: 3, r: 0.75, score: 160, fire: 140, atk: ATK.twin(7.5, ORE) }; // mining drones, and drillers that fire twin bolts
  const crate = (z, x, y, o) => obs(z, { x, y, hx: 1, hy: 1, hz: 1, col: ORE, kind: 'crate', hp: 6, score: 150, gem: true, ...o });
  const magnet = (z, x, y) => obs(z, { x, y, hx: 1.1, hy: 1.1, hz: 1.1, col: '#ff3df0', kind: 'magnet', hp: 9, score: 200, gem: true });

  zone(-99, 150, CHASE, 'SECTOR 4 // ASTEROID BELT - BREAK EVERYTHING'); rocks(34, 142, 6.6);
  form(60, 4, i => ({ ...drone, x: 0, y: 4.8, ax: 3, ay: 2.6, w: 1.2, ph: i * 1.57, vz: -6 })); form(110, 5, i => ({ ...drone, x: 0, y: 4.8, ax: 3.4, ay: 2.6, w: 1, ph: i * 1.25, vz: -6, move: PATH.cork, pod: i === 4 }));
  K.checkpoints.push(153);

  // THE MOTHERLODE: a mining colony dug out of one giant rock. Cave roof and floor close in, drill rigs pump up and down,
  // ore carts run the rails, laser fences guard the seams, and the ore crates are full of gems
  zone(150, 335, SIDE, 'THE MOTHERLODE - A MINING COLONY INSIDE THE ROCK - SHIFT TO SIDE VIEW'); at(160, g => hint(g, 'THE AIRLOCK FIRST: ONE DOOR OPENS AS THE OTHER SHUTS', 230));
  for (let i = 0, z = 160; z < 332; z += 5, i++) { const fl = 0.9 + Math.sin(i * 0.35) * 0.35, rf = 0.9 + Math.sin(i * 0.29 + 1) * 0.35; // a bored tunnel: smooth floor and roof, a prop and a lamp every few metres
    obs(z, { x: 0, y: fl / 2, hx: 9, hy: fl / 2, hz: 2.6, col: i % 3 ? ROCK : DARK, kind: 'rockwall' }); obs(z, { x: 0, y: 9.6 - rf / 2, hx: 9, hy: rf / 2, hz: 2.6, col: i % 3 ? ROCK : DARK, kind: 'rockwall' }); }
  const door = (z, ph) => { obs(z, { x: 0, y: 2, hx: 8.6, hy: 2.4, hz: 0.8, col: '#ffe14a', kind: 'door', osc: { ax: 0, ay: 1.7, w: 0.95, ph } }); obs(z, { x: 0, y: 7.6, hx: 8.6, hy: 2.4, hz: 0.8, col: '#ffe14a', kind: 'door', osc: { ax: 0, ay: -1.7, w: 0.95, ph } }); }; // a blast door in two leaves
  const drill = (z, ph) => obs(z, { x: 0, y: 6.9, hx: 1.2, hy: 2.3, hz: 1.2, col: ORE, kind: 'drill', osc: { ax: 0, ay: 2.3, w: 1.1, ph } }); // a drill rig on a ram: it plunges from the roof and draws back
  const cart = (z, y, vz, n = 3) => { obs(z + 4, { x: 0, y: y - 0.75, hx: 8.6, hy: 0.14, hz: 7, col: '#8a8ab0', kind: 'rail', ghost: true }); for (let k = 0; k < n; k++) obs(z + k * 3.2, { x: 0, y, hx: 1.2, hy: 0.6, hz: 1.2, vz, col: k ? ORE : '#ff4d6d', kind: 'car', hp: 5, score: 100, gem: k === 1 }); }; // a train of ore carts on a rail, coming at you or pulling away
  door(182, 0); door(192, 3.1416);                                        // the airlock
  drill(206, 0); crate(212, 0, 2.6); drill(218, 2.1); drill(230, 4.2); crate(236, 0, 2.6, { pod: true }); // the drill hall
  at(240, g => hint(g, 'THE ORE LINE - CARTS RUN BOTH WAYS', 180)); cart(250, 3, -4.5); cart(262, 6.6, 2.5); cart(274, 3, -5.5, 4); // the ore line: two rails, trains running opposite ways
  obs(288, { x: 0, y: 4.75, hx: 8.6, hy: 4.75, hz: 1.05, col: ORE, kind: 'lavafall', pulse: [70, 110, 0] }); obs(296, { x: 0, y: 4.75, hx: 8.6, hy: 0.35, hz: 0.5, col: '#ff4d6d', kind: 'bolt', osc: { ax: 0, ay: 2.6, w: 0.9, ph: 1 } }); obs(303, { x: 0, y: 4.75, hx: 8.6, hy: 4.75, hz: 1.05, col: ORE, kind: 'lavafall', pulse: [70, 110, 90] }); // the smelter: two pours of molten ore and a cutting laser between
  for (let k = 0; k < 3; k++) form(200 + k * 36, 4, i => ({ ...drone, x: 0, y: 4.8, ax: 0, ay: 2, w: 1.2, ph: i * 0.9, vz: -5.5, move: k % 2 ? PATH.saw : undefined, pod: k === 2 && i === 3 }));
  K.checkpoints.push(338);

  zone(335, 525, ISO, 'LODESTONE FIELD - MAGNETIC ROCKS - SHIFT TO ISO VIEW'); at(345 + SPAWN_Z, g => hint(g, 'THE GLOWING ROCKS ARE MAGNETS. THEY DRAG THE SHIP - SHOOT THEM OR FIGHT THE PULL', 260));
  for (let i = 0, z = 366; z < 518; z += 13, i++) { const sd = i % 2 ? 1 : -1, m = i % 4;
    if (m === 0) { magnet(z, 5 * sd, 4.8); obs(z + 6, { x: -2 * sd, y: 4.75, hx: 0.8, hy: 4.75, hz: 0.8, col: DARK, kind: 'spire' }); }
    else if (m === 1) { obs(z, { x: 0, y: 4.75, hx: 0.4, hy: 4.75, hz: 0.5, col: '#ff4d6d', kind: 'bolt', osc: { ax: 5, ay: 0, w: 0.7, ph: i } }); crate(z + 6, 4 * sd, 2); } // a cutting laser sweeping the field
    else if (m === 2) { magnet(z, -4 * sd, 2.5); magnet(z + 6, 4 * sd, 7); }
    else { obs(z, { x: -5.5 * sd, y: 4.75, hx: 1.6, hy: 4.75, hz: 1.4, col: ROCK, kind: 'rockwall' }); obs(z, { x: 5.5 * sd, y: 2, hx: 1.6, hy: 2, hz: 1.4, col: DARK, kind: 'rockwall' }); } }
  rocks(352, 512, 16);
  form(380, 3, i => ({ ...driller, x: (i - 1) * 4.5, y: 5 + (i % 2), vz: -4, ax: 1, ay: 1, w: 0.7, ph: i })); form(440, 6, i => ({ ...drone, x: 0, y: 5, ax: 4.2, ay: 2.5, w: 1.1, ph: i * 1.05, vz: -6, move: PATH.eight })); form(490, 4, i => ({ ...driller, x: (i % 2 ? 6 : -6), y: 3 + i * 1.2, ay: 1, vz: -5, move: PATH.pincer, pod: i === 3 }));
  K.checkpoints.push(528);

  // the bore: the colony's main shaft, and it is coming down. No slowing, the tunnel lurches, rocks let go of the roof
  zone(525, 725, CHASE, 'THE BOREHOLE - IT IS COLLAPSING - SHIFT TO CHASE VIEW'); K.tilt(545, 715, { rot: 0.35, sway: 0.3, w: 0.007 });
  gearAt(K, 540, 2, 'THE BORE IS COMING DOWN BEHIND US - NO SLOWING DOWN'); gearFree(K, 718);
  [[0, 4.6], [3.2, 5.8], [-3.2, 3.4], [2.6, 3], [-2.8, 6.2], [0, 5], [3.8, 4.4], [-3.8, 5]].forEach(([x, y], i) => { const z = 562 + i * 20; gate(z, x, y, { col: ROCK, w: 2.5, h: 2.1 }); if (i % 2) obs(z + 10, { x: -x * 0.8, y: 8.6, hx: 0.95, hy: 0.95, hz: 0.95, col: ROCK, kind: 'boulder', hp: 6, score: 120, drop: 13 }); else crate(z + 10, -x, 1, { pod: i === 4 }); });
  form(552, 4, i => ({ ...drone, x: 0, y: 4.8, ax: 2.6, ay: 2.6, w: 1.5, ph: i * 1.57, vz: -8 }));
  K.checkpoints.push(728);

  zone(725, 905, SIDE, 'THE CRUSHERS - SHIFT TO SIDE VIEW'); at(735 + SPAWN_Z, g => hint(g, 'THE JAWS GRIND OPEN AND SHUT. GO THROUGH WHEN THEY OPEN', 220));
  for (let i = 0, z = 756; z < 896; z += 16, i++) { const ph = i * 1.3; // two jaws of rock, grinding open and shut
    obs(z, { x: 0, y: 1.3, hx: 8.6, hy: 1.7, hz: 2.2, col: ROCK, kind: 'rockwall', osc: { ax: 0, ay: 0.9, w: 1, ph } }); obs(z, { x: 0, y: 8.3, hx: 8.6, hy: 1.7, hz: 2.2, col: DARK, kind: 'rockwall', osc: { ax: 0, ay: -0.9, w: 1, ph } });
    if (i % 2) obs(z + 8, { x: 0, y: 4.8, hx: 8.6, hy: 0.85, hz: 0.7, col: '#9fe9ff', kind: 'crystal', hp: 6, score: 120, gem: i % 4 === 1 }); else crate(z + 8, 0, i % 4 ? 3 : 6.6, { pod: i % 4 === 0, gem: false }); }
  form(770, 5, i => ({ ...drone, x: 0, y: 4.8, ay: 1.4, ax: 0, w: 1.2, ph: i * 0.9, vz: -6 })); form(840, 3, i => ({ ...driller, x: 0, y: 3.4 + i * 1.4, vz: -4.5, ay: 0.6, w: 0.8, ph: i }));
  K.checkpoints.push(908);
  const tick = g => { magPull(g); if (g.camZ > 545 && g.camZ < 715 && g.tick % 50 === 0) g.shake = Math.max(g.shake, 4); };

  zone(905, 1e9, SIDE, 'WARNING // THE MOTHER ROCK');
  spawnBoss(K, 955, { name: 'THE MOTHER ROCK', look: 'rock', hp: 2000, col: ROCK });
  const chuck = (g, b, n, sp) => { for (let i = 0; i < n; i++) addEnemy(g, { type: 'rock', x: b.x + (g.rand() - 0.5) * 4, y: b.y + (g.rand() - 0.5) * 4, z: b.z - 2, vz: -sp, vx: (g.rand() - 0.5) * 3, vy: (g.rand() - 0.5) * 3, hp: 3, r: 0.9, col: ROCK, shape: 'rock', score: 60, size: 2 }); g.fx.push('missile'); };
  const B = boss({ name: 'THE MOTHER ROCK', toast: 'THE BELT IS JUST ROCKS AGAIN', adds: { ...drone, hp: 3 }, addEvery: 640,
    sig: { name: 'FRACTURE', fire(g, b, c) { if (c % 70 === 0) { const a0 = c * 0.013; for (let i = 0; i < 3; i++) shot(g, b.x, b.y, b.z - 2, Math.cos(a0 + i * 2.094) * 2.5, Math.sin(a0 + i * 2.094) * 2.5, -4.6, '#ffffff', { split: { t: 38, n: 2, spread: 0.55, gen: 3, T: 34, cols: [ORE, '#ffe14a'] } }); g.fx.push('eshot'); } } }, // three shards that crack in two, and again, and again: a tree of splinters
    stages: [
    { name: 'CRUST', vuln: [SIDE], rec: SIDE, col: ROCK, bob: 2, attack(g, b, t) { const orb = g.enemies.filter(e => e.orb && e.hp > 0); // a belt of rubble circles it and soaks up your fire: break it
        if ((t === 10 || t % 600 === 300) && orb.length < 2) for (let i = 0; i < 5; i++) addEnemy(g, { type: 'pop', orb: true, shape: 'rock', col: DARK, hp: 7, r: 0.95, x: b.x, y: b.y, z: b.z - 4, vz: 0, ph: i * 1.2566, score: 80, pod: i === 2, move: (g2, e) => { const a = e.t * 0.022 + e.ph, bb = g2.boss; if (!bb) { e.z = -50; return; } e.x = bb.x; e.y = Math.max(0.8, Math.min(9, bb.y + Math.sin(a) * 3.3)); e.z = bb.z - 4.5 + Math.cos(a) * 1.6; } });
        if (t % 150 === 100) chuck(g, b, 2, 5.5); } },
    { name: 'MANTLE', vuln: [ISO, CHASE], rec: CHASE, col: DARK, sway: 3, attack(g, b, t) { if (t === 20) hint(g, 'BOULDERS! ALONG THE FLOOR, THEN ALONG THE ROOF', 190); if (t % 110 === 40) { const up = (t / 110 | 0) % 2, skip = g.rand() * 5 | 0; [-6.4, -3.2, 0, 3.2, 6.4].forEach((x, k) => { if (k !== skip) addObs(g, { rel: true, kind: 'boulder', x, y: up ? 8.2 : 1.35, z: b.z - 2, hx: 1.3, hy: 1.3, hz: 1.3, vz: -7.5, hp: 6, col: ROCK, score: 60 }); }); g.fx.push('slam'); }
        if (t % 220 === 150) { const p = near(g, b); addObs(g, { rel: true, kind: 'boulder', x: p.x, y: Math.max(3.4, Math.min(6.2, p.y)), z: b.z - 2, hx: 1.1, hy: 1.1, hz: 1.1, vz: -8.5, hp: 5, col: ORE, score: 80, gem: true }); } } }, // rows of boulders bowled down the lane, and one aimed straight at you
    { name: 'THE HEART', vuln: [SIDE, ISO], rec: SIDE, col: ORE, bob: 2.4, attack(g, b, t) { if (t % 380 === 20) { addObs(g, { rel: true, kind: 'crystal', x: 0, y: 4.8, z: b.z - 5, hx: 8.6, hy: 4.8, hz: 0.6, hp: Math.round(26 * bossScale(g)), col: ORE, score: 300, gem: true, life: 330 }); hint(g, 'IT HAS GROWN A SHELL OF ORE - BREAK IT', 150); g.fx.push('charge'); } if (t % 130 === 90) { aimed(g, b, 6.5, -0.1, ORE); aimed(g, b, 6.5, 0.1, ORE); g.fx.push('eshot'); } if (t % 260 === 200) chuck(g, b, 2, 6); } }] });
  K.fill(drone, 345, 890, 60, 'crate', 'tank');
  return K.done({ name: 'ASTEROID BELT', title: 'THE RUBBLE', boss: B, tick, theme: { sky: 'space', grid: '#3a3a5a', nofloor: true, cave: [150, 335], caveCol: '#c8a070' } });
}

// =====================================================================================
// LEVEL 7 — SATURN // THE RINGS: ice, mirrors, more lasers than anywhere else, and something enormous swimming in them
// =====================================================================================
function saturn() {
  const K = kit('saturn'), { at, obs, ring, en, ground, zone, form } = K, ICE = '#cfe8ff', GOLDR = '#e8c98a', LAS = '#ff3df0', LAS2 = '#7df9ff', MIR = '#b06bff';
  const chunk = (z, x, y, w = 1.2, o) => obs(z, { x, y, hx: w, hy: w * 0.8, hz: w, col: ICE, kind: 'berg', ...o }); // a lump of ring ice
  const prism = (z, x, y, o) => obs(z, { x, y, hx: 0.9, hy: 0.9, hz: 0.9, col: LAS2, kind: 'ice', hp: 5, score: 150, gem: true, ...o });
  const hl = (z, y, ph, o) => obs(z, { x: 0, y, hx: 8.6, hy: 0.35, hz: 0.5, col: LAS, kind: 'bolt', pulse: [60, 70, ph], ...o }); // pink lasers blink
  const vl = (z, x, ph, o) => obs(z, { x, y: 4.75, hx: 0.38, hy: 4.75, hz: 0.5, col: LAS, kind: 'bolt', pulse: [60, 70, ph], ...o });
  const sweepV = (z, ph, ax = 5.5) => obs(z, { x: 0, y: 4.75, hx: 0.38, hy: 4.75, hz: 0.5, col: LAS2, kind: 'bolt', osc: { ax, ay: 0, w: 0.8, ph } }); // blue lasers never switch off: they sweep
  const sweepH = (z, ph, ay = 3.2) => obs(z, { x: 0, y: 4.75, hx: 8.6, hy: 0.35, hz: 0.5, col: LAS2, kind: 'bolt', osc: { ax: 0, ay, w: 0.8, ph } });
  const mirror = (z, x, y, hx = 3) => obs(z, { x, y, hx, hy: 0.42, hz: 0.7, col: MIR, kind: 'girder' });
  const lancer = { col: LAS, shape: 'lancer', hp: 3, r: 0.7, score: 180, fire: 130, atk: ATK.laser(LAS) }, manta = { col: LAS2, shape: 'manta', hp: 2, r: 0.8, score: 140 }; // lancers fire a laser down the lane; mantas glide in formation
  const post = (z, o) => en(z, { ...lancer, type: 'saucer', hold: 16, dur: 380, ax: 2, ay: 2.5, hp: 6, score: 380, pod: true, ...o });
  const buoy = (z, x, y) => ground(z, { x, x0: x, y, y0: y, col: GOLDR, hp: 5, r: 0.75, score: 250, fire: 120, atk: ATK.laser(LAS2, 0.25), shape: 'prism', ph: (x + 9) * 0.3, pod: true }); // prism buoys: fixed laser posts
  for (let z = 20; z < 990; z += 12) if (z < 585 || z > 775) { obs(z, { x: 0, y: 0.2, hx: 9.6, hy: 0.12, hz: 6, col: GOLDR, kind: 'ringband', ghost: true }); obs(z, { x: 0, y: 9.45, hx: 9.6, hy: 0.12, hz: 6, col: '#9fb0ff', kind: 'ringband', ghost: true }); } // we fly between two sheets of ring

  zone(-99, 170, SIDE, 'SECTOR 6 // SATURN - THE RING PLANE'); at(40, g => hint(g, 'PINK LASERS BLINK. BLUE LASERS SWEEP. NEITHER IS FRIENDLY', 240));
  for (let i = 0, z = 36; z < 162; z += 13, i++) { const m = i % 4; if (m === 0) hl(z, 2.4 + (i % 3) * 2.2, i * 20); else if (m === 1) { chunk(z, 0, 1.6, 1.5); chunk(z + 5, 0, 7.8, 1.4); } else if (m === 2) { sweepH(z, i); prism(z + 6, 0, 4.8); } else { hl(z, 2.2, i * 20); hl(z, 7.2, i * 20 + 65); } }
  form(40, 5, i => ({ ...manta, x: 0, y: 5, ax: 0, ay: 2.6, w: 1.1, ph: i * 0.8, vz: -6, move: PATH.saw })); post(74, { y: 5 }); form(104, 6, i => ({ ...manta, x: 0, y: 8.5, y1: 1.5 + i * 1.1, ax: 0, vz: -6, ph: i, move: PATH.dive })); post(138, { y: 4.5 });
  K.checkpoints.push(173);

  zone(170, 380, ISO, 'THE CASSINI GAP - LASER GRID - SHIFT TO ISO VIEW');
  for (let i = 0, z = 204; z < 372; z += 12, i++) { const m = i % 5, sd = i % 2 ? 1 : -1;
    if (m === 0) { vl(z, -5.4, i * 20); vl(z, 0, i * 20 + 45); vl(z, 5.4, i * 20 + 90); }
    else if (m === 1) { mirror(z, -4.6 * sd, 2.6); mirror(z, 4.6 * sd, 6.8); prism(z + 6, 4 * sd, 2.4); }
    else if (m === 2) sweepV(z, i);
    else if (m === 3) { chunk(z, -5 * sd, 3, 1.5); chunk(z, 3 * sd, 7, 1.2); buoy(z + 6, -2 * sd, 5); }
    else { hl(z, 2.2, i * 25); vl(z, 3.5 * sd, i * 25 + 60); } }
  whale(K, 200, 0); at(204, g => hint(g, 'WHOA. SOMETHING ENORMOUS IS SWIMMING THROUGH THE RINGS', 240));
  form(214, 5, i => ({ ...manta, x: (i - 2) * 2.6, y: 5 + Math.abs(i - 2) * 0.9, z: SPAWN_Z + Math.abs(i - 2) * 1.6, vz: -7, ax: 0.6, w: 1 }), 0); form(262, 3, i => ({ ...lancer, x: (i - 1) * 4.5, y: 4 + i, vz: -4, ax: 1, ay: 1, w: 0.7, ph: i })); form(310, 7, i => ({ ...manta, x: 0, y: 5, ax: 4.5, ay: 2.6, w: 1, ph: i * 0.9, vz: -6, move: PATH.eight })); form(350, 5, i => ({ ...manta, x: (i % 2 ? 7 : -7), y: 3 + i, ay: 1, vz: -6, move: PATH.pincer, pod: i === 4 }));
  K.checkpoints.push(383);

  zone(380, 580, CHASE, 'SHEPHERD MOONS - LASER FRAMES - SHIFT TO CHASE VIEW'); K.tilt(400, 570, { sway: 0.14, w: 0.009, px: 26, py: 14 });
  for (let i = 0; i < 8; i++) { const z = 412 + i * 20, x = Math.sin(i * 1.1) * 3.6, y = 4.8 + Math.cos(i * 0.8) * 1.7; // a frame of lasers round a ring: the uprights never blink, the cross-bars do
    if (i % 2 === 0) { vl(z, x - 2.4, 0, { pulse: undefined }); vl(z, x + 2.4, 0, { pulse: undefined }); hl(z, y - 2, i * 30); hl(z, y + 2, i * 30 + 65); ring(z, { x, y, r: 1.4 }); } else { sweepV(z, i * 1.3, 5); chunk(z + 8, -x, y, 1.3); } }
  whale(K, 432, 1); at(452, g => hint(g, 'IT IS COMING BACK - RIGHT OVER US. STAY LOW!', 220));
  form(396, 5, i => ({ ...manta, x: 0, y: 4.8, ax: 3, ay: 2.6, w: 1.2, ph: i * 1.25, vz: -7, move: PATH.cork })); form(482, 3, i => ({ ...lancer, x: (i - 1) * 4, y: 3 + i * 1.4, vz: -4.5, ax: 1.2, ay: 0.8, w: 0.8, ph: i })); form(536, 6, i => ({ ...manta, x: 0, y: 4.8, ax: 3.4, ay: 2.8, w: 1.1, ph: i * 1.05, vz: -7, pod: i === 5 }));
  K.checkpoints.push(583);

  // straight up through the rings: the stage turns on end and every layer of ring is a sheet of ice with one gap in it
  zone(580, 780, SIDE, 'THROUGH THE RINGS - WE ARE CLIMBING - SHIFT TO SIDE VIEW'); K.tilt(596, 770, { rot: -1.5708, sway: 0.05, w: 0.02 }); at(596 + SPAWN_Z, g => { hint(g, 'CLIMBING THROUGH THE RING LAYERS - FIND THE GAPS', 240); g.shake = Math.max(g.shake, 6); });
  for (let i = 0, z = 622; z < 768; z += 14, i++) { const gy = [2.2, 6.8, 4.6, 7.4, 3, 5.6][i % 6], gh = 1.5;
    obs(z, { x: 0, y: (gy - gh) / 2, hx: 8.6, hy: (gy - gh) / 2, hz: 0.8, col: ICE, kind: 'clouddeck' }); obs(z, { x: 0, y: (gy + gh + 9.6) / 2, hx: 8.6, hy: (9.6 - gy - gh) / 2, hz: 0.8, col: ICE, kind: 'clouddeck' });
    if (i % 3 === 1) obs(z, { x: 0, y: gy, hx: 8.6, hy: gh, hz: 0.6, col: LAS2, kind: 'crystal', hp: 6, score: 120, gem: true }); if (i % 3 === 2) sweepH(z + 7, i, 2.6); if (i % 3 === 0) hl(z + 7, gy, i * 30); } // some gaps are plugged with crystal you can shoot out
  whale(K, 688, 2); at(700, g => hint(g, 'THERE IT GOES AGAIN. I THINK IT LIKES US', 200));
  form(640, 4, i => ({ ...manta, x: 0, y: 4.8, ay: 2.8, ax: 0, w: 1, ph: i * 0.9, vz: -6, move: PATH.saw })); post(724, { y: 5, ax: 0 });
  K.checkpoints.push(783);

  // the loom: the rings are being woven out of light. It pulls the ship through fast, and the one dark lane walks from side to side
  zone(780, 960, CHASE, 'THE LASER LOOM - SHIFT TO CHASE VIEW'); gearAt(K, 800, 2, 'THE LOOM PULLS US THROUGH AT SPEED - FOLLOW THE DARK LANE'); gearFree(K, 950);
  for (let i = 0, z = 814; z < 948; z += 7, i++) { const lane = [-6.4, -3.2, 0, 3.2, 6.4], open = Math.round(2 + 2 * Math.sin(i * 0.45)), free = open + (i % 2 ? 1 : -1);
    lane.forEach((x, k) => { if (k !== open && k !== free) vl(z, x, 0, { pulse: undefined, col: k % 2 ? LAS : LAS2 }); }); if (i % 4 === 3) hl(z + 3.5, i % 8 === 3 ? 2 : 7.4, i * 20); if (i % 6 === 2) prism(z + 3.5, lane[open], 4.8, { pod: i === 8 }); }
  K.checkpoints.push(963);

  zone(960, 1e9, SIDE, 'WARNING // THE PRISM - IT SPLITS THE LIGHT');
  spawnBoss(K, 1010, { name: 'THE PRISM', look: 'prism', hp: 1900, col: LAS2 });
  const lance = (g, b, ys, col) => { const hz = (b.z - 2.5) / 2; for (const y of ys) addObs(g, { rel: true, kind: 'beam', x: 0, y, z: hz + 0.5, hx: 9, hy: 0.42, hz, warm: 95, life: 34, col }); g.fx.push('charge'); };
  const RB = ['#ff4d6d', '#ff8a2b', '#ffe14a', '#3dffb0', '#2ee6ff', '#5e7bff', '#b06bff'];
  const B = boss({ name: 'THE PRISM', toast: 'THE RINGS GO DARK', adds: { ...lancer, hp: 3 }, addEvery: 700,
    sig: { name: 'SPIROGRAPH', fire(g, b, c) { if (c % 2 === 0) { const th = c * 0.08, dir = -2 * th; bullet(g, b.x + Math.cos(3 * th) * 2.2, b.y + Math.sin(3 * th) * 2.2, b.z - 2, Math.cos(dir) * 3, Math.sin(dir) * 3, -5.5, RB[(c >> 1) % 7]); } } }, // the gun rides a little wheel round the prism while it turns the other way: the shots draw a spirograph in seven colours
    stages: [
    { name: 'SCANLINES', vuln: [SIDE], rec: SIDE, col: LAS, bob: 1.2, attack(g, b, t) { const dir = (t / 840 | 0) % 2 ? -1 : 1; if (t === 10) hint(g, 'SCANLINES - STEP FORWARD AND BACK THROUGH THE GAPS AS THEY CLIMB', 190); if (t % 105 === 20) { const k = t / 105 | 0; for (const z of k % 2 ? [8.2, 20] : [2.5, 14]) addObs(g, { rel: true, kind: 'bar', x: 0, y: dir > 0 ? -0.3 : 9.9, z, hx: 9, hy: 0.3, hz: 3, vy: dir * 1.5, col: k % 2 ? LAS : LAS2, life: 430 }); } } }, // rows of light bars that never stop climbing (or falling), each row with its gaps in a different place
    { name: 'DISPERSION', vuln: [ISO, CHASE], rec: CHASE, col: LAS2, sway: 3, attack(g, b, t) { if (t === 10) hint(g, 'WHITE BOLTS SPLIT INTO SEVEN - DO NOT STAND IN THE FAN', 190); if (t % 80 === 40) { const p = near(g, b), T = Math.max(0.5, (b.z - 2 - p.z) / 7); shot(g, b.x, b.y, b.z - 2, (p.x - b.x) / T, (p.y - b.y) / T, -7, '#ffffff', { split: { t: 62, n: 7, spread: 0.2, gen: 1, cols: RB, gain: 1.6 } }); g.fx.push('eshot'); } } },
    { name: 'CONVERGENCE', vuln: [ISO], rec: ISO, col: '#ffffff', sway: 1, attack(g, b, t) { if (t % 400 === 30) { hint(g, 'THE LIGHT IS CLOSING IN - GET TO THE MIDDLE', 160); for (const sd of [-1, 1]) for (const z of [3, 7, 11, 15, 19]) addObs(g, { rel: true, kind: 'bolt', x: sd * 8.6, y: 4.75, z, hx: 0.38, hy: 4.75, hz: 0.6, vx: -sd * 1.15, col: sd > 0 ? LAS : LAS2, life: 320 }); g.fx.push('charge'); }
        if (t % 400 > 120 && t % 400 < 330 && t % 26 === 0) { const p = near(g, b), T = Math.max(0.5, (b.z - 2 - p.z) / 6.5); bullet(g, b.x, b.y, b.z - 2, (p.x - b.x) / T, (p.y - b.y) / T, -6.5, RB[(t / 26 | 0) % 7]); } } }] }); // two fences of light close on the middle of the lane, then it fires down the gap
  K.fill(manta, 180, 780, 62, 'ice', 'tank');
  return K.done({ name: 'SATURN', title: 'THE RINGS', boss: B, theme: { sky: 'saturn', grid: '#6a5a3a', nofloor: true } });
}

// =====================================================================================
// LEVEL 8 — PLUTO // THE COLD EDGE: an ice shelf to shatter, snow comets, black ice, drifting bergs, a blizzard
// =====================================================================================
function pluto() {
  const K = kit('pluto'), { at, obs, en, zone, gate, form } = K, ICE = '#9fe9ff', DEEP = '#5ea0ff', SNOW = '#ffffff';
  const flake = (z, x, y, o = {}) => en(z, { type: 'kami', x, y, vz: -9, hp: 2, r: 0.6, col: '#c8f4ff', score: 150, shape: 'flake', ...o }); // a snowflake comet streaking in
  const cryo = (z, x, ph) => obs(z, { x, y: 4.75, hx: 1.1, hy: 4.75, hz: 1.1, col: ICE, kind: 'cryo', pulse: [80, 120, ph] }); // an ice geyser that blasts and stops
  const icicle = (z, x, h) => obs(z, { x, y: 9.6 - h / 2, hx: 0.7, hy: h / 2, hz: 0.7, col: ICE, kind: 'icicle' }); // hangs from the roof
  const spike = (z, x, h) => obs(z, { x, y: h / 2, hx: 0.75, hy: h / 2, hz: 0.75, col: DEEP, kind: 'icicle' }); // and grows from the floor
  const berg = (z, x, y, w, h, ox = 0, oy = 0.4) => obs(z, { x, y, hx: w, hy: h, hz: 1.4, col: ICE, kind: 'berg', osc: ox || oy > 0.4 ? { ax: ox, ay: oy, w: 0.6, ph: x + z } : undefined }); // a drifting chunk of ice
  const shardling = { col: SNOW, shape: 'shard', hp: 2, r: 0.6, score: 130 }, wisp = { col: ICE, shape: 'orb', hp: 3, r: 0.75, score: 170, fire: 150, atk: ATK.shard('#c8f4ff') }; // wisps split off homing shards
  const wyrm = (z, x, n = 9) => { const gr = 'wy' + z; for (let i = 0; i < n; i++) at(z + i * 0.9, g => addEnemy(g, { type: 'pop', rel: false, z: 30 + i * 0.9, vz: 0, group: gr, gn: n, x, y: 0, y0: 0.2, ay: 6.5, w: 1.2, ph: -i * 0.3, hp: 2, r: 0.6, col: i ? ICE : SNOW, score: 80, shape: 'worm' })); }; // ice wyrms arcing up through the floe

  zone(-99, 170, ISO, 'SECTOR 7 // PLUTO - SHATTER THE ICE SHELF');
  for (let i = 0; i < 10; i++) { const z = 34 + i * 12; for (let k = 0; k < 4; k++) if ((i + k) % 4 !== 1) obs(z, { x: 0, y: 1.2 + k * 2.3, hx: 8.6, hy: 1.05, hz: 0.9, col: k % 2 ? ICE : DEEP, kind: 'ice', hp: 5, gem: (i + k) % 3 === 0, score: 80 }); }
  for (let i = 0; i < 9; i++) icicle(40 + i * 13, (i % 3 - 1) * 5, 2.2 + (i % 2) * 1.4);
  for (let i = 0; i < 6; i++) flake(60 + i * 16, (i % 2 ? 4 : -4), 3 + i % 3 * 2);
  form(100, 5, i => ({ ...shardling, x: 0, y: 5, ax: 4, ay: 2.4, w: 1.1, ph: i * 1.25, vz: -6, move: PATH.eight, pod: i === 4 }));
  K.checkpoints.push(173);

  zone(170, 365, CHASE, 'SNOW COMETS - SHIFT TO CHASE VIEW'); K.tilt(185, 355, { sway: 0.14, w: 0.01, px: 20 }); K.hill(210, 250, 1.4); // blizzard gusts rock the stage
  for (let i = 0; i < 22; i++) flake(182 + i * 8, Math.sin(i * 2.3) * 6, 2 + Math.abs(Math.sin(i * 1.7)) * 6, { vz: -11 - (i % 3) * 2 });
  for (let i = 0; i < 10; i++) cryo(196 + i * 16, [-5, 0, 5, -2.5, 2.5, 6][i % 6], i * 30);
  for (let i = 0; i < 11; i++) { const z = 190 + i * 15; icicle(z, (i % 2 ? -1 : 1) * (2 + i % 3 * 2), 3 + (i % 3)); if (i % 2) spike(z + 6, (i % 3 - 1) * 4, 2.5 + i % 2); }
  for (let i = 0; i < 6; i++) obs(206 + i * 26, { x: (i % 2 ? 1 : -1) * 4, y: 4.75, hx: 0.8, hy: 4.75, hz: 0.8, col: DEEP, kind: 'spire' });
  form(240, 3, i => ({ ...wisp, x: (i - 1) * 4, y: 6, vz: -4, ax: 1, ay: 1, w: 0.7, ph: i })); form(320, 3, i => ({ ...wisp, x: (i - 1) * 3.5, y: 4, vz: -4, ax: 1.4, ay: 1, w: 0.7, ph: i, pod: i === 1 }));
  K.checkpoints.push(368);

  // the crevasse: a canyon of ice, and the air in it is so cold the ship slides as if it were on black ice
  zone(365, 565, SIDE, 'THE CREVASSE - BLACK ICE - SHIFT TO SIDE VIEW'); at(374 + SPAWN_Z, g => hint(g, 'BLACK ICE - THE SHIP SLIDES. STEER EARLY', 220));
  for (let i = 0, z = 392; z < 560; z += 5, i++) { const fl = 0.6 + Math.abs(Math.sin(i * 0.6)) * 1.3, rf = 0.6 + Math.abs(Math.sin(i * 0.47 + 1)) * 1.3; obs(z, { x: 0, y: fl / 2, hx: 9, hy: fl / 2, hz: 2.6, col: i % 2 ? DEEP : '#3a6ac0', kind: 'rockwall' }); obs(z, { x: 0, y: 9.6 - rf / 2, hx: 9, hy: rf / 2, hz: 2.6, col: i % 2 ? DEEP : '#3a6ac0', kind: 'rockwall' }); }
  for (let i = 0, z = 406; z < 552; z += 13, i++) { const m = i % 4; if (m === 0) { icicle(z, 0, 3.6); spike(z + 6, 0, 3.2); } else if (m === 1) obs(z, { x: 0, y: 4.8, hx: 8.6, hy: 0.85, hz: 0.7, col: ICE, kind: 'crystal', hp: 6, score: 120, gem: true }); else if (m === 2) cryo(z, 0, i * 30); else berg(z, 0, 4.8, 1.4, 1, 0, 2.2); }
  form(420, 5, i => ({ ...shardling, x: 0, y: 4.8, ay: 2, ax: 0, w: 1.1, ph: i * 0.9, vz: -6, move: PATH.saw })); form(486, 3, i => ({ ...wisp, x: 0, y: 3.4 + i * 1.5, vz: -4.5, ay: 0.6, w: 0.8, ph: i })); form(530, 5, i => ({ ...shardling, x: 0, y: 7.4, y1: 2.6 + (i % 2) * 2, ax: 0, vz: -6, ph: i, move: PATH.dive, pod: i === 4 }));
  K.checkpoints.push(568);

  zone(565, 765, ISO, 'DRIFTING BERGS - SHIFT TO ISO VIEW'); K.hill(590, 630, 1.6); K.tilt(600, 755, { sway: 0.1, w: 0.008, py: 18 }); // the floe rides the swell
  for (let i = 0; i < 14; i++) berg(596 + i * 12, (i % 2 ? 1 : -1) * (3 + i % 3), 1.5 + (i % 3) * 2.6, 1.6 + (i % 2) * 0.8, 1.1, i % 3 === 0 ? 2.5 : 0);
  for (let i = 0; i < 4; i++) wyrm(612 + i * 38, (i % 2 ? 3 : -3)); for (let i = 0; i < 8; i++) flake(600 + i * 19, (i - 3.5) * 1.8, 7.5, { vz: -8 });
  for (let i = 0; i < 6; i++) en(610 + i * 24, { type: 'kami', x: (i % 3 - 1) * 4, y: 3 + (i % 3) * 2, vz: -7, hp: 2, r: 0.55, col: SNOW, score: 150, shape: 'shard', pod: i % 3 === 1 });
  form(680, 6, i => ({ ...shardling, x: (i % 2 ? 7 : -7), y: 2.5 + i, ay: 1, vz: -6, move: PATH.pincer }));
  K.checkpoints.push(768);

  zone(765, 950, CHASE, 'THE BLIZZARD - SHIFT TO CHASE VIEW'); K.tilt(785, 940, { rot: 0.5, sway: 0.25, w: 0.008 }); at(785 + SPAWN_Z, g => hint(g, 'BLIZZARD! THE WIND SHOVES US ABOUT - HOLD A LINE THROUGH THE ICE GATES', 240));
  [[0, 4.8], [3.2, 5.6], [-3.2, 3.6], [0, 6], [3, 3.4], [-3, 5.4]].forEach(([x, y], i) => { const z = 806 + i * 23; gate(z, x, y, { col: ICE, w: 2.7, h: 2.2 }); if (i % 2) cryo(z + 11, -x, i * 40); else obs(z + 11, { x: -x || 4, y: 4.75, hx: 0.8, hy: 4.75, hz: 0.8, col: DEEP, kind: 'spire' }); });
  for (let i = 0; i < 16; i++) flake(792 + i * 9, Math.sin(i * 2.3) * 6, 2 + Math.abs(Math.sin(i * 1.7)) * 6, { vz: -12 - (i % 3) * 2 });
  at(930, g => addPod(g, 0, 5, SPAWN_Z, 'god'));
  K.checkpoints.push(953);

  zone(950, 1e9, SIDE, 'WARNING // THE FROST WARDEN');
  spawnBoss(K, 1000, { name: 'FROST WARDEN', look: 'frost', hp: 3200, col: ICE });
  const frost = (g, n) => { g.frostT = n; hint(g, 'FREEZING BREATH - THE SHIP WILL SLIDE', 150); g.fx.push('charge'); g.flash = 4; };
  const B = boss({ name: 'FROST WARDEN', toast: 'THE EDGE IS OPEN', adds: { ...shardling, hp: 3 }, addEvery: 640,
    sig: { name: 'FROST LATTICE', fire(g, b, c) { if (c % 12 === 0) { const k = (c / 12) % 20, thin = g.view === SIDE; if (k < 16 && !(thin && k % 2)) for (let j = 0; j <= k; j++) if ((j & (k - j)) === 0) bullet(g, b.x + (j - k / 2) * 1.05, 9.3 - k * 0.56, b.z - 2, 0, 0, -5, (j + k) % 2 ? SNOW : ICE); if (k === 0) g.fx.push('eshot'); } } }, // a sheet of frost in the shape that ice makes: a triangle of triangles, with holes to slip through
    stages: [
    { name: 'RIME', vuln: [SIDE], rec: SIDE, col: ICE, bob: 2, attack(g, b, t) { if (t % 90 === 30) for (let i = 0; i < 5; i++) bullet(g, 0, 9.6, 5 + i * 3.6 + (t / 90 % 2) * 1.8, 0, -3.2, -1.2, SNOW); if (t % 420 === 200) frost(g, 190); } }, // icicles raining the length of the lane, and a breath that takes your grip away
    { name: 'SHATTER', vuln: [ISO, CHASE], rec: CHASE, col: DEEP, sway: 3.2, attack(g, b, t) { if (t % 520 === 30 && !g.enemies.some(e => e.decoy && e.hp > 0)) { hint(g, 'IT SPLIT! THE COPIES SHOOT TOO', 150); for (const sd of [-1, 1]) addEnemy(g, { type: 'saucer', decoy: true, shape: 'shard', col: ICE, hp: 12, r: 1.5, hold: 21, dur: 900, x: sd * 5, y: 5, z: b.z, ax: 1.4, ay: 2, ph: sd, fire: 105, atk: ATK.twin(6.5, ICE), score: 400, pod: sd > 0 }); g.fx.push('bossin'); }
        if (t % 210 === 120) { for (let i = 0; i < 6; i++) addEnemy(g, { type: 'kami', shape: 'flake', col: '#c8f4ff', hp: 1, r: 0.5, vz: -7, x: b.x + Math.cos(i * 1.0472) * 3, y: b.y + Math.sin(i * 1.0472) * 2.6, z: b.z - 1, score: 60 }); g.fx.push('missile'); } } },
    { name: 'ABSOLUTE ZERO', vuln: [CHASE], rec: CHASE, col: SNOW, attack(g, b, t) { if (t % 5 === 0) { const a = g.rand() * 6.283; bullet(g, Math.cos(a) * 9.5, 4.8 + Math.sin(a) * 5.4, 7 + g.rand() * 15, -Math.cos(a) * 1.7, -Math.sin(a) * 1, -2.6, t % 10 ? SNOW : ICE); } if (t % 400 === 150) frost(g, 170); } }] }); // hail closing in from every edge of the screen
  K.fill(shardling, 180, 930, 60, 'ice', 'tank');
  return K.done({ name: 'PLUTO', title: 'THE COLD EDGE', boss: B, theme: { sky: 'ice', grid: '#2a5a9a' },
    tick: g => { if (g.frostT > 0) g.frostT--; }, rules: { inertia: g => g.frostT > 0 ? 0.06 : !g.boss && g.camZ > 374 && g.camZ < 560 ? 0.07 : 0, wind: g => g.camZ > 785 && g.camZ < 942 && !g.boss ? [Math.sin(g.tick * 0.02) * 1.5, 0] : [0, 0] } });
}

// =====================================================================================
// LEVEL 9 — THE WORMHOLE // THE THROAT: every world you crossed, folded together, and the rules keep changing
// =====================================================================================
function wormhole() {
  const K = kit('worm'), { at, obs, ring, en, zone, gate, form } = K, W = '#b06bff', PK = '#ff3df0', CY = '#2ee6ff', GR = '#3dffb0', YL = '#ffe14a';
  const echo = { col: '#ffffff', shape: 'echo', hp: 2, r: 0.7, score: 150 }, rift = (z, o) => en(z, { type: 'saucer', col: PK, hp: 8, r: 0.95, score: 450, hold: 15, dur: 400, ax: 3, ay: 1.6, fire: 115, atk: ATK.ring(10, 2.8, W), shape: 'prism', pod: true, ...o });
  const tent = (z, x, ph, v) => obs(z, { x, y: 4.75, hx: 0.75, hy: 4.75, hz: 0.75, col: PK, kind: 'tentacle', tvar: v, osc: { ax: 1.2, ay: 0, w: 1.3, ph } });
  const magnet = (z, x, y) => obs(z, { x, y, hx: 1.1, hy: 1.1, hz: 1.1, col: PK, kind: 'magnet', hp: 9, score: 200, gem: true });
  const phase = (z, v) => obs(z, { x: 0, y: 4.8, hx: 9.6, hy: 4.8, hz: 0.5, col: '#ffffff', kind: 'phase', phase: v, keep: true }); // a wall that only exists in one view: be in any other and you fly straight through it

  zone(-99, 150, CHASE, 'SECTOR 8 // THE WORMHOLE - THE THROAT'); K.tilt(26, 146, { spin: 0.003 }); at(40, g => hint(g, 'IT IS TURNING. EVERYTHING IN HERE IS BORROWED FROM SOMEWHERE WE HAVE BEEN', 260));
  for (let i = 0; i < 15; i++) ring(36 + i * 7.4, { x: Math.cos(i * 0.6) * 4, y: 4.8 + Math.sin(i * 0.6) * 2.6, r: 1.4 });
  [[0, 4.8, CY], [3, 6, '#ffb02e'], [-3, 3.6, '#9fe9ff'], [0, 5.4, PK]].forEach(([x, y, c], i) => gate(62 + i * 22, x, y, { col: c, org: 0, w: 2.6, h: 2.2, noRing: true }));
  form(46, 5, i => ({ ...echo, x: 0, y: 4.8, ax: 3.2, ay: 2.8, w: 1.2, ph: i * 1.25, vz: -6, move: PATH.cork })); form(118, 5, i => ({ ...echo, x: 0, y: 4.8, ax: 3, ay: 2.6, w: 1.3, ph: i * 1.25, vz: -7, pod: i === 4 }));
  K.checkpoints.push(153);

  // FOLD RAPIDS: four worlds in a row, a different view for each, and a wall at every seam that only exists in the view you are leaving
  at(150, g => hint(g, 'FOLD RAPIDS - EACH WHITE WALL ONLY EXISTS IN THE VIEW YOU ARE LEAVING. SHIFT, OR SPLAT', 300));
  [[SIDE, 'RAPIDS - SIDE VIEW! SKYWAYS'], [ISO, 'RAPIDS - ISO VIEW! THE GROVE'], [CHASE, 'RAPIDS - CHASE VIEW! FIREWALL'], [SIDE, 'RAPIDS - SIDE VIEW! LIGHTNING']].forEach(([v, msg], i, A) => { const z0 = 150 + i * 70; zone(z0, z0 + 70, v, msg); phase(z0 + 13, i ? A[i - 1][0] : CHASE);
    if (i === 0) { obs(z0 + 23, { x: 0, y: 2.1, hx: 8.6, hy: 2.1, hz: 1.2, col: PK, kind: 'slab' }); obs(z0 + 38, { x: 0, y: 6.95, hx: 8.6, hy: 2.55, hz: 1.2, col: CY, kind: 'slab' }); obs(z0 + 31, { x: 0, y: 4.75, hx: 2.2, hy: 0.55, hz: 1.1, col: GR, kind: 'elevator', osc: { ax: 0, ay: 2.7, w: 1.1, ph: 1 } }); }
    else if (i === 1) { [-5.2, 0, 5.2].forEach((x, k) => tent(z0 + 24, x, k, k)); [-2.6, 2.6, 7.4, -7.4].forEach((x, k) => tent(z0 + 38, x, k + 2, (k + 1) % 4)); }
    else if (i === 2) { gate(z0 + 23, -3, 5.4, { col: YL, org: 0 }); gate(z0 + 39, 3, 3.8, { col: YL, org: 0 }); }
    else for (let k = 0; k < 3; k++) obs(z0 + 22 + k * 8, { x: 0, y: [2.4, 7, 4.7][k], hx: 8.6, hy: 0.4, hz: 0.5, col: '#7df9ff', kind: 'bolt', pulse: [70, 60, k * 40] });
    form(z0 + 16, 4, k => ({ ...echo, x: v === SIDE ? 0 : (k - 1.5) * 2.4, y: 3 + k * 1.2, vz: -7, ax: v === SIDE ? 0 : 1, ay: 1, ph: k })); K.checkpoints.push(z0 + 73); });

  // the knot: the throat turns a quarter at a time, and it is full of things that pull, sweep and burst
  zone(430, 630, CHASE, 'THE GRAVITY KNOT - SHIFT TO CHASE VIEW'); K.tilt(446, 502, { rot: 1.5708 }); K.tilt(502, 562, { rot: 3.1416 }); K.tilt(562, 622, { rot: -1.5708 });
  for (const z of [446, 502, 562]) at(z + SPAWN_Z, g => { hint(g, 'THE THROAT TURNS A QUARTER - KEEP YOUR HEAD', 150); g.shake = Math.max(g.shake, 5); g.fx.push('charge'); });
  for (let i = 0, z = 462; z < 624; z += 12, i++) { const m = i % 6, sd = i % 2 ? 1 : -1;
    if (m === 0) obs(z, { x: 0, y: 4.75, hx: 1.1, hy: 4.75, hz: 1.4, col: '#ffb02e', kind: 'flare', osc: { ax: 6, ay: 0, w: 0.7, ph: i } });
    else if (m === 1) { magnet(z, 5 * sd, 4.8); tent(z + 6, -3 * sd, i, i % 4); }
    else if (m === 2) for (const x of [-5.4, 0, 5.4]) obs(z, { x, y: 4.75, hx: 0.38, hy: 4.75, hz: 0.5, col: PK, kind: 'bolt', pulse: [60, 70, i * 20 + (x + 6) * 8] });
    else if (m === 3) { obs(z, { x: 4.5 * sd, y: 4.75, hx: 1.05, hy: 4.75, hz: 1.05, col: '#ff5a1f', kind: 'geyser', pulse: [70, 80, i * 30] }); obs(z, { x: -3 * sd, y: 2, hx: 1.5, hy: 1.1, hz: 1.4, col: '#9fe9ff', kind: 'berg' }); }
    else if (m === 4) { magnet(z, -4 * sd, 6.5); obs(z + 6, { x: 3 * sd, y: 3, hx: 1, hy: 1, hz: 1, col: YL, kind: 'crate', hp: 6, score: 150, gem: true }); }
    else obs(z, { x: 0, y: 4.75, hx: 0.38, hy: 4.75, hz: 0.5, col: CY, kind: 'bolt', osc: { ax: 5.5, ay: 0, w: 0.8, ph: i } }); }
  rift(480, { x: -2, y: 6 }); form(520, 6, i => ({ ...echo, x: 0, y: 5, ax: 4.2, ay: 2.6, w: 1.1, ph: i * 1.05, vz: -6, move: PATH.eight })); rift(580, { x: 2, y: 5 });
  K.checkpoints.push(633);

  // time stretch: it crawls, then it snaps. Slow through the tight parts, then HYPER with only the flashes to warn you
  zone(630, 830, SIDE, 'TIME STRETCH - SHIFT TO SIDE VIEW');
  gearAt(K, 640, 0, 'TIME SLOWS TO A CRAWL - THREAD IT'); gearAt(K, 692, 4, 'AND SNAPS FORWARD! THE FLASHES SHOW WHERE THE WALLS WILL BE', 'time snap'); gearAt(K, 762, 0, 'CRAWLING AGAIN'); gearAt(K, 792, 4, 'SNAP!'); gearFree(K, 826);
  const tight = (a, b) => { for (let i = 0, z = a; z < b; z += 6, i++) { const m = i % 3; if (m === 0) obs(z, { x: 0, y: i % 2 ? 2.6 : 7, hx: 8.6, hy: 0.4, hz: 0.5, col: '#7df9ff', kind: 'bolt', pulse: [50, 50, i * 17] }); else if (m === 1) obs(z, { x: 0, y: 4.8, hx: 8.6, hy: 0.85, hz: 0.7, col: '#9fe9ff', kind: 'crystal', hp: 5, score: 120, gem: true }); else { obs(z, { x: 0, y: 1.5, hx: 8.6, hy: 1.5, hz: 0.8, col: W, kind: 'slab' }); obs(z, { x: 0, y: 8.2, hx: 8.6, hy: 1.4, hz: 0.8, col: W, kind: 'slab' }); } } };
  const snap = (a, b) => { const F = { col: W, kind: 'slab', warm: 128 }; for (let i = 0, z = a; z < b; z += 8, i++) { const gy = [2.2, 4.8, 7.2, 3.4, 6.2, 4.8][(i * 7 + (i >> 2)) % 6], gh = 1.55; if (gy - gh > 0.4) obs(z, { ...F, x: 0, y: (gy - gh) / 2, hx: 8.6, hy: (gy - gh) / 2, hz: 0.6 }); if (gy + gh < 9.4) obs(z, { ...F, x: 0, y: (gy + gh + 9.6) / 2, hx: 8.6, hy: (9.6 - gy - gh) / 2, hz: 0.6 }); } };
  tight(662, 694); snap(714, 764); tight(772, 792); snap(810, 826);
  K.checkpoints.push(833);

  // the event horizon: traffic, gates, lasers and a current that drags the ship round in circles, all of it rolling
  zone(830, 1010, CHASE, 'THE EVENT HORIZON - SHIFT TO CHASE VIEW'); K.tilt(850, 1000, { spin: -0.0032 }); at(850 + SPAWN_Z, g => hint(g, 'THE CURRENT IS DRAGGING US ROUND - STEER AGAINST IT', 220));
  for (let i = 0, z = 866; z < 1000; z += 11, i++) { const m = i % 4, y = [2.4, 5, 7.4][i % 3];
    if (m === 0) { obs(z, { x: -8 + (i * 5) % 16, y, hx: 1.3, hy: 0.45, hz: 0.7, vx: i % 2 ? 4 : -4, wrap: 11, col: '#ff8a2b', kind: 'car' }); obs(z + 5, { x: 6 - (i * 7) % 14, y: [5, 7.4, 2.4][i % 3], hx: 2.4, hy: 0.6, hz: 0.7, vx: i % 2 ? -5 : 5, wrap: 11, col: YL, kind: 'car' }); }
    else if (m === 1) gate(z, Math.sin(i) * 3.4, 4.8 + Math.cos(i * 0.7) * 1.5, { col: CY, org: 0, w: 2.6, h: 2.2 });
    else if (m === 2) obs(z, { x: 0, y: 4.75, hx: 0.38, hy: 4.75, hz: 0.5, col: PK, kind: 'bolt', osc: { ax: 5, ay: 0, w: 0.9, ph: i } });
    else { tent(z, (i % 8 === 3 ? 4 : -4), i, i % 4); obs(z + 5, { x: (i % 8 === 3 ? -3 : 3), y: 4.8, hx: 1, hy: 1, hz: 1, col: YL, kind: 'crate', hp: 5, score: 150, gem: true, pod: i === 7 }); } }
  form(860, 5, i => ({ ...echo, x: 0, y: 4.8, ax: 3.4, ay: 3, w: 1.3, ph: i * 1.25, vz: -7 })); rift(930, { x: 0, y: 6.4 }); at(992, g => addPod(g, 0, 5, SPAWN_Z, 'god'));
  K.checkpoints.push(1013);
  const tick = g => magPull(g);

  zone(1010, 1e9, SIDE, 'WARNING // THE PARADOX - IT HAS ALREADY HAPPENED');
  spawnBoss(K, 1060, { name: 'THE PARADOX', look: 'paradox', hp: 3600, col: W, score: 30000 });
  const B = boss({ name: 'THE PARADOX', glitchy: true, toast: 'THE WAY TO PLANET X IS OPEN', adds: { ...echo, hp: 3 }, addEvery: 640,
    sig: { name: 'TIME LOOP', fire(g, b, c) { const k = c % 80; if (k === 0) { const n0 = g.ebul.length, n = 16, off = c * 0.01; for (let i = 0; i < n; i++) { const a = i / n * 6.283 + off; bullet(g, b.x, b.y, b.z - 2, Math.cos(a) * 3.6, Math.sin(a) * 3.6, -3.4, i % 2 ? W : '#ffffff'); } b.tl = g.ebul.slice(n0); g.fx.push('eshot'); } if (k === 46 && b.tl) { for (const q of b.tl) if (q.life > 0) { q.vx *= -1.25; q.vy *= -1.25; q.col = PK; } g.fx.push('zap'); } } }, // a ring flies out, stops, and comes back in the way it went
    stages: [
    { name: 'YESTERDAY', vuln: [SIDE], rec: SIDE, col: CY, bob: 2, attack(g, b, t) { const p = near(g, b), H = b.hist || (b.hist = []); H.push(p.y); if (H.length > 130) H.shift(); if (t === 10) hint(g, 'IT SHOOTS AT WHERE YOU WERE TWO SECONDS AGO - NEVER GO BACK', 230); if (t > 130 && t % 7 === 0 && t % 300 < 230) bullet(g, b.x, H[0], b.z - 2, 0, 0, -9, t % 14 ? CY : '#ffffff'); } },
    { name: 'TOMORROW', vuln: [ISO, CHASE], rec: CHASE, col: GR, sway: 3.2, attack(g, b, t) { const p = near(g, b); if (t === 10) hint(g, 'THE MARKS SHOW WHERE IT IS ABOUT TO BURST', 200); if (t % 110 === 20) { b.marks = [[p.x, p.y], [-6 + g.rand() * 12, 1.5 + g.rand() * 6.5], [-6 + g.rand() * 12, 1.5 + g.rand() * 6.5]]; for (const [x, y] of b.marks) g.warns.push({ x, y, z: 11, t: 72, col: GR }); g.fx.push('charge'); }
        if (t % 110 === 92 && b.marks) { for (const [x, y] of b.marks) for (let i = 0; i < 8; i++) bullet(g, x, y, 12, Math.cos(i * 0.785) * 2.1, Math.sin(i * 0.785) * 2.1, -3.6, i % 2 ? GR : YL); b.marks = null; g.fx.push('boom'); } } },
    { name: 'NOW', vuln: [CHASE], rec: CHASE, col: PK, attack(g, b, t) { const c = t % 300; if (t % 5 === 0 && (c < 170 || c > 235)) { const a = t * 0.09; bullet(g, b.x, b.y, b.z - 2, Math.cos(a) * 2.3, Math.sin(a) * 2.3, -4, t % 10 ? W : PK); }
        if (c === 170) { hint(g, 'TIME STOPS...', 60); g.fx.push('charge'); for (const q of g.ebul) if (q.life > 0 && !q.sv) { q.sv = [q.vx, q.vy, q.vz]; q.vx = q.vy = q.vz = 0; q.life += 70; } } if (c === 236) { hint(g, '...AND STARTS AGAIN!', 60); g.fx.push('zap'); for (const q of g.ebul) if (q.sv) { q.vx = q.sv[0] * 1.5; q.vy = q.sv[1] * 1.5; q.vz = q.sv[2] * 1.5; q.sv = null; } } } }] }); // every shot on the screen hangs still, then all of them go at once
  K.fill(echo, 440, 620, 60, 'crate', 'tank');
  return K.done({ name: 'THE WORMHOLE', title: 'THE THROAT', boss: B, tick, theme: { sky: 'worm', grid: '#5a2a9a', nofloor: true, trippy: true },
    rules: { wind: g => g.camZ > 850 && g.camZ < 1002 && !g.boss ? [Math.cos(g.tick * 0.02) * 1.3, Math.sin(g.tick * 0.02) * 0.9] : [0, 0] } });
}

// =====================================================================================
// ARENAS — after each boss, before the jump: a walled arena in that planet's colours. Free flight, guns track
// the nearest target, clear five waves. L / R flips between TOP and ISO: white "phase" enemies only exist in ISO.
// =====================================================================================
// ---------- minibosses: one closes every bonus arena and every warp stage ----------
// a miniboss is an ordinary enemy carrying its own little brain (e.ai), run once a tick by the level
const power = g => 0.5 + 0.25 * g.players[0].up.slice(1, 6).reduce((a, b) => a + b, 0); // minibosses are as tough as your guns are strong
const runMini = g => { const e = g.mini; if (!e) return; { const k = power(g); if (e.pk && Math.abs(k - e.pk) > 1e-3 && e.hp > 0) { e.hp *= k / e.pk; e.hpMax = Math.round(e.hpMax * k / e.pk); e.max = e.hpMax; } e.pk = k; } if (e.hp > 0) { e.mt = (e.mt || 0) + 1; e.ai(g, e, e.mt); } else if (!e.fin) { e.fin = true; g.score += 5000; g.shake = 14; g.flash = 12; g.fx.push('boom2', 'say:miniboss destroyed', 'toast:' + e.name + ' DESTROYED|+5000'); for (let i = 0; i < 3; i++) addPod(g, e.x + (i - 1) * 2, e.y, e.z + (i - 1)); for (let i = 0; i < 4; i++) explode(g, e.x + (g.rand() - 0.5) * 3, e.y + (g.rand() - 0.5) * 2, e.z, i % 2 ? '#ffffff' : e.col, 30, 13); g.ebul.length = 0; } };
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
function stageMini(K, id, z) { const M = STAGE_MINI[id], spawn = g => { g.mini = addEnemy(g, { type: 'pop', mini: true, name: M.name, ai: M.ai, x: 0, x0: 0, y: 4.8, y0: 4.8, ax: 3, ay: 1.6, w: 0.6, z: 36, vz: -4, hp: Math.round(M.hp * 4 * power(g)), hpMax: Math.round(M.hp * 4 * power(g)), r: M.r, col: M.col, shape: M.shape, score: 0, big: true, hold: 27 }); hint(g, 'MINIBOSS // ' + M.name, 200); g.fx.push('charge', 'say:miniboss'); }; spawn.mini = true; K.at(z, spawn); return g => { const e = g.mini; if (e && e.hp > 0 && e.z <= 27) { e.vz = 0; } runMini(g); }; } // minibosses hold well up the lane, so there is room to back off and dodge
const ARENAS = {
  earth: { name: 'GRID ZERO', title: 'NEO TERRA ARENA', theme: { sky: 'city', grid: '#2443c8' }, col: '#2ee6ff',
    grunt: { col: '#ff3df0', sp: 4.2, hp: 2 }, fast: { col: '#ff4d6d', sp: 6.2, hp: 1, shape: 'kami' }, gun: { col: '#3dffb0', hp: 6, shape: 'saucer', fire: 120, fan: 3 }, champ: { col: '#ffe14a', shape: 'carrier', name: 'GRID WARDEN' },
    hazard(g) { for (let i = 0; i < 2; i++) addObs(g, { rel: true, kind: 'car', x: -9 + i * 10, y: 4.5, z: 9 + i * 16, hx: 1.3, hy: 0.45, hz: 0.7, vx: i % 2 ? 3.6 : -3.6, wrap: 14.5, col: '#ff8a2b' }); } },
  mars: { name: 'THE CRUCIBLE', title: 'FORGE ARENA', theme: { sky: 'volcano', grid: '#8a2a12' }, col: '#ff5a1f',
    grunt: { col: '#ff8a2b', sp: 4, hp: 2, shape: 'ember' }, fast: { col: '#ffe14a', sp: 6, hp: 1, shape: 'ember' }, gun: { col: '#d98a5a', hp: 8, shape: 'head', fire: 130, fan: 2, r: 0.95 }, champ: { col: '#d98a5a', shape: 'head', name: 'STONE ELDER' },
    hazard(g) { [[-7, 8], [7, 26], [0, 17]].forEach(([x, z], i) => addObs(g, { rel: true, kind: 'geyser', x, y: 4.75, z, hx: 1.05, hy: 4.75, hz: 1.05, col: '#ff5a1f', pulse: [70, 110, i * 45] })); } },
  jupiter: { name: 'EYE OF THE STORM', title: 'STORM ARENA', theme: { sky: 'cloud', grid: '#1e7a5a' }, col: '#7df9ff',
    grunt: { col: '#7df9ff', sp: 4.6, hp: 2, shape: 'spark', wob: 5 }, fast: { col: '#ffffff', sp: 6.8, hp: 1, shape: 'spark', wob: 8 }, gun: { col: '#b06bff', hp: 6, shape: 'jelly', burst: 8, fire: 150 }, champ: { col: '#b06bff', shape: 'jelly', name: 'THUNDER BLOOM' },
    hazard(g) { [11, 24].forEach((z, i) => addObs(g, { rel: true, kind: 'bolt', x: 0, y: 4.5, z, hx: 13, hy: 0.4, hz: 0.45, col: '#7df9ff', pulse: [55, 125, i * 60] })); } },
  x: { name: 'THE HEART', title: 'BLOOM ARENA', theme: { sky: 'bio', grid: '#6a1e8a', trippy: true, splat: true }, col: '#3dffb0',
    grunt: { col: '#b6ff3d', sp: 3.6, hp: 1, shape: 'spore', r: 0.42, wob: 4 }, fast: { col: '#ff3df0', sp: 5.8, hp: 1, shape: 'spore', r: 0.42, wob: 7 }, gun: { col: '#ff3df0', hp: 8, shape: 'spitter', fire: 125, fan: 4, bcol: '#b6ff3d', bs: 7 }, champ: { col: '#ff3df0', shape: 'spitter', name: 'BROOD MOTHER' },
    hazard(g) { [[-7, 9], [6, 25]].forEach(([x, z], i) => addObs(g, { rel: true, kind: 'tentacle', x, y: 4.75, z, hx: 0.75, hy: 4.75, hz: 0.75, col: '#3dffb0', osc: { ax: 1.6, ay: 0, w: 1.2, ph: i * 2 } })); } } };
// each wave: [grunts, fast, gunners, phase grunts]; wave 5 adds the champion
const WAVES = [[8, 0, 0, 0], [8, 5, 1, 0], [7, 4, 2, 5], [9, 5, 2, 6], [8, 7, 3, 6]]; // sized for about a minute per arena
function arena(of) {
  const T = ARENAS[of], K = kit('arena-' + of); K.zone(-99, 1e9, TOP, 'BONUS ARENA // ' + T.name);
  const edge = g => { const a = g.rand() * 6.283, x = Math.cos(a) * 18, z = 17 + Math.sin(a) * 22; return [Math.max(-13.5, Math.min(13.5, x)), Math.max(-0.5, Math.min(34.5, z))]; };
  const spawn = (g, spec, extra) => { const [x, z] = edge(g); return addEnemy(g, { type: 'seek', x, y: 4.5, z, r: 0.6, score: 100, ph: g.rand() * 6, ...spec, ...extra }); };
  const tick = g => {
    const A = g.ar || (g.ar = { wave: g.mut.rush ? WAVES.length : 0, total: WAVES.length, t: 40, left: 0, name: T.name, q: [] }), alive = g.enemies.filter(e => e.hp > 0);
    A.left = alive.length + A.q.length; const ph = alive.filter(e => e.phase === 1).length; g.recView = ph > alive.length - ph ? 1 : 3;
    if (A.q.length) { if (g.tick % 30 === 0) for (let i = 0; i < 2 && A.q.length; i++) { const [spec, extra] = A.q.shift(); spawn(g, spec, extra); } return; } // enemies pour in from the edges a few at a time
    runMini(g); if (alive.length) { A.t = 0; return; }
    if (++A.t < 75) return; A.t = 0;
    if (A.wave >= WAVES.length && !A.mini) { A.mini = true; const M = ARENA_MINI[of]; g.mini = addEnemy(g, { type: 'seek', sp: 0, keep: 1e6, mini: true, name: M.name, ai: M.ai, x: 0, y: 4.5, z: 30, hp: Math.round(M.hp * 1.5 * power(g)), hpMax: Math.round(M.hp * 1.5 * power(g)), r: M.r, col: M.col, shape: M.shape, score: 0, big: true }); hint(g, 'MINIBOSS // ' + M.name, 200); g.fx.push('charge', 'say:miniboss'); g.obs.length = 0; return; }
    if (A.wave >= WAVES.length) { g.state = 'clear'; g.endT = 0; if (!g.mut.rush) { g.score += 15000; g.fx.push('clear', 'say:arena clear', 'toast:ALL WAVES CLEARED|+15000'); } return; }
    const w = WAVES[A.wave++], hpx = 1 + A.wave * 0.25; if (A.wave === 3) hint(g, 'WHITE ONES ONLY SHOW IN ISO - SHIFT TO ISO', 150); else info(g, A.wave === WAVES.length ? 'final wave' : 'wave ' + A.wave); g.fx.push('charge'); if (A.wave === 1) T.hazard(g);
    const add = (n, spec, extra) => { for (let i = 0; i < n; i++) A.q.push([spec, { ...extra, hp: Math.round((extra.hp || spec.hp) * hpx) }]); };
    add(w[0], T.grunt, { hp: T.grunt.hp * 4, score: 15 }); add(w[1], T.fast, { hp: T.fast.hp * 5, score: 25 }); add(w[3], T.grunt, { col: '#ffffff', phase: 1, hp: T.grunt.hp * 4, score: 30 });
    for (let i = 0; i < w[2]; i++) A.q.push([T.gun, { sp: 2, keep: 7, hp: Math.round(T.gun.hp * 4 * hpx), score: 80, r: T.gun.r || 0.9, pod: i === 0 && A.wave % 2 === 0 }]);
    for (let i = A.q.length - 1; i > 0; i--) { const j = g.rand() * (i + 1) | 0; [A.q[i], A.q[j]] = [A.q[j], A.q[i]]; }

  };
  return K.done({ name: T.name, title: T.title, bonus: true, arena: true, tick, rules: { arena: true }, theme: { ...T.theme, arena: T.col } });
}

export const LEVELS = {
  earth: { build: earth, n: 1, name: 'EARTH', sub: 'NEO TERRA', next: 'sun', boss: 'OVERSEER', info: 'CYBER CITY. SKYSCRAPERS, SKYWAYS, FIREWALL GATES.' },
  moon: { build: moon, n: 0, shelved: true, name: 'THE MOON', sub: 'SEA OF QUIET', next: 'sun', boss: 'THE SENTINEL', info: 'LOW GRAVITY. A DEAD BASE, THE MASS DRIVER, METEORS.', kit: [1, 1, 0, 0, 0, 0, 0, 0] },
  sun: { build: sun, n: 2, name: 'THE SUN', sub: 'CORONA', next: 'mars', boss: 'HELIOS', info: 'A SLINGSHOT ROUND THE SUN. STAY IN THE CLEAR CHANNEL.', kit: [1, 1, 1, 0, 0, 1, 0, 0] },
  mars: { build: mars, n: 3, name: 'MARS', sub: 'THE FORGE', next: 'belt', boss: 'THE COLOSSUS', info: 'LAVA GEYSERS, FIRE ARCS, ALIEN STONE HEADS.', kit: [2, 1, 1, 1, 0, 1, 0, 0] },
  belt: { build: asteroids, n: 4, name: 'ASTEROID BELT', sub: 'THE RUBBLE', next: 'jupiter', boss: 'THE MOTHER ROCK', info: 'ROCK STORMS, A MINING COLONY, MAGNETIC LODESTONES.', kit: [2, 2, 1, 1, 0, 1, 0, 0] },
  jupiter: { build: jupiter, n: 5, name: 'JUPITER', sub: 'STORM DECK', next: 'saturn', boss: 'THE EYE', info: 'LIGHTNING CHAINS, STORM WALLS, HIDDEN WRAITHS.', kit: [2, 2, 1, 1, 1, 1, 0, 0] },
  saturn: { build: saturn, n: 6, name: 'SATURN', sub: 'THE RINGS', next: 'pluto', boss: 'THE PRISM', info: 'LASER GRIDS IN THE RINGS. AND SOMETHING ENORMOUS.', kit: [2, 2, 2, 1, 1, 2, 0, 0] },
  pluto: { build: pluto, n: 7, name: 'PLUTO', sub: 'THE COLD EDGE', next: 'worm', boss: 'FROST WARDEN', info: 'ICE SHELVES, SNOW COMETS, BLACK ICE, A BLIZZARD.', kit: [3, 2, 2, 2, 1, 2, 0, 0] },
  worm: { build: wormhole, n: 8, name: 'THE WORMHOLE', sub: 'THE THROAT', next: 'x', boss: 'THE PARADOX', info: 'EVERY WORLD FOLDED TOGETHER. THE RULES KEEP CHANGING.', kit: [3, 2, 2, 2, 2, 2, 0, 0] },
  x: { build: planetx, n: 9, name: 'PLANET X', sub: 'THE BLOOM', next: null, boss: 'THE SHIFTER', info: 'THE SOURCE OF THE SHIFT. EVERYTHING IS ALIVE.', kit: [3, 2, 2, 2, 2, 2, 0, 0] } };
for (const id of ['earth', 'mars', 'jupiter', 'x']) LEVELS['arena-' + id] = { build: () => arena(id), name: ARENAS[id].name, sub: ARENAS[id].title, isBonus: true, isArena: true, of: id, info: 'FIVE WAVES AND A MINIBOSS. GUNS FIRE THE WAY YOU FACE. L / R FLIPS TOP AND ISO.', kit: LEVELS[id].kit ? LEVELS[id].kit.map(v => Math.min(5, v + 1)) : [1, 1, 1, 0, 0, 1, 0, 0] };
// the bonus arenas and their warps are switched off for the jam build (kept in the code; flip this to bring them back)
export const ARENAS_ON = false;
// SHELVED content: built and playable from PRACTICE, but not part of the jam build's route. The Moon is shelved; so are the arenas while ARENAS_ON is false
export const shelved = id => !!LEVELS[id]?.shelved || (!ARENAS_ON && !!LEVELS[id]?.isArena);
export const ORDER = ['earth', 'sun', 'mars', 'belt', 'jupiter', 'saturn', 'pluto', 'worm', 'x'];
export const buildLevel = id => LEVELS[id].build();
