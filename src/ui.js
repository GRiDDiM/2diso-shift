// 2DISO SHIFT — front end: input (keyboard, controller, touch), intro, menus, HUD, audio hooks, saves, level flow.
// mountShift(root, host) works standalone (index.html) and inside a host site that passes { hosted, onExit, submitScore, leaderboard, skins }.
// (C) 2026 GRiDDiM / ArcadeGridz / BDC
import { createGame, step, autopilot, snapshot, makeWing, VIEWS, BAR, GEARS, INTRO } from './game.js';
import { LEVELS, ORDER, buildLevel } from './levels.js';
import { W, H, drawWorld, drawHUD, drawLogo, drawTagline, drawSplash, meshScreen, text, textWidth, SHIP_HULL, SHIP_WING, SHIP_FIN, RAINBOW, VCOL, PIV, logosReady, rivetLine, rivetFace, skinPreview } from './render.js';
import { createAudio } from './audio.js';
import { DEVLOG_TABS, CREDITS } from './devlog.js';

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
const VER = 'r65';
const enc = i => ((i.fire ? 1 : 0) | (i.gear ? 2 : 0) | (i.bomb ? 4 : 0) | (i.drone ? 8 : 0) | (i.shiftL ? 16 : 0) | (i.shiftR ? 32 : 0) | (i.upgrade ? 64 : 0)) * 81 + (Math.round(Math.max(-1, Math.min(1, i.mx)) * 4) + 4) * 9 + Math.round(Math.max(-1, Math.min(1, i.my)) * 4) + 4;
const dec = c => { const b = c / 81 | 0, r = c % 81; return { fire: !!(b & 1), gear: !!(b & 2), bomb: !!(b & 4), drone: !!(b & 8), shiftL: !!(b & 16), shiftR: !!(b & 32), upgrade: !!(b & 64), mx: ((r / 9 | 0) - 4) / 4, my: (r % 9 - 4) / 4 }; };
const MEDALS = [['CLEAR', () => true], ['NO SHIPS LOST', g => g.stats.deaths === 0], ['UNTOUCHED', g => g.stats.hits === 0], ['WARP FOUND', g => g.flags.warp], ['CHAIN 50', g => g.bestChain >= 50], ['3 PERFECT SHIFTS', g => g.stats.perfect >= 3], ['FAST CLEAR', (g, id) => PAR[id] && g.stats.ticks / 60 <= PAR[id]]];
const PAR = { earth: 340, mars: 240, jupiter: 262, x: 290 }, mmss = s => (s / 60 | 0) + ':' + String(s % 60 | 0).padStart(2, '0'); // par times: slow speed all the way will not make them
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
  ['ranks', 'S RANK', 'EARN RANK S OR BETTER ON A PLANET'], ['sss', 'TRIPLE S', 'EARN RANK SSS ON A PLANET'], ['arsenal', 'FULL ARSENAL', 'MAX EVERY WEAPON AT ONCE'], ['drones', 'SIX PACK', 'FLY WITH SIX DRONES'], ['god', 'GOD MODE', 'PICK UP GOD MODE'],
  ['score1', 'HIGH ROLLER', 'SCORE 250000 IN ONE RUN'], ['score2', 'MILLIONAIRE', 'SCORE 1000000 IN ONE RUN'], ['kills', 'EXTERMINATOR', 'DESTROY 1000 ENEMIES IN TOTAL'], ['coop', 'WINGMATES', 'CLEAR A PLANET IN CO-OP'], ['rush', 'GAUNTLET', 'BEAT ALL TWELVE IN BOSS RUSH']];
// boss rush: every boss and miniboss back to back. Planets start at the checkpoint before the boss, bonus stages just before their miniboss, arenas skip their waves
const RUSH = ['earth', 'arena-earth', 'moon', 'mars', 'arena-mars', 'sun', 'jupiter', 'arena-jupiter', 'belt', 'x', 'arena-x', 'pluto'];
// BUG TEST: a checklist for the pre-release pass. Each entry starts you there with no damage taken (hits are only marked),
// and is ticked off when you clear it. Set BUGTEST to false to hide the menu for the jam build.
const BUGTEST = true;
const BUGLIST = [['earth', 'EARTH'], ['moon', 'MOON'], ['arena-earth', 'EARTH ARENA'], ['mars', 'MARS'], ['sun', 'SUN'], ['arena-mars', 'MARS ARENA'],
  ['jupiter', 'JUPITER'], ['belt', 'ASTEROID BELT'], ['arena-jupiter', 'JUPITER ARENA'], ['x', 'PLANET X'], ['pluto', 'PLUTO'], ['arena-x', 'X ARENA'], ['rush', 'BOSS RUSH'], ['end', 'ENDING AND LOOP'],
  ['boss-earth', 'BOSS: OVERSEER'], ['boss-mars', 'BOSS: THE COLOSSUS'], ['boss-jupiter', 'BOSS: THE EYE'], ['boss-x', 'BOSS: THE SHIFTER'], ['mini-moon', 'MINI: LUNAR SENTINEL'], ['mini-sun', 'MINI: SOLAR FLARE'], ['mini-belt', 'MINI: THE MOTHER ROCK'], ['mini-pluto', 'MINI: FROST WARDEN']]; // each boss and warp-stage miniboss on its own
const TAU = Math.PI * 2, COPY = '(C) 2026 GRIDDIM / ARCADEGRIDZ / BDC';
// solar map: four planets along the route, each with its hidden bonus stage above it
const NODES = [{ id: 'earth', x: 300, r: 13, col: '#2ee6ff' }, { id: 'moon', x: 334, r: 5, col: '#c8d0e0', up: 1 }, { id: 'mars', x: 430, r: 10, col: '#ff4d6d' }, { id: 'sun', x: 90, r: 30, col: '#ffe14a', up: 2 }, { id: 'jupiter', x: 620, r: 24, col: '#ff8a2b' }, { id: 'belt', x: 520, r: 6, col: '#c8a070', up: 1 }, { id: 'x', x: 860, r: 15, col: '#3dffb0' }, { id: 'pluto', x: 780, r: 5, col: '#9fe9ff', up: 1 },
  { id: 'arena-earth', x: 300, r: 7, col: '#2ee6ff', st: 1 }, { id: 'arena-mars', x: 430, r: 7, col: '#ff4d6d', st: 1 }, { id: 'arena-jupiter', x: 620, r: 7, col: '#ff8a2b', st: 1 }, { id: 'arena-x', x: 860, r: 7, col: '#3dffb0', st: 1 }]; // st: an arena, drawn as a little space station under its planet
