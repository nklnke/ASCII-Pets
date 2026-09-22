import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectTaskbarEdge, stripBounds } from "../dist/shared/placement.js";

const PET_H = 180;

describe("placement", () => {
  it("bottom taskbar -> strip bottom flush with the work-area bottom (taskbar top edge)", () => {
    const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
    const workArea = { x: 0, y: 0, width: 1920, height: 1040 };
    assert.equal(detectTaskbarEdge(bounds, workArea), "bottom");
    assert.deepEqual(stripBounds(bounds, workArea, PET_H), {
      x: 0,
      y: 1040 - PET_H,
      width: 1920,
      height: PET_H,
    });
  });

  it("top taskbar -> strip top flush with the work-area top", () => {
    const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
    const workArea = { x: 0, y: 40, width: 1920, height: 1040 };
    assert.equal(detectTaskbarEdge(bounds, workArea), "top");
    assert.deepEqual(stripBounds(bounds, workArea, PET_H), {
      x: 0,
      y: 40,
      width: 1920,
      height: PET_H,
    });
  });

  it("side taskbar -> horizontal strip stays at the bottom, flush with work area", () => {
    const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
    const workArea = { x: 62, y: 0, width: 1858, height: 1080 };
    assert.equal(detectTaskbarEdge(bounds, workArea), "left");
    const s = stripBounds(bounds, workArea, PET_H);
    assert.equal(s.y, 1080 - PET_H);
  });

  it("no taskbar (bounds == workArea) -> bottom fallback", () => {
    const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
    assert.equal(detectTaskbarEdge(bounds, bounds), "hidden");
    const s = stripBounds(bounds, bounds, PET_H);
    assert.equal(s.y, 1080 - PET_H);
  });

  it("respects a non-zero display origin (multi-monitor)", () => {
    const bounds = { x: 1920, y: 0, width: 1920, height: 1080 };
    const workArea = { x: 1920, y: 0, width: 1920, height: 1040 };
    const s = stripBounds(bounds, workArea, PET_H);
    assert.equal(s.x, 1920);
    assert.equal(s.width, 1920);
    assert.equal(s.y, 1040 - PET_H);
  });
});
