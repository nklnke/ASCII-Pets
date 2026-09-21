import { SKINS, SkinFrames } from "./ascii";
import {
  PetStats,
  TIRED_AT,
  feedPet,
  isHungry,
  isSleepy,
  petPet,
  tickStats,
} from "../shared/pet-stats";
import { CellInk, frameCells } from "../shared/color";
import type { PetSnapshot } from "../shared/ipc";
import { normalizePack, skinMoves, skinName, skinSound } from "../shared/skins";
import {
  Gait,
  TemperamentParams,
  jitterTemperament,
  rollGait,
  temperamentForSlot,
} from "../shared/temperament";
import { loadStats, saveStats, startAutosave } from "./pet-store";
import { playEatSound, playPetSound, setMuted } from "./sound";

declare global {
  interface Window {
    petAPI?: {
      setClickable: (clickable: boolean) => void;
      showMenu: () => void;
      getPack: () => Promise<string[]>;
      onPetAction: (cb: () => void) => void;
      onPetFeed: (cb: () => void) => void;
      onPetGreet: (cb: () => void) => void;
      onPetStartle: (cb: () => void) => void;
      onSetPack: (cb: (skins: string[]) => void) => void;
      onSetColorMode: (cb: (on: boolean) => void) => void;
      onSetInkColor: (cb: (inks: CellInk[]) => void) => void;
      onSetPaused: (cb: (value: boolean) => void) => void;
      getMuted: () => Promise<boolean>;
      onSetMuted: (cb: (muted: boolean) => void) => void;
      getScale: () => Promise<number>;
      onSetScale: (cb: (scale: number) => void) => void;
      pushStats: (snapshot: PetSnapshot[]) => void;
    };
  }
}

const stageEl = document.getElementById("stage") as HTMLDivElement;
const msgEl = document.getElementById("msg") as HTMLDivElement;
const statsEl = document.getElementById("stats") as HTMLDivElement;

const WALK_TICK_MS = 33;
const HAPPY_MS = 1200;
const EAT_MS = 900;
const JUMP_MS = 600;
const CROAK_MS = 350;
const TURN_SLOW_MS = 200;
const EDGE_MARGIN = 40;
const MAX_SNIFF_MS = 5000;
/** Animation runs at ~10fps; walk cycles are 4 frames. */
const ANIM_TICK_MS = 100;
/** Single click waits this long to make sure it's not a double-click (feed). */
const CLICK_DELAY_MS = 260;

let paused = false;
let dragPet: Pet | null = null;
let grabOffset = 0;

function showMsg(text: string): void {
  msgEl.textContent = text;
}

/** Auto-inversion ink from main (per-cell backdrop sampling). Off = plain white CSS. */
function applyInk(inks: CellInk[]): void {
  for (const ink of inks) {
    const p = pets[ink.slot];
    if (!p || !Array.isArray(ink.colors) || !Array.isArray(ink.shadows)) continue;
    p.ink = ink;
    p.paintInk();
  }
}

function clearInk(): void {
  for (const p of pets) {
    p.ink = null;
    p.paintInk();
  }
}

/** Pet font scale from main (settings.json). Invalidates the cell cache so the
 *  backdrop sampler picks up the new glyph metrics on the next pushStats. */
function applyScale(scale: number): void {
  if (typeof scale !== "number" || !(scale > 0) || !isFinite(scale)) return;
  document.documentElement.style.setProperty("--pet-scale", String(scale));
  cellMetrics = null;
  for (const p of pets) p.renderPosition();
  renderStats();
}

