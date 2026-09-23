// Skin registry metadata (no art — art lives in renderer/ascii.ts).
// Pure and testable; main uses it for menu labels, renderer maps id -> frames.

export type Locomotion = "walk" | "hop";

export interface SkinMeta {
  id: string;
  name: string;
  moves: Locomotion;
  petSound: string;
  /** Front-facing sprite: left/right walk frames are identical, no mirroring. */
  symmetric: boolean;
}

export const SKIN_LIST: SkinMeta[] = [
  { id: "cat", name: "Кот", moves: "walk", petSound: "*mur*", symmetric: false },
  { id: "dog", name: "Пёс", moves: "walk", petSound: "*гав*", symmetric: true },
  { id: "frog", name: "Лягушка", moves: "hop", petSound: "*ква*", symmetric: true },
];

export const DEFAULT_SKIN = "cat";
export const MAX_PETS = 3;

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

/** Front-facing skins (dog, frog) use one walk set for both directions. */
export function skinSymmetric(id: string): boolean {
  return SKIN_LIST.find((s) => s.id === id)?.symmetric ?? false;
}

export interface StyleMeta {
  id: string;
  name: string;
}

export const STYLE_LIST: StyleMeta[] = [
  { id: "ascii1", name: "ASCII 1 — классика" },
  { id: "ascii2", name: "ASCII 2 — блоки" },
  { id: "ascii3", name: "ASCII 3 — тамагочи" },
];

export const DEFAULT_STYLE = "ascii1";

/** Normalize a style id from settings/menu/IPC (pack-wide). */
export function normalizeStyle(style: unknown): string {
  return typeof style === "string" && STYLE_LIST.some((s) => s.id === style) ? style : DEFAULT_STYLE;
}

export function styleName(id: string): string {
  return STYLE_LIST.find((s) => s.id === id)?.name ?? id;
}
