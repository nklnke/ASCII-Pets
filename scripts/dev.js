// Watch mode without extra deps: rebuilds on src changes and restarts
// Electron when main/preload/shared change.
//
//   npm run dev
//
// Renderer-only changes rebuild the bundle in place — reload the pet by
// toggling Пауза or restarting (no HMR in this project by design).
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(script) {
  const r = spawnSync(npm, ["run", "--silent", script], { cwd: ROOT, stdio: "inherit", shell: false });
  return r.status === 0;
}

function isMainFile(f) {
  return (
    f.endsWith("main.ts") || f.endsWith("preload.ts") || f.includes(`${path.sep}shared${path.sep}`)
  );
}

let electron = null;
function startElectron() {
  const bin = path.join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "electron.cmd" : "electron");
  electron = spawn(bin, ["."], { cwd: ROOT, stdio: "inherit", shell: false });
}

function stopElectron() {
  if (electron && !electron.killed) {
    electron.kill();
    electron = null;
  }
}

let timer = null;
function onChange(file) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    console.log(`[dev] changed: ${path.relative(ROOT, file)}`);
    if (!run(isMainFile(file) ? "build:main" : "build:renderer")) return;
    if (!run("check")) return;
    if (isMainFile(file)) {
      stopElectron();
      startElectron();
    } else {
      console.log("[dev] renderer rebuilt — restart the app to reload (npm run dev restarts only on main changes)");
    }
  }, 250);
}

console.log("[dev] initial build…");
if (!run("build")) {
  console.error("[dev] initial build failed");
  process.exit(1);
}
startElectron();
fs.watch(path.join(ROOT, "src"), { recursive: true }, (_event, file) => {
  if (!file) return;
  if (!/\.(ts|html)$/.test(file)) return;
  onChange(path.join(ROOT, "src", file));
});
process.on("SIGINT", () => {
  stopElectron();
  process.exit(0);
});
