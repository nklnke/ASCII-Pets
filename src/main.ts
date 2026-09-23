import { app, BrowserWindow, Menu, MenuItemConstructorOptions, Tray, Notification, desktopCapturer, ipcMain, screen } from "electron";
import type { Display } from "electron";
import * as fs from "fs";
import * as path from "path";
import { cssRgb, invertRgb, medianRgb, cellCenter, Rgb, CellInk } from "./shared/color";
import type { PetSnapshot, SettingsSnapshot, SettingsUpdate, DisplayOption } from "./shared/ipc";
import { HUNGRY_AT } from "./shared/pet-stats";
import { shouldNotifyHunger } from "./shared/notify";
import { stripBounds, displayLabel, pickDisplayId } from "./shared/placement";
import { normalizePack, normalizeStyle, DEFAULT_STYLE } from "./shared/skins";

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
/** Display for the pet strip: explicit monitor id, or null = follow primary. */
let displayId: number | null = null;
/** Drawing style for the whole pack (ASCII1 classic / ASCII2 blocks). */
let style: string = DEFAULT_STYLE;
/** Floating status window (free placement, hideable). Owned by main. */
let statusWin: BrowserWindow | null = null;
let showStatus = true;
let statusPos: { x: number; y: number } | null = null;
/** Settings window (frameless card, opened from the menu or status ⚙). */
let settingsWin: BrowserWindow | null = null;
/** Latest toast line from the strip (mirrored into the status window). */
let lastMsg = "";
/** Latest snapshot pushed by the renderer (for the tray tooltip + sampler). */
let lastStats: PetSnapshot[] = [];
let sampler: NodeJS.Timeout | null = null;

const PET_H = 200;
const SAMPLE_BASE_MS = 2000;
const SAMPLE_MAX_MS = 5000;
/** A sample slower than this backs the interval off (HDR/144Hz/HiDPI machines). */
const SAMPLE_SLOW_MS = 300;
/** Screen capture size for the sampler (smaller = cheaper JS medians). */
const THUMB_W = 640;
const THUMB_H = 360;
const SAMPLE_STEP_PX = 4;
/** Upper bound for a single frame grid (frames are ~11x5). */
const MAX_CELLS = 400;

interface AppSettings {
  onTop?: boolean;
  openAtLogin?: boolean;
  pack?: string[];
  style?: string;
  colorMode?: boolean;
  notifyHungry?: boolean;
  muted?: boolean;
  petScale?: number;
  showStatus?: boolean;
  statusPos?: { x?: number; y?: number };
  displayId?: number | null;
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
  if (typeof s.showStatus === "boolean") showStatus = s.showStatus;
  if (
    s.statusPos &&
    typeof s.statusPos.x === "number" &&
    typeof s.statusPos.y === "number" &&
    isFinite(s.statusPos.x) &&
    isFinite(s.statusPos.y)
  ) {
    statusPos = { x: Math.round(s.statusPos.x), y: Math.round(s.statusPos.y) };
  }
  if (s.pack !== undefined) pack = normalizePack(s.pack);
  if (s.style !== undefined) style = normalizeStyle(s.style);
  if (s.displayId === null || typeof s.displayId === "number") displayId = s.displayId;
}

function saveSettings(): void {
  try {
    fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
    fs.writeFileSync(
      settingsPath(),
      JSON.stringify({ onTop, openAtLogin, pack, style, colorMode, notifyHungry, muted, petScale, showStatus, statusPos, displayId }),
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

// Full-width transparent strip glued to the taskbar edge of the SELECTED
// display (settings window picks it; null follows the primary display).
// The window bottom sits flush with the work-area bottom (= the
// taskbar's top edge), so the pet floor is exactly on it and every jump
// starts from it; edge detection keeps it correct for top/side taskbars too.
function selectedDisplay(): Display {
  const all = screen.getAllDisplays();
  return all.find((d) => d.id === displayId) ?? screen.getPrimaryDisplay();
}

/** Rows for the monitor picker in the settings window. */
function displayList(): DisplayOption[] {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: displayLabel(i, d.bounds.width, d.bounds.height, d.id === primaryId),
    primary: d.id === primaryId,
    width: d.bounds.width,
    height: d.bounds.height,
  }));
}

function broadcastDisplays(): void {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.webContents.send("displays-updated", displayList());
  }
}

