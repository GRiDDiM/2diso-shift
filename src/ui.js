// 2DISO SHIFT — front end: input (keyboard, controller, touch), intro, menus, HUD, audio hooks, saves.
// mountShift(root, host) works standalone (index.html) and inside a host site that passes { hosted, onExit, submitScore, leaderboard }.
import { createGame, step, autopilot, snapshot, VIEWS, BAR } from './game.js';
import { buildEarth } from './level_earth.js';
import { W, H, drawWorld, drawHUD, drawLogo, meshScreen, text, textWidth, SHIP_HULL, SHIP_WING, SHIP_FIN, RAINBOW, VCOL } from './render.js';
import { createAudio } from './audio.js';

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
const TAU = Math.PI * 2;
const PLANETS = [
  { id: 'earth', name: 'EARTH', sub: 'NEO TERRA', x: 300, r: 13, col: '#2ee6ff', boss: 'OVERSEER', warp: 'MOON', info: 'CYBER CITY. SKYSCRAPERS, SKYWAYS, FIREWALL GATES.', open: true },
  { id: 'mars', name: 'MARS', sub: 'THE FORGE', x: 430, r: 10, col: '#ff4d6d', boss: '???', warp: 'SUN', info: 'LAVA FOUNTAINS AND FIRE ARCS. COMING SOON.' },
  { id: 'jupiter', name: 'JUPITER', sub: 'STORM DECK', x: 620, r: 24, col: '#ff8a2b', boss: '???', warp: 'ASTEROID BELT', info: 'LIGHTNING AND DENSE CLOUD. COMING SOON.' },
  { id: 'x', name: 'PLANET X', sub: 'THE BLOOM', x: 860, r: 15, col: '#3dffb0', boss: '???', warp: 'PLUTO', info: 'MUTANT ALIEN BIOLOGY. COMING SOON.' }];

