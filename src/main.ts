import { app, BrowserWindow, Menu, MenuItemConstructorOptions, Tray, Notification, desktopCapturer, ipcMain, screen } from "electron";
import * as fs from "fs";
import * as path from "path";
import { cssRgb, invertRgb, medianRgb, cellCenter, Rgb, CellInk } from "./shared/color";
import type { PetSnapshot } from "./shared/ipc";
import { HUNGRY_AT } from "./shared/pet-stats";
import { shouldNotifyHunger } from "./shared/notify";
import { stripBounds } from "./shared/placement";
import { SKIN_LIST, normalizePack } from "./shared/skins";

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let paused = false;
let onTop = true;
let openAtLogin = false;
/** Color mode = auto-inversion of the pet against the backdrop (renderer applies ink). */
let colorMode = false;
/** Hunger toast notifications (Windows). Click feeds all pets. */
let notifyHungry = true;
let lastHungerNotify: number | null = null;
/** WebAudio voices (renderer synth) + pet font scale. Owned by main, mirrored. */
let muted = false;
let petScale = 1;
const PET_SCALES = [0.85, 1, 1.3, 1.6];
/** Pack = skin id per pet slot; renderer mirrors it. */
let pack: string[] = ["cat"];
/** Latest snapshot pushed by the renderer (for the tray tooltip + sampler). */
let lastStats: PetSnapshot[] = [];
let sampler: NodeJS.Timeout | null = null;

const PET_H = 180;
const BOTTOM_MARGIN = 8;
const SAMPLE_EVERY_MS = 1000;
/** Screen capture size for the sampler (once/sec; bigger = more unique px per cell). */
const THUMB_W = 960;
const THUMB_H = 540;
const SAMPLE_STEP_PX = 2;
/** Upper bound for a single frame grid (frames are ~11x5). */
const MAX_CELLS = 400;

interface AppSettings {
  onTop?: boolean;
  openAtLogin?: boolean;
  pack?: string[];
  colorMode?: boolean;
  notifyHungry?: boolean;
  muted?: boolean;
  petScale?: number;
}

function settingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

function readSettingsFile(p: string): AppSettings | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as AppSettings;
  } catch {
    return null;
  }
}

/** settings.json from before the ASCII Companion → ASCII Pets rename. */
function legacySettingsPath(): string {
  return path.join(path.dirname(settingsPath()), "ASCII Companion", "settings.json");
}

function loadSettings(): void {
  // New location first; old one migrates forward on the next saveSettings().
  const s = readSettingsFile(settingsPath()) ?? readSettingsFile(legacySettingsPath());
  if (!s) return; // No settings yet — defaults apply.
  if (typeof s.onTop === "boolean") onTop = s.onTop;
  if (typeof s.openAtLogin === "boolean") openAtLogin = s.openAtLogin;
  if (typeof s.colorMode === "boolean") colorMode = s.colorMode;
  if (typeof s.notifyHungry === "boolean") notifyHungry = s.notifyHungry;
  if (typeof s.muted === "boolean") muted = s.muted;
  if (typeof s.petScale === "number" && PET_SCALES.includes(s.petScale)) petScale = s.petScale;
  if (s.pack !== undefined) pack = normalizePack(s.pack);
}

function saveSettings(): void {
  try {
    fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
    fs.writeFileSync(
      settingsPath(),
      JSON.stringify({ onTop, openAtLogin, pack, colorMode, notifyHungry, muted, petScale }),
    );
  } catch {
    // Settings are best-effort; the app works without them.
  }
}

/** Dev-mode Electron must not register itself for autostart. */
function applyOpenAtLogin(): void {
  try {
    if (app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin });
    }
  } catch {
    // Registry/startup write failed — checkbox state still persists.
  }
}

/** Resolve a runtime asset both in dev (dist/../assets) and packaged app. */
function assetPath(file: string): string {
  return path.join(__dirname, "..", "assets", file);
}

// Full-width transparent strip hugging the taskbar edge of the primary
// display. Overlaying via bounds (not workArea) keeps the pet "on" the
// taskbar; edge detection keeps it correct for top/side taskbars too.
function stripRect(): { x: number; y: number; width: number; height: number } {
  const primary = screen.getPrimaryDisplay();
  return stripBounds(primary.bounds, primary.workArea, PET_H, BOTTOM_MARGIN);
}

function applyAlwaysOnTop(): void {
  if (win && !win.isDestroyed()) {
    win.setAlwaysOnTop(onTop, "screen-saver");
  }
}

