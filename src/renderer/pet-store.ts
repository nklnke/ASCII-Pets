// Renderer-side persistence for pet needs (localStorage + offline catch-up).
// Pure math lives in shared/pet-stats.ts; this module owns I/O and timing.
// Stats are stored per pack slot so each pet keeps its own needs.

import {
  PetStats,
  createInitialStats,
  tickStats,
} from "../shared/pet-stats";

// Keys from before the ASCII Companion → ASCII Pets rename; read as fallback.
const LEGACY_KEY = "ascii-companion:stats:v1";
const LEGACY_SLOT_PREFIX = "ascii-companion:stats:v1:slot";
const SAVE_EVERY_MS = 10_000;
/** Cap offline progress so a month away doesn't return a corpse. */
const MAX_CATCHUP_MIN = 8 * 60;

function key(slot: number): string {
  return `ascii-pets:stats:v1:slot${slot}`;
}

function candidates(slot: number): string[] {
  const keys = [key(slot), `${LEGACY_SLOT_PREFIX}${slot}`];
  if (slot === 0) keys.push(LEGACY_KEY);
  return keys;
}

function readStored(slot: number): PetStats | null {
  const keys = candidates(slot);
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const s = JSON.parse(raw) as PetStats;
      if (
        typeof s.hunger !== "number" ||
        typeof s.mood !== "number" ||
        typeof s.energy !== "number" ||
        typeof s.updatedAt !== "number"
      ) {
        continue;
      }
      return { ...s, pets: s.pets ?? 0, meals: s.meals ?? 0 };
    } catch {
      continue;
    }
  }
  return null;
}

export function loadStats(slot: number, now: number): PetStats {
  const stored = readStored(slot);
  if (!stored) return createInitialStats(now);
  const elapsedMin = Math.min(Math.max(0, (now - stored.updatedAt) / 60000), MAX_CATCHUP_MIN);
  // Offline the pet naps: no energy drain while the app is closed.
  return tickStats(stored, elapsedMin, true, now);
}

export function saveStats(slot: number, s: PetStats): void {
  try {
    localStorage.setItem(key(slot), JSON.stringify(s));
  } catch {
    // Storage full/blocked — the pet just won't remember. Fine.
  }
}

/** Periodic autosave; returns a stop function. */
export function startAutosave(getAll: () => Array<{ slot: number; stats: PetStats }>): () => void {
  const id = setInterval(() => {
    for (const { slot, stats } of getAll()) saveStats(slot, stats);
  }, SAVE_EVERY_MS);
  window.addEventListener("beforeunload", () => {
    for (const { slot, stats } of getAll()) saveStats(slot, stats);
  });
  return () => clearInterval(id);
}
