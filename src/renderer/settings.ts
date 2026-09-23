// Settings window: standalone entry (bundled to settings.js).
// All state is owned by main; this form only mirrors it via
// getSettings/setSettings and live settings-updated broadcasts.

import { SKIN_LIST, STYLE_LIST } from "../shared/skins";
import type { DisplayOption, SettingsSnapshot } from "../shared/ipc";
import "./pet-api";

const PET_SCALES = [0.85, 1, 1.3, 1.6];

function scaleLabel(s: number): string {
  return s === 1 ? "Обычный" : `${Math.round(s * 100)}%`;
}

const pet0El = document.getElementById("pet0") as HTMLSelectElement;
const pet1El = document.getElementById("pet1") as HTMLSelectElement;
const pet2El = document.getElementById("pet2") as HTMLSelectElement;
const styleEl = document.getElementById("style") as HTMLSelectElement;
const displayEl = document.getElementById("display") as HTMLSelectElement;
const scalesEl = document.getElementById("scales") as HTMLSpanElement;
const cPaused = document.getElementById("c-paused") as HTMLInputElement;
const cOntop = document.getElementById("c-ontop") as HTMLInputElement;
const cStatus = document.getElementById("c-status") as HTMLInputElement;
const cColor = document.getElementById("c-color") as HTMLInputElement;
const cNotify = document.getElementById("c-notify") as HTMLInputElement;
const cSound = document.getElementById("c-sound") as HTMLInputElement;
const cLogin = document.getElementById("c-login") as HTMLInputElement;

/** Last snapshot from main (drives dependent controls like the pack pair). */
let current: SettingsSnapshot | null = null;

function fillSelect(el: HTMLSelectElement, options: Array<{ value: string; label: string }>): void {
  el.textContent = "";
  for (const o of options) {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    el.appendChild(opt);
  }
}

fillSelect(pet0El, SKIN_LIST.map((s) => ({ value: s.id, label: s.name })));
fillSelect(pet1El, [{ value: "", label: "Нет" }, ...SKIN_LIST.map((s) => ({ value: s.id, label: s.name }))]);
fillSelect(pet2El, [{ value: "", label: "Нет" }, ...SKIN_LIST.map((s) => ({ value: s.id, label: s.name }))]);
fillSelect(styleEl, STYLE_LIST.map((s) => ({ value: s.id, label: s.name })));

const scaleLabels: HTMLLabelElement[] = [];
for (const s of PET_SCALES) {
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.type = "radio";
  input.name = "scale";
  input.value = String(s);
  input.addEventListener("change", () => {
    if (input.checked) window.petAPI?.setSettings({ petScale: s });
  });
  label.appendChild(input);
  label.appendChild(document.createTextNode(scaleLabel(s)));
  scalesEl.appendChild(label);
  scaleLabels.push(label);
}

/** Mirror a main snapshot into the form (programmatic sets fire no events). */
function applyToForm(s: SettingsSnapshot): void {
  current = s;
  if (Array.isArray(s.pack) && s.pack[0]) pet0El.value = s.pack[0];
  pet1El.value = Array.isArray(s.pack) && s.pack[1] ? s.pack[1] : "";
  pet2El.value = Array.isArray(s.pack) && s.pack[2] ? s.pack[2] : "";
  styleEl.value = s.style;
  applyDisplayId(s.displayId);
  scaleLabels.forEach((label, i) => {
    const input = label.querySelector("input");
    const on = PET_SCALES[i] === s.petScale;
    label.classList.toggle("on", on);
    if (input) input.checked = on;
  });
  cPaused.checked = !!s.paused;
  cOntop.checked = !!s.onTop;
  cStatus.checked = !!s.showStatus;
  cColor.checked = !!s.colorMode;
  cNotify.checked = !!s.notifyHungry;
  cSound.checked = !s.muted;
  cLogin.checked = !!s.openAtLogin;
}

pet0El.addEventListener("change", () => {
  window.petAPI?.setSettings({ pack: [pet0El.value, ...(current?.pack ?? []).slice(1)] });
});
pet1El.addEventListener("change", () => {
  const cur = current?.pack ?? ["cat"];
  const next = [cur[0] ?? "cat"];
  if (pet1El.value) next.push(pet1El.value);
  if (cur[2]) next.push(cur[2]);
  window.petAPI?.setSettings({ pack: next });
});
pet2El.addEventListener("change", () => {
  const cur = current?.pack ?? ["cat"];
  const next = [cur[0] ?? "cat"];
  if (cur[1]) next.push(cur[1]);
  if (pet2El.value) next.push(pet2El.value);
  window.petAPI?.setSettings({ pack: next });
});
styleEl.addEventListener("change", () => {
  window.petAPI?.setSettings({ style: styleEl.value });
});
cPaused.addEventListener("change", () => window.petAPI?.setSettings({ paused: cPaused.checked }));
cOntop.addEventListener("change", () => window.petAPI?.setSettings({ onTop: cOntop.checked }));
cStatus.addEventListener("change", () => window.petAPI?.setSettings({ showStatus: cStatus.checked }));
cColor.addEventListener("change", () => window.petAPI?.setSettings({ colorMode: cColor.checked }));
cNotify.addEventListener("change", () => window.petAPI?.setSettings({ notifyHungry: cNotify.checked }));
cSound.addEventListener("change", () => window.petAPI?.setSettings({ muted: !cSound.checked }));
cLogin.addEventListener("change", () => window.petAPI?.setSettings({ openAtLogin: cLogin.checked }));
document.getElementById("close")?.addEventListener("click", () => window.petAPI?.closeSettings());
document.getElementById("updates")?.addEventListener("click", () => window.petAPI?.checkForUpdates());

window.petAPI?.onSettingsUpdate((s) => applyToForm(s));
void window.petAPI?.getSettings?.().then((s) => {
  applyToForm(s);
  reportSize();
});
void window.petAPI?.getDisplays?.().then((d) => applyDisplays(d));
window.petAPI?.onDisplaysUpdate((d) => applyDisplays(d));

/** Rebuild the monitor picker; "" = follow the primary display. */
function applyDisplays(displays: DisplayOption[]): void {
  const prev = displayEl.value;
  fillSelect(displayEl, [
    { value: "", label: "Основной (авто)" },
    ...(Array.isArray(displays) ? displays : []).map((d) => ({ value: String(d.id), label: d.label })),
  ]);
  // Keep the selection: fresh snapshot value wins, else the previous choice.
  const want =
    current && (current.displayId === null || displays.some((d) => d.id === current?.displayId))
      ? String(current.displayId ?? "")
      : prev;
  displayEl.value = want;
  applyDisplayId(current?.displayId ?? null);
}

function applyDisplayId(id: number | null): void {
  displayEl.value = id === null || id === undefined ? "" : String(id);
}

displayEl.addEventListener("change", () => {
  window.petAPI?.setSettings({ displayId: displayEl.value === "" ? null : Number(displayEl.value) });
});

/** Tell main the real card height so it can shrink-wrap the window. */
function reportSize(): void {
  const card = document.getElementById("card");
  if (!card) return;
  window.petAPI?.reportSettingsSize(card.offsetHeight);
}
requestAnimationFrame(() => reportSize());
try {
  void document.fonts?.ready.then(() => reportSize());
} catch {
  // Font API unavailable — the rAF report above still applies.
}
