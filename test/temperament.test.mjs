import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CALM,
  WILD,
  jitterTemperament,
  rollGait,
  temperamentForSlot,
} from "../dist/shared/temperament.js";

describe("temperament", () => {
  it("fixes character to the slot: 0 calm, 1+ wild", () => {
    assert.equal(temperamentForSlot(0), CALM);
    assert.equal(temperamentForSlot(1), WILD);
    assert.equal(temperamentForSlot(5), WILD);
  });

  it("wild is strictly more chaotic than calm", () => {
    assert.ok(WILD.scurryChance > CALM.scurryChance);
    assert.ok(WILD.reverseChance > CALM.reverseChance);
    assert.ok(WILD.jumpChance > CALM.jumpChance);
    assert.ok(WILD.startleRadius > CALM.startleRadius);
    assert.ok(WILD.decisionMaxMs < CALM.decisionMaxMs);
    assert.ok(WILD.speeds.scurry > CALM.speeds.walk);
  });

  it("rolls gaits deterministically from injected randomness", () => {
    // All-zero rolls: reverse + sniff + shortest duration, no jump.
    const d = rollGait(CALM, [0, 0, 0, 1]);
    assert.equal(d.gait, "sniff");
    assert.equal(d.reverse, true);
    assert.equal(d.jump, false);
    assert.equal(d.durationMs, CALM.decisionMinMs);
    // High rolls: plain walk, no reverse, jump for the wild one.
    const w = rollGait(WILD, [0.99, 0.99, 1, 0]);
    assert.equal(w.gait, "walk");
    assert.equal(w.reverse, false);
    assert.equal(w.jump, true);
    assert.equal(w.durationMs, WILD.decisionMaxMs);
  });

  it("defines sane hop ranges, wilder for the wild one", () => {
    for (const t of [CALM, WILD]) {
      assert.ok(t.hopLength[0] > 0 && t.hopLength[0] < t.hopLength[1]);
      assert.ok(t.hopPause[0] > 0 && t.hopPause[0] < t.hopPause[1]);
    }
    assert.ok(WILD.hopLength[0] > CALM.hopLength[0]);
    assert.ok(WILD.hopPause[1] < CALM.hopPause[1]);
  });

  it("jitter keeps params within sane bounds", () => {    for (const r of [[0, 0, 0], [1, 1, 1], [0.2, 0.7, 0.5]]) {
      const j = jitterTemperament(WILD, r);
      assert.ok(j.speeds.walk > 0 && j.speeds.walk < WILD.speeds.walk * 1.2);
      assert.ok(j.decisionMinMs > 0 && j.decisionMinMs < j.decisionMaxMs);
      // Chances untouched by jitter.
      assert.equal(j.scurryChance, WILD.scurryChance);
      assert.equal(j.jumpChance, WILD.jumpChance);
    }
  });
});
