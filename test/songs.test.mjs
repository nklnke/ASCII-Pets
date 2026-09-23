import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SONG_BEAT_MS,
  songDurationMs,
  songFor,
  songsFor,
  voiceFor,
} from "../dist/shared/songs.js";

describe("songs", () => {
  it("every known skin owns at least two singable melodies", () => {
    for (const skin of ["cat", "dog", "frog"]) {
      const list = songsFor(skin);
      assert.ok(list.length >= 2, skin);
      for (const song of list) {
        assert.ok(song.name.length > 0);
        assert.ok(song.notes.length >= 5, `${skin}/${song.name}`);
      }
    }
  });

  it("notes stay in a sane vocal range with sane lengths", () => {
    for (const skin of ["cat", "dog", "frog"]) {
      for (const song of songsFor(skin)) {
        for (const [semi, beats] of song.notes) {
          assert.ok(semi >= -24 && semi <= 24, `${skin}/${song.name}: ${semi}`);
          assert.ok(beats >= 1 && beats <= 4, `${skin}/${song.name}: ${beats}`);
        }
      }
    }
  });

  it("playback lasts a couple of seconds, voices differ per skin", () => {
    const cat = songDurationMs("cat", 0);
    assert.ok(cat >= 1500 && cat <= 6000, String(cat));
    const waves = new Set(["cat", "dog", "frog"].map((s) => voiceFor(s).wave));
    assert.equal(waves.size, 3);
    for (const skin of ["cat", "dog", "frog"]) {
      const v = voiceFor(skin);
      assert.ok(v.gain > 0 && v.gain <= 0.2);
      assert.ok(v.gapMs >= 0);
      assert.ok(v.octave > 0);
    }
    assert.ok(SONG_BEAT_MS > 0);
  });

  it("unknown skins and indexes fall back gracefully", () => {
    assert.ok(songFor("fish", 0).notes.length > 0);
    assert.equal(songFor("cat", 99).name, songFor("cat", 99 % songsFor("cat").length).name);
    assert.deepEqual(voiceFor("fish"), voiceFor("cat"));
  });
});