/** Measure one monospace character cell with the real .pet font. Cached. */
interface CellMetrics {
  w: number;
  h: number;
  /** Text origin inside the window: .pet offset + padding (no hardcoded CSS mirror). */
  padL: number;
  padT: number;
  top: number;
}
let cellMetrics: CellMetrics | null = null;
function measureCell(): CellMetrics {
  if (cellMetrics) return cellMetrics;
  const probe = document.createElement("pre");
  probe.className = "pet";
  // Inside #stage so the `#stage .pet` styles apply; padding zeroed so
  // offsetWidth/Height measure the glyphs only, padding is read separately.
  probe.style.cssText = "position:absolute;visibility:hidden;left:0;top:0;padding:0;margin:0;border:0;";
  probe.textContent = "MMMMMMMMMM\nMMMMMMMMMM";
  stageEl.appendChild(probe);
  const w = probe.offsetWidth / 10;
  const h = probe.offsetHeight / 2;
  const cs = getComputedStyle(probe);
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padT = parseFloat(cs.paddingTop) || 0;
  const top = parseFloat(cs.top) || 0;
  probe.remove();
  // Guard against a zero read (font not ready yet) — fall back to metrics
  // matching 15px Cascadia Mono / Consolas at line-height 1.15, top 24px + 8px pad.
  cellMetrics =
    w > 0 && h > 0 ? { w, h, padL, padT, top } : { w: 9, h: 17.25, padL: 8, padT: 8, top: 24 };
  return cellMetrics;
}

class Pet {
  readonly slot: number;
  skinId: string;
  el: HTMLPreElement;
  x: number;
  dir: 1 | -1 = 1;
  frame = 0;
  happyUntil = 0;
  eatUntil = 0;
  nextBlink = 0;
  stats: PetStats;
  clickTimer = 0;
  // Brain & body.
  temp: TemperamentParams;
  gait: Gait = "walk";
  decideUntil = 0;
  sniffUntil = 0;
  slowUntil = 0;
  jumpStart = -JUMP_MS;
  jumpHeight = 40;
  bob = false;
  // Hopper state (frog): sit -> leap -> sit, no gliding.
  hopFromX = 0;
  hopToX = 0;
  nextHopAt = 0;
  croakUntil = 0;
  nextCroak = 0;
  // Per-cell inversion: last ink grid from main + live span map.
  ink: CellInk | null = null;
  shownText: string | null = null;
  gridW = 0;
  gridH = 0;
  cellSpans: Array<HTMLSpanElement | null> = [];

  constructor(slot: number, skinId: string, x: number) {
    this.slot = slot;
    this.skinId = skinId;
    this.x = x;
    this.stats = loadStats(slot, Date.now());
    this.temp = jitterTemperament(temperamentForSlot(slot), [Math.random(), Math.random(), Math.random()]);
    this.jumpHeight = this.temp.jumpHeight;
    this.nextBlink = Date.now() + 2000 + Math.random() * 3000;
    this.decideUntil = Date.now() + this.temp.decisionMinMs;
    this.nextHopAt = Date.now() + 500 + Math.random() * 1000;
    this.nextCroak = Date.now() + 8000 + Math.random() * 12000;
    this.el = document.createElement("pre");
    this.el.className = "pet";
    stageEl.appendChild(this.el);
    this.wireEvents();
    this.renderPosition();
  }

  frames(): SkinFrames {
    return SKINS[this.skinId] ?? SKINS.cat;
  }

  hopper(): boolean {
    return skinMoves(this.skinId) === "hop";
  }

  label(): string {
    return skinName(this.skinId);
  }

  sleeping(): boolean {
    return isSleepy(this.stats);
  }

  sniffing(now: number): boolean {
    return now < this.sniffUntil;
  }

  jumping(now: number): boolean {
    return now - this.jumpStart < JUMP_MS;
  }

  /** Parabola 0 -> -height -> 0 over JUMP_MS. */
  jumpY(now: number): number {
    if (!this.jumping(now)) return 0;
    const p = (now - this.jumpStart) / JUMP_MS;
    return -this.jumpHeight * 4 * p * (1 - p);
  }

  startJump(heightScale = 1): void {
    this.jumpStart = Date.now();
    this.jumpHeight = this.temp.jumpHeight * heightScale;
  }