/** Drop a stored id that no longer exists (unplugged monitor) -> follow primary. */
function pruneDisplay(): void {
  const resolved = pickDisplayId(
    screen.getAllDisplays().map((d) => d.id),
    displayId,
  );
  if (resolved !== displayId) {
    displayId = resolved;
    saveSettings();
    broadcastSettings();
  }
}

function stripRect(): { x: number; y: number; width: number; height: number } {
  const d = selectedDisplay();
  return stripBounds(d.bounds, d.workArea, PET_H);
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
  broadcastSettings();
  if (on) {
    void sampleBackdrop();
    startSampler();
  } else {
    stopSampler();
  }
  if (win && !win.isDestroyed()) win.webContents.send("set-color-mode", colorMode);
}

/** Current sampler interval (auto-degraded, reset when fast again). */
let sampleEveryMs = SAMPLE_BASE_MS;
/** Layout signature of the last sampled frame + tick counter. */
let lastSampleKey = "";
let sampleTick = 0;

function startSampler(): void {
  stopSampler();
  void sampleLoop();
}

function stopSampler(): void {
  if (sampler) clearTimeout(sampler);
  sampler = null;
}

/** Self-scheduling loop: measures every sample and backs off on slow frames
 *  (multi-monitor/HDR/high-Hz captures can cost hundreds of ms each). */
async function sampleLoop(): Promise<void> {
  if (!colorMode) {
    sampler = null;
    return;
  }
  const t0 = Date.now();
  await sampleBackdrop();
  const dt = Date.now() - t0;
  if (dt > SAMPLE_SLOW_MS) {
    sampleEveryMs = Math.min(SAMPLE_MAX_MS, sampleEveryMs * 2);
    console.warn(`[sampler] slow frame: ${dt}ms, backing off to ${sampleEveryMs}ms`);
  } else if (dt < 100) {
    sampleEveryMs = SAMPLE_BASE_MS;
  }
  sampler = setTimeout(() => void sampleLoop(), sampleEveryMs);
}

/**
 * Auto-inversion: sample the real backdrop under every glyph of each pet
 * and send the inverted per-cell ink. Median (not mean) so the pet's own
 * glyphs in the capture don't skew the measurement. The sample box is one
 * character cell — accuracy over smoothness, no neighbor blending.
 */
async function sampleBackdrop(): Promise<void> {
  if (!colorMode || paused || !win || win.isDestroyed() || lastStats.length === 0) return;
  // Static frame: pets didn't move since the last sample — skip the capture
  // (the expensive part on multi-monitor/HDR/high-Hz setups). Every 5th tick
  // still resamples so a changed backdrop behind idle pets catches up.
  sampleTick += 1;
  const key = lastStats.map((s) => [s.ox, s.oy, s.cols, s.rows, s.charW, s.charH].join(",")).join("|");
  if (key.length > 0 && key === lastSampleKey && sampleTick % 5 !== 0) return;
  lastSampleKey = key;
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: THUMB_W, height: THUMB_H },
    });
    const sel = selectedDisplay();
    const selId = String(sel.id);
    const src = sources.find((s) => s.display_id === selId) ?? sources[0];
    if (!src) return;
    const thumb = src.thumbnail;
    const { width: tw, height: th } = thumb.getSize();
    if (tw === 0 || th === 0) return;
    const bitmap = thumb.toBitmap(); // BGRA
    const bounds = sel.bounds;
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
  broadcastSettings();
  if (win && !win.isDestroyed()) win.webContents.send("set-pack", pack);
}

function setStyle(next: string): void {
  style = normalizeStyle(next);
  saveSettings();
  refreshTrayMenu();
  broadcastSettings();
  if (win && !win.isDestroyed()) win.webContents.send("set-style", style);
}

function setMuted(m: boolean): void {
  muted = m;
  saveSettings();
  refreshTrayMenu();
  broadcastSettings();
  if (win && !win.isDestroyed()) win.webContents.send("set-muted", muted);
}

function setPetScale(scale: number): void {
  if (!PET_SCALES.includes(scale)) return;
  petScale = scale;
  saveSettings();
  refreshTrayMenu();
  broadcastSettings();
  if (win && !win.isDestroyed()) win.webContents.send("set-scale", petScale);
}

