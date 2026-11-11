// headless run: the autopilot plays the level. usage: node tools/sim.mjs [seeds] [god]
import { createGame, step, autopilot, VIEWS } from '../src/game.js';
import { buildEarth } from '../src/level_earth.js';
const N = +process.argv[2] || 3, god = process.argv[3] === 'god';
for (let s = 1; s <= N; s++) {
  const g = createGame({ seed: s, level: buildEarth() }); const deaths = []; let ld = 0;
  if (god) g.players[0].lives = 999;
  let t = 0; for (; t < 60 * 600 && g.state === 'play'; t++) { step(g, [autopilot(g)]); if (g.stats.deaths > ld) { ld = g.stats.deaths; deaths.push(Math.round(g.camZ) + (g.boss ? 'B' + g.boss.stage : '') + VIEWS[g.view][0] + ':' + g.cause + '@y' + g.players[0].y.toFixed(1) + 'x' + g.players[0].x.toFixed(1)); } }
  const p = g.players[0];
  console.log(`seed ${s}: ${g.state} t=${(t / 60).toFixed(0)}s z=${g.camZ.toFixed(0)} score=${g.score} lives=${p.lives} up=${p.up} sh=${p.shield} warp=${g.flags.warp} kills=${g.stats.kills} shifts=${g.stats.shifts} chain=${g.bestChain} deaths@${deaths.join(',')}`);
}