  /** Fright: turn away from the scare point and hop off. */
  startle(fromX: number): void {
    const rect = this.el.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    this.dir = fromX < center ? 1 : -1;
    this.slowUntil = Date.now() + TURN_SLOW_MS;
    this.startJump(0.8);
    showMsg(`${this.label()}: испугался!`);
  }

  greet(): void {
    this.startJump(1);
    showMsg(`${this.label()}: *потягивается* Привет!`);
  }

  width(): number {
    return this.el.offsetWidth || 120;
  }

  clampX(value: number): number {
    const max = Math.max(0, window.innerWidth - this.width());
    return Math.min(Math.max(0, value), max);
  }

  renderPosition(): void {
    this.el.style.transform = `translateX(${Math.round(this.x)}px) translateY(${this.yOffset(Date.now())}px)`;
  }

  /** Vertical glyph offset (jump arc + walk bob) for the backdrop sampler. */
  yOffset(now: number): number {
    return Math.round(this.jumpY(now) + (this.bob ? -2 : 0));
  }

  gridSize(): { cols: number; rows: number } {
    if (this.gridW > 0) return { cols: this.gridW, rows: this.gridH };
    return { cols: 10, rows: 5 };
  }

  /** Render a frame as per-glyph spans (spaces stay bare text). */
  setFrame(text: string): void {
    if (text === this.shownText) return;
    this.shownText = text;
    const grid = frameCells(text);
    this.gridW = grid.w;
    this.gridH = grid.h;
    const rows = text.split("\n");
    this.el.textContent = "";
    const spans: Array<HTMLSpanElement | null> = new Array(grid.w * grid.h).fill(null);
    const frag = document.createDocumentFragment();
    for (let r = 0; r < grid.h; r++) {
      if (r > 0) frag.appendChild(document.createTextNode("\n"));
      const row = rows[r] ?? "";
      for (let c = 0; c < grid.w; c++) {
        const ch = row[c] ?? " ";
        if (ch === " ") {
          frag.appendChild(document.createTextNode(" "));
        } else {
          const s = document.createElement("span");
          s.textContent = ch;
          frag.appendChild(s);
          spans[r * grid.w + c] = s;
        }
      }
    }
    this.el.appendChild(frag);
    this.cellSpans = spans;
    this.paintInk();
  }

  /** Paint the stored per-cell ink onto the live spans. */
  paintInk(): void {
    const ink = this.ink;
    if (!ink) {
      for (const s of this.cellSpans) {
        if (s) {
          s.style.color = "";
          s.style.textShadow = "";
        }
      }
      return;
    }
    // Grid mismatch (frame changed since the sample) — keep stale colors
    // until the next sample arrives (~1s) rather than flashing white.
    if (ink.w !== this.gridW || ink.h !== this.gridH) return;
    for (let i = 0; i < this.cellSpans.length; i++) {
      const s = this.cellSpans[i];
      if (!s) continue; // spaces are never colored
      const color = ink.colors[i];
      const shadow = ink.shadows[i];
      if (typeof color !== "string" || typeof shadow !== "string") continue;
      s.style.color = color;
      s.style.textShadow = `0 0 4px ${shadow}, 1px 1px 0 ${shadow}`;
    }
  }

  doPet(): void {
    this.stats = petPet(this.stats, Date.now());
    saveStats(this.slot, this.stats);
    this.happyUntil = Date.now() + HAPPY_MS;
    this.startJump(0.6);
    this.setFrame(this.frames().happy[0]);
    showMsg(`${this.label()}: ${skinSound(this.skinId)} (${this.stats.pets})`);
    playPetSound(this.skinId);
    renderStats();
  }

  doFeed(): void {
    this.stats = feedPet(this.stats, Date.now());
    saveStats(this.slot, this.stats);
    this.eatUntil = Date.now() + EAT_MS;
    this.happyUntil = Date.now() + EAT_MS + HAPPY_MS;
    this.setFrame(this.frames().eat);
    showMsg(`${this.label()}: *nom-nom* (покормлен ${this.stats.meals})`);
    playEatSound();
    renderStats();
  }