/** Pause toggle shared by the tray menu and the settings window. */
function setPaused(v: boolean): void {
  paused = v;
  refreshTrayMenu();
  broadcastSettings();
  if (win && !win.isDestroyed()) win.webContents.send("set-paused", paused);
}

/** Current settings as a snapshot for the settings window. */
function settingsSnapshot(): SettingsSnapshot {
  return {
    pack: [...pack],
    style,
    paused,
    onTop,
    showStatus,
    colorMode,
    notifyHungry,
    muted,
    petScale,
    openAtLogin,
    displayId,
  };
}

/** Push the snapshot into the open settings window (no-op when closed). */
function broadcastSettings(): void {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.webContents.send("settings-updated", settingsSnapshot());
  }
}

/** Apply a partial update from the settings window (each field validated). */
function applySettings(update: SettingsUpdate): void {
  if (!update || typeof update !== "object") return;
  if (update.pack !== undefined) setPack(update.pack);
  if (update.style !== undefined) setStyle(update.style);
  if (typeof update.paused === "boolean") setPaused(update.paused);
  if (typeof update.onTop === "boolean" && update.onTop !== onTop) {
    onTop = update.onTop;
    saveSettings();
    applyAlwaysOnTop();
    refreshTrayMenu();
    broadcastSettings();
  }
  if (typeof update.showStatus === "boolean" && update.showStatus !== showStatus) {
    setShowStatus(update.showStatus);
  }
  if (typeof update.colorMode === "boolean" && update.colorMode !== colorMode) {
    setColorMode(update.colorMode);
  }
  if (typeof update.notifyHungry === "boolean" && update.notifyHungry !== notifyHungry) {
    notifyHungry = update.notifyHungry;
    saveSettings();
    refreshTrayMenu();
    broadcastSettings();
  }
  if (typeof update.muted === "boolean" && update.muted !== muted) setMuted(update.muted);
  if (typeof update.petScale === "number") setPetScale(update.petScale);
  if (typeof update.openAtLogin === "boolean" && update.openAtLogin !== openAtLogin) {
    openAtLogin = update.openAtLogin;
    saveSettings();
    applyOpenAtLogin();
    refreshTrayMenu();
    broadcastSettings();
  }
  if (update.displayId !== undefined && update.displayId !== displayId) {
    // Unknown ids (e.g. unplugged since the form was opened) fall back to primary.
    displayId = pickDisplayId(
      screen.getAllDisplays().map((d) => d.id),
      update.displayId,
    );
    saveSettings();
    placeWindow(true);
    refreshTrayMenu();
    broadcastSettings();
    broadcastDisplays();
  }
}

