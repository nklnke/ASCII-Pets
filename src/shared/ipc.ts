// Main <-> renderer contract (types only, no Electron/DOM).
// Single source of truth: main validates it, preload forwards it,
// renderer sends it. (CellInk lives in shared/color.ts next to its helpers.)

export interface PetSnapshot {
  label: string;
  hunger: number;
  mood: number;
  energy: number;
  /** Text origin of this pet's grid in window coords (x + padding, top + padding + jump/bob). */
  ox: number;
  oy: number;
  /** Character cell + grid size for the per-cell inversion sampler. */
  charW: number;
  charH: number;
  cols: number;
  rows: number;
}
