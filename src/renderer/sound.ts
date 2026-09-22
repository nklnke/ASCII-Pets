// WebAudio synth for pet sounds — no assets, no Node, no DOM except AudioContext.
// Each skin keeps its voice: cat purrs, dog barks, frog croaks.

let muted = false;
let ctx: AudioContext | null = null;

export function setMuted(m: boolean): void {
  muted = m;
}

export function isMuted(): boolean {
  return muted;
}

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, durMs: number, type: OscillatorType, delayMs: number, gain = 0.08): void {
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime + delayMs / 1000;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + durMs / 1000 + 0.05);
  } catch {
    // Audio unavailable — pet stays silent.
  }
}

/** Play the voice of a skin id (cat|dog|frog, fallback purr). */
export function playPetSound(skinId: string): void {
  if (muted) return;
  if (skinId === "dog") {
    // *гав*: two sharp barks
    tone(220, 120, "square", 0, 0.05);
    tone(180, 140, "square", 150, 0.05);
  } else if (skinId === "frog") {
    // *ква*: low croak wobble
    tone(110, 180, "sawtooth", 0, 0.07);
    tone(90, 200, "sawtooth", 200, 0.07);
  } else {
    // *mur*: soft purr — three low hums
    tone(95, 150, "sine", 0, 0.09);
    tone(95, 150, "sine", 170, 0.09);
    tone(105, 180, "sine", 340, 0.08);
  }
}

/** Short chomp for feeding (*nom-nom*). */
export function playEatSound(): void {
  if (muted) return;
  tone(300, 80, "triangle", 0, 0.07);
  tone(250, 90, "triangle", 110, 0.07);
}

/** The deed: three descending plops. */
export function playPoopSound(): void {
  if (muted) return;
  tone(180, 100, "sine", 0, 0.09);
  tone(140, 110, "sine", 130, 0.09);
  tone(100, 170, "sine", 270, 0.1);
}
