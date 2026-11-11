// screenshots through a real browser. usage: node tools/shot.mjs
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..'), out = process.argv[2] || '/tmp/shots'; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, s) => { const f = path.join(root, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); s.end(d); }); }).listen(0);
const port = srv.address().port;
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const pg = await b.newPage({ viewport: { width: 960, height: 540 } }); const errs = [];
pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await pg.goto(`http://localhost:${port}/`); const shot = n => pg.screenshot({ path: `${out}/${n}.png` });
await pg.waitForTimeout(1200); await shot('01-griddim'); await pg.waitForTimeout(2300); await shot('02-arcadegridz'); await pg.waitForTimeout(3300); await shot('03-flyby'); await pg.waitForTimeout(900); await shot('03b-flyby');
await pg.waitForTimeout(3200); await shot('04-title');
await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300); await shot('05-map'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200); await shot('06-options'); await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200); await shot('07-controls'); await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
// play with the autopilot, grabbing each view
await pg.evaluate(() => { const d = window.shift._debug; d.opt.idle = true; d.startGame(null); });
const jump = async (z, n) => { await pg.evaluate(z => { const d = window.shift._debug; d.startGame({ z, lives: 9, up: [2, 3, 3, 2, 3, 0, 0], shield: 1, bombs: 3 }); }, z); await pg.waitForTimeout(5200); await shot(n); };
await pg.waitForTimeout(6000); await shot('10-side');
await jump(150, '11-top'); await jump(370, '12-side-skyway'); await jump(590, '13-chase'); await jump(840, '14-iso'); await pg.waitForTimeout(6500); await shot('14b-iso-warp');
await jump(1218, '15-boss'); await pg.waitForTimeout(9000); await shot('15b-boss'); await pg.keyboard.press('KeyP'); await pg.waitForTimeout(300); await shot('16-pause');

await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300); await shot('17-pause-map'); await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
await pg.evaluate(() => { const g = window.shift._debug.game(); g.boss.stage = 2; g.boss.hp = 1; }); await pg.waitForTimeout(6500); await shot('18-clear'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400); await shot('19-clear-map');
await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
await pg.evaluate(() => { const d = window.shift._debug; d.opt.idle = false; d.startGame(null); }); await pg.waitForTimeout(800); await pg.evaluate(() => { const g = window.shift._debug.game(); g.players[0].lives = 0; g.players[0].inv = 0; g.ebul.push({ x: 0, y: 4.5, z: 3, vx: 0, vy: 0, vz: 0, r: 1, life: 99 }); }); await pg.waitForTimeout(3500); await shot('20-gameover');
const st = await pg.evaluate(() => ({ scene: window.shift._debug.scene(), menus: window.shift._debug.menus.length })); console.log(JSON.stringify(st));
// phone, touch
const ph = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); const p2 = await ph.newPage(); p2.on('pageerror', e => errs.push('PAGEERROR(touch) ' + e.message));
await p2.goto(`http://localhost:${port}/`); await p2.waitForTimeout(600); await p2.touchscreen.tap(400, 200); await p2.waitForTimeout(700); await p2.screenshot({ path: `${out}/30-touch-title.png` });
const tp = await p2.evaluate(() => { const r = document.querySelector('.ds-stage').getBoundingClientRect(); return { x: r.left, y: r.top, k: r.width / 960 }; });
await p2.touchscreen.tap(tp.x + 340 * tp.k, tp.y + 224 * tp.k); await p2.waitForTimeout(4000); await p2.screenshot({ path: `${out}/31-touch-play.png` });
const s2 = await p2.evaluate(() => ({ scene: window.shift._debug.scene(), score: window.shift._debug.game()?.score, touchHidden: document.querySelector('.ds-touch').hidden })); console.log('touch', JSON.stringify(s2));
console.log(errs.length ? errs.join('\n') : 'no page errors'); await b.close(); srv.close();
