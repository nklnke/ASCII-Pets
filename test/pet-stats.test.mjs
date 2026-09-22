import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cleanPoop,
  createInitialStats,
  rollPoop,
  tickDirty,
  tickStats,
  petPet,
  feedPet,
  isHungry,
  isSleepy,
} from "../dist/shared/pet-stats.js";

describe("pet-stats", () => {
  it("starts fed, happy and rested", () => {
    const s = createInitialStats(0);
    assert.equal(s.hunger, 20);
    assert.equal(s.mood, 80);
    assert.equal(s.energy, 100);
    assert.equal(isHungry(s), false);
    assert.equal(isSleepy(s), false);
  });

  it("hunger grows and mood drops when starving", () => {
    const s = createInitialStats(0);
    const next = tickStats(s, 60, false, 3_600_000);
    assert.equal(next.hunger, 100); // capped
    assert.ok(next.mood < s.mood);
    assert.equal(isHungry(next), true);
  });

  it("resting recovers energy, walking drains it", () => {
    const s = { ...createInitialStats(0), energy: 50 };
    const rested = tickStats(s, 10, true, 600_000);
    const walked = tickStats(s, 10, false, 600_000);
    assert.ok(rested.energy > s.energy);
    assert.ok(walked.energy < s.energy);
  });

  it("zero/negative elapsed time only refreshes the timestamp", () => {
    const s = createInitialStats(1000);
    assert.deepEqual(tickStats(s, 0, false, 2000), { ...s, updatedAt: 2000 });
  });

  it("petting raises mood and counts", () => {
    const s = petPet(createInitialStats(0), 1000);
    assert.equal(s.pets, 1);
    assert.equal(s.mood, 88);
  });

  it("feeding resets hunger and counts meals", () => {
    const starving = { ...createInitialStats(0), hunger: 95 };
    const s = feedPet(starving, 1000);
    assert.equal(s.meals, 1);
    assert.ok(s.hunger < 95);
    assert.equal(isHungry(s), false);
  });

  it("sleepiness kicks in at zero energy", () => {
    const s = { ...createInitialStats(0), energy: 5 };
    assert.equal(isSleepy(s), true);
  });

  it("poop roll is deterministic from injected randomness", () => {
    assert.equal(rollPoop(0), true);
    assert.equal(rollPoop(0.99), false);
  });

  it("dirty pile rots mood over time", () => {
    const s = createInitialStats(0);
    const next = tickDirty(s, 0.5, 1000);
    assert.ok(next.mood < s.mood);
    assert.equal(next.hunger, s.hunger);
    assert.equal(next.energy, s.energy);
  });

  it("cleaning up cheers the pet", () => {
    const s = { ...createInitialStats(0), mood: 50 };
    const next = cleanPoop(s, 1000);
    assert.equal(next.mood, 55);
  });
});
