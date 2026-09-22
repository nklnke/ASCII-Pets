import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import {
  normalizePack,
  normalizeStyle,
  skinName,
  styleName,
  SKIN_LIST,
  STYLE_LIST,
  MAX_PETS,
  DEFAULT_STYLE,
} from "../dist/shared/skins.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("skins", () => {
  it("normalizes packs from settings/menu/IPC", () => {
    assert.deepEqual(normalizePack(["dog"]), ["dog"]);
    assert.deepEqual(normalizePack([]), ["cat"]);
    assert.deepEqual(normalizePack(["cat", "dog", "cat"]).length, MAX_PETS);
    assert.deepEqual(normalizePack(["fish", "dog"]), ["dog"]);
    assert.deepEqual(normalizePack(undefined), ["cat"]);
    assert.deepEqual(normalizePack("cat"), ["cat"]);
  });

  it("resolves display names", () => {
    assert.equal(skinName("cat"), "Кот");
    assert.equal(skinName("dog"), "Пёс");
    assert.equal(skinName("frog"), "Лягушка");
  });

  it("normalizes the pack-wide drawing style", () => {
    assert.equal(normalizeStyle("ascii2"), "ascii2");
    assert.equal(normalizeStyle("ascii1"), "ascii1");
    assert.equal(normalizeStyle("blocks"), DEFAULT_STYLE);
    assert.equal(normalizeStyle(undefined), DEFAULT_STYLE);
    assert.equal(normalizeStyle(["ascii2"]), DEFAULT_STYLE);
    assert.equal(styleName("ascii2"), "ASCII 2 — блоки");
  });

  it("every registered skin keeps its native height, well-formed art", async () => {
    const esbuild = await import("esbuild");
    const built = await esbuild.build({
      entryPoints: [path.join(ROOT, "src", "renderer", "ascii.ts")],
      bundle: true,
      format: "esm",
      write: false,
      logLevel: "error",
    });
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ascii-")), "ascii.mjs");
    fs.writeFileSync(out, built.outputFiles[0].text);
    const m = await import(pathToFileURL(out).href);
    for (const { id: styleId } of STYLE_LIST) {
      const set = m.SKIN_STYLES[styleId];
      assert.ok(set, `missing art set for style ${styleId}`);
      for (const { id } of SKIN_LIST) {
        const skin = set[id];
        const tag = `${styleId}/${id}`;
        assert.ok(skin, `missing frames for skin ${tag}`);
        assert.ok(skin.walkRight.length >= 4, `${tag}: walkRight needs 4+ frames`);
        assert.ok(skin.walkLeft.length >= 4, `${tag}: walkLeft needs 4+ frames`);
        assert.ok(skin.happy.length >= 2, `${tag}: happy needs a 2-frame loop`);
        assert.ok(skin.hungry.length >= 2, `${tag}: hungry needs a 2-frame loop`);
        assert.ok(skin.sleep.length >= 2, `${tag}: sleep needs a 2-frame loop`);
        assert.ok(skin.jump.length >= 2, `${tag}: jump needs tuck+stretch frames`);
        const frames = [
          ...skin.walkRight,
          ...skin.walkLeft,
          ...skin.happy,
          ...skin.hungry,
          ...skin.sleep,
          ...skin.jump,
          skin.blink,
          skin.eat,
        ];
        // Native height: every frame of one skin shares it (pets stand on one
        // ground line via bottom-anchoring, whatever the height).
        const heights = new Set(frames.map((f) => f.split("\n").length));
        assert.equal(heights.size, 1, `${tag}: all frames must share the skin's native height`);
        const nativeH = [...heights][0];
        assert.ok(nativeH >= 2 && nativeH <= 8, `${tag}: native height ${nativeH} out of range`);
        for (const f of frames) {
          assert.equal(typeof f, "string", `${tag}: frame must be a string`);
          for (const line of f.split("\n")) {
            assert.ok(line.trim().length > 0, `${tag}: no blank lines in frames`);
          }
        }
      }
    }
    // framesFor falls back to the ASCII1 cat for unknown ids.
    assert.equal(m.framesFor("nope", "nope").walkRight[0], m.SKIN_STYLES.ascii1.cat.walkRight[0]);
  });
});
