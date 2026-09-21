import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldNotifyHunger, HUNGER_NOTIFY_COOLDOWN_MS } from "../dist/shared/notify.js";

describe("notify", () => {
  it("notifies once when hungry, then throttles by cooldown", () => {
    assert.equal(shouldNotifyHunger(null, true, 1000), true);
    assert.equal(shouldNotifyHunger(1000, true, 1000 + HUNGER_NOTIFY_COOLDOWN_MS - 1), false);
    assert.equal(shouldNotifyHunger(1000, true, 1000 + HUNGER_NOTIFY_COOLDOWN_MS), true);
  });

  it("never notifies when fed", () => {
    assert.equal(shouldNotifyHunger(null, false, 1000), false);
    assert.equal(shouldNotifyHunger(0, false, 9999999), false);
  });
});
