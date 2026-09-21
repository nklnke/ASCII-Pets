// Pure color helpers for adaptive inversion (no Electron/DOM).
// The pet ink = inversion of the backdrop pixels under it.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function invertRgb(c: Rgb): Rgb {
  return { r: 255 - c.r, g: 255 - c.g, b: 255 - c.b };
}

export function cssRgb(c: Rgb): string {
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}

/** Per-channel median — robust against the pet's own glyphs in the sample. */
export function medianRgb(samples: Rgb[]): Rgb | null {
  if (samples.length === 0) return null;
  const channel = (pick: (c: Rgb) => number): number => {
    const sorted = samples.map(pick).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  };
  return {
    r: channel((c) => c.r),
    g: channel((c) => c.g),
    b: channel((c) => c.b),
  };
}

/** Per-cell ink for one pet slot: row-major w*h colors (spaces included). */
export interface CellInk {
  slot: number;
  w: number;
  h: number;
  colors: string[];
  shadows: string[];
}

/** Character grid of one ASCII frame (rows padded to max width). */
export interface FrameGrid {
  w: number;
  h: number;
  /** Row-major; true = visible glyph (anything but a space). */
  solid: boolean[];
}

/** Parse a frame string into a grid. Pure — shared by renderer + tests. */
export function frameCells(text: string): FrameGrid {
  const rows = text.split("\n");
  let w = 1;
  for (const r of rows) w = Math.max(w, r.length);
  const solid: boolean[] = [];
  for (const r of rows) {
    for (let c = 0; c < w; c++) solid.push((r[c] ?? " ") !== " ");
  }
  return { w, h: rows.length, solid };
}

export interface CellLayout {
  /** Screen coords of the grid's top-left corner. */
  originX: number;
  originY: number;
  charW: number;
  charH: number;
}

/** Screen center of a grid cell — pure geometry for the backdrop sampler. */
export function cellCenter(layout: CellLayout, col: number, row: number): { x: number; y: number } {
  return {
    x: layout.originX + col * layout.charW + layout.charW / 2,
    y: layout.originY + row * layout.charH + layout.charH / 2,
  };
}