function setColorMode(on: boolean): void {
  colorMode = on;
  saveSettings();
  refreshTrayMenu();
  if (on) {
    void sampleBackdrop();
    startSampler();
  } else {
    stopSampler();
  }
  if (win && !win.isDestroyed()) win.webContents.send("set-color-mode", colorMode);
}

function startSampler(): void {
  stopSampler();
  sampler = setInterval(() => void sampleBackdrop(), SAMPLE_EVERY_MS);
}

function stopSampler(): void {
  if (sampler) clearInterval(sampler);
  sampler = null;
}

/**
 * Auto-inversion: sample the real backdrop under every glyph of each pet
 * and send the inverted per-cell ink. Median (not mean) so the pet's own
 * glyphs in the capture don't skew the measurement. The sample box is one
 * character cell — accuracy over smoothness, no neighbor blending.
 */
async function sampleBackdrop(): Promise<void> {
  if (!colorMode || !win || win.isDestroyed()) return;
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: THUMB_W, height: THUMB_H },
    });
    const primaryId = String(screen.getPrimaryDisplay().id);
    const src = sources.find((s) => s.display_id === primaryId) ?? sources[0];
    if (!src) return;
    const thumb = src.thumbnail;
    const { width: tw, height: th } = thumb.getSize();
    if (tw === 0 || th === 0) return;
    const bitmap = thumb.toBitmap(); // BGRA
    const bounds = screen.getPrimaryDisplay().bounds;
    const wb = win.getBounds();
    const inks: CellInk[] = [];
    lastStats.forEach((s, slot) => {
      const { ox, oy, cols, rows, charW, charH } = s;
      if (
        typeof ox !== "number" ||
        typeof oy !== "number" ||
        typeof cols !== "number" ||
        typeof rows !== "number" ||
        typeof charW !== "number" ||
        typeof charH !== "number" ||
        cols <= 0 ||
        rows <= 0 ||
        charW <= 0 ||
        charH <= 0 ||
        cols * rows > MAX_CELLS
      ) {
        return; // no layout yet — wait for the next pushStats
      }
      // Text origin in window coords comes from the renderer (measured CSS),
      // so main never mirrors renderer styles with hardcoded constants.
      const layout = { originX: wb.x + ox, originY: wb.y + oy, charW, charH };
      const colors: string[] = [];
      const shadows: string[] = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const { x: cx, y: cy } = cellCenter(layout, col, row);
          const bg = medianAround(bitmap, tw, th, bounds, cx, cy, charW, charH, SAMPLE_STEP_PX);
          if (!bg) {
            colors.push("rgb(255, 255, 255)");
            shadows.push("rgb(0, 0, 0)");
            continue;
          }
          colors.push(cssRgb(invertRgb(bg)));
          shadows.push(cssRgb(bg));
        }
      }
      inks.push({ slot, w: cols, h: rows, colors, shadows });
    });
    if (inks.length > 0) win.webContents.send("set-ink-color", inks);
  } catch (err) {
    // Capture unavailable (permissions etc.) — keep last colors.
    console.warn("[sampler] backdrop capture failed:", err);
  }
}

/** Median backdrop color in a boxW*boxH square around a screen point. */
function medianAround(
  bitmap: Buffer,
  tw: number,
  th: number,
  bounds: { x: number; y: number; width: number; height: number },
  cx: number,
  cy: number,
  boxW: number,
  boxH: number,
  step: number,
): Rgb | null {
  const samples: Rgb[] = [];
  const halfW = boxW / 2;
  const halfH = boxH / 2;
  for (let sy = cy - halfH; sy <= cy + halfH; sy += step) {
    for (let sx = cx - halfW; sx <= cx + halfW; sx += step) {
      const tx = Math.floor(((sx - bounds.x) / bounds.width) * tw);
      const ty = Math.floor(((sy - bounds.y) / bounds.height) * th);
      if (tx < 0 || ty < 0 || tx >= tw || ty >= th) continue;
      const o = (ty * tw + tx) * 4;
      samples.push({ r: bitmap[o + 2], g: bitmap[o + 1], b: bitmap[o] });
    }
  }
  return medianRgb(samples);
}

function setPack(skins: string[]): void {
  pack = normalizePack(skins);
  saveSettings();
  refreshTrayMenu();
  if (win && !win.isDestroyed()) win.webContents.send("set-pack", pack);
}

function setMuted(m: boolean): void {
  muted = m;
  saveSettings();
  refreshTrayMenu();
  if (win && !win.isDestroyed()) win.webContents.send("set-muted", muted);
}

function setPetScale(scale: number): void {
  if (!PET_SCALES.includes(scale)) return;
  petScale = scale;
  saveSettings();
  refreshTrayMenu();
  if (win && !win.isDestroyed()) win.webContents.send("set-scale", petScale);
}

