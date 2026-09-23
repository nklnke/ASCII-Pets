import { POOP_STINK, SkinFrames, framesFor, poopFor } from "./ascii";
import {
  PetStats,
  TIRED_AT,
  PET_SPAM_WINDOW_MS,
  annoyPet,
  cleanPoop,
  feedPet,
  isHungry,
  isPettingSpam,
  isResting,
  isSleepy,
  petPet,
  rollPoop,
  tickDirty,
  tickStats,
} from "../shared/pet-stats";
import { CellInk, frameCells } from "../shared/color";
import type { PetSnapshot } from "../shared/ipc";
import { normalizePack, normalizeStyle, skinMoves, skinName, skinSound, skinSymmetric, styleName, DEFAULT_STYLE } from "../shared/skins";
import { songDurationMs, songFor, songsFor } from "../shared/songs";
import { SocialKind, TrioKind, applySocial, shouldSocialize, shouldSocializeTrio, socialDurationMs } from "../shared/social";
import {
  Gait,
  TemperamentParams,
  jitterTemperament,
  rollGait,
  temperamentForSlot,
} from "../shared/temperament";
import { clearPoop, loadPoop, loadStats, savePoop, saveStats, startAutosave } from "./pet-store";
import { playAnnoyed, playBoing, playClean, playCurious, playDrop, playEatSound, playGreet, playHungry, playJump, playPetSound, playPoopSound, playSniff, playSnore, playSocial, playSong, playStartle, playStep, playWake, setMuted } from "./sound";
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
/** Fling: release speed above this (px/s) slides the pet with momentum. */
const FLING_MIN_V = 600;
/** Fling launch speed clamp (px/s) + slide length. */
const FLING_MAX_V = 1600;
const FLING_MS = 450;
/** Energy points a fling costs. */
const FLING_ENERGY_COST = 5;
/** Wake-up click keeps a sleepy pet awake this long. */
const WAKE_MS = 45_000;
/** After the annoyed reaction, pats give only a little mood for this long. */
const ANNOY_COOLDOWN_MS = 12_000;
/** "Come here" message throttle (the facing itself always applies). */
const CALL_MSG_MS = 4000;
/** Poop piles per pet + horizontal gap so two piles never fully overlap. */
const MAX_POOPS_PER_PET = 2;
const POOP_GAP = 70;
/** Spontaneous songs: first attempt ~3–6 min after launch, then rolling. */
const SONG_MIN_MS = 180_000;
const SONG_WINDOW_MS = 180_000;
/** Floating notes: spawn rate + live cap per pet. */
const NOTE_EVERY_MS = 320;
const MAX_NOTES = 6;

/** One floor-anchored poop pile (DOM node + stink waves + position). */
interface PoopPile {
  wrap: HTMLDivElement;
  stink: HTMLPreElement;
  x: number;
}

