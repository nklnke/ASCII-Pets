import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SOCIAL_COOLDOWN_MS,
  SOCIAL_RADIUS,
  applySocial,
  pickSocial,
  shouldSocialize,
  socialMoodDelta,
} from "../dist/shared/social.js";
import { createInitialStats } from "../dist/shared/pet-stats.js";

describe("social", () => {
  it("picks play/chase/squabble deterministically", () => {
    assert.equal(pickSocial(0), "play");
    assert.equal(pickSocial(0.6), "chase");
    assert.equal(pickSocial(0.9), "squabble");
  });

  it("gates on distance and cooldown", () => {
    assert.equal(shouldSocialize(SOCIAL_RADIUS + 1, SOCIAL_COOLDOWN_MS, 0), null);
    assert.equal(shouldSocialize(10, SOCIAL_COOLDOWN_MS - 1, 0), null);
    assert.equal(shouldSocialize(10, SOCIAL_COOLDOWN_MS, 0.1), "play");
    // never met yet (negative) counts as elapsed
    assert.equal(shouldSocialize(10, -1, 0.6), "chase");
  });

  it("play/chase cheer up, squabble stings", () => {
    assert.ok(socialMoodDelta("play") > 0);
    assert.ok(socialMoodDelta("chase") > 0);
    assert.ok(socialMoodDelta("squabble") < 0);
  });

  it("applySocial touches only mood (+timestamp), clamped", () => {
    const s = { ...createInitialStats(0), mood: 98 };
    const next = applySocial(s, "play", 1000);
    assert.equal(next.mood, 100);
    assert.equal(next.hunger, s.hunger);
    assert.equal(next.energy, s.energy);
    assert.equal(next.updatedAt, 1000);
    assert.ok(applySocial(s, "squabble", 1000).mood < s.mood);
  });
});
