// WebAudio synth for pet sounds — no assets, no Node, no DOM except AudioContext.
// Each skin keeps its voice: cat purrs, dog barks, frog croaks.
import { SONG_BEAT_MS, songFor, voiceFor } from "../shared/songs";
// Event SFX (jump/step/clean/startle/...) are synthesized too; all of them
// respect the global mute flag owned by main (tray menu "Звук").

let muted = false;
let ctx: AudioContext | null = null;

/** Throttle keys for high-frequency sounds (steps/snore/growl). */
const lastAt: Record<string, number> = {};

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

/** Per-key cooldown: true = play now, false = too soon, skip. */
function gate(key: string, minMs: number): boolean {
  const now = Date.now();
  if (now - (lastAt[key] ?? -1e12) < minMs) return false;
  lastAt[key] = now;
  return true;
}

function tone(freq: number, durMs: number, type: OscillatorType, delayMs: number, gain = 0.08): void {
  if (muted) return;
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

/** Frequency sweep (whoosh/jump/slide) with the same envelope as tone(). */
function sweep(f0: number, f1: number, durMs: number, type: OscillatorType, delayMs: number, gain = 0.08): void {
  if (muted) return;
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime + delayMs / 1000;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, f0), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + durMs / 1000);
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

/** Shared voice core with a delay offset (lets greet/social layer a jingle first). */
function voice(skinId: string, delayBaseMs: number): void {
  if (skinId === "dog") {
    // *гав*: two sharp barks
    tone(220, 120, "square", delayBaseMs, 0.09);
    tone(180, 140, "square", delayBaseMs + 150, 0.09);
  } else if (skinId === "frog") {
    // *ква*: low croak wobble
    tone(110, 180, "sawtooth", delayBaseMs, 0.11);
    tone(90, 200, "sawtooth", delayBaseMs + 200, 0.11);
  } else {
    // *mur*: soft purr — three low hums
    tone(95, 150, "sine", delayBaseMs, 0.13);
    tone(95, 150, "sine", delayBaseMs + 170, 0.13);
    tone(105, 180, "sine", delayBaseMs + 340, 0.12);
  }
}

/** Play the voice of a skin id (cat|dog|frog, fallback purr). */
export function playPetSound(skinId: string): void {
  if (muted) return;
  voice(skinId, 0);
}

/** Short chomp for feeding (*nom-nom*). */
export function playEatSound(): void {
  if (muted) return;
  tone(300, 80, "triangle", 0, 0.11);
  tone(250, 90, "triangle", 110, 0.11);
  tone(350, 70, "triangle", 220, 0.09);
}

/** The deed: three descending plops. */
export function playPoopSound(): void {
  if (muted) return;
  tone(180, 100, "sine", 0, 0.13);
  tone(140, 110, "sine", 130, 0.13);
  tone(100, 170, "sine", 270, 0.14);
}

/** Jump whoosh: rising sweep, timbre per skin. Called from startJump(). */
export function playJump(skinId: string): void {
  if (muted) return;
  if (skinId === "dog") {
    sweep(200, 430, 150, "square", 0, 0.06);
  } else if (skinId === "frog") {
    sweep(140, 320, 200, "sawtooth", 0, 0.09);
  } else {
    sweep(250, 540, 180, "sine", 0, 0.1);
  }
}

/** Quiet background footstep. Throttled: at most one per ~110ms (shared). */
export function playStep(gait: string, skinId: string): void {
  if (muted) return;
  if (!gate("step", 110)) return;
  const base = gait === "scurry" ? 270 : gait === "amble" ? 160 : 210;
  const skinUp = skinId === "frog" ? 40 : skinId === "dog" ? 20 : 0;
  const type: OscillatorType = skinId === "dog" ? "square" : "triangle";
  // Very quiet on purpose: footsteps sit under voices, never over them.
  tone(base + skinUp, 35, type, 0, type === "square" ? 0.014 : 0.02);
}

/** Cleanup sparkle: rising wipe when the pile is removed. */
export function playClean(): void {
  if (muted) return;
  tone(500, 70, "triangle", 0, 0.1);
  tone(700, 70, "triangle", 80, 0.1);
  tone(950, 90, "triangle", 160, 0.09);
}

/** Frightened yelp (jump whoosh already fired from startJump). */
export function playStartle(skinId: string): void {
  if (muted) return;
  if (skinId === "dog") {
    tone(350, 80, "square", 0, 0.09);
    tone(280, 100, "square", 90, 0.09);
  } else if (skinId === "frog") {
    tone(300, 120, "sawtooth", 0, 0.1);
    tone(200, 130, "sawtooth", 120, 0.1);
  } else {
    tone(700, 90, "square", 0, 0.07);
    tone(500, 110, "square", 100, 0.07);
  }
}

/** Happy hello: bright arpeggio + the pet's own voice. */
export function playGreet(skinId: string): void {
  if (muted) return;
  tone(440, 90, "triangle", 0, 0.09);
  tone(660, 110, "triangle", 100, 0.09);
  voice(skinId, 220);
}

