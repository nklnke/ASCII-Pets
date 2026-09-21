import { contextBridge, ipcRenderer } from "electron";
import type { CellInk } from "./shared/color";
import type { PetSnapshot } from "./shared/ipc";

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
  onPetAction: (cb: () => void): void => {
    ipcRenderer.on("pet-action", () => cb());
  },
  onPetFeed: (cb: () => void): void => {
    ipcRenderer.on("pet-feed", () => cb());
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
});
