// Shared renderer-side typing for window.petAPI (strip + status windows).
// Implemented in src/preload.ts; both renderer entries import this type
// so the two global Window declarations never diverge.

import type { CellInk } from "../shared/color";
import type { PetSnapshot, SettingsSnapshot, SettingsUpdate, DisplayOption } from "../shared/ipc";

export interface PetApi {
  setClickable: (clickable: boolean) => void;
  showMenu: () => void;
  getPack: () => Promise<string[]>;
  pushStats: (snapshot: PetSnapshot[]) => void;
  /** Forward a toast line to main (relayed to the status window). */
  pushMsg: (text: string) => void;
  onPetAction: (cb: () => void) => void;
  onPetFeed: (cb: () => void) => void;
  onPetCleanPoop: (cb: () => void) => void;
  onPetGreet: (cb: () => void) => void;
  onPetStartle: (cb: () => void) => void;
  onSetPack: (cb: (skins: string[]) => void) => void;
  getStyle: () => Promise<string>;
  onSetStyle: (cb: (style: string) => void) => void;
  onSetColorMode: (cb: (on: boolean) => void) => void;
  onSetInkColor: (cb: (inks: CellInk[]) => void) => void;
  onSetPaused: (cb: (value: boolean) => void) => void;
  getMuted: () => Promise<boolean>;
  onSetMuted: (cb: (muted: boolean) => void) => void;
  getScale: () => Promise<number>;
  onSetScale: (cb: (scale: number) => void) => void;
  /** Status window: live snapshots + toast lines relayed by main. */
  onStatusUpdate: (cb: (snapshots: PetSnapshot[]) => void) => void;
  onStatusMsg: (cb: (text: string) => void) => void;
  /** Status window close button: ask main to hide the window. */
  hideStatus: () => void;
  /** Status window action buttons: pat/feed/clean the whole pack (like the tray menu). */
  patAll: () => void;
  feedAll: () => void;
  cleanAllPoop: () => void;
  /** Settings window: open it, read/apply settings, live sync, close, updates. */
  openSettings: () => void;
  getSettings: () => Promise<SettingsSnapshot>;
  setSettings: (update: SettingsUpdate) => void;
  onSettingsUpdate: (cb: (snapshot: SettingsSnapshot) => void) => void;
  closeSettings: () => void;
  checkForUpdates: () => void;
  /** Settings window: report the card height so main can shrink-wrap the window. */
  reportSettingsSize: (height: number) => void;
  /** Monitor picker: dynamic display list. */
  getDisplays: () => Promise<DisplayOption[]>;
  onDisplaysUpdate: (cb: (displays: DisplayOption[]) => void) => void;
}

declare global {
  interface Window {
    petAPI?: PetApi;
  }
}