  tickNeeds(elapsedMin: number): void {
    this.stats = tickStats(this.stats, elapsedMin, paused, Date.now());
    saveStats(this.slot, this.stats);
  }

  /** Chaotic brain: gait, random turns, sniff pauses, surprise jumps. */
  think(now: number): void {
    if (paused || this.sleeping() || dragPet === this || now < this.decideUntil) return;
    const roll = rollGait(this.temp, [Math.random(), Math.random(), Math.random(), Math.random()]);
    if (roll.reverse) {
      this.dir = this.dir === 1 ? -1 : 1;
      this.slowUntil = now + TURN_SLOW_MS;
    }
    this.gait = roll.gait;
    if (roll.gait === "sniff") {
      this.sniffUntil = now + Math.min(roll.durationMs, MAX_SNIFF_MS);
      this.nextBlink = now; // sniff with a blink looks alive
    }
    if (roll.jump && !this.hopper()) this.startJump(0.7 + Math.random() * 0.6);
    this.decideUntil = now + roll.durationMs;
  }

  /** Hopper locomotion: sit out the pause, then leap to the next spot. */
  hopStep(now: number): void {
    this.think(now);
    if (this.sniffing(now)) return;
    if (this.jumping(now)) {
      // Travel through the air along the parabola progress (hoppers leap, never glide).
      const p = Math.min(1, Math.max(0, (now - this.jumpStart) / JUMP_MS));
      this.x = this.hopFromX + (this.hopToX - this.hopFromX) * p;
      this.renderPosition();
      maybePushPos(now);
      return;
    }
    if (now < this.nextHopAt) return;
    const tired = this.stats.energy < TIRED_AT;
    const [lo, hi] = this.temp.hopLength;
    const len = (lo + Math.random() * (hi - lo)) * (tired ? 0.5 : 1);
    let target = this.clampX(this.x + this.dir * len);
    if (Math.abs(target - this.x) < 30) {
      this.dir = this.dir === 1 ? -1 : 1;
      target = this.clampX(this.x + this.dir * len);
    }
    this.hopFromX = this.x;
    this.hopToX = target;
    this.startJump(1);
    const [plo, phi] = this.temp.hopPause;
    const pause = plo + Math.random() * (phi - plo);
    this.nextHopAt = Date.now() + JUMP_MS + (tired ? pause * 1.8 : pause);
  }

  walkStep(): void {
    const now = Date.now();
    if (paused || this.sleeping() || dragPet === this) return;
    if (this.hopper()) {
      this.hopStep(now);
      return;
    }
    if (this.sniffing(now)) return;
    this.think(now);
    // Sniffers stand still (narrowed for the speed table below).
    const gait = this.gait === "sniff" ? "walk" : this.gait;
    let speed = this.temp.speeds[gait];
    if (this.stats.energy < TIRED_AT) speed = Math.min(speed, 1);
    if (now < this.slowUntil) speed *= 0.3;
    this.bob = !this.bob;
    this.x = this.clampX(this.x + this.dir * speed);
    if (this.x <= EDGE_MARGIN) {
      this.dir = 1;
      this.slowUntil = now + TURN_SLOW_MS;
    } else if (this.x >= window.innerWidth - this.width() - EDGE_MARGIN) {
      this.dir = -1;
      this.slowUntil = now + TURN_SLOW_MS;
    }
    this.renderPosition();
    maybePushPos(now);
  }

