import { POOP_STINK, SkinFrames, framesFor, poopFor } from "./ascii";
import {
  PetStats,
  TIRED_AT,
  cleanPoop,
  feedPet,
  isHungry,
  isSleepy,
  petPet,
  rollPoop,
  tickDirty,
  tickStats,
} from "../shared/pet-stats";
import { CellInk, frameCells } from "../shared/color";
import type { PetSnapshot } from "../shared/ipc";
import { normalizePack, normalizeStyle, skinMoves, skinName, skinSound, styleName, DEFAULT_STYLE } from "../shared/skins";
import { SocialKind, applySocial, shouldSocialize } from "../shared/social";
import {
  Gait,
  TemperamentParams,
  jitterTemperament,
  rollGait,
  temperamentForSlot,
} from "../shared/temperament";
import { clearPoop, loadPoop, loadStats, savePoop, saveStats, startAutosave } from "./pet-store";
import { playEatSound, playPetSound, playPoopSound, setMuted } from "./sound";
import "./pet-api";

const stageEl = document.getElementById("stage") as HTMLDivElement;

const WALK_TICK_MS = 33;
/** Legacy px/tick -> px/s factor: temperament speeds are px per WALK_TICK_MS. */
const PX_PER_SEC = 1000 / WALK_TICK_MS;
const HAPPY_MS = 1200;
const EAT_MS = 900;
/** Happy-bounce frame period: hearts alternate slower than the 100ms anim tick. */
const HAPPY_FRAME_MS = 350;
const JUMP_MS = 600;
const CROAK_MS = 350;
const TURN_SLOW_MS = 200;
const EDGE_MARGIN = 40;
const MAX_SNIFF_MS = 5000;
/** Animation runs at ~10fps; walk cycles are 4 frames. */
const ANIM_TICK_MS = 100;
/** How long closed eyes hold: a single 100ms tick is imperceptible. */
const BLINK_MS = 240;
/** px of travel per walk-frame advance (leg turnover follows actual speed). */
const STRIDE_PX: Record<Exclude<Gait, "sniff">, number> = { amble: 14, walk: 10, scurry: 7 };
/** Speed easing rate (per second) toward the gait target. */
const SPEED_SMOOTH = 6;
/** Single click waits this long to make sure it's not a double-click (feed). */
const CLICK_DELAY_MS = 260;

let paused = false;
/** Pack-wide drawing style (ASCII1 classic / ASCII2 blocks); owned by main. */
let style = DEFAULT_STYLE;
let dragPet: Pet | null = null;
let grabOffset = 0;

function showMsg(text: string): void {
  // The strip toast is gone (status lives in the floating window) —
  // just relay the line to main.
  try {
    window.petAPI?.pushMsg(text);
  } catch {
    // Preload not ready yet — nothing to mirror into.
  }
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
  for (const p of pets) p.renderPosition(Date.now());
  renderStats();
}