/** Sniffing: two very quiet high ticks. Throttled (~900ms). */
export function playSniff(): void {
  if (muted) return;
  if (!gate("sniff", 900)) return;
  tone(900, 30, "triangle", 0, 0.03);
  tone(1100, 30, "triangle", 90, 0.028);
}

/** Sleeping snore: slow low rumble. Throttled (~2.6s, called every anim tick). */
export function playSnore(): void {
  if (muted) return;
  if (!gate("snore", 2600)) return;
  tone(65, 280, "sine", 0, 0.1);
  tone(55, 320, "sine", 350, 0.09);
}

/** Hungry stomach growl. Throttled (~5.2s, called every anim tick while hungry). */
export function playHungry(): void {
  if (muted) return;
  if (!gate("hungry", 5200)) return;
  tone(75, 350, "sawtooth", 0, 0.08);
  tone(60, 400, "sawtooth", 220, 0.08);
}

/** Soft thud when a dragged pet is dropped. */
export function playDrop(): void {
  if (muted) return;
  tone(160, 90, "sine", 0, 0.1);
  tone(110, 100, "sine", 60, 0.09);
}

/** Fling boing: fast rising sweep + landing thud. */
export function playBoing(): void {
  if (muted) return;
  sweep(150, 650, 220, "sine", 0, 0.1);
  tone(120, 120, "sine", 230, 0.1);
}

/** Annoyed reaction to overpetting: hiss / growl / grumble per skin. */
export function playAnnoyed(skinId: string): void {
  if (muted) return;
  if (skinId === "dog") {
    tone(95, 300, "square", 0, 0.09);
    tone(75, 300, "square", 50, 0.08);
  } else if (skinId === "frog") {
    tone(70, 300, "sawtooth", 0, 0.1);
    tone(55, 250, "sawtooth", 120, 0.09);
  } else {
    // *фшш*: cat hiss — noisy high slide down
    sweep(2500, 1200, 250, "sawtooth", 0, 0.045);
    tone(1800, 150, "square", 30, 0.04);
  }
}

/** Sleepy wake-up: long yawn + the pet's own voice. */
export function playWake(skinId: string): void {
  if (muted) return;
  sweep(150, 420, 400, "sine", 0, 0.1);
  voice(skinId, 420);
}

/** Curious "hmm?": two soft high blips. Throttled (~2.5s). */
export function playCurious(): void {
  if (muted) return;
  if (!gate("curious", 2500)) return;
  tone(700, 60, "triangle", 0, 0.06);
  tone(950, 70, "triangle", 80, 0.06);
}

/** A pet song: the skin's melody in the skin's own voice. */
export function playSong(skinId: string, index: number): void {
  if (muted) return;
  const song = songFor(skinId, index);
  const voice = voiceFor(skinId);
  let t = 0;
  for (const [semi, beats] of song.notes) {
    const freq = 440 * Math.pow(2, semi / 12) * voice.octave;
    const dur = Math.max(60, beats * SONG_BEAT_MS);
    tone(freq, dur, voice.wave, t, voice.gain);
    t += dur + voice.gapMs;
  }
}

/** Pair-interaction jingle (the voice itself is played by the caller). */
export function playSocial(kind: string, skinId: string): void {
  if (muted) return;
  const type: OscillatorType = skinId === "dog" ? "square" : skinId === "frog" ? "sawtooth" : "sine";
  const gain = type === "sine" ? 0.09 : 0.07;
  if (kind === "play") {
    tone(520, 80, type, 0, gain);
    tone(660, 80, type, 90, gain);
    tone(780, 100, type, 180, gain);
  } else if (kind === "chase") {
    tone(500, 60, type, 0, gain);
    tone(600, 60, type, 70, gain);
    tone(700, 60, type, 140, gain);
    tone(850, 90, type, 210, gain);
  } else if (kind === "sniff") {
    // curious nose: two soft high ticks
    tone(880, 40, "triangle", 0, 0.05);
    tone(1040, 40, "triangle", 110, 0.045);
  } else if (kind === "dance") {
    // waltz: oom-pah-pah
    tone(392, 110, type, 0, gain);
    tone(523, 90, type, 120, gain);
    tone(659, 90, type, 220, gain);
    tone(784, 140, type, 320, gain);
  } else if (kind === "race") {
    // starting whistle + go: sharp pip, then rising run
    tone(1200, 90, "square", 0, 0.05);
    tone(500, 60, type, 120, gain);
    tone(650, 60, type, 190, gain);
    tone(800, 90, type, 260, gain);
  } else if (kind === "huddle") {
    // warm chord: everyone piles in at once
    tone(523, 140, type, 0, gain);
    tone(659, 140, type, 20, gain);
    tone(784, 180, type, 40, gain);
  } else if (kind === "parade") {
    // march: oom-pah stride
    tone(392, 90, type, 0, gain);
    tone(523, 90, type, 110, gain);
    tone(392, 90, type, 220, gain);
    tone(659, 130, type, 330, gain);
  } else {
    // squabble: dissonant low clash
    tone(180, 200, "square", 0, 0.07);
    tone(190, 200, "square", 0, 0.07);
    tone(150, 180, "square", 200, 0.06);
  }
}
