import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SOCIAL_COOLDOWN_MS,
  SOCIAL_MAX_MS,
  SOCIAL_MIN_MS,
  SOCIAL_RADIUS,
  applySocial,
  pickSocial,
  pickTrioSocial,
  shouldSocialize,
  shouldSocializeTrio,
  socialDurationMs,
  socialEnergyDelta,
  socialMoodDelta,
} from "../dist/shared/social.js";
import { createInitialStats } from "../dist/shared/pet-stats.js";

describe("social", () => {
  it("picks play/chase/squabble/sniff/dance/race deterministically", () => {
    assert.equal(pickSocial(0), "play");
    assert.equal(pickSocial(0.4), "chase");
    assert.equal(pickSocial(0.6), "squabble");
    assert.equal(pickSocial(0.7), "sniff");
    assert.equal(pickSocial(0.8), "dance");
    assert.equal(pickSocial(0.95), "race");
  });

  it("gates on distance and cooldown", () => {
    assert.equal(shouldSocialize(SOCIAL_RADIUS + 1, SOCIAL_COOLDOWN_MS, 0), null);
    assert.equal(shouldSocialize(10, SOCIAL_COOLDOWN_MS - 1, 0), null);
    assert.equal(shouldSocialize(10, SOCIAL_COOLDOWN_MS, 0.1), "play");
    // never met yet (negative) counts as elapsed
    assert.equal(shouldSocialize(10, -1, 0.4), "chase");
  });

  it("play/chase/sniff/dance/race cheer up, squabble stings", () => {
    assert.ok(socialMoodDelta("play") > 0);
    assert.ok(socialMoodDelta("chase") > 0);
    assert.ok(socialMoodDelta("sniff") > 0);
    assert.ok(socialMoodDelta("dance") > 0);
    assert.ok(socialMoodDelta("race") > 0);
    assert.ok(socialMoodDelta("squabble") < 0);
  });

  it("running costs energy, sniffing is free", () => {
    assert.equal(socialEnergyDelta("sniff"), 0);
    assert.ok(socialEnergyDelta("chase") < 0);
    assert.ok(socialEnergyDelta("race") < socialEnergyDelta("chase"));
  });

  it("trio scenes trigger on a tight cluster after cooldown", () => {
    assert.equal(pickTrioSocial(0), "huddle");
    assert.equal(pickTrioSocial(0.9), "parade");
    assert.equal(shouldSocializeTrio(SOCIAL_RADIUS + 1, SOCIAL_COOLDOWN_MS, 0), null);
    assert.equal(shouldSocializeTrio(10, SOCIAL_COOLDOWN_MS - 1, 0), null);
    assert.equal(shouldSocializeTrio(10, SOCIAL_COOLDOWN_MS, 0.1), "huddle");
    assert.equal(shouldSocializeTrio(10, -1, 0.8), "parade");
  });

  it("huddle/parade cheer up and cost energy", () => {
    assert.ok(socialMoodDelta("huddle") > 0);
    assert.ok(socialMoodDelta("parade") > 0);
    assert.ok(socialEnergyDelta("huddle") < 0);
    assert.ok(socialEnergyDelta("parade") < socialEnergyDelta("huddle"));
  });

  it("scene length rolls within 2-4s", () => {
    assert.equal(socialDurationMs(0), SOCIAL_MIN_MS);
    assert.equal(socialDurationMs(1), SOCIAL_MAX_MS);
    const mid = socialDurationMs(0.5);
    assert.ok(mid >= SOCIAL_MIN_MS && mid <= SOCIAL_MAX_MS);
  });

  it("applySocial touches mood + energy (+timestamp), clamped", () => {
    const s = { ...createInitialStats(0), mood: 98, energy: 3 };
    const next = applySocial(s, "play", 1000);
    assert.equal(next.mood, 100);
    assert.ok(next.energy < s.energy);
    assert.equal(next.hunger, s.hunger);
    assert.equal(next.updatedAt, 1000);
    assert.ok(applySocial(s, "squabble", 1000).mood < s.mood);
    const sniffed = applySocial(s, "sniff", 1000);
    assert.ok(sniffed.mood > s.mood);
    assert.equal(sniffed.energy, s.energy);
  });

  it("applySocial scales the energy cost by endurance, mood stays flat", () => {
    const s = { ...createInitialStats(0), mood: 50, energy: 80 };
    const dog = applySocial(s, "race", 1000, 0.5);
    const frog = applySocial(s, "race", 1000, 2);
    assert.equal(dog.mood, frog.mood);
    assert.ok(dog.energy > s.energy - 12 && dog.energy < 80);
    assert.ok(frog.energy < dog.energy);
    // Default scale keeps the legacy flat cost.
    assert.equal(applySocial(s, "race", 1000).energy, s.energy - 12);
  });
});
