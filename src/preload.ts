import { contextBridge, ipcRenderer } from "electron";
import type { CellInk } from "./shared/color";
import type { PetSnapshot, SettingsSnapshot, SettingsUpdate, DisplayOption } from "./shared/ipc";

contextBridge.exposeInMainWorld("petAPI", {
  setClickable: (clickable: boolean): void => {
    ipcRenderer.send("set-clickable", clickable);
  },
  showMenu: (): void => {
    ipcRenderer.send("show-context-menu");
  },
  getPack: (): Promise<string[]> => {
    return ipcRenderer.invoke("get-pack");
  },
  onSetInkColor: (cb: (inks: CellInk[]) => void): void => {
    ipcRenderer.on("set-ink-color", (_event, inks) => cb(inks));
  },
  pushStats: (snapshot: PetSnapshot[]): void => {
    ipcRenderer.send("pet-stats", snapshot);
  },
  pushMsg: (text: string): void => {
    ipcRenderer.send("pet-msg", text);
  },
  onPetAction: (cb: () => void): void => {
    ipcRenderer.on("pet-action", () => cb());
  },
  onPetFeed: (cb: () => void): void => {
    ipcRenderer.on("pet-feed", () => cb());
  },
  onPetCleanPoop: (cb: () => void): void => {
    ipcRenderer.on("pet-clean-poop", () => cb());
  },
  onPetGreet: (cb: () => void): void => {
    ipcRenderer.on("pet-greet", () => cb());
  },
  onPetStartle: (cb: () => void): void => {
    ipcRenderer.on("pet-startle", () => cb());
  },
  onSetPack: (cb: (skins: string[]) => void): void => {
    ipcRenderer.on("set-pack", (_event, skins: string[]) => cb(skins));
  },
  getStyle: (): Promise<string> => {
    return ipcRenderer.invoke("get-style");
  },
  onSetStyle: (cb: (style: string) => void): void => {
    ipcRenderer.on("set-style", (_event, style: string) => cb(style));
  },
  onSetColorMode: (cb: (on: boolean) => void): void => {
    ipcRenderer.on("set-color-mode", (_event, on: boolean) => cb(on));
  },
  onSetPaused: (cb: (value: boolean) => void): void => {
    ipcRenderer.on("set-paused", (_event, value: boolean) => cb(value));
  },
  getMuted: (): Promise<boolean> => {
    return ipcRenderer.invoke("get-muted");
  },
  onSetMuted: (cb: (muted: boolean) => void): void => {
    ipcRenderer.on("set-muted", (_event, muted: boolean) => cb(muted));
  },
  getScale: (): Promise<number> => {
    return ipcRenderer.invoke("get-scale");
  },
  onSetScale: (cb: (scale: number) => void): void => {
    ipcRenderer.on("set-scale", (_event, scale: number) => cb(scale));
  },
  onStatusUpdate: (cb: (snapshots: PetSnapshot[]) => void): void => {
    ipcRenderer.on("status-update", (_event, snapshots: PetSnapshot[]) => cb(snapshots));
  },
  onStatusMsg: (cb: (text: string) => void): void => {
    ipcRenderer.on("status-msg", (_event, text: string) => cb(text));
  },
  hideStatus: (): void => {
    ipcRenderer.send("status-hide");
  },
  patAll: (): void => {
    ipcRenderer.send("status-pat");
  },
  feedAll: (): void => {
    ipcRenderer.send("status-feed");
  },
  cleanAllPoop: (): void => {
    ipcRenderer.send("status-clean-poop");
  },
  openSettings: (): void => {
    ipcRenderer.send("open-settings");
  },
  getSettings: (): Promise<SettingsSnapshot> => {
    return ipcRenderer.invoke("get-settings");
  },
  setSettings: (update: SettingsUpdate): void => {
    ipcRenderer.send("set-settings", update);
  },
  onSettingsUpdate: (cb: (snapshot: SettingsSnapshot) => void): void => {
    ipcRenderer.on("settings-updated", (_event, snapshot: SettingsSnapshot) => cb(snapshot));
  },
  closeSettings: (): void => {
    ipcRenderer.send("settings-hide");
  },
  checkForUpdates: (): void => {
    ipcRenderer.send("check-for-updates");
  },
  reportSettingsSize: (height: number): void => {
    ipcRenderer.send("settings-resize", height);
  },
  reportStatusSize: (height: number): void => {
    ipcRenderer.send("status-resize", height);
  },
  getDisplays: (): Promise<DisplayOption[]> => {
    return ipcRenderer.invoke("get-displays");
  },
  onDisplaysUpdate: (cb: (displays: DisplayOption[]) => void): void => {
    ipcRenderer.on("displays-updated", (_event, displays: DisplayOption[]) => cb(displays));
  },
});
