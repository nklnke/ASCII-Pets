// Pet temperaments ("character" driving chaotic behavior).
// Pure and testable: randomness is injected by the caller (renderer passes
// Math.random() values), so decisions are fully deterministic in tests.
//
// Slot 0 is calm, slot 1+ is wild — fixed by design, no settings migration.

export type Gait = "amble" | "walk" | "scurry" | "sniff";

export interface TemperamentParams {
  /** px per walk-step for each gait */
  speeds: Record<Exclude<Gait, "sniff">, number>;
  scurryChance: number;
  sniffChance: number;
  reverseChance: number;
  jumpChance: number;
  decisionMinMs: number;
  decisionMaxMs: number;
  /** clicks closer than this (px) startle the pet */
  startleRadius: number;
  /** jump apex height in px */
  jumpHeight: number;
  /** hop length range in px (hoppers only) */
  hopLength: [number, number];
  /** sit pause between hops in ms (hoppers only) */
  hopPause: [number, number];
}

export const CALM: TemperamentParams = {
  speeds: { amble: 1, walk: 1.5, scurry: 2.5 },
  scurryChance: 0.02,
  sniffChance: 0.25,
  reverseChance: 0.15,
  jumpChance: 0.01,
  decisionMinMs: 7000,
  decisionMaxMs: 14000,
  startleRadius: 90,
  jumpHeight: 30,
  hopLength: [50, 90],
  hopPause: [1500, 3500],
};

export const WILD: TemperamentParams = {
  speeds: { amble: 1.5, walk: 2.5, scurry: 4 },
  scurryChance: 0.3,
  sniffChance: 0.08,
  reverseChance: 0.4,
  jumpChance: 0.12,
  decisionMinMs: 3000,
  decisionMaxMs: 7000,
  startleRadius: 140,
  jumpHeight: 48,
  hopLength: [90, 160],
  hopPause: [600, 1800],
};

export function temperamentForSlot(slot: number): TemperamentParams {
  return slot === 0 ? CALM : WILD;
}

/** Small per-pet variation so two pets of one temper never sync up. */
export function jitterTemperament(t: TemperamentParams, r: number[]): TemperamentParams {
  const [r1 = 0.5, r2 = 0.5, r3 = 0.5] = r;
  const j = (v: number, amt: number) => v * (1 + ((r1 + r2 + r3) / 3 - 0.5) * 2 * amt);
  return {
    ...t,
    speeds: {
      amble: j(t.speeds.amble, 0.1),
      walk: j(t.speeds.walk, 0.1),
      scurry: j(t.speeds.scurry, 0.1),
    },
    decisionMinMs: j(t.decisionMinMs, 0.2),
    decisionMaxMs: j(t.decisionMaxMs, 0.2),
  };
}

export interface GaitDecision {
  gait: Gait;
  reverse: boolean;
  jump: boolean;
  durationMs: number;
}

/** Pure decision: r = [reverseRoll, gaitRoll, durationRoll, jumpRoll] in [0,1). */
export function rollGait(t: TemperamentParams, r: number[]): GaitDecision {
  const [ra = 0, rb = 0, rc = 0, rd = 0] = r;
  let gait: Gait = "walk";
  if (rb < t.sniffChance) gait = "sniff";
  else if (rb < t.sniffChance + t.scurryChance) gait = "scurry";
  else if (rb < t.sniffChance + t.scurryChance + 0.25) gait = "amble";
  return {
    gait,
    reverse: ra < t.reverseChance,
    jump: rd < t.jumpChance,
    durationMs: t.decisionMinMs + rc * (t.decisionMaxMs - t.decisionMinMs),
  };
}
