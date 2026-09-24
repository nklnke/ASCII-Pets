import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ANNOY_MOOD_HIT,
  PET_SPAM_LIMIT,
  PET_SPAM_WINDOW_MS,
  RESTORE_PER_MIN,
  annoyPet,
  cleanPoop,
  createInitialStats,
  energyDrainFor,
  isPettingSpam,
  rollPoop,
  tickDirty,
  tickStats,
  petPet,
  feedPet,
  isHungry,
  isResting,
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
    // Feeding is a strong energy boost (wakes a sleepy pet up).
    const tired = { ...createInitialStats(0), energy: 10 };
    assert.equal(feedPet(tired, 1000).energy, 35);
  });

  it("sleepiness kicks in at zero energy", () => {
    const s = { ...createInitialStats(0), energy: 5 };
    assert.equal(isSleepy(s), true);
  });

  it("sleep counts as rest and recovers energy", () => {
    const sleepy = { ...createInitialStats(0), energy: 5 };
    assert.equal(isResting(sleepy, false), true);
    assert.equal(isResting(createInitialStats(0), false), false);
    assert.equal(isResting(createInitialStats(0), true), true);
    const next = tickStats(sleepy, 2, isResting(sleepy, false), 120_000);
    assert.ok(next.energy > sleepy.energy);
    assert.equal(isSleepy(next), false);
  });

  it("restores energy at the resting rate", () => {
    assert.ok(RESTORE_PER_MIN > 6);
    const s = { ...createInitialStats(0), energy: 50 };
    const next = tickStats(s, 2, true, 120_000);
    assert.equal(next.energy, 50 + 2 * RESTORE_PER_MIN);
  });

  it("endurance differs per skin: dog outlasts frog", () => {
    assert.equal(energyDrainFor("dog"), 0.5);
    assert.equal(energyDrainFor("cat"), 1);
    assert.equal(energyDrainFor("frog"), 2);
    assert.equal(energyDrainFor("unknown-skin"), 1);
    const s = { ...createInitialStats(0), energy: 50 };
    const dog = tickStats(s, 10, false, 600_000, energyDrainFor("dog"));
    const frog = tickStats(s, 10, false, 600_000, energyDrainFor("frog"));
    assert.ok(dog.energy > s.energy - 5 && dog.energy < 50);
    assert.ok(frog.energy < dog.energy);
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

  it("petting spam trips at the limit inside the window", () => {
    const now = 60_000;
    const spammy = Array.from({ length: PET_SPAM_LIMIT }, (_, i) => now - i * 1000);
    assert.equal(isPettingSpam(spammy, now), true);
    assert.equal(isPettingSpam(spammy.slice(0, PET_SPAM_LIMIT - 1), now), false);
    const stale = Array.from({ length: PET_SPAM_LIMIT }, () => now - PET_SPAM_WINDOW_MS - 1);
    assert.equal(isPettingSpam(stale, now), false);
  });

  it("overpetting counts the interaction but stings the mood", () => {
    const s = createInitialStats(0);
    const next = annoyPet(s, 1000);
    assert.equal(next.pets, s.pets + 1);
    assert.equal(next.mood, s.mood - ANNOY_MOOD_HIT);
    assert.equal(next.hunger, s.hunger);
    assert.equal(next.energy, s.energy);
    assert.equal(next.updatedAt, 1000);
  });
});