const NY = p => p.id === 'sun' ? 250 : p.st ? 250 + 74 : p.up ? 250 - 46 : 250;

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
  const opt = Object.assign({ music: 0.7, sfx: 0.8, glow: 'high', gfx: null, dyn: true, shake: true, idle: false, autofire: coarse, gear: 0, voice: true, fill: true, assist: false, ghost: true, crt: false, skin: 0, autobomb: false }, LS.get('opt', {})); if (!opt.gfx) opt.gfx = opt.glow === 'low' || coarse ? 'normal' : 'high'; /* graphics: high / normal / low, plus dynamic framerate that steps down on its own when frames run long */ const saveOpt = () => LS.set('opt', opt);
  // ship skins: looks only. Each is earned with an achievement, or owned through the host site's store when it sells them
  const SKIN = [['PILOT'], ['FIRE MAGE', 'sun', 'BEAT SOLAR FLARE ON THE SUN', 'shift-fire-mage', 'THE WARP STAGE HIDDEN ON MARS'], ['DARK LORD', 'pluto', 'BEAT FROST WARDEN ON PLUTO', 'shift-dark-lord', 'THE WARP STAGE HIDDEN ON PLANET X'], ['PIXIE', 'belt', 'BEAT THE MOTHER ROCK', 'shift-pixie', 'THE WARP STAGE HIDDEN ON JUPITER']]; // each skin drops from the miniboss of a warp stage
  let owned = LS.get('owned', []), forSale = [], prices = { 'shift-fire-mage': 500, 'shift-pixie': 650, 'shift-dark-lord': 800 }, skinView = opt.skin | 0; if (host.skins) Promise.resolve().then(() => host.skins()).then(r => { if (r && Array.isArray(r.owned)) { owned = r.owned; LS.set('owned', owned); } if (r && Array.isArray(r.forSale)) forSale = r.forSale; if (r && r.prices) Object.assign(prices, r.prices); }).catch(() => { });
  const skinOk = i => !i || BUGTEST && opt.skinTest || !!SKIN[i] && (!!LS.get('skinsWon', {})[SKIN[i][1]] || owned.includes(SKIN[i][3])), skinReal = i => !i || !!SKIN[i] && (!!LS.get('skinsWon', {})[SKIN[i][1]] || owned.includes(SKIN[i][3])), skinNow = () => skinOk(opt.skin | 0) ? opt.skin | 0 : 0;
  const audio = createAudio(opt);
  let q = 0, slow = 0, ema = 16, upWait = 600, sinceUp = 1e9; // q: how many steps dynamic framerate has dropped below the chosen graphics setting
  // quality tiers: 0 full glow at full resolution, 1 one soft halo at 3/4 resolution, 2 no glow at lower resolution, 3 no glow, half resolution, no far scenery
  const GBASE = { high: 0, normal: 1, low: 3 }, TNAME = ['HIGH', 'NORMAL', 'REDUCED', 'LOW', 'MINIMUM'], tier = () => Math.min(4, (GBASE[opt.gfx] ?? 0) + (opt.dyn ? q : 0)); // 4 is an emergency step only dynamic framerate reaches: lower resolution still and no solid shading
  let destroyed = false, raf = 0, last = performance.now(), acc = 0, scale = 1, res = 1, rotOk = false;
  let bug = false, bugHits = 0; let scene = 'intro', sceneT = 0, g = null, attract = null, assisted = false, testRun = false, submitted = false, focusPaused = false, lastDev = coarse ? 'touch' : 'kb', titleT = 0, endInfo = null, levelId = 'earth', returnTo = null, warpT = 0, coop = false, daily = null, rec = null, ghost = null, fxC = null, crtPat = null; const mouse = { x: 0, y: 0, t: -1e9, down: false };
  const menus = []; let hits = []; const toasts = []; let rush = null, introWait = 0, story = null, hiShown = false, loopN = 0, endCarry = null, cred = null, achGot = LS.get('ach', {});
  // achievements: kept on this device. Idle mode never unlocks them.
  function award(id) { if (bug) return; if (opt.idle || achGot[id]) return; achGot = LS.get('ach', {}); if (achGot[id]) return; achGot[id] = 1; LS.set('ach', achGot); const d = ACH.find(a => a[0] === id); if (!d) return; toast('ACHIEVEMENT', d[1]); audio.sfx('ring'); }
  function achTick() { if (bug) return; const p = g.players[0], s = g.stats; if (s.shifts) award('shift'); if (s.perfect) award('perfect'); if (s.order) award('order'); if (g.bestChain >= 50) award('chain50'); if (g.bestChain >= 100) award('chain100'); if (g.flags.warp) award('warp'); if (p.god > 0) award('god'); if (p.up[0] >= 6) award('drones'); if ([1, 2, 3, 4, 5].every(k => p.up[k] >= 3)) award('arsenal'); if (g.score >= 250000) award('score1'); if (g.score >= 1000000) award('score2'); }
  function achEnd(cleared, m) { const L = LEVELS[levelId]; if (opt.idle) return; const kills = LS.get('kills', 0) + g.stats.kills; LS.set('kills', kills); if (kills >= 1000) award('kills'); if (Object.keys(LS.get('warps', {})).length >= 4) award('warp4'); if (!cleared) return;
    if (L.isArena) { award('arena'); const a = LS.get('arenas', {}); a[L.of] = 1; LS.set('arenas', a); if (Object.keys(a).length >= 4) award('arena4'); return; } if (L.isBonus) { award('bonus'); const bd = LS.get('bonusDone', {}); bd[levelId] = 1; LS.set('bonusDone', bd); const sk = SKIN.find(q => q[1] === levelId), won = LS.get('skinsWon', {}); if (sk && !bug && !opt.idle && !won[levelId]) { won[levelId] = 1; LS.set('skinsWon', won); toast('SKIN DROPPED', sk[0] + ' - PICK IT IN OPTIONS'); audio.sfx('ring'); audio.say('new skin. ' + sk[0].toLowerCase(), true); } return; }
    award(levelId); if (g.stats.hits === 0) award('untouched'); if (g.stats.deaths === 0) award('nodeath'); if (m >> 6 & 1) award('fast'); if (m >> 5 & 1) award('perfect3'); if (bits(m) >= 5) award('ranks'); if (bits(m) >= 7) award('sss'); if (coop) award('coop'); }
  const toast = (a, b) => { toasts.push({ a, b: b || '', t: 0 }); if (toasts.length > 3) toasts.shift(); };

  // ---------- layout ----------
  function fit() { const r = shell.getBoundingClientRect(); if (!r.width || !r.height) return; scale = Math.min(r.width / W, r.height / H); stage.style.transform = `translate(${(r.width - W * scale) / 2}px,${(r.height - H * scale) / 2}px) scale(${scale})`;
    const want = Math.min([2, 1.5, 1.25, 1, 0.75][tier()], Math.max(tier() > 3 ? 0.75 : 1, scale * (window.devicePixelRatio || 1))); if (Math.abs(want - res) > 0.05 || canvas.width !== Math.round(W * want)) { res = want; canvas.width = Math.round(W * res); canvas.height = Math.round(H * res); }
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
  canvas.addEventListener('wheel', e => { const m = top(); if (m?.kind === 'scroll' || m?.kind === 'devlog') { m.off = Math.max(0, m.off + e.deltaY * 0.5); e.preventDefault(); } }, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // ---------- menus ----------
  const top = () => menus[menus.length - 1], HELD = { ok: true, back: true, up: true, down: true, left: true, right: true, pause: true, start: true };
  const upF = { ok: 0, back: 0, pause: 0, start: 0 }, lock = () => { upF.ok = upF.back = upF.pause = upF.start = 0; }; // a button must be let go for a moment before it can press a menu item again
  function push(m) { m.i = m.i || 0; menus.push(m); prevM = { ...HELD }; lock(); return m; }
  function popMenu() { const m = menus.pop(); audio.sfx('back'); prevM = { ...HELD }; lock(); return m; }
  const onoff = v => v ? 'ON' : 'OFF';
  const scrollMenu = (title, lines) => push({ title, kind: 'scroll', lines, off: 0, items: [{ label: 'BACK', act: popMenu }] });
  // options are split into tabs: L / R (or left / right on the tab row) flips between them
  function optionsMenu() { skinView = skinNow(); const tabs = [
      { name: 'SHIP', items: [
        { label: () => 'SHIP SKIN  ' + SKIN[skinView][0] + (skinOk(skinView) ? '' : '  (LOCKED)'), adj: d => { skinView = (skinView + (d < 0 ? SKIN.length - 1 : 1)) % SKIN.length; audio.sfx('blip'); if (skinOk(skinView)) { opt.skin = skinView; saveOpt(); } else toast('LOCKED', SKIN[skinView][2] + (forSale.includes(SKIN[skinView][3]) ? ' OR BUY IT IN THE SPARKZ STORE' : '')); } }] },
      { name: 'SOUND', items: [
        { label: () => 'MUSIC  ' + Math.round(opt.music * 10), adj: d => { opt.music = Math.max(0, Math.min(1, opt.music + d * 0.1)); audio.vol(); saveOpt(); } },
        { label: () => 'SOUND  ' + Math.round(opt.sfx * 10), adj: d => { opt.sfx = Math.max(0, Math.min(1, opt.sfx + d * 0.1)); audio.vol(); saveOpt(); audio.sfx('blip'); } },
        { label: () => 'ANNOUNCER  ' + onoff(opt.voice), adj: () => { opt.voice = !opt.voice; saveOpt(); if (opt.voice) audio.say('announcer on', true); else audio.hush(); } }] },
      { name: 'VIDEO', items: [
        { label: () => 'GRAPHICS  ' + opt.gfx.toUpperCase(), adj: d => { const o = ['low', 'normal', 'high'], k = o.indexOf(opt.gfx); opt.gfx = o[(k + (d || 1) + 3) % 3]; q = 0; slow = 0; saveOpt(); fit(); } },
        { label: () => 'DYNAMIC FRAMERATE  ' + onoff(opt.dyn) + (opt.dyn && q ? '  (NOW ' + TNAME[tier()] + ')' : ''), adj: () => { opt.dyn = !opt.dyn; q = 0; slow = 0; saveOpt(); fit(); } },
        { label: () => 'SOLID OBSTACLES  ' + onoff(opt.fill), adj: () => { opt.fill = !opt.fill; saveOpt(); } },
        { label: () => 'SCREEN SHAKE  ' + onoff(opt.shake), adj: () => { opt.shake = !opt.shake; saveOpt(); } },
        { label: () => 'CRT FILTER  ' + onoff(opt.crt), adj: () => { opt.crt = !opt.crt; saveOpt(); } }] },
      { name: 'PLAY', items: [
        { label: () => 'AUTO SHOOT  ' + onoff(opt.autofire), adj: () => { opt.autofire = !opt.autofire; saveOpt(); } },
        { label: () => 'START SPEED  ' + GEARS[opt.gear], adj: d => { opt.gear = (opt.gear + (d < 0 ? GEARS.length - 1 : 1)) % GEARS.length; saveOpt(); } },
        { label: () => 'AUTO DETONATE  ' + onoff(opt.autobomb), adj: () => { opt.autobomb = !opt.autobomb; saveOpt(); } },
        { label: () => 'IDLE MODE  ' + onoff(opt.idle), adj: () => setIdle(!opt.idle) },
        { label: () => 'RIVET-9 ASSIST  ' + onoff(opt.assist), adj: () => setAssist(!opt.assist) },
        { label: () => 'BEST RUN GHOST  ' + onoff(opt.ghost), adj: () => { opt.ghost = !opt.ghost; saveOpt(); if (!opt.ghost) ghost = null; } }] },
      { name: 'MORE', items: [
        ...(BUGTEST ? [{ label: 'BUG TEST', act: bugMenu }] : []),
        { label: 'CONTROLS', act: () => push({ title: 'CONTROLS', kind: 'controls', items: [{ label: 'BACK', act: popMenu }] }) },
        { label: 'CREDITS', act: () => scrollMenu('CREDITS', CREDITS) }] }];
    const m = push({ title: 'OPTIONS', gap: 28, tabs, tab: 0, items: [] }); setTab(m, 0); }
  function setTab(m, k) { m.tab = (k + m.tabs.length) % m.tabs.length; m.items = [{ label: () => '<  ' + m.tabs[m.tab].name + '  >', tabRow: true, adj: d => setTab(m, m.tab + d) }, ...m.tabs[m.tab].items, { label: 'BACK', act: popMenu }]; m.i = Math.min(m.i, m.items.length - 1); }
  function setIdle(v) { opt.idle = v; saveOpt(); if (v) { assisted = true; rec = null; } }
  // RIVET-9 flies as your wingman and rolls into the right view before you do. Runs with him are tagged ASSISTED.
  function setAssist(v) { opt.assist = v; saveOpt(); rec = null; ghost = null; if (v) assisted = true; if (g && scene === 'play' && !coop) g.wing = v ? makeWing(g.view) : null; }
  function mapMenu(after, at) { const m = push({ title: 'SOLAR MAP', kind: 'map', sel: Math.max(0, NODES.findIndex(n => n.id === (at || levelId))), after, items: after ? [{ label: 'CONTINUE', act: () => { popMenu(); after(); } }] : [...(BUGTEST ? [{ label: 'PLAY THIS LEVEL (TEST)', act: () => { const id = NODES[m.sel].id, L = LEVELS[id]; testRun = true; returnTo = null; startLevel(id, { up: L.kit || undefined }); } }, { label: 'PLAY ITS ARENA (TEST)', act: () => { let id = NODES[m.sel].id; if (LEVELS[id].isBonus) id = LEVELS[id].of; testRun = true; returnTo = null; startLevel('arena-' + id, { up: LEVELS['arena-' + id].kit }); } }] : []), { label: 'BACK', act: popMenu }] }); return m; } // the test jumps go with the bug test menu
  function scoresMenu() { const m = { title: 'HIGH SCORES', kind: 'scores', rows: LS.get('scores', []), items: [{ label: 'BACK', act: popMenu }] }; push(m); if (host.leaderboard) { m.rows = null; Promise.resolve(host.leaderboard()).then(r => { m.rows = Array.isArray(r) ? r : []; }).catch(() => { m.rows = LS.get('scores', []); }); } }
  // the map before every hop: the ship flies from where you are to where you are going, then hyperspace
  function travel(from, to, after) { menus.length = 0; const m = mapMenu(after, to); m.locked = true; m.travel = { from, to, t0: performance.now() }; audio.sfx('whoosh'); return m; }
  function titleMenu() { menus.length = 0;
    const play = () => { const items = [], sv = LS.get('save', null);
      if (sv && LEVELS[sv.level]) items.push({ label: 'CONTINUE  ' + LEVELS[sv.level].name + (sv.loop ? '  LOOP ' + (sv.loop + 1) : ''), act: () => { testRun = false; returnTo = null; coop = false; daily = null; assisted = true; loopN = sv.loop || 0; startLevel(sv.level, sv); } });
      items.push({ label: 'NEW GAME', act: () => { testRun = false; returnTo = null; coop = false; daily = null; assisted = !!opt.idle || !!opt.assist; loopN = 0; startStory(STORY, () => startLevel('earth', null)); } },
        { label: 'CO-OP', act: () => { testRun = false; returnTo = null; coop = true; daily = null; assisted = true; loopN = 0; startStory(STORY, () => { startLevel('earth', null); toast('CO-OP', 'P1 KEYBOARD   P2 CONTROLLER'); }); } },
        { label: 'BOSS RUSH', act: startRush }, { label: 'BACK', act: popMenu }); const br = LS.get('rush', null); push({ title: 'PLAY', items, notes: br ? ['BOSS RUSH BEST  ' + br.won + ' / ' + RUSH.length + '   ' + mmss(br.time) + '   ' + br.score] : undefined }); };
    const items = [{ label: 'PLAY', act: play }, { label: 'OPTIONS', act: optionsMenu }, { label: 'HIGH SCORES', act: scoresMenu }, { label: 'ACHIEVEMENTS', act: () => push({ title: 'ACHIEVEMENTS', kind: 'ach', items: [{ label: 'BACK', act: popMenu }] }) }];
    items.push({ label: 'DEVLOG', act: devlogMenu }); if (host.onExit) items.push({ label: 'EXIT GAME', act: () => host.onExit() }); push({ kind: 'title', root: true, items }); }
  function pauseMenu() { if (scene !== 'play' || menus.length || !g || g.state !== 'play') return; audio.sfx('blip'); audio.hush(); audio.music('title'); push({ title: 'PAUSED', pause: true, items: [
    { label: 'RESUME', act: resume }, { label: 'MAP', act: () => mapMenu() }, { label: 'OPTIONS', act: optionsMenu },
    { label: daily ? 'QUIT RUN' : 'SAVE AND QUIT', act: () => { if (!testRun && !daily && !rush) LS.set('save', returnTo ? { ...returnTo, loop: loopN } : { ...snapshot(g), loop: loopN, z: g.boss ? g.checkpoint : Math.max(g.checkpoint, Math.floor(g.camZ - 4)) }); showTitle(); } }] }); } // saves the exact spot (or the pre-boss checkpoint during a boss)
  const track = () => { const L = LEVELS[levelId]; return g?.boss ? 'boss' : L.isArena ? 'arena' : L.isBonus ? 'bonus' : MUSIC[levelId] || 'play'; };
  function resume() { menus.length = 0; audio.music(track()); prevIn = { pause: true, fire: true, upgrade: true, bomb: true, drone: true, shiftL: true, shiftR: true, gear: true }; last = performance.now(); acc = 0; }
  function menuInput(i) {
    const m = top(), was = { ...upF }; for (const k in upF) upF[k] = i[k] ? 0 : Math.min(99, upF[k] + 1);
    const e = k => i[k] && !prevM[k] && (was[k] == null || was[k] >= 5); if (!m) return;
    if (tap) { for (const h of hits) if (tap.x >= h.x && tap.x <= h.x + h.w && tap.y >= h.y && tap.y <= h.y + h.h) { if (h.fn) h.fn(tap); else { m.i = h.i; const it = m.items[h.i]; audio.sfx('ok'); if (it.act) it.act(); else it.adj?.(1); } break; } tap = null; prevM = i; return; }
    if (m.travel && !m.travel.done && performance.now() - m.travel.t0 > 3000) { m.travel.done = true; m.items[0].act(); return; }
    if (m.kind === 'title') { const n = m.items.length, mv = j => { if (j >= 0 && j < n && j !== m.i) { m.i = j; audio.sfx('move'); } }; if (e('left')) mv(m.i - 1); if (e('right')) mv(m.i + 1); const cols = Math.ceil(n / 2); if (e('up')) mv(m.i - cols); if (e('down')) mv(Math.min(n - 1, m.i + cols)); if (e('ok')) { audio.sfx('ok'); m.items[m.i].act(); } prevM = i; return; } // the title menu is a grid of two rows
    if (m.kind === 'devlog') { devlogInput(m, e); if (e('back')) popMenu(); prevM = i; return; }
    if (m.kind === 'map' && !m.locked) { const n = NODES.length; if (e('left')) { m.sel = (m.sel + n - 1) % n; audio.sfx('move'); } if (e('right')) { m.sel = (m.sel + 1) % n; audio.sfx('move'); } }
    if (m.kind === 'bug') { const mv = j => { if (j >= 0) { m.i = j; audio.sfx('move'); } }; if (e('left')) mv(bugNear(m, -1, 0)); if (e('right')) mv(bugNear(m, 1, 0)); if (e('down')) mv(bugNear(m, 0, 1)); if (e('up')) mv(bugNear(m, 0, -1)); }
    else if (m.kind === 'scroll') { if (i.up) m.off = Math.max(0, m.off - 6); if (i.down) m.off += 6; }
    else { if (m.tabs && (e('shiftL') || e('shiftR'))) { setTab(m, m.tab + (e('shiftL') ? -1 : 1)); audio.sfx('move'); } if (e('up')) { m.i = (m.i + m.items.length - 1) % m.items.length; audio.sfx('move'); } if (e('down')) { m.i = (m.i + 1) % m.items.length; audio.sfx('move'); } }
    const it = m.items[m.i];
    if (it.adj && (e('left') || e('right'))) { it.adj(e('left') ? -1 : 1); audio.sfx('move'); }
    else if (e('ok')) { audio.sfx('ok'); if (it.act) it.act(); else it.adj?.(1); }
    else if (m.pause && (e('pause') || e('start'))) resume();
    else if (e('back') && !m.root && !m.locked) { if (m.pause) resume(); else popMenu(); }
    prevM = i;
  }

  // ---------- story ----------
  const STORY = ['THE COSMIC SHIFT HAS BEGUN.', 'A RIFT FROM PLANET X IS FOLDING REALITY,', 'ONE WORLD AT A TIME.', "EARTH'S OWN DEFENCE GRID HAS TURNED ON ITS CITIES.", 'ONE SHIP CAN SEE ALL FOUR FACES OF THE FOLD.', 'YOURS.', 'SHIFT WITH IT. OR BE FLATTENED.'];
  // between planets: a short flight with RIVET-9 on comms, his face doing the acting
  // between planets: a short flight with RIVET-9 on comms, his face doing the acting. The story runs through all three, and ties into the ending
  const CUT = { mars: [['happy', "OVERSEER IS DOWN. EARTH'S GRID IS OURS AGAIN!"], ['smug', 'FUN FACT: I USED TO WORK FOR THAT THING. I WAS ITS SPELLCHECKER.'], ['shock', 'BEFORE IT CRASHED, IT SENT ONE WORD TO MARS... WAKE.'], ['scared', 'THE STONE HEADS ON MARS ARE NOT STATUES. THEY ARE ANTENNAS.'], ['angry', "THE FOLD IS LISTENING THROUGH THEM. LET'S GO BREAK ITS EARS!"]],
    jupiter: [['starry', 'THE COLOSSUS FELL! AND IT TALKED ON THE WAY DOWN!'], ['shock', 'THE FOLD CANNOT SEE DEPTH. IT ONLY EVER SEES ONE SIDE AT A TIME.'], ['grin', 'THAT IS WHY IT HATES YOU. YOU SEE ALL FOUR.'], ['scared', 'SO IT GREW ITSELF AN EYE. A BIG ONE. INSIDE JUPITER.'], ['scared', 'IT IS LOOKING AT YOU. ONLY YOU. NOT ME. PROBABLY.']],
    x: [['smug', 'THE EYE IS SHUT. TOLD YOU WE HAD THIS.'], ['shock', 'WAIT. I PULLED SOMETHING OUT OF ITS LAST LOOK. COORDINATES.'], ['scared', 'PLANET X IS NOT A PLANET. IT IS A DREAM SOMETHING IS HAVING.'], ['shock', 'AND THE DREAMER IS FAR PAST PLUTO. STILL ASLEEP.'], ['angry', 'BREAK THE DREAM AND MAYBE IT STAYS ASLEEP. END THE SHIFT, PILOT!']] };
  const PCOL = { earth: '#2ee6ff', mars: '#ff8a2b', jupiter: '#9d5bff', x: '#3dffb0' };
  const BRIEF = { mars: ['EARTH HOLDS.', 'BUT THE SHIFT ROLLS ON.', 'MARS IS FOLDING. ITS FORGES ARE AWAKE,', 'AND THE STONE HEADS HAVE OPENED THEIR EYES.'], jupiter: ['MARS IS COOLING.', 'THE RIFT HAS REACHED JUPITER.', 'THE STORM HAS AN EYE NOW.', 'AND IT IS LOOKING AT YOU.'], x: ['THE STORM IS QUIET.', 'ONE WORLD LEFT. THE ONE THAT STARTED IT.', 'PLANET X IS NOT A PLACE. IT IS ALIVE.', 'END THE SHIFT.'] };
  const ENDING = ['THE SHIFTER FOLDS IN ON ITSELF.', 'FOUR FACES. THEN TWO. THEN ONE. THEN NOTHING.', 'THE RIFT CLOSES BEHIND YOU LIKE A WOUND.', "JUPITER'S STORM GOES BACK TO BEING ONLY A STORM.", 'THE FORGES OF MARS GO DARK. THE STONE HEADS CLOSE THEIR EYES.', 'ON EARTH, THE GRID WAKES AND REMEMBERS WHOSE SIDE IT IS ON.', 'NOBODY DOWN THERE WILL KNOW HOW CLOSE THE WORLD CAME TO BEING FLAT.', 'YOU DO. YOU SAW EVERY SIDE OF IT.', 'BUT FAR PAST PLUTO, THE DREAMER ROLLS OVER IN ITS SLEEP...'];
  // the ending, then the credit roll, then the choice to loop
  function beginEnding() { if (bug) bugTick(bugId || 'end'); finish(true); endCarry = carry({ lives: Math.min(6, Math.max(0, g.players[0].lives) + 1) }); award('end'); if (!assisted && !testRun) award('solo'); if (!testRun && !daily) { if (coop) LS.del('save'); else LS.set('save', { ...endCarry, level: 'earth', z: 0, loop: loopN + 1 }); } startStory(ENDING, startCredits, true); }
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
  function drawCut(st) { const t = st.t / 60, c = st.cut, per = st.per || 150, n = st.lines.length, k = Math.min(n - 1, st.t / per | 0), dur = n * per + 120, f = Math.min(1, st.t / dur), TAU2 = Math.PI * 2;
    ctx.fillStyle = '#02010a'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter';
    for (let q = 0; q < 110; q++) { const sp = 2 + q % 4 * 2.5, x = W - ((q * 197 + st.t * sp) % (W + 80)), y = (q * 71 + q * q * 3) % 380; ctx.strokeStyle = '#8fa8ff'; ctx.globalAlpha = 0.15 + (q % 5) * 0.1; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sp * 4, y); ctx.stroke(); } ctx.globalAlpha = 1; // stars streaking past
    const e = f * f * (3 - 2 * f); orb(220 - e * 360, 200, 70 - e * 30, PCOL[c.from] || '#2ee6ff', 0.9 * (1 - e * 0.6), t, c.from === 'mars'); // the world you saved slides away behind
    const tx = 860 - e * 120, tr = 26 + e * 96; orb(tx, 190, tr, PCOL[c.to] || '#ff3df0', 0.95, t, c.to === 'jupiter'); // the next one looms
    ctx.strokeStyle = '#ff3df0'; ctx.lineWidth = 2; for (let j = 0; j < 2; j++) { ctx.globalAlpha = (0.5 + 0.4 * Math.sin(t * 6 + j)) * Math.min(1, e * 2); ctx.beginPath(); for (let q = 0; q <= 8; q++) { const yy = 190 - tr + q * tr / 4, xx = tx - tr * 0.2 + j * 10 + Math.sin(q * 1.9 + t * 3 + j) * tr * 0.12 + (q % 2 ? 6 : -6); q ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); } ctx.globalAlpha = 1; // the rift cracked across it
    const bob = Math.sin(t * 2.2) * 6, sx = 380 + Math.sin(t * 0.7) * 30, sy = 250 + bob; // the ship, with RIVET-9 tucked in behind
    for (const [x, y, s2, cols] of [[sx - 110, sy + 44 + Math.sin(t * 2.2 + 1) * 5, 30, ['#ffb070', '#ffe14a', '#ffb070']], [sx, sy, 46, ['#ffffff', '#2ee6ff', '#ff3df0']]]) { ctx.strokeStyle = cols[1]; ctx.lineWidth = 2; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.moveTo(x - s2 * 0.8, y); ctx.lineTo(x - s2 * 0.8 - 60 - 20 * Math.sin(t * 30 + x), y); ctx.stroke(); ctx.globalAlpha = 1;
      const rl = Math.sin(t * 1.3 + x) * 0.25; meshScreen(ctx, SHIP_HULL, x, y, s2, Math.PI / 2, 0.25, rl, cols[0]); meshScreen(ctx, SHIP_WING, x, y, s2, Math.PI / 2, 0.25, rl, cols[1]); meshScreen(ctx, SHIP_FIN, x, y, s2, Math.PI / 2, 0.25, rl, cols[2]); }
    ctx.globalCompositeOperation = 'source-over';
    text(ctx, 'NEXT  //  ' + LEVELS[c.to].name, 860 - e * 120, 190 + tr + 18, 11, PCOL[c.to] || '#ffffff', { align: 'center', bold: true, alpha: Math.min(1, e * 3) });
    // RIVET-9 on comms along the bottom
    const bx = 120, by = 392, bw = 720, bh = 104, age = st.t - k * per, ln = st.lines[k], shown = Math.max(0, age * 1.1 | 0), talking = shown < ln.length, ex = c.faces[k] || 'happy';
    ctx.fillStyle = 'rgba(6,4,22,0.9)'; rr(bx, by, bw, bh, 12); ctx.fill(); ctx.strokeStyle = '#ffb070'; ctx.lineWidth = 2; ctx.shadowColor = '#ffb070'; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,176,112,0.16)'; rr(bx, by, bw, 18, [12, 12, 0, 0]); ctx.fill(); ctx.fillStyle = '#3dff6a'; ctx.beginPath(); ctx.arc(bx + 110, by + 9, 3, 0, TAU2); ctx.fill(); text(ctx, 'RIVET-9', bx + 118, by + 5, 8, '#ffb070', { bold: true, glow: false }); text(ctx, 'COMMS OPEN', bx + bw - 14, by + 5, 7, '#7d8bd6', { align: 'right', glow: false });
    ctx.fillStyle = '#04081a'; rr(bx + 10, by + 10, 86, 86, 8); ctx.fill(); ctx.strokeStyle = '#3a4cb8'; ctx.lineWidth = 1; ctx.stroke(); rivetFace(ctx, bx + 53, by + 56, 34, ex, talking && (st.t >> 2) % 2 === 0, st.t, age);
    const words = ln.split(' '), lines = []; let cur = ''; for (const w of words) { if ((cur + ' ' + w).trim().length > 44 && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } lines.push(cur);
    let left = shown; lines.forEach((l2, j) => { if (left <= 0) return; text(ctx, l2.slice(0, left), bx + 112, by + 32 + j * 22, 13, '#ffffff', { bold: true, glow: j === 0 }); left -= l2.length + 1; });
    for (let j = 0; j < n; j++) { ctx.fillStyle = j <= k ? '#ffb070' : '#30345a'; ctx.fillRect(bx + bw - 16 - (n - j) * 12, by + bh - 12, 8, 4); }
    text(ctx, lastDev === 'touch' ? 'TAP TO SKIP' : lastDev === 'pad' ? padNames()[0] + ' TO SKIP' : 'ENTER TO SKIP', 480, 522, 7, '#5a66b0', { align: 'center', glow: false }); }
  function drawStory() { const st = story, t = performance.now() / 1000; if (st.end) return drawEnding(st); if (st.cut) return drawCut(st); ctx.fillStyle = '#02010a'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#8fa8ff'; for (let k = 0; k < 80; k++) { ctx.globalAlpha = 0.2 + (k % 5) * 0.12; ctx.fillRect((k * 131 + st.t * (0.2 + k % 3 * 0.15)) % W, (k * 71) % H, 1.5, 1.5); } ctx.globalAlpha = 1;
    const ex = 760, ey = 300, er = 92; ctx.strokeStyle = '#2ee6ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.stroke(); ctx.globalAlpha = 0.5; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.ellipse(ex, ey, er, er * k / 4, 0, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.ellipse(ex, ey, er * Math.abs(Math.cos(t * 0.3 + k * 0.8)), er, 0, 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ff3df0'; ctx.lineWidth = 2; for (let j = 0; j < 3; j++) { ctx.beginPath(); for (let k = 0; k <= 14; k++) { const yy = 60 + k * 30, xx = 600 + j * 14 + Math.sin(k * 1.7 + t * 2 + j) * (10 + k * 1.5) + (k % 2 ? 9 : -9); k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.globalAlpha = 0.9 - j * 0.3; ctx.stroke(); } ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over'; const per = 150, n = Math.min(st.lines.length, 1 + (st.t / per | 0));
    for (let k = 0; k < n; k++) { const age = st.t - k * per, ln = st.lines[k], shown = ln.slice(0, Math.max(0, age * 0.9 | 0)); text(ctx, shown, 70, 110 + k * 44, ln.length > 44 ? 10 : 13, k === n - 1 ? '#ffffff' : '#8d9be0', { glow: k === n - 1 }); }
    text(ctx, lastDev === 'touch' ? 'TAP TO SKIP' : lastDev === 'pad' ? padNames()[0] + ' TO SKIP' : 'ENTER TO SKIP', 480, 512, 7, '#5a66b0', { align: 'center', glow: false }); }

  // ---------- flow ----------
  function showTitle() { bug = false; scene = 'title'; sceneT = 0; g = null; loopN = 0; cred = null; rush = null; returnTo = null; coop = false; daily = null; rec = null; ghost = null; attract = null; titleMenu(); audio.music('title'); host.onState?.({ scene }); setTimeout(() => { if (scene === 'title' && menus.length === 1) audio.say('2diso | shift', true); }, 700); } // the title voiceover
  function startLevel(id, start) { menus.length = 0; story = null; hiShown = false; toasts.length = 0; levelId = id; const L = LEVELS[id];
    const seed = daily ? daily.key * 31 + daily.n++ : (Math.random() * 1e9) | 0, st = { gear: opt.gear, ...(start || {}) }, wing = !!opt.assist && !coop;
    g = createGame({ seed, level: buildLevel(id), start: st, players: coop ? 2 : 1, wing, mut: { ...(daily ? daily.mut : rush ? { rush: true } : { loop: loopN }), ...(bug ? { bug: true } : {}) } }); if (bug) { rec = null; } if (testRun || opt.idle || opt.assist || coop) assisted = true; submitted = false; scene = 'play'; sceneT = 0; warpT = 0; endInfo = null;
    rec = null; ghost = null; if (!L.isBonus && !st.z && !opt.idle && !coop && !daily && !loopN && !rush) { rec = { v: VER, seed, start: JSON.parse(JSON.stringify(st)), wing, runs: [] }; const gd = opt.ghost && LS.get('ghost.' + id, null); if (gd && gd.v === VER) ghost = { g: createGame({ seed: gd.seed, level: buildLevel(id), start: gd.start, wing: gd.wing }), runs: gd.runs, k: 0, n: 0 }; }
    audio.sfx('whoosh'); audio.music(track()); audio.say((L.isArena ? 'bonus arena. ' : L.isBonus ? 'bonus stage. ' : 'level ' + L.n + '. ') + L.name + '.', true); prevIn = { ...HELD, fire: true, upgrade: true, gear: true }; host.onState?.({ scene }); }
  function carry(extra) { const s = snapshot(g), p = g.players[0]; return { score: g.score, lives: Math.max(0, p.lives), bombs: p.bombs, up: [...p.up], shield: p.shield, cursor: p.cursor, dmode: p.dmode, gear: g.gear, ...extra }; }
  function finish(cleared) { if (!g || submitted || testRun) return; submitted = true; if (daily) { const db = LS.get('daily', null); if (!db || db.key !== daily.key || g.score > db.score) LS.set('daily', { key: daily.key, score: g.score, cleared }); return; } const res = { score: g.score, cleared, assisted, level: LEVELS[levelId].n || LEVELS[LEVELS[levelId].of]?.n || 0, chain: g.bestChain, kills: g.stats.kills, shifts: g.stats.shifts };
    const best = LS.get('best', 0); if (g.score > best) LS.set('best', g.score); const rows = LS.get('scores', []); rows.push({ name: coop ? 'CO-OP' : assisted ? 'ASSIST' : 'YOU', score: g.score, assisted }); rows.sort((a, b) => b.score - a.score); LS.set('scores', rows.slice(0, 8));
    try { host.submitScore?.(res); } catch { } return res; }
  function rushGo(c) { const id = RUSH[rush.i], L = LEVELS[id], lv = buildLevel(id), cps = L.isBonus ? null : lv.checkpoints, me = L.isBonus && lv.events.find(e => e.fn.mini); startLevel(id, { ...c, z: cps ? cps[cps.length - 1] : me ? me.z - 6 : 0 }); /* warp stages start just before their miniboss arrives */ toast('BOSS RUSH  ' + (rush.i + 1) + ' / ' + RUSH.length, L.isArena || L.isBonus ? L.name : 'BOSS: ' + L.boss); }
  function bugDone() { return LS.get('bugtest', {}); }
  let bugId = null; // which bug test entry this run counts for, when it is a single fight
  function bugTick(id) { const d = bugDone(); if (d[id]) return; d[id] = 1; LS.set('bugtest', d); const n = BUGLIST.filter(b => d[b[0]]).length; toast('TESTED: ' + (BUGLIST.find(b => b[0] === id) || [, id])[1], n >= BUGLIST.length ? 'ALL TESTED - READY TO PUBLISH' : n + ' / ' + BUGLIST.length + ' DONE'); audio.sfx('ring'); }
  function bugStart(id) { if (id === 'rush') { menus.length = 0; startRush(true); return; }
    bug = true; bugId = null; testRun = true; returnTo = null; coop = false; daily = null; rush = null; loopN = 0; assisted = true; const L = LEVELS[id];
    if (id === 'end') { const cps = buildLevel('x').checkpoints, k = bugKit(); startLevel('x', { up: [...k.up], shield: k.shield, bombs: k.bombs, lives: k.lives, z: cps[cps.length - 1] }); toast('BUG TEST: ENDING', 'BEAT THE BOSS, WATCH THE ENDING, PICK LOOP'); return; }
    if (/^(boss|mini)-/.test(id)) { const lv = id.slice(id.indexOf('-') + 1), B = buildLevel(lv), k = bugKit(), me = B.events.find(e => e.fn.mini), z = id.startsWith('boss') ? B.checkpoints[B.checkpoints.length - 1] : me ? me.z - 6 : 0; bugId = id; startLevel(lv, { up: [...k.up], shield: k.shield, bombs: k.bombs, lives: k.lives, z }); toast('BUG TEST: ' + BUGLIST.find(b => b[0] === id)[1], 'NO DAMAGE. LOADOUT: ' + bugKitText()); return; } // straight to the fight
    const k = bugKit(); startLevel(id, { up: [...k.up], shield: k.shield, bombs: k.bombs, lives: k.lives }); toast('BUG TEST: ' + (BUGLIST.find(b => b[0] === id) || [, id])[1], 'NO DAMAGE. LOADOUT: ' + bugKitText()); }
  const KITROWS = [['DRONES', 0, 6], ['MISSILE', 1, 3], ['LASER', 2, 3], ['WAVE', 3, 3], ['BOLT', 4, 3], ['SPREAD', 5, 3], ['BOMB TIER', 7, 3], ['HYPERDRIVE', 8, 1], ['SHIELD', 'shield', 3], ['BOMBS', 'bombs', 9], ['SHIPS', 'lives', 9]];
  const bugKit = () => Object.assign({ up: [0, 0, 0, 0, 0, 0, 0, 0, 0], shield: 1, bombs: 3, lives: 3 }, LS.get('bugkit', {}));
  const bugKitText = () => { const k = bugKit(), w = k.up.slice(1, 6).reduce((a, b) => a + b, 0); return w || k.up[0] || k.up[7] || k.up[8] ? 'D' + k.up[0] + ' W' + w + '/15 B' + k.up[7] + (k.up[8] ? ' HYPER' : '') : 'NOTHING'; };
  function kitMenu() { const set = (r, d) => { const k = bugKit(), key = r[1]; if (typeof key === 'number') k.up[key] = Math.max(0, Math.min(r[2], k.up[key] + d)); else k[key] = Math.max(key === 'lives' ? 1 : 0, Math.min(r[2], k[key] + d)); LS.set('bugkit', k); };
    push({ title: 'LOADOUT', gap: 22, notes: ['EVERY BUG TEST STARTS WITH THIS. LEFT / RIGHT TO CHANGE'], items: [...KITROWS.map(r => ({ label: () => { const k = bugKit(), v = typeof r[1] === 'number' ? k.up[r[1]] : k[r[1]]; return r[0] + '  ' + v + ' / ' + r[2]; }, adj: d => set(r, d) })),
      { label: 'MAX EVERYTHING', act: () => { LS.set('bugkit', { up: [6, 3, 3, 3, 3, 3, 0, 3, 1], shield: 3, bombs: 9, lives: 9 }); audio.sfx('ring'); } }, { label: 'EMPTY', act: () => { LS.set('bugkit', {}); audio.sfx('blip'); } }, { label: 'BACK', act: popMenu }] }); }
  function bugMenu() { const d = bugDone(); push({ title: 'BUG TEST', kind: 'bug', items: [...BUGLIST.map(b => ({ label: b[1], id: b[0], act: () => bugStart(b[0]) })),
      { label: () => 'SKIN  ' + SKIN[opt.skin | 0][0] + (opt.skinTest && !skinReal(opt.skin | 0) ? '  (TEST)' : ''), id: 'skin', act: () => { opt.skin = ((opt.skin | 0) + 1) % SKIN.length; opt.skinTest = true; skinView = opt.skin; saveOpt(); audio.sfx('blip'); } },
      { label: () => 'LOADOUT  ' + bugKitText(), id: 'kit', act: kitMenu },
      { label: 'CLEAR THE LIST', id: 'reset', act: () => { LS.set('bugtest', {}); toast('BUG TEST', 'LIST CLEARED'); } }, { label: 'BACK', id: 'back', act: popMenu }], i: Math.max(0, BUGLIST.findIndex(b => !d[b[0]])) }); }
  function bugPos(k) { const NB = BUGLIST.length; if (k < 12) return [80 + (k % 3) * 280, 120 + (k / 3 | 0) * 34, 240]; if (k < 14) return [220 + (k - 12) * 280, 384, 240]; if (k < NB) { const j = k - 14; return [46 + (j % 4) * 220, 280 + (j / 4 | 0) * 32, 214]; } if (k < NB + 2) return [140 + (k - NB) * 360, 420, 320]; return [220 + (k - NB - 2) * 280, 456, 240]; }
  function bugNear(m, dx, dy) { const [x0, y0, w0] = bugPos(m.i), cx = x0 + w0 / 2; let best = -1, bs = 1e9; m.items.forEach((_, k) => { if (k === m.i) return; const [x, y, w] = bugPos(k), ddx = x + w / 2 - cx, ddy = y - y0; if (dy && Math.sign(ddy) !== dy) return; if (dx && (Math.abs(ddy) > 4 || Math.sign(ddx) !== dx)) return; const sc = dy ? Math.abs(ddy) * 4 + Math.abs(ddx) : Math.abs(ddx); if (sc < bs) { bs = sc; best = k; } }); return best; } // move to the nearest item in that direction
  function drawBug(m) { const d = bugDone(), n = BUGLIST.filter(b => d[b[0]]).length, all = n >= BUGLIST.length, t = performance.now() / 1000;
    text(ctx, all ? 'ALL ' + n + ' TESTED - READY TO PUBLISH. TELL CLAUDE TO HIDE THIS MENU' : n + ' / ' + BUGLIST.length + ' TESTED.  PICK ONE: NO DAMAGE, STARTS WITH YOUR LOADOUT, CLEAR IT TO TICK IT OFF', 480, 84, 7, all ? '#3dffb0' : '#9fb0ff', { align: 'center', glow: all });
    ['PLANET', 'WARP STAGE', 'ARENA'].forEach((h, c) => text(ctx, h, 200 + c * 280, 104, 7, '#6a76c0', { align: 'center', glow: false })); text(ctx, 'BOSSES AND WARP-STAGE MINIBOSSES', 480, 264, 7, '#6a76c0', { align: 'center', glow: false });
    const NB = BUGLIST.length; m.items.forEach((it, k) => { const [x, y, w] = bugPos(k);
      const on = k === m.i, ok = d[it.id], lab = it.label; if (on) { ctx.fillStyle = '#ff3df0'; ctx.globalAlpha = 0.16 + 0.06 * Math.sin(t * 6); ctx.fillRect(x - 8, y - 9, w, 30); ctx.globalAlpha = 1; }
      if (k < BUGLIST.length) { ctx.strokeStyle = ok ? '#3dffb0' : '#30345a'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y - 1, 14, 14); if (ok) { ctx.strokeStyle = '#3dffb0'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x + 3, y + 6); ctx.lineTo(x + 6, y + 10); ctx.lineTo(x + 12, y + 2); ctx.stroke(); } }
      text(ctx, typeof lab === 'function' ? lab() : lab, x + (k < BUGLIST.length ? 24 : w / 2 - 8), y, k >= 14 && k < BUGLIST.length ? 8.5 : 10, on ? '#ffffff' : ok ? '#3dffb0' : '#8d9be0', { glow: on, align: k < BUGLIST.length ? 'left' : 'center' }); hits.push({ x: x - 8, y: y - 9, w, h: 30, i: k }); }); }
  function startRush(asBug) { bug = !!asBug; testRun = false; returnTo = null; coop = false; daily = null; assisted = true; loopN = 0; rush = { i: 0, t: 0, won: 0 }; const k = bug ? bugKit() : null; rushGo(k ? { up: [...k.up], shield: k.shield, bombs: k.bombs, lives: k.lives, score: 0 } : { up: [3, 2, 2, 2, 2, 2, 0, 0], shield: 2, lives: 5, score: 0 }); }
  function rushStep(cleared) { const lives = g.players[0].lives; if (cleared) rush.won++; if (!opt.idle && cleared && RUSH[rush.i]) { }
    if (cleared && rush.i < RUSH.length - 1) { rush.i++; rushGo(carry()); return; } // straight into the next one: no results screen, no map, no story
    const done = cleared && rush.i === RUSH.length - 1, secs = rush.t / 60, best = LS.get('rush', null), r = { won: rush.won, time: Math.round(secs), score: g.score }, better = !best || r.won > best.won || (r.won === best.won && (done ? r.time < best.time : r.score > best.score));
    if (bug && done) bugTick('rush'); if (better && !opt.idle && !bug) LS.set('rush', r); if (done && !opt.idle) award('rush'); audio.music('title'); audio.sfx(done ? 'clear' : 'die');
    push({ title: done ? 'BOSS RUSH COMPLETE' : 'BOSS RUSH OVER', root: true, notes: ['DEFEATED  ' + rush.won + ' / ' + RUSH.length, 'TIME  ' + mmss(secs), 'SCORE  ' + g.score, better ? '+NEW BEST' : best ? 'BEST  ' + best.won + ' / ' + RUSH.length + '   ' + mmss(best.time) + '   ' + best.score : ''], items: [{ label: 'RUN IT AGAIN', act: startRush }, { label: 'BACK TO TITLE', act: showTitle }] }); }
  function endMenu(cleared) { const L = LEVELS[levelId]; endInfo = { cleared, t: 0, bonus: !!L.isBonus }; audio.music('title'); let items;
    if (cleared && !L.isBonus) { const secs = g.stats.ticks / 60, par = PAR[levelId] || 0; endInfo.time = secs; endInfo.par = par; endInfo.tb = par ? Math.max(0, Math.round((par * 1.5 - secs) * 20 / 10) * 10) : 0; g.score += endInfo.tb; // the faster the clear, the bigger the bonus
      let m = 0; MEDALS.forEach((d, k) => { if (d[1](g, levelId)) m |= 1 << k; }); endInfo.medals = m;
      if (!opt.idle && !bug) { const all = LS.get('medals', {}); if (bits(m) > bits(all[levelId] || 0)) { all[levelId] = m; LS.set('medals', all); endInfo.newRank = true; }
        if (rec && rec.runs.length < 40000) { const gain = g.score - (rec.start.score || 0), old = LS.get('ghost.' + levelId, null); if (!old || old.v !== VER || gain > old.gain) { LS.set('ghost.' + levelId, { ...rec, gain }); endInfo.newGhost = true; } } } }
    if (!bug) achEnd(cleared, endInfo.medals || 0); rec = null; ghost = null;
    const goNext = (from, c) => { const nx = LEVELS[from].next, cl = CUT[nx]; startStory(cl ? cl.map(q => q[1]) : BRIEF[nx] || [], () => { scene = 'play'; travel(from, nx, () => startLevel(nx, c)); }); if (cl) { story.cut = { from, to: nx, faces: cl.map(q => q[0]) }; story.per = 210; } };
    if (bug) { if (cleared) bugTick(bugId || levelId); endInfo.bugHits = g.stats.bugHits || 0;
      items = [{ label: 'BACK TO BUG TEST', act: () => { showTitle(); bugMenu(); } }, ...(cleared ? [] : [{ label: 'RETRY', act: () => bugStart(levelId) }]), ...(cleared && levelId === 'x' ? [{ label: 'PLAY THE ENDING', act: beginEnding }] : [])];
      push({ kind: 'end', root: true, cleared, items }); return; }
    if (L.isArena) { const back = returnTo; items = [{ label: 'CONTINUE', act: () => { if (back) { returnTo = null; const st = { ...back, ...carry({ lives: back.lives }), z: back.z, arena: true }; travel(levelId, back.level, () => { startLevel(back.level, st); toast('BACK ON ' + LEVELS[back.level].name, 'DROPPED AT THE NEXT CHECKPOINT'); }); } else showTitle(); } }]; }
    else if (L.isBonus) { const back = returnTo; items = [{ label: 'CONTINUE', act: () => { if (back) { returnTo = null; const st = { ...back, ...carry({ lives: back.lives, warp: true }), z: back.z }; travel(levelId, back.level, () => startLevel(back.level, st)); } else showTitle(); } }]; }
    else if (cleared) { if (!testRun && !daily) { if (g.level.final) LS.del('save'); else LS.set('save', { ...carry(), level: L.next, z: 0, loop: loopN }); }
      items = [{ label: 'CONTINUE', act: () => { const nx = L.next; if (testRun) { if (nx) showTitle(); else beginEnding(); return; } if (!nx) beginEnding(); else goNext(levelId, carry({ lives: Math.min(6, g.players[0].lives + 1) })); } }]; }
    else { finish(false); items = daily ? [{ label: 'QUIT TO TITLE', act: showTitle }] : [{ label: 'RETRY FROM CHECKPOINT', act: () => { assisted = true; startLevel(levelId, { ...g.cpSnap, lives: 3 }); } }, { label: 'QUIT TO TITLE', act: showTitle }]; }
    push({ kind: 'end', root: true, cleared, items }); }

  // ---------- frame ----------
  let prevIn = {};
  function update(i) {
    sceneT++; if (scene === 'intro' && sceneT < 3 && !logosReady() && (introWait = (introWait || 0) + 1) < 180) sceneT = 0; /* the intro waits (up to 3 s) for the logo images */
    if (scene === 'intro') { if ((i.ok && !prevM.ok) || (i.pause && !prevM.pause) || tap || sceneT > 600) { tap = null; showTitle(); titleT = 0; audio.sfx('slam'); } if (sceneT === 330) audio.sfx('whoosh'); prevM = i; return; }
    if (scene === 'story') { const st = story, per = st.per || 150; st.t++; const k = st.t / per | 0; if (k < st.lines.length && k !== st.said) { st.said = k; audio.say(st.lines[k].replace('(C)', 'copyright'), true); } if (st.end && st.t < 90) tap = null; if (tap || (st.t >= (st.end ? 90 : 0) && ((i.ok && !prevM.ok) || (i.pause && !prevM.pause))) || st.t > st.lines.length * per + 120) { tap = null; audio.hush(); const f = st.after; story = null; f(); } prevM = i; return; }
    if (scene === 'title') { titleT++; menuInput(i); return; } // no game runs behind the title any more: it is a still, cheap backdrop
    if (scene === 'credits') { if (menus.length) { menuInput(i); return; } cred.y = Math.min(cred.max, cred.y + (i.ok || i.down ? 3 : 0.5)); if (tap) { tap = null; cred.y = Math.min(cred.max, cred.y + 160); }
      if ((cred.y >= cred.max && ++cred.hold > 100) || (sceneT > 40 && ((i.pause && !prevM.pause) || (i.back && !prevM.back)))) creditsMenu(); prevM = i; return; }
    if (menus.length) { if (top().kind === 'end' && endInfo) { endInfo.t++; step(g, [{}]); } menuInput(i); return; }
    if (i.pause && !prevIn.pause) { pauseMenu(); prevIn = i; return; }
    let ins; if (opt.idle) { assisted = true; rec = null; ins = g.players.map((_, k) => autopilot(g, k)); } else if (coop) ins = [i.p1 || i, i.p2 || {}];
    else { let a = i; if (g.level.rules?.arena && !i.aim && lastDev === 'kb' && performance.now() - mouse.t < 5000) { const p = g.players[0]; let wx, wz; const pv = PIV[g.view === 3 ? 3 : 1], ux = pv[0] + (mouse.x - pv[0]) / 0.52, uy = pv[1] + (mouse.y - pv[1]) / 0.52; /* undo the arena zoom */ if (g.view === 3) { wx = (ux - 480) / 40; wz = (480 - uy) / 19; } else { wx = (uy - 319 + 11 / 26 * (ux - 150)) / 15.923; wz = (ux - 150 - 14 * wx) / 26; } i.aim = [wx - p.x, wz - p.z]; if (mouse.down) i.fire = true; }
      if (opt.autobomb && g.state === 'play' && g.intro <= 0 && g.tick % 600 === 599 && g.players[0].bombs > 0 && g.players[0].dead <= 0) i.bomb = true; /* auto detonate: a bomb every ten seconds while you have one */
      if (rec) { const c = enc(i), r = rec.runs, n = r.length; if (n && r[n - 2] === c) r[n - 1]++; else r.push(c, 1); a = dec(c); } ins = [a]; }
    step(g, ins); prevIn = i; if (!opt.idle && g.tick % 30 === 0) achTick();
    if (ghost) { if (ghost.g.state === 'play' && ghost.k < ghost.runs.length) { step(ghost.g, [dec(ghost.runs[ghost.k])]); if (++ghost.n >= ghost.runs[ghost.k + 1]) { ghost.k += 2; ghost.n = 0; } } else ghost = null; }
    for (const f of g.fx) { if (f.startsWith('say:')) { audio.say(f.slice(4), true); continue; } if (f.startsWith('toast:')) { const [a, b] = f.slice(6).split('|'); toast(a, b); continue; }
      if (f === 'shift' && g.intro <= 0) audio.say(VIEWS[g.view] + ' view'); if (f === 'hint' && g.hint && !g.hint.includes(' / ')) audio.say(rivetLine(g.hint).replace('//', '.').replace(/ - /g, '. '), true); audio.sfx(f === 'go' ? 'ok' : f === 'gear' ? 'blip' : f);
      if (f === 'bossin') audio.music('boss'); if (f === 'die' || f === 'bomb' || f === 'boom2' || f === 'perfect') window.ArcadeGridzPad?.rumble?.(f === 'boom2' ? 160 : 260, 0.8); }
    if (!hiShown && !assisted && g.score > LS.get('best', 0) && LS.get('best', 0) > 0) { hiShown = true; toast('NEW HIGH SCORE', 'KEEP IT ROLLING'); audio.sfx('ring'); audio.say('new high score'); }
    // a warp ring: jump to the bonus stage, and come back to this spot afterwards
    if (g.flags.warpNow && g.state === 'play') { if (++warpT > 80) { const L = LEVELS[levelId]; g.flags.warpNow = false;
      if (g.flags.warpTo === 'arena') { g.flags.warpTo = null; const af = LS.get('arenaFound', {}); af[levelId] = 1; LS.set('arenaFound', af); const nxt = (g.level.checkpoints || []).find(c => c > g.camZ + 1); // the arena warp: fight the arena, then get dropped at the next checkpoint
        returnTo = { ...snapshot(g), level: levelId, z: nxt ?? g.camZ + 4, arena: true, stats: { ...g.stats } }; const c = carry(); travel(levelId, 'arena-' + levelId, () => startLevel('arena-' + levelId, c)); return; }
      const w = LS.get('warps', {}); w[levelId] = 1; LS.set('warps', w); if (L.bonus) { returnTo = { ...snapshot(g), level: levelId, z: g.camZ + 4, warp: true, stats: { ...g.stats } }; const c = carry(); travel(levelId, L.bonus, () => startLevel(L.bonus, c)); return; } } }
    if (rush && g.state === 'play' && !g.paused) rush.t++;
    if (g.state !== 'play' && g.endT > (g.state === 'clear' ? 100 : 70) && !menus.length) { if (rush) rushStep(g.state === 'clear'); else endMenu(g.state === 'clear'); }
  }
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); };
  function panel(x, y, w, h, col = '#2ee6ff') { rr(x, y, w, h, 18); ctx.fillStyle = 'rgba(6,5,24,.84)'; ctx.fill(); ctx.strokeStyle = col; ctx.globalAlpha = 0.1; ctx.lineWidth = 10; ctx.stroke(); ctx.globalAlpha = 0.55; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1; } // a soft glass card, not a hard box
  // menu items are neon pill buttons, as on the site and in the app: cyan outline at rest, the chosen one lit amber and lifted
  function drawGrid(m, y0) { const cols = Math.ceil(m.items.length / 2), pw = cols > 2 ? 196 : 230, ph = 30, gx = 16, gy = 12, t = performance.now() / 1000, rows = Math.ceil(m.items.length / cols);
    m.items.forEach((it, k) => { const r = k / cols | 0, c = k % cols, inRow = Math.min(cols, m.items.length - r * cols), x = 480 - (inRow * pw + (inRow - 1) * gx) / 2 + c * (pw + gx), y = y0 + r * (ph + gy), on = k === m.i, lab = typeof it.label === 'function' ? it.label() : it.label, lift = on ? 2 : 0;
      rr(x, y - lift, pw, ph, ph / 2); if (on) { ctx.fillStyle = '#ffe14a'; ctx.globalAlpha = 0.22 + 0.06 * Math.sin(t * 5); ctx.lineWidth = 12; ctx.strokeStyle = '#ffe14a'; ctx.stroke(); ctx.globalAlpha = 1; ctx.fill(); ctx.strokeStyle = '#fff2a8'; ctx.lineWidth = 2; ctx.stroke(); }
      else { ctx.fillStyle = 'rgba(9,6,22,.85)'; ctx.fill(); ctx.strokeStyle = '#2ee6ff'; ctx.globalAlpha = 0.16; ctx.lineWidth = 9; ctx.stroke(); ctx.globalAlpha = 0.85; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1; }
      text(ctx, lab, x + pw / 2, y - lift + (ph - 14) / 2, 14, on ? '#17101b' : '#2ee6ff', { align: 'center', glow: !on, bold: true }); hits.push({ x, y: y - lift, w: pw, h: ph, i: k }); }); }
  // the title backdrop: a slow starfield over a neon grid floor, cheap to draw so the title stays smooth
  function titleBack() { const t = performance.now() / 1000; ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 120; k++) { const z = ((k * 0.137 + t * 0.06) % 1), x = 480 + ((k * 197) % 960 - 480) / (z * 3 + 0.4), y = 200 + ((k * 71) % 400 - 200) / (z * 3 + 0.4); if (x < 0 || x > W || y < 0 || y > 360) continue; ctx.fillStyle = k % 7 ? '#8fa8ff' : '#ff9ef2'; ctx.globalAlpha = Math.min(1, (1 - z) * 0.9); const r = (1 - z) * 2 + 0.6; ctx.fillRect(x, y, r, r); } // stars drifting out from the middle
    const hy = 330; ctx.strokeStyle = '#2443c8'; ctx.lineWidth = 1; for (let k = -12; k <= 12; k++) { ctx.globalAlpha = 0.5 - Math.abs(k) * 0.025; ctx.beginPath(); ctx.moveTo(480 + k * 22, hy); ctx.lineTo(480 + k * 150, H); ctx.stroke(); }
    for (let k = 0; k < 9; k++) { const f = ((k + (t * 0.5) % 1) / 9), y = hy + (H - hy) * f * f; ctx.globalAlpha = 0.15 + f * 0.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } // the floor rolls towards you
    const gr = ctx.createLinearGradient(0, hy - 30, 0, hy + 10); gr.addColorStop(0, 'rgba(255,61,240,0)'); gr.addColorStop(1, 'rgba(255,61,240,0.22)'); ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.fillRect(0, hy - 30, W, 40); ctx.globalCompositeOperation = 'source-over'; } // a pink glow on the horizon
  function drawItems(m, cx, y, size, gap) { const t = performance.now() / 1000, labs = m.items.map(it => typeof it.label === 'function' ? it.label() : it.label), pill = gap >= 22;
    if (!pill) { labs.forEach((lab, k) => { const on = k === m.i, w = textWidth(lab, size, true), yy = y + k * gap; text(ctx, lab, cx, yy, size, on ? '#ffe14a' : '#8d9be0', { align: 'center', glow: on, bold: true }); if (on) text(ctx, '>', cx - w / 2 - size * 1.4, yy, size, '#ffe14a', { bold: true }); hits.push({ x: cx - w / 2 - 40, y: yy - 6, w: w + 80, h: size + 12, i: k }); }); return; }
    const sz = Math.min(size, gap * 0.42), ph = Math.min(gap - 6, sz * 2.3), pw = Math.max(170, Math.max(...labs.map(l => textWidth(l, sz, true))) + sz * 4.4);
    labs.forEach((lab, k) => { const it = m.items[k], on = k === m.i, lift = on ? 2 : 0, px = cx - pw / 2, py = y + k * gap - (ph - sz) / 2 - lift, r = ph / 2;
      rr(px, py, pw, ph, r);
      if (on) { ctx.fillStyle = '#ffe14a'; ctx.globalAlpha = 0.22 + 0.06 * Math.sin(t * 5); ctx.lineWidth = 12; ctx.strokeStyle = '#ffe14a'; ctx.stroke(); ctx.globalAlpha = 1; ctx.fill(); ctx.strokeStyle = '#fff2a8'; ctx.lineWidth = 2; ctx.stroke(); }
      else { ctx.fillStyle = 'rgba(9,6,22,.8)'; ctx.fill(); ctx.strokeStyle = '#2ee6ff'; ctx.globalAlpha = 0.16; ctx.lineWidth = 9; ctx.stroke(); ctx.globalAlpha = 0.85; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1; }
      text(ctx, lab, cx, py + (ph - sz) / 2, sz, on ? '#17101b' : '#2ee6ff', { align: 'center', glow: !on, bold: true });
      if (on && it.adj) { text(ctx, '<', px + r * 0.75, py + (ph - sz) / 2, sz, '#17101b', { bold: true, glow: false }); text(ctx, '>', px + pw - r * 0.75 - sz * 0.6, py + (ph - sz) / 2, sz, '#17101b', { bold: true, glow: false }); }
      hits.push({ x: px, y: py, w: pw, h: ph, i: k }); }); }
  function drawMap(m) {
    const t = performance.now() / 1000, sy = 250, warp = LS.get('warps', {}), af = LS.get('arenaFound', {}), ar = LS.get('arenas', {}), bd = LS.get('bonusDone', {}), md = LS.get('medals', {}), found = L => L.isArena ? af[L.of] || ar[L.of] : warp[L.of], done = (L, id) => L.isArena ? ar[L.of] : L.isBonus ? bd[id] : md[id]; ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1; for (const x of [300, 430, 620, 780, 860]) { ctx.strokeStyle = '#26348c'; ctx.beginPath(); ctx.ellipse(90, sy, x - 90, (x - 90) * 0.42, 0, -0.9, 0.9); ctx.stroke(); }
    ctx.fillStyle = '#8d9be0'; for (let k = 0; k < 40; k++) { const a = -0.8 + k / 40 * 1.6 + Math.sin(k * 9) * 0.02, r = 430 + Math.sin(k * 7) * 12; ctx.fillRect(90 + Math.cos(a) * r, sy + Math.sin(a) * r * 0.42, 2, 2); }
    ctx.strokeStyle = '#ff3df0'; ctx.setLineDash([6, 6]); ctx.beginPath(); ORDER.forEach((id, k) => { const n = NODES.find(q => q.id === id); k ? ctx.lineTo(n.x, sy) : ctx.moveTo(n.x, sy); }); ctx.stroke(); ctx.setLineDash([]);
    NODES.forEach((p, k) => { const L = LEVELS[p.id], on = m.sel === k, y = NY(p), col = L.isBonus && !found(L) ? '#5a4a8a' : p.col;
      ctx.strokeStyle = col; ctx.lineWidth = on ? 3 : 1.5;
      if (p.st) { ctx.beginPath(); ctx.arc(p.x, y, 3, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.ellipse(p.x, y, 9, 3.6, t * 0.6, 0, TAU); ctx.stroke(); ctx.lineWidth = 1.2; for (const sx of [-1, 1]) { ctx.strokeRect(p.x + sx * 12 - 3, y - 4, 6, 8); ctx.beginPath(); ctx.moveTo(p.x + sx * 3, y); ctx.lineTo(p.x + sx * 9, y); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(p.x, y - 3); ctx.lineTo(p.x, y - 9); ctx.stroke(); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(p.x, y - 12); ctx.lineTo(p.x, sy + 30); ctx.stroke(); ctx.setLineDash([]); } // a space station: hub, spinning ring, two solar panels, a mast, and a tether line up to its planet
      else { ctx.beginPath(); ctx.arc(p.x, y, p.r, 0, TAU); ctx.stroke(); }
      if (done(L, p.id)) { const cx2 = p.x + (p.st ? 20 : p.r + 6), cy2 = y - (p.st ? 8 : p.r + 2); ctx.strokeStyle = '#3dff6a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx2 - 5, cy2); ctx.lineTo(cx2 - 1, cy2 + 5); ctx.lineTo(cx2 + 7, cy2 - 6); ctx.stroke(); if (!L.isBonus) text(ctx, RANK[bits(md[p.id])], cx2 + 12, cy2 - 6, 9, '#3dff6a'); ctx.strokeStyle = col; ctx.lineWidth = on ? 3 : 1.5; } // cleared: a green tick, and the grade on a planet
      if (!p.st && (!L.isBonus || p.id === 'sun')) { ctx.beginPath(); ctx.ellipse(p.x, y, p.r, p.r * 0.35, 0.3 + t * 0.2 * (k % 2 ? 1 : -1), 0, TAU); ctx.stroke(); }
      if (p.id === 'jupiter') { ctx.beginPath(); ctx.ellipse(p.x, y, p.r * 1.6, p.r * 0.4, -0.2, 0, TAU); ctx.stroke(); } if (p.id === 'sun') for (let q = 0; q < 12; q++) { const a = q / 12 * TAU + t * 0.3; ctx.beginPath(); ctx.moveTo(90 + Math.cos(a) * 36, sy + Math.sin(a) * 36); ctx.lineTo(90 + Math.cos(a) * (44 + 4 * Math.sin(t * 3 + q)), sy + Math.sin(a) * (44 + 4 * Math.sin(t * 3 + q))); ctx.stroke(); }
      if (on) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, y, p.r + 8 + 2 * Math.sin(t * 5), 0, TAU); ctx.stroke(); }
      text(ctx, L.isBonus ? (found(L) ? L.name : '?') : L.name, p.x, p.st ? y + 14 : L.isBonus && p.id !== 'sun' ? y - p.r - 16 : y + p.r + 16, L.isBonus ? 7 : 9, on ? '#ffffff' : col, { align: 'center', glow: on });
      hits.push({ x: p.x - Math.max(18, p.r + 6), y: y - Math.max(18, p.r + 6), w: Math.max(36, p.r * 2 + 12), h: Math.max(36, p.r * 2 + 12), fn: () => { m.sel = k; audio.sfx('move'); } }); });
    if (m.travel) { const P = id => { const n = NODES.find(q => q.id === id) || NODES[0]; return [n.x, NY(n), n.r]; }, a = P(m.travel.from), b = P(m.travel.to), u = Math.min(1, (performance.now() - m.travel.t0) / 2000), f = u * u * (3 - 2 * u), lift = Math.min(70, Math.abs(b[0] - a[0]) * 0.3 + 18);
      const at = q => [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q - Math.sin(Math.PI * q) * lift], c = at(f), d = at(Math.min(1, f + 0.02)), ang = Math.atan2(d[1] - c[1], d[0] - c[0] || 0.001);
      ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]); ctx.beginPath(); for (let q = 0; q <= 20; q++) { const pt = at(f * q / 20); q ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]); } ctx.stroke(); ctx.setLineDash([]);
      ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(f >= 1 ? 0 : ang); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -6); ctx.lineTo(-3, 0); ctx.lineTo(-7, 6); ctx.closePath(); ctx.stroke(); if (f < 1) { ctx.strokeStyle = '#2ee6ff'; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-12 - 5 * Math.sin(t * 40), 0); ctx.stroke(); } ctx.restore();
      if (f >= 1) { ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(b[0], b[1], b[2] + 10 + ((t * 30) % 14), 0, TAU); ctx.stroke(); }
      text(ctx, f >= 1 ? 'ARRIVED - HYPERSPACE' : 'EN ROUTE', 480, 96, 9, '#ffe14a', { bold: true, align: 'center' }); }
    else if ((t * 2 | 0) % 2) { const cur = NODES.find(n => n.id === (g ? levelId : 'earth')); if (cur) text(ctx, 'YOU', cur.x + (cur.st ? -34 : 0), cur.st ? NY(cur) - 4 : (cur.up && cur.id !== 'sun' ? sy - 46 : sy) - cur.r - (cur.up ? 30 : 58), 8, '#ffe14a', { align: 'center' }); }
    ctx.globalCompositeOperation = 'source-over';
    const p = NODES[m.sel], L = LEVELS[p.id]; panel(150, 364, 660, 92, p.col);
    text(ctx, (L.isBonus ? 'BONUS // ' : 'LEVEL ' + L.n + ' // ') + L.name + ' - ' + L.sub, 170, 376, 13, '#ffffff'); text(ctx, L.info, 170, 400, 8, '#9fb0ff', { glow: false });
    if (L.isBonus) text(ctx, (L.isArena ? 'REACHED THROUGH A SECOND HIDDEN WARP ON ' : 'REACHED THROUGH A HIDDEN WARP ON ') + LEVELS[L.of].name + (found(L) ? ' - FOUND' : '') + (done(L, p.id) ? ' - CLEARED' : ''), 170, 420, 9, '#b06bff', { glow: false }); else { text(ctx, 'BOSS: ' + L.boss, 170, 420, 9, '#ff4d6d', { glow: false }); text(ctx, 'HIDDEN WARP: ' + (warp[p.id] ? LEVELS[L.bonus].name + ' - FOUND' : '???'), 400, 420, 9, '#b06bff', { glow: false }); }
    text(ctx, 'BEST SCORE ' + LS.get('best', 0), 170, 438, 9, '#3dffb0', { glow: false }); if (!L.isBonus) { const mm = LS.get('medals', {})[p.id] || 0; text(ctx, 'RANK ' + RANK[bits(mm)], 400, 438, 9, '#ffe14a', { glow: false }); for (let k = 0; k < 7; k++) { ctx.fillStyle = mm >> k & 1 ? '#ffe14a' : '#30345a'; ctx.fillRect(470 + k * 12, 439, 8, 8); } } if (!L.isBonus) text(ctx, 'ARENA WARP: ' + (af[p.id] || ar[p.id] ? 'FOUND' : '???'), 580, 438, 9, '#ffe14a', { glow: false }); else text(ctx, '< > BROWSE', 640, 438, 7, '#5a66b0', { glow: false });
  }
  const padNames = () => window.ArcadeGridzPad?.glyphs?.() === 'xbox' ? ['B', 'A', 'X', 'Y', 'LB / RB', 'VIEW', 'MENU'] : ['A', 'B', 'Y', 'X', 'L / R', 'SELECT', 'START'];
  function drawControls() { const pn = padNames(), rows = [['MOVE', 'ARROWS / WASD', 'D-PAD'], ['FIRE', 'SPACE / Z / J', pn[0]], ['CHANGE SPEED', 'V / F', pn[1]], ['BOMB', 'X / K', pn[2]], ['DRONE MODE', 'C / L', pn[3]], ['SHIFT VIEW', 'SHIFT KEYS / Q E', pn[4]], ['BUY UPGRADE', 'ENTER / R', pn[5]], ['PAUSE', 'ESC / P', pn[6]]];
    text(ctx, 'KEYBOARD', 430, 150, 8, '#2ee6ff', { glow: false }); text(ctx, 'CONTROLLER', 660, 150, 8, '#ff3df0', { glow: false });
    rows.forEach((r, k) => { const y = 172 + k * 24; text(ctx, r[0], 210, y, 10, '#ffe14a', { glow: false }); text(ctx, r[1], 430, y, 10, '#ffffff', { glow: false }); text(ctx, r[2], 660, y, 10, '#ffffff', { glow: false }); });
    text(ctx, 'TOUCH: DRAG LEFT SIDE TO FLY. BUTTONS ON THE RIGHT.', 480, 372, 8, '#9fb0ff', { align: 'center', glow: false }); text(ctx, 'EACH POD MOVES THE HIGHLIGHT ALONG THE BAR. BUY WHAT IS LIT. HYPER OPENS ONCE THE REST IS MAXED: 15 PERCENT MORE DAMAGE, FOR GOOD.', 480, 392, 6.5, '#9fb0ff', { align: 'center', glow: false });
    text(ctx, 'SHIFT AT THE LAST MOMENT TO DODGE SOMETHING AND YOU GET A PERFECT SHIFT: SHOCKWAVE, OVERDRIVE AND A BONUS.', 480, 406, 6.5, '#ffffff', { align: 'center', glow: false }); text(ctx, 'ARENAS: RIGHT STICK OR MOUSE AIMS.   CO-OP: P1 KEYBOARD, P2 CONTROLLER (OR TWO CONTROLLERS).', 480, 420, 6.5, '#9fb0ff', { align: 'center', glow: false }); }
  function drawScroll(m) { const ST = { h1: [20, '#2ee6ff', 34], h2: [15, '#ffe14a', 30], h3: [11, '#ff3df0', 24], q: [8, '#3dffb0', 16], b: [8, '#ffffff', 16], p: [8, '#c7cdf0', 16] }; let y = 96 - m.off, total = 0;
    ctx.save(); ctx.beginPath(); ctx.rect(50, 86, 860, 340); ctx.clip();
    for (const ln of m.lines) { if (!ln) { y += 9; total += 9; continue; } const k = ln[0].replace('+', ''), cont = ln[0].endsWith('+'), s = ST[k] || ST.p; if (y > 60 && y < 440) text(ctx, (k === 'b' && !cont ? '- ' : k === 'q' && !cont ? "> " : k === 'b' || k === 'q' ? '  ' : '') + ln[1], k === 'q' ? 96 : 76, y, s[0], s[1], { glow: k[0] === 'h' }); y += s[2]; total += s[2]; }
    hits.push({ x: 50, y: 86, w: 860, h: 170, fn: () => { m.off = Math.max(0, m.off - 120); } }, { x: 50, y: 256, w: 860, h: 170, fn: () => { m.off += 120; } });
    ctx.restore(); m.off = Math.min(m.off, Math.max(0, total - 300)); const f = total > 320 ? m.off / (total - 300) : 0; if (total > 320) { ctx.fillStyle = '#26306e'; ctx.fillRect(896, 90, 4, 330); ctx.fillStyle = '#2ee6ff'; ctx.fillRect(896, 90 + f * 280, 4, 50); text(ctx, lastDev === 'touch' ? 'DRAG THE STICK AREA UP / DOWN' : 'UP / DOWN TO SCROLL', 480, 432, 7, '#5a66b0', { align: 'center', glow: false }); } }
  // the jam banner: a neon pennant hanging in the top right corner of the title screen
  function drawJamRibbon(t) { const pulse = 0.5 + 0.5 * Math.sin(t * 3), x = 852, w = 92, h = 118, tail = 18, cx = x + w / 2, sw = Math.sin(t * 1.4) * 0.012; ctx.save(); ctx.translate(cx, 0); ctx.rotate(sw); ctx.translate(-cx, 0); // it sways a little on its hook
    const path = () => { ctx.beginPath(); ctx.moveTo(x, -4); ctx.lineTo(x + w, -4); ctx.lineTo(x + w, h); ctx.lineTo(cx, h - tail); ctx.lineTo(x, h); ctx.closePath(); };
    const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a0b45'); gr.addColorStop(1, '#7a1f9e'); path(); ctx.fillStyle = gr; ctx.shadowColor = '#ff3df0'; ctx.shadowBlur = 10 + pulse * 8; ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ff3df0'; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.lineDashOffset = -t * 10; ctx.beginPath(); ctx.moveTo(x + 5, 0); ctx.lineTo(x + 5, h - 6); ctx.moveTo(x + w - 5, 0); ctx.lineTo(x + w - 5, h - 6); ctx.stroke(); ctx.setLineDash([]);
    text(ctx, 'GITHUB', cx, 12, 8, '#ffffff', { align: 'center', bold: true, glow: false }); text(ctx, 'GAME OFF', cx, 26, 10, '#ffffff', { align: 'center', bold: true, glow: true }); text(ctx, '2026', cx, 42, 20, '#ffe14a', { align: 'center', bold: true, tube: true });
    ctx.fillStyle = '#ff3df0'; ctx.fillRect(x + 16, 72, w - 32, 1.5); text(ctx, 'THEME', cx, 80, 6, '#d6a8ff', { align: 'center', bold: true, glow: false }); text(ctx, 'SHIFT', cx, 90, 11, '#2ee6ff', { align: 'center', bold: true, glow: true }); ctx.restore(); }
  function drawMenu() {
    hits = []; const m = top(); if (!m) return; const t = performance.now() / 1000;
    if (m.kind === 'title') {
      const k = Math.min(1, titleT / 18), sc = 1 + (1 - k) * (1 - k) * 2.2; if (titleT < 26) ctx.translate((Math.random() - 0.5) * (26 - titleT) * 0.5, (Math.random() - 0.5) * (26 - titleT) * 0.5);
      drawLogo(ctx, 480, 34 - (sc - 1) * 30, sc, t); ctx.setTransform(res, 0, 0, res, 0, 0);
      drawTagline(ctx, 480, 146, 10, t);
      ctx.globalCompositeOperation = 'lighter'; skinPreview(ctx, skinNow(), 480, 272 + Math.sin(t * 1.3) * 6, 96, t, false); ctx.globalCompositeOperation = 'source-over'; // your ship, in your skin, turning in the middle
      drawGrid(m, 392); // the menu: two centred rows of pills along the bottom
      drawJamRibbon(t);
      text(ctx, lastDev === 'pad' ? padNames()[0] + ' = OK     ' + padNames()[1] + ' = BACK' : lastDev === 'touch' ? 'TAP TO CHOOSE' : 'ENTER = OK     ESC = BACK', 480, 500, 8, '#8d9be0', { align: 'center', glow: false });
      text(ctx, COPY, 480, 520, 7, '#5a66b0', { align: 'center', glow: false }); return; }
    ctx.fillStyle = m.kind === 'end' ? 'rgba(2,1,10,.6)' : 'rgba(2,1,10,.74)'; ctx.fillRect(0, 0, W, H);
    if (m.kind === 'end') { const c = m.cleared, bo = endInfo.bonus, col = c ? '#3dffb0' : bo ? '#b06bff' : '#ff4d6d'; text(ctx, bo ? (LEVELS[levelId].isArena ? (c ? 'ARENA CLEAR' : 'ARENA OVER') : c ? 'BONUS COMPLETE' : 'BONUS OVER') : c ? 'SECTOR CLEAR' : 'GAME OVER', 480, 92, bo ? 34 : 40, col, { bold: true, align: 'center', weight: 4, tube: true });
      const rows = endInfo.par ? [['SCORE', g.score], ['TIME  (PAR ' + mmss(endInfo.par) + ')', mmss(endInfo.time)], ['TIME BONUS', '+' + endInfo.tb], ['BEST CHAIN', g.bestChain]] : [['SCORE', g.score], ['BEST CHAIN', g.bestChain], ['KILLS', g.stats.kills], ['VIEW SHIFTS', g.stats.shifts]]; if (!bo) rows.push(['HIDDEN WARP', g.flags.warp ? 'FOUND' : 'NOT FOUND']); rows.forEach((r, k) => { if (endInfo.t > 20 + k * 14) { text(ctx, r[0], 330, 172 + k * 26, 12, '#9fb0ff', { glow: false }); text(ctx, String(r[1]), 630, 172 + k * 26, 12, '#ffffff', { align: 'right' }); } });
      if (endInfo.medals != null && endInfo.t > 60) { const mm = endInfo.medals, n = bits(mm); text(ctx, 'RANK', 742, 172, 9, '#9fb0ff', { align: 'center', glow: false }); text(ctx, RANK[n], 742, 190, 44, n >= 5 ? '#ffe14a' : '#3dffb0', { align: 'center', weight: 4, tube: true }); if (endInfo.newRank) text(ctx, 'NEW BEST RANK', 742, 246, 7, '#ffe14a', { align: 'center', glow: false }); if (endInfo.newGhost) text(ctx, 'BEST RUN SAVED AS GHOST', 742, 260, 7, '#3dffb0', { align: 'center', glow: false });
        let x = 480 - MEDALS.reduce((a, d) => a + textWidth(d[0], 6.5) + 18, -6) / 2; MEDALS.forEach((d, k) => { const on = mm >> k & 1, w = textWidth(d[0], 6.5) + 18; if (endInfo.t > 66 + k * 5) { ctx.strokeStyle = on ? '#ffe14a' : '#30345a'; ctx.lineWidth = 1; ctx.strokeRect(x, 300, w - 6, 16); text(ctx, d[0], x + (w - 6) / 2, 305, 6.5, on ? '#ffe14a' : '#4a5080', { align: 'center', glow: false }); } x += w; }); }
      if (bug) text(ctx, 'BUG TEST' + (endInfo.cleared ? ' - TICKED OFF' : '') + '   HITS TAKEN ' + (endInfo.bugHits || 0), 480, 326, 8, '#3dffb0', { align: 'center', glow: false }); else if (testRun) text(ctx, 'TEST RUN - SCORE NOT POSTED', 480, 326, 8, '#ffe14a', { align: 'center', glow: false }); else if (daily) text(ctx, 'DAILY RUN ' + daily.label, 480, 326, 8, '#ffe14a', { align: 'center', glow: false }); else if (assisted) text(ctx, coop ? 'CO-OP RUN' : 'ASSISTED RUN', 480, 326, 8, '#ffe14a', { align: 'center', glow: false });
      if (endInfo.t > 100) drawItems(m, 480, 356, 15, 36); else m.i = 0; return; }
    const full = m.kind === 'bug' || m.kind === 'map' || m.kind === 'controls' || m.kind === 'scores' || m.kind === 'scroll' || m.kind === 'ach' || m.kind === 'devlog';
    const n = m.tabs ? Math.max(...m.tabs.map(q => q.items.length)) + 2 : m.items.length, gap = m.gap || 34, nn = m.notes ? m.notes.length * 20 + 14 : 0, h = full ? 0 : n * gap + 80 + nn, y0 = full ? 54 : 270 - h / 2;
    if (!full) { panel(m.notes ? 200 : 270, y0, m.notes ? 560 : 420, h, m.pause ? '#2ee6ff' : '#ff3df0'); if (m.notes) m.notes.forEach((ln, k) => text(ctx, ln, 480, y0 + 60 + k * 20, 9, ln[0] === '+' ? '#3dffb0' : ln[0] === '-' ? '#ff4d6d' : '#9fb0ff', { align: 'center', glow: false })); } else panel(40, 40, 880, 460, '#2ee6ff');
    text(ctx, m.title, 480, y0 + (full ? 0 : 18), 22, '#ffe14a', { align: 'center', bold: true, tube: true });
    if (m.kind === 'map') { drawMap(m); drawItems(m, 480, m.items.length > 2 ? 459 : m.items.length > 1 ? 462 : 474, m.items.length > 2 ? 9 : 11, m.items.length > 2 ? 14 : 20); }
    else if (m.kind === 'controls') { drawControls(); drawItems(m, 480, 440, 14, 30); }
    else if (m.kind === 'scroll') { drawScroll(m); drawItems(m, 480, 456, 14, 30); }
    else if (m.kind === 'devlog') { drawDevlog(m); drawItems(m, 480, 458, 13, 30); }
    else if (m.kind === 'bug') drawBug(m);
    else if (m.kind === 'ach') { const got = LS.get('ach', {}), half = Math.ceil(ACH.length / 2); text(ctx, ACH.filter(a => got[a[0]]).length + ' / ' + ACH.length + ' UNLOCKED', 480, 82, 7, '#3dffb0', { align: 'center', glow: false });
      ACH.forEach((a, k) => { const x = 74 + (k >= half ? 420 : 0), y = 98 + (k % half) * 22.4, on = got[a[0]]; ctx.strokeStyle = on ? '#ffe14a' : '#30345a'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y + 1, 12, 12); if (on) { ctx.fillStyle = '#ffe14a'; ctx.fillRect(x + 3, y + 4, 6, 6); } text(ctx, a[1], x + 22, y, 8.5, on ? '#ffe14a' : '#6a76c0', { glow: !!on }); text(ctx, a[2], x + 22, y + 12, 5.5, on ? '#c7cdf0' : '#454c86', { glow: false }); });
      drawItems(m, 480, 466, 13, 30); }
    else if (m.kind === 'scores') { const rows = m.rows; if (!rows) text(ctx, 'LOADING...', 480, 240, 12, '#9fb0ff', { align: 'center' }); else if (!rows.length) text(ctx, 'NO SCORES YET', 480, 240, 12, '#9fb0ff', { align: 'center' });
      else rows.slice(0, 10).forEach((r, k) => { const y = 124 + k * 30; text(ctx, String(k + 1), 250, y, 13, '#ffe14a', { align: 'right' }); text(ctx, String(r.name || '???').slice(0, 14), 280, y, 13, '#ffffff'); text(ctx, String(r.score), 700, y, 13, '#3dffb0', { align: 'right' }); const tag = r.cheater ? 'CHEATER' : r.assisted ? 'ASSISTED' : r.verified === false ? 'UNVERIFIED' : ''; if (tag) text(ctx, tag, 716, y + 3, 7, '#ff8a2b', { glow: false }); });
      drawItems(m, 480, 450, 14, 30); }
    else if (m.tabs) { drawTabs(m, y0 + 56); if (m.tabs[m.tab].name === 'SHIP') drawSkinCard(y0 + 62 + gap * 3); const sub = { ...m, items: m.items.slice(1), i: m.i - 1 }; const h0 = hits.length; drawItems(sub, 480, y0 + 62 + gap, 14, gap); for (let k = h0; k < hits.length; k++) if (hits[k].i != null) hits[k].i += 1; }
    else drawItems(m, 480, y0 + 62 + nn, 14, gap);
  }
  // the devlog: tabs along the top, entries folded to one line each, one open at a time, screenshots inside the entries
  const SHOT = {}; const shot = src => SHOT[src] || (SHOT[src] = Object.assign(new Image(), { src: new URL('./' + src, import.meta.url).href }));
  function devlogMenu() { push({ title: 'DEVLOG', kind: 'devlog', tab: Math.max(0, DEVLOG_TABS.length - 2), sel: 0, open: -1, off: 0, i: -1, items: [{ label: 'BACK', act: popMenu }] }); }
  const DV = { x: 60, y: 116, w: 840, h: 316, head: 24 };
  function devlogLayout(m) { const tb = DEVLOG_TABS[m.tab], rows = []; let y = 0;
    tb.entries.forEach((e, k) => { rows.push({ k, y, h: DV.head }); y += DV.head + 4; if (m.open === k) { const top = y; for (const ln of e.lines) { if (ln === '') y += 8; else if (ln[0] === 'img') { const w = Math.min(520, ln[3]), h = ln[4] * w / ln[3]; y += h + 26; } else y += 15; } rows[rows.length - 1].body = [top, y]; y += 10; } });
    return { rows, total: y }; }
  function devlogSee(m, L, top) { const r = L.rows[m.sel]; if (!r) return; if (top || r.y < m.off) m.off = r.y; else if (r.y + r.h > m.off + DV.h) m.off = r.y + r.h - DV.h; m.off = Math.max(0, Math.min(m.off, Math.max(0, L.total - DV.h))); }
  function devlogInput(m, e) { const n = DEVLOG_TABS[m.tab].entries.length, L = devlogLayout(m), r = L.rows[m.sel];
    const tab = d => { m.tab = (m.tab + d + DEVLOG_TABS.length) % DEVLOG_TABS.length; m.sel = 0; m.open = -1; m.off = 0; audio.sfx('move'); };
    if (e('left') || e('shiftL')) tab(-1); else if (e('right') || e('shiftR')) tab(1);
    else if (e('down')) { if (m.open === m.sel && r?.body && r.body[1] > m.off + DV.h) m.off = Math.min(L.total - DV.h, m.off + 45); else if (m.sel < n - 1) { m.sel++; audio.sfx('move'); devlogSee(m, devlogLayout(m)); } }
    else if (e('up')) { if (m.open === m.sel && r && r.y < m.off) m.off = Math.max(r.y, m.off - 45); else if (m.sel > 0) { m.sel--; audio.sfx('move'); devlogSee(m, devlogLayout(m)); } }
    else if (e('ok')) { m.open = m.open === m.sel ? -1 : m.sel; audio.sfx('ok'); devlogSee(m, devlogLayout(m), m.open === m.sel); } }
  function drawDevlog(m) { const tabs = DEVLOG_TABS, n = tabs.length, tw = 120, x0 = 480 - n * tw / 2, t = performance.now() / 1000;
    tabs.forEach((q, k) => { const x = x0 + k * tw, cur = k === m.tab; rr(x + 4, 86, tw - 8, 22, 11); ctx.fillStyle = cur ? '#ffe14a' : 'rgba(9,6,22,.85)'; ctx.fill(); ctx.strokeStyle = cur ? '#ffe14a' : '#2ee6ff'; ctx.globalAlpha = cur ? 1 : 0.6; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1;
      text(ctx, q.name, x + tw / 2, 93, 9, cur ? '#17101b' : '#8d9be0', { align: 'center', bold: true, glow: false }); hits.push({ x: x + 4, y: 86, w: tw - 8, h: 22, fn: () => { m.tab = k; m.sel = 0; m.open = -1; m.off = 0; audio.sfx('move'); } }); });
    const L = devlogLayout(m), E = tabs[m.tab].entries; m.off = Math.max(0, Math.min(m.off, Math.max(0, L.total - DV.h)));
    ctx.save(); ctx.beginPath(); ctx.rect(DV.x - 6, DV.y - 2, DV.w + 12, DV.h + 4); ctx.clip();
    for (const r of L.rows) { const y = DV.y + r.y - m.off, e = E[r.k], on = r.k === m.sel, op = r.k === m.open; if (y > DV.y + DV.h || (r.body ? DV.y + r.body[1] - m.off : y + r.h) < DV.y) continue;
      rr(DV.x, y, DV.w, r.h, 8); ctx.fillStyle = on ? 'rgba(255,225,74,.16)' : op ? 'rgba(46,230,255,.08)' : 'rgba(9,6,22,.7)'; ctx.fill(); ctx.strokeStyle = on ? '#ffe14a' : op ? '#2ee6ff' : '#26306e'; ctx.lineWidth = on ? 2 : 1; ctx.stroke();
      text(ctx, op ? 'v' : '>', DV.x + 12, y + 7, 9, on ? '#ffe14a' : '#5a66b0', { bold: true, glow: false }); text(ctx, e.title, DV.x + 30, y + 7, 9.5, on ? '#ffffff' : op ? '#2ee6ff' : '#c7cdf0', { bold: true, glow: on });
      if (e.lines.some(l => l[0] === 'img')) text(ctx, 'PICS', DV.x + DV.w - 12, y + 8, 6.5, '#ff3df0', { align: 'right', bold: true, glow: false });
      hits.push({ x: DV.x, y: Math.max(DV.y, y), w: DV.w, h: r.h, fn: () => { m.sel = r.k; m.open = m.open === r.k ? -1 : r.k; audio.sfx('ok'); devlogSee(m, devlogLayout(m), m.open === r.k); } });
      if (r.body) { let yy = DV.y + r.body[0] - m.off; const ST = { q: [8, '#3dffb0', 40], b: [8, '#ffffff', 34], p: [8, '#c7cdf0', 30], h3: [9, '#ff3df0', 30] };
        for (const ln of e.lines) { if (ln === '') { yy += 8; continue; }
          if (ln[0] === 'img') { const w = Math.min(520, ln[3]), h = ln[4] * w / ln[3], im = shot(ln[1]), ix = 480 - w / 2; if (yy + h > DV.y - 30 && yy < DV.y + DV.h) { if (im.complete && im.naturalWidth) ctx.drawImage(im, ix, yy + 2, w, h); else { ctx.fillStyle = '#0d1030'; ctx.fillRect(ix, yy + 2, w, h); text(ctx, 'LOADING...', 480, yy + h / 2, 8, '#5a66b0', { align: 'center', glow: false }); } ctx.strokeStyle = '#2ee6ff'; ctx.globalAlpha = 0.6; ctx.lineWidth = 1; ctx.strokeRect(ix, yy + 2, w, h); ctx.globalAlpha = 1; text(ctx, ln[2], 480, yy + h + 8, 6.5, '#9fb0ff', { align: 'center', glow: false }); } yy += h + 26; continue; }
          const k = ln[0].replace('+', ''), cont = ln[0].endsWith('+'), st = ST[k] || ST.p; if (yy > DV.y - 14 && yy < DV.y + DV.h) text(ctx, (k === 'b' && !cont ? '- ' : k === 'b' ? '  ' : '') + ln[1], DV.x + st[2], yy, st[0], st[1], { glow: false }); yy += 15; } } }
    ctx.restore();
    if (L.total > DV.h) { const f = m.off / (L.total - DV.h); ctx.fillStyle = '#26306e'; ctx.fillRect(DV.x + DV.w + 8, DV.y, 4, DV.h); ctx.fillStyle = '#2ee6ff'; ctx.fillRect(DV.x + DV.w + 8, DV.y + f * (DV.h - 40), 4, 40); }
    text(ctx, lastDev === 'touch' ? 'TAP A LINE TO OPEN IT' : (lastDev === 'pad' ? 'L / R' : 'LEFT / RIGHT') + ' TABS     UP / DOWN MOVE     ' + (lastDev === 'pad' ? padNames()[0] : 'ENTER') + ' OPEN / CLOSE', 480, 440, 6.5, '#5a66b0', { align: 'center', glow: false }); }
  function drawSkinCard(y) { const t = performance.now() / 1000, i = skinView, S = SKIN[i], ok = skinOk(i), on = (opt.skin | 0) === i, slug = S[3], price = slug && prices[slug];
    rr(330, y, 300, 150, 12); ctx.fillStyle = 'rgba(4,6,20,.85)'; ctx.fill(); ctx.strokeStyle = ok ? '#2ee6ff' : '#3a4380'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; skinPreview(ctx, i, 480, y + 62, 66, t, !ok); ctx.restore();
    SKIN.forEach((_, k) => { ctx.fillStyle = k === i ? '#ffe14a' : skinOk(k) ? '#2ee6ff' : '#30345a'; ctx.beginPath(); ctx.arc(480 + (k - (SKIN.length - 1) / 2) * 14, y + 12, k === i ? 4 : 3, 0, 6.3); ctx.fill(); }); // which of the skins you are looking at
    if (!ok) { const lx = 480, ly = y + 62; ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(lx, ly - 10, 9, Math.PI, 0); ctx.stroke(); rr(lx - 14, ly - 10, 28, 22, 4); ctx.fillStyle = '#ff4d6d'; ctx.fill(); ctx.fillStyle = '#1a0610'; ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, 6.3); ctx.fill(); } // a padlock over a dim ship
    text(ctx, S[0], 480, y + 102, 12, ok ? '#ffffff' : '#7d8bd6', { align: 'center', bold: true, glow: ok });
    const how = !S[1] ? 'THE STANDARD SHIP' : ok ? (on ? 'EQUIPPED' : 'UNLOCKED') : 'LOCKED - ' + S[2], where = !ok && S[4] ? S[4] : '', buy = !ok && S[1] ? (price ? 'OR ' + price + ' SPARKZ IN THE STORE' : 'OR BUY IT WITH SPARKZ') : '';
    text(ctx, on && ok ? 'EQUIPPED' : how, 480, y + 120, 7, on && ok ? '#3dffb0' : ok ? '#2ee6ff' : '#ff4d6d', { align: 'center', bold: true, glow: false }); if (where) text(ctx, where, 480, y + 131, 6, '#9fb0ff', { align: 'center', bold: true, glow: false }); if (buy) text(ctx, buy, 480, y + (where ? 142 : 134), 6.5, '#ffe14a', { align: 'center', bold: true, glow: false }); }
  function drawTabs(m, y) { const n = m.tabs.length, tw = 70, x0 = 480 - n * tw / 2, on = m.i === 0; // the tab strip: the open tab lit, the row itself glowing when it is the one you are on
    m.tabs.forEach((q, k) => { const x = x0 + k * tw, cur = k === m.tab; rr(x + 3, y - 4, tw - 6, 20, 10); ctx.fillStyle = cur ? (on ? '#ffe14a' : 'rgba(255,225,74,.25)') : 'rgba(9,6,22,.8)'; ctx.fill(); ctx.strokeStyle = cur ? '#ffe14a' : '#2ee6ff'; ctx.globalAlpha = cur ? 1 : 0.6; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1;
      text(ctx, q.name, x + tw / 2, y + 2, 8, cur ? (on ? '#17101b' : '#ffe14a') : '#8d9be0', { align: 'center', bold: true, glow: false }); hits.push({ x, y: y - 4, w: tw, h: 20, fn: () => { m.i = 0; setTab(m, k); audio.sfx('move'); } }); }); }
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
    const ro2 = { glow: tier() < 2, shake: opt.shake, fill: opt.fill && tier() < 4, ghost: null, q: tier(), skin: scene === 'title' && menus.length ? skinView : skinNow() }; /* on the title screen the options menu previews a skin, locked or not */ if (ghost && g && scene === 'play' && ghost.g.players[0].dead <= 0) { const q = ghost.g.players[0]; ro2.ghost = { x: q.x, y: q.y, z: q.z + ghost.g.camZ - g.camZ }; }
    if (scene === 'intro') drawIntro();
    else if (scene === 'story') drawStory();
    else if (scene === 'credits') drawCredits();
    else { ctx.fillStyle = '#02010a'; ctx.fillRect(0, 0, W, H); const gg = g;
      if (scene === 'title') titleBack(); else drawWorld(ctx, gg, ro2); ctx.setTransform(res, 0, 0, res, 0, 0); ctx.globalCompositeOperation = 'source-over';
      if (scene === 'title') { if (titleT < 14) { ctx.fillStyle = '#fff'; ctx.globalAlpha = 1 - titleT / 14; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; } }
      else { if (g.shiftT > 0) chroma(9 * Math.sin(Math.PI * g.shiftT), 0.4); else if (g.perfFx > 0) chroma(16 * Math.min(1, g.perfFx / 24), 0.55);
        const ended = menus.length && top().kind === 'end'; /* results screens: no HUD under the text, the level keeps running behind */ if (!ended) drawHUD(ctx, g, { hi: Math.max(LS.get('best', 0), g.score), upgLabel: lastDev === 'touch' ? 'TAP' : lastDev === 'pad' ? padNames()[5] : 'ENTER' }); if (ended) { } else { if (opt.idle) text(ctx, 'IDLE MODE', 150, 26, 8, '#ffe14a', { glow: false }); if (bug) text(ctx, 'BUG TEST  HITS ' + (g.stats.bugHits || 0), 150, 40, 8, '#3dffb0', { glow: false }); else if (testRun) text(ctx, 'TEST RUN', 150, 40, 8, '#ff8a2b', { glow: false }); else if (daily) text(ctx, 'DAILY ' + daily.label + '  ' + daily.help[0] + ' + ' + daily.hurt[0], 150, 40, 7, '#ffe14a', { glow: false }); else if (coop) text(ctx, 'CO-OP', 150, 40, 8, '#3dffb0', { glow: false }); if (rush) { text(ctx, 'BOSS RUSH ' + (rush.i + 1) + ' / ' + RUSH.length, 150, 40, 8, '#ff4d6d', { glow: false }); text(ctx, 'TIME ' + mmss(rush.t / 60), 150, 52, 8, '#ffe14a', { glow: false }); } if (loopN) text(ctx, 'LOOP ' + (loopN + 1), 150, 52, 8, '#ff4d6d', { glow: false }); }
        if (g.boss?.dying) { ctx.fillStyle = '#02010a'; ctx.globalAlpha = 0.9; ctx.fillRect(0, 0, W, 52); ctx.fillRect(0, H - 52, W, 52); ctx.globalAlpha = 1; }
        const L = LEVELS[levelId]; if (g.intro > 0 || sceneT < INTRO + 110) { const a = g.intro > 0 ? 1 : Math.min(1, (INTRO + 110 - sceneT) / 30); text(ctx, (L.isArena ? 'BONUS ARENA' : L.isBonus ? 'BONUS STAGE' : 'LEVEL ' + L.n) + (loopN ? '   LOOP ' + (loopN + 1) : ''), 480, 178, 14, '#ffe14a', { bold: true, align: 'center', alpha: a }); text(ctx, L.name, 480, 204, 44, VCOL[(L.n || 2) % 4], { bold: true, align: 'center', alpha: a, weight: 4, tube: true }); text(ctx, L.sub, 480, 262, 12, '#ffffff', { bold: true, align: 'center', alpha: a }); if (g.intro > 0) text(ctx, 'HYPERSPACE', 480, 300, 8, '#7d8bd6', { bold: true, align: 'center', alpha: (sceneT >> 3) % 2 ? 1 : 0.4, glow: false }); }
        if (warpT > 0) { ctx.fillStyle = '#b06bff'; ctx.globalAlpha = Math.min(0.85, warpT / 80); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; text(ctx, 'WARP', 480, 240, 40, '#ffffff', { bold: true, align: 'center', weight: 4, tube: true }); } } }
    if (scene !== 'intro' && toasts.length) { let y = menus.length && top().kind === 'end' ? 392 : 114; for (const q of toasts) { q.t++; const tw = Math.max(250, textWidth(q.a, 11) + 32, textWidth(q.b, 7) + 32), k = Math.min(1, q.t / 14, (300 - q.t) / 20), x = W - 18 - tw * Math.max(0, k); if (k <= 0) continue; ctx.fillStyle = 'rgba(4,5,22,.88)'; ctx.fillRect(x, y, tw, 40); ctx.strokeStyle = '#3dffb0'; ctx.lineWidth = 2; ctx.strokeRect(x, y, tw, 40); /* the card grows to fit its text */ ctx.fillStyle = '#3dffb0'; ctx.fillRect(x, y, 5, 40); text(ctx, q.a, x + 16, y + 8, 11, '#ffffff'); text(ctx, q.b, x + 16, y + 26, 7, '#3dffb0', { glow: false }); y += 48; } while (toasts.length && toasts[0].t > 300) toasts.shift(); }
    drawMenu();
    if (opt.crt) { if (!crtPat) { const c = document.createElement('canvas'); c.width = 2; c.height = 3; const x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,.34)'; x.fillRect(0, 2, 2, 1); crtPat = ctx.createPattern(c, 'repeat'); }
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = crtPat; ctx.fillRect(0, 0, W, H); const vg = ctx.createRadialGradient(480, 270, 250, 480, 270, 590); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); }
    const showTouch = lastDev === 'touch' && scene === 'play' && !menus.length; if (touchEl.hidden === showTouch) { touchEl.hidden = !showTouch; if (!showTouch) { tb.clear(); stick = null; nubEl.hidden = true; } }
  }
  // colour split: the frame is drawn again in red and cyan, pulled apart sideways (on shifts and perfect shifts)
  function chroma(k, a) { if (tier() > 0 || k < 0.5) return; if (!fxC) fxC = document.createElement('canvas'); if (fxC.width !== canvas.width || fxC.height !== canvas.height) { fxC.width = canvas.width; fxC.height = canvas.height; } const f = fxC.getContext('2d');
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); for (const [col, dx] of [['#ff0030', -k], ['#00e0ff', k]]) { f.globalCompositeOperation = 'copy'; f.drawImage(canvas, 0, 0); f.globalCompositeOperation = 'multiply'; f.fillStyle = col; f.fillRect(0, 0, fxC.width, fxC.height); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.drawImage(fxC, dx * res, 0); } ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  function frame(now) {
    if (destroyed) return; raf = requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now; if (dt > 0.25) dt = 0.25; if (focusPaused) return;
    if (scene === 'play' && !menus.length && opt.dyn) { ema += (Math.min(100, dt * 1000) - ema) * 0.05; sinceUp++; const qmax = 4 - (GBASE[opt.gfx] ?? 0);
      if (ema > 20.5 && q < qmax) { if (++slow > (ema > 28 ? 20 : 45)) { q++; slow = 0; ema = 16; if (sinceUp < 600) upWait = Math.min(7200, upWait * 2); /* it could not hold the better setting: wait longer before trying again */ fit(); } }
      else if (ema < 17.3 && q > 0) { if (--slow < -upWait) { q--; slow = 0; sinceUp = 0; fit(); } }
      else if (slow > 0) slow--; else if (slow < 0 && ema >= 17.3) slow = 0; } // dynamic framerate: drop a step within a second when frames run long (faster if it is bad), climb back one step after ten smooth seconds
    acc += dt; let n = 0;
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
    _debug: { gfx: () => ({ tier: tier(), q, ema: Math.round(ema * 10) / 10, res, upWait }), bugMenu: () => bugMenu(), devlogMenu: () => devlogMenu(), cutScene: (from, to) => { startStory(CUT[to].map(q => q[1]), () => showTitle()); story.cut = { from, to, faces: CUT[to].map(q => q[0]) }; story.per = 210; }, optionsMenu: () => optionsMenu(), ghost: () => ghost, rec: () => rec, setCoop: v => { coop = v; }, setAssist, game: () => g, scene: () => scene, menus, opt, startLevel: (id, s, test = true) => { testRun = test; returnTo = null; startLevel(id, s); }, showTitle, setIdle, startStory, beginEnding, startCredits, award, bugMenu, bugStart, skipIntro: () => { showTitle(); titleT = 99; } } };
}
