// Main <-> renderer contract (types only, no Electron/DOM).
// Single source of truth: main validates it, preload forwards it,
// renderer sends it. (CellInk lives in shared/color.ts next to its helpers.)
export interface PetSnapshot {
  label: string;
  hunger: number;
  mood: number;
  energy: number;
  /** True while this pet has an uncleaned poop pile. Optional for compat. */
  dirty?: boolean;
  /** Lifetime counters (shown in the status window). Optional for compat. */
  pets?: number;
  meals?: number;
  /** Text origin of this pet's grid in window coords (x + padding, top + padding + jump/bob). */
  ox: number;
  oy: number;
  /** Character cell + grid size for the per-cell inversion sampler. */
  charW: number;
  charH: number;
  cols: number;
  rows: number;
  /** Strip render-loop rate (EMA, same for the whole pack). Optional for compat. */
  fps?: number;
}

/** Full app settings snapshot (owned by main, shown in the settings window). */
export interface SettingsSnapshot {
  pack: string[];
  style: string;
  paused: boolean;
  onTop: boolean;
  showStatus: boolean;
  colorMode: boolean;
  notifyHungry: boolean;
  muted: boolean;
  /** Master volume 0..1 for the renderer synth. */
  volume: number;
  petScale: number;
  openAtLogin: boolean;
  /** Selected monitor id, or null = follow the primary display. */
  displayId: number | null;
  /** FPS meter row in the status window. */
  fpsMeter: boolean;
  /** Text shadows + silhouette glow on the stage. */
  shadows: boolean;
  /** Auto-updater state for the settings window status line. */
  updateStatus: "idle" | "available" | "downloaded" | "error";
}

/** One row of the monitor picker (dynamic — displays come and go). */
export interface DisplayOption {
  id: number;
  label: string;
  primary: boolean;
  width: number;
  height: number;
}

/** Partial update sent by the settings window (main validates each field). */
export type SettingsUpdate = Partial<SettingsSnapshot>;
