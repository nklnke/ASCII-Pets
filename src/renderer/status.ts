// Floating status window: pretty per-pet cards with bars + counters.
// Standalone entry (bundled to status.js). No Node, no localStorage —
// all data is pushed by main (relayed from the strip renderer).

import { HUNGRY_AT, SLEEPY_AT } from "../shared/pet-stats";
import type { PetSnapshot } from "../shared/ipc";
import "./pet-api";

const petsEl = document.getElementById("pets") as HTMLDivElement;
const msgEl = document.getElementById("msg") as HTMLDivElement;

function barColor(v: number): string {
  if (v > 60) return "#7dd87d";
  if (v > 30) return "#ffd97a";
  return "#ff7a7a";
}

function clampBar(v: number): number {
  if (typeof v !== "number" || !isFinite(v)) return 0;
  return Math.min(100, Math.max(0, Math.round(v)));
}

function addBar(parent: HTMLElement, label: string, value: number): void {
  const row = document.createElement("div");
  row.className = "bar";
  const bl = document.createElement("span");
  bl.className = "blabel";
  bl.textContent = label;
  const track = document.createElement("div");
  track.className = "btrack";
  const fill = document.createElement("div");
  fill.className = "bfill";
  fill.style.width = `${value}%`;
  fill.style.background = barColor(value);
  track.appendChild(fill);
  const bv = document.createElement("span");
  bv.className = "bval";
  bv.textContent = String(value);
  row.appendChild(bl);
  row.appendChild(track);
  row.appendChild(bv);
  parent.appendChild(row);
}

function render(snapshots: PetSnapshot[]): void {
  petsEl.textContent = "";
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    const empty = document.createElement("div");
    empty.className = "counters";
    empty.textContent = "нет питомцев…";
    petsEl.appendChild(empty);
    return;
  }
  for (const s of snapshots) {
    const box = document.createElement("div");
    box.className = "pet";
    const name = document.createElement("div");
    name.className = "pname";
    name.textContent = s.label;
    const flags = document.createElement("span");
    flags.className = "flags";
    const marks: string[] = [];
    if (s.hunger >= HUNGRY_AT) marks.push("хочет есть!");
    if (s.energy <= SLEEPY_AT) marks.push("спит…");
    if (s.dirty) marks.push("грязно!");
    if (marks.length > 0) flags.textContent = ` · ${marks.join(" ")}`;
    name.appendChild(flags);
    box.appendChild(name);
    addBar(box, "Сыт", clampBar(100 - s.hunger));
    addBar(box, "Настр", clampBar(s.mood));
    addBar(box, "Энерг", clampBar(s.energy));
    const counters = document.createElement("div");
    counters.className = "counters";
    counters.textContent = `гладили ${s.pets ?? 0} · кормили ${s.meals ?? 0}`;
    box.appendChild(counters);
    petsEl.appendChild(box);
  }
}

window.petAPI?.onStatusUpdate((snapshots) => {
  render(snapshots);
  const cleanBtn = document.getElementById("clean") as HTMLButtonElement | null;
  if (cleanBtn) cleanBtn.disabled = !snapshots.some((s) => s.dirty);
  reportSize();
});

/** Tell main the real card height so it can fit 1–3 pets (only on change). */
let lastStatusH = 0;
function reportSize(): void {
  const card = document.getElementById("card");
  if (!card) return;
  const h = card.offsetHeight;
  if (h > 0 && h !== lastStatusH) {
    lastStatusH = h;
    window.petAPI?.reportStatusSize(h);
  }
}
try {
  void document.fonts?.ready.then(() => {
    lastStatusH = 0;
    reportSize();
  });
} catch {
  // Font API unavailable — the render reports still apply.
}
window.petAPI?.onStatusMsg((text) => {
  msgEl.textContent = text;
});
document.getElementById("hide")?.addEventListener("click", () => {
  window.petAPI?.hideStatus();
});
document.getElementById("pat")?.addEventListener("click", () => {
  window.petAPI?.patAll();
});
document.getElementById("feed")?.addEventListener("click", () => {
  window.petAPI?.feedAll();
});
document.getElementById("clean")?.addEventListener("click", () => {
  window.petAPI?.cleanAllPoop();
});
document.getElementById("gear")?.addEventListener("click", () => {
  window.petAPI?.openSettings();
});
