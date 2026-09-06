/* ============================================================
   Territory Trails 3D — original synthesized audio (spec §24)
   WebAudio SFX + lightweight generative music loop.
   ============================================================ */
(function (global) {
  'use strict';
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let musicOn = false, musicTimer = null, nextBar = 0, barIdx = 0;
  let volMusic = 0.7, volSfx = 0.8;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = volMusic * 0.5; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = volSfx; sfxGain.connect(master);
    } catch (e) { return false; }
    return true;
  }

  function unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); }

  function setVolumes(m, s) {
    volMusic = m; volSfx = s;
    if (musicGain) musicGain.gain.value = m * 0.5;
    if (sfxGain) sfxGain.gain.value = s;
  }

  function tone(freq, dur, type, gain, when, dest) {
    if (!ctx) return;
    const t = (when || ctx.currentTime);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain || 0.2, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, gain) {
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = gain || 0.2;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start();
  }

  const SFX = {
    click()   { tone(660, 0.08, 'triangle', 0.25); tone(880, 0.1, 'triangle', 0.18, ctx && ctx.currentTime + 0.05); },
    coin()    { tone(1180, 0.09, 'square', 0.12); tone(1568, 0.14, 'square', 0.12, ctx && ctx.currentTime + 0.06); },
    trail()   { tone(420, 0.06, 'sine', 0.1); },
    capture() { noise(0.35, 0.25); tone(523, 0.16, 'triangle', 0.22); tone(784, 0.22, 'triangle', 0.2, ctx && ctx.currentTime + 0.09); },
    kill()    { tone(300, 0.1, 'sawtooth', 0.2); tone(200, 0.16, 'sawtooth', 0.2, ctx && ctx.currentTime + 0.07); },
    death()   { noise(0.5, 0.35); tone(220, 0.3, 'sawtooth', 0.25); tone(140, 0.5, 'sawtooth', 0.22, ctx && ctx.currentTime + 0.12); },
    power()   { tone(700, 0.1, 'triangle', 0.2); tone(940, 0.1, 'triangle', 0.2, ctx && ctx.currentTime + 0.08); tone(1250, 0.16, 'triangle', 0.2, ctx && ctx.currentTime + 0.16); },
    newbest() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.22, ctx && ctx.currentTime + i * 0.09)); },
    win()     { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.25, ctx && ctx.currentTime + i * 0.12)); },
    lose()    { [392, 330, 262].forEach((f, i) => tone(f, 0.35, 'triangle', 0.22, ctx && ctx.currentTime + i * 0.16)); },
  };

  // ---- generative music: soft chord arps, 4-bar loop ----
  const CHORDS = [
    [261.63, 329.63, 392.00, 523.25],
    [220.00, 261.63, 329.63, 440.00],
    [174.61, 220.00, 261.63, 349.23],
    [196.00, 246.94, 293.66, 392.00],
  ];

  function scheduleBar(t, chord) {
    const beat = 0.34;
    chord.forEach((f, i) => {
      tone(f, 0.5, 'triangle', 0.10, t + i * beat * 2, musicGain);
      tone(f * 2, 0.3, 'sine', 0.06, t + i * beat * 2 + beat, musicGain);
    });
    tone(chord[0] / 2, 1.4, 'sine', 0.14, t, musicGain);
  }

  function tickMusic() {
    if (!ctx || !musicOn) return;
    while (nextBar < ctx.currentTime + 0.6) {
      scheduleBar(nextBar, CHORDS[barIdx % CHORDS.length]);
      nextBar += 0.34 * 8;
      barIdx++;
    }
  }

  function startMusic() {
    if (!ensure()) return;
    unlock();
    if (musicOn) return;
    musicOn = true;
    nextBar = ctx.currentTime + 0.1;
    musicTimer = setInterval(tickMusic, 250);
  }
  function stopMusic() { musicOn = false; if (musicTimer) clearInterval(musicTimer); musicTimer = null; }

  const AudioSys = { unlock, setVolumes, startMusic, stopMusic, sfx: SFX };
  global.AudioSys = AudioSys;
})(typeof window !== 'undefined' ? window : globalThis);