let paused = false;
/** Pack-wide drawing style (ASCII1 classic / ASCII2 blocks); owned by main. */
let style = DEFAULT_STYLE;
let dragPet: Pet | null = null;
let grabOffset = 0;
/** Recent drag points for the release-velocity (fling) estimate. */
let dragTrail: Array<{ x: number; t: number }> = [];

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
  /** Recent pat timestamps (spam window) + annoy cooldown + forced wake. */
  petTimes: number[] = [];
  annoyUntil = 0;
  forceAwakeUntil = 0;
  /** Fling state: slide with decaying momentum until this timestamp. */
  flingUntil = 0;
  flingV = 0;
  // Poop piles (two max per pet): floor-anchored wraps with the pile
  // on the ground line and animated stink waves above it.
  piles: PoopPile[] = [];
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
  // Song state: next attempt timestamp, singing window, melody, note pacing.
  nextSongAt = 0;
  singingUntil = 0;
  songIdx = 0;
  songNextNote = 0;
  liveNotes = 0;
  // Per-cell inversion: last ink grid from main + live span map.
  ink: CellInk | null = null;
  /** Painted flag + last painted values (incremental paintInk skips equals). */
  inkPainted = false;
  inkCache: { w: number; h: number; colors: string[]; shadows: string[] } | null = null;
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
    // Stagger debut songs so the pack doesn't choir at once.
    this.nextSongAt = Date.now() + SONG_MIN_MS + slot * 45_000 + Math.random() * 120_000;
    this.el = document.createElement("pre");
    this.el.className = "pet";
    this.el.classList.toggle("flat", style === "ascii3");
    stageEl.appendChild(this.el);
    this.wireEvents();
    this.renderPosition(Date.now());
    // The mess waits for you: restore uncleaned piles after restart.
    for (const x of loadPoop(slot)) this.dropPoop(x, true);
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
    return isSleepy(this.stats) && Date.now() >= this.forceAwakeUntil;
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

  startJump(heightScale = 1, anchor = true): void {
    this.jumpStart = Date.now();
    this.jumpHeight = this.temp.jumpHeight * heightScale;
    // Hoppers travel via hopFromX -> hopToX: an external bounce (petting,
    // socials, startle) must jump in place instead of replaying a stale path
    // (which teleported the frog across the strip). hopStep opts out because
    // it sets a real target right before jumping.
    if (anchor && this.hopper()) {
      this.hopFromX = this.x;
      this.hopToX = this.x;
    }
    playJump(this.skinId);
  }

  /** Fright: turn away from the scare point and hop off. */
  startle(fromX: number): void {
    const rect = this.el.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    this.dir = fromX < center ? 1 : -1;
    this.slowUntil = Date.now() + TURN_SLOW_MS;
    this.startJump(0.8);
    playStartle(this.skinId);
    showMsg(`${this.label()}: испугался!`);
  }

  greet(): void {
    this.startJump(1);
    playGreet(this.skinId);
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
    // Fast motion on fractional pixels shimmers (glyphs + text-shadow hang
    // between LCD pixels), so snap X to whole pixels at speed. Slow speeds
    // keep the fraction: integer rounding there stepped visibly.
    const qx = Math.abs(this.speedCur) > 50 ? Math.round(this.x) : this.x;
    this.el.style.transform = `translateX(${qx.toFixed(1)}px) translateY(${this.yOffset(now).toFixed(1)}px)`;
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
    // No bob at scurry pace: the whole sprite rides this sine at stride
    // frequency, and even sub-pixel amplitude reads as trembling when fast.
    // Amble/walk keep a gentle sway (low frequency, looks natural).
    return gait === "scurry" ? 0 : gait === "amble" ? 0.4 : 0.5;
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
    // Fresh spans carry no styles — drop the paint cache so all cells repaint.
    this.inkPainted = false;
    this.inkCache = null;
    this.paintInk();
  }

  /** Paint the stored per-cell ink onto the live spans (only changed cells). */
  paintInk(): void {
    const ink = this.ink;
    if (!ink) {
      if (this.inkPainted) {
        for (const s of this.cellSpans) {
          if (s) {
            s.style.color = "";
            s.style.textShadow = "";
          }
        }
        this.inkPainted = false;
        this.inkCache = null;
      }
      return;
    }
    // Grid mismatch (frame changed since the sample) — keep stale colors
    // until the next sample arrives rather than flashing white.
    if (ink.w !== this.gridW || ink.h !== this.gridH) return;
    const cache = this.inkCache;
    const sameGrid = cache !== null && cache.w === ink.w && cache.h === ink.h;
    for (let i = 0; i < this.cellSpans.length; i++) {
      const s = this.cellSpans[i];
      if (!s) continue; // spaces are never colored
      const color = ink.colors[i];
      const shadow = ink.shadows[i];
      if (typeof color !== "string" || typeof shadow !== "string") continue;
      const shadowCss = style === "ascii3" ? "" : `0 0 4px ${shadow}, 1px 1px 0 ${shadow}`;
      // Unchanged cells keep their styles: no style recalc, no repaint.
      if (sameGrid && cache.colors[i] === color && cache.shadows[i] === shadowCss) continue;
      s.style.color = color;
      // Pixel style fuses glyphs into one blob with a shared silhouette
      // (CSS filter) — per-glyph shadows would turn to mud.
      s.style.textShadow = shadowCss;
    }
    this.inkPainted = true;
    this.inkCache = {
      w: ink.w,
      h: ink.h,
      colors: ink.colors.slice(),
      shadows: ink.colors.map((_, i) => {
        const sh = ink.shadows[i];
        return style === "ascii3" ? "" : `0 0 4px ${sh}, 1px 1px 0 ${sh}`;
      }),
    };
  }

  doPet(): void {
    const now = Date.now();
    // Wake-up click: a sleepy pet yawns awake for a while (not a pat, no spam).
    if (this.sleeping()) {
      this.forceAwakeUntil = now + WAKE_MS;
      this.startJump(0.4);
      this.setFrame(this.frames().happy[0]);
      showMsg(`${this.label()}: *зевок* …пять минут…`);
      playWake(this.skinId);
      renderStats();
      return;
    }
    // Overpetted: turn away, hiss, mood stings.
    this.petTimes = this.petTimes.filter((t) => now - t < PET_SPAM_WINDOW_MS);
    if (isPettingSpam(this.petTimes, now)) {
      this.petTimes = [];
      this.annoyUntil = now + ANNOY_COOLDOWN_MS;
      this.stats = annoyPet(this.stats, now);
      saveStats(this.slot, this.stats);
      this.dir = this.dir === 1 ? -1 : 1;
      this.slowUntil = now + TURN_SLOW_MS;
      this.startJump(0.5);
      showMsg(`${this.label()}: хватит!`);
      playAnnoyed(this.skinId);
      renderStats();
      return;
    }
    this.petTimes.push(now);
    let st = petPet(this.stats, now);
    // Freshly annoyed: pats barely help for a while.
    if (now < this.annoyUntil) {
      st = { ...st, mood: Math.max(0, Math.min(100, this.stats.mood + 3)) };
    }
    this.stats = st;
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
    if (this.piles.length < MAX_POOPS_PER_PET && rollPoop(Math.random())) {
      this.dropPoop(this.clampX(this.x + 60));
      showMsg(`${this.label()}: ой… кликни по кучке, чтобы убрать`);
    }
    renderStats();
  }

  /** Leave a poop pile at x (style pile art, two piles per pet max). */
  dropPoop(x: number, quiet = false): void {
    if (this.piles.length >= MAX_POOPS_PER_PET) return;
    // Shift the newcomer so two piles never sit exactly on top of each other.
    let px = this.clampX(x);
    for (const pile of this.piles) {
      if (Math.abs(pile.x - px) < POOP_GAP) px = this.clampX(px + POOP_GAP);
    }
    const wrap = document.createElement("div");
    wrap.className = "poop-wrap";
    wrap.classList.toggle("flat", style === "ascii3");
    wrap.style.transform = `translateX(${Math.round(px)}px)`;
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
    wrap.addEventListener("click", () => this.cleanPoopEl(wrap));
    wrap.addEventListener("contextmenu", (e: MouseEvent) => {
      e.preventDefault();
      window.petAPI?.showMenu();
    });
    stageEl.appendChild(wrap);
    this.piles.push({ wrap, stink, x: px });
    // Gentle fade-in (same 300ms curve as the fade-out below).
    wrap.classList.add("poop-enter");
    void wrap.offsetWidth;
    wrap.classList.remove("poop-enter");
    savePoop(
      this.slot,
      this.piles.map((p) => p.x),
    );
    if (!quiet) {
      playPoopSound();
      renderStats();
    }
  }

  /** Click on a pile: fade it out, cheer the pet up a little. */
  // (CSS transition is 150ms — the timer below has a small margin so the
  // node never pops early.)
  // Fade-out: stats/sound/message fire on click, the node fades 300ms
  // and is removed by the timer. destroy() removes nodes instantly; the
  // timer then only refreshes stats.
  // No argument = the oldest pile (status/tray "clean all" loops these).
  cleanPoopEl(target: HTMLDivElement | null = null): void {
    const pile = target ? this.piles.find((p) => p.wrap === target) : this.piles[0];
    if (!pile || pile.wrap.classList.contains("poop-leaving")) return;
    const { wrap } = pile;
    this.piles = this.piles.filter((p) => p !== pile);
    if (this.piles.length === 0) clearPoop(this.slot);
    else savePoop(this.slot, this.piles.map((p) => p.x));
    this.stats = cleanPoop(this.stats, Date.now());
    saveStats(this.slot, this.stats);
    playClean();
    showMsg(`${this.label()}: чисто! (+настроение)`);
    window.petAPI?.setClickable(false);
    wrap.classList.remove("poop-enter");
    wrap.classList.add("poop-leaving");
    renderStats();
    window.setTimeout(() => {
      wrap.remove();
      renderStats();
    }, 170);
  }

  tickNeeds(elapsedMin: number): void {
    // Sleep counts as rest: a sleeping pet naps the energy back by itself.
    this.stats = tickStats(this.stats, elapsedMin, isResting(this.stats, paused), Date.now());
    // Each uncleaned pile rots the mood on top of the normal drift.
    for (let i = 0; i < this.piles.length; i++) {
      this.stats = tickDirty(this.stats, elapsedMin, Date.now());
    }
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
      playSniff();
    }
    if (roll.jump && !this.hopper()) this.startJump(0.7 + Math.random() * 0.6);
    this.decideUntil = now + roll.durationMs;
  }

  /** Fling slide: decaying momentum after a throw (legs keep cycling). */
  flingStep(dt: number, now: number): void {
    const p = 1 - (this.flingUntil - now) / FLING_MS;
    const speed = this.flingV * Math.max(0, 1 - p);
    const dx = this.dir * speed * dt;
    this.bobPhase += (Math.abs(dx) / STRIDE_PX.walk) * Math.PI;
    this.strideAcc += Math.abs(dx);
    this.x = this.clampX(this.x + dx);
    if (this.x <= EDGE_MARGIN || this.x >= window.innerWidth - this.width() - EDGE_MARGIN) {
      this.dir = this.x <= EDGE_MARGIN ? 1 : -1;
      this.slowUntil = now + TURN_SLOW_MS;
      this.flingUntil = 0;
    }
    this.renderPosition(now);
    maybePushPos(now);
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
    this.startJump(1, false);
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
    if (now < this.flingUntil) {
      this.flingStep(dt, now);
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
    // Spontaneous songs (rare): roll the next attempt, start if idle.
    if (now >= this.nextSongAt) {
      this.nextSongAt = now + SONG_MIN_MS + Math.random() * SONG_WINDOW_MS;
      if (
        !paused &&
        !this.sleeping() &&
        !this.sniffing(now) &&
        !this.jumping(now) &&
        now >= this.eatUntil &&
        !socialActive(now) &&
        songsFor(this.skinId).length > 0
      ) {
        this.songIdx = Math.floor(Math.random() * songsFor(this.skinId).length);
        this.singingUntil = now + songDurationMs(this.skinId, this.songIdx);
        this.songNextNote = now;
        showMsg(`${this.label()} поёт: ${songFor(this.skinId, this.songIdx).name}!`);
        playSong(this.skinId, this.songIdx);
      }
    }
    // Singing: happy bounce + floating notes.
    if (now < this.singingUntil) {
      if (now >= this.songNextNote) {
        this.songNextNote = now + NOTE_EVERY_MS;
        this.spawnNote();
      }
      this.setFrame(f.happy[Math.floor(now / HAPPY_FRAME_MS) % 2]);
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
      playSnore();
      this.setFrame(f.sleep[tick % 4 < 2 ? 0 : 1]);
      return;
    }
    // Hungry shiver.
    if (isHungry(this.stats)) {
      playHungry();
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
    // Symmetric (front-facing) skins share one walk set for both directions:
    // mirroring flips line padding and jerks the sprite sideways on every turn.
    const frames = this.dir === 1 || skinSymmetric(this.skinId) ? f.walkRight : f.walkLeft;
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
    let advanced = false;
    while (this.strideAcc >= pxPerFrame) {
      this.strideAcc -= pxPerFrame;
      this.frame = (this.frame + 1) % frames.length;
      advanced = true;
    }
    if (advanced) playStep(strideGait, this.skinId);
    this.setFrame(frames[this.frame]);
  }

  /** Stink waves over the piles: a slow lazy cycle (~400ms a frame). */
  animateStink(tick: number): void {
    this.piles.forEach((pile, i) => {
      pile.stink.textContent = POOP_STINK[Math.floor(tick / 4 + this.slot + i) % POOP_STINK.length];
    });
  }

  /** Spawn one floating music note above the pet (cap keeps the DOM lean). */
  spawnNote(): void {
    if (this.liveNotes >= MAX_NOTES) return;
    const note = document.createElement("span");
    note.className = "note";
    note.textContent = "♪♫♩"[Math.floor(Math.random() * 3)] ?? "♪";
    note.style.left = `${Math.round(this.x + Math.random() * this.width())}px`;
    note.style.bottom = `${Math.round(this.el.offsetHeight + 10)}px`;
    stageEl.appendChild(note);
    this.liveNotes += 1;
    let gone = false;
    const done = (): void => {
      if (gone) return;
      gone = true;
      note.remove();
      this.liveNotes = Math.max(0, this.liveNotes - 1);
    };
    note.addEventListener("animationend", done, { once: true });
    window.setTimeout(done, 1600);
  }

  destroy(): void {
    window.clearTimeout(this.clickTimer);
    saveStats(this.slot, this.stats);
    for (const pile of this.piles) pile.wrap.remove();
    this.piles = [];
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
      this.flingUntil = 0;
      dragTrail = [{ x: e.clientX, t: Date.now() }];
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
        dirty: !!p.piles.length,
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
        fps: Math.round(fpsEma),
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

/** Per-pair/trio cooldowns; missing = never met = elapsed. */
const lastSocial = new Map<string, number>();

function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** Running scene: checkSocial starts it, socialStep drives the beats. */
interface SocialState {
  kind: SocialKind;
  since: number;
  until: number;
  nextBeat: number;
  beat: number;
  /** Shared run direction for chase (race runs apart instead). */
  dir: 1 | -1;
  whooped: boolean;
  /** Participant slots (2 for pairs, 3 for trio scenes). */
  slots: number[];
}
let social: SocialState | null = null;

function socialActive(now: number): boolean {
  return !!social && now < social.until;
}

/** Live pets for the running scene's slots (empty when no scene). */
function sceneParts(): Pet[] {
  if (!social) return [];
  const out: Pet[] = [];
  for (const slot of social.slots) {
    const p = pets.find((q) => q.slot === slot);
    if (p) out.push(p);
  }
  return out;
}

/** Cosmetic variant pick (Math.random is fine here — no logic depends on it). */
function pickMsg(variants: string[]): string {
  return variants[Math.floor(Math.random() * variants.length)];
}

/** Freeze the random brain for the scene length (walkers + hoppers). */
function lockPet(p: Pet, until: number): void {
  p.decideUntil = until;
  p.slowUntil = 0;
}

/** Hold a walker in place (standing rest frame) without touching hoppers. */
function holdWalker(p: Pet, until: number): void {
  if (!p.hopper()) p.sniffUntil = until;
}

/** Chain another hopper leap from the current spot (no sit pause mid-scene). */
function sceneHop(p: Pet, mult = 1): void {
  const [lo, hi] = p.temp.hopLength;
  const len = (lo + Math.random() * (hi - lo)) * mult;
  p.hopFromX = p.x;
  p.hopToX = p.clampX(p.x + p.dir * len);
  if (Math.abs(p.hopToX - p.x) < 30) {
    p.dir = p.dir === 1 ? -1 : 1;
    p.hopToX = p.clampX(p.x + p.dir * len);
  }
  p.startJump(1, false);
  p.nextHopAt = Date.now() + JUMP_MS + 120;
}

/** "A, B и C" listing for trio messages. */
function listLabels(ps: Pet[]): string {
  const names = ps.map((p) => p.label());
  if (names.length <= 2) return names.join(" и ");
  const last = names[names.length - 1] ?? "";
  return `${names.slice(0, -1).join(", ")} и ${last}`;
}

/** Start the choreography for a fresh social event (pair or trio). */
function startScene(kind: SocialKind, parts: Pet[], dur: number, now: number): void {
  if (kind === "huddle" || kind === "parade") {
    startTrioScene(kind, parts, dur, now);
    return;
  }
  const [a, b] = parts;
  if (!a || !b) return;
  const until = now + dur;
  if (kind === "play") {
    // Face each other, bounce in place.
    a.dir = a.x < b.x ? 1 : -1;
    b.dir = b.x < a.x ? 1 : -1;
    for (const p of [a, b]) {
      lockPet(p, until);
      holdWalker(p, until);
      p.happyUntil = until;
      if (p.hopper()) p.nextHopAt = until;
    }
    a.startJump(0.6);
    b.startJump(0.6);
    social = { kind, since: now, until, nextBeat: now + 620, beat: 0, dir: 1, whooped: false, slots: [a.slot, b.slot] };
    showMsg(`${a.label()} и ${b.label()} ${pickMsg(["играют!", "затеяли возню!", "резвятся вместе!"])}`);
    playSocial("play", a.skinId);
    playPetSound(a.skinId);
  } else if (kind === "chase") {
    // Both dash off in one direction, scurry-locked.
    const dir = Math.random() < 0.5 ? 1 : -1;
    for (const p of [a, b]) {
      p.dir = dir;
      p.gait = "scurry";
      lockPet(p, until);
      p.happyUntil = until;
      if (p.hopper()) p.nextHopAt = now;
      else p.sniffUntil = 0;
    }
    a.startJump(0.7);
    b.startJump(0.7);
    social = { kind, since: now, until, nextBeat: now + dur / 2, beat: 0, dir, whooped: false, slots: [a.slot, b.slot] };
    showMsg(`${a.label()} и ${b.label()} — ${pickMsg(["догонялки!", "носятся друг за другом!"])}`);
    playSocial("chase", b.skinId);
    playPetSound(b.skinId);
  } else if (kind === "sniff") {
    // Nose-to-nose greeting: stand still, sniff + blink.
    a.dir = a.x < b.x ? 1 : -1;
    b.dir = b.x < a.x ? 1 : -1;
    for (const p of [a, b]) {
      lockPet(p, until);
      p.speedCur = 0;
      if (p.hopper()) p.nextHopAt = until;
      else p.sniffUntil = until;
      p.nextBlink = now + 400;
    }
    social = { kind, since: now, until, nextBeat: now + dur / 2, beat: 0, dir: 1, whooped: false, slots: [a.slot, b.slot] };
    showMsg(`${a.label()} и ${b.label()} ${pickMsg(["знакомятся нос к носу!", "обнюхиваются!"])}`);
    playSocial("sniff", a.skinId);
    playSniff();
  } else if (kind === "dance") {
    // Chorus line: side by side, bouncing in rhythm.
    const dir = a.dir;
    b.dir = dir;
    for (const p of [a, b]) {
      lockPet(p, until);
      holdWalker(p, until);
      p.happyUntil = until;
      if (p.hopper()) p.nextHopAt = until;
    }
    a.startJump(0.5);
    b.startJump(0.5);
    social = { kind, since: now, until, nextBeat: now + HAPPY_FRAME_MS, beat: 0, dir, whooped: false, slots: [a.slot, b.slot] };
    showMsg(`${a.label()} и ${b.label()} ${pickMsg(["танцуют!", "устроили пляски!"])}`);
    playSocial("dance", a.skinId);
    playPetSound(a.skinId);
  } else if (kind === "race") {
    // Sprint apart, each toward its own edge.
    a.dir = a.x < b.x ? -1 : 1;
    b.dir = a.dir === 1 ? -1 : 1;
    for (const p of [a, b]) {
      p.gait = "scurry";
      lockPet(p, until);
      p.happyUntil = until;
      if (p.hopper()) p.nextHopAt = now;
      else p.sniffUntil = 0;
    }
    a.startJump(0.7);
    b.startJump(0.7);
    social = { kind, since: now, until, nextBeat: now + dur / 2, beat: 0, dir: 1, whooped: false, slots: [a.slot, b.slot] };
    showMsg(`${a.label()} и ${b.label()} — ${pickMsg(["наперегонки!", "соревнуются, кто быстрее!"])}`);
    playSocial("race", a.skinId);
  } else {
    // Squabble: face off, clash, then turn away and walk off.
    a.dir = a.x < b.x ? 1 : -1;
    b.dir = b.x < a.x ? 1 : -1;
    for (const p of [a, b]) {
      lockPet(p, until);
      holdWalker(p, until);
      if (p.hopper()) p.nextHopAt = until;
    }
    a.startJump(0.8);
    b.startJump(0.8);
    social = { kind, since: now, until, nextBeat: now + 800, beat: 0, dir: 1, whooped: false, slots: [a.slot, b.slot] };
    showMsg(`${a.label()} и ${b.label()} ${pickMsg(["повздорили!", "поссорились!"])}`);
    playSocial("squabble", a.skinId);
  }
  renderStats();
}

/** Trio choreography: the whole pack at once. */
function startTrioScene(kind: TrioKind, parts: Pet[], dur: number, now: number): void {
  const lead = parts[0];
  if (parts.length < 3 || !lead) return;
  const until = now + dur;
  if (kind === "huddle") {
    // Everyone piles toward the middle, face the center, bounce together.
    const xs = parts.map((p) => p.x);
    const center = (Math.min(...xs) + Math.max(...xs)) / 2;
    for (const p of parts) {
      p.dir = p.x < center ? 1 : -1;
      lockPet(p, until);
      holdWalker(p, until);
      p.happyUntil = until;
      if (p.hopper()) p.nextHopAt = until;
    }
    for (const p of parts) p.startJump(0.6);
    social = { kind, since: now, until, nextBeat: now + 620, beat: 0, dir: 1, whooped: false, slots: parts.map((p) => p.slot) };
    showMsg(`${listLabels(parts)} ${pickMsg(["устроили обнимашки!", "сбились в кучку!", "радуются вместе!"])}`);
    playSocial("huddle", lead.skinId);
    playPetSound(lead.skinId);
  } else {
    // Parade: march in a chain, scurry-locked.
    const dir = Math.random() < 0.5 ? 1 : -1;
    for (const p of parts) {
      p.dir = dir;
      p.gait = "scurry";
      lockPet(p, until);
      p.happyUntil = until;
      if (p.hopper()) p.nextHopAt = now;
      else p.sniffUntil = 0;
    }
    for (const p of parts) p.startJump(0.7);
    social = { kind, since: now, until, nextBeat: now + dur / 2, beat: 0, dir, whooped: false, slots: parts.map((p) => p.slot) };
    showMsg(`${listLabels(parts)} — ${pickMsg(["маршируют!", "устроили парад!"])}`);
    playSocial("parade", lead.skinId);
    playPetSound(lead.skinId);
  }
  renderStats();
}

/** Trio scene driver: huddle bounces, parade marches. */
function trioStep(parts: Pet[], now: number): void {
  const s = social;
  if (!s) return;
  if (s.kind === "huddle") {
    // Synchronized bouncing, voices round-robin.
    if (now >= s.nextBeat) {
      s.beat += 1;
      s.nextBeat = now + 620;
      for (const p of parts) p.startJump(0.55);
      const who = parts[s.beat % parts.length];
      if (who) playPetSound(who.skinId);
    }
  } else if (s.kind === "parade") {
    // Hold the march lock; the whole chain turns together at edges.
    for (const p of parts) {
      p.decideUntil = s.until;
      if (!p.hopper()) {
        p.gait = "scurry";
        p.sniffUntil = 0;
      }
    }
    const atLeft = parts.some((p) => p.x <= EDGE_MARGIN);
    const atRight = parts.some((p) => p.x >= window.innerWidth - p.width() - EDGE_MARGIN);
    if (atLeft || atRight) {
      const dir = (atLeft ? 1 : -1) as 1 | -1;
      for (const p of parts) {
        p.dir = dir;
        p.slowUntil = 0;
      }
    }
    for (const p of parts) {
      if (p.hopper() && !p.jumping(now) && now >= p.nextHopAt - 200) sceneHop(p, 1);
    }
    if (!s.whooped && now >= s.nextBeat) {
      s.whooped = true;
      const who = parts[Math.floor(Math.random() * parts.length)];
      if (who) playPetSound(who.skinId);
    }
  }
}

/** Race finish: whoever got closer to its own edge wins. */
function finishSocial(now: number): void {
  const parts = sceneParts();
  if (social?.kind === "race" && parts.length >= 2) {
    const [a, b] = parts;
    if (!a || !b) {
      social = null;
      return;
    }
    const scoreA = a.dir === 1 ? a.x : window.innerWidth - a.x;
    const scoreB = b.dir === 1 ? b.x : window.innerWidth - b.x;
    if (Math.abs(scoreA - scoreB) < 40) {
      showMsg(`${a.label()} и ${b.label()} пришли вровень!`);
    } else {
      const winner = scoreA > scoreB ? a : b;
      showMsg(`${winner.label()} победил в забеге!`);
      playPetSound(winner.skinId);
    }
    renderStats();
  }
  social = null;
  void now;
}

/** Per-frame scene driver: keeps the choreography alive until `until`. */
function socialStep(now: number): void {
  const st = social;
  if (!st) return;
  const parts = sceneParts();
  if (
    parts.length !== st.slots.length ||
    paused ||
    (dragPet !== null && parts.includes(dragPet)) ||
    parts.some((p) => p.sleeping())
  ) {
    social = null;
    return;
  }
  if (now >= st.until) {
    finishSocial(now);
    return;
  }
  if (st.kind === "huddle" || st.kind === "parade") {
    trioStep(parts, now);
    return;
  }
  const [a, b] = parts;
  if (!a || !b) {
    social = null;
    return;
  }
  const s = st;
  if (s.kind === "play") {
    // Synchronized bouncing, alternating voices.
    if (now >= s.nextBeat) {
      s.beat += 1;
      s.nextBeat = now + 620;
      a.startJump(0.55);
      b.startJump(0.55);
      playPetSound(s.beat % 2 === 0 ? a.skinId : b.skinId);
    }
  } else if (s.kind === "dance") {
    // Rhythm jumps (~350ms waltz); drift back together if parted.
    if (Math.abs(a.x - b.x) > 180) {
      const lead = a.x < b.x ? a : b;
      const trail = lead === a ? b : a;
      trail.dir = trail.x < lead.x ? 1 : -1;
    }
    if (now >= s.nextBeat) {
      s.beat += 1;
      s.nextBeat = now + HAPPY_FRAME_MS;
      a.startJump(0.5);
      b.startJump(0.5);
      if (s.beat % 4 === 0) playPetSound(s.beat % 8 === 0 ? a.skinId : b.skinId);
    }
  } else if (s.kind === "sniff") {
    // Second curious sniff halfway through.
    if (!s.whooped && now >= s.nextBeat) {
      s.whooped = true;
      a.nextBlink = now;
      b.nextBlink = now;
      playSniff();
    }
  } else if (s.kind === "chase") {
    // Hold the scurry lock; turn together at edges; whoop halfway.
    for (const p of [a, b]) {
      p.decideUntil = s.until;
      if (!p.hopper()) {
        p.gait = "scurry";
        p.sniffUntil = 0;
      }
    }
    if (
      a.x <= EDGE_MARGIN ||
      b.x <= EDGE_MARGIN ||
      a.x >= window.innerWidth - a.width() - EDGE_MARGIN ||
      b.x >= window.innerWidth - b.width() - EDGE_MARGIN
    ) {
      const dir = (a.x <= EDGE_MARGIN || b.x <= EDGE_MARGIN ? 1 : -1) as 1 | -1;
      a.dir = dir;
      b.dir = dir;
      a.slowUntil = 0;
      b.slowUntil = 0;
    }
    for (const p of [a, b]) {
      if (p.hopper() && !p.jumping(now) && now >= p.nextHopAt - 200) sceneHop(p, 1);
    }
    if (!s.whooped && now >= s.nextBeat) {
      s.whooped = true;
      playPetSound(Math.random() < 0.5 ? a.skinId : b.skinId);
    }
  } else if (s.kind === "race") {
    // Full sprint apart; hoppers chain leaps, walkers hold scurry.
    for (const p of [a, b]) {
      p.decideUntil = s.until;
      if (!p.hopper()) {
        p.gait = "scurry";
        p.sniffUntil = 0;
      } else if (!p.jumping(now) && now >= p.nextHopAt - 200) {
        sceneHop(p, 1.1);
      }
    }
    if (!s.whooped && now >= s.nextBeat) {
      s.whooped = true;
      a.startJump(0.6);
      b.startJump(0.6);
    }
  } else {
    // Squabble: after the clash, turn away and walk off.
    if (s.beat === 0 && now >= s.nextBeat) {
      s.beat = 1;
      a.dir = a.x < b.x ? -1 : 1;
      b.dir = b.x < a.x ? -1 : 1;
      for (const p of [a, b]) {
        if (!p.hopper()) p.sniffUntil = 0;
        p.slowUntil = 0;
      }
      playSocial("squabble", b.skinId);
    }
  }
}

/** Meetings: close pets start 2–4s scenes — the whole trio, or one pair. */
function checkSocial(now: number): void {
  if (paused || dragPet || pets.length < 2) return;
  if (socialActive(now)) return;
  if (social) finishSocial(now);
  // Trio first: the whole cluster piles in together.
  if (pets.length >= 3 && pets.every((p) => !p.sleeping())) {
    const xs = pets.map((p) => p.x);
    const maxDist = Math.max(...xs) - Math.min(...xs);
    const trio = shouldSocializeTrio(maxDist, now - (lastSocial.get("trio") ?? -1e12), Math.random());
    if (trio) {
      lastSocial.set("trio", now);
      const dur = socialDurationMs(Math.random());
      for (const p of pets) {
        p.stats = applySocial(p.stats, trio, now);
        saveStats(p.slot, p.stats);
      }
      startScene(trio, [...pets], dur, now);
      return;
    }
  }
  // Pairs: every awake duo is eligible; pick one at random (no slot bias).
  const cands: Array<{ a: Pet; b: Pet; kind: SocialKind }> = [];
  for (let i = 0; i < pets.length; i++) {
    for (let j = i + 1; j < pets.length; j++) {
      const a = pets[i];
      const b = pets[j];
      if (!a || !b || a.sleeping() || b.sleeping()) continue;
      const kind = shouldSocialize(
        Math.abs(a.x - b.x),
        now - (lastSocial.get(pairKey(a.slot, b.slot)) ?? -1e12),
        Math.random(),
      );
      if (kind) cands.push({ a, b, kind });
    }
  }
  if (cands.length === 0) return;
  const pick = cands[Math.floor(Math.random() * cands.length)];
  if (!pick) return;
  lastSocial.set(pairKey(pick.a.slot, pick.b.slot), now);
  const dur = socialDurationMs(Math.random());
  for (const p of [pick.a, pick.b]) {
    p.stats = applySocial(p.stats, pick.kind, now);
    saveStats(p.slot, p.stats);
  }
  startScene(pick.kind, [pick.a, pick.b], dur, now);
}

/** Reconcile live pets with the pack from main (slot = index). */
function applyPack(skins: string[]): void {
  const pack = normalizePack(skins);
  social = null; // pack changed mid-scene — drop the choreography
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
  dragTrail.push({ x: e.clientX, t: Date.now() });
  while (dragTrail.length > 6) dragTrail.shift();
});
window.addEventListener("mouseup", () => {
  if (!dragPet) return;
  const thrown = dragPet;
  // Release velocity over the last ~150ms decides throw vs drop.
  const now = Date.now();
  const recent = dragTrail.filter((p) => now - p.t < 150);
  let v = 0;
  if (recent.length >= 2) {
    const first = recent[0];
    const last = recent[recent.length - 1];
    const dt = Math.max(1, last.t - first.t);
    v = ((last.x - first.x) / dt) * 1000;
  }
  dragTrail = [];
  thrown.speedCur = 0;
  thrown.strideAcc = 0;
  dragPet = null;
  if (Math.abs(v) >= FLING_MIN_V && !thrown.sleeping()) {
    const speed = Math.min(Math.abs(v), FLING_MAX_V);
    thrown.dir = v > 0 ? 1 : -1;
    thrown.stats = { ...thrown.stats, energy: Math.max(0, thrown.stats.energy - FLING_ENERGY_COST), updatedAt: now };
    saveStats(thrown.slot, thrown.stats);
    if (thrown.hopper()) {
      // Hoppers can't slide: one big leap in the throw direction.
      thrown.hopFromX = thrown.x;
      thrown.hopToX = thrown.clampX(thrown.x + thrown.dir * Math.min(320, speed * 0.22));
      thrown.startJump(1.2, false);
      thrown.nextHopAt = now + JUMP_MS + 300;
    } else {
      thrown.flingV = speed;
      thrown.flingUntil = now + FLING_MS;
      thrown.startJump(0.9);
    }
    showMsg(`${thrown.label()}: ууух!`);
    playBoing();
    renderStats();
  } else {
    playDrop();
  }
  window.petAPI?.setClickable(false);
});

// Double-click on empty space: the pack turns toward the call.
let lastCallMsg = 0;
window.addEventListener("dblclick", (e: MouseEvent) => {
  if ((e.target as HTMLElement | null)?.closest?.(".pet, .poop-wrap")) return;
  const now = Date.now();
  let called = false;
  for (const p of pets) {
    if (p.sleeping()) continue;
    p.dir = e.clientX < p.x + p.width() / 2 ? -1 : 1;
    p.slowUntil = 0;
    called = true;
  }
  if (called) {
    playCurious();
    if (now - lastCallMsg > CALL_MSG_MS) {
      lastCallMsg = now;
      showMsg("…навостряет уши!");
    }
  }
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
/** Render-loop rate (EMA) for the FPS meter; pushed with the stats snapshot. */
let fpsEma = 60;
function frame(): void {
  requestAnimationFrame(frame);
  const now = Date.now();
  const dt = Math.min(Math.max((now - lastFrame) / 1000, 0), 0.1);
  lastFrame = now;
  if (dt > 0) fpsEma += (1 / dt - fpsEma) * 0.1;
  if (paused) return;
  checkSocial(now);
  socialStep(now);
  for (const p of pets) p.step(dt, now);
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
  for (const p of pets) {
    while (p.piles.length > 0) p.cleanPoopEl();
  }
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
    for (const pile of p.piles) {
      pile.wrap.classList.toggle("flat", style === "ascii3");
      const pileEl = pile.wrap.querySelector(".poop");
      if (pileEl) pileEl.textContent = poopFor(style);
    }
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
