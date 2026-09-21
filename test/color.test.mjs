import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cssRgb, invertRgb, medianRgb, frameCells, cellCenter } from "../dist/shared/color.js";

describe("color", () => {
  it("inverts channels", () => {
    assert.deepEqual(invertRgb({ r: 0, g: 128, b: 255 }), { r: 255, g: 127, b: 0 });
    assert.deepEqual(invertRgb(invertRgb({ r: 10, g: 20, b: 30 })), { r: 10, g: 20, b: 30 });
  });

  it("formats css", () => {
    assert.equal(cssRgb({ r: 255, g: 0, b: 128 }), "rgb(255, 0, 128)");
  });

  it("takes the per-channel median, ignoring outliers", () => {
    const samples = [
      { r: 10, g: 10, b: 10 },
      { r: 12, g: 12, b: 12 },
      { r: 11, g: 11, b: 11 },
      { r: 250, g: 250, b: 250 }, // the pet's own glyph in the sample
      { r: 13, g: 13, b: 13 },
    ];
    assert.deepEqual(medianRgb(samples), { r: 12, g: 12, b: 12 });
  });

  it("handles even counts and empties", () => {
    assert.deepEqual(
      medianRgb([
        { r: 0, g: 0, b: 0 },
        { r: 10, g: 20, b: 30 },
      ]),
      { r: 5, g: 10, b: 15 },
    );
    assert.equal(medianRgb([]), null);
  });

  it("parses a frame into a padded grid, marking spaces hollow", () => {
    const g = frameCells("ab\nc");
    assert.equal(g.w, 2);
    assert.equal(g.h, 2);
    assert.deepEqual(g.solid, [true, true, true, false]);
  });

  it("computes cell centers from the grid origin", () => {
    const layout = { originX: 100, originY: 50, charW: 10, charH: 20 };
    assert.deepEqual(cellCenter(layout, 0, 0), { x: 105, y: 60 });
    assert.deepEqual(cellCenter(layout, 1, 2), { x: 115, y: 100 });
  });
});
