// 2DISO SHIFT — front end: input (keyboard, controller, touch), intro, menus, HUD, audio hooks, saves, level flow.
// mountShift(root, host) works standalone (index.html) and inside a host site that passes { hosted, onExit, submitScore, leaderboard }.
// (C) 2026 GRiDDiM / ArcadeGridz / BDC
import { createGame, step, autopilot, snapshot, makeWing, VIEWS, BAR, GEARS, INTRO } from './game.js';
import { LEVELS, ORDER, buildLevel } from './levels.js';
import { W, H, drawWorld, drawHUD, drawLogo, drawSplash, meshScreen, text, textWidth, SHIP_HULL, SHIP_WING, SHIP_FIN, RAINBOW, VCOL } from './render.js';
import { createAudio } from './audio.js';
import { DEVLOG, CREDITS } from './devlog.js';

const CSS = `.ds-shell{position:relative;width:100%;height:100%;min-height:0;background:#02010a;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
.ds-stage{position:absolute;top:0;left:0;width:960px;height:540px;transform-origin:0 0;background:#02010a;overflow:hidden}
.ds-stage canvas{display:block;width:960px;height:540px;outline:none;touch-action:none}
.ds-touch{position:absolute;inset:0;pointer-events:none}.ds-touch[hidden]{display:none}
.ds-touch b{position:absolute;display:grid;place-items:center;border-radius:50%;border:2px solid currentColor;background:rgba(6,8,30,.45);font:700 11px/1 "Bahnschrift","Segoe UI",Arial,sans-serif;letter-spacing:.08em;pointer-events:auto;touch-action:none;box-shadow:0 0 12px currentColor inset,0 0 10px currentColor;opacity:.8}
.ds-touch b.on{background:currentColor;opacity:1}.ds-touch b.on span{color:#02010a}
.ds-stick{position:absolute;left:0;top:70px;width:46%;bottom:44px;pointer-events:auto;touch-action:none}
.ds-nub{position:absolute;width:96px;height:96px;margin:-48px 0 0 -48px;border-radius:50%;border:2px solid #2ee6ff;box-shadow:0 0 14px #2ee6ff;opacity:.55;pointer-events:none}.ds-nub i{position:absolute;left:50%;top:50%;width:40px;height:40px;margin:-20px;border-radius:50%;background:#2ee6ff;opacity:.8}
.ds-rotate{position:absolute;inset:0;z-index:5;display:grid;place-content:center;gap:14px;text-align:center;background:#02010a;color:#2ee6ff;font:700 18px/1.3 "Bahnschrift","Segoe UI",Arial,sans-serif;letter-spacing:.12em}.ds-rotate[hidden]{display:none}
.ds-rotate button{justify-self:center;padding:10px 18px;border:2px solid #ff3df0;background:none;color:#ff3df0;font:inherit;font-size:13px;border-radius:8px}`;

