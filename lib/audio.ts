/**
 * Procedural Web Audio Sound Engine
 * Generates realistic dice sounds and critical fanfare directly via Web Audio API
 * without external audio assets or MP3 files.
 * SSR-safe: safe to import and execute in Node/SSR environments.
 */

let muted = false;
let customAudioContext: AudioContext | null = null;

/**
 * Returns whether the audio engine is currently muted.
 */
export function isMuted(): boolean {
  return muted;
}

/**
 * Sets the mute state of the audio engine.
 */
export function setMuted(value: boolean): void {
  muted = value;
}

/**
 * Toggles the mute state and returns the new state.
 */
export function toggleMute(): boolean {
  muted = !muted;
  return muted;
}

/**
 * Sets or overrides the AudioContext instance (useful for testing and dependency injection).
 */
export function setAudioContext(context: AudioContext | null): void {
  customAudioContext = context;
}

/**
 * Returns the current active AudioContext, initializing it if running in a browser environment.
 * Returns null in SSR / Node.js environments.
 */
export function getAudioContext(): AudioContext | null {
  if (customAudioContext) {
    return customAudioContext;
  }

  if (typeof window !== "undefined") {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (AudioContextClass) {
      customAudioContext = new AudioContextClass();
      return customAudioContext;
    }
  }

  return null;
}

/**
 * Internal helper to retrieve the AudioContext if unmuted and ensure it is resumed.
 */
function getReadyContext(): AudioContext | null {
  if (muted) {
    return null;
  }

  const ctx = getAudioContext();
  if (!ctx) {
    return null;
  }

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {
      // AudioContext resume might be rejected if user interaction policy applies
    });
  }

  return ctx;
}

/**
 * Plays a procedural rattling sound simulating dice shaking in a cup or hand.
 */
export function playDiceShakeSound(): void {
  const ctx = getReadyContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const duration = 0.22;
  const sampleRate = ctx.sampleRate || 44100;
  const bufferLength = Math.floor(sampleRate * duration);

  const buffer = ctx.createBuffer(1, bufferLength, sampleRate);
  const data = buffer.getChannelData(0);

  // Generate white noise with subtle amplitude modulation
  for (let i = 0; i < bufferLength; i++) {
    const t = i / sampleRate;
    const rattleMod = Math.sin(t * 120) * 0.4 + 0.6;
    data[i] = (Math.random() * 2 - 1) * rattleMod;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1800, now);
  filter.Q.setValueAtTime(2.0, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.35, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  source.start(now);
  source.stop(now + duration);
}

/**
 * Plays a procedural clattering table collision sound for dice landing.
 */
export function playDiceHitSound(): void {
  const ctx = getReadyContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const duration = 0.16;
  const sampleRate = ctx.sampleRate || 44100;
  const bufferLength = Math.floor(sampleRate * duration);

  const buffer = ctx.createBuffer(1, bufferLength, sampleRate);
  const data = buffer.getChannelData(0);

  // Sharp initial clatter with decay
  for (let i = 0; i < bufferLength; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2800, now);
  filter.frequency.exponentialRampToValueAtTime(400, now + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  source.start(now);
  source.stop(now + duration);
}

/**
 * Plays an ascending triumph fanfare chime for a Natural 20 critical hit.
 */
export function playCritHitSound(): void {
  const ctx = getReadyContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
  const notes = [523.25, 659.25, 783.99, 1046.50];
  const noteStagger = 0.08;
  const noteDuration = 0.45;

  notes.forEach((freq, idx) => {
    const startTime = now + idx * noteStagger;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + noteDuration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + noteDuration);
  });
}

/**
 * Plays a low impact descending thud sound for a Natural 1 critical failure.
 */
export function playCritFailSound(): void {
  const ctx = getReadyContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const duration = 0.35;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(45, now + duration);

  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration);
}
