// LEVEL 1 — EARTH // NEO TERRA. A neon cyber-city. Each stretch is built so one view is the way through.
import { addEnemy, addObs, addRing, addPod, bullet, aimed, explode, pop, hint, SPAWN_Z, DT } from './game.js';
const SIDE = 0, ISO = 1, CHASE = 2, TOP = 3;
const C = { tower: '#2ee6ff', sky: '#ff3df0', gate: '#ffe14a', car: '#ff8a2b', pylon: '#b06bff', pop: '#ff3df0', saucer: '#3dffb0', kami: '#ff4d6d', turret: '#ffe14a', carrier: '#ff8a2b' };

export function buildEarth() {
  const ev = [], zones = [], checkpoints = [];
  const at = (z, fn) => ev.push({ z: z - SPAWN_Z, fn });
  const obs = (z, o) => at(z, g => addObs(g, { ...o, z: z - g.camZ }));
  const ring = (z, r) => at(z, g => addRing(g, { ...r, z: z - g.camZ }));
  let gid = 0;
  // n fighters in a line, weaving. Kill the whole wing and it drops an upgrade pod.
  const wing = (z, n, o) => { const id = 'w' + (++gid); for (let i = 0; i < n; i++) at(z + i * 2.2, g => addEnemy(g, { type: 'pop', group: id, col: C.pop, hp: 2, ph: i * 0.5, ...o })); };
  const carrier = (z, o) => at(z, g => addEnemy(g, { type: 'pop', pod: true, col: C.carrier, hp: 6, r: 0.8, score: 300, vz: -6, shape: 'carrier', ...o }));
  const saucer = (z, o) => at(z, g => addEnemy(g, { type: 'saucer', col: C.saucer, hp: 7, r: 0.9, score: 400, hold: 15, dur: 420, ax: 4, ay: 1, fire: 95, shape: 'saucer', ...o }));
  const kami = (z, o) => at(z, g => addEnemy(g, { type: 'kami', col: C.kami, hp: 2, r: 0.55, score: 150, vz: -13, shape: 'kami', ...o }));
  const turret = (z, x, o) => at(z, g => addEnemy(g, { type: 'turret', rel: false, z: z - g.camZ, x, y: 0.5, x0: x, y0: 0.5, col: C.turret, hp: 4, r: 0.7, score: 200, fire: 100, shape: 'turret', ph: (x + 9) * 0.37, ...o }));
  const tower = (z, x, h, o) => obs(z, { x, y: h / 2, hx: 1.3, hy: h / 2, hz: 1.3, col: C.tower, kind: 'tower', ...o });
  const slab = (z, low, o) => obs(z, low ? { x: 0, y: 2.1, hx: 8.6, hy: 2.1, hz: 1.2, col: C.sky, kind: 'slab', ...o } : { x: 0, y: 6.95, hx: 8.6, hy: 2.55, hz: 1.2, col: C.sky, kind: 'slab', ...o });
  // a wall with one hole in it
  const gate = (z, hx, hy, o = {}) => { const w = 2.1, h = 1.8, col = C.gate, hz = 0.5, k = { hz, col, kind: 'gate', ...o };
    obs(z, { x: (-8.6 + hx - w) / 2, y: 4.75, hx: (hx - w + 8.6) / 2, hy: 4.75, ...k }); obs(z, { x: (8.6 + hx + w) / 2, y: 4.75, hx: (8.6 - hx - w) / 2, hy: 4.75, ...k });
    obs(z, { x: hx, y: (9.5 + hy + h) / 2, hx: w, hy: (9.5 - hy - h) / 2, ...k }); obs(z, { x: hx, y: (hy - h) / 2, hx: w, hy: (hy - h) / 2, ...k });
    if (!o.noRing) ring(z, { x: hx, y: hy, r: 1.5 }); };
  const car = (z, x, y, vx) => obs(z, { x, y, hx: 1.3, hy: 0.45, hz: 0.7, vx, wrap: 11, col: C.car, kind: 'car' });

  // ---- 0–110: launch. SIDE view, learn to shoot and stay above the rooftops ----
  zones.push({ z0: -99, z1: 110, view: SIDE, msg: 'SECTOR 1 // NEO TERRA' });
  at(16, g => hint(g, 'L / R  SHIFT VIEW', 220));
  for (let z = 26; z < 108; z += 9) tower(z, ((z * 7) % 13) - 6, 1.4 + (z % 4) * 0.45);
  wing(34, 5, { y: 6.5, ay: 1.6, x: 0 }); wing(56, 5, { y: 4.2, ay: 1.4, x: -2 }); carrier(70, { y: 6, x: 2 }); wing(84, 6, { y: 7, ay: 1.5, x: 3 }); wing(98, 4, { y: 4.5, ay: 2.2, x: -3 });

  // ---- 110–335: SKYLINE. Full-height skyscrapers: no way through in SIDE, weave them in TOP ----
  zones.push({ z0: 110, z1: 335, view: TOP, msg: 'SKYSCRAPERS - SHIFT TO TOP VIEW' });
  for (let i = 0, z = 142; z < 322; z += 15, i++) {
    const xs = i % 2 ? [-3.2, 3.2] : [-6.4, 0, 6.4]; for (const x of xs) tower(z, x, 9.5);
    if (i % 2) { obs(z, { x: -8.1, y: 4.75, hx: 0.5, hy: 4.75, hz: 1.3, col: C.tower, kind: 'tower' }); obs(z, { x: 8.1, y: 4.75, hx: 0.5, hy: 4.75, hz: 1.3, col: C.tower, kind: 'tower' }); }
    if (i % 3 === 1) turret(z + 7, i % 2 ? 0 : 3.2); if (i % 3 === 2) turret(z + 7, -3.2);
  }
  wing(160, 5, { x: 0, ax: 4, y: 5 }); saucer(190, { x: 0, y: 6 }); wing(225, 6, { x: -2, ax: 5, y: 3 }); carrier(250, { x: 3.2, y: 5, ax: 0 }); wing(275, 5, { x: 2, ax: 4, y: 6 }); saucer(300, { x: 0, y: 5 });
  checkpoints.push(338);

  // ---- 335–565: SKYWAYS. Full-width decks high and low: solid in TOP, slalom them in SIDE ----
  zones.push({ z0: 335, z1: 565, view: SIDE, msg: 'SKYWAYS AHEAD - SHIFT TO SIDE VIEW' });
  for (let i = 0, z = 368; z < 550; z += 17, i++) { slab(z, i % 2 === 0); if (i % 3 === 2) slab(z + 6, i % 2 === 0); }
  wing(380, 4, { y: 5.6, ay: 0.6, x: 0 }); wing(415, 5, { y: 3, ay: 0.8, x: 2 }); carrier(440, { y: 5, x: -2 }); kami(470, { x: 0, y: 5 }); kami(476, { x: 0, y: 3 }); wing(500, 6, { y: 5, ay: 1.8, x: 0 }); carrier(530, { y: 4.6, x: 1 });
  checkpoints.push(568);

  // ---- 565–800: FIREWALL GATES. Walls with one hole: only CHASE (or ISO) shows where it is ----
  zones.push({ z0: 565, z1: 800, view: CHASE, msg: 'FIREWALL GATES - SHIFT TO CHASE VIEW' });
  const holes = [[0, 4.5], [3.5, 6], [-3.5, 3.2], [3, 3], [-3, 6.4], [0, 5], [4.5, 4.4], [-4.5, 5.2], [0, 3.2]];
  holes.forEach(([x, y], i) => { const z = 600 + i * 22; gate(z, x, y); if (i % 2) { kami(z + 11, { x: x * 0.5, y }); } else if (i % 4 === 2) carrier(z + 11, { x: holes[i + 1][0], y: holes[i + 1][1], ax: 0, vz: -5 }); });
  wing(585, 4, { x: 0, y: 4.5, ax: 2, ay: 1 });
  checkpoints.push(804);

  // ---- 800–1010: GRIDLOCK. Cross traffic, pylons and decks at once: you need real depth. The Moon warp hides here ----
  zones.push({ z0: 800, z1: 1010, view: ISO, msg: 'HOVER TRAFFIC - SHIFT TO ISO VIEW' });
  for (let i = 0, z = 836; z < 1000; z += 9, i++) { const y = [2.4, 5, 7.4][i % 3], d = i % 2 ? 4.5 : -4.5; car(z, -8 + (i * 5) % 16, y, d); car(z, 2 - (i * 3) % 10, y, d); if (i % 4 === 1) obs(z + 4.5, { x: ((i * 5) % 11) - 5, y: 4.75, hx: 0.7, hy: 4.75, hz: 0.7, col: C.pylon, kind: 'pylon' }); if (i % 6 === 3) slab(z + 4.5, false, { hz: 0.8 }); }
  at(905, g => hint(g, 'ANOMALY DETECTED ...', 170));
  ring(930, { x: 6.2, y: 8, r: 1.7, kind: 'warp', phase: ISO });
  wing(850, 5, { x: 0, y: 6, ax: 3, ay: 1 }); saucer(880, { x: -2, y: 6.5 }); carrier(915, { x: -4, y: 4 }); wing(950, 6, { x: 2, y: 3.5, ax: 4, ay: 1.5 }); saucer(975, { x: 2, y: 6 });
  checkpoints.push(1014);

  // ---- 1010–1215: LOCKDOWN. All three, back to back ----
  zones.push({ z0: 1010, z1: 1075, view: TOP, msg: 'LOCKDOWN - TOP VIEW!' });
  for (let i = 0, z = 1040; z < 1072; z += 14, i++) { for (const x of i % 2 ? [-3.2, 3.2] : [-6.4, 0, 6.4]) tower(z, x, 9.5); turret(z + 7, i % 2 ? 0 : -3.2); }
  zones.push({ z0: 1075, z1: 1140, view: SIDE, msg: 'SIDE VIEW!' });
  for (let i = 0, z = 1100; z < 1140; z += 14, i++) slab(z, i % 2 === 1);
  zones.push({ z0: 1140, z1: 1215, view: CHASE, msg: 'CHASE VIEW!' });
  [[-3, 5], [3, 3.4], [0, 6]].forEach(([x, y], i) => gate(1166 + i * 18, x, y));
  at(1026, g => addPod(g, 0, 5, SPAWN_Z, 'god'));
  wing(1030, 4, { x: 0, y: 5, ax: 4 }); kami(1110, { x: 0, y: 6 }); kami(1125, { x: 0, y: 3 }); carrier(1150, { x: -3, y: 5, ax: 0 }); carrier(1205, { x: 0, y: 6, ax: 0 });
  checkpoints.push(1218);

  // ---- 1215+: OVERSEER ----
  zones.push({ z0: 1215, z1: 1e9, view: SIDE, msg: 'WARNING // OVERSEER CORE ONLINE' });
  at(1262, g => { g.boss = addEnemy(g, { type: 'boss', name: 'OVERSEER', x: 0, y: 4.6, z: 42, hx: 2.6, hy: 2.8, hz: 1.8, r: 2.6, hp: 650, col: '#ff3df0', score: 20000, big: true, phase: null, stage: 0, vuln: [SIDE], st: 0 }); g.boss.max = 650; g.fx.push('bossin'); });

  ev.sort((a, b) => a.z - b.z);
  return { id: 'earth', name: 'EARTH', title: 'NEO TERRA', events: ev, zones, checkpoints, warpMsg: 'MOON WARP LOCKED IN', boss: { update: overseer, stages: STAGES } };
}

