import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import {
  normalizePack,
  skinName,
  SKIN_LIST,
  MAX_PETS,
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

  it("every registered skin has complete, well-formed art", async () => {
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
    for (const { id } of SKIN_LIST) {
      const skin = m.SKINS[id];
      assert.ok(skin, `missing frames for skin ${id}`);
      assert.ok(skin.walkRight.length >= 4, `${id}: walkRight needs 4+ frames`);
      assert.ok(skin.walkLeft.length >= 4, `${id}: walkLeft needs 4+ frames`);
      assert.ok(skin.happy.length >= 2, `${id}: happy needs a 2-frame loop`);
      assert.ok(skin.hungry.length >= 2, `${id}: hungry needs a 2-frame loop`);
      assert.ok(skin.sleep.length >= 2, `${id}: sleep needs a 2-frame loop`);
      assert.ok(skin.jump.length >= 2, `${id}: jump needs tuck+stretch frames`);
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
      for (const f of frames) {
        assert.equal(typeof f, "string", `${id}: frame must be a string`);
        const lines = f.split("\n");
        assert.equal(lines.length, 5, `${id}: every frame must be 5 lines`);
        for (const line of lines) {
          assert.ok(line.trim().length > 0, `${id}: no blank lines in frames`);
        }
      }
    }
  });
});
