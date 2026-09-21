import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectTaskbarEdge, stripBounds } from "../dist/shared/placement.js";

const PET_H = 180;
const MARGIN = 8;

describe("placement", () => {
  it("bottom taskbar -> strip at the bottom over the taskbar", () => {
    const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
    const workArea = { x: 0, y: 0, width: 1920, height: 1040 };
    assert.equal(detectTaskbarEdge(bounds, workArea), "bottom");
    assert.deepEqual(stripBounds(bounds, workArea, PET_H, MARGIN), {
      x: 0,
      y: 1080 - PET_H - MARGIN,
      width: 1920,
      height: PET_H,
    });
  });

  it("top taskbar -> strip at the top", () => {
    const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
    const workArea = { x: 0, y: 40, width: 1920, height: 1040 };
    assert.equal(detectTaskbarEdge(bounds, workArea), "top");
    assert.deepEqual(stripBounds(bounds, workArea, PET_H, MARGIN), {
      x: 0,
      y: MARGIN,
      width: 1920,
      height: PET_H,
    });
  });

  it("side taskbar -> horizontal strip stays at the bottom", () => {
    const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
    const workArea = { x: 62, y: 0, width: 1858, height: 1080 };
    assert.equal(detectTaskbarEdge(bounds, workArea), "left");
    const s = stripBounds(bounds, workArea, PET_H, MARGIN);
    assert.equal(s.y, 1080 - PET_H - MARGIN);
  });

  it("no taskbar (bounds == workArea) -> bottom fallback", () => {
    const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
    assert.equal(detectTaskbarEdge(bounds, bounds), "hidden");
    const s = stripBounds(bounds, bounds, PET_H, MARGIN);
    assert.equal(s.y, 1080 - PET_H - MARGIN);
  });

  it("respects a non-zero display origin (multi-monitor)", () => {
    const bounds = { x: 1920, y: 0, width: 1920, height: 1080 };
    const workArea = { x: 1920, y: 0, width: 1920, height: 1040 };
    const s = stripBounds(bounds, workArea, PET_H, MARGIN);
    assert.equal(s.x, 1920);
    assert.equal(s.width, 1920);
  });
});