const LS = { get(k, d) { try { const v = localStorage.getItem('2dshift.' + k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('2dshift.' + k, JSON.stringify(v)); } catch { } }, del(k) { try { localStorage.removeItem('2dshift.' + k); } catch { } } };
// best-run ghosts: the sim is deterministic, so a run is just its seed, its starting loadout and the inputs
const VER = 'r27';
const enc = i => ((i.fire ? 1 : 0) | (i.gear ? 2 : 0) | (i.bomb ? 4 : 0) | (i.drone ? 8 : 0) | (i.shiftL ? 16 : 0) | (i.shiftR ? 32 : 0) | (i.upgrade ? 64 : 0)) * 81 + (Math.round(Math.max(-1, Math.min(1, i.mx)) * 4) + 4) * 9 + Math.round(Math.max(-1, Math.min(1, i.my)) * 4) + 4;
const dec = c => { const b = c / 81 | 0, r = c % 81; return { fire: !!(b & 1), gear: !!(b & 2), bomb: !!(b & 4), drone: !!(b & 8), shiftL: !!(b & 16), shiftR: !!(b & 32), upgrade: !!(b & 64), mx: ((r / 9 | 0) - 4) / 4, my: (r % 9 - 4) / 4 }; };
const MEDALS = [['CLEAR', () => true], ['NO SHIPS LOST', g => g.stats.deaths === 0], ['UNTOUCHED', g => g.stats.hits === 0], ['WARP FOUND', g => g.flags.warp], ['CHAIN 50', g => g.bestChain >= 50], ['3 PERFECT SHIFTS', g => g.stats.perfect >= 3], ['FAST CLEAR', (g, id) => PAR[id] && g.stats.ticks / 60 <= PAR[id]]];
const PAR = { earth: 290, mars: 185, jupiter: 200, x: 230 }, mmss = s => (s / 60 | 0) + ':' + String(s % 60 | 0).padStart(2, '0'); // par times: slow speed all the way will not make them
const RANK = ['-', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'], bits = m => { let n = 0; for (let k = 0; k < 7; k++) if (m >> k & 1) n++; return n; };
const MUSIC = { earth: 'play', mars: 'mars', jupiter: 'jupiter', x: 'x' };
// the daily run: one seed for everybody, plus one helpful and one hurtful twist picked from the date
function dailyInfo() { const d = new Date(), key = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); let a = key >>> 0; const r = () => { a = Math.imul(a ^ a >>> 15, 2246822507) + 0x9E3779B9 >>> 0; return a / 4294967296; }; r();
  const HELP = [['ARSENAL', 'EVERY WEAPON STARTS AT LEVEL 1', { up: [0, 1, 1, 1, 1, 1, 0, 0] }], ['DRONE SQUAD', 'START WITH 3 DRONES', { up: [3, 0, 0, 0, 0, 0, 0, 0] }], ['BOMBER', 'START WITH 9 BOMBS', { bombs: 9 }]], HURT = [['TURBO', 'EVERYTHING SCROLLS 25 PERCENT FASTER', {}, { turbo: true }], ['GLASS HULL', 'NO STARTING SHIELD', { shield: 0 }], ['TWO SHIPS', 'ONE SPARE SHIP ONLY', { lives: 1 }]];
  const h = HELP[r() * 3 | 0], x = HURT[r() * 3 | 0]; return { key, label: String(key).slice(4, 6) + '.' + String(key).slice(6), help: h, hurt: x, start: { ...h[2], ...x[2] }, mut: x[3] || {}, n: 0 }; }
const ACH = [['shift', 'FIRST SHIFT', 'ROLL INTO ANOTHER VIEW'], ['perfect', 'PERFECT SHIFT', 'DODGE SOMETHING WITH A LAST-MOMENT SHIFT'], ['perfect3', 'SHIFT ARTIST', '3 PERFECT SHIFTS ON ONE PLANET'], ['order', 'BY THE NUMBERS', 'DESTROY A WHOLE WAVE IN TARGET ORDER'],
  ['chain50', 'CHAIN 50', 'REACH A KILL CHAIN OF 50'], ['chain100', 'CHAIN 100', 'REACH A KILL CHAIN OF 100'], ['earth', 'EARTH HOLDS', 'DEFEAT THE OVERSEER'], ['mars', 'MARS COOLS', 'DEFEAT THE COLOSSUS'], ['jupiter', 'THE STORM BLINKS', 'DEFEAT THE EYE'], ['x', 'END THE SHIFT', 'DEFEAT THE SHIFTER'],
  ['end', 'EVERY SIDE OF IT', 'SEE THE ENDING'], ['solo', 'SOLO PILOT', 'FINISH THE GAME WITH NO ASSISTS'], ['loop', 'AROUND AGAIN', 'START A SECOND LOOP'], ['warp', 'HIDDEN DOOR', 'FIND A WARP'], ['warp4', 'CARTOGRAPHER', 'FIND ALL FOUR WARPS'], ['bonus', 'STAGE DIVER', 'BEAT A WARP STAGE MINIBOSS'],
  ['arena', 'CROWD CONTROL', 'CLEAR EVERY WAVE AND THE MINIBOSS IN AN ARENA'], ['arena4', 'ARENA MASTER', 'CLEAR ALL FOUR ARENAS'], ['untouched', 'UNTOUCHED', 'CLEAR A PLANET WITHOUT TAKING A HIT'], ['nodeath', 'NO SHIPS LOST', 'CLEAR A PLANET WITHOUT LOSING A SHIP'], ['fast', 'UNDER PAR', 'CLEAR A PLANET UNDER ITS PAR TIME'],
  ['ranks', 'S RANK', 'EARN RANK S OR BETTER ON A PLANET'], ['sss', 'TRIPLE S', 'EARN RANK SSS ON A PLANET'], ['arsenal', 'FULL ARSENAL', 'MAX EVERY WEAPON AT ONCE'], ['drones', 'SIX PACK', 'FLY WITH SIX DRONES'], ['god', 'GOD MODE', 'ROLL GOD MODE ON THE WILDCARD'],
  ['score1', 'HIGH ROLLER', 'SCORE 250000 IN ONE RUN'], ['score2', 'MILLIONAIRE', 'SCORE 1000000 IN ONE RUN'], ['kills', 'EXTERMINATOR', 'DESTROY 1000 ENEMIES IN TOTAL'], ['coop', 'WINGMATES', 'CLEAR A PLANET IN CO-OP']];
const TAU = Math.PI * 2, COPY = '(C) 2026 GRIDDIM / ARCADEGRIDZ / BDC';
// solar map: four planets along the route, each with its hidden bonus stage above it
const NODES = [{ id: 'earth', x: 300, r: 13, col: '#2ee6ff' }, { id: 'moon', x: 334, r: 5, col: '#c8d0e0', up: 1 }, { id: 'mars', x: 430, r: 10, col: '#ff4d6d' }, { id: 'sun', x: 90, r: 30, col: '#ffe14a', up: 2 }, { id: 'jupiter', x: 620, r: 24, col: '#ff8a2b' }, { id: 'belt', x: 520, r: 6, col: '#c8a070', up: 1 }, { id: 'x', x: 860, r: 15, col: '#3dffb0' }, { id: 'pluto', x: 780, r: 5, col: '#9fe9ff', up: 1 }];

export function mountShift(root, host = {}) {
  if (!document.getElementById('ds-css')) { const st = document.createElement('style'); st.id = 'ds-css'; st.textContent = CSS; document.head.appendChild(st); }
  root.innerHTML = `<section class="ds-shell"><div class="ds-stage"><canvas tabindex="0" aria-label="2DISO SHIFT"></canvas>
<div class="ds-touch" hidden><div class="ds-stick"></div><div class="ds-nub" hidden><i></i></div>
<b data-b="shiftL" style="right:96px;bottom:216px;width:70px;height:70px;color:#2ee6ff"><span>◀ L</span></b><b data-b="shiftR" style="right:14px;bottom:216px;width:70px;height:70px;color:#ff3df0"><span>R ▶</span></b>
<b data-b="drone" style="right:100px;bottom:140px;width:62px;height:62px;color:#b06bff"><span>DRONE</span></b><b data-b="bomb" style="right:18px;bottom:140px;width:62px;height:62px;color:#ff8a2b"><span>BOMB</span></b>
<b data-b="gear" style="right:40px;bottom:50px;width:80px;height:80px;color:#ffe14a"><span>SPEED</span></b>
<b data-b="upgrade" style="left:50%;margin-left:-70px;bottom:44px;width:140px;height:34px;border-radius:10px;color:#ffe14a"><span>UPGRADE</span></b>
<b data-b="pause" style="right:12px;top:96px;width:40px;height:40px;color:#9fb0ff"><span>II</span></b></div></div>
<div class="ds-rotate" hidden><div>TURN YOUR SCREEN SIDEWAYS</div><button type="button">PLAY ANYWAY</button></div></section>`;
  const shell = root.querySelector('.ds-shell'), stage = root.querySelector('.ds-stage'), canvas = root.querySelector('canvas'), ctx = canvas.getContext('2d'), touchEl = root.querySelector('.ds-touch'), stickEl = root.querySelector('.ds-stick'), nubEl = root.querySelector('.ds-nub'), rotEl = root.querySelector('.ds-rotate');
  const coarse = !!window.matchMedia?.('(pointer: coarse)').matches;
  const opt = Object.assign({ music: 0.7, sfx: 0.8, glow: coarse ? 'low' : 'high', shake: true, idle: false, autofire: coarse, gear: 0, voice: true, fill: true, assist: false, ghost: true, crt: false }, LS.get('opt', {})); const saveOpt = () => LS.set('opt', opt);
  const audio = createAudio(opt);
  let q = 0, slow = 0, ema = 16; // q: automatic quality step-down when frames run long (0 full, 1 no outer halo + lower res, 2 no glow)
  let destroyed = false, raf = 0, last = performance.now(), acc = 0, scale = 1, res = 1, rotOk = false;
  let scene = 'intro', sceneT = 0, g = null, attract = null, assisted = false, testRun = false, submitted = false, focusPaused = false, lastDev = coarse ? 'touch' : 'kb', titleT = 0, endInfo = null, levelId = 'earth', returnTo = null, warpT = 0, coop = false, daily = null, rec = null, ghost = null, fxC = null, crtPat = null; const mouse = { x: 0, y: 0, t: -1e9, down: false };
  const menus = []; let hits = []; const toasts = []; let story = null, hiShown = false, loopN = 0, endCarry = null, cred = null, achGot = LS.get('ach', {});
  // achievements: kept on this device. Idle mode never unlocks them.
  function award(id) { if (opt.idle || achGot[id]) return; achGot = LS.get('ach', {}); if (achGot[id]) return; achGot[id] = 1; LS.set('ach', achGot); const d = ACH.find(a => a[0] === id); if (!d) return; toast('ACHIEVEMENT', d[1]); audio.sfx('ring'); }
  function achTick() { const p = g.players[0], s = g.stats; if (s.shifts) award('shift'); if (s.perfect) award('perfect'); if (s.order) award('order'); if (g.bestChain >= 50) award('chain50'); if (g.bestChain >= 100) award('chain100'); if (g.flags.warp) award('warp'); if (p.god > 0) award('god'); if (p.up[0] >= 6) award('drones'); if ([1, 2, 3, 4, 5].every(k => p.up[k] >= 3)) award('arsenal'); if (g.score >= 250000) award('score1'); if (g.score >= 1000000) award('score2'); }
  function achEnd(cleared, m) { const L = LEVELS[levelId]; if (opt.idle) return; const kills = LS.get('kills', 0) + g.stats.kills; LS.set('kills', kills); if (kills >= 1000) award('kills'); if (Object.keys(LS.get('warps', {})).length >= 4) award('warp4'); if (!cleared) return;
    if (L.isArena) { award('arena'); const a = LS.get('arenas', {}); a[L.of] = 1; LS.set('arenas', a); if (Object.keys(a).length >= 4) award('arena4'); return; } if (L.isBonus) { award('bonus'); return; }
    award(levelId); if (g.stats.hits === 0) award('untouched'); if (g.stats.deaths === 0) award('nodeath'); if (m >> 6 & 1) award('fast'); if (m >> 5 & 1) award('perfect3'); if (bits(m) >= 5) award('ranks'); if (bits(m) >= 7) award('sss'); if (coop) award('coop'); }
  const toast = (a, b) => { toasts.push({ a, b: b || '', t: 0 }); if (toasts.length > 3) toasts.shift(); };

  // ---------- layout ----------
  function fit() { const r = shell.getBoundingClientRect(); if (!r.width || !r.height) return; scale = Math.min(r.width / W, r.height / H); stage.style.transform = `translate(${(r.width - W * scale) / 2}px,${(r.height - H * scale) / 2}px) scale(${scale})`;
    const want = Math.min(opt.glow === 'low' ? 1.25 : [2, 1.5, 1.25][q], Math.max(1, scale * (window.devicePixelRatio || 1))); if (Math.abs(want - res) > 0.05 || canvas.width !== Math.round(W * want)) { res = want; canvas.width = Math.round(W * res); canvas.height = Math.round(H * res); }
    rotEl.hidden = !(lastDev === 'touch' && r.height > r.width * 1.1 && !rotOk); }
  rotEl.querySelector('button').onclick = () => { rotOk = true; fit(); };
  const ro = new ResizeObserver(fit); ro.observe(shell); addEventListener('resize', fit);

  // ---------- input ----------
  const keys = new Set(), pad = new Set(), tb = new Set(), latK = new Set(), latP = new Set(); // lat*: taps shorter than a frame still count once
  let stick = null, tap = null, prevM = {};
  const typing = e => { const a = e.target; return a && a !== canvas && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
  const GAMEKEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Enter', 'Escape', 'ShiftLeft', 'ShiftRight', 'Backspace', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyF', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'KeyQ', 'KeyE', 'KeyR', 'KeyP', 'KeyM']);
  function onKey(e) { if (destroyed || typing(e) || e.ctrlKey || e.metaKey || e.altKey || window.ArcadeGridzSystemMenu?.isOpen?.()) return; if (!GAMEKEYS.has(e.code)) return;
    const set = e.isTrusted === false ? pad : keys; if (e.type === 'keydown') { set.add(e.code); (e.isTrusted === false ? latP : latK).add(e.code); lastDev = e.isTrusted === false ? 'pad' : 'kb'; audio.unlock(); } else set.delete(e.code); e.preventDefault(); if (e.type === 'keydown') e.stopPropagation(); }
  addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true);
  function readInput() { const all = readSrc(true, true, null);
    if (coop) { let n = 0; for (const p of navigator.getGamepads?.() || []) if (p && p.connected) n++; const two = !window.ArcadeGridzPad && n >= 2; all.p1 = two ? readSrc(true, true, 0) : readSrc(true, false, null); all.p2 = two ? readSrc(false, true, 1) : readSrc(false, true, null); }
    latK.clear(); latP.clear(); return all; }
  function readSrc(K, Pd, which) { // K: keyboard + touch, Pd: controllers (which = only that controller)
    const k = c => K && (keys.has(c) || latK.has(c)), s = c => Pd && (pad.has(c) || latP.has(c)); const i = { mx: 0, my: 0 };
    let L = k('ArrowLeft') || k('KeyA') || s('ArrowLeft'), R = k('ArrowRight') || k('KeyD') || s('ArrowRight'), U = k('ArrowUp') || k('KeyW') || s('ArrowUp'), D = k('ArrowDown') || k('KeyS') || s('ArrowDown');
    i.fire = k('Space') || k('KeyZ') || k('KeyJ') || s('Escape'); i.gear = k('KeyV') || k('KeyF') || k('KeyH') || s('Space'); i.bomb = k('KeyX') || k('KeyK') || s('KeyZ'); i.drone = k('KeyC') || k('KeyL') || s('KeyX');
    i.shiftL = k('ShiftLeft') || k('KeyQ') || s('ShiftLeft'); i.shiftR = k('ShiftRight') || k('KeyE') || s('KeyE'); i.upgrade = k('Enter') || k('KeyR') || s('KeyM'); i.pause = k('Escape') || k('KeyP') || s('KeyP');
    i.ok = k('Enter') || k('Space') || k('KeyZ') || s('Escape'); i.back = k('Escape') || k('Backspace') || s('Space'); i.start = s('KeyP');
    let ax = 0, ay = 0, gi = 0;
    for (const p of navigator.getGamepads?.() || []) { if (!p || !p.connected) continue; const idx = gi++; if (!Pd || (which != null && which !== idx)) continue; if (Math.hypot(p.axes[2] || 0, p.axes[3] || 0) > 0.4) i.aim = [p.axes[2], -p.axes[3]]; if (window.ArcadeGridzPad) continue; const b = n => !!p.buttons[n]?.pressed; if (p.buttons.some(x => x.pressed)) { lastDev = 'pad'; audio.unlock(); }
      L ||= b(14); R ||= b(15); U ||= b(12); D ||= b(13); if (Math.abs(p.axes[0]) > 0.25) ax = p.axes[0]; if (Math.abs(p.axes[1]) > 0.25) ay = p.axes[1];
      i.fire ||= b(1); i.gear ||= b(0); i.bomb ||= b(2); i.drone ||= b(3); i.shiftL ||= b(4) || b(6); i.shiftR ||= b(5) || b(7); i.upgrade ||= b(8); i.pause ||= b(9); i.ok ||= b(1); i.back ||= b(0); i.start ||= b(9); }
    i.mx = (R ? 1 : 0) - (L ? 1 : 0) || ax; i.my = (D ? 1 : 0) - (U ? 1 : 0) || ay;
    if (K && stick) { const dx = stick.x - stick.ox, dy = stick.y - stick.oy, d = Math.hypot(dx, dy); if (d > 6) { const m = Math.min(1, d / 44); i.mx = dx / d * m; i.my = dy / d * m; } }
    if (K) for (const b of tb) i[b] = true;
    if (opt.autofire) i.fire = true;
    i.left = i.mx < -0.5; i.right = i.mx > 0.5; i.up = i.my < -0.5; i.down = i.my > 0.5;
    return i;
  }
  const sPt = e => { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }; };
  stickEl.addEventListener('pointerdown', e => { lastDev = 'touch'; audio.unlock(); const p = sPt(e); stick = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y }; stickEl.setPointerCapture(e.pointerId); nubEl.hidden = false; nubEl.style.left = p.x + 'px'; nubEl.style.top = p.y + 'px'; e.preventDefault(); });
  stickEl.addEventListener('pointermove', e => { if (!stick || e.pointerId !== stick.id) return; const p = sPt(e); stick.x = p.x; stick.y = p.y; const dx = p.x - stick.ox, dy = p.y - stick.oy, d = Math.hypot(dx, dy) || 1, m = Math.min(28, d); nubEl.firstChild.style.transform = `translate(${dx / d * m}px,${dy / d * m}px)`; });
  const stickUp = e => { if (stick && e.pointerId === stick.id) { stick = null; nubEl.hidden = true; nubEl.firstChild.style.transform = ''; } }; stickEl.addEventListener('pointerup', stickUp); stickEl.addEventListener('pointercancel', stickUp);
  for (const b of touchEl.querySelectorAll('b')) { const n = b.dataset.b; const dn = e => { lastDev = 'touch'; audio.unlock(); tb.add(n); b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch { } e.preventDefault(); }, up = () => { tb.delete(n); b.classList.remove('on'); }; b.addEventListener('pointerdown', dn); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); }
  canvas.addEventListener('pointerdown', e => { audio.unlock(); if (e.pointerType === 'touch') lastDev = 'touch'; else mouse.down = true; tap = sPt(e); canvas.focus({ preventScroll: true }); });
  canvas.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; const p = sPt(e); mouse.x = p.x; mouse.y = p.y; mouse.t = performance.now(); });
  const mUp = () => { mouse.down = false; }; addEventListener('pointerup', mUp);
  canvas.addEventListener('wheel', e => { const m = top(); if (m?.kind === 'scroll') { m.off = Math.max(0, m.off + e.deltaY * 0.5); e.preventDefault(); } }, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // ---------- menus ----------
  const top = () => menus[menus.length - 1], HELD = { ok: true, back: true, up: true, down: true, left: true, right: true, pause: true, start: true };
  const upF = { ok: 0, back: 0, pause: 0, start: 0 }, lock = () => { upF.ok = upF.back = upF.pause = upF.start = 0; }; // a button must be let go for a moment before it can press a menu item again
  function push(m) { m.i = m.i || 0; menus.push(m); prevM = { ...HELD }; lock(); return m; }
  function popMenu() { const m = menus.pop(); audio.sfx('back'); prevM = { ...HELD }; lock(); return m; }
  const onoff = v => v ? 'ON' : 'OFF';
  const scrollMenu = (title, lines) => push({ title, kind: 'scroll', lines, off: 0, items: [{ label: 'BACK', act: popMenu }] });
  function optionsMenu() { push({ title: 'OPTIONS', gap: 25, items: [
    { label: () => 'MUSIC  ' + Math.round(opt.music * 10), adj: d => { opt.music = Math.max(0, Math.min(1, opt.music + d * 0.1)); audio.vol(); saveOpt(); } },
    { label: () => 'SOUND  ' + Math.round(opt.sfx * 10), adj: d => { opt.sfx = Math.max(0, Math.min(1, opt.sfx + d * 0.1)); audio.vol(); saveOpt(); audio.sfx('blip'); } },
    { label: () => 'ANNOUNCER  ' + onoff(opt.voice), adj: () => { opt.voice = !opt.voice; saveOpt(); if (opt.voice) audio.say('announcer on', true); else audio.hush(); } },
    { label: () => 'GLOW  ' + opt.glow.toUpperCase(), adj: () => { opt.glow = opt.glow === 'high' ? 'low' : 'high'; saveOpt(); fit(); } },
    { label: () => 'SOLID OBSTACLES  ' + onoff(opt.fill), adj: () => { opt.fill = !opt.fill; saveOpt(); } },
    { label: () => 'SCREEN SHAKE  ' + onoff(opt.shake), adj: () => { opt.shake = !opt.shake; saveOpt(); } },
    { label: () => 'AUTO SHOOT  ' + onoff(opt.autofire), adj: () => { opt.autofire = !opt.autofire; saveOpt(); } },
    { label: () => 'START SPEED  ' + GEARS[opt.gear], adj: d => { opt.gear = (opt.gear + (d < 0 ? GEARS.length - 1 : 1)) % GEARS.length; saveOpt(); } },
    { label: () => 'IDLE MODE  ' + onoff(opt.idle), adj: () => setIdle(!opt.idle) },
    { label: () => 'RIVET-9 ASSIST  ' + onoff(opt.assist), adj: () => setAssist(!opt.assist) },
    { label: () => 'BEST RUN GHOST  ' + onoff(opt.ghost), adj: () => { opt.ghost = !opt.ghost; saveOpt(); if (!opt.ghost) ghost = null; } },
    { label: () => 'CRT FILTER  ' + onoff(opt.crt), adj: () => { opt.crt = !opt.crt; saveOpt(); } },
    { label: 'CONTROLS', act: () => push({ title: 'CONTROLS', kind: 'controls', items: [{ label: 'BACK', act: popMenu }] }) },
    { label: 'CREDITS', act: () => scrollMenu('CREDITS', CREDITS) },
    { label: 'BACK', act: popMenu }] }); }
  function setIdle(v) { opt.idle = v; saveOpt(); if (v) { assisted = true; rec = null; } }
  // RIVET-9 flies as your wingman and rolls into the right view before you do. Runs with him are tagged ASSISTED.
  function setAssist(v) { opt.assist = v; saveOpt(); rec = null; ghost = null; if (v) assisted = true; if (g && scene === 'play' && !coop) g.wing = v ? makeWing(g.view) : null; }
  function mapMenu(after, at) { const m = push({ title: 'SOLAR MAP', kind: 'map', sel: Math.max(0, NODES.findIndex(n => n.id === (at || levelId))), after, items: after ? [{ label: 'CONTINUE', act: () => { popMenu(); after(); } }] : [{ label: 'PLAY THIS LEVEL (TEST)', act: () => { const id = NODES[m.sel].id, L = LEVELS[id]; testRun = true; returnTo = null; startLevel(id, { up: L.kit || undefined }); } }, { label: 'PLAY ITS ARENA (TEST)', act: () => { let id = NODES[m.sel].id; if (LEVELS[id].isBonus) id = LEVELS[id].of; testRun = true; returnTo = null; startLevel('arena-' + id, { up: LEVELS['arena-' + id].kit }); } }, { label: 'BACK', act: popMenu }] }); return m; }
  function scoresMenu() { const m = { title: 'HIGH SCORES', kind: 'scores', rows: LS.get('scores', []), items: [{ label: 'BACK', act: popMenu }] }; push(m); if (host.leaderboard) { m.rows = null; Promise.resolve(host.leaderboard()).then(r => { m.rows = Array.isArray(r) ? r : []; }).catch(() => { m.rows = LS.get('scores', []); }); } }
  // the map before every hop: the ship flies from where you are to where you are going, then hyperspace
  function travel(from, to, after) { menus.length = 0; const m = mapMenu(after, to); m.locked = true; m.travel = { from, to, t0: performance.now() }; audio.sfx('whoosh'); return m; }
  function titleMenu() { menus.length = 0;
    const play = () => { const items = [], sv = LS.get('save', null);
      if (sv && LEVELS[sv.level]) items.push({ label: 'CONTINUE  ' + LEVELS[sv.level].name + (sv.loop ? '  LOOP ' + (sv.loop + 1) : ''), act: () => { testRun = false; returnTo = null; coop = false; daily = null; assisted = true; loopN = sv.loop || 0; startLevel(sv.level, sv); } });
      items.push({ label: 'NEW GAME', act: () => { testRun = false; returnTo = null; coop = false; daily = null; assisted = !!opt.idle || !!opt.assist; loopN = 0; startStory(STORY, () => startLevel('earth', null)); } },
        { label: 'CO-OP', act: () => { testRun = false; returnTo = null; coop = true; daily = null; assisted = true; loopN = 0; startStory(STORY, () => { startLevel('earth', null); toast('CO-OP', 'P1 KEYBOARD   P2 CONTROLLER'); }); } },
        { label: 'BACK', act: popMenu }); push({ title: 'PLAY', items }); };
    const items = [{ label: 'PLAY', act: play }, { label: 'OPTIONS', act: optionsMenu }, { label: 'HIGH SCORES', act: scoresMenu }, { label: 'ACHIEVEMENTS', act: () => push({ title: 'ACHIEVEMENTS', kind: 'ach', items: [{ label: 'BACK', act: popMenu }] }) }, { label: 'DEVLOG', act: () => scrollMenu('DEVLOG', DEVLOG) }];
    if (host.onExit) items.push({ label: 'EXIT GAME', act: () => host.onExit() }); push({ kind: 'title', root: true, items }); }
  function pauseMenu() { if (scene !== 'play' || menus.length || !g || g.state !== 'play') return; audio.sfx('blip'); audio.hush(); audio.music('title'); push({ title: 'PAUSED', pause: true, items: [
    { label: 'RESUME', act: resume }, { label: 'MAP', act: () => mapMenu() }, { label: 'OPTIONS', act: optionsMenu }, { label: () => 'IDLE MODE  ' + onoff(opt.idle), act: () => setIdle(!opt.idle), adj: () => setIdle(!opt.idle) }, ...(coop ? [] : [{ label: () => 'RIVET-9 ASSIST  ' + onoff(opt.assist), act: () => setAssist(!opt.assist), adj: () => setAssist(!opt.assist) }]),
    { label: daily ? 'QUIT RUN' : 'SAVE AND QUIT', act: () => { if (!testRun && !daily) LS.set('save', returnTo ? { ...returnTo, loop: loopN } : { ...snapshot(g), loop: loopN, z: g.boss ? g.checkpoint : Math.max(g.checkpoint, Math.floor(g.camZ - 4)) }); showTitle(); } }] }); } // saves the exact spot (or the pre-boss checkpoint during a boss)
  const track = () => { const L = LEVELS[levelId]; return g?.boss ? 'boss' : L.isArena ? 'arena' : L.isBonus ? 'bonus' : MUSIC[levelId] || 'play'; };
  function resume() { menus.length = 0; audio.music(track()); prevIn = { pause: true, fire: true, upgrade: true, bomb: true, drone: true, shiftL: true, shiftR: true, gear: true }; last = performance.now(); acc = 0; }
  function menuInput(i) {
    const m = top(), was = { ...upF }; for (const k in upF) upF[k] = i[k] ? 0 : Math.min(99, upF[k] + 1);
    const e = k => i[k] && !prevM[k] && (was[k] == null || was[k] >= 5); if (!m) return;
    if (tap) { for (const h of hits) if (tap.x >= h.x && tap.x <= h.x + h.w && tap.y >= h.y && tap.y <= h.y + h.h) { if (h.fn) h.fn(tap); else { m.i = h.i; const it = m.items[h.i]; audio.sfx('ok'); if (it.act) it.act(); else it.adj?.(1); } break; } tap = null; prevM = i; return; }
    if (m.travel && !m.travel.done && performance.now() - m.travel.t0 > 3000) { m.travel.done = true; m.items[0].act(); return; }
    if (m.kind === 'map' && !m.locked) { const n = NODES.length; if (e('left')) { m.sel = (m.sel + n - 1) % n; audio.sfx('move'); } if (e('right')) { m.sel = (m.sel + 1) % n; audio.sfx('move'); } }
    if (m.kind === 'scroll') { if (i.up) m.off = Math.max(0, m.off - 6); if (i.down) m.off += 6; }
    else { if (e('up')) { m.i = (m.i + m.items.length - 1) % m.items.length; audio.sfx('move'); } if (e('down')) { m.i = (m.i + 1) % m.items.length; audio.sfx('move'); } }
    const it = m.items[m.i];
    if (it.adj && (e('left') || e('right'))) { it.adj(e('left') ? -1 : 1); audio.sfx('move'); }
    else if (e('ok')) { audio.sfx('ok'); if (it.act) it.act(); else it.adj?.(1); }
    else if (m.pause && (e('pause') || e('start'))) resume();
    else if (e('back') && !m.root && !m.locked) { if (m.pause) resume(); else popMenu(); }
    prevM = i;
  }

  // ---------- story ----------
  const STORY = ['THE COSMIC SHIFT HAS BEGUN.', 'A RIFT FROM PLANET X IS FOLDING REALITY,', 'ONE WORLD AT A TIME.', "EARTH'S OWN DEFENCE GRID HAS TURNED ON ITS CITIES.", 'ONE SHIP CAN SEE ALL FOUR FACES OF THE FOLD.', 'YOURS.', 'SHIFT WITH IT. OR BE FLATTENED.'];
  const BRIEF = { mars: ['EARTH HOLDS.', 'BUT THE SHIFT ROLLS ON.', 'MARS IS FOLDING. ITS FORGES ARE AWAKE,', 'AND THE STONE HEADS HAVE OPENED THEIR EYES.'], jupiter: ['MARS IS COOLING.', 'THE RIFT HAS REACHED JUPITER.', 'THE STORM HAS AN EYE NOW.', 'AND IT IS LOOKING AT YOU.'], x: ['THE STORM IS QUIET.', 'ONE WORLD LEFT. THE ONE THAT STARTED IT.', 'PLANET X IS NOT A PLACE. IT IS ALIVE.', 'END THE SHIFT.'] };
  const ENDING = ['THE SHIFTER FOLDS IN ON ITSELF.', 'FOUR FACES. THEN TWO. THEN ONE. THEN NOTHING.', 'THE RIFT CLOSES BEHIND YOU LIKE A WOUND.', "JUPITER'S STORM GOES BACK TO BEING ONLY A STORM.", 'THE FORGES OF MARS GO DARK. THE STONE HEADS CLOSE THEIR EYES.', 'ON EARTH, THE GRID WAKES AND REMEMBERS WHOSE SIDE IT IS ON.', 'NOBODY DOWN THERE WILL KNOW HOW CLOSE THE WORLD CAME TO BEING FLAT.', 'YOU DO. YOU SAW EVERY SIDE OF IT.', 'BUT FAR PAST PLUTO, SOMETHING ROLLS OVER IN ITS SLEEP...'];
  // the ending, then the credit roll, then the choice to loop
  function beginEnding() { finish(true); endCarry = carry({ lives: Math.min(6, Math.max(0, g.players[0].lives) + 1) }); award('end'); if (!assisted && !testRun) award('solo'); if (!testRun && !daily) { if (coop) LS.del('save'); else LS.set('save', { ...endCarry, level: 'earth', z: 0, loop: loopN + 1 }); } startStory(ENDING, startCredits, true); }
  function startCredits() { story = null; menus.length = 0; scene = 'credits'; sceneT = 0; prevM = { ...HELD }; audio.music('play');
    const cast = [['h3', 'THE FOLD'], ['p', 'OVERSEER'], ['p', 'THE COLOSSUS'], ['p', 'THE EYE'], ['p', 'THE SHIFTER'], '', ['h3', 'ARENA CHAMPIONS'], ['p', 'GRID WARDEN'], ['p', 'STONE ELDER'], ['p', 'THUNDER BLOOM'], ['p', 'BROOD MOTHER'], '', ['h3', 'BEHIND THE WARPS'], ['p', 'LUNAR SENTINEL'], ['p', 'SOLAR FLARE'], ['p', 'THE MOTHER ROCK'], ['p', 'FROST WARDEN'], '', ['h3', 'YOUR WINGMAN'], ['p', 'RIVET-9'], '', ['h3', 'YOUR RUN'], ['p', 'FINAL SCORE  ' + (endCarry?.score || 0)], ['p', 'LOOP ' + (loopN + 1) + ' COMPLETE'], '', ''];
    const lines = [...CREDITS.slice(0, -2), '', ...cast, ...CREDITS.slice(-2), '', '', '', ['h2', 'THANK YOU FOR PLAYING']]; let h = 0; for (const ln of lines) h += ln ? CST[ln[0]][2] : 16; cred = { lines, y: 0, max: h + 250, hold: 0 }; host.onState?.({ scene }); }
  const CST = { h1: [30, '#2ee6ff', 60], h2: [18, '#ffe14a', 40], h3: [9, '#ff3df0', 24], q: [9, '#3dffb0', 24], p: [12, '#ffffff', 26] };
  function creditsMenu() { if (menus.length) return; push({ title: 'THE END', root: true, notes: ['FINAL SCORE  ' + (endCarry?.score || 0), 'LOOPING KEEPS EVERY UPGRADE AND YOUR SCORE', ['', '-LOOP 2 IS MUCH HARDER', '-LOOP 3 IS BRUTAL', '-LOOP 4 IS NEARLY IMPOSSIBLE', '-PAST LOOP 4 IT ONLY GETS WORSE'][Math.min(4, loopN + 1)]], items: [{ label: 'LOOP THE GAME  (LOOP ' + (loopN + 2) + ')', act: startLoop }, { label: 'BACK TO TITLE', act: showTitle }] }); }
  function startLoop() { const c = { ...endCarry }; loopN++; award('loop'); if (testRun) assisted = true; testRun = false; returnTo = null; daily = null; cred = null;
    startStory(['SOMETHING PAST PLUTO ROLLED OVER.', 'THE FOLD IS BACK, AND IT REMEMBERS YOU.', 'SAME SHIP. SAME GUNS. LOOP ' + (loopN + 1) + '.', ['', 'IT HITS HARDER NOW.', 'IT WANTS YOU GONE.', 'NOBODY COMES BACK FROM THIS ONE.'][Math.min(3, loopN)]], () => { scene = 'play'; travel('x', 'earth', () => { startLevel('earth', c); toast('LOOP ' + (loopN + 1), 'UPGRADES AND SCORE CARRIED OVER'); }); }); }
  function drawCredits() { const t = performance.now() / 1000; ctx.fillStyle = '#02010a'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#8fa8ff'; for (let k = 0; k < 110; k++) { ctx.globalAlpha = 0.15 + (k % 5) * 0.1; const sp = 6 + (k % 4) * 9; ctx.fillRect(((k * 131 - t * sp) % W + W) % W, (k * 71 + t * sp * 0.35) % H, 1.5 + (k % 7 === 0), 1.5 + (k % 7 === 0)); } ctx.globalAlpha = 1;
    orb(130, 420, 46, '#2ee6ff', 0.5, t); orb(840, 110, 20, '#ff4d6d', 0.4, t);
    // the ship and RIVET-9 swoop through in wide figure-eights, near and far
    const SH = [[0.55, 0, 1.3, 78, ['#ffffff', '#2ee6ff', '#ff3df0']], [0.55, -0.42, 1.3, 46, ['#ffe14a', '#3dffb0', '#ffe14a']], [0.38, 2.4, 0.4, 30, ['#b06bff', '#ff8a2b', '#b06bff']]];
    for (const [sp, o, o2, size, cols] of SH) { const at = ph => [480 + Math.sin(ph) * 430, 270 + Math.sin(ph * 2 + o2) * 150, 0.5 + 0.5 * Math.cos(ph + 0.6)], ph = t * sp + o, [x, y, d] = at(ph), b = at(ph + 0.02), a2 = at(ph + 0.12), vx = b[0] - x, vy = b[1] - y, ang = Math.atan2(vy, vx), turn = Math.atan2(a2[1] - b[1], a2[0] - b[0]) - ang, s = size * (0.3 + d * 0.9);
      ctx.strokeStyle = cols[1]; ctx.lineWidth = Math.max(1, s * 0.03); for (let k = 0; k < 16; k++) { const p0 = at(ph - k * 0.035), p1 = at(ph - (k + 1) * 0.035); ctx.globalAlpha = 0.5 * (1 - k / 16); ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); } ctx.globalAlpha = 1;
      const roll = Math.max(-1.1, Math.min(1.1, Math.sin(turn) * 9)); ctx.save(); ctx.translate(x, y); ctx.rotate(ang + Math.PI / 2); meshScreen(ctx, SHIP_HULL, 0, 0, s, 0, -1.05, roll, cols[0]); meshScreen(ctx, SHIP_WING, 0, 0, s, 0, -1.05, roll, cols[1]); meshScreen(ctx, SHIP_FIN, 0, 0, s, 0, -1.05, roll, cols[2]); ctx.restore(); }
    ctx.globalCompositeOperation = 'source-over'; let y = H + 10 - cred.y;
    for (const ln of cred.lines) { if (!ln) { y += 16; continue; } const s = CST[ln[0]]; if (y > -40 && y < H + 10) { const tw = textWidth(ln[1], s[0]); ctx.fillStyle = 'rgba(2,1,10,.55)'; ctx.fillRect(480 - tw / 2 - 10, y - 4, tw + 20, s[0] + 8); text(ctx, ln[1], 480, y, s[0], s[1], { align: 'center', glow: ln[0][0] === 'h' }); } y += s[2]; }
    for (const [y0, y1] of [[0, 70], [H, H - 70]]) { const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#02010a'); gr.addColorStop(1, 'rgba(2,1,10,0)'); ctx.fillStyle = gr; ctx.fillRect(0, Math.min(y0, y1), W, 70); }
    if (!menus.length) text(ctx, lastDev === 'touch' ? 'TAP TO SKIP AHEAD' : (lastDev === 'pad' ? 'HOLD ' + padNames()[0] : 'HOLD ENTER') + ' TO SPEED UP', 480, 522, 6.5, '#3a4380', { align: 'center', glow: false }); }
  function orb(x, y, r, col, a, t, band) { if (r < 1 || a <= 0) return; ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.globalAlpha = a * 0.5; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.ellipse(x, y, r, r * k / 4, 0, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x, y, r * Math.abs(Math.cos(t * 0.3 + k * 0.8)), r, 0, 0, TAU); ctx.stroke(); } if (band) { ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r * 0.4, -0.2, 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1; }
  function drawEnding(st) { const t = st.t / 60, per = 150, n = st.lines.length, k = Math.min(n - 1, st.t / per | 0), cl = (a, b) => Math.max(0, Math.min(1, (st.t - a * per) / (b * per)));
    ctx.fillStyle = '#02010a'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#8fa8ff'; for (let q = 0; q < 90; q++) { ctx.globalAlpha = 0.2 + (q % 5) * 0.12; ctx.fillRect(((q * 131 + st.t * (0.15 + q % 3 * 0.1)) % W), (q * 71) % 380, 1.5, 1.5); } ctx.globalAlpha = 1;
    // Planet X folds shut: four coloured faces close into one, then nothing but a ring of light
    const c = 1 - cl(0, 2.4), ex = 800, ey = 190; if (c > 0) { const er = 96 * (0.25 + 0.75 * c); orb(ex, ey, er, '#3dffb0', 0.9, t * 3); for (let f = 0; f < 4; f++) { const a = f * TAU / 4 * c + t * 0.8; ctx.strokeStyle = VCOL[f]; ctx.lineWidth = 2; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.ellipse(ex, ey, er * 1.25, er * 1.25 * Math.abs(Math.sin(a)) + 1, f * 0.4 * c, 0, TAU); ctx.stroke(); }
      ctx.strokeStyle = '#ff3df0'; for (let j = 0; j < 3; j++) { ctx.beginPath(); for (let q = 0; q <= 12; q++) { const yy = 30 + q * 28, xx = ex - 150 + j * 14 + Math.sin(q * 1.7 + t * 2 + j) * (10 + q * 1.5) * c + (q % 2 ? 9 : -9) * c; q ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.globalAlpha = (0.9 - j * 0.3) * c; ctx.stroke(); } ctx.globalAlpha = 1; }
    const fl = cl(2.4, 1.2); if (fl > 0 && fl < 1) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.globalAlpha = 1 - fl; ctx.beginPath(); ctx.arc(ex, ey, 20 + fl * 420, 0, TAU); ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.globalAlpha = (1 - fl) * 0.35; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    // the worlds you saved come back one at a time, and the ship heads home
    orb(600, 200, 44, '#ff8a2b', cl(3, 0.5) * 0.9, t, true); orb(400, 205, 22, '#ff4d6d', cl(4, 0.5) * 0.9, t); orb(190, 215, 34, '#2ee6ff', cl(5, 0.5) * 0.95, t); if (cl(5, 0.5) > 0) { ctx.fillStyle = '#ffe14a'; for (let q = 0; q < 14; q++) { ctx.globalAlpha = cl(5.2 + q * 0.05, 0.3) * (0.5 + 0.5 * Math.sin(t * 3 + q)); ctx.fillRect(190 + Math.cos(q * 2.4) * 26 * Math.sin(q * 1.3), 215 + Math.sin(q * 2.4) * 22, 2, 2); } ctx.globalAlpha = 1; }
    const fly = cl(2, 5.6), sx = 760 - fly * 520 * (fly * (2 - fly)) / Math.max(fly, 0.001), sy = 290 - Math.sin(fly * Math.PI) * 40 + Math.sin(t * 2) * 4, ss = 54 - fly * 30; if (fly > 0 && fly < 1) { ctx.strokeStyle = '#2ee6ff'; ctx.lineWidth = 2; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(sx + ss * 0.7, sy); ctx.lineTo(sx + ss * 0.7 + 40 + 14 * Math.sin(t * 30), sy); ctx.stroke(); ctx.globalAlpha = 1; ctx.save(); ctx.translate(sx, sy); ctx.rotate(-Math.PI / 2); const rl = Math.sin(t * 1.4) * 0.5; meshScreen(ctx, SHIP_HULL, 0, 0, ss, 0, -1, rl, '#ffffff'); meshScreen(ctx, SHIP_WING, 0, 0, ss, 0, -1, rl, '#2ee6ff'); meshScreen(ctx, SHIP_FIN, 0, 0, ss, 0, -1, rl, '#ff3df0'); ctx.restore(); }
    const ev = cl(8, 0.6); if (ev > 0) { ctx.strokeStyle = '#b06bff'; ctx.lineWidth = 1.5; ctx.globalAlpha = ev * (0.5 + 0.4 * Math.sin(t * 5)); ctx.beginPath(); ctx.ellipse(900, 70, 16, 7 * Math.min(1, (ev * 2) % 2), 0, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(900, 70, 3, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.globalCompositeOperation = 'source-over'; for (let j = Math.max(0, k - 1); j <= k; j++) { const ln = st.lines[j], age = st.t - j * per, cur = j === k, sz = ln.length > 50 ? 9 : 11; text(ctx, cur ? ln.slice(0, Math.max(0, age * 0.9 | 0)) : ln, 480 - (cur ? textWidth(ln, sz) / 2 : 0), cur ? 440 : 410, cur ? sz : sz - 2, cur ? '#ffffff' : '#5a66b0', { align: cur ? 'left' : 'center', glow: cur }); }
    if (st.t > 90) text(ctx, lastDev === 'touch' ? 'TAP TO SKIP' : lastDev === 'pad' ? padNames()[0] + ' TO SKIP' : 'ENTER TO SKIP', 480, 512, 7, '#3a4380', { align: 'center', glow: false }); }
  function startStory(lines, after, end) { menus.length = 0; story = { lines, after, t: 0, said: -1, end }; scene = 'story'; sceneT = 0; prevM = { ok: true, pause: true, back: true }; audio.music('title'); }
  function drawStory() { const st = story, t = performance.now() / 1000; if (st.end) return drawEnding(st); ctx.fillStyle = '#02010a'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#8fa8ff'; for (let k = 0; k < 80; k++) { ctx.globalAlpha = 0.2 + (k % 5) * 0.12; ctx.fillRect((k * 131 + st.t * (0.2 + k % 3 * 0.15)) % W, (k * 71) % H, 1.5, 1.5); } ctx.globalAlpha = 1;
    const ex = 760, ey = 300, er = 92; ctx.strokeStyle = '#2ee6ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.stroke(); ctx.globalAlpha = 0.5; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.ellipse(ex, ey, er, er * k / 4, 0, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.ellipse(ex, ey, er * Math.abs(Math.cos(t * 0.3 + k * 0.8)), er, 0, 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ff3df0'; ctx.lineWidth = 2; for (let j = 0; j < 3; j++) { ctx.beginPath(); for (let k = 0; k <= 14; k++) { const yy = 60 + k * 30, xx = 600 + j * 14 + Math.sin(k * 1.7 + t * 2 + j) * (10 + k * 1.5) + (k % 2 ? 9 : -9); k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.globalAlpha = 0.9 - j * 0.3; ctx.stroke(); } ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over'; const per = 150, n = Math.min(st.lines.length, 1 + (st.t / per | 0));
    for (let k = 0; k < n; k++) { const age = st.t - k * per, ln = st.lines[k], shown = ln.slice(0, Math.max(0, age * 0.9 | 0)); text(ctx, shown, 70, 110 + k * 44, ln.length > 44 ? 10 : 13, k === n - 1 ? '#ffffff' : '#8d9be0', { glow: k === n - 1 }); }
    text(ctx, lastDev === 'touch' ? 'TAP TO SKIP' : lastDev === 'pad' ? padNames()[0] + ' TO SKIP' : 'ENTER TO SKIP', 480, 512, 7, '#5a66b0', { align: 'center', glow: false }); }

  // ---------- flow ----------
  function showTitle() { scene = 'title'; sceneT = 0; g = null; loopN = 0; cred = null; returnTo = null; coop = false; daily = null; rec = null; ghost = null; attract = createGame({ seed: 7 + (Math.random() * 99 | 0), level: buildLevel(ORDER[Math.random() * 4 | 0]), start: { up: [2, 2, 1, 1, 1, 1, 0, 0] } }); attract.players[0].lives = 99; titleMenu(); audio.music('title'); host.onState?.({ scene }); }
  function startLevel(id, start) { menus.length = 0; story = null; hiShown = false; toasts.length = 0; levelId = id; const L = LEVELS[id];
    const seed = daily ? daily.key * 31 + daily.n++ : (Math.random() * 1e9) | 0, st = { gear: opt.gear, ...(start || {}) }, wing = !!opt.assist && !coop;
    g = createGame({ seed, level: buildLevel(id), start: st, players: coop ? 2 : 1, wing, mut: daily ? daily.mut : { loop: loopN } }); if (testRun || opt.idle || opt.assist || coop) assisted = true; submitted = false; scene = 'play'; sceneT = 0; warpT = 0; endInfo = null;
    rec = null; ghost = null; if (!L.isBonus && !st.z && !opt.idle && !coop && !daily && !loopN) { rec = { v: VER, seed, start: JSON.parse(JSON.stringify(st)), wing, runs: [] }; const gd = opt.ghost && LS.get('ghost.' + id, null); if (gd && gd.v === VER) ghost = { g: createGame({ seed: gd.seed, level: buildLevel(id), start: gd.start, wing: gd.wing }), runs: gd.runs, k: 0, n: 0 }; }
    audio.sfx('whoosh'); audio.music(track()); audio.say((L.isArena ? 'bonus arena. ' : L.isBonus ? 'bonus stage. ' : 'level ' + L.n + '. ') + L.name + '.', true); prevIn = { ...HELD, fire: true, upgrade: true, gear: true }; host.onState?.({ scene }); }
  function carry(extra) { const s = snapshot(g), p = g.players[0]; return { score: g.score, lives: Math.max(0, p.lives), bombs: p.bombs, up: [...p.up], shield: p.shield, cursor: p.cursor, dmode: p.dmode, gear: g.gear, ...extra }; }
  function finish(cleared) { if (!g || submitted || testRun) return; submitted = true; if (daily) { const db = LS.get('daily', null); if (!db || db.key !== daily.key || g.score > db.score) LS.set('daily', { key: daily.key, score: g.score, cleared }); return; } const res = { score: g.score, cleared, assisted, level: LEVELS[levelId].n || LEVELS[LEVELS[levelId].of]?.n || 0, chain: g.bestChain, kills: g.stats.kills, shifts: g.stats.shifts };
    const best = LS.get('best', 0); if (g.score > best) LS.set('best', g.score); const rows = LS.get('scores', []); rows.push({ name: coop ? 'CO-OP' : assisted ? 'ASSIST' : 'YOU', score: g.score, assisted }); rows.sort((a, b) => b.score - a.score); LS.set('scores', rows.slice(0, 8));
    try { host.submitScore?.(res); } catch { } return res; }
  function endMenu(cleared) { const L = LEVELS[levelId]; endInfo = { cleared, t: 0, bonus: !!L.isBonus }; audio.music('title'); let items;
    if (cleared && !L.isBonus) { const secs = g.stats.ticks / 60, par = PAR[levelId] || 0; endInfo.time = secs; endInfo.par = par; endInfo.tb = par ? Math.max(0, Math.round((par * 1.5 - secs) * 20 / 10) * 10) : 0; g.score += endInfo.tb; // the faster the clear, the bigger the bonus
      let m = 0; MEDALS.forEach((d, k) => { if (d[1](g, levelId)) m |= 1 << k; }); endInfo.medals = m;
      if (!opt.idle) { const all = LS.get('medals', {}); if (bits(m) > bits(all[levelId] || 0)) { all[levelId] = m; LS.set('medals', all); endInfo.newRank = true; }
        if (rec && rec.runs.length < 40000) { const gain = g.score - (rec.start.score || 0), old = LS.get('ghost.' + levelId, null); if (!old || old.v !== VER || gain > old.gain) { LS.set('ghost.' + levelId, { ...rec, gain }); endInfo.newGhost = true; } } } }
    achEnd(cleared, endInfo.medals || 0); rec = null; ghost = null;
    const goNext = (from, c) => { const nx = LEVELS[from].next; startStory(BRIEF[nx] || [], () => { scene = 'play'; travel(from, nx, () => startLevel(nx, c)); }); };
    if (L.isArena) items = [{ label: 'CONTINUE', act: () => { if (testRun) showTitle(); else if (!LEVELS[L.of].next) beginEnding(); else goNext(L.of, carry({ lives: Math.min(6, g.players[0].lives + 1) })); } }];
    else if (L.isBonus) { const back = returnTo; items = [{ label: 'CONTINUE', act: () => { if (back) { returnTo = null; const st = { ...back, ...carry({ lives: back.lives, warp: true }), z: back.z }; travel(levelId, back.level, () => startLevel(back.level, st)); } else showTitle(); } }]; }
    else if (cleared) { if (!testRun && !daily) { LS.set('save', { ...carry(), level: g.level.final ? 'arena-' + levelId : L.next, z: 0, loop: loopN }); }
      items = [{ label: 'CONTINUE', act: () => { const nx = L.next; if (testRun) { if (nx) showTitle(); else beginEnding(); return; } startLevel('arena-' + levelId, carry()); } }]; }
    else { finish(false); items = daily ? [{ label: 'QUIT TO TITLE', act: showTitle }] : [{ label: 'RETRY FROM CHECKPOINT', act: () => { assisted = true; startLevel(levelId, { ...g.cpSnap, lives: 3 }); } }, { label: 'QUIT TO TITLE', act: showTitle }]; }
    push({ kind: 'end', root: true, cleared, items }); }

  // ---------- frame ----------
  let prevIn = {};
  function update(i) {
    sceneT++;
    if (scene === 'intro') { if ((i.ok && !prevM.ok) || (i.pause && !prevM.pause) || tap || sceneT > 600) { tap = null; showTitle(); titleT = 0; audio.sfx('slam'); } if (sceneT === 330) audio.sfx('whoosh'); prevM = i; return; }
    if (scene === 'story') { const st = story; st.t++; const k = st.t / 150 | 0; if (k < st.lines.length && k !== st.said) { st.said = k; audio.say(st.lines[k].replace('(C)', 'copyright'), true); } if (st.end && st.t < 90) tap = null; if (tap || (st.t >= (st.end ? 90 : 0) && ((i.ok && !prevM.ok) || (i.pause && !prevM.pause))) || st.t > st.lines.length * 150 + 120) { tap = null; audio.hush(); const f = st.after; story = null; f(); } prevM = i; return; }
    if (scene === 'title') { titleT++; step(attract, [autopilot(attract)]); if (attract.state !== 'play' || attract.camZ > 700) { attract = createGame({ seed: sceneT, level: buildLevel(ORDER[sceneT % 4]), start: { up: [2, 2, 1, 1, 1, 1, 0, 0] } }); attract.players[0].lives = 99; } menuInput(i); return; }
    if (scene === 'credits') { if (menus.length) { menuInput(i); return; } cred.y = Math.min(cred.max, cred.y + (i.ok || i.down ? 3 : 0.5)); if (tap) { tap = null; cred.y = Math.min(cred.max, cred.y + 160); }
      if ((cred.y >= cred.max && ++cred.hold > 100) || (sceneT > 40 && ((i.pause && !prevM.pause) || (i.back && !prevM.back)))) creditsMenu(); prevM = i; return; }
    if (menus.length) { if (top().kind === 'end' && endInfo) { endInfo.t++; step(g, [{}]); } menuInput(i); return; }
    if (i.pause && !prevIn.pause) { pauseMenu(); prevIn = i; return; }
    let ins; if (opt.idle) { assisted = true; rec = null; ins = g.players.map((_, k) => autopilot(g, k)); } else if (coop) ins = [i.p1 || i, i.p2 || {}];
    else { let a = i; if (g.level.rules?.arena && !i.aim && lastDev === 'kb' && performance.now() - mouse.t < 5000) { const p = g.players[0]; let wx, wz; const ux = 480 + (mouse.x - 480) / 0.52, uy = 285 + (mouse.y - 285) / 0.52; /* undo the arena zoom */ if (g.view === 3) { wx = (ux - 480) / 40; wz = (480 - uy) / 19; } else { wx = (uy - 319 + 11 / 26 * (ux - 150)) / 15.923; wz = (ux - 150 - 14 * wx) / 26; } i.aim = [wx - p.x, wz - p.z]; if (mouse.down) i.fire = true; }
      if (rec) { const c = enc(i), r = rec.runs, n = r.length; if (n && r[n - 2] === c) r[n - 1]++; else r.push(c, 1); a = dec(c); } ins = [a]; }
    step(g, ins); prevIn = i; if (!opt.idle && g.tick % 30 === 0) achTick();
    if (ghost) { if (ghost.g.state === 'play' && ghost.k < ghost.runs.length) { step(ghost.g, [dec(ghost.runs[ghost.k])]); if (++ghost.n >= ghost.runs[ghost.k + 1]) { ghost.k += 2; ghost.n = 0; } } else ghost = null; }
    for (const f of g.fx) { if (f.startsWith('say:')) { audio.say(f.slice(4), true); continue; } if (f.startsWith('toast:')) { const [a, b] = f.slice(6).split('|'); toast(a, b); continue; }
      if (f === 'shift' && g.intro <= 0) audio.say(VIEWS[g.view] + ' view'); if (f === 'hint' && g.hint && !g.hint.includes(' / ')) audio.say(g.hint.replace('//', '.').replace(' - ', '. '), true); audio.sfx(f === 'go' ? 'ok' : f === 'gear' ? 'blip' : f);
      if (f === 'bossin') audio.music('boss'); if (f === 'die' || f === 'bomb' || f === 'boom2' || f === 'perfect') window.ArcadeGridzPad?.rumble?.(f === 'boom2' ? 160 : 260, 0.8); }
    if (!hiShown && !assisted && g.score > LS.get('best', 0) && LS.get('best', 0) > 0) { hiShown = true; toast('NEW HIGH SCORE', 'KEEP IT ROLLING'); audio.sfx('ring'); audio.say('new high score'); }
    // a warp ring: jump to the bonus stage, and come back to this spot afterwards
    if (g.flags.warpNow && g.state === 'play') { if (++warpT > 80) { const L = LEVELS[levelId], w = LS.get('warps', {}); w[levelId] = 1; LS.set('warps', w); g.flags.warpNow = false; if (L.bonus) { returnTo = { ...snapshot(g), level: levelId, z: g.camZ + 4, warp: true, stats: { ...g.stats } }; const c = carry(); travel(levelId, L.bonus, () => startLevel(L.bonus, c)); return; } } }
    if (g.state !== 'play' && g.endT > (g.state === 'clear' ? 100 : 70) && !menus.length) endMenu(g.state === 'clear');
  }
  function panel(x, y, w, h, col = '#2ee6ff') { ctx.fillStyle = 'rgba(4,5,22,.88)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.12; ctx.lineWidth = 12; ctx.strokeRect(x, y, w, h); ctx.globalAlpha = 0.3; ctx.lineWidth = 6; ctx.strokeRect(x, y, w, h); ctx.globalAlpha = 1; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h); }
  function drawItems(m, cx, y, size, gap) { const t = performance.now() / 1000; m.items.forEach((it, k) => { const lab = typeof it.label === 'function' ? it.label() : it.label, on = k === m.i, w = textWidth(lab, size), yy = y + k * gap;
    if (on) { ctx.fillStyle = '#ff3df0'; ctx.globalAlpha = 0.16 + 0.06 * Math.sin(t * 6); ctx.fillRect(cx - w / 2 - 34, yy - 7, w + 68, size + 14); ctx.globalAlpha = 1; text(ctx, '>', cx - w / 2 - 26, yy, size, '#ffe14a'); if (it.adj) text(ctx, '<', cx + w / 2 + 12, yy, size, '#ffe14a'); }
    text(ctx, lab, cx, yy, size, on ? '#ffffff' : '#8d9be0', { align: 'center', glow: on }); hits.push({ x: cx - w / 2 - 40, y: yy - 9, w: w + 80, h: size + 18, i: k }); }); }
  function drawMap(m) {
    const t = performance.now() / 1000, sy = 250, warp = LS.get('warps', {}); ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1; for (const x of [300, 430, 620, 780, 860]) { ctx.strokeStyle = '#26348c'; ctx.beginPath(); ctx.ellipse(90, sy, x - 90, (x - 90) * 0.42, 0, -0.9, 0.9); ctx.stroke(); }
    ctx.fillStyle = '#8d9be0'; for (let k = 0; k < 40; k++) { const a = -0.8 + k / 40 * 1.6 + Math.sin(k * 9) * 0.02, r = 430 + Math.sin(k * 7) * 12; ctx.fillRect(90 + Math.cos(a) * r, sy + Math.sin(a) * r * 0.42, 2, 2); }
    ctx.strokeStyle = '#ff3df0'; ctx.setLineDash([6, 6]); ctx.beginPath(); ORDER.forEach((id, k) => { const n = NODES.find(q => q.id === id); k ? ctx.lineTo(n.x, sy) : ctx.moveTo(n.x, sy); }); ctx.stroke(); ctx.setLineDash([]);
    NODES.forEach((p, k) => { const L = LEVELS[p.id], on = m.sel === k, y = p.id === 'sun' ? sy : p.up ? sy - 46 : sy, known = !L.isBonus || warp[L.of] || !m.after && true, col = L.isBonus && !warp[L.of] ? '#5a4a8a' : p.col;
      ctx.strokeStyle = col; ctx.lineWidth = on ? 3 : 1.5; ctx.beginPath(); ctx.arc(p.x, y, p.r, 0, TAU); ctx.stroke(); if (!L.isBonus || p.id === 'sun') { ctx.beginPath(); ctx.ellipse(p.x, y, p.r, p.r * 0.35, 0.3 + t * 0.2 * (k % 2 ? 1 : -1), 0, TAU); ctx.stroke(); }
      if (p.id === 'jupiter') { ctx.beginPath(); ctx.ellipse(p.x, y, p.r * 1.6, p.r * 0.4, -0.2, 0, TAU); ctx.stroke(); } if (p.id === 'sun') for (let q = 0; q < 12; q++) { const a = q / 12 * TAU + t * 0.3; ctx.beginPath(); ctx.moveTo(90 + Math.cos(a) * 36, sy + Math.sin(a) * 36); ctx.lineTo(90 + Math.cos(a) * (44 + 4 * Math.sin(t * 3 + q)), sy + Math.sin(a) * (44 + 4 * Math.sin(t * 3 + q))); ctx.stroke(); }
      if (on) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, y, p.r + 8 + 2 * Math.sin(t * 5), 0, TAU); ctx.stroke(); }
      text(ctx, L.isBonus ? (warp[L.of] ? L.name : '?') : L.name, p.x, L.isBonus && p.id !== 'sun' ? y - p.r - 16 : y + p.r + 16, L.isBonus ? 7 : 9, on ? '#ffffff' : col, { align: 'center', glow: on });
      hits.push({ x: p.x - Math.max(18, p.r + 6), y: y - Math.max(18, p.r + 6), w: Math.max(36, p.r * 2 + 12), h: Math.max(36, p.r * 2 + 12), fn: () => { m.sel = k; audio.sfx('move'); } }); });
    if (m.travel) { const P = id => { const n = NODES.find(q => q.id === id) || NODES[0]; return [n.x, n.id === 'sun' ? sy : n.up ? sy - 46 : sy, n.r]; }, a = P(m.travel.from), b = P(m.travel.to), u = Math.min(1, (performance.now() - m.travel.t0) / 2000), f = u * u * (3 - 2 * u), lift = Math.min(70, Math.abs(b[0] - a[0]) * 0.3 + 18);
      const at = q => [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q - Math.sin(Math.PI * q) * lift], c = at(f), d = at(Math.min(1, f + 0.02)), ang = Math.atan2(d[1] - c[1], d[0] - c[0] || 0.001);
      ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]); ctx.beginPath(); for (let q = 0; q <= 20; q++) { const pt = at(f * q / 20); q ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]); } ctx.stroke(); ctx.setLineDash([]);
      ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(f >= 1 ? 0 : ang); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -6); ctx.lineTo(-3, 0); ctx.lineTo(-7, 6); ctx.closePath(); ctx.stroke(); if (f < 1) { ctx.strokeStyle = '#2ee6ff'; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-12 - 5 * Math.sin(t * 40), 0); ctx.stroke(); } ctx.restore();
      if (f >= 1) { ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(b[0], b[1], b[2] + 10 + ((t * 30) % 14), 0, TAU); ctx.stroke(); }
      text(ctx, f >= 1 ? 'ARRIVED - HYPERSPACE' : 'EN ROUTE', 480, 96, 9, '#ffe14a', { align: 'center' }); }
    else if ((t * 2 | 0) % 2) { const cur = NODES.find(n => n.id === (g ? levelId : 'earth')); if (cur) text(ctx, 'YOU', cur.x, (cur.up && cur.id !== 'sun' ? sy - 46 : sy) - cur.r - (cur.up ? 30 : 58), 8, '#ffe14a', { align: 'center' }); }
    ctx.globalCompositeOperation = 'source-over';
    const p = NODES[m.sel], L = LEVELS[p.id]; panel(150, 364, 660, 92, p.col);
    text(ctx, (L.isBonus ? 'BONUS // ' : 'LEVEL ' + L.n + ' // ') + L.name + ' - ' + L.sub, 170, 376, 13, '#ffffff'); text(ctx, L.info, 170, 400, 8, '#9fb0ff', { glow: false });
    if (L.isBonus) text(ctx, 'REACHED THROUGH A HIDDEN WARP ON ' + LEVELS[L.of].name + (warp[L.of] ? ' - FOUND' : ''), 170, 420, 9, '#b06bff', { glow: false }); else { text(ctx, 'BOSS: ' + L.boss, 170, 420, 9, '#ff4d6d', { glow: false }); text(ctx, 'HIDDEN WARP: ' + (warp[p.id] ? LEVELS[L.bonus].name + ' - FOUND' : '???'), 400, 420, 9, '#b06bff', { glow: false }); }
    text(ctx, 'BEST SCORE ' + LS.get('best', 0), 170, 438, 9, '#3dffb0', { glow: false }); if (!L.isBonus) { const mm = LS.get('medals', {})[p.id] || 0; text(ctx, 'RANK ' + RANK[bits(mm)], 400, 438, 9, '#ffe14a', { glow: false }); for (let k = 0; k < 7; k++) { ctx.fillStyle = mm >> k & 1 ? '#ffe14a' : '#30345a'; ctx.fillRect(470 + k * 12, 439, 8, 8); } } text(ctx, '< > BROWSE', 640, 438, 7, '#5a66b0', { glow: false });
  }
  const padNames = () => window.ArcadeGridzPad?.glyphs?.() === 'xbox' ? ['B', 'A', 'X', 'Y', 'LB / RB', 'VIEW', 'MENU'] : ['A', 'B', 'Y', 'X', 'L / R', 'SELECT', 'START'];
  function drawControls() { const pn = padNames(), rows = [['MOVE', 'ARROWS / WASD', 'D-PAD'], ['FIRE', 'SPACE / Z / J', pn[0]], ['CHANGE SPEED', 'V / F', pn[1]], ['BOMB', 'X / K', pn[2]], ['DRONE MODE', 'C / L', pn[3]], ['SHIFT VIEW', 'SHIFT KEYS / Q E', pn[4]], ['BUY UPGRADE', 'ENTER / R', pn[5]], ['PAUSE', 'ESC / P', pn[6]]];
    text(ctx, 'KEYBOARD', 430, 150, 8, '#2ee6ff', { glow: false }); text(ctx, 'CONTROLLER', 660, 150, 8, '#ff3df0', { glow: false });
    rows.forEach((r, k) => { const y = 172 + k * 24; text(ctx, r[0], 210, y, 10, '#ffe14a', { glow: false }); text(ctx, r[1], 430, y, 10, '#ffffff', { glow: false }); text(ctx, r[2], 660, y, 10, '#ffffff', { glow: false }); });
    text(ctx, 'TOUCH: DRAG LEFT SIDE TO FLY. BUTTONS ON THE RIGHT.', 480, 372, 8, '#9fb0ff', { align: 'center', glow: false }); text(ctx, 'EACH POD MOVES THE HIGHLIGHT ALONG THE BAR. BUY WHAT IS LIT. ??? IS A WILDCARD: NUKE, OVERDRIVE OR GOD MODE.', 480, 392, 6.5, '#9fb0ff', { align: 'center', glow: false });
    text(ctx, 'SHIFT AT THE LAST MOMENT TO DODGE SOMETHING AND YOU GET A PERFECT SHIFT: SHOCKWAVE, OVERDRIVE AND A BONUS.', 480, 406, 6.5, '#ffffff', { align: 'center', glow: false }); text(ctx, 'ARENAS: RIGHT STICK OR MOUSE AIMS.   CO-OP: P1 KEYBOARD, P2 CONTROLLER (OR TWO CONTROLLERS).', 480, 420, 6.5, '#9fb0ff', { align: 'center', glow: false }); }
  function drawScroll(m) { const ST = { h1: [20, '#2ee6ff', 34], h2: [15, '#ffe14a', 30], h3: [11, '#ff3df0', 24], q: [8, '#3dffb0', 16], b: [8, '#ffffff', 16], p: [8, '#c7cdf0', 16] }; let y = 96 - m.off, total = 0;
    ctx.save(); ctx.beginPath(); ctx.rect(50, 86, 860, 340); ctx.clip();
    for (const ln of m.lines) { if (!ln) { y += 9; total += 9; continue; } const k = ln[0].replace('+', ''), cont = ln[0].endsWith('+'), s = ST[k] || ST.p; if (y > 60 && y < 440) text(ctx, (k === 'b' && !cont ? '- ' : k === 'q' && !cont ? "> " : k === 'b' || k === 'q' ? '  ' : '') + ln[1], k === 'q' ? 96 : 76, y, s[0], s[1], { glow: k[0] === 'h' }); y += s[2]; total += s[2]; }
    hits.push({ x: 50, y: 86, w: 860, h: 170, fn: () => { m.off = Math.max(0, m.off - 120); } }, { x: 50, y: 256, w: 860, h: 170, fn: () => { m.off += 120; } });
    ctx.restore(); m.off = Math.min(m.off, Math.max(0, total - 300)); const f = total > 320 ? m.off / (total - 300) : 0; if (total > 320) { ctx.fillStyle = '#26306e'; ctx.fillRect(896, 90, 4, 330); ctx.fillStyle = '#2ee6ff'; ctx.fillRect(896, 90 + f * 280, 4, 50); text(ctx, lastDev === 'touch' ? 'DRAG THE STICK AREA UP / DOWN' : 'UP / DOWN TO SCROLL', 480, 432, 7, '#5a66b0', { align: 'center', glow: false }); } }
  function drawMenu() {
    hits = []; const m = top(); if (!m) return; const t = performance.now() / 1000;
    if (m.kind === 'title') {
      const k = Math.min(1, titleT / 18), sc = 1 + (1 - k) * (1 - k) * 2.2; if (titleT < 26) ctx.translate((Math.random() - 0.5) * (26 - titleT) * 0.5, (Math.random() - 0.5) * (26 - titleT) * 0.5);
      drawLogo(ctx, 480, 34 - (sc - 1) * 30, sc, t); ctx.setTransform(res, 0, 0, res, 0, 0);
      text(ctx, 'ONE SHIP.  FOUR WAYS TO SEE THE FIGHT.', 480, 148, 9, '#ffe14a', { align: 'center' });
      ctx.globalCompositeOperation = 'lighter'; const a = t * 0.7, pi = -0.35 + Math.sin(t) * 0.1, rl = Math.sin(t * 0.8) * 0.3; meshScreen(ctx, SHIP_HULL, 742, 330, 86, a, pi, rl, '#ffffff'); meshScreen(ctx, SHIP_WING, 742, 330, 86, a, pi, rl, '#2ee6ff'); meshScreen(ctx, SHIP_FIN, 742, 330, 86, a, pi, rl, '#ff3df0'); ctx.globalCompositeOperation = 'source-over';
      const n = m.items.length, gap = n > 7 ? 29 : n > 6 ? 32 : 36; panel(150, 178, 380, n * gap + 24, '#ff3df0'); drawItems(m, 340, 196, n > 7 ? 13 : 15, gap);
      text(ctx, 'GITHUB GAME OFF 2026', 742, 440, 8, '#5a66b0', { align: 'center', glow: false });
      text(ctx, lastDev === 'pad' ? padNames()[0] + ' = OK     ' + padNames()[1] + ' = BACK' : lastDev === 'touch' ? 'TAP TO CHOOSE' : 'ENTER = OK     ESC = BACK', 480, 500, 8, '#8d9be0', { align: 'center', glow: false });
      text(ctx, COPY, 480, 520, 7, '#5a66b0', { align: 'center', glow: false }); return; }
    ctx.fillStyle = m.kind === 'end' ? 'rgba(2,1,10,.6)' : 'rgba(2,1,10,.74)'; ctx.fillRect(0, 0, W, H);
    if (m.kind === 'end') { const c = m.cleared, bo = endInfo.bonus, col = c ? '#3dffb0' : bo ? '#b06bff' : '#ff4d6d'; text(ctx, bo ? (LEVELS[levelId].isArena ? (c ? 'ARENA CLEAR' : 'ARENA OVER') : c ? 'BONUS COMPLETE' : 'BONUS OVER') : c ? 'SECTOR CLEAR' : 'GAME OVER', 480, 92, bo ? 34 : 40, col, { align: 'center', weight: 4, tube: true });
      const rows = endInfo.par ? [['SCORE', g.score], ['TIME  (PAR ' + mmss(endInfo.par) + ')', mmss(endInfo.time)], ['TIME BONUS', '+' + endInfo.tb], ['BEST CHAIN', g.bestChain]] : [['SCORE', g.score], ['BEST CHAIN', g.bestChain], ['KILLS', g.stats.kills], ['VIEW SHIFTS', g.stats.shifts]]; if (!bo) rows.push(['HIDDEN WARP', g.flags.warp ? 'FOUND' : 'NOT FOUND']); rows.forEach((r, k) => { if (endInfo.t > 20 + k * 14) { text(ctx, r[0], 330, 172 + k * 26, 12, '#9fb0ff', { glow: false }); text(ctx, String(r[1]), 630, 172 + k * 26, 12, '#ffffff', { align: 'right' }); } });
      if (endInfo.medals != null && endInfo.t > 60) { const mm = endInfo.medals, n = bits(mm); text(ctx, 'RANK', 742, 172, 9, '#9fb0ff', { align: 'center', glow: false }); text(ctx, RANK[n], 742, 190, 44, n >= 5 ? '#ffe14a' : '#3dffb0', { align: 'center', weight: 4, tube: true }); if (endInfo.newRank) text(ctx, 'NEW BEST RANK', 742, 246, 7, '#ffe14a', { align: 'center', glow: false }); if (endInfo.newGhost) text(ctx, 'BEST RUN SAVED AS GHOST', 742, 260, 7, '#3dffb0', { align: 'center', glow: false });
        let x = 480 - MEDALS.reduce((a, d) => a + textWidth(d[0], 6.5) + 18, -6) / 2; MEDALS.forEach((d, k) => { const on = mm >> k & 1, w = textWidth(d[0], 6.5) + 18; if (endInfo.t > 66 + k * 5) { ctx.strokeStyle = on ? '#ffe14a' : '#30345a'; ctx.lineWidth = 1; ctx.strokeRect(x, 300, w - 6, 16); text(ctx, d[0], x + (w - 6) / 2, 305, 6.5, on ? '#ffe14a' : '#4a5080', { align: 'center', glow: false }); } x += w; }); }
      if (testRun) text(ctx, 'TEST RUN - SCORE NOT POSTED', 480, 326, 8, '#ffe14a', { align: 'center', glow: false }); else if (daily) text(ctx, 'DAILY RUN ' + daily.label, 480, 326, 8, '#ffe14a', { align: 'center', glow: false }); else if (assisted) text(ctx, coop ? 'CO-OP RUN' : 'ASSISTED RUN', 480, 326, 8, '#ffe14a', { align: 'center', glow: false });
      if (endInfo.t > 100) drawItems(m, 480, 356, 15, 36); else m.i = 0; return; }
    const full = m.kind === 'map' || m.kind === 'controls' || m.kind === 'scores' || m.kind === 'scroll' || m.kind === 'ach';
    const n = m.items.length, gap = m.gap || 34, nn = m.notes ? m.notes.length * 20 + 14 : 0, h = full ? 0 : n * gap + 80 + nn, y0 = full ? 54 : 270 - h / 2;
    if (!full) { panel(m.notes ? 200 : 270, y0, m.notes ? 560 : 420, h, m.pause ? '#2ee6ff' : '#ff3df0'); if (m.notes) m.notes.forEach((ln, k) => text(ctx, ln, 480, y0 + 60 + k * 20, 9, ln[0] === '+' ? '#3dffb0' : ln[0] === '-' ? '#ff4d6d' : '#9fb0ff', { align: 'center', glow: false })); } else panel(40, 40, 880, 460, '#2ee6ff');
    text(ctx, m.title, 480, y0 + (full ? 0 : 18), 22, '#ffe14a', { align: 'center', weight: 2.6, tube: true });
    if (m.kind === 'map') { drawMap(m); drawItems(m, 480, m.items.length > 2 ? 459 : m.items.length > 1 ? 462 : 474, m.items.length > 2 ? 9 : 11, m.items.length > 2 ? 14 : 20); }
    else if (m.kind === 'controls') { drawControls(); drawItems(m, 480, 440, 14, 30); }
    else if (m.kind === 'scroll') { drawScroll(m); drawItems(m, 480, 456, 14, 30); }
    else if (m.kind === 'ach') { const got = LS.get('ach', {}), half = Math.ceil(ACH.length / 2); text(ctx, ACH.filter(a => got[a[0]]).length + ' / ' + ACH.length + ' UNLOCKED', 480, 82, 7, '#3dffb0', { align: 'center', glow: false });
      ACH.forEach((a, k) => { const x = 74 + (k >= half ? 420 : 0), y = 100 + (k % half) * 23.6, on = got[a[0]]; ctx.strokeStyle = on ? '#ffe14a' : '#30345a'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y + 1, 12, 12); if (on) { ctx.fillStyle = '#ffe14a'; ctx.fillRect(x + 3, y + 4, 6, 6); } text(ctx, a[1], x + 22, y, 8.5, on ? '#ffe14a' : '#6a76c0', { glow: !!on }); text(ctx, a[2], x + 22, y + 12, 5.5, on ? '#c7cdf0' : '#454c86', { glow: false }); });
      drawItems(m, 480, 466, 13, 30); }
    else if (m.kind === 'scores') { const rows = m.rows; if (!rows) text(ctx, 'LOADING...', 480, 240, 12, '#9fb0ff', { align: 'center' }); else if (!rows.length) text(ctx, 'NO SCORES YET', 480, 240, 12, '#9fb0ff', { align: 'center' });
      else rows.slice(0, 10).forEach((r, k) => { const y = 124 + k * 30; text(ctx, String(k + 1), 250, y, 13, '#ffe14a', { align: 'right' }); text(ctx, String(r.name || '???').slice(0, 14), 280, y, 13, '#ffffff'); text(ctx, String(r.score), 700, y, 13, '#3dffb0', { align: 'right' }); const tag = r.cheater ? 'CHEATER' : r.assisted ? 'ASSISTED' : r.verified === false ? 'UNVERIFIED' : ''; if (tag) text(ctx, tag, 716, y + 3, 7, '#ff8a2b', { glow: false }); });
      drawItems(m, 480, 450, 14, 30); }
    else drawItems(m, 480, y0 + 62 + nn, 14, gap);
  }
  function drawIntro() {
    const t = sceneT / 60; ctx.fillStyle = '#02010a'; ctx.fillRect(0, 0, W, H);
    const fade = (a, b) => Math.max(0, Math.min(1, (t - a) / 0.4, (b - t) / 0.5));
    if (t < 2.8) drawSplash(ctx, 0, fade(0, 2.8), t);
    else if (t < 5.4) drawSplash(ctx, 1, fade(2.8, 5.4), t - 2.8);
    else { const u = Math.min(1, (t - 5.4) / 4); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#8fa8ff'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k < 90; k++) { const a = k * 2.399, r0 = ((k * 37 + sceneT * (3 + u * 14)) % 560), l = 4 + u * 40; ctx.moveTo(480 + Math.cos(a) * r0, 270 + Math.sin(a) * r0 * 0.6); ctx.lineTo(480 + Math.cos(a) * (r0 + l), 270 + Math.sin(a) * (r0 + l) * 0.6); } ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
      const s = u < 0.62 ? 5 + Math.pow(u / 0.62, 2.2) * 210 : 215 - Math.pow((u - 0.62) / 0.38, 0.7) * 205, x = 480 + Math.sin(u * TAU) * 300 * Math.min(1, u * 1.6), y = 270 - Math.sin(u * Math.PI) * 50 + (u > 0.62 ? (u - 0.62) * -200 : 0), yaw = Math.PI * (1 - Math.min(1, u * 1.25)), roll = Math.sin(u * Math.PI * 1.5) * 1.3, pitch = -0.3 + u * 0.55;
      meshScreen(ctx, SHIP_HULL, x, y, s, yaw, pitch, roll, '#ffffff'); meshScreen(ctx, SHIP_WING, x, y, s, yaw, pitch, roll, '#2ee6ff'); meshScreen(ctx, SHIP_FIN, x, y, s, yaw, pitch, roll, '#ff3df0');
      if (u > 0.93) { ctx.fillStyle = '#fff'; ctx.globalAlpha = (u - 0.93) / 0.07; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; } }
    ctx.globalCompositeOperation = 'source-over'; if (t > 0.8) text(ctx, lastDev === 'touch' ? 'TAP TO SKIP' : 'PRESS ANY BUTTON TO SKIP', 480, 512, 7, '#3a4380', { align: 'center', glow: false });
  }
  function render() {
    ctx.setTransform(res, 0, 0, res, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const ro2 = { glow: opt.glow === 'high', shake: opt.shake, fill: opt.fill, ghost: null, q }; if (ghost && g && scene === 'play' && ghost.g.players[0].dead <= 0) { const q = ghost.g.players[0]; ro2.ghost = { x: q.x, y: q.y, z: q.z + ghost.g.camZ - g.camZ }; }
    if (scene === 'intro') drawIntro();
    else if (scene === 'story') drawStory();
    else if (scene === 'credits') drawCredits();
    else { ctx.fillStyle = '#02010a'; ctx.fillRect(0, 0, W, H); const gg = scene === 'title' ? attract : g;
      drawWorld(ctx, gg, ro2); ctx.setTransform(res, 0, 0, res, 0, 0); ctx.globalCompositeOperation = 'source-over';
      if (scene === 'title') { ctx.fillStyle = 'rgba(2,1,10,.66)'; ctx.fillRect(0, 0, W, H); if (titleT < 14) { ctx.fillStyle = '#fff'; ctx.globalAlpha = 1 - titleT / 14; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; } }
      else { if (g.shiftT > 0) chroma(9 * Math.sin(Math.PI * g.shiftT), 0.4); else if (g.perfFx > 0) chroma(16 * Math.min(1, g.perfFx / 24), 0.55);
        const ended = menus.length && top().kind === 'end'; /* results screens: no HUD under the text, the level keeps running behind */ if (!ended) drawHUD(ctx, g, { hi: Math.max(LS.get('best', 0), g.score), upgLabel: lastDev === 'touch' ? 'TAP' : lastDev === 'pad' ? padNames()[5] : 'ENTER' }); if (ended) { } else { if (opt.idle) text(ctx, 'IDLE MODE', 150, 26, 8, '#ffe14a', { glow: false }); if (testRun) text(ctx, 'TEST RUN', 150, 40, 8, '#ff8a2b', { glow: false }); else if (daily) text(ctx, 'DAILY ' + daily.label + '  ' + daily.help[0] + ' + ' + daily.hurt[0], 150, 40, 7, '#ffe14a', { glow: false }); else if (coop) text(ctx, 'CO-OP', 150, 40, 8, '#3dffb0', { glow: false }); if (loopN) text(ctx, 'LOOP ' + (loopN + 1), 150, 52, 8, '#ff4d6d', { glow: false }); }
        if (g.boss?.dying) { ctx.fillStyle = '#02010a'; ctx.globalAlpha = 0.9; ctx.fillRect(0, 0, W, 52); ctx.fillRect(0, H - 52, W, 52); ctx.globalAlpha = 1; }
        const L = LEVELS[levelId]; if (g.intro > 0 || sceneT < INTRO + 110) { const a = g.intro > 0 ? 1 : Math.min(1, (INTRO + 110 - sceneT) / 30); text(ctx, (L.isArena ? 'BONUS ARENA' : L.isBonus ? 'BONUS STAGE' : 'LEVEL ' + L.n) + (loopN ? '   LOOP ' + (loopN + 1) : ''), 480, 178, 14, '#ffe14a', { align: 'center', alpha: a }); text(ctx, L.name, 480, 204, 44, VCOL[(L.n || 2) % 4], { align: 'center', alpha: a, weight: 4, tube: true }); text(ctx, L.sub, 480, 262, 12, '#ffffff', { align: 'center', alpha: a }); if (g.intro > 0) text(ctx, 'HYPERSPACE', 480, 300, 8, '#7d8bd6', { align: 'center', alpha: (sceneT >> 3) % 2 ? 1 : 0.4, glow: false }); }
        if (warpT > 0) { ctx.fillStyle = '#b06bff'; ctx.globalAlpha = Math.min(0.85, warpT / 80); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; text(ctx, 'WARP', 480, 240, 40, '#ffffff', { align: 'center', weight: 4, tube: true }); } } }
    if (scene !== 'intro' && toasts.length) { let y = menus.length && top().kind === 'end' ? 392 : 114; for (const q of toasts) { q.t++; const k = Math.min(1, q.t / 14, (300 - q.t) / 20), x = W - 18 - 250 * Math.max(0, k); if (k <= 0) continue; ctx.fillStyle = 'rgba(4,5,22,.88)'; ctx.fillRect(x, y, 250, 40); ctx.strokeStyle = '#3dffb0'; ctx.lineWidth = 2; ctx.strokeRect(x, y, 250, 40); ctx.fillStyle = '#3dffb0'; ctx.fillRect(x, y, 5, 40); text(ctx, q.a, x + 16, y + 8, 11, '#ffffff'); text(ctx, q.b, x + 16, y + 26, 7, '#3dffb0', { glow: false }); y += 48; } while (toasts.length && toasts[0].t > 300) toasts.shift(); }
    drawMenu();
    if (opt.crt) { if (!crtPat) { const c = document.createElement('canvas'); c.width = 2; c.height = 3; const x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,.34)'; x.fillRect(0, 2, 2, 1); crtPat = ctx.createPattern(c, 'repeat'); }
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = crtPat; ctx.fillRect(0, 0, W, H); const vg = ctx.createRadialGradient(480, 270, 250, 480, 270, 590); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); }
    const showTouch = lastDev === 'touch' && scene === 'play' && !menus.length; if (touchEl.hidden === showTouch) { touchEl.hidden = !showTouch; if (!showTouch) { tb.clear(); stick = null; nubEl.hidden = true; } }
  }
  // colour split: the frame is drawn again in red and cyan, pulled apart sideways (on shifts and perfect shifts)
  function chroma(k, a) { if (opt.glow !== 'high' || k < 0.5) return; if (!fxC) fxC = document.createElement('canvas'); if (fxC.width !== canvas.width || fxC.height !== canvas.height) { fxC.width = canvas.width; fxC.height = canvas.height; } const f = fxC.getContext('2d');
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); for (const [col, dx] of [['#ff0030', -k], ['#00e0ff', k]]) { f.globalCompositeOperation = 'copy'; f.drawImage(canvas, 0, 0); f.globalCompositeOperation = 'multiply'; f.fillStyle = col; f.fillRect(0, 0, fxC.width, fxC.height); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.drawImage(fxC, dx * res, 0); } ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  function frame(now) {
    if (destroyed) return; raf = requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now; if (dt > 0.25) dt = 0.25; if (focusPaused) return;
    if (scene === 'play' && !menus.length && q < 2) { ema += (dt * 1000 - ema) * 0.05; if (ema > 25) { if (++slow > 80) { q++; slow = 0; ema = 16; fit(); } } else slow = Math.max(0, slow - 1); } acc += dt; let n = 0;
    while (acc >= 1 / 60 && n < 5) { acc -= 1 / 60; n++; const i = readInput(); update(i); if (tap && scene !== 'intro' && scene !== 'story' && !menus.length) tap = null; } if (n === 5) acc = 0;
    render();
  }

  // ---------- focus / lifecycle ----------
  function pauseForFocus() { if (destroyed) return; keys.clear(); pad.clear(); tb.clear(); stick = null; if (scene === 'play' && !menus.length) pauseMenu(); focusPaused = true; audio.suspend(); }
  function wake() { if (destroyed || !focusPaused || document.hidden) return; focusPaused = false; last = performance.now(); acc = 0; audio.resume(); }
  const onBlur = () => pauseForFocus(), onFocus = () => wake(), onVis = () => document.hidden ? pauseForFocus() : wake();
  addEventListener('blur', onBlur); addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onVis);
  canvas.addEventListener('pointerdown', () => wake());
  function destroy() { if (destroyed) return; destroyed = true; cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('resize', fit); removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKey, true); removeEventListener('blur', onBlur); removeEventListener('focus', onFocus); removeEventListener('pointerup', mUp); document.removeEventListener('visibilitychange', onVis); audio.close(); root.innerHTML = ''; }

  fit(); prevM = { ok: true, pause: true }; raf = requestAnimationFrame(frame); try { canvas.focus({ preventScroll: true }); } catch { }
  return { ownsFocusPause: true, destroy, pauseForFocus, resumeFromFocus: wake,
    getState: () => ({ scene, state: g?.state || scene, score: g?.score || 0, lives: g ? Math.max(0, g.players[0].lives) : 0, view: g ? VIEWS[g.view] : '-', chain: g?.chain || 0, best: LS.get('best', 0), level: LEVELS[levelId].name, bonus: !!LEVELS[levelId].isBonus, speed: g ? GEARS[g.gear] : '-', boss: g?.boss ? g.boss.name : '', warp: !!g?.flags.warp, paused: menus.length > 0 && scene === 'play', idle: !!opt.idle, assist: !!opt.assist, coop, daily: daily ? daily.label : '', muted: !!opt.mute, menu: scene !== 'play' }),
    control(a) { if (a === 'sound') { opt.mute = !opt.mute; saveOpt(); audio.vol(); if (opt.mute) audio.hush(); } else if (a === 'exit') host.onExit?.(); else if (a === 'pause') { if (menus.length && top().pause) resume(); else pauseMenu(); } else if (a === 'idle') setIdle(!opt.idle); else if (a === 'assist') setAssist(!opt.assist); else if (a === 'menu') showTitle(); else if (a === 'start' || a === 'restart') { testRun = false; returnTo = null; coop = false; daily = null; loopN = 0; assisted = !!opt.idle || !!opt.assist; startLevel('earth', null); } },
    getResult: () => ({ score: g?.score || 0, state: g?.state || scene, assisted }),
    _debug: { ghost: () => ghost, rec: () => rec, setCoop: v => { coop = v; }, setAssist, game: () => g, scene: () => scene, menus, opt, startLevel: (id, s, test = true) => { testRun = test; returnTo = null; startLevel(id, s); }, showTitle, setIdle, startStory, beginEnding, startCredits, award, skipIntro: () => { showTitle(); titleT = 99; } } };
}
