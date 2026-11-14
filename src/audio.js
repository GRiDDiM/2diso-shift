// 2DISO SHIFT — all sound is synthesised with Web Audio. No audio files.
export function createAudio(opt) {
  let ac = null, master, sfxG, musG, sfxV, musV, noiseBuf, timer = 0, step = 0, nextT = 0, mode = null, last = {};
  function init() {
    if (ac) return true; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { ac = new AC(); } catch { return false; }
    // each bus is squeezed by its own compressor first and only then turned up or down, so the volume sliders are not flattened back out by the compressor
    const lim = ac.createDynamicsCompressor(); lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1; lim.connect(ac.destination); // a brick-wall limiter on the very end only catches peaks
    const bus = (pre) => { const g = ac.createGain(), c = ac.createDynamicsCompressor(), v = ac.createGain(); g.gain.value = pre; g.connect(c); c.connect(v); v.connect(lim); return [g, v]; };
    [sfxG, sfxV] = bus(0.4); [musG, musV] = bus(0.42); master = sfxG; vol();
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function vol() { if (!ac) return; const t = ac.currentTime; sfxV.gain.setTargetAtTime(opt.mute ? 0 : opt.sfx * 1.1, t, 0.02); musV.gain.setTargetAtTime(opt.mute ? 0 : opt.music * 1.2, t, 0.02); }
  function tone(type, f0, f1, dur, v, t = ac.currentTime, out = sfxG) { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02); }
  function noise(dur, v, f0, f1, t = ac.currentTime, out = sfxG, q = 1) { const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; fl.type = 'bandpass'; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); s.connect(fl); fl.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.02); }
  const SFX = {
    shot: () => tone('square', 880, 340, 0.06, 0.07), laser: () => tone('sawtooth', 1400, 900, 0.09, 0.05), missile: () => noise(0.25, 0.14, 900, 2600),
    eshot: () => tone('triangle', 300, 150, 0.1, 0.09), boom: () => { noise(0.3, 0.4, 900, 90); tone('sine', 160, 40, 0.25, 0.3); }, boom2: () => { noise(0.7, 0.6, 700, 50); tone('sine', 110, 28, 0.6, 0.5); },
    shift: () => { noise(0.3, 0.25, 300, 5000, undefined, undefined, 3); tone('sine', 220, 880, 0.22, 0.16); }, pod: () => [784, 988, 1175, 1568].forEach((f, i) => tone('square', f, 0, 0.09, 0.09, ac.currentTime + i * 0.045)),
    upgrade: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => { tone('square', f, 0, 0.14, 0.1, ac.currentTime + i * 0.06); tone('triangle', f / 2, 0, 0.2, 0.1, ac.currentTime + i * 0.06); }); tone('square', 1568, 0, 0.4, 0.1, ac.currentTime + 0.32); }, deny: () => tone('square', 140, 110, 0.14, 0.12), blip: () => tone('square', 740, 0, 0.05, 0.08),
    move: () => tone('square', 520, 0, 0.03, 0.06), ok: () => { tone('square', 620, 0, 0.05, 0.09); tone('square', 930, 0, 0.08, 0.09, ac.currentTime + 0.05); }, back: () => tone('square', 400, 260, 0.08, 0.08),
    die: () => { noise(0.9, 0.7, 1200, 40); tone('sawtooth', 400, 30, 0.8, 0.3); }, shield: () => tone('sine', 900, 200, 0.3, 0.25), bomb: () => { noise(1.1, 0.8, 200, 3000); tone('sine', 90, 25, 1, 0.6); }, charge: () => { tone('sawtooth', 60, 900, 0.6, 0.3); tone('sine', 200, 1800, 0.6, 0.2); }, mega: () => { noise(2.4, 0.9, 120, 5000); tone('sine', 70, 18, 2.4, 0.7); tone('sawtooth', 300, 28, 1.6, 0.3); },
    ring: () => { tone('sine', 880, 0, 0.1, 0.14); tone('sine', 1320, 0, 0.16, 0.14, ac.currentTime + 0.07); }, warp: () => [0, 1, 2, 3, 4, 5].forEach(i => tone('sine', 300 * Math.pow(1.5, i), 0, 0.5, 0.14, ac.currentTime + i * 0.07)),
    god: () => [0, 1, 2, 3, 4, 5, 6, 7].forEach(i => tone('square', 440 * Math.pow(1.122, i * 2), 0, 0.09, 0.09, ac.currentTime + i * 0.045)), hint: () => { tone('square', 990, 0, 0.07, 0.08); tone('square', 990, 0, 0.07, 0.08, ac.currentTime + 0.12); },
    wave: () => { tone('sine', 300, 900, 0.18, 0.1); tone('triangle', 450, 1350, 0.18, 0.05); }, bolt: () => { noise(0.25, 0.22, 4000, 900, undefined, undefined, 5); tone('sawtooth', 1800, 200, 0.2, 0.07); }, hyper: () => { tone('sawtooth', 110, 130, 0.22, 0.16); tone('square', 880, 1320, 0.2, 0.05); noise(0.2, 0.12, 2000, 5000); },
    ting: () => tone('triangle', 2200, 1800, 0.05, 0.06), zap: () => { noise(0.4, 0.35, 3000, 600, undefined, undefined, 4); tone('sawtooth', 90, 60, 0.4, 0.2); }, charge: () => tone('sawtooth', 110, 660, 0.9, 0.09),
    bossin: () => { tone('sawtooth', 55, 50, 1.6, 0.4); tone('sawtooth', 82, 78, 1.6, 0.25); }, over: () => [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, 0, 0.4, 0.2, ac.currentTime + i * 0.28)),
    clear: () => { [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => { tone('square', f, 0, i === 7 ? 0.9 : 0.16, 0.12, ac.currentTime + i * 0.13); tone('triangle', f / 2, 0, i === 7 ? 0.9 : 0.16, 0.14, ac.currentTime + i * 0.13); }); }, whoosh: () => noise(1.3, 0.45, 200, 4000, undefined, undefined, 2), buzz: () => { // the GRiDDiM splash: a neon sign humming and crackling as it powers up
      const t = ac.currentTime, d = 1.8, gn = ac.createGain(), fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1400; gn.gain.setValueAtTime(0.0008, t); gn.gain.exponentialRampToValueAtTime(0.11, t + 0.35); gn.gain.setValueAtTime(0.11, t + d - 0.5); gn.gain.exponentialRampToValueAtTime(0.0008, t + d); fl.connect(gn); gn.connect(sfxG);
      for (const [f, ty] of [[60, 'sawtooth'], [120, 'square'], [180.6, 'sawtooth']]) { const o = ac.createOscillator(); o.type = ty; o.frequency.value = f; const og = ac.createGain(); og.gain.value = f === 60 ? 0.6 : 0.25; o.connect(og); og.connect(fl); o.start(t); o.stop(t + d + 0.05); }
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 9; lg.gain.value = 0.035; lfo.connect(lg); lg.connect(gn.gain); lfo.start(t); lfo.stop(t + d); // the flicker
      for (let i = 0; i < 9; i++) noise(0.03 + Math.random() * 0.05, 0.12 + Math.random() * 0.15, 2500 + Math.random() * 3000, 800, t + 0.15 + Math.random() * (d - 0.4), sfxG, 0.8); }, // and sparks
    jingle: () => { // the ArcadeGridz splash: a couple of bars of chiptune
      const t = ac.currentTime, e = 0.16, L = [72, 76, 79, 84, 79, 76, 72, 76, 74, 77, 81, 86, 81, 77, 79, 83], B = [48, , 48, , 55, , 55, , 50, , 50, , 55, , 55, ], f = n => 440 * Math.pow(2, (n - 69) / 12);
      L.forEach((n, i) => tone('square', f(n), 0, e * 0.9, 0.07, t + i * e)); B.forEach((n, i) => { if (n) tone('triangle', f(n), 0, e * 1.8, 0.16, t + i * e); });
      for (let i = 0; i < 16; i++) noise(i % 4 === 0 ? 0.12 : 0.04, i % 4 === 0 ? 0.3 : 0.08, i % 4 === 0 ? 150 : 7000, i % 4 === 0 ? 60 : 9000, t + i * e, sfxG, i % 4 === 0 ? 1 : 3); // kick and hats
      [84, 88, 91, 96].forEach((n, k) => tone('square', f(n), 0, 0.5, 0.05, t + 16 * e + k * 0.01)); tone('triangle', f(48), 0, 0.6, 0.18, t + 16 * e); }, // and the button-press chord to finish
    swoop: () => { // the ship swooping past in the intro: air building to a roar as it comes at you, then a falling doppler as it peels away
      const t = ac.currentTime, mk = (q, f, v, d) => { const sr = ac.createBufferSource(), fl = ac.createBiquadFilter(), gn = ac.createGain(); sr.buffer = noiseBuf; sr.loop = true; fl.type = 'bandpass'; fl.Q.value = q;
        fl.frequency.setValueAtTime(f[0], t); fl.frequency.exponentialRampToValueAtTime(f[1], t + 2.4); fl.frequency.exponentialRampToValueAtTime(f[2], t + d);
        gn.gain.setValueAtTime(0.0008, t); gn.gain.exponentialRampToValueAtTime(v, t + 2.4); gn.gain.exponentialRampToValueAtTime(0.0008, t + d); sr.connect(fl); fl.connect(gn); gn.connect(sfxG); sr.start(t); sr.stop(t + d + 0.05); };
      mk(1.4, [180, 2600, 300], 0.55, 3.9); mk(5, [400, 5200, 900], 0.22, 3.6);
      const o = ac.createOscillator(), og = ac.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(190, t + 2.4); o.frequency.exponentialRampToValueAtTime(48, t + 3.8);
      og.gain.setValueAtTime(0.0008, t); og.gain.exponentialRampToValueAtTime(0.09, t + 2.4); og.gain.exponentialRampToValueAtTime(0.0008, t + 3.8); o.connect(og); og.connect(sfxG); o.start(t); o.stop(t + 3.9); }, slam: () => { noise(0.5, 0.7, 500, 60); tone('sine', 80, 30, 0.5, 0.6); },
    perfect: () => { [659, 988, 1319, 1976].forEach((f, i) => { tone('square', f, 0, 0.12, 0.1, ac.currentTime + i * 0.04); tone('sine', f * 2, 0, 0.3, 0.06, ac.currentTime + i * 0.04); }); noise(0.5, 0.3, 6000, 400, undefined, undefined, 2); tone('sine', 70, 35, 0.5, 0.5); },
    wshift: () => { tone('triangle', 660, 1320, 0.14, 0.1); tone('triangle', 990, 1980, 0.14, 0.06, ac.currentTime + 0.08); },
    vox: () => { tone('square', 1500, 0, 0.03, 0.05); tone('square', 1900, 0, 0.04, 0.05, ac.currentTime + 0.05); noise(0.08, 0.05, 3000, 2500, ac.currentTime + 0.02, undefined, 6); }
  };
  const MIN = { shot: 70, eshot: 80, boom: 50, laser: 110, ting: 90, pod: 40, zap: 90, wave: 120, bolt: 120, hyper: 180, missile: 150 };
  function sfx(n) { if (!ac || ac.state !== 'running' || !SFX[n] || opt.sfx <= 0) return; const now = performance.now(); if (MIN[n] && now - (last[n] || 0) < MIN[n]) return; last[n] = now; try { SFX[n](); } catch { } }
  // ---- music: liquid drum and bass in flight, lo-fi on the menus, a darker roller for the boss ----
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  function pad(notes, t, dur, kind, det) { for (const n of notes) { const f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'lowpass'; f.frequency.value = kind === 'keys' ? 1100 : 1500; g.connect(musG); f.connect(g);
    if (kind === 'keys') { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.085, t + 0.02); g.gain.exponentialRampToValueAtTime(0.02, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur); }
    else { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + dur * 0.25); g.gain.setValueAtTime(0.03, t + dur * 0.75); g.gain.linearRampToValueAtTime(0, t + dur + 0.3); f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1900, t + dur * 0.5); f.frequency.linearRampToValueAtTime(800, t + dur); }
    for (const d of kind === 'keys' ? [0] : [-(det || 7), det || 7]) { const o = ac.createOscillator(); o.type = kind === 'keys' ? 'triangle' : 'sawtooth'; o.frequency.value = hz(n); o.detune.value = d; o.connect(f); o.start(t); o.stop(t + dur + 0.4); } } }
  function sub(n, t, dur, v, type = 'sine') { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(hz(n), t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.012); g.gain.setValueAtTime(v, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur); if (type !== 'sine') { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; o.connect(f); f.connect(g); } else o.connect(g); g.connect(musG); o.start(t); o.stop(t + dur + 0.02); }
  function bell(n, t, dur, v) { tone('sine', hz(n), 0, dur, v, t, musG); tone('triangle', hz(n + 12), 0, dur * 0.5, v * 0.35, t, musG); }
  const kick = (t, v) => { tone('sine', 165, 42, 0.16, v, t, musG); }, snare = (t, v) => { noise(0.14, v, 2400, 900, t, musG, 0.7); tone('triangle', 210, 150, 0.08, v * 0.6, t, musG); }, hat = (t, v) => noise(0.03, v, 9000, 7000, t, musG, 1.5);
  const MODES = {
    play: { spb: 60 / 174 / 4, hold: 2, sw: 0, chords: [[41, [65, 69, 72, 76, 79]], [40, [64, 67, 71, 74]], [38, [62, 65, 69, 72, 76]], [36, [60, 64, 67, 71, 74]]], kick: [0, 10], snare: [4, 12], ghost: [7, 15], bass: [0, , , 0, , , 12, , , , 0, , , 7, , ,], mel: [0, 2, 4, 2, 1, 4, 3, 1], keys: false },
    boss: { spb: 60 / 176 / 4, hold: 2, sw: 0, chords: [[33, [57, 60, 64, 67]], [29, [56, 60, 63, 65]], [31, [55, 58, 62, 65]], [28, [56, 59, 62, 64]]], kick: [0, 6, 10], snare: [4, 12], ghost: [9, 14, 15], bass: [0, 0, , 0, , 12, 0, , 0, , 0, 0, , 10, 12, ,], mel: [0, 1, 0, 3, 2, 0, 1, 3], keys: false, dark: true },
    // one signature track per planet
    mars: { spb: 60 / 150 / 4, hold: 2, sw: 0, chords: [[38, [57, 62, 63, 69]], [39, [58, 63, 67, 70]], [38, [57, 62, 65, 69]], [36, [55, 60, 63, 67]]], kick: [0, 3, 6, 10], snare: [8], ghost: [13, 15], tom: [11, 12, 14], bass: [0, , 0, , , 0, , , 1, , 0, , , , 0, 0], mel: [0, 1, 0, 2, 3, 1, 0, 2], keys: false, dark: true },
    jupiter: { spb: 60 / 180 / 4, hold: 1, sw: 0, chords: [[33, [57, 60, 64, 67, 71]], [29, [57, 60, 65, 67, 72]], [36, [55, 60, 64, 67, 74]], [31, [55, 59, 62, 66, 71]]], kick: [0, 10], snare: [4, 12], ghost: [6, 15], arp: 1, bass: [0, , , , , , 0, , , , 12, , , , , ,], mel: [4, 2, 3, 1, 4, 0, 2, 3], keys: false },
    x: { spb: 60 / 164 / 4, hold: 2, sw: 0.12, chords: [[30, [54, 58, 60, 64, 68]], [32, [56, 60, 62, 66, 70]], [28, [52, 56, 58, 62, 66]], [34, [58, 62, 64, 68, 72]]], kick: [0, 7, 10], snare: [4, 13], ghost: [2, 9, 15], arp: 2, det: 26, bass: [0, , , 6, , , 0, , 2, , , 6, , , 4, ,], mel: [0, 3, 1, 4, 2, 0, 4, 1], keys: false, dark: true },
    arena: { spb: 60 / 140 / 4, hold: 1, sw: 0, chords: [[33, [57, 60, 64, 69]], [33, [57, 60, 64, 67]], [29, [57, 60, 65, 69]], [31, [55, 59, 62, 67]]], kick: [0, 4, 8, 12], snare: [4, 12], ghost: [], arp: 1, bass: [, , 0, , , , 0, , , , 0, , , , 0, 12], mel: [0, 2, 1, 3, 0, 3, 2, 1], keys: false },
    bonus: { spb: 60 / 168 / 4, hold: 2, sw: 0, chords: [[36, [60, 64, 67, 71, 74]], [41, [60, 65, 69, 72, 76]], [33, [60, 64, 67, 69, 72]], [43, [59, 62, 67, 71, 74]]], kick: [0, 10], snare: [4, 12], ghost: [7], arp: 1, bass: [0, , , 0, , , 7, , , , 0, , , 12, , ,], mel: [2, 4, 3, 1, 0, 2, 4, 3], keys: false },
    title: { spb: 60 / 76 / 4, hold: 1, sw: 0.2, chords: [[38, [57, 60, 64, 65]], [31, [53, 57, 59, 64]], [36, [55, 59, 62, 64]], [33, [55, 57, 61, 64]]], kick: [0, 7, 10], snare: [4, 12], ghost: [], bass: [0, , , , , , 0, , , , 7, , , , , ,], mel: [3, 1, 2, 0, 4, 2, 1, 0], keys: true }
  };
  function sched() {
    if (!ac || !mode || ac.state !== 'running') return; const M = MODES[mode], spb = M.spb;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.06;
    while (nextT < ac.currentTime + 0.3) { const i = step & 15, bar = step >> 4, ch = M.chords[(bar / M.hold | 0) % M.chords.length], t = nextT + (i & 1 ? spb * M.sw : 0);
      if (M.keys) { if (i === 0 || i === 6 || (i === 11 && bar % 2)) pad(ch[1], t + (i ? 0.01 : 0), spb * (i === 0 ? 6 : 5), 'keys'); if (Math.random() < 0.35) noise(0.012, 0.05, 5000, 3000, t + Math.random() * spb, musG, 3); }
      else if (i === 0 && bar % M.hold === 0) pad(ch[1], t, spb * 16 * M.hold, 'pad', M.det);
      if (M.arp && (M.arp === 1 || i % 2 === 0 || i === 7)) { const k = M.arp === 1 ? [0, 1, 2, 3, 2, 1][i % 6] : [0, 3, 1, 4, 2][(i + bar) % 5]; tone('square', hz(ch[1][k % ch[1].length] + 12), 0, spb * 1.6, 0.022, t, musG); }
      if (M.tom?.includes(i)) tone('sine', 150 - (i - 11) * 18, 60, 0.18, 0.4, t, musG);
      const b = M.bass[i]; if (b != null) sub(ch[0] + b, t, spb * (M.keys ? 5 : 2.6), M.keys ? 0.26 : 0.34, M.dark ? 'sawtooth' : 'sine');
      if (M.kick.includes(i)) kick(t, M.keys ? 0.5 : 0.75); if (M.snare.includes(i)) snare(t, M.keys ? 0.22 : 0.4); if (M.ghost.includes(i)) snare(t, 0.1);
      if (M.keys) { if (i % 2 === 0) hat(t, 0.05); } else { hat(t, i % 2 ? 0.05 : 0.1); if (i === 14 && bar % 4 === 3) for (let k = 0; k < 3; k++) snare(t + k * spb / 3, 0.16); }
      const phrase = bar % 8, mi = M.mel[(bar * 3 + (i >> 1)) % M.mel.length]; if ((M.keys ? (i === 2 || i === 8 || i === 13) && phrase % 2 === 1 : (i % 3 === 0 && phrase >= 2 && phrase !== 5) || (i === 14 && phrase >= 4))) bell(ch[1][mi % ch[1].length] + 12, t, spb * (M.keys ? 6 : 3), M.keys ? 0.07 : 0.055);
      step++; nextT += spb; }
  }
  // ---- announcer ----
  let lastSay = 0, vox = null, voxM = null, talkEnd = 0, talking = false, talkT = 0; // when the current line should be over, by estimate and by the voice's own events
  // voices: a female voice for the announcer, a male one for the SHIFT on the title. The browser fills its voice list late, so look again when it does
  const pickVoices = () => { const vs = window.speechSynthesis?.getVoices?.() || []; if (!vs.length) return false;
    vox = vs.find(v => /Microsoft (Aria|Jenny|Sonia|Libby|Emma|Ava|Michelle|Natasha) Online/i.test(v.name)) || vs.find(v => /Google UK English Female|Samantha|Serena|Moira|Karen|Tessa|Ava|Allison|Susan|Hazel|Zira/i.test(v.name)) || vs.find(v => /^en/i.test(v.lang) && /female|woman/i.test(v.name)) || vs.find(v => /Google US English/i.test(v.name)) || vs.find(v => /^en/i.test(v.lang)) || null;
    voxM = vs.find(v => /Microsoft (Guy|Davis|Andrew|Christopher|Eric|Brian|Ryan|Roger|Steffan) Online/i.test(v.name)) || vs.find(v => /Google UK English Male|Daniel|Alex\b|Fred|Rishi|Aaron|Arthur|Oliver|David|Mark|George|James/i.test(v.name)) || vs.find(v => /^en/i.test(v.lang) && /\bmale\b|\bman\b/i.test(v.name)) || vox; return true; };
  try { if (!pickVoices()) window.speechSynthesis?.addEventListener?.('voiceschanged', pickVoices, { once: true }); } catch { }
  // say words the way the game means them: ISO is a word (eye-so), not three letters; 2DISO is 'two diso'
  const speakable = t => String(t).toLowerCase().replace(/\b2d ?iso\b/g, 'two dye-so').replace(/\biso\b/g, 'eye-so');
  function say(txt, force, male) { let slow = false; if (String(txt).includes('|')) { txt = String(txt).split('|').map(q => q.trim()).filter(Boolean).join('. ... '); slow = true; } // 'a | b': one utterance with a real pause between the parts (two utterances back to back lose the first one in some browsers)
    const sy = window.speechSynthesis; if (!sy || !opt.voice || opt.mute || opt.sfx <= 0) return; const now = performance.now(); if (!force && (sy.speaking || now - lastSay < 900)) return; lastSay = now;
    try { const wasBusy = sy.speaking || sy.pending; if (force) sy.cancel(); sfx('vox'); const u = new SpeechSynthesisUtterance(speakable(txt)); if (!vox) pickVoices(); const vv = male ? voxM || vox : vox; if (vv) u.voice = vv; u.pitch = male ? 0.85 : 0.92; u.rate = male ? 1.02 : /!$/.test(txt) ? 0.98 : 0.86; /* RIVET-9 (female) talks you through the level; the male announcer calls out pickups, combos and the like */ /* a calm, close, low female voice: unhurried, never shouted */ u.volume = Math.min(1, opt.sfx * 1.1); if (slow) u.rate = 0.8; const est = String(txt).length * 78 / u.rate + 400; talkEnd = performance.now() + est + (force && wasBusy ? 60 : 0); talking = true; talkT = performance.now(); u.onend = u.onerror = () => { talking = false; talkEnd = Math.min(talkEnd, performance.now() + 150); }; if (force && wasBusy) setTimeout(() => sy.speak(u), 60); else sy.speak(u); /* speaking straight after cancel() is dropped in Chrome */ } catch { } }
  // the title line: "2diso" then a stuttering SHIFT that echoes away. The browser voice cannot be run through a real delay, so the echo is
  // the voice itself repeated, softer and quicker each time, with a quiet electronic ping under each repeat
  function titleSay() { const sy = window.speechSynthesis; if (!sy || !opt.voice || opt.mute || opt.sfx <= 0) return;
    const go = () => { try { sy.cancel(); pickVoices(); const v = Math.min(1, opt.sfx * 1.1);
      const U = (w, voice, k, r, p) => { const u = new SpeechSynthesisUtterance(w); if (voice) u.voice = voice; u.volume = v * k; u.rate = r; u.pitch = p; return u; };
      const first = U('two dye-so', vox, 1, 0.86, 0.95); /* her */
      const P = [['SHIFT!', 1, 1.05, 0.85], ['shift', 0.5, 1.35, 0.8], ['shift', 0.26, 1.5, 0.75], ['shift', 0.12, 1.65, 0.7]].map(([w, k, r, p], i) => { const u = U(w, voxM, k, r, p); /* him, echoing away */
        if (i) u.onstart = () => { try { if (ac && ac.state === 'running') tone('sine', 1320 - i * 220, 660 - i * 110, 0.35, 0.1 * k); } catch { } }; return u; });
      setTimeout(() => { sy.speak(first); P.forEach(u => sy.speak(u)); }, 90); } catch { } };
    if (!vox && !pickVoices()) { let done = false; const once = () => { if (!done) { done = true; go(); } }; try { sy.addEventListener('voiceschanged', once, { once: true }); } catch { } setTimeout(once, 900); } else go(); }
  const sayM = (txt, force) => say(txt, force, true);
  return { sayM, speaking: () => { if (!opt.voice || opt.mute || opt.sfx <= 0) return false; const now = performance.now(); let sp = false; try { sp = !!window.speechSynthesis?.speaking; } catch { } return now < talkEnd || (talking && sp && now - talkT < 20000); }, /* some voices report speaking wrongly, so a length-based estimate backs it up */ titleSay, unlock() { if (init() && ac.state === 'suspended') ac.resume().catch(() => { }); }, sfx, vol, say, hush() { try { window.speechSynthesis?.cancel(); } catch { } },
    music(m) { if (m === mode) return; mode = m; step = 0; nextT = 0; clearInterval(timer); if (m) timer = setInterval(sched, 60); },
    suspend() { ac?.suspend?.().catch(() => { }); try { window.speechSynthesis?.cancel(); } catch { } }, resume() { ac?.resume?.().catch(() => { }); }, close() { clearInterval(timer); try { window.speechSynthesis?.cancel(); } catch { } try { ac?.close(); } catch { } ac = null; } };
}
