// Pet-to-pet socials (pair interactions for the 2-pet pack).
// Pure and testable: distances/cooldowns in, decision out. The renderer
// owns positions, cooldown timing and animation; moods live in pet-stats.

import type { PetStats } from "./pet-stats";

export type SocialKind = "play" | "chase" | "squabble";

/** Pixel distance (by pet x) that counts as "met". */
export const SOCIAL_RADIUS = 140;
/** Min silence between socials so pets don't spam messages. */
export const SOCIAL_COOLDOWN_MS = 25_000;

function clamp(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Deterministic pick: pass Math.random() from the caller (testable). */
export function pickSocial(r: number): SocialKind {
  if (r < 0.5) return "play";
  if (r < 0.8) return "chase";
  return "squabble";
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
  }
}

/** Apply the mood effect of a social event. */
export function applySocial(s: PetStats, kind: SocialKind, now: number): PetStats {
  return { ...s, mood: clamp(s.mood + socialMoodDelta(kind)), updatedAt: now };
}
