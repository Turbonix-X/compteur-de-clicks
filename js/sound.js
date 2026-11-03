// ===== Sons (générés en direct, aucun fichier audio) et vibrations =====

const Sound = (() => {
  let ctx = null;
  let noise = null;
  let enabled = true;

  function audio() {
    if (!enabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function noiseBuffer(c) {
    if (!noise) {
      noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return noise;
  }

  function envelope(c, peak, attack, decay, when = 0) {
    const g = c.createGain();
    const t = c.currentTime + when;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(c.destination);
    return g;
  }

  // Petit « clac » de la flèche qui passe sur un picot
  function tick(strength = 1) {
    const c = audio();
    if (!c) return;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2600 + Math.random() * 600;
    bp.Q.value = 6;
    src.connect(bp).connect(envelope(c, 0.35 * strength, 0.001, 0.035));
    src.start(c.currentTime, Math.random() * 0.5, 0.05);

    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(1300, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.03);
    o.connect(envelope(c, 0.06 * strength, 0.001, 0.03));
    o.start();
    o.stop(c.currentTime + 0.05);
  }

  // Souffle au lancement de la roue
  function whoosh(duration = 1) {
    const c = audio();
    if (!c) return;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = "bandpass";
    lp.Q.value = 1.2;
    const t = c.currentTime;
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(1800, t + duration * 0.35);
    lp.frequency.exponentialRampToValueAtTime(400, t + duration * 0.85);
    src.connect(lp).connect(envelope(c, 0.09, duration * 0.25, duration * 0.6));
    src.start();
    src.stop(t + duration);
  }

  // Petite mélodie quand le résultat apparaît
  function chime() {
    const c = audio();
    if (!c) return;
    [1046.5, 1318.5, 1568].forEach((f, k) => {
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      o.connect(envelope(c, 0.12, 0.01, 0.45, k * 0.07));
      o.start(c.currentTime + k * 0.07);
      o.stop(c.currentTime + k * 0.07 + 0.6);
    });
  }

  // Fanfare pour une case très rare
  function fanfare() {
    const c = audio();
    if (!c) return;
    const notes = [523.3, 659.3, 784, 1046.5, 784, 1046.5, 1318.5];
    const times = [0, 0.1, 0.2, 0.32, 0.5, 0.6, 0.72];
    notes.forEach((f, k) => {
      ["triangle", "square"].forEach((type, j) => {
        const o = c.createOscillator();
        o.type = type;
        o.frequency.value = f * (j ? 0.5 : 1);
        const last = k === notes.length - 1;
        o.connect(envelope(c, j ? 0.03 : 0.13, 0.01, last ? 1.1 : 0.22, times[k]));
        o.start(c.currentTime + times[k]);
        o.stop(c.currentTime + times[k] + (last ? 1.3 : 0.3));
      });
    });
  }

  function click() {
    const c = audio();
    if (!c) return;
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(900, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(500, c.currentTime + 0.05);
    o.connect(envelope(c, 0.08, 0.002, 0.05));
    o.start();
    o.stop(c.currentTime + 0.08);
  }

  // Bip du compte à rebours (plus aigu pour « Go ! »)
  function beep(freq = 660, duration = 0.12) {
    const c = audio();
    if (!c) return;
    const o = c.createOscillator();
    o.type = "square";
    o.frequency.value = freq;
    o.connect(envelope(c, 0.06, 0.005, duration));
    o.start();
    o.stop(c.currentTime + duration + 0.05);
  }

  return {
    tick, whoosh, chime, click, fanfare, beep,
    get enabled() { return enabled; },
    set enabled(v) { enabled = v; },
  };
})();

const Haptics = (() => {
  let enabled = true;
  return {
    buzz(pattern) {
      if (enabled && navigator.vibrate) {
        try { navigator.vibrate(pattern); } catch (e) { /* non supporté */ }
      }
    },
    get enabled() { return enabled; },
    set enabled(v) { enabled = v; },
  };
})();
