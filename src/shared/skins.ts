// Skin registry metadata (no art — art lives in renderer/ascii.ts).
// Pure and testable; main uses it for menu labels, renderer maps id -> frames.

export type Locomotion = "walk" | "hop";

export interface SkinMeta {
  id: string;
  name: string;
  moves: Locomotion;
  petSound: string;
}

export const SKIN_LIST: SkinMeta[] = [
  { id: "cat", name: "Кот", moves: "walk", petSound: "*mur*" },
  { id: "dog", name: "Пёс", moves: "walk", petSound: "*гав*" },
  { id: "frog", name: "Лягушка", moves: "hop", petSound: "*ква*" },
];

export const DEFAULT_SKIN = "cat";
export const MAX_PETS = 2;

/** Normalize a pack (array of skin ids) from settings/menu/IPC. */
export function normalizePack(skins: unknown): string[] {
  const known = new Set(SKIN_LIST.map((s) => s.id));
  const list = Array.isArray(skins) ? skins.filter((s) => typeof s === "string" && known.has(s)) : [];
  if (list.length === 0) return [DEFAULT_SKIN];
  return list.slice(0, MAX_PETS);
}

export function skinName(id: string): string {
  return SKIN_LIST.find((s) => s.id === id)?.name ?? id;
}

export function skinMoves(id: string): Locomotion {
  return SKIN_LIST.find((s) => s.id === id)?.moves ?? "walk";
}

export function skinSound(id: string): string {
  return SKIN_LIST.find((s) => s.id === id)?.petSound ?? "*mur*";
}