export function mountShift(root, host = {}) {
  if (!document.getElementById('ds-css')) { const st = document.createElement('style'); st.id = 'ds-css'; st.textContent = CSS; document.head.appendChild(st); }
  root.innerHTML = `<section class="ds-shell"><div class="ds-stage"><canvas tabindex="0" aria-label="2DISO SHIFT"></canvas>
<div class="ds-touch" hidden><div class="ds-stick"></div><div class="ds-nub" hidden><i></i></div>
<b data-b="shiftL" style="right:96px;bottom:216px;width:70px;height:70px;color:#2ee6ff"><span>◀ L</span></b><b data-b="shiftR" style="right:14px;bottom:216px;width:70px;height:70px;color:#ff3df0"><span>R ▶</span></b>
<b data-b="drone" style="right:100px;bottom:140px;width:62px;height:62px;color:#b06bff"><span>DRONE</span></b><b data-b="bomb" style="right:18px;bottom:140px;width:62px;height:62px;color:#ff8a2b"><span>BOMB</span></b>
<b data-b="thrust" style="right:40px;bottom:50px;width:80px;height:80px;color:#ffe14a"><span>THRUST</span></b>
<b data-b="upgrade" style="left:50%;margin-left:-70px;bottom:44px;width:140px;height:34px;border-radius:10px;color:#ffe14a"><span>UPGRADE</span></b>
<b data-b="pause" style="right:12px;top:74px;width:40px;height:40px;color:#9fb0ff"><span>II</span></b></div></div>
<div class="ds-rotate" hidden><div>TURN YOUR SCREEN SIDEWAYS</div><button type="button">PLAY ANYWAY</button></div></section>`;
  const shell = root.querySelector('.ds-shell'), stage = root.querySelector('.ds-stage'), canvas = root.querySelector('canvas'), ctx = canvas.getContext('2d'), touchEl = root.querySelector('.ds-touch'), stickEl = root.querySelector('.ds-stick'), nubEl = root.querySelector('.ds-nub'), rotEl = root.querySelector('.ds-rotate');
  const coarse = !!window.matchMedia?.('(pointer: coarse)').matches;
  const opt = Object.assign({ music: 0.7, sfx: 0.8, glow: coarse ? 'low' : 'high', shake: true, idle: false, autofire: coarse, autothrust: false, voice: true }, LS.get('opt', {})); const saveOpt = () => LS.set('opt', opt);
  const audio = createAudio(opt);
  let destroyed = false, raf = 0, last = performance.now(), acc = 0, scale = 1, res = 1, rotOk = false;
  let scene = 'intro', sceneT = 0, g = null, attract = null, assisted = false, submitted = false, focusPaused = false, lastDev = coarse ? 'touch' : 'kb', warpFx = 0, titleT = 0, endInfo = null;
  const menus = []; let hits = []; const toasts = []; let story = null, hiShown = false;
  const toast = (a, b) => { toasts.push({ a, b: b || '', t: 0 }); if (toasts.length > 3) toasts.shift(); };
  const level = () => buildEarth();

  // ---------- layout ----------
  function fit() { const r = shell.getBoundingClientRect(); if (!r.width || !r.height) return; scale = Math.min(r.width / W, r.height / H); stage.style.transform = `translate(${(r.width - W * scale) / 2}px,${(r.height - H * scale) / 2}px) scale(${scale})`;
    const want = Math.min(opt.glow === 'low' ? 1.25 : 2, Math.max(1, scale * (window.devicePixelRatio || 1))); if (Math.abs(want - res) > 0.05 || canvas.width !== Math.round(W * want)) { res = want; canvas.width = Math.round(W * res); canvas.height = Math.round(H * res); }
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
  function readInput() {
    const k = c => keys.has(c) || latK.has(c), s = c => pad.has(c) || latP.has(c); const i = { mx: 0, my: 0 };
    let L = k('ArrowLeft') || k('KeyA') || s('ArrowLeft'), R = k('ArrowRight') || k('KeyD') || s('ArrowRight'), U = k('ArrowUp') || k('KeyW') || s('ArrowUp'), D = k('ArrowDown') || k('KeyS') || s('ArrowDown');
    i.fire = k('Space') || k('KeyZ') || k('KeyJ') || s('Escape'); i.thrust = k('KeyV') || k('KeyF') || k('KeyH') || s('Space'); i.bomb = k('KeyX') || k('KeyK') || s('KeyZ'); i.drone = k('KeyC') || k('KeyL') || s('KeyX');
    i.shiftL = k('ShiftLeft') || k('KeyQ') || s('ShiftLeft'); i.shiftR = k('ShiftRight') || k('KeyE') || s('KeyE'); i.upgrade = k('Enter') || k('KeyR') || s('KeyM'); i.pause = k('Escape') || k('KeyP') || s('KeyP');
    i.ok = k('Enter') || k('Space') || k('KeyZ') || s('Escape'); i.back = k('Escape') || k('Backspace') || s('Space'); i.start = s('KeyP');
    let ax = 0, ay = 0;
    if (!window.ArcadeGridzPad) for (const p of navigator.getGamepads?.() || []) { if (!p || !p.connected) continue; const b = n => !!p.buttons[n]?.pressed; if (p.buttons.some(x => x.pressed)) { lastDev = 'pad'; audio.unlock(); }
      L ||= b(14); R ||= b(15); U ||= b(12); D ||= b(13); if (Math.abs(p.axes[0]) > 0.25) ax = p.axes[0]; if (Math.abs(p.axes[1]) > 0.25) ay = p.axes[1];
      i.fire ||= b(1); i.thrust ||= b(0); i.bomb ||= b(2); i.drone ||= b(3); i.shiftL ||= b(4) || b(6); i.shiftR ||= b(5) || b(7); i.upgrade ||= b(8); i.pause ||= b(9); i.ok ||= b(1); i.back ||= b(0); i.start ||= b(9); }
    i.mx = (R ? 1 : 0) - (L ? 1 : 0) || ax; i.my = (D ? 1 : 0) - (U ? 1 : 0) || ay;
    if (stick) { const dx = stick.x - stick.ox, dy = stick.y - stick.oy, d = Math.hypot(dx, dy); if (d > 6) { const m = Math.min(1, d / 44); i.mx = dx / d * m; i.my = dy / d * m; } }
    for (const b of tb) i[b] = true;
    if (opt.autofire) i.fire = true; if (opt.autothrust) i.thrust = true;
    latK.clear(); latP.clear();
    i.left = i.mx < -0.5; i.right = i.mx > 0.5; i.up = i.my < -0.5; i.down = i.my > 0.5;
    return i;
  }
  // touch
  const sPt = e => { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }; };
  stickEl.addEventListener('pointerdown', e => { lastDev = 'touch'; audio.unlock(); const p = sPt(e); stick = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y }; stickEl.setPointerCapture(e.pointerId); nubEl.hidden = false; nubEl.style.left = p.x + 'px'; nubEl.style.top = p.y + 'px'; e.preventDefault(); });
  stickEl.addEventListener('pointermove', e => { if (!stick || e.pointerId !== stick.id) return; const p = sPt(e); stick.x = p.x; stick.y = p.y; const dx = p.x - stick.ox, dy = p.y - stick.oy, d = Math.hypot(dx, dy) || 1, m = Math.min(28, d); nubEl.firstChild.style.transform = `translate(${dx / d * m}px,${dy / d * m}px)`; });
  const stickUp = e => { if (stick && e.pointerId === stick.id) { stick = null; nubEl.hidden = true; nubEl.firstChild.style.transform = ''; } }; stickEl.addEventListener('pointerup', stickUp); stickEl.addEventListener('pointercancel', stickUp);
  for (const b of touchEl.querySelectorAll('b')) { const n = b.dataset.b; const dn = e => { lastDev = 'touch'; audio.unlock(); tb.add(n); b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch { } e.preventDefault(); }, up = () => { tb.delete(n); b.classList.remove('on'); }; b.addEventListener('pointerdown', dn); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); }
  canvas.addEventListener('pointerdown', e => { audio.unlock(); if (e.pointerType === 'touch') lastDev = 'touch'; const p = sPt(e); tap = p; canvas.focus({ preventScroll: true }); });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // ---------- menus ----------
  const top = () => menus[menus.length - 1];
  function push(m) { m.i = m.i || 0; menus.push(m); prevM = { ok: true, back: true, up: true, down: true, left: true, right: true, pause: true, start: true }; }
  function popMenu() { const m = menus.pop(); audio.sfx('back'); prevM = { ok: true, back: true, up: true, down: true, left: true, right: true, pause: true, start: true }; return m; }
  const onoff = v => v ? 'ON' : 'OFF';
  function optionsMenu() { push({ title: 'OPTIONS', items: [
    { label: () => 'MUSIC  ' + Math.round(opt.music * 10), adj: d => { opt.music = Math.max(0, Math.min(1, opt.music + d * 0.1)); audio.vol(); saveOpt(); } },
    { label: () => 'SOUND  ' + Math.round(opt.sfx * 10), adj: d => { opt.sfx = Math.max(0, Math.min(1, opt.sfx + d * 0.1)); audio.vol(); saveOpt(); audio.sfx('blip'); } },
    { label: () => 'ANNOUNCER  ' + onoff(opt.voice), adj: () => { opt.voice = !opt.voice; saveOpt(); if (opt.voice) audio.say('announcer on', true); else audio.hush(); } },
    { label: () => 'GLOW  ' + opt.glow.toUpperCase(), adj: () => { opt.glow = opt.glow === 'high' ? 'low' : 'high'; saveOpt(); fit(); } },
    { label: () => 'SCREEN SHAKE  ' + onoff(opt.shake), adj: () => { opt.shake = !opt.shake; saveOpt(); } },
    { label: () => 'AUTO SHOOT  ' + onoff(opt.autofire), adj: () => { opt.autofire = !opt.autofire; saveOpt(); } },
    { label: () => 'AUTO THRUST  ' + onoff(opt.autothrust), adj: () => { opt.autothrust = !opt.autothrust; saveOpt(); } },
    { label: () => 'IDLE MODE  ' + onoff(opt.idle), adj: () => setIdle(!opt.idle) },
    { label: 'CONTROLS', act: () => push({ title: 'CONTROLS', kind: 'controls', items: [{ label: 'BACK', act: popMenu }] }) },
    { label: 'BACK', act: popMenu }] }); }
  function setIdle(v) { opt.idle = v; saveOpt(); if (v) assisted = true; }
  function mapMenu(after) { push({ title: 'SOLAR MAP', kind: 'map', sel: 0, after, items: [{ label: after ? 'CONTINUE' : 'BACK', act: () => { popMenu(); after?.(); } }] }); }
  function scoresMenu() { const m = { title: 'HIGH SCORES', kind: 'scores', rows: LS.get('scores', []), items: [{ label: 'BACK', act: popMenu }] }; push(m); if (host.leaderboard) { m.rows = null; Promise.resolve(host.leaderboard()).then(r => { m.rows = Array.isArray(r) ? r : []; }).catch(() => { m.rows = LS.get('scores', []); }); } }
  function titleMenu() { menus.length = 0; const items = []; if (LS.get('save', null)) items.push({ label: 'CONTINUE', act: () => startGame(LS.get('save', null)) });
    items.push({ label: 'START GAME', act: () => startStory(STORY, () => startGame(null)) }, { label: 'OPTIONS', act: optionsMenu }, { label: 'SOLAR MAP', act: () => mapMenu() }, { label: 'HIGH SCORES', act: scoresMenu });
    if (host.onExit) items.push({ label: 'EXIT GAME', act: () => host.onExit() }); push({ kind: 'title', root: true, items }); }
  function pauseMenu() { if (scene !== 'play' || menus.length) return; audio.sfx('blip'); audio.hush(); audio.music('title'); push({ title: 'PAUSED', pause: true, items: [
    { label: 'RESUME', act: resume }, { label: 'MAP', act: () => mapMenu() }, { label: 'OPTIONS', act: optionsMenu }, { label: () => 'IDLE MODE  ' + onoff(opt.idle), act: () => setIdle(!opt.idle), adj: () => setIdle(!opt.idle) },
    { label: 'SAVE AND QUIT', act: () => { LS.set('save', snapshot(g)); showTitle(); } }] }); }
  function resume() { menus.length = 0; audio.music(g?.boss ? 'boss' : 'play'); prevIn = { pause: true, fire: true, upgrade: true, bomb: true, drone: true, shiftL: true, shiftR: true }; last = performance.now(); acc = 0; }
  function menuInput(i) {
    const m = top(), e = k => i[k] && !prevM[k]; if (!m) return;
    if (tap) { for (const h of hits) if (tap.x >= h.x && tap.x <= h.x + h.w && tap.y >= h.y && tap.y <= h.y + h.h) { if (h.fn) h.fn(tap); else { m.i = h.i; const it = m.items[h.i]; audio.sfx('ok'); if (it.act) it.act(); else it.adj?.(1); } break; } tap = null; prevM = i; return; }
    if (m.kind === 'map') { if (e('left')) { m.sel = (m.sel + 3) % 4; audio.sfx('move'); } if (e('right')) { m.sel = (m.sel + 1) % 4; audio.sfx('move'); } }
    else { if (e('up')) { m.i = (m.i + m.items.length - 1) % m.items.length; audio.sfx('move'); } if (e('down')) { m.i = (m.i + 1) % m.items.length; audio.sfx('move'); } }
    const it = m.items[m.i];
    if (it.adj && (e('left') || e('right'))) { it.adj(e('left') ? -1 : 1); audio.sfx('move'); }
    else if (e('ok')) { audio.sfx('ok'); if (it.act) it.act(); else it.adj?.(1); }
    else if (m.pause && (e('pause') || e('start'))) resume();
    else if (e('back') && !m.root && !m.locked) { if (m.pause) resume(); else if (m.after) { popMenu(); m.after(); } else popMenu(); }
    prevM = i;
  }

  // ---------- story ----------
  const STORY = ['THE COSMIC SHIFT HAS BEGUN.', 'A RIFT FROM PLANET X IS FOLDING REALITY,', 'ONE WORLD AT A TIME.', "EARTH'S OWN DEFENCE GRID HAS TURNED ON ITS CITIES.", 'ONE SHIP CAN SEE ALL FOUR FACES OF THE FOLD.', 'YOURS.', 'SHIFT WITH IT. OR BE FLATTENED.'];
  const ENDING = ['EARTH HOLDS.', 'THE OVERSEER IS SILENT AND THE CITY LIGHTS ARE YOURS AGAIN.', 'BUT THE SHIFT ROLLS ON.', 'MARS IS ALREADY FOLDING.', 'TO BE CONTINUED...'];
  function startStory(lines, after) { menus.length = 0; story = { lines, after, t: 0, said: -1 }; scene = 'story'; sceneT = 0; prevM = { ok: true, pause: true, back: true }; audio.music('title'); }
  function drawStory() { const st = story, t = performance.now() / 1000; ctx.fillStyle = '#02010a'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#8fa8ff'; for (let k = 0; k < 80; k++) { ctx.globalAlpha = 0.2 + (k % 5) * 0.12; ctx.fillRect((k * 131 + st.t * (0.2 + k % 3 * 0.15)) % W, (k * 71) % H, 1.5, 1.5); } ctx.globalAlpha = 1;
    const ex = 760, ey = 300, er = 92; ctx.strokeStyle = '#2ee6ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.stroke(); ctx.globalAlpha = 0.5; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.ellipse(ex, ey, er, er * k / 4, 0, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.ellipse(ex, ey, er * Math.abs(Math.cos(t * 0.3 + k * 0.8)), er, 0, 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ff3df0'; ctx.lineWidth = 2; for (let j = 0; j < 3; j++) { ctx.beginPath(); for (let k = 0; k <= 14; k++) { const yy = 60 + k * 30, xx = 600 + j * 14 + Math.sin(k * 1.7 + t * 2 + j) * (10 + k * 1.5) + (k % 2 ? 9 : -9); k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.globalAlpha = 0.9 - j * 0.3; ctx.stroke(); } ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over'; const per = 150, n = Math.min(st.lines.length, 1 + (st.t / per | 0));
    for (let k = 0; k < n; k++) { const age = st.t - k * per, ln = st.lines[k], shown = ln.slice(0, Math.max(0, age * 0.9 | 0)); text(ctx, shown, 70, 110 + k * 44, ln.length > 44 ? 10 : 13, k === n - 1 ? '#ffffff' : '#8d9be0', { glow: k === n - 1 }); }
    text(ctx, lastDev === 'touch' ? 'TAP TO SKIP' : lastDev === 'pad' ? padNames()[0] + ' TO SKIP' : 'ENTER TO SKIP', 480, 512, 7, '#5a66b0', { align: 'center', glow: false }); }

  // ---------- flow ----------
  function showTitle() { scene = 'title'; sceneT = 0; g = null; attract = createGame({ seed: 7 + (Math.random() * 99 | 0), level: level() }); attract.players[0].lives = 99; titleMenu(); audio.music('title'); host.onState?.({ scene }); }
  function startGame(save) { menus.length = 0; story = null; hiShown = false; toasts.length = 0; g = createGame({ seed: (Math.random() * 1e9) | 0, level: level(), start: save }); assisted = !!opt.idle || !!save; submitted = false; scene = 'play'; sceneT = 0; warpFx = 70; endInfo = null; audio.sfx('whoosh'); audio.music('play'); audio.say(save ? 'resuming. earth.' : 'level one. earth.', true); prevIn = { fire: true, upgrade: true, pause: true }; host.onState?.({ scene }); }
  function finish(cleared) { if (!g || submitted) return; submitted = true; const res = { score: g.score, cleared, assisted, level: 1, warp: g.flags.warp, chain: g.bestChain, kills: g.stats.kills, shifts: g.stats.shifts };
    const best = LS.get('best', 0); if (g.score > best) LS.set('best', g.score); const rows = LS.get('scores', []); rows.push({ name: assisted ? 'ASSIST' : 'YOU', score: g.score, assisted }); rows.sort((a, b) => b.score - a.score); LS.set('scores', rows.slice(0, 8));
    try { host.submitScore?.(res); } catch { } return res; }
  function endMenu(cleared) { endInfo = { cleared, t: 0 }; if (cleared) LS.del('save'); finish(cleared); audio.music('title');
    const items = cleared ? [{ label: 'CONTINUE', act: () => startStory(ENDING, () => { scene = 'play'; mapMenu(showTitle); top().sel = 1; top().locked = true; }) }]
      : [{ label: 'RETRY FROM CHECKPOINT', act: () => { const s = { ...g.cpSnap, lives: 3 }; startGame(s); } }, { label: 'QUIT TO TITLE', act: showTitle }];
    push({ kind: 'end', root: true, cleared, items }); }

  // ---------- frame ----------
  let prevIn = {};
  function update(i) {
    sceneT++;
    if (scene === 'intro') { if ((i.ok && !prevM.ok) || (i.pause && !prevM.pause) || tap || sceneT > 520) { tap = null; showTitle(); titleT = 0; audio.sfx('slam'); } if (sceneT === 280) audio.sfx('whoosh'); prevM = i; return; }
    if (scene === 'story') { const st = story; st.t++; const k = st.t / 150 | 0; if (k < st.lines.length && k !== st.said) { st.said = k; audio.say(st.lines[k], true); } if (tap || (i.ok && !prevM.ok) || (i.pause && !prevM.pause) || st.t > st.lines.length * 150 + 120) { tap = null; audio.hush(); const f = st.after; story = null; f(); } prevM = i; return; }
    if (scene === 'title') { titleT++; step(attract, [autopilot(attract)]); if (attract.state !== 'play' || attract.camZ > 1150) { attract = createGame({ seed: sceneT, level: level() }); attract.players[0].lives = 99; } menuInput(i); return; }
    if (menus.length) { if (top().kind === 'end' && endInfo) { endInfo.t++; step(g, [{}]); } menuInput(i); return; }
    if (i.pause && !prevIn.pause) { pauseMenu(); prevIn = i; return; }
    if (warpFx > 0) warpFx--;
    const inp = opt.idle ? autopilot(g) : i; if (opt.idle) assisted = true;
    step(g, [inp]); prevIn = i;
    for (const f of g.fx) { if (f.startsWith('say:')) { audio.say(f.slice(4), true); continue; } if (f.startsWith('toast:')) { const [a, b] = f.slice(6).split('|'); toast(a, b); continue; }
      if (f === 'shift') audio.say(VIEWS[g.view] + ' view'); if (f === 'hint' && g.hint && !g.hint.includes(' / ')) audio.say(g.hint.replace('//', '.').replace(' - ', '. '), true); audio.sfx(f); if (f === 'bossin') audio.music('boss'); if (f === 'die' || f === 'bomb' || f === 'boom2') window.ArcadeGridzPad?.rumble?.(f === 'boom2' ? 160 : 260, 0.8); }
    if (!hiShown && !assisted && g.score > LS.get('best', 0) && LS.get('best', 0) > 0) { hiShown = true; toast('NEW HIGH SCORE', 'KEEP IT ROLLING'); audio.sfx('ring'); audio.say('new high score'); }
    if (g.state !== 'play' && g.endT > (g.state === 'clear' ? 100 : 70) && !menus.length) endMenu(g.state === 'clear');
  }
  function panel(x, y, w, h, col = '#2ee6ff') { ctx.fillStyle = 'rgba(4,5,22,.86)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.3; ctx.strokeRect(x - 3, y - 3, w + 6, h + 6); ctx.globalAlpha = 1; ctx.strokeRect(x, y, w, h); }
  function drawItems(m, cx, y, size, gap) { const t = performance.now() / 1000; m.items.forEach((it, k) => { const lab = typeof it.label === 'function' ? it.label() : it.label, on = k === m.i, w = textWidth(lab, size), yy = y + k * gap;
    if (on) { ctx.fillStyle = '#ff3df0'; ctx.globalAlpha = 0.16 + 0.06 * Math.sin(t * 6); ctx.fillRect(cx - w / 2 - 34, yy - 7, w + 68, size + 14); ctx.globalAlpha = 1; text(ctx, '>', cx - w / 2 - 26, yy, size, '#ffe14a'); if (it.adj) text(ctx, '<', cx + w / 2 + 12, yy, size, '#ffe14a'); }
    text(ctx, lab, cx, yy, size, on ? '#ffffff' : '#8d9be0', { align: 'center', glow: on }); hits.push({ x: cx - w / 2 - 40, y: yy - 9, w: w + 80, h: size + 18, i: k }); }); }
  function drawMap(m) {
    const t = performance.now() / 1000, sy = 250; ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(90, sy, 30, 0, TAU); ctx.stroke(); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + t * 0.3; ctx.beginPath(); ctx.moveTo(90 + Math.cos(a) * 36, sy + Math.sin(a) * 36); ctx.lineTo(90 + Math.cos(a) * (44 + 4 * Math.sin(t * 3 + k)), sy + Math.sin(a) * (44 + 4 * Math.sin(t * 3 + k))); ctx.stroke(); }
    ctx.lineWidth = 1; for (const p of PLANETS) { ctx.strokeStyle = '#26348c'; ctx.beginPath(); ctx.ellipse(90, sy, p.x - 90, (p.x - 90) * 0.42, 0, -0.9, 0.9); ctx.stroke(); }
    ctx.fillStyle = '#8d9be0'; for (let k = 0; k < 40; k++) { const a = -0.8 + k / 40 * 1.6 + Math.sin(k * 9) * 0.02, r = 430 + Math.sin(k * 7) * 12; ctx.fillRect(90 + Math.cos(a) * r, sy + Math.sin(a) * r * 0.42, 2, 2); }
    ctx.strokeStyle = '#ff3df0'; ctx.setLineDash([6, 6]); ctx.beginPath(); PLANETS.forEach((p, k) => k ? ctx.lineTo(p.x, sy) : ctx.moveTo(p.x, sy)); ctx.stroke(); ctx.setLineDash([]);
    const warp = LS.get('warps', {});
    PLANETS.forEach((p, k) => { const on = m.sel === k; ctx.strokeStyle = p.col; ctx.lineWidth = on ? 3 : 1.5; ctx.beginPath(); ctx.arc(p.x, sy, p.r, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.ellipse(p.x, sy, p.r, p.r * 0.35, 0.3 + t * 0.2 * (k % 2 ? 1 : -1), 0, TAU); ctx.stroke();
      if (k === 2) { ctx.beginPath(); ctx.ellipse(p.x, sy, p.r * 1.6, p.r * 0.4, -0.2, 0, TAU); ctx.stroke(); }
      if (on) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, sy, p.r + 8 + 2 * Math.sin(t * 5), 0, TAU); ctx.stroke(); }
      text(ctx, p.name, p.x, sy + p.r + 16, 9, on ? '#ffffff' : p.col, { align: 'center', glow: on });
      const bx = p.x + (k === 3 ? -38 : 34), by = sy - p.r - 26, found = !!warp[p.id]; ctx.strokeStyle = found ? '#b06bff' : '#4a3a7a'; ctx.beginPath(); ctx.arc(bx, by, 5, 0, TAU); ctx.stroke(); text(ctx, found ? p.warp : '?', bx, by - 16, 7, found ? '#b06bff' : '#4a3a7a', { align: 'center', glow: false });
      hits.push({ x: p.x - 40, y: sy - 50, w: 80, h: 100, fn: () => { m.sel = k; audio.sfx('move'); } }); });
    if ((t * 2 | 0) % 2) { const cur = m.after ? 1 : 0; text(ctx, 'YOU', PLANETS[cur].x, sy - PLANETS[cur].r - 58, 8, '#ffe14a', { align: 'center' }); }
    ctx.globalCompositeOperation = 'source-over';
    const p = PLANETS[m.sel]; panel(150, 372, 660, 96, p.col);
    text(ctx, 'LEVEL ' + (m.sel + 1) + ' // ' + p.name + ' - ' + p.sub, 170, 384, 13, '#ffffff'); text(ctx, p.info, 170, 408, 8, '#9fb0ff', { glow: false });
    text(ctx, 'BOSS: ' + p.boss, 170, 428, 9, '#ff4d6d', { glow: false }); text(ctx, 'HIDDEN WARP: ' + (warp[p.id] ? p.warp + ' - FOUND' : '???'), 400, 428, 9, '#b06bff', { glow: false });
    text(ctx, p.open ? 'BEST SCORE ' + LS.get('best', 0) : 'NOT IN THIS DEMO', 170, 448, 9, p.open ? '#3dffb0' : '#ffe14a', { glow: false });
    text(ctx, '< > BROWSE', 480, 356, 7, '#5a66b0', { align: 'center', glow: false });
  }
  const padNames = () => window.ArcadeGridzPad?.glyphs?.() === 'xbox' ? ['B', 'A', 'X', 'Y', 'LB / RB', 'VIEW', 'MENU'] : ['A', 'B', 'Y', 'X', 'L / R', 'SELECT', 'START'];
  function drawControls() { const pn = padNames(), rows = [['MOVE', 'ARROWS / WASD', 'D-PAD'], ['FIRE', 'SPACE / Z / J', pn[0]], ['THRUSTERS', 'V / F', pn[1]], ['BOMB', 'X / K', pn[2]], ['DRONE MODE', 'C / L', pn[3]], ['SHIFT VIEW', 'SHIFT KEYS / Q E', pn[4]], ['BUY UPGRADE', 'ENTER / R', pn[5]], ['PAUSE', 'ESC / P', pn[6]]];
    text(ctx, 'KEYBOARD', 430, 150, 8, '#2ee6ff', { glow: false }); text(ctx, 'CONTROLLER', 660, 150, 8, '#ff3df0', { glow: false });
    rows.forEach((r, k) => { const y = 172 + k * 24; text(ctx, r[0], 210, y, 10, '#ffe14a', { glow: false }); text(ctx, r[1], 430, y, 10, '#ffffff', { glow: false }); text(ctx, r[2], 660, y, 10, '#ffffff', { glow: false }); });
    text(ctx, 'TOUCH: DRAG LEFT SIDE TO FLY. BUTTONS ON THE RIGHT.', 480, 372, 8, '#9fb0ff', { align: 'center', glow: false }); }
  function drawMenu() {
    hits = []; const m = top(); if (!m) return; const t = performance.now() / 1000;
    if (m.kind === 'title') {
      const k = Math.min(1, titleT / 18), sc = 1 + (1 - k) * (1 - k) * 2.2; if (titleT < 26) ctx.translate((Math.random() - 0.5) * (26 - titleT) * 0.5, (Math.random() - 0.5) * (26 - titleT) * 0.5);
      drawLogo(ctx, 480, 52 - (sc - 1) * 30, sc, t); ctx.setTransform(res, 0, 0, res, 0, 0);
      text(ctx, 'ONE SHIP. FOUR WAYS TO SEE THE FIGHT.', 480, 150, 9, '#ffe14a', { align: 'center' });
      ctx.globalCompositeOperation = 'lighter'; const a = t * 0.7; meshScreen(ctx, SHIP_HULL, 742, 320, 78, a, -0.35 + Math.sin(t) * 0.1, Math.sin(t * 0.8) * 0.3, '#ffffff'); meshScreen(ctx, SHIP_WING, 742, 320, 78, a, -0.35 + Math.sin(t) * 0.1, Math.sin(t * 0.8) * 0.3, '#2ee6ff'); meshScreen(ctx, SHIP_FIN, 742, 320, 78, a, -0.35 + Math.sin(t) * 0.1, Math.sin(t * 0.8) * 0.3, '#ff3df0'); ctx.globalCompositeOperation = 'source-over';
      panel(150, 196, 380, m.items.length * 36 + 26, '#ff3df0'); drawItems(m, 340, 216, 15, 36);
      text(ctx, 'GITHUB GAME OFF 2026  //  DEMO: LEVEL 1 EARTH', 480, 500, 8, '#5a66b0', { align: 'center', glow: false });
      text(ctx, lastDev === 'pad' ? padNames()[0] + ' = OK     ' + padNames()[1] + ' = BACK' : lastDev === 'touch' ? 'TAP TO CHOOSE' : 'ENTER = OK     ESC = BACK', 480, 518, 8, '#8d9be0', { align: 'center', glow: false }); return; }
    ctx.fillStyle = 'rgba(2,1,10,.72)'; ctx.fillRect(0, 0, W, H);
    if (m.kind === 'end') { const c = m.cleared, col = c ? '#3dffb0' : '#ff4d6d'; text(ctx, c ? 'SECTOR CLEAR' : 'GAME OVER', 480, 96, 40, col, { align: 'center', weight: 4 });
      const rows = [['SCORE', g.score], ['BEST CHAIN', g.bestChain], ['KILLS', g.stats.kills], ['VIEW SHIFTS', g.stats.shifts], ['MOON WARP', g.flags.warp ? 'FOUND' : 'NOT FOUND']]; rows.forEach((r, k) => { if (endInfo.t > 20 + k * 14) { text(ctx, r[0], 330, 176 + k * 26, 12, '#9fb0ff', { glow: false }); text(ctx, String(r[1]), 630, 176 + k * 26, 12, '#ffffff', { align: 'right' }); } });
      if (assisted) text(ctx, 'ASSISTED RUN', 480, 312, 8, '#ffe14a', { align: 'center', glow: false });
      if (endInfo.t > 100) drawItems(m, 480, 350, 15, 36); else m.i = 0; return; }
    const full = m.kind === 'map' || m.kind === 'controls' || m.kind === 'scores';
    const n = m.items.length, h = full ? 0 : n * 34 + 80, y0 = full ? 60 : 270 - h / 2;
    if (!full) panel(270, y0, 420, h, m.pause ? '#2ee6ff' : '#ff3df0'); else panel(40, 40, 880, 460, '#2ee6ff');
    text(ctx, m.title, 480, y0 + (full ? 0 : 18), 22, '#ffe14a', { align: 'center', weight: 2.6 });
    if (m.kind === 'map') { drawMap(m); drawItems(m, 480, 478, 12, 30); }
    else if (m.kind === 'controls') { drawControls(); drawItems(m, 480, 440, 14, 30); }
    else if (m.kind === 'scores') { const rows = m.rows; if (!rows) text(ctx, 'LOADING...', 480, 240, 12, '#9fb0ff', { align: 'center' }); else if (!rows.length) text(ctx, 'NO SCORES YET', 480, 240, 12, '#9fb0ff', { align: 'center' });
      else rows.slice(0, 10).forEach((r, k) => { const y = 124 + k * 30; text(ctx, String(k + 1), 250, y, 13, '#ffe14a', { align: 'right' }); text(ctx, String(r.name || '???').slice(0, 14), 280, y, 13, '#ffffff'); text(ctx, String(r.score), 700, y, 13, '#3dffb0', { align: 'right' }); const tag = r.cheater ? 'CHEATER' : r.assisted ? 'ASSISTED' : r.verified === false ? 'UNVERIFIED' : ''; if (tag) text(ctx, tag, 716, y + 3, 7, '#ff8a2b', { glow: false }); });
      drawItems(m, 480, 450, 14, 30); }
    else drawItems(m, 480, y0 + 62, 14, 34);
  }
  function drawIntro() {
    const t = sceneT / 60; ctx.fillStyle = '#02010a'; ctx.fillRect(0, 0, W, H);
    const fade = (a, b) => Math.max(0, Math.min(1, (t - a) / 0.5, (b - t) / 0.5));
    if (t < 2.3) { const a = fade(0, 2.3); ctx.globalCompositeOperation = 'lighter'; text(ctx, 'GRIDDIM', 480, 225, 56, '#2ee6ff', { align: 'center', alpha: a, weight: 5 }); text(ctx, 'NETWORK', 480, 310, 12, '#ffffff', { align: 'center', alpha: a }); ctx.strokeStyle = '#2ee6ff'; ctx.globalAlpha = a * 0.5; ctx.lineWidth = 1; for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.moveTo(180 + k * 75, 200); ctx.lineTo(180 + k * 75, 340); ctx.stroke(); } ctx.globalAlpha = 1; }
    else if (t < 4.6) { const a = fade(2.3, 4.6); ctx.globalCompositeOperation = 'lighter'; text(ctx, 'ARCADE', 480 - textWidth('ARCADEGRIDZ', 50) / 2, 225, 50, '#ff3df0', { alpha: a, weight: 5 }); text(ctx, 'GRIDZ', 480 - textWidth('ARCADEGRIDZ', 50) / 2 + textWidth('ARCADE', 50) + 50 * 0.27, 225, 50, '#ffe14a', { alpha: a, weight: 5 }); text(ctx, 'PRESENTS', 480, 305, 12, '#ffffff', { align: 'center', alpha: a }); }
    else { const u = Math.min(1, (t - 4.6) / 4); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#8fa8ff'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k < 90; k++) { const a = k * 2.399, r0 = ((k * 37 + sceneT * (3 + u * 14)) % 560), l = 4 + u * 40; ctx.moveTo(480 + Math.cos(a) * r0, 270 + Math.sin(a) * r0 * 0.6); ctx.lineTo(480 + Math.cos(a) * (r0 + l), 270 + Math.sin(a) * (r0 + l) * 0.6); } ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
      const s = u < 0.62 ? 5 + Math.pow(u / 0.62, 2.2) * 210 : 215 - Math.pow((u - 0.62) / 0.38, 0.7) * 205, x = 480 + Math.sin(u * TAU) * 300 * Math.min(1, u * 1.6), y = 270 - Math.sin(u * Math.PI) * 50 + (u > 0.62 ? (u - 0.62) * -200 : 0), yaw = Math.PI * (1 - Math.min(1, u * 1.25)), roll = Math.sin(u * Math.PI * 1.5) * 1.3, pitch = -0.3 + u * 0.55;
      meshScreen(ctx, SHIP_HULL, x, y, s, yaw, pitch, roll, '#ffffff'); meshScreen(ctx, SHIP_WING, x, y, s, yaw, pitch, roll, '#2ee6ff'); meshScreen(ctx, SHIP_FIN, x, y, s, yaw, pitch, roll, '#ff3df0');
      if (u > 0.93) { ctx.fillStyle = '#fff'; ctx.globalAlpha = (u - 0.93) / 0.07; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; } }
    ctx.globalCompositeOperation = 'source-over'; if (t > 0.8) text(ctx, lastDev === 'touch' ? 'TAP TO SKIP' : 'PRESS ANY BUTTON TO SKIP', 480, 512, 7, '#3a4380', { align: 'center', glow: false });
  }
  function render() {
    ctx.setTransform(res, 0, 0, res, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const ro2 = { glow: opt.glow === 'high', shake: opt.shake };
    if (scene === 'intro') drawIntro();
    else if (scene === 'story') drawStory();
    else { ctx.fillStyle = '#02010a'; ctx.fillRect(0, 0, W, H); const gg = scene === 'title' ? attract : g;
      drawWorld(ctx, gg, ro2); ctx.setTransform(res, 0, 0, res, 0, 0); ctx.globalCompositeOperation = 'source-over';
      if (scene === 'title') { ctx.fillStyle = 'rgba(2,1,10,.62)'; ctx.fillRect(0, 0, W, H); if (titleT < 14) { ctx.fillStyle = '#fff'; ctx.globalAlpha = 1 - titleT / 14; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; } }
      else { drawHUD(ctx, g, { hi: Math.max(LS.get('best', 0), g.score), upgLabel: lastDev === 'touch' ? 'TAP' : lastDev === 'pad' ? padNames()[5] : 'ENTER' }); if (opt.idle) text(ctx, 'IDLE MODE', 18, 80, 8, '#ffe14a', { glow: false });
        if (sceneT < 150 && !g.boss) { const a = Math.min(1, (150 - sceneT) / 30); text(ctx, 'LEVEL 1', 480, 190, 14, '#ffe14a', { align: 'center', alpha: a }); text(ctx, 'EARTH', 480, 214, 44, '#2ee6ff', { align: 'center', alpha: a, weight: 4 }); }
        if (warpFx > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#bfe9ff'; ctx.globalAlpha = warpFx / 70; ctx.lineWidth = 1.5; ctx.beginPath(); for (let k = 0; k < 80; k++) { const a = k * 2.399, r0 = (k * 53 + (70 - warpFx) * 22) % 600, l = warpFx * 2; ctx.moveTo(480 + Math.cos(a) * r0, 270 + Math.sin(a) * r0 * 0.6); ctx.lineTo(480 + Math.cos(a) * (r0 + l), 270 + Math.sin(a) * (r0 + l) * 0.6); } ctx.stroke(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } } }
    if (scene === 'play' && toasts.length) { let y = 92; for (const q of toasts) { q.t++; const k = Math.min(1, q.t / 14, (300 - q.t) / 20), x = W - 18 - 250 * Math.max(0, k); if (k <= 0) continue; ctx.fillStyle = 'rgba(4,5,22,.88)'; ctx.fillRect(x, y, 250, 40); ctx.strokeStyle = '#3dffb0'; ctx.lineWidth = 2; ctx.strokeRect(x, y, 250, 40); ctx.fillStyle = '#3dffb0'; ctx.fillRect(x, y, 5, 40); text(ctx, q.a, x + 16, y + 8, 11, '#ffffff'); text(ctx, q.b, x + 16, y + 26, 7, '#3dffb0', { glow: false }); y += 48; } while (toasts.length && toasts[0].t > 300) toasts.shift(); }
    drawMenu();
    const showTouch = lastDev === 'touch' && scene === 'play' && !menus.length; if (touchEl.hidden === showTouch) { touchEl.hidden = !showTouch; if (!showTouch) { tb.clear(); stick = null; nubEl.hidden = true; } }
  }
  function frame(now) {
    if (destroyed) return; raf = requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now; if (dt > 0.25) dt = 0.25; if (focusPaused) return; acc += dt; let n = 0;
    while (acc >= 1 / 60 && n < 5) { acc -= 1 / 60; n++; const i = readInput(); update(i); if (tap && scene !== 'intro' && !menus.length) tap = null; } if (n === 5) acc = 0;
    if (g && scene === 'play' && g.flags.warp) { const w = LS.get('warps', {}); if (!w.earth) { w.earth = 1; LS.set('warps', w); } }
    render();
  }

  // ---------- focus / lifecycle ----------
  function pauseForFocus() { if (destroyed) return; keys.clear(); pad.clear(); tb.clear(); stick = null; if (scene === 'play' && !menus.length) pauseMenu(); focusPaused = true; audio.suspend(); }
  function wake() { if (destroyed || !focusPaused || document.hidden) return; focusPaused = false; last = performance.now(); acc = 0; audio.resume(); }
  const onBlur = () => pauseForFocus(), onFocus = () => wake(), onVis = () => document.hidden ? pauseForFocus() : wake();
  addEventListener('blur', onBlur); addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onVis);
  canvas.addEventListener('pointerdown', () => wake());
  function destroy() { if (destroyed) return; destroyed = true; cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('resize', fit); removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKey, true); removeEventListener('blur', onBlur); removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVis); audio.close(); root.innerHTML = ''; }

  fit(); prevM = { ok: true, pause: true }; raf = requestAnimationFrame(frame); try { canvas.focus({ preventScroll: true }); } catch { }
  return { ownsFocusPause: true, destroy, pauseForFocus, resumeFromFocus: wake,
    getState: () => ({ scene, state: g?.state || scene, score: g?.score || 0, lives: g ? Math.max(0, g.players[0].lives) : 0, view: g ? VIEWS[g.view] : '-', chain: g?.chain || 0, best: LS.get('best', 0), boss: !!g?.boss, warp: !!g?.flags.warp, paused: menus.length > 0 && scene === 'play', idle: !!opt.idle, muted: !!opt.mute, menu: scene !== 'play' }),
    control(a) { if (a === 'sound') { opt.mute = !opt.mute; saveOpt(); audio.vol(); if (opt.mute) audio.hush(); } else if (a === 'exit') host.onExit?.(); else if (a === 'pause') { if (menus.length && top().pause) resume(); else pauseMenu(); } else if (a === 'idle') setIdle(!opt.idle); else if (a === 'menu') showTitle(); else if (a === 'start' || a === 'restart') startGame(null); },
    getResult: () => ({ score: g?.score || 0, state: g?.state || scene, assisted }),
    _debug: { game: () => g, scene: () => scene, menus, opt, startGame, showTitle, setIdle, startStory, skipIntro: () => { showTitle(); titleT = 99; } } };
}
