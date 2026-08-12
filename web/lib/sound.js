/** WebAudio helpers (client only): LoRa downlink beeps + CPR metronome. */

let ctx = null;

function ensureCtx() {
  if (typeof window === 'undefined') return null;
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function beep({ freq = 880, duration = 0.15, volume = 0.35, when = 0 } = {}) {
  const audio = ensureCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(audio.destination);
  const t = audio.currentTime + when;
  osc.start(t);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.stop(t + duration + 0.05);
}

/** The LoRa downlink distress pattern — three rising beeps. */
export function sosBeep() {
  beep({ freq: 660, when: 0 });
  beep({ freq: 880, when: 0.2 });
  beep({ freq: 1100, when: 0.4, duration: 0.3 });
}

let metronomeTimer = null;

export function startMetronome(bpm = 110) {
  stopMetronome();
  const intervalMs = 60000 / bpm;
  beep({ freq: 660, duration: 0.06 });
  metronomeTimer = setInterval(() => beep({ freq: 660, duration: 0.06 }), intervalMs);
}

export function stopMetronome() {
  if (metronomeTimer) clearInterval(metronomeTimer);
  metronomeTimer = null;
}

export function isMetronomeRunning() {
  return metronomeTimer !== null;
}