function sendToRenderer(channel: "pet-action" | "pet-feed"): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel);
}

/** Auto-update via electron-updater (NSIS target only; portable has no updater). */
function setupAutoUpdate(): void {
  if (!app.isPackaged) return;
  try {
    // Lazy require so dev/test without the package still boot.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { autoUpdater } = require("electron-updater") as typeof import("electron-updater");
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on("update-downloaded", () => {
      try {
        const n = new Notification({
          title: "ASCII Pets обновились!",
          body: "Новая версия установится при выходе",
        });
        n.show();
      } catch {
        // Notifications unavailable — silent auto-install on quit still applies.
      }
    });
    // Delayed first check so the pet shows up before any dialog.
    setTimeout(() => void autoUpdater.checkForUpdatesAndNotify?.(), 15_000);
  } catch {
    // electron-updater missing or no publish config — app works without updates.
  }
}

function checkForUpdatesNow(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { autoUpdater } = require("electron-updater") as typeof import("electron-updater");
    void autoUpdater.checkForUpdatesAndNotify?.();
  } catch {
    // No updater (dev/portable) — nothing to check.
  }
}

/** Single menu template for the pet context menu and the tray icon. */
function menuTemplate(): MenuItemConstructorOptions[] {
  return [
    { label: "Погладить", click: () => sendToRenderer("pet-action") },
    { label: "Покормить", click: () => sendToRenderer("pet-feed") },
    {
      label: "Питомец",
      submenu: SKIN_LIST.map(
        (s): MenuItemConstructorOptions => ({
          label: s.name,
          type: "radio",
          checked: pack[0] === s.id,
          click: () => setPack([s.id, ...pack.slice(1)]),
        }),
      ),
    },
    {
      label: "Второй питомец",
      submenu: [
        {
          label: "Нет",
          type: "radio",
          checked: pack.length < 2,
          click: () => setPack([pack[0]]),
        } as MenuItemConstructorOptions,
        ...SKIN_LIST.map(
          (s): MenuItemConstructorOptions => ({
            label: s.name,
            type: "radio",
            checked: pack[1] === s.id,
            click: () => setPack([pack[0], s.id]),
          }),
        ),
      ],
    },
    { type: "separator" },
    {
      label: "Пауза",
      type: "checkbox",
      checked: paused,
      click: (item) => {
        paused = item.checked;
        if (win && !win.isDestroyed()) win.webContents.send("set-paused", paused);
      },
    },
    {
      label: "Поверх всех окон",
      type: "checkbox",
      checked: onTop,
      click: (item) => {
        onTop = item.checked;
        saveSettings();
        applyAlwaysOnTop();
      },
    },
    {
      label: "Авто-инверсия",
      type: "checkbox",
      checked: colorMode,
      click: (item) => setColorMode(item.checked),
    },
    {
      label: "Уведомления о голоде",
      type: "checkbox",
      checked: notifyHungry,
      click: (item) => {
        notifyHungry = item.checked;
        saveSettings();
        refreshTrayMenu();
      },
    },
    {
      label: "Звук",
      type: "checkbox",
      checked: !muted,
      click: (item) => setMuted(!item.checked),
    },
    {
      label: "Размер питомца",
      submenu: PET_SCALES.map(
        (s): MenuItemConstructorOptions => ({
          label: s === 1 ? "Обычный" : `${Math.round(s * 100)}%`,
          type: "radio",
          checked: petScale === s,
          click: () => setPetScale(s),
        }),
      ),
    },
    {
      label: "Запускать с Windows",
      type: "checkbox",
      checked: openAtLogin,
      click: (item) => {
        openAtLogin = item.checked;
        saveSettings();
        applyOpenAtLogin();
      },
    },
    { type: "separator" },
    { label: "Проверить обновления", click: () => checkForUpdatesNow() },
    { label: "Выход", click: () => app.quit() },
  ];
}

function refreshTrayMenu(): void {
  if (tray && !tray.isDestroyed()) tray.setContextMenu(Menu.buildFromTemplate(menuTemplate()));
}

function updateTrayTooltip(): void {
  if (!tray || tray.isDestroyed()) return;
  if (lastStats.length === 0) {
    tray.setToolTip("ASCII Pets");
    return;
  }
  const line = lastStats
    .map((s) => `${s.label}: сыт ${100 - s.hunger}, наст ${s.mood}, эн ${s.energy}`)
    .join(" · ");
  tray.setToolTip(`ASCII Pets — ${line}`);
}