  animate(tick: number): void {
    const now = Date.now();
    const f = this.frames();
    // Feeding chomp alternates with a happy frame.
    if (now < this.eatUntil) {
      this.setFrame(tick % 2 === 0 ? f.eat : f.happy[0]);
      return;
    }
    // Happy bounce.
    if (now < this.happyUntil) {
      this.setFrame(f.happy[tick % 2]);
      return;
    }
    // Jump: tuck on the way up, stretch on the way down.
    if (this.jumping(now)) {
      const p = (now - this.jumpStart) / JUMP_MS;
      this.setFrame(f.jump[p < 0.5 ? 0 : 1]);
      if (dragPet !== this) this.renderPosition();
      return;
    }
    // Sleeping: Z's drift slowly.
    if (this.sleeping()) {
      this.setFrame(f.sleep[tick % 4 < 2 ? 0 : 1]);
      return;
    }
    // Hungry shiver.
    if (isHungry(this.stats)) {
      this.setFrame(f.hungry[tick % 2]);
      return;
    }
    // Spontaneous croak (hoppers only): open mouth for a beat.
    if (this.hopper() && now >= this.nextCroak) {
      this.nextCroak = now + 15000 + Math.random() * 15000;
      this.croakUntil = now + CROAK_MS;
      showMsg(`${this.label()}: *ква*`);
      playPetSound(this.skinId);
    }
    if (now < this.croakUntil) {
      this.setFrame(f.eat);
      return;
    }
    // Occasional blink while walking.
    if (now >= this.nextBlink) {
      this.nextBlink = now + 2500 + Math.random() * 3500;
      this.setFrame(f.blink);
      return;
    }
    const frames = this.dir === 1 ? f.walkRight : f.walkLeft;
    this.frame = (this.frame + 1) % frames.length;
    this.setFrame(frames[this.frame]);
  }

  destroy(): void {
    window.clearTimeout(this.clickTimer);
    saveStats(this.slot, this.stats);
    this.el.remove();
  }

  wireEvents(): void {
    // Click = pet it (delayed so a double-click feeds instead of petting twice).
    this.el.addEventListener("click", () => {
      window.clearTimeout(this.clickTimer);
      this.clickTimer = window.setTimeout(() => this.doPet(), CLICK_DELAY_MS);
    });
    this.el.addEventListener("dblclick", (e: MouseEvent) => {
      e.preventDefault();
      window.clearTimeout(this.clickTimer);
      this.doFeed();
    });

    // Click-through everywhere except the pet: enable mouse events on hover.
    this.el.addEventListener("mouseenter", () => {
      window.petAPI?.setClickable(true);
    });
    this.el.addEventListener("mouseleave", () => {
      if (dragPet !== this) window.petAPI?.setClickable(false);
    });

    // Drag the pet: mousedown grabs, window mousemove carries.
    this.el.addEventListener("mousedown", (e: MouseEvent) => {
      if (e.button !== 0) return;
      dragPet = this;
      this.el.classList.add("dragging");
      grabOffset = e.clientX - this.x;
    });

    // Right-click menu (built in main).
    this.el.addEventListener("contextmenu", (e: MouseEvent) => {
      e.preventDefault();
      window.petAPI?.showMenu();
    });
  }
}

let pets: Pet[] = [];

function renderStats(): void {
  statsEl.textContent = pets
    .map(
      (p) =>
        `${p.label()} сыт ${100 - p.stats.hunger} · наст ${p.stats.mood} · эн ${p.stats.energy}` +
        (isHungry(p.stats) ? " · хочет есть!" : "") +
        (p.sleeping() ? " · спит…" : ""),
    )
    .join("\n");
  // Tray tooltip in main mirrors this snapshot (origin + grid drive the sampler).
  const cell = measureCell();
  const now = Date.now();
  window.petAPI?.pushStats(
    pets.map((p) => {
      const grid = p.gridSize();
      return {
        label: p.label(),
        hunger: p.stats.hunger,
        mood: p.stats.mood,
        energy: p.stats.energy,
        ox: Math.round(p.x) + cell.padL,
        oy: cell.top + cell.padT + p.yOffset(now),
        charW: cell.w,
        charH: cell.h,
        cols: grid.cols,
        rows: grid.rows,
      };
    }),
  );
}

/** Throttled position refresh so the sampler follows moving pets (~2Hz). */
let lastPosPush = 0;
function maybePushPos(now: number): void {
  if (now - lastPosPush > 500) {
    lastPosPush = now;
    renderStats();
  }
}

