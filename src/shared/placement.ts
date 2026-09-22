// Pure window-placement math: no Electron imports, fully testable.
// The strip overlays the taskbar edge (screen.bounds includes the taskbar area,
// workArea excludes it) so the pet walks "on" the taskbar.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
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
 * Full-width strip glued to the taskbar edge.
 * The window bottom sits flush with the work-area bottom (= the taskbar's
 * top edge): pets stand exactly on it and every jump starts from it.
 * For vertical (left/right) taskbars the horizontal strip stays at the
 * bottom — it doesn't conflict with a side taskbar.
 */
export function stripBounds(bounds: Rect, workArea: Rect, petH: number): Rect {
  const edge = detectTaskbarEdge(bounds, workArea);
  const y =
    edge === "top"
      ? workArea.y
      : workArea.y + workArea.height - petH;
  return { x: bounds.x, y, width: bounds.width, height: petH };
}
