// Thin adapter so the same game runs inside arcadegridz.com (site, Potato Mode and the Windows app).
// Nothing in the game depends on this file; the jam build uses index.html.
import { mountShift } from './ui.js';
const ID = '2diso-shift';
const CSS = `body.ds-playing .workspace{padding:0;overflow:hidden}.ds-shell.ds-fixed{position:fixed!important;inset:0;z-index:2147483000;width:auto!important;height:auto!important}body.ds-touch{overflow:hidden;overscroll-behavior:none}`;
export function mountTwoDisoShift(root, { onExit } = {}) {
  if (!document.getElementById('ds-host-css')) { const st = document.createElement('style'); st.id = 'ds-host-css'; st.textContent = CSS; document.head.appendChild(st); }
  const token = () => { try { return localStorage.getItem('griddim_network_token') || ''; } catch { return ''; } };
  let gone = false, timer = 0;
  const inst = mountShift(root, { hosted: true, onExit: () => onExit?.(),
    leaderboard: () => window.ArcadeGridzBridge?.leaderboard ? window.ArcadeGridzBridge.leaderboard(ID) : fetch('/api/leaderboards', { cache: 'no-store' }).then(r => r.json()).then(d => d?.games?.[ID] || []),
    submitScore(r) { const t = token(); if (!t || !(r.score > 0)) return; fetch(`/api/catalog/${ID}/score`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: JSON.stringify({ score: r.score, tags: r.assisted ? ['assisted'] : [] }) }).catch(() => { }); } });
  const shell = root.querySelector('.ds-shell'), home = document.createComment('ds-shell'), html = document.documentElement;
  const potato = () => html.classList.contains('agbm-on') || html.classList.contains('ag-winapp'), touch = () => !!window.matchMedia?.('(pointer: coarse) and (hover: none)').matches;
  function sync() { if (gone) return; const t = touch(); document.body.classList.toggle('ds-touch', t);
    if (t && shell.parentElement !== document.body) { shell.before(home); document.body.appendChild(shell); } else if (!t && home.parentNode) home.replaceWith(shell);
    const fixed = t || (potato() && root.clientHeight < 120); shell.classList.toggle('ds-fixed', fixed);
    if (fixed) shell.style.height = ''; else if (potato()) shell.style.height = '100%'; else { const r = root.getBoundingClientRect(); shell.style.height = Math.max(200, Math.min(r.width * 9 / 16, innerHeight - Math.max(0, r.top) - 8)) + 'px'; } }
  document.body.classList.add('ds-playing'); const ro = new ResizeObserver(sync); ro.observe(root); addEventListener('resize', sync); sync();
  const publish = () => window.dispatchEvent(new CustomEvent('2disoshift:state', { detail: { active: true, ...inst.getState(), controls: ['pause', 'idle', 'sound', 'restart', 'help', 'exit'] } }));
  timer = setInterval(publish, 250); publish();
  function destroy() { if (gone) return; gone = true; clearInterval(timer); ro.disconnect(); removeEventListener('resize', sync); inst.destroy(); if (shell.parentElement === document.body) shell.remove(); if (home.parentNode) home.remove(); document.body.classList.remove('ds-playing', 'ds-touch'); window.dispatchEvent(new CustomEvent('2disoshift:state', { detail: { active: false } })); }
  return { ...inst, destroy, controls: ['pause', 'idle', 'sound', 'restart', 'help', 'exit'] };
}