// OVERSEER: the city's defence mainframe. Three shells; each is only open from one angle, and each attack fills the screen in the wrong view.
const STAGES = [
  { name: 'FIREWALL', vuln: [SIDE], rec: SIDE, col: '#ff3df0' },
  { name: 'GRIDLOCK', vuln: [TOP], rec: TOP, col: '#2ee6ff' },
  { name: 'CORE BREACH', vuln: [CHASE, ISO], rec: CHASE, col: '#ffe14a' }];
function overseer(g, b) {
  const S = STAGES[b.stage], p = g.players[0];
  if (b.dying) { b.dying++; if (b.dying % 6 === 0) { explode(g, b.x + (g.rand() - 0.5) * 5, b.y + (g.rand() - 0.5) * 5, b.z + (g.rand() - 0.5) * 3, ['#ff3df0', '#ffe14a', '#2ee6ff', '#ffffff'][b.dying / 6 & 3], 26, 14); g.fx.push('boom2'); g.shake = 12; }
    if (b.dying > 150) { explode(g, b.x, b.y, b.z, '#ffffff', 90, 26); g.flash = 20; g.shake = 22; b.gone = true; g.boss = null; g.score += b.score; g.state = 'clear'; g.endT = 0; g.fx.push('clear', 'say:sector clear. earth is safe. for now.', 'toast:LEVEL COMPLETE|EARTH DEFENDED'); } return; }
  if (b.z > 19) { b.z -= 6 * DT; b.st = 0; g.recView = S.rec; return; }
  g.recView = S.rec; b.vuln = S.vuln; b.col = S.col; b.st++;
  b.x = Math.sin(b.st * 0.011) * (b.stage === 1 ? 4 : 1.5); b.y = 4.6 + Math.sin(b.st * 0.017) * (b.stage === 0 ? 2 : 0.8);
  if (b.hp <= 0) {
    if (b.stage < 2) { b.stage++; b.hp = b.max; b.st = -90; g.obs.length = 0; g.ebul.length = 0; explode(g, b.x, b.y, b.z, S.col, 60, 18); g.shake = 14; g.flash = 8; g.fx.push('boom2'); addPod(g, b.x - 1, b.y, b.z - 2); addPod(g, b.x + 1, b.y, b.z - 3); g.score += 5000; hint(g, 'SHELL DOWN - SHIFT TO ' + ['SIDE', 'ISO', 'CHASE', 'TOP'][STAGES[b.stage].rec] + ' VIEW', 200); }
    else { b.dying = 1; g.obs.length = 0; g.ebul.length = 0; hint(g, 'OVERSEER OFFLINE', 200); } return; }
  if (b.st < 0) return;
  const t = b.st, beamCol = '#ff4d6d';
  if (b.stage === 0) { // sheets of fire at fixed altitudes: nowhere to go in TOP
    if (t % 150 === 30) { const gap = 1.6 + g.rand() * 5.4; addObs(g, { rel: true, x: 0, y: (gap - 1.5) / 2, z: 9, hx: 9, hy: Math.max(0.05, (gap - 1.5) / 2), hz: 11, warm: 62, life: 40, col: beamCol, kind: 'sheet' }); addObs(g, { rel: true, x: 0, y: (9.6 + gap + 1.5) / 2, z: 9, hx: 9, hy: (9.6 - gap - 1.5) / 2, hz: 11, warm: 62, life: 40, col: beamCol, kind: 'sheet' }); g.fx.push('charge'); }
    if (t % 75 === 60) { aimed(g, b, 10, -0.18); aimed(g, b, 10, 0); aimed(g, b, 10, 0.18); g.fx.push('eshot'); }
  } else if (b.stage === 1) { // vertical curtains: nowhere to go in SIDE
    if (t % 140 === 30) { const gx = -5.5 + g.rand() * 11; addObs(g, { rel: true, x: (-9 + gx - 1.6) / 2, y: 4.8, z: 9, hx: (gx - 1.6 + 9) / 2, hy: 5, hz: 11, warm: 62, life: 40, col: beamCol, kind: 'sheet' }); addObs(g, { rel: true, x: (9 + gx + 1.6) / 2, y: 4.8, z: 9, hx: (9 - gx - 1.6) / 2, hy: 5, hz: 11, warm: 62, life: 40, col: beamCol, kind: 'sheet' }); g.fx.push('charge'); }
    if (t % 200 === 120) for (let i = 0; i < 4; i++) addEnemy(g, { type: 'pop', x: -5 + i * 3.3, y: 4.6, z: b.z - 1, vz: -7, ax: 1.5, hp: 2, col: '#ff3df0', ph: i });
    if (t % 90 === 70) for (let i = -2; i <= 2; i++) bullet(g, b.x, 4.6, b.z - 2, i * 2.6, 0, -9);
  } else { // gates thrown down the lane: only a depth view shows the hole
    if (t % 120 === 20) { const hx = -4 + g.rand() * 8, hy = 2.8 + g.rand() * 3.8, w = 2.2, h = 1.9, k = { rel: true, z: b.z - 2, hz: 0.45, vz: -11, col: '#ffe14a', kind: 'gate' };
      addObs(g, { ...k, x: (-9 + hx - w) / 2, y: 4.8, hx: (hx - w + 9) / 2, hy: 5 }); addObs(g, { ...k, x: (9 + hx + w) / 2, y: 4.8, hx: (9 - hx - w) / 2, hy: 5 }); addObs(g, { ...k, x: hx, y: (9.8 + hy + h) / 2, hx: w, hy: (9.8 - hy - h) / 2 }); addObs(g, { ...k, x: hx, y: (hy - h) / 2, hx: w, hy: (hy - h) / 2 }); g.fx.push('charge'); }
    if (t % 14 === 0 && t % 240 > 150) { const a = t * 0.09; bullet(g, b.x, b.y, b.z - 2, Math.cos(a) * 4, Math.sin(a) * 4, -9, '#ff3df0'); }
    if (t % 240 === 100) { addEnemy(g, { type: 'kami', x: -5, y: 6, z: b.z, vz: -11, hp: 2, r: 0.55, col: '#ff4d6d', shape: 'kami', score: 150 }); addEnemy(g, { type: 'kami', x: 5, y: 3, z: b.z, vz: -11, hp: 2, r: 0.55, col: '#ff4d6d', shape: 'kami', score: 150 }); }
  }
  if (b.deflect === 5 && g.tick % 90 < 8) pop(g, 'SHIELDED - SHIFT TO ' + ['SIDE', 'ISO', 'CHASE', 'TOP'][S.rec], p.x, p.y + 1.5, p.z + 3, '#ff4d6d');
}
