// electron-builder afterPack: trim and harden the Windows bundle.
// - locales: keep en-US (Chromium fallback, must stay) + ru, drop the rest.
// - fuses: production fuse set for the packaged exe (@electron/fuses).
// Runs only on `npm run dist`, never in dev.
const fs = require("fs");
const path = require("path");

const KEEP_LOCALES = new Set(["en-US.pak", "ru.pak"]);

function pruneLocales(appOutDir) {
  let entries;
  try {
    entries = fs.readdirSync(path.join(appOutDir, "locales"));
  } catch {
    return 0; // no locales dir (non-Windows pack) — nothing to do
  }
  let removed = 0;
  for (const name of entries) {
    if (KEEP_LOCALES.has(name)) continue;
    try {
      fs.rmSync(path.join(appOutDir, "locales", name), { force: true });
      removed++;
    } catch {
      // Best-effort — a leftover locale never breaks the build.
    }
  }
  return removed;
}

async function flipProductionFuses(exePath) {
  const { flipFuses, FuseV1Options, FuseVersion } = require("@electron/fuses");
  await flipFuses(exePath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });
}

exports.default = async function afterPack(context) {
  const removed = pruneLocales(context.appOutDir);
  console.log(`[after-pack] pruned ${removed} locale(s)`);
  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  await flipProductionFuses(exe);
  console.log("[after-pack] production fuses flipped");
};
