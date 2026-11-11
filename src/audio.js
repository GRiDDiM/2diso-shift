// 2DISO SHIFT — all sound is synthesised with Web Audio. No audio files.
export function createAudio(opt) {
  let ac = null, master, sfxG, musG, noiseBuf, timer = 0, step = 0, nextT = 0, mode = null, last = {};
  function init() {
    if (ac) return true; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { ac = new AC(); } catch { return false; }
    master = ac.createDynamicsCompressor(); master.connect(ac.destination);
    sfxG = ac.createGain(); musG = ac.createGain(); sfxG.connect(master); musG.connect(master); vol();
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function vol() { if (!ac) return; sfxG.gain.value = opt.mute ? 0 : opt.sfx * 0.5; musG.gain.value = opt.mute ? 0 : opt.music * 0.6; }
  function tone(type, f0, f1, dur, v, t = ac.currentTime, out = sfxG) { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02); }
  function noise(dur, v, f0, f1, t = ac.currentTime, out = sfxG, q = 1) { const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; fl.type = 'bandpass'; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); s.connect(fl); fl.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.02); }
  const SFX = {
    shot: () => tone('square', 880, 340, 0.06, 0.07), laser: () => tone('sawtooth', 1400, 900, 0.09, 0.05), missile: () => noise(0.25, 0.14, 900, 2600),
    eshot: () => tone('triangle', 300, 150, 0.1, 0.09), boom: () => { noise(0.3, 0.4, 900, 90); tone('sine', 160, 40, 0.25, 0.3); }, boom2: () => { noise(0.7, 0.6, 700, 50); tone('sine', 110, 28, 0.6, 0.5); },
    shift: () => { noise(0.3, 0.25, 300, 5000, undefined, undefined, 3); tone('sine', 220, 880, 0.22, 0.16); }, pod: () => [784, 988, 1175, 1568].forEach((f, i) => tone('square', f, 0, 0.09, 0.09, ac.currentTime + i * 0.045)),
    upgrade: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => { tone('square', f, 0, 0.14, 0.1, ac.currentTime + i * 0.06); tone('triangle', f / 2, 0, 0.2, 0.1, ac.currentTime + i * 0.06); }); tone('square', 1568, 0, 0.4, 0.1, ac.currentTime + 0.32); }, deny: () => tone('square', 140, 110, 0.14, 0.12), blip: () => tone('square', 740, 0, 0.05, 0.08),
    move: () => tone('square', 520, 0, 0.03, 0.06), ok: () => { tone('square', 620, 0, 0.05, 0.09); tone('square', 930, 0, 0.08, 0.09, ac.currentTime + 0.05); }, back: () => tone('square', 400, 260, 0.08, 0.08),
    die: () => { noise(0.9, 0.7, 1200, 40); tone('sawtooth', 400, 30, 0.8, 0.3); }, shield: () => tone('sine', 900, 200, 0.3, 0.25), bomb: () => { noise(1.1, 0.8, 200, 3000); tone('sine', 90, 25, 1, 0.6); },
    ring: () => { tone('sine', 880, 0, 0.1, 0.14); tone('sine', 1320, 0, 0.16, 0.14, ac.currentTime + 0.07); }, warp: () => [0, 1, 2, 3, 4, 5].forEach(i => tone('sine', 300 * Math.pow(1.5, i), 0, 0.5, 0.14, ac.currentTime + i * 0.07)),
    god: () => [0, 1, 2, 3, 4, 5, 6, 7].forEach(i => tone('square', 440 * Math.pow(1.122, i * 2), 0, 0.09, 0.09, ac.currentTime + i * 0.045)), hint: () => { tone('square', 990, 0, 0.07, 0.08); tone('square', 990, 0, 0.07, 0.08, ac.currentTime + 0.12); },
    ting: () => tone('triangle', 2200, 1800, 0.05, 0.06), zap: () => { noise(0.4, 0.35, 3000, 600, undefined, undefined, 4); tone('sawtooth', 90, 60, 0.4, 0.2); }, charge: () => tone('sawtooth', 110, 660, 0.9, 0.09),
    bossin: () => { tone('sawtooth', 55, 50, 1.6, 0.4); tone('sawtooth', 82, 78, 1.6, 0.25); }, over: () => [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, 0, 0.4, 0.2, ac.currentTime + i * 0.28)),
    clear: () => { [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => { tone('square', f, 0, i === 7 ? 0.9 : 0.16, 0.12, ac.currentTime + i * 0.13); tone('triangle', f / 2, 0, i === 7 ? 0.9 : 0.16, 0.14, ac.currentTime + i * 0.13); }); }, whoosh: () => noise(1.3, 0.45, 200, 4000, undefined, undefined, 2), slam: () => { noise(0.5, 0.7, 500, 60); tone('sine', 80, 30, 0.5, 0.6); }
  };
  const MIN = { shot: 60, eshot: 80, boom: 50, laser: 90, ting: 90, pod: 40 };
  function sfx(n) { if (!ac || ac.state !== 'running' || !SFX[n] || opt.sfx <= 0) return; const now = performance.now(); if (MIN[n] && now - (last[n] || 0) < MIN[n]) return; last[n] = now; try { SFX[n](); } catch { } }
  // ---- music: liquid drum and bass in flight, lo-fi on the menus, a darker roller for the boss ----
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  function pad(notes, t, dur, kind) { for (const n of notes) { const f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'lowpass'; f.frequency.value = kind === 'keys' ? 1100 : 1500; g.connect(musG); f.connect(g);
    if (kind === 'keys') { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.085, t + 0.02); g.gain.exponentialRampToValueAtTime(0.02, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur); }
    else { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + dur * 0.25); g.gain.setValueAtTime(0.03, t + dur * 0.75); g.gain.linearRampToValueAtTime(0, t + dur + 0.3); f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1900, t + dur * 0.5); f.frequency.linearRampToValueAtTime(800, t + dur); }
    for (const d of kind === 'keys' ? [0] : [-7, 7]) { const o = ac.createOscillator(); o.type = kind === 'keys' ? 'triangle' : 'sawtooth'; o.frequency.value = hz(n); o.detune.value = d; o.connect(f); o.start(t); o.stop(t + dur + 0.4); } } }
  function sub(n, t, dur, v, type = 'sine') { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(hz(n), t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.012); g.gain.setValueAtTime(v, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur); if (type !== 'sine') { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; o.connect(f); f.connect(g); } else o.connect(g); g.connect(musG); o.start(t); o.stop(t + dur + 0.02); }
  function bell(n, t, dur, v) { tone('sine', hz(n), 0, dur, v, t, musG); tone('triangle', hz(n + 12), 0, dur * 0.5, v * 0.35, t, musG); }
  const kick = (t, v) => { tone('sine', 165, 42, 0.16, v, t, musG); }, snare = (t, v) => { noise(0.14, v, 2400, 900, t, musG, 0.7); tone('triangle', 210, 150, 0.08, v * 0.6, t, musG); }, hat = (t, v) => noise(0.03, v, 9000, 7000, t, musG, 1.5);
  const MODES = {
    play: { spb: 60 / 174 / 4, hold: 2, sw: 0, chords: [[41, [65, 69, 72, 76, 79]], [40, [64, 67, 71, 74]], [38, [62, 65, 69, 72, 76]], [36, [60, 64, 67, 71, 74]]], kick: [0, 10], snare: [4, 12], ghost: [7, 15], bass: [0, , , 0, , , 12, , , , 0, , , 7, , ,], mel: [0, 2, 4, 2, 1, 4, 3, 1], keys: false },
    boss: { spb: 60 / 176 / 4, hold: 2, sw: 0, chords: [[33, [57, 60, 64, 67]], [29, [56, 60, 63, 65]], [31, [55, 58, 62, 65]], [28, [56, 59, 62, 64]]], kick: [0, 6, 10], snare: [4, 12], ghost: [9, 14, 15], bass: [0, 0, , 0, , 12, 0, , 0, , 0, 0, , 10, 12, ,], mel: [0, 1, 0, 3, 2, 0, 1, 3], keys: false, dark: true },
    title: { spb: 60 / 76 / 4, hold: 1, sw: 0.2, chords: [[38, [57, 60, 64, 65]], [31, [53, 57, 59, 64]], [36, [55, 59, 62, 64]], [33, [55, 57, 61, 64]]], kick: [0, 7, 10], snare: [4, 12], ghost: [], bass: [0, , , , , , 0, , , , 7, , , , , ,], mel: [3, 1, 2, 0, 4, 2, 1, 0], keys: true }
  };
  function sched() {
    if (!ac || !mode || ac.state !== 'running') return; const M = MODES[mode], spb = M.spb;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.06;
    while (nextT < ac.currentTime + 0.3) { const i = step & 15, bar = step >> 4, ch = M.chords[(bar / M.hold | 0) % M.chords.length], t = nextT + (i & 1 ? spb * M.sw : 0);
      if (M.keys) { if (i === 0 || i === 6 || (i === 11 && bar % 2)) pad(ch[1], t + (i ? 0.01 : 0), spb * (i === 0 ? 6 : 5), 'keys'); if (Math.random() < 0.35) noise(0.012, 0.05, 5000, 3000, t + Math.random() * spb, musG, 3); }
      else if (i === 0 && bar % M.hold === 0) pad(ch[1], t, spb * 16 * M.hold, 'pad');
      const b = M.bass[i]; if (b != null) sub(ch[0] + b, t, spb * (M.keys ? 5 : 2.6), M.keys ? 0.26 : 0.34, M.dark ? 'sawtooth' : 'sine');
      if (M.kick.includes(i)) kick(t, M.keys ? 0.5 : 0.75); if (M.snare.includes(i)) snare(t, M.keys ? 0.22 : 0.4); if (M.ghost.includes(i)) snare(t, 0.1);
      if (M.keys) { if (i % 2 === 0) hat(t, 0.05); } else { hat(t, i % 2 ? 0.05 : 0.1); if (i === 14 && bar % 4 === 3) for (let k = 0; k < 3; k++) snare(t + k * spb / 3, 0.16); }
      const phrase = bar % 8, mi = M.mel[(bar * 3 + (i >> 1)) % M.mel.length]; if ((M.keys ? (i === 2 || i === 8 || i === 13) && phrase % 2 === 1 : (i % 3 === 0 && phrase >= 2 && phrase !== 5) || (i === 14 && phrase >= 4))) bell(ch[1][mi % ch[1].length] + 12, t, spb * (M.keys ? 6 : 3), M.keys ? 0.07 : 0.055);
      step++; nextT += spb; }
  }
  // ---- announcer ----
  let lastSay = 0, vox = null;
  function say(txt, force) { const sy = window.speechSynthesis; if (!sy || !opt.voice || opt.mute || opt.sfx <= 0) return; const now = performance.now(); if (!force && (sy.speaking || now - lastSay < 900)) return; lastSay = now;
    try { if (force) sy.cancel(); const u = new SpeechSynthesisUtterance(String(txt).toLowerCase()); if (!vox) { const vs = sy.getVoices(); vox = vs.find(v => /Google UK English Male|Microsoft (David|Mark|George)|Daniel/i.test(v.name)) || vs.find(v => /^en/i.test(v.lang)) || null; } if (vox) u.voice = vox; u.pitch = 0.55; u.rate = 1.08; u.volume = Math.min(1, opt.sfx * 1.1); sy.speak(u); } catch { } }
  return { unlock() { if (init() && ac.state === 'suspended') ac.resume().catch(() => { }); }, sfx, vol, say, hush() { try { window.speechSynthesis?.cancel(); } catch { } },
    music(m) { if (m === mode) return; mode = m; step = 0; nextT = 0; clearInterval(timer); if (m) timer = setInterval(sched, 60); },
    suspend() { ac?.suspend?.().catch(() => { }); try { window.speechSynthesis?.cancel(); } catch { } }, resume() { ac?.resume?.().catch(() => { }); }, close() { clearInterval(timer); try { window.speechSynthesis?.cancel(); } catch { } try { ac?.close(); } catch { } ac = null; } };
}