function sendToRenderer(channel: "pet-action" | "pet-feed" | "pet-clean-poop"): void {
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

/** Context/tray menu: actions + pause + settings entry (the rest lives in the settings window). */
function menuTemplate(): MenuItemConstructorOptions[] {
  return [
    { label: "Погладить", click: () => sendToRenderer("pet-action") },
    { label: "Покормить", click: () => sendToRenderer("pet-feed") },
    {
      label: "Пауза",
      type: "checkbox",
      checked: paused,
      click: (item) => setPaused(item.checked),
    },
    { type: "separator" },
    { label: "Настройки…", click: () => openSettings() },
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
    .map(
      (s) =>
        `${s.label}: сыт ${Math.round(100 - s.hunger)}, наст ${Math.round(s.mood)}, эн ${Math.round(s.energy)}${s.dirty ? " · грязно!" : ""}`,
    )
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
    backgroundColor: "#00000000",
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

const STATUS_W = 300;
const STATUS_H = 260;

/** First-launch spot: bottom-right, just above the pet strip (selected display). */
function defaultStatusPos(): { x: number; y: number } {
  const wa = selectedDisplay().workArea;
  return {
    x: Math.round(wa.x + wa.width - STATUS_W - 12),
    y: Math.round(wa.y + wa.height - STATUS_H - PET_H - 24),
  };
}

/** Clamp into the selected display's work area (survives monitor changes); keep a grab handle visible. */
function clampStatusPos(p: { x: number; y: number }): { x: number; y: number } {
  const wa = selectedDisplay().workArea;
  return {
    x: Math.min(Math.max(p.x, wa.x - STATUS_W + 80), wa.x + wa.width - 80),
    y: Math.min(Math.max(p.y, wa.y), wa.y + wa.height - 40),
  };
}

/** Free-floating status card: bars, counters, last toast, close button.
 *  Unlike the strip it is a normal interactive window (no click-through). */
function createStatusWindow(): void {
  const pos = clampStatusPos(statusPos ?? defaultStatusPos());
  statusWin = new BrowserWindow({
    x: pos.x,
    y: pos.y,
    width: STATUS_W,
    height: STATUS_H,
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    resizable: false,
    movable: true,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  statusWin.setAlwaysOnTop(true, "screen-saver");
  statusWin.setMenu(null);
  void statusWin.loadFile(path.join(__dirname, "renderer", "status.html"));
  statusWin.webContents.on("did-finish-load", () => {
    if (!statusWin || statusWin.isDestroyed()) return;
    statusWin.webContents.send("status-update", lastStats);
    if (lastMsg) statusWin.webContents.send("status-msg", lastMsg);
  });
  // Free position persists (debounced — `move` fires continuously on Windows).
  let saveTimer: NodeJS.Timeout | null = null;
  statusWin.on("move", () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (!statusWin || statusWin.isDestroyed()) return;
      const [x, y] = statusWin.getPosition();
      statusPos = { x, y };
      saveSettings();
    }, 500);
  });
  statusWin.on("closed", () => {
    statusWin = null;
  });
}

function setShowStatus(v: boolean): void {
  showStatus = v;
  saveSettings();
  refreshTrayMenu();
  broadcastSettings();
  if (v) {
    if (!statusWin || statusWin.isDestroyed()) createStatusWindow();
    else statusWin.show();
  } else if (statusWin && !statusWin.isDestroyed()) {
    statusWin.hide();
  }
}

/** Fit the status window to the reported card height (1–3 pets). */
function fitStatusWindow(cardH: number): void {
  if (!statusWin || statusWin.isDestroyed()) return;
  if (typeof cardH !== "number" || !isFinite(cardH)) return;
  const wa = selectedDisplay().workArea;
  const h = Math.min(Math.max(Math.round(cardH), 120), Math.max(200, wa.height - 40));
  statusWin.setContentSize(STATUS_W, h);
  // The window grows downward — pull it up if it spills off-screen.
  const [x, y] = statusWin.getPosition();
  const maxBottom = wa.y + wa.height - 8;
  if (y + h > maxBottom) statusWin.setPosition(x, Math.max(wa.y, maxBottom - h));
}

const SETTINGS_W = 360;
const SETTINGS_H = 600;

/** Settings window: frameless card, centered on the primary work area.
 *  Created hidden — settings.ts reports the real card height and main
 *  shrink-wraps the window before showing it (no transparent dead zone). */
function createSettingsWindow(): void {
  const wa = screen.getPrimaryDisplay().workArea;
  settingsWin = new BrowserWindow({
    x: Math.round(wa.x + (wa.width - SETTINGS_W) / 2),
    y: Math.round(wa.y + (wa.height - SETTINGS_H) / 2),
    width: SETTINGS_W,
    height: SETTINGS_H,
    show: false,
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    resizable: false,
    movable: true,
    focusable: true,
    skipTaskbar: true,
    hasShadow: false,
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWin.setAlwaysOnTop(true, "screen-saver");
  settingsWin.setMenu(null);
  void settingsWin.loadFile(path.join(__dirname, "renderer", "settings.html"));
  settingsWin.webContents.on("did-finish-load", () => {
    if (!settingsWin || settingsWin.isDestroyed()) return;
    settingsWin.webContents.send("settings-updated", settingsSnapshot());
    settingsWin.webContents.send("displays-updated", displayList());
    // Fallback: never leave the window invisible if the resize report is lost.
    setTimeout(() => {
      if (settingsWin && !settingsWin.isDestroyed() && !settingsWin.isVisible()) {
        settingsWin.show();
      }
    }, 800);
  });
  settingsWin.on("closed", () => {
    settingsWin = null;
  });
}

/** Shrink-wrap the settings window to the reported card height. */
function fitSettingsWindow(cardH: number): void {
  if (!settingsWin || settingsWin.isDestroyed()) return;
  if (typeof cardH !== "number" || !isFinite(cardH)) return;
  const wa = screen.getPrimaryDisplay().workArea;
  const h = Math.min(Math.max(Math.round(cardH), 200), Math.max(200, wa.height - 40));
  settingsWin.setContentSize(SETTINGS_W, h);
  // Keep the whole window on screen after shrinking.
  const [x, y] = settingsWin.getPosition();
  const bottom = y + h;
  const maxBottom = wa.y + wa.height - 8;
  if (bottom > maxBottom) settingsWin.setPosition(x, Math.max(wa.y, maxBottom - h));
  if (!settingsWin.isVisible()) settingsWin.show();
}

/** Show the settings window (single instance, refreshed on every open). */
function openSettings(): void {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    settingsWin.webContents.send("settings-updated", settingsSnapshot());
    settingsWin.webContents.send("displays-updated", displayList());
  } else {
    createSettingsWindow();
  }
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
  if (showStatus) createStatusWindow();
  setupAutoUpdate();
  if (colorMode) startSampler();

  ipcMain.on("set-clickable", (_event, clickable: boolean) => {
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(!clickable, { forward: true });
    }
  });
  ipcMain.on("show-context-menu", () => showContextMenu());
  ipcMain.handle("get-pack", () => pack);
  ipcMain.handle("get-style", () => style);
  ipcMain.handle("get-muted", () => muted);
  ipcMain.handle("get-scale", () => petScale);
  ipcMain.on("pet-stats", (_event, snapshot: typeof lastStats) => {
    if (Array.isArray(snapshot)) {
      lastStats = snapshot.filter(
        (s) => s && typeof s.label === "string" && typeof s.hunger === "number",
      );
      updateTrayTooltip();
      maybeNotifyHunger();
      if (statusWin && !statusWin.isDestroyed()) statusWin.webContents.send("status-update", lastStats);
    }
  });
  // Toast relay: the strip forwards showMsg lines, main mirrors them to status.
  ipcMain.on("pet-msg", (_event, text: unknown) => {
    if (typeof text !== "string" || text.length === 0) return;
    lastMsg = text;
    if (statusWin && !statusWin.isDestroyed()) statusWin.webContents.send("status-msg", text);
  });
  ipcMain.on("status-hide", () => setShowStatus(false));
  ipcMain.on("status-resize", (_event, height: unknown) => {
    if (typeof height === "number") fitStatusWindow(height);
  });
  // Status window action buttons: same broadcast as the tray menu (whole pack).
  ipcMain.on("status-pat", () => sendToRenderer("pet-action"));
  ipcMain.on("status-feed", () => sendToRenderer("pet-feed"));
  ipcMain.on("status-clean-poop", () => sendToRenderer("pet-clean-poop"));
  // Settings window (opened from the menu or the status ⚙ button).
  ipcMain.on("open-settings", () => openSettings());
  ipcMain.on("settings-hide", () => {
    if (settingsWin && !settingsWin.isDestroyed()) settingsWin.hide();
  });
  ipcMain.handle("get-settings", () => settingsSnapshot());
  ipcMain.handle("get-displays", () => displayList());
  ipcMain.on("set-settings", (_event, update: SettingsUpdate) => applySettings(update));
  ipcMain.on("settings-resize", (_event, height: unknown) => {
    if (typeof height === "number") fitSettingsWindow(height);
  });
  ipcMain.on("check-for-updates", () => checkForUpdatesNow());

  // Pet lives on the selected display; re-hug the taskbar edge whenever
  // displays or their metrics change (resolution, scale, taskbar move,
  // monitor plugged/unplugged). A stored monitor that is gone falls back
  // to primary and the picker list refreshes.
  // The world shifting under its feet startles the pet a little.
  // display-metrics-changed fires in bursts — regroup so it startles once.
  let metricsTimer: NodeJS.Timeout | null = null;
  const onDisplayChanged = (): void => {
    if (metricsTimer) clearTimeout(metricsTimer);
    metricsTimer = setTimeout(() => {
      metricsTimer = null;
      pruneDisplay();
      placeWindow(true);
      broadcastDisplays();
    }, 500);
  };
  screen.on("display-metrics-changed", onDisplayChanged);
  screen.on("display-added", onDisplayChanged);
  screen.on("display-removed", onDisplayChanged);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopSampler();
  if (statusWin && !statusWin.isDestroyed()) statusWin.destroy();
  statusWin = null;
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.destroy();
  settingsWin = null;
  if (tray && !tray.isDestroyed()) tray.destroy();
  tray = null;
});
