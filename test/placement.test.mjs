import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectTaskbarEdge, stageBounds, displayLabel, pickDisplayId } from "../dist/shared/placement.js";

describe("placement", () => {
  it("bottom taskbar -> stage covers the whole workArea", () => {
    const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
    const workArea = { x: 0, y: 0, width: 1920, height: 1040 };
    assert.equal(detectTaskbarEdge(bounds, workArea), "bottom");
    assert.deepEqual(stageBounds(workArea), {
      x: 0,
      y: 0,
      width: 1920,
      height: 1040,
    });
  });

  it("top taskbar -> stage covers the whole workArea", () => {
    const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
    const workArea = { x: 0, y: 40, width: 1920, height: 1040 };
    assert.equal(detectTaskbarEdge(bounds, workArea), "top");
    assert.deepEqual(stageBounds(workArea), {
      x: 0,
      y: 40,
      width: 1920,
      height: 1040,
    });
  });

  it("side taskbar -> stage covers the whole workArea", () => {
    const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
    const workArea = { x: 62, y: 0, width: 1858, height: 1080 };
    assert.equal(detectTaskbarEdge(bounds, workArea), "left");
    assert.deepEqual(stageBounds(workArea), {
      x: 62,
      y: 0,
      width: 1858,
      height: 1080,
    });
  });

  it("no taskbar (bounds == workArea) -> stage covers the whole workArea", () => {
    const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
    assert.equal(detectTaskbarEdge(bounds, bounds), "hidden");
    assert.deepEqual(stageBounds(bounds), {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
  });

  it("respects a non-zero display origin (multi-monitor)", () => {
    const workArea = { x: 1920, y: 0, width: 1920, height: 1040 };
    const s = stageBounds(workArea);
    assert.equal(s.x, 1920);
    assert.equal(s.width, 1920);
    assert.equal(s.y, 0);
    assert.equal(s.height, 1040);
  });

  it("labels monitor picker rows with index, size and primary mark", () => {
    assert.equal(displayLabel(0, 1920, 1080, true), "Монитор 1 — 1920×1080 (основной)");
    assert.equal(displayLabel(1, 2560, 1440, false), "Монитор 2 — 2560×1440");
  });

  it("resolves a stored monitor id, falling back to primary when gone", () => {
    assert.equal(pickDisplayId([1, 2], 2), 2);
    assert.equal(pickDisplayId([1, 2], null), null);
    assert.equal(pickDisplayId([1], 2), null);
    assert.equal(pickDisplayId([], 2), null);
  });
});
