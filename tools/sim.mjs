// headless run: the autopilot plays every level. usage: node tools/sim.mjs [seeds] [level|all] [god]
import { createGame, step, autopilot, VIEWS } from '../src/game.js';
import { LEVELS, buildLevel } from '../src/levels.js';
const N = +process.argv[2] || 2, which = process.argv[3] || 'all', god = process.argv[4] === 'god';
for (const id of which === 'all' ? Object.keys(LEVELS) : which.split(',')) for (let s = 1; s <= N; s++) {
  const L = LEVELS[id], g = createGame({ seed: s, level: buildLevel(id), start: L.kit ? { up: L.kit } : null }); const deaths = []; let ld = 0;
  if (god) g.players[0].lives = 999;
  let t = 0, bt = 0; for (; t < 60 * 900 && g.state === 'play'; t++) { step(g, [autopilot(g)]); if (g.boss && !bt) bt = t; if (g.stats.deaths > ld) { ld = g.stats.deaths; deaths.push(Math.round(g.camZ) + (g.boss ? 'B' + g.boss.stage : '') + VIEWS[g.view][0] + ':' + g.cause); } }
  const p = g.players[0];
  console.log(`${id.padEnd(8)} seed ${s}: ${g.state.padEnd(5)} t=${(t / 60).toFixed(0)}s boss=${bt ? ((t - bt) / 60).toFixed(0) + 's' : '-'} z=${g.camZ.toFixed(0)} score=${g.score} lives=${p.lives} up=${p.up} sh=${p.shield} kills=${g.stats.kills} shifts=${g.stats.shifts} chain=${g.bestChain} deaths@${deaths.join(',')}`);
}