/** Measure one monospace character cell with the real .pet font. Cached. */
interface CellMetrics {
  w: number;
  h: number;
  /** Text origin inside the window: .pet offset + padding (no hardcoded CSS mirror). */
  padL: number;
  padT: number;
  /** Strip ground offset: read from the #stage .pet bottom rule. */
  bottom: number;
}
let cellMetrics: CellMetrics | null = null;
function measureCell(): CellMetrics {
  if (cellMetrics) return cellMetrics;
  const probe = document.createElement("pre");
  probe.className = "pet";
  // Inside #stage so the `#stage .pet` styles apply; padding zeroed so
  // offsetWidth/Height measure the glyphs only, padding is read separately.
  probe.style.cssText = "position:absolute;visibility:hidden;left:0;padding:0;margin:0;border:0;";
  probe.textContent = "MMMMMMMMMM\nMMMMMMMMMM";
  stageEl.appendChild(probe);
  const w = probe.offsetWidth / 10;
  const h = probe.offsetHeight / 2;
  const cs = getComputedStyle(probe);
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padT = parseFloat(cs.paddingTop) || 0;
  const bottom = parseFloat(cs.bottom) || 0;
  probe.remove();
  // Guard against a zero read (font not ready yet) — fall back to metrics
  // matching 15px Cascadia Mono / Consolas at line-height 1.15, top 24px + 8px pad.
  cellMetrics =
    w > 0 && h > 0 ? { w, h, padL, padT, bottom } : { w: 9, h: 17.25, padL: 8, padT: 8, bottom: 8 };
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
  blinkUntil = 0;
  stats: PetStats;
  clickTimer = 0;
  // Poop pile (one max per pet): a floor-anchored wrap with the pile
  // on the ground line and animated stink waves above it.
  poopEl: HTMLDivElement | null = null;
  stinkEl: HTMLPreElement | null = null;
  poopX = 0;
  // Brain & body.
  temp: TemperamentParams;
  gait: Gait = "walk";
  decideUntil = 0;
  sniffUntil = 0;
  slowUntil = 0;
  jumpStart = -JUMP_MS;
  jumpHeight = 40;
  /** Walk-cycle phase: advances with travelled distance (PI per stride frame). */
  bobPhase = 0;
  /** px travelled since the last walk-frame advance. */
  strideAcc = 0;
  /** Smoothed horizontal speed (px/s) — eases gait changes and turns. */
  speedCur = 0;
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
  cellMask: boolean[] = [];
  // TEMP-DEBUG: last rendered X for catching half-screen teleports.
  lastRx: number | undefined = undefined;

  constructor(slot: number, skinId: string, x: number) {
    this.slot = slot;
    this.skinId = skinId;
    this.x = x;
    // Native grid up front so the sampler/tooltip see real rows/cols even
    // before the first frame is drawn (skins keep different heights).
    const base = this.frames().walkRight[0].split("\n");
    this.gridH = base.length;
    this.gridW = Math.max(...base.map((r) => r.length));
    this.stats = loadStats(slot, Date.now());
    this.temp = jitterTemperament(temperamentForSlot(slot), [Math.random(), Math.random(), Math.random()]);
    this.jumpHeight = this.temp.jumpHeight;
    this.nextBlink = Date.now() + 2000 + Math.random() * 3000;
    this.decideUntil = Date.now() + this.temp.decisionMinMs;
    this.nextHopAt = Date.now() + 500 + Math.random() * 1000;
    this.nextCroak = Date.now() + 8000 + Math.random() * 12000;
    this.el = document.createElement("pre");
    this.el.className = "pet";
    this.el.classList.toggle("flat", style === "ascii3");
    stageEl.appendChild(this.el);
    this.wireEvents();
    this.renderPosition(Date.now());
    // The mess waits for you: restore an uncleaned pile after restart.
    const storedPoop = loadPoop(slot);
    if (storedPoop !== null) this.dropPoop(storedPoop, true);
  }

  frames(): SkinFrames {
    return framesFor(style, this.skinId);
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

  renderPosition(now: number): void {
    const rx = Math.round(this.x);
    // TEMP-DEBUG: catch half-screen teleports; remove once diagnosed.
    if (this.lastRx !== undefined && Math.abs(rx - this.lastRx) > 200) {
      console.warn(`[teleport] ${this.label()} slot=${this.slot} x ${this.lastRx} -> ${rx}`);
    }
    this.lastRx = rx;
    // Fractional translate: integer rounding here stepped visibly at low speeds.
    this.el.style.transform = `translateX(${this.x.toFixed(1)}px) translateY(${this.yOffset(now).toFixed(1)}px)`;
  }

  /** Vertical glyph offset (jump arc + stride bob) for the backdrop sampler. */
  yOffset(now: number): number {
    // Lift only: feet never dip below the floor (the taskbar's top edge).
    return this.jumpY(now) - Math.abs(Math.sin(this.bobPhase)) * this.bobAmp(now);
  }

  /** Stride bob amplitude: hoppers/sleepers/sniffers stand still. */
  bobAmp(now: number): number {
    if (this.hopper() || this.sleeping() || this.sniffing(now)) return 0;
    const gait = this.gait === "sniff" ? "walk" : this.gait;
    return gait === "scurry" ? 1.6 : gait === "amble" ? 0.9 : 1.2;
  }

  gridSize(): { cols: number; rows: number } {
    if (this.gridW > 0) return { cols: this.gridW, rows: this.gridH };
    return { cols: 10, rows: 7 };
  }

  /** Render a frame as per-glyph spans (spaces stay bare text).
   *  Same glyph/space mask as the shown frame: update spans in place
   *  (no DOM rebuild → fewer repaints, no ghost trails). Else rebuild. */
  setFrame(text: string): void {
    if (text === this.shownText) return;
    this.shownText = text;
    const grid = frameCells(text);
    const rows = text.split("\n");
    if (
      grid.w === this.gridW &&
      grid.h === this.gridH &&
      grid.solid.length === this.cellMask.length &&
      grid.solid.every((v, i) => v === this.cellMask[i])
    ) {
      for (let r = 0; r < grid.h; r++) {
        const row = rows[r] ?? "";
        for (let c = 0; c < grid.w; c++) {
          const s = this.cellSpans[r * grid.w + c];
          if (!s) continue; // spaces are never spans
          const ch = row[c] ?? " ";
          if (s.textContent !== ch) s.textContent = ch;
        }
      }
      return;
    }
    this.gridW = grid.w;
    this.gridH = grid.h;
    this.cellMask = grid.solid;
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
      // Pixel style fuses glyphs into one blob with a shared silhouette
      // (CSS filter) — per-glyph shadows would turn to mud.
      s.style.textShadow = style === "ascii3" ? "" : `0 0 4px ${shadow}, 1px 1px 0 ${shadow}`;
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
    // Nature calls: with POOP_CHANCE the meal leaves a pile behind.
    if (!this.poopEl && rollPoop(Math.random())) {
      this.dropPoop(this.clampX(this.x + 60));
      showMsg(`${this.label()}: ой… кликни по кучке, чтобы убрать`);
    }
    renderStats();
  }

  /** Leave a poop pile at x (style pile art, one pile per pet max). */
  dropPoop(x: number, quiet = false): void {
    if (this.poopEl) return;
    this.poopX = x;
    const wrap = document.createElement("div");
    wrap.className = "poop-wrap";
    wrap.classList.toggle("flat", style === "ascii3");
    wrap.style.transform = `translateX(${Math.round(x)}px)`;
    wrap.title = "Клик — убрать";
    const stink = document.createElement("pre");
    stink.className = "stink";
    stink.textContent = POOP_STINK[0];
    const el = document.createElement("pre");
    el.className = "poop";
    el.textContent = poopFor(style);
    wrap.appendChild(stink);
    wrap.appendChild(el);
    // Click-through everywhere except the pile: same contract as the pet.
    wrap.addEventListener("mouseenter", () => {
      window.petAPI?.setClickable(true);
    });
    wrap.addEventListener("mouseleave", () => {
      if (dragPet !== this) window.petAPI?.setClickable(false);
    });
    wrap.addEventListener("click", () => this.cleanPoopEl());
    wrap.addEventListener("contextmenu", (e: MouseEvent) => {
      e.preventDefault();
      window.petAPI?.showMenu();
    });
    stageEl.appendChild(wrap);
    this.poopEl = wrap;
    this.stinkEl = stink;
    savePoop(this.slot, x);
    if (!quiet) {
      playPoopSound();
      renderStats();
    }
  }

  /** Click on the pile: remove it, cheer the pet up a little. */
  cleanPoopEl(): void {
    if (!this.poopEl) return;
    this.poopEl.remove();
    this.poopEl = null;
    this.stinkEl = null;
    clearPoop(this.slot);
    this.stats = cleanPoop(this.stats, Date.now());
    saveStats(this.slot, this.stats);
    showMsg(`${this.label()}: чисто! (+настроение)`);
    window.petAPI?.setClickable(false);
    renderStats();
  }

  tickNeeds(elapsedMin: number): void {
    this.stats = tickStats(this.stats, elapsedMin, paused, Date.now());
    // Uncleaned pile rots the mood on top of the normal drift.
    if (this.poopEl) this.stats = tickDirty(this.stats, elapsedMin, Date.now());
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
      // easeOutQuad: explosive takeoff, soft landing.
      const p = Math.min(1, Math.max(0, (now - this.jumpStart) / JUMP_MS));
      const e = 1 - (1 - p) * (1 - p);
      this.x = this.hopFromX + (this.hopToX - this.hopFromX) * e;
      this.renderPosition(now);
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

  /** Per-frame movement (dt seconds). The ONLY transform writer besides drag. */
  step(dt: number, now: number): void {
    if (dragPet === this) return;
    if (this.sleeping() && !this.jumping(now)) {
      this.speedCur = 0;
      return;
    }
    if (this.hopper()) {
      this.hopStep(now);
      return;
    }
    if (!this.sniffing(now)) {
      this.think(now);
      // Sniffers stand still (narrowed for the speed table below).
      const gait = this.gait === "sniff" ? "walk" : this.gait;
      let target = this.temp.speeds[gait] * PX_PER_SEC; // px/s
      if (this.stats.energy < TIRED_AT) target = Math.min(target, PX_PER_SEC);
      if (now < this.slowUntil) target *= 0.3;
      // Ease toward the target speed so gait changes and turns don't snap.
      this.speedCur += (target - this.speedCur) * Math.min(1, dt * SPEED_SMOOTH);
      const dx = this.dir * this.speedCur * dt;
      const pxPerFrame = STRIDE_PX[gait];
      this.bobPhase += (Math.abs(dx) / pxPerFrame) * Math.PI;
      this.strideAcc += Math.abs(dx);
      this.x = this.clampX(this.x + dx);
      if (this.x <= EDGE_MARGIN) {
        this.dir = 1;
        this.slowUntil = now + TURN_SLOW_MS;
      } else if (this.x >= window.innerWidth - this.width() - EDGE_MARGIN) {
        this.dir = -1;
        this.slowUntil = now + TURN_SLOW_MS;
      }
    } else {
      // Standing still: bleed off speed so the resume doesn't lurch.
      this.speedCur += (0 - this.speedCur) * Math.min(1, dt * 10);
    }
    this.renderPosition(now);
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
    // Happy bounce (slower than the anim tick so the hearts read).
    if (now < this.happyUntil) {
      this.setFrame(f.happy[Math.floor(now / HAPPY_FRAME_MS) % 2]);
      return;
    }
    // Jump: tuck on the way up, stretch on the way down.
    // (Position stays with step()/hopStep() — animate only picks frames.)
    if (this.jumping(now)) {
      const p = (now - this.jumpStart) / JUMP_MS;
      this.setFrame(f.jump[p < 0.5 ? 0 : 1]);
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
    // Blink holds ~240ms (2-3 ticks): a single 100ms tick is imperceptible.
    if (now < this.blinkUntil) {
      this.setFrame(f.blink);
      return;
    }
    // Occasional blink — not mid-scurry and not mid-turn (reads as a glitch).
    if (now >= this.nextBlink) {
      this.nextBlink = now + 2500 + Math.random() * 3500;
      if (this.gait !== "scurry" && now >= this.slowUntil) {
        this.blinkUntil = now + BLINK_MS;
        this.setFrame(f.blink);
        return;
      }
    }
    const frames = this.dir === 1 ? f.walkRight : f.walkLeft;
    if (this.hopper()) {
      // Sitters rest: no leg-cycling on the ground (leaps use jump frames above).
      this.strideAcc = 0;
      this.setFrame(frames[0]);
      return;
    }
    if (this.sniffing(now) || now < this.slowUntil || Math.abs(this.speedCur) < 4) {
      // Standing/turning: rest frame instead of moonwalking in place.
      this.strideAcc = 0;
      this.setFrame(frames[0]);
      return;
    }
    // Distance-driven stride: leg turnover follows actual travel,
    // so amble/scurry don't share one mechanical 10fps cycle.
    const strideGait = this.gait === "sniff" ? "walk" : this.gait;
    const pxPerFrame = STRIDE_PX[strideGait];
    while (this.strideAcc >= pxPerFrame) {
      this.strideAcc -= pxPerFrame;
      this.frame = (this.frame + 1) % frames.length;
    }
    this.setFrame(frames[this.frame]);
  }

  /** Stink waves over the pile: a slow lazy cycle (~400ms a frame). */
  animateStink(tick: number): void {
    if (!this.stinkEl) return;
    this.stinkEl.textContent = POOP_STINK[Math.floor(tick / 4 + this.slot) % POOP_STINK.length];
  }

  destroy(): void {
    window.clearTimeout(this.clickTimer);
    saveStats(this.slot, this.stats);
    this.poopEl?.remove();
    this.poopEl = null;
    this.stinkEl = null;
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
    // Offset from the VISUAL rect (transform may lag logical x) — no snap.
    this.el.addEventListener("mousedown", (e: MouseEvent) => {
      if (e.button !== 0) return;
      dragPet = this;
      this.speedCur = 0;
      this.strideAcc = 0;
      grabOffset = e.clientX - this.el.getBoundingClientRect().left;
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
        dirty: !!p.poopEl,
        pets: p.stats.pets,
        meals: p.stats.meals,
        ox: Math.round(p.x) + cell.padL,
        // Bottom-anchored pets: text top = strip bottom edge, minus the
        // element height, plus padding and the live jump/bob offset.
        oy: Math.round(window.innerHeight - cell.bottom - p.el.offsetHeight + cell.padT + p.yOffset(now)),
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

/** Last pair-social timestamp; starts "long ago" so the first meeting fires. */
let lastSocialAt = -1e12;

/** Pair meeting: two close pets play, chase or squabble (mood + hops). */
function checkSocial(now: number): void {
  if (paused || pets.length < 2) return;
  const [a, b] = pets;
  if (!a || !b || dragPet) return;
  if (a.sleeping() || b.sleeping()) return;
  const kind: SocialKind | null = shouldSocialize(Math.abs(a.x - b.x), now - lastSocialAt, Math.random());
  if (!kind) return;
  lastSocialAt = now;
  a.stats = applySocial(a.stats, kind, now);
  b.stats = applySocial(b.stats, kind, now);
  saveStats(a.slot, a.stats);
  saveStats(b.slot, b.stats);
  if (kind === "play") {
    // Face each other, bounce happily.
    a.dir = a.x < b.x ? 1 : -1;
    b.dir = b.x < a.x ? 1 : -1;
    a.happyUntil = now + HAPPY_MS;
    b.happyUntil = now + HAPPY_MS;
    a.startJump(0.6);
    b.startJump(0.6);
    showMsg(`${a.label()} и ${b.label()} играют!`);
    playPetSound(a.skinId);
  } else if (kind === "chase") {
    // Both dash off in one direction.
    const dir = Math.random() < 0.5 ? 1 : -1;
    a.dir = dir;
    b.dir = dir;
    a.happyUntil = now + HAPPY_MS;
    b.happyUntil = now + HAPPY_MS;
    a.startJump(0.7);
    b.startJump(0.7);
    showMsg(`${a.label()} и ${b.label()} — догонялки!`);
    playPetSound(b.skinId);
  } else {
    // Paws out: face off, hop back, mood stings a little.
    a.dir = a.x < b.x ? 1 : -1;
    b.dir = b.x < a.x ? 1 : -1;
    a.startJump(0.8);
    b.startJump(0.8);
    showMsg(`${a.label()} и ${b.label()} повздорили!`);
  }
  renderStats();
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
      const added = new Pet(i, skinId, 100 + i * 160);
      added.x = added.clampX(added.x);
      added.renderPosition(Date.now());
      pets.push(added);
    }
  });
  renderStats();
  const hungry = pets.find((p) => isHungry(p.stats));
  if (hungry) showMsg(`${hungry.label()} хочет есть — двойной клик покормит`);
}

window.addEventListener("mousemove", (e: MouseEvent) => {
  if (!dragPet) return;
  dragPet.x = dragPet.clampX(e.clientX - grabOffset);
  dragPet.renderPosition(Date.now());
});
window.addEventListener("mouseup", () => {
  if (!dragPet) return;
  dragPet.speedCur = 0;
  dragPet.strideAcc = 0;
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

// Single position writer: rAF with dt-based speeds (smooth, no CSS transition
// chasing a moving target). Walk along the strip, bounce at edges.
let lastFrame = Date.now();
function frame(): void {
  requestAnimationFrame(frame);
  const now = Date.now();
  const dt = Math.min(Math.max((now - lastFrame) / 1000, 0), 0.1);
  lastFrame = now;
  if (paused) return;
  for (const p of pets) p.step(dt, now);
  checkSocial(now);
}
requestAnimationFrame(frame);

// Needs tick: advance hunger/mood/energy every 30s.
setInterval(() => {
  for (const p of pets) p.tickNeeds(0.5);
  renderStats();
}, 30_000);

// Animation loop ~10fps. Priority: eat > happy > jump > sleep > hungry > croak > blink > walk.
let animTick = 0;
setInterval(() => {
  animTick += 1;
  for (const p of pets) {
    p.animate(animTick);
    p.animateStink(animTick);
  }
}, ANIM_TICK_MS);

// Menu actions from main (apply to the whole pack).
window.petAPI?.onPetAction(() => {
  for (const p of pets) p.doPet();
});
window.petAPI?.onPetFeed(() => {
  for (const p of pets) p.doFeed();
});
window.petAPI?.onPetCleanPoop(() => {
  for (const p of pets) p.cleanPoopEl();
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
window.petAPI?.onSetStyle((next) => {
  style = normalizeStyle(next);
  // Next animation tick picks frames from the new set (grids rebuild
  // themselves); just announce it and refresh the sampler snapshot.
  showMsg(`Стиль: ${styleName(style)}`);
  // Pixel style drops per-glyph shadows for one shared silhouette.
  for (const p of pets) {
    p.el.classList.toggle("flat", style === "ascii3");
    p.paintInk();
  }
  // Piles already on the ground switch pile art immediately (stink stays).
  for (const p of pets) {
    p.poopEl?.classList.toggle("flat", style === "ascii3");
    const pileEl = p.poopEl?.querySelector(".poop");
    if (pileEl) pileEl.textContent = poopFor(style);
  }
  renderStats();
});
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
void window.petAPI?.getStyle?.().then((s) => {
  style = normalizeStyle(s);
});
void window.petAPI?.getMuted?.().then((m) => setMuted(!!m));
void window.petAPI?.getScale?.().then((s) => applyScale(s));
startAutosave(() => pets.map((p) => ({ slot: p.slot, stats: p.stats })));
