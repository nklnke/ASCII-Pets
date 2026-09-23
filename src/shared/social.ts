// Pet-to-pet socials (pair interactions for the 2-pet pack).
// Pure and testable: distances/cooldowns in, decision out. The renderer
// owns positions, cooldown timing and animation; moods live in pet-stats.

import type { PetStats } from "./pet-stats";

export type SocialKind = "play" | "chase" | "squabble" | "sniff" | "dance" | "race";

/** Pixel distance (by pet x) that counts as "met". */
export const SOCIAL_RADIUS = 140;
/** Min silence between socials so pets don't spam messages. */
export const SOCIAL_COOLDOWN_MS = 25_000;
/** Interaction scene length bounds (ms): renderer rolls within. */
export const SOCIAL_MIN_MS = 2000;
export const SOCIAL_MAX_MS = 4000;

function clamp(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Deterministic pick: pass Math.random() from the caller (testable). */
export function pickSocial(r: number): SocialKind {
  if (r < 0.3) return "play";
  if (r < 0.5) return "chase";
  if (r < 0.62) return "squabble";
  if (r < 0.77) return "sniff";
  if (r < 0.89) return "dance";
  return "race";
}

/**
 * Pure gate: close enough + cooldown elapsed -> a social kind, else null.
 * sinceLastMs < 0 (never met) counts as elapsed.
 */
export function shouldSocialize(distPx: number, sinceLastMs: number, r: number): SocialKind | null {
  if (!(distPx >= 0) || distPx > SOCIAL_RADIUS) return null;
  if (!(sinceLastMs < 0 || sinceLastMs >= SOCIAL_COOLDOWN_MS)) return null;
  return pickSocial(r);
}

/** Mood delta for one social event (squabble stings a little). */
export function socialMoodDelta(kind: SocialKind): number {
  switch (kind) {
    case "play":
      return 6;
    case "chase":
      return 4;
    case "squabble":
      return -3;
    case "sniff":
      return 3;
    case "dance":
      return 8;
    case "race":
      return 5;
  }
}

/** Energy delta for one social event (running costs; sniffing is free). */
export function socialEnergyDelta(kind: SocialKind): number {
  switch (kind) {
    case "play":
      return -4;
    case "chase":
      return -8;
    case "squabble":
      return -2;
    case "sniff":
      return 0;
    case "dance":
      return -5;
    case "race":
      return -12;
  }
}

/** Scene length roll: pass Math.random() from the caller (testable). */
export function socialDurationMs(r: number): number {
  const t = Math.min(1, Math.max(0, r));
  return Math.round(SOCIAL_MIN_MS + t * (SOCIAL_MAX_MS - SOCIAL_MIN_MS));
}

/** Apply the mood + energy effect of a social event. */
export function applySocial(s: PetStats, kind: SocialKind, now: number): PetStats {
  return {
    ...s,
    mood: clamp(s.mood + socialMoodDelta(kind)),
    energy: clamp(s.energy + socialEnergyDelta(kind)),
    updatedAt: now,
  };
}
