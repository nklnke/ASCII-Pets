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
 */
export function tickStats(s: PetStats, elapsedMin: number, resting: boolean, now: number): PetStats {
  if (elapsedMin <= 0) return { ...s, updatedAt: now };
  const hunger = s.hunger + elapsedMin * 2;
  const moodDrift = hunger >= 70 ? -elapsedMin * 1.5 : elapsedMin * 0.5;
  const energy = resting ? s.energy + elapsedMin * 6 : s.energy - elapsedMin * 0.5;
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
    energy: clamp(s.energy + 5),
    updatedAt: now,
  };
}

export function isHungry(s: PetStats): boolean {
  return s.hunger >= HUNGRY_AT;
}

export function isSleepy(s: PetStats): boolean {
  return s.energy <= SLEEPY_AT;
}
