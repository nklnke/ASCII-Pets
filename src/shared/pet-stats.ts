// Pure pet-needs logic: no Electron, no DOM, no Date — fully testable.
// Time is passed in by callers; persistence lives in renderer/pet-store.ts.

export interface PetStats {
  /** 0 = сыт, 100 = очень голоден */
  hunger: number;
  /** 0 = грустит, 100 = счастлив */
  mood: number;
  /** 0 = без сил (спит), 100 = бодр */
  energy: number;
  /** всего поглаживаний */
  pets: number;
  /** всего кормлений */
  meals: number;
  /** ms epoch of last update (for offline catch-up) */
  updatedAt: number;
}

export const HUNGRY_AT = 80;
export const SLEEPY_AT = 10;
export const TIRED_AT = 25;
/** Energy recovered per minute while resting (pause or sleep). */
export const RESTORE_PER_MIN = 9;

const MIN = 0;
const MAX = 100;

function clamp(n: number): number {
  return Math.min(MAX, Math.max(MIN, Math.round(n)));
}

export function createInitialStats(now: number): PetStats {
  return { hunger: 20, mood: 80, energy: 100, pets: 0, meals: 0, updatedAt: now };
}

/**
 * Advance needs by elapsedMin minutes.
 * resting=true while the user paused the pet (it naps and recovers energy).
 * drain scales the walking drain per skin (endurance); resting ignores it.
 */
export function tickStats(s: PetStats, elapsedMin: number, resting: boolean, now: number, drain = 1): PetStats {
  if (elapsedMin <= 0) return { ...s, updatedAt: now };
  const hunger = s.hunger + elapsedMin * 2;
  const moodDrift = hunger >= 70 ? -elapsedMin * 1.5 : elapsedMin * 0.5;
  const energy = resting ? s.energy + elapsedMin * RESTORE_PER_MIN : s.energy - elapsedMin * 0.5 * drain;
  return {
    ...s,
    hunger: clamp(hunger),
    mood: clamp(s.mood + moodDrift),
    energy: clamp(energy),
    updatedAt: now,
  };
}

/** Single click on the pet. */
export function petPet(s: PetStats, now: number): PetStats {
  return {
    ...s,
    pets: s.pets + 1,
    mood: clamp(s.mood + 8),
    hunger: clamp(s.hunger + 1),
    updatedAt: now,
  };
}

/** Feed the pet (menu item / double-click). */
export function feedPet(s: PetStats, now: number): PetStats {
  return {
    ...s,
    meals: s.meals + 1,
    hunger: clamp(s.hunger - 60),
    mood: clamp(s.mood + 5),
    energy: clamp(s.energy + 25),
    updatedAt: now,
  };
}

export function isHungry(s: PetStats): boolean {
  return s.hunger >= HUNGRY_AT;
}

export function isSleepy(s: PetStats): boolean {
  return s.energy <= SLEEPY_AT;
}

/** Sleep counts as rest: a sleeping pet recovers energy like a paused one. */
export function isResting(s: PetStats, paused: boolean): boolean {
  return paused || s.energy <= SLEEPY_AT;
}

/** Walking energy drain per skin (endurance): dog lasts longest, frog tires fast. */
export function energyDrainFor(skinId: string): number {
  if (skinId === "dog") return 0.5;
  if (skinId === "frog") return 2;
  return 1;
}

// Poop mechanics (simple variant): after each meal the pet may leave a pile
// with POOP_CHANCE. While a pile is present the pet's mood rots via tickDirty.
// Cleanup itself lives in the renderer (pile element + click handler).

/** Chance to drop a pile after one feeding. */
export const POOP_CHANCE = 0.35;
/** Mood points lost per minute while a pile is present. */
export const DIRTY_MOOD_PER_MIN = 4;
/** Mood points regained for cleaning up. */
export const CLEANUP_MOOD_BONUS = 5;

/** Deterministic roll: pass Math.random() from the caller (testable). */
export function rollPoop(r: number): boolean {
  return r < POOP_CHANCE;
}

/** Mood rot while a poop pile is present (one pile per pet max). */
export function tickDirty(s: PetStats, elapsedMin: number, now: number): PetStats {
  if (elapsedMin <= 0) return { ...s, updatedAt: now };
  return {
    ...s,
    mood: clamp(s.mood - elapsedMin * DIRTY_MOOD_PER_MIN),
    updatedAt: now,
  };
}

/** Clicking the pile cleans it up and cheers the pet a little. */
export function cleanPoop(s: PetStats, now: number): PetStats {
  return {
    ...s,
    mood: clamp(s.mood + CLEANUP_MOOD_BONUS),
    updatedAt: now,
  };
}

// Petting-spam handling: too many pats in a short window annoys the pet.
// Timestamps live in the renderer; the window/limit math stays pure here.

/** Pats within this window count toward the spam limit. */
export const PET_SPAM_WINDOW_MS = 10_000;
/** Pats in the window that trigger the annoyed reaction. */
export const PET_SPAM_LIMIT = 5;
/** Mood points lost when overpetted. */
export const ANNOY_MOOD_HIT = 10;

/** True when the recent pat timestamps hit the spam limit. */
export function isPettingSpam(petAt: number[], now: number): boolean {
  return petAt.filter((t) => now - t < PET_SPAM_WINDOW_MS).length >= PET_SPAM_LIMIT;
}

/** Overpetted: still counts the interaction, but the mood stings. */
export function annoyPet(s: PetStats, now: number): PetStats {
  return {
    ...s,
    pets: s.pets + 1,
    mood: clamp(s.mood - ANNOY_MOOD_HIT),
    updatedAt: now,
  };
}