/** Reconcile live pets with the pack from main (slot = index). */
function applyPack(skins: string[]): void {
  const pack = normalizePack(skins);
  // Remove extras.
  while (pets.length > pack.length) {
    const removed = pets.pop();
    if (dragPet === removed) {
      dragPet = null;
      window.petAPI?.setClickable(false);
    }
    removed?.destroy();
  }
  // Add missing or update skins.
  pack.forEach((skinId, i) => {
    const existing = pets[i];
    if (existing) {
      existing.skinId = skinId;
    } else {
      pets.push(new Pet(i, skinId, 100 + i * 160));
    }
  });
  renderStats();
  const hungry = pets.find((p) => isHungry(p.stats));
  if (hungry) showMsg(`${hungry.label()} хочет есть — двойной клик покормит`);
}

window.addEventListener("mousemove", (e: MouseEvent) => {
  if (!dragPet) return;
  dragPet.x = dragPet.clampX(e.clientX - grabOffset);
  dragPet.renderPosition();
});
window.addEventListener("mouseup", () => {
  if (!dragPet) return;
  dragPet.el.classList.remove("dragging");
  dragPet = null;
  window.petAPI?.setClickable(false);
});

// A click near (but not on) a pet startles it — it hops away.
// Clicks reach the page only while mouse events are on (cursor already
// over/near the pet), which is exactly the "click next to the pet" case.
window.addEventListener("mousedown", (e: MouseEvent) => {
  if (e.button !== 0 || dragPet) return;
  if ((e.target as HTMLElement | null)?.closest?.(".pet")) return;
  let nearest: Pet | null = null;
  let nearestDist = Infinity;
  for (const p of pets) {
    if (p.sleeping()) continue;
    const rect = p.el.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const d = Math.abs(e.clientX - center);
    if (d < p.temp.startleRadius && d < nearestDist) {
      nearest = p;
      nearestDist = d;
    }
  }
  nearest?.startle(e.clientX);
});

// Walk along the strip, bounce at edges. No walking while asleep.
setInterval(() => {
  for (const p of pets) p.walkStep();
}, WALK_TICK_MS);

// Needs tick: advance hunger/mood/energy every 30s.
setInterval(() => {
  for (const p of pets) p.tickNeeds(0.5);
  renderStats();
}, 30_000);

// Animation loop ~10fps. Priority: eat > happy > jump > sleep > hungry > croak > blink > walk.
let animTick = 0;
setInterval(() => {
  animTick += 1;
  for (const p of pets) p.animate(animTick);
}, ANIM_TICK_MS);

// Menu actions from main (apply to the whole pack).
window.petAPI?.onPetAction(() => {
  for (const p of pets) p.doPet();
});
window.petAPI?.onPetFeed(() => {
  for (const p of pets) p.doFeed();
});
window.petAPI?.onPetGreet(() => {
  for (const p of pets) p.greet();
});
window.petAPI?.onPetStartle(() => {
  for (const p of pets) {
    if (!p.sleeping()) p.startJump(0.5);
  }
});
window.petAPI?.onSetPack((skins) => applyPack(skins));
window.petAPI?.onSetColorMode((on) => {
  if (!on) clearInk();
});
window.petAPI?.onSetInkColor((inks) => applyInk(inks));
window.petAPI?.onSetPaused((value: boolean) => {
  paused = value;
  showMsg(value ? "*z-z-z* (пауза)" : "*потягивается*");
});
window.petAPI?.onSetMuted((m: boolean) => setMuted(m));
window.petAPI?.onSetScale((s: number) => applyScale(s));

// Pack owner is main (settings.json); render a default first so the pet
// never waits for IPC, then reconcile with the real pack. Ink colors arrive
// on their own via set-ink-color when auto-inversion is on.
applyPack(["cat"]);
void window.petAPI?.getPack?.().then((skins) => applyPack(skins));
void window.petAPI?.getMuted?.().then((m) => setMuted(!!m));
void window.petAPI?.getScale?.().then((s) => applyScale(s));
startAutosave(() => pets.map((p) => ({ slot: p.slot, stats: p.stats })));
