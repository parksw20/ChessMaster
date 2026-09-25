/* 효과음 — 외부 파일 없이 Web Audio로 직접 합성한다 */
(function (root) {
  'use strict';
  let ctx = null;
  let enabled = true;

  function ac() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noise(duration, { freq = 1200, q = 1, gain = 0.4, type = 'bandpass', delay = 0 } = {}) {
    const a = ac(); if (!a) return;
    const len = Math.floor(a.sampleRate * duration);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = a.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(a.destination);
    src.start(a.currentTime + delay);
  }

  function tone(freq, duration, { type = 'sine', gain = 0.2, delay = 0, to = null } = {}) {
    const a = ac(); if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + duration + 0.05);
  }

  const Sound = {
    setEnabled(v) { enabled = v; },
    get enabled() { return enabled; },
    unlock() { if (enabled) ac(); },
    select() { if (enabled) tone(660, 0.08, { type: 'triangle', gain: 0.08 }); },
    move() {
      if (!enabled) return;
      noise(0.12, { freq: 900, q: 2, gain: 0.5 });
      tone(180, 0.1, { type: 'triangle', gain: 0.15 });
    },
    swoosh() { if (enabled) noise(0.35, { freq: 2500, q: 0.7, gain: 0.25, type: 'highpass' }); },
    clash() {
      if (!enabled) return;
      tone(1400, 0.25, { type: 'square', gain: 0.05, to: 700 });
      noise(0.2, { freq: 3000, q: 3, gain: 0.3 });
    },
    crumble() {
      if (!enabled) return;
      tone(160, 0.5, { type: 'sine', gain: 0.5, to: 35 });
      noise(0.8, { freq: 500, q: 0.6, gain: 0.7, type: 'lowpass' });
      for (let i = 0; i < 5; i++) noise(0.08, { freq: 1500 + Math.random() * 2000, q: 4, gain: 0.2, delay: 0.1 + i * 0.07 });
    },
    check() {
      if (!enabled) return;
      tone(880, 0.18, { type: 'triangle', gain: 0.18 });
      tone(660, 0.3, { type: 'triangle', gain: 0.18, delay: 0.15 });
    },
    star() {
      if (!enabled) return;
      [1047, 1319, 1568].forEach((f, i) => tone(f, 0.18, { type: 'sine', gain: 0.12, delay: i * 0.07 }));
    },
    magic() {
      if (!enabled) return;
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, { type: 'triangle', gain: 0.1, delay: i * 0.06 }));
    },
    win() {
      if (!enabled) return;
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.35, { type: 'triangle', gain: 0.16, delay: i * 0.14 }));
    },
    oops() {
      if (!enabled) return;
      tone(300, 0.25, { type: 'sine', gain: 0.15, to: 200 });
    },
  };

  root.Sound = Sound;
})(window);