/** Hunger toast: at most one per cooldown, click feeds the whole pack. */
function maybeNotifyHunger(): void {
  if (!notifyHungry || !Notification.isSupported()) return;
  const hungry = lastStats.find((s) => typeof s.hunger === "number" && s.hunger >= HUNGRY_AT);
  if (!shouldNotifyHunger(lastHungerNotify, !!hungry, Date.now())) return;
  lastHungerNotify = Date.now();
  try {
    const n = new Notification({
      title: "ASCII Pets проголодались!",
      body: hungry ? `${hungry.label} хочет есть — клик покормит` : "Покорми питомца",
    });
    n.on("click", () => sendToRenderer("pet-feed"));
    n.show();
  } catch {
    // Notifications unavailable (permissions etc.) — tooltip still updates.
  }
}

function showContextMenu(): void {
  if (!win || win.isDestroyed()) return;
  Menu.buildFromTemplate(menuTemplate()).popup({ window: win });
}

function iconPath(): string | undefined {
  const png = assetPath("icon.png");
  try {
    fs.accessSync(png);
    return png;
  } catch {
    return undefined; // assets not generated yet — default Electron icon
  }
}

function trayIconPath(): string | undefined {
  for (const f of ["icon-16.png", "icon.png"]) {
    const p = assetPath(f);
    try {
      fs.accessSync(p);
      return p;
    } catch {
      continue;
    }
  }
  return undefined;
}

/** Tray = the app's presence in the system (the strip hides from the taskbar). */
function createTray(): void {
  const icon = trayIconPath();
  if (!icon) return;
  tray = new Tray(icon);
  tray.setToolTip("ASCII Pets");
  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate()));
  // Left click opens the menu too — the pet strip is easy to miss.
  tray.on("click", () => {
    if (tray && !tray.isDestroyed()) tray.popUpContextMenu();
  });
}

function createWindow(): void {
  const b = stripRect();

  win = new BrowserWindow({
    ...b,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: true,
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // screen-saver level renders above the taskbar on Windows.
  applyAlwaysOnTop();
  win.setMenu(null);

  // Click-through everywhere; the renderer re-enables mouse events
  // only while hovering the pet. forward:true keeps mousemove flowing
  // to the page so hover can be detected.
  win.setIgnoreMouseEvents(true, { forward: true });

  void win.loadFile(path.join(__dirname, "renderer", "index.html"));

  // Fresh window = startled-then-happy pets.
  win.webContents.on("did-finish-load", () => {
    if (!win || win.isDestroyed()) return;
    win.webContents.send("set-muted", muted);
    win.webContents.send("set-scale", petScale);
    win.webContents.send("pet-greet");
  });

  win.on("closed", () => {
    win = null;
  });
}

function placeWindow(startled: boolean): void {
  if (!win || win.isDestroyed()) return;
  win.setBounds(stripRect());
  if (startled) win.webContents.send("pet-startle");
}

void app.whenReady().then(() => {
  // Required for Windows toast notifications (dev + portable need it explicit).
  try {
    app.setAppUserModelId("com.ascii.pets");
  } catch {
    // Non-Windows or already set — notifications fall back to tooltip.
  }
  // Central activation handler so toast clicks feed even after cold starts.
  try {
    Notification.handleActivation?.(() => sendToRenderer("pet-feed"));
  } catch {
    // Older Electron — per-notification click handler still applies.
  }
  loadSettings();
  applyOpenAtLogin();
  createWindow();
  createTray();
  setupAutoUpdate();
  if (colorMode) startSampler();

  ipcMain.on("set-clickable", (_event, clickable: boolean) => {
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(!clickable, { forward: true });
    }
  });
  ipcMain.on("show-context-menu", () => showContextMenu());
  ipcMain.handle("get-pack", () => pack);
  ipcMain.handle("get-muted", () => muted);
  ipcMain.handle("get-scale", () => petScale);
  ipcMain.on("pet-stats", (_event, snapshot: typeof lastStats) => {
    if (Array.isArray(snapshot)) {
      lastStats = snapshot.filter(
        (s) => s && typeof s.label === "string" && typeof s.hunger === "number",
      );
      updateTrayTooltip();
      maybeNotifyHunger();
    }
  });

  // Pet lives on the primary display; re-hug the taskbar edge whenever
  // displays or their metrics change (resolution, scale, taskbar move).
  // The world shifting under its feet startles the pet a little.
  screen.on("display-metrics-changed", () => placeWindow(true));
  screen.on("display-added", () => placeWindow(true));
  screen.on("display-removed", () => placeWindow(true));

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopSampler();
  if (tray && !tray.isDestroyed()) tray.destroy();
  tray = null;
});
