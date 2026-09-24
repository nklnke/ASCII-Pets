// Pure window-placement math: no Electron imports, fully testable.
// The stage covers the whole workArea of the selected display (visible area
// without the taskbar), so the pet floor is the work-area bottom (= the
// taskbar's top edge) and pets stand exactly on it.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Minimal display description for the pure helpers below. */
export interface DisplaySpec {
  id: number;
  bounds: Rect;
  workArea: Rect;
  primary?: boolean;
}

export type TaskbarEdge = "bottom" | "top" | "left" | "right" | "hidden";

/** Which display edge holds the taskbar, derived from bounds vs workArea. */
export function detectTaskbarEdge(bounds: Rect, workArea: Rect): TaskbarEdge {
  const dh = bounds.height - workArea.height;
  const dw = bounds.width - workArea.width;
  if (dh <= 0 && dw <= 0) return "hidden"; // no taskbar or auto-hide
  if (dh >= dw) {
    // Horizontal taskbar: workArea pushed down => taskbar on top.
    const dy = workArea.y - bounds.y;
    return dy > dh / 2 ? "top" : "bottom";
  }
  const dx = workArea.x - bounds.x;
  return dx > dw / 2 ? "left" : "right";
}

/**
 * Full-workArea stage on the selected display.
 * The window bottom sits flush with the work-area bottom (= the taskbar's
 * top edge): pets stand exactly on it and every jump starts from it.
 */
export function stageBounds(workArea: Rect): Rect {
  return { x: workArea.x, y: workArea.y, width: workArea.width, height: workArea.height };
}

/** Human label for the monitor picker ("Монитор 1 — 1920×1080 (основной)"). */
export function displayLabel(index: number, width: number, height: number, primary: boolean): string {
  return `Монитор ${index + 1} — ${width}×${height}${primary ? " (основной)" : ""}`;
}

/**
 * Resolve a stored display id against the currently available ones.
 * Returns the id when still present, else null (caller falls back to primary).
 */
export function pickDisplayId(availableIds: number[], want: number | null): number | null {
  if (want === null || want === undefined) return null;
  return availableIds.includes(want) ? want : null;
}
