// ALL ascii art lives here. Renderer only picks frames, never hardcodes art.
//
// Each skin keeps its NATIVE height from asciiart.eu (checked by
// test/skins.test.mjs: walk x4, happy/hungry/sleep/jump pairs, blink, eat —
// every frame of one skin shares that height, no blank lines). Pets are
// bottom-aligned on the strip, so different heights stand on one ground line.
// The cat (4 rows) is a SITTING side view: pointy ears, T mouth, front paws,
// tail curled around. Walk frames are a "scoot": lean, paw lift, tail swish.
// The dog (6 rows, Cocoa) is a front-facing puppy: `/^\` ears, `0 0` eyes,
// `Y` snout, body, legs, paws. Walk frames bounce and stamp.
// The frog (4 rows) is front-facing: `()` eye bumps, `(___)` head, mouth
// that breathes, `\/` feet. Locomotion goes through the jump frames.
// Walk-left frames are exact mirrors of walk-right (built with mirrorFrame —
// walk rows use only mirror-safe glyphs).

export interface SkinFrames {
  walkRight: string[];
  walkLeft: string[];
  happy: string[];
  hungry: string[];
  sleep: string[];
  jump: string[];
  blink: string;
  eat: string;
}

/** Mirror a frame horizontally: reverse + swap asymmetric glyphs. */
function mirrorFrame(frame: string): string {
  const swap: Record<string, string> = {
    "/": "\\",
    "\\": "/",
    "(": ")",
    ")": "(",
    "<": ">",
    ">": "<",
  };
  return frame
    .split("\n")
    .map((line) =>
      [...line]
        .reverse()
        .map((ch) => swap[ch] ?? ch)
        .join(""),
    )
    .join("\n");
}

// ---------------------------------------------------------------------------
// Cat: sitting side view, 4 rows.
// ---------------------------------------------------------------------------

const CAT_WALK_RIGHT: string[] = [
  [
    "  \\    /\\    ",
    "   )  ( o)   ",
    "  (  /  )    ",
    "~ \\(__)|_|  ",
  ].join("\n"),
  [
    "  \\    /\\    ",
    "    )  ( o)  ",
    "   (  /  )   ",
    " ~ \\(__)|_| ",
  ].join("\n"),
  [
    "  \\    /\\    ",
    "   )  ( o)   ",
    "  (  /  )    ",
    "  \\(__)|_| ~",
  ].join("\n"),
  [
    "  \\    /\\    ",
    "  )  ( o)    ",
    " (  /  )     ",
    " \\(__)|_|   ",
  ].join("\n"),
];

const CAT_WALK_LEFT: string[] = CAT_WALK_RIGHT.map(mirrorFrame);

const CAT_HAPPY: string[] = [
  [
    "  \\    /\\ <3",
    "   )  ( ^)   ",
    "  (  /  )    ",
    "~ \\(__)|_|  ",
  ].join("\n"),
  [
    " <3\\    /\\  ",
    "    )  ( ^)  ",
    "   (  /  )   ",
    " ~ \\(__)|_| ",
  ].join("\n"),
];

const CAT_HUNGRY: string[] = [
  [
    "  \\    /\\   ",
    "   )  ( o)?  ",
    "  (  /  )    ",
    "~ \\(__)(___) ",
  ].join("\n"),
  [
    "  \\    /\\   ",
    " ? )  ( o)   ",
    "  (  /  )    ",
    "  \\(__)(___) ",
  ].join("\n"),
];

const CAT_SLEEP: string[] = [
  [
    "  \\    /\\   z",
    "   )  ( -) z ",
    "  (  /  )  z ",
    "~ \\(__)|_|  ",
  ].join("\n"),
  [
    "  \\    /\\ z ",
    "   )  ( -)z  ",
    "  (  /  )z   ",
    "  \\(__)|_|  ",
  ].join("\n"),
];

const CAT_BLINK: string = [
  "  \\    /\\    ",
  "   )  ( -)   ",
  "  (  /  )    ",
  "~ \\(__)|_|  ",
].join("\n");

const CAT_EAT: string = [
  "  \\    /\\    ",
  "   )  ( O)   ",
  "  (  /  )    ",
  "~ \\(__)(___) ",
].join("\n");

const CAT_JUMP: string[] = [
  [
    "   \\  /\\     ",
    "   ( O O)    ",
    "  ((___))    ",
    "  ((_ _))    ",
  ].join("\n"),
  [
    "   \\  /\\  >  ",
    "___( O O)>   ",
    "(___|___|_)~ ",
    "  _|_   _|_  ",
  ].join("\n"),
];

// ---------------------------------------------------------------------------
// Dog: front-facing puppy (Cocoa), 6 rows.
// ---------------------------------------------------------------------------

const DOG_WALK_RIGHT: string[] = [
  [
    "  /^ ^\\      ",
    " / 0 0 \\     ",
    " V\\ Y /V     ",
    "  / - \\      ",
    " /  |  \\     ",
    "|_| | |_|    ",
  ].join("\n"),
  [
    "  /^ ^\\      ",
    " / 0 0 \\     ",
    " V\\ Y /V     ",
    "  / - \\      ",
    " /  |  \\     ",
    "|~| | |_|    ",
  ].join("\n"),
  [
    "  /^ ^\\      ",
    " / 0 0 \\     ",
    " V\\ Y /V     ",
    "  / - \\      ",
    " /  |  \\     ",
    "|_| | |_|    ",
  ].join("\n"),
  [
    "  /^ ^\\      ",
    " / 0 0 \\     ",
    " V\\ Y /V     ",
    "  / - \\      ",
    " /  |  \\     ",
    "|_| | |~|    ",
  ].join("\n"),
];

const DOG_WALK_LEFT: string[] = DOG_WALK_RIGHT.map(mirrorFrame);

const DOG_HAPPY: string[] = [
  [
    "  /^ ^\\    <3",
    " / ^ ^ \\     ",
    " V\\ U /V     ",
    "  / - \\      ",
    " /  |  \\     ",
    "|_| | |_|    ",
  ].join("\n"),
  [
    " <3/^ ^\\      ",
    " / ^ ^ \\     ",
    " V\\ U /V     ",
    "  / - \\      ",
    " /  |  \\     ",
    " |_| | |_|   ",
  ].join("\n"),
];

const DOG_HUNGRY: string[] = [
  [
    "  /^ ^\\      ",
    " / o o \\  ?  ",
    " V\\ Y /V     ",
    "  / - \\      ",
    " / |mm| \\     ",
    "  (___)       ",
  ].join("\n"),
  [
    "   /^ ^\\     ",
    "  / o o \\ ?  ",
    "  V\\ Y /V    ",
    "   / - \\     ",
    "  / |mm| \\    ",
    "   (___)      ",
  ].join("\n"),
];

const DOG_SLEEP: string[] = [
  [
    "  /^ ^\\     z",
    " / -.- \\  z  ",
    "  \\_Y_/  z   ",
    " __________  ",
    "/  o   o   \\ ",
    "|__o___o___| ",
  ].join("\n"),
  [
    "  /^ ^\\   z  ",
    " / -.- \\ z   ",
    "  \\_Y_/ z    ",
    " __________  ",
    "/  o   o   \\ ",
    "|__o___o___| ",
  ].join("\n"),
];

const DOG_BLINK: string = [
  "  /^ ^\\      ",
  " / - - \\     ",
  " V\\ Y /V     ",
  "  / - \\      ",
  " /  |  \\     ",
  "|_| | |_|    ",
].join("\n");

const DOG_EAT: string = [
  "  /^ ^\\      ",
  " / O O \\     ",
  " V\\ O /V     ",
  "  / - \\      ",
  " / |mm| \\     ",
  "  (___)       ",
].join("\n");

const DOG_JUMP: string[] = [
  [
    "  /^ ^\\      ",
    " / O O \\     ",
    " V\\ O /V     ",
    "  (___)      ",
    "  |_|_|      ",
    "  (_|_)      ",
  ].join("\n"),
  [
    "  /^ ^\\   _  ",
    " / O O \\_|_| ",
    " V\\ O /V_|_| ",
    "  |_|   |_|  ",
    "  | |   | |  ",
    " _|_|   |_|_ ",
  ].join("\n"),
];

// ---------------------------------------------------------------------------
// Frog: front-facing, 4 rows. `()` eye bumps, `(___)` head, breathing mouth.
// ---------------------------------------------------------------------------

const FROG_WALK_RIGHT: string[] = [
  [
    "     ()-()     ",
    "   .-(___)-.   ",
    "    _<   >_    ",
    "     \\/   \\/   ",
  ].join("\n"),
  [
    "     ()-()     ",
    "   .-(OOO)-.   ",
    "    _<   >_    ",
    "     \\/   \\/   ",
  ].join("\n"),
  [
    "      ()-()    ",
    "    .-(___)-.  ",
    "     _<   >_   ",
    "      \\/   \\/  ",
  ].join("\n"),
  [
    "     (OO)      ",
    "   .-(___)-.   ",
    "    _<OOO>_    ",
    "     \\/   \\/   ",
  ].join("\n"),
];

const FROG_WALK_LEFT: string[] = FROG_WALK_RIGHT.map(mirrorFrame);

const FROG_HAPPY: string[] = [
  [
    "     (^^)   <3",
    "   .-(___)-.   ",
    "    _<   >_    ",
    "     \\/   \\/   ",
  ].join("\n"),
  [
    " <3  (^^)      ",
    "   .-(___)-.   ",
    "    _<   >_    ",
    "     \\/   \\/   ",
  ].join("\n"),
];

const FROG_HUNGRY: string[] = [
  [
    "     ()-()  ?  ",
    "   .-(___)-.   ",
    "    _<   >_    ",
    "    (___)      ",
  ].join("\n"),
  [
    "  ?  ()-()     ",
    "   .-(___)-.   ",
    "    _<   >_    ",
    "     (___)     ",
  ].join("\n"),
];

const FROG_SLEEP: string[] = [
  [
    "     -- --   z",
    "   .-(___)-z   ",
    "    _<   >z    ",
    "     \\/   \\/   ",
  ].join("\n"),
  [
    "     -- -- z  ",
    "   .-(___)-z   ",
    "    _<   z>    ",
    "     \\/   \\/   ",
  ].join("\n"),
];

const FROG_BLINK: string = [
  "     -- --      ",
  "   .-(___)-.   ",
  "    _<   >_    ",
  "     \\/   \\/   ",
].join("\n");

const FROG_EAT: string = [
  "     ()-()     ",
  "   .-(OOO)-.   ",
  "    _<OOO>_    ",
  "     \\/   \\/   ",
].join("\n");

const FROG_JUMP: string[] = [
  [
    "     ()-()     ",
    "   .-(___)-.   ",
    "    _<   >_    ",
    "      \\/       ",
  ].join("\n"),
  [
    "     (OO)      ",
    "   .-(___)-.   ",
    "    _<OOO>_    ",
    "   \\/     \\/  ",
  ].join("\n"),
];

export const SKINS: Record<string, SkinFrames> = {
  cat: {
    walkRight: CAT_WALK_RIGHT,
    walkLeft: CAT_WALK_LEFT,
    happy: CAT_HAPPY,
    hungry: CAT_HUNGRY,
    sleep: CAT_SLEEP,
    jump: CAT_JUMP,
    blink: CAT_BLINK,
    eat: CAT_EAT,
  },
  dog: {
    walkRight: DOG_WALK_RIGHT,
    walkLeft: DOG_WALK_LEFT,
    happy: DOG_HAPPY,
    hungry: DOG_HUNGRY,
    sleep: DOG_SLEEP,
    jump: DOG_JUMP,
    blink: DOG_BLINK,
    eat: DOG_EAT,
  },
  frog: {
    walkRight: FROG_WALK_RIGHT,
    walkLeft: FROG_WALK_LEFT,
    happy: FROG_HAPPY,
    hungry: FROG_HUNGRY,
    sleep: FROG_SLEEP,
    jump: FROG_JUMP,
    blink: FROG_BLINK,
    eat: FROG_EAT,
  },
};

// Backwards-compatible single-pet exports (cat is the default skin).
export const WALK_RIGHT = CAT_WALK_RIGHT;
export const WALK_LEFT = CAT_WALK_LEFT;
export const HAPPY = CAT_HAPPY[0];
export const HUNGRY = CAT_HUNGRY[0];
export const SLEEP = CAT_SLEEP[0];

// Shared poop pile (one per pet max). Bottom-aligned with the pets, so no
// leading blank lines: the pile's baseline is the strip's ground line for
// every skin, whatever its native height.
export const POOP: string = ["  _   ", " (_)  ", "(___)  "].join("\n");

// Stink waves curling over the pile: 4 rows tall, drifting sideways.
// Cycled ~every 400ms by the renderer (one .stink element per pile).
export const POOP_STINK: string[] = [
  ["   ~   ", "  ~    ", "   ~   ", "    ~  "].join("\n"),
  ["  ~    ", "   ~   ", "    ~  ", "   ~   "].join("\n"),
  ["   ~   ", "    ~  ", "   ~   ", "  ~    "].join("\n"),
];

// Pixel pile for the Tamagotchi style (ascii3); the stink waves above it
// are shared. Other styles use the classic POOP.
export const POOP3: string = ["      ███", "    █████", "  ███████"].join("\n");

/** Pile art for a drawing style. Unknown styles fall back to the classic pile. */
export function poopFor(style: string): string {
  return style === "ascii3" ? POOP3 : POOP;
}

// ---------------------------------------------------------------------------
// ASCII2 ("blocks"): the same poses and native heights, shaded with
// █▓▒░ + ●◉▼▲. Faces stay readable: ◉/● eyes, ▼ nose/tongue area.
// ---------------------------------------------------------------------------

const CAT2_WALK_RIGHT: string[] = [
  [
    "  ▲    ▲    ",
    "   )  (◉)   ",
    "  ( ▒▒▒ )   ",
    "~ ▓(__)|_|  ",
  ].join("\n"),
  [
    "  ▲    ▲    ",
    "    )  (◉)  ",
    "   ( ▒▒▒ )   ",
    " ~ ▓(__)|_| ",
  ].join("\n"),
  [
    "  ▲    ▲    ",
    "   )  (◉)   ",
    "  ( ▒▒▒ )   ",
    "  ▓(__)|_| ~",
  ].join("\n"),
  [
    "  ▲    ▲    ",
    "  )  (◉)    ",
    " ( ▒▒▒ )     ",
    " ▓(__)|_|   ",
  ].join("\n"),
];

const CAT2_WALK_LEFT: string[] = CAT2_WALK_RIGHT.map(mirrorFrame);

const CAT2_HAPPY: string[] = [
  [
    "  ▲    ▲ <3 ",
    "   )  (●)   ",
    "  ( ▒U▒ )    ",
    "~ ▓(__)|_|  ",
  ].join("\n"),
  [
    " <3▲    ▲    ",
    "    )  (●)  ",
    "   ( ▒U▒ )   ",
    " ~ ▓(__)|_| ",
  ].join("\n"),
];

const CAT2_HUNGRY: string[] = [
  [
    "  ▲    ▲    ",
    "   )  (◉)?  ",
    "  ( ▒w▒ )   ",
    "~ ▓(__)(███) ",
  ].join("\n"),
  [
    "  ▲    ▲    ",
    " ? )  (◉)   ",
    "  ( ▒w▒ )   ",
    "  ▓(__)(███) ",
  ].join("\n"),
];

const CAT2_SLEEP: string[] = [
  [
    "  ▲    ▲    z",
    "   )  (─) z  ",
    "  ( ▓▓▓ )  z ",
    "~ ▓(__)|_|  ",
  ].join("\n"),
  [
    "  ▲    ▲ z   ",
    "   )  (─)z   ",
    "  ( ▓▓▓ )z   ",
    "  ▓(__)|_|  ",
  ].join("\n"),
];

const CAT2_BLINK: string = [
  "  ▲    ▲    ",
  "   )  (─)    ",
  "  ( ▒▒▒ )   ",
  "~ ▓(__)|_|  ",
].join("\n");

const CAT2_EAT: string = [
  "  ▲    ▲    ",
  "   )  (●)   ",
  "  ( ▒▒▒ )   ",
  "~ ▓(__)(███) ",
].join("\n");

const CAT2_JUMP: string[] = [
  [
    "   ▲  ▲      ",
    "   (● ●)     ",
    "  ((▓▓▓))    ",
    "  ((▓ ▓))    ",
  ].join("\n"),
  [
    "   ▲  ▲  >   ",
    "___(● ●)>    ",
    "(▓▓▓|▓▓▓)~   ",
    "  _|_   _|_  ",
  ].join("\n"),
];

const DOG2_WALK_RIGHT: string[] = [
  [
    "  ▲   ▲      ",
    " ( ◉ ◉ )     ",
    " ░\\ ▼ /░     ",
    "  ▒▒-▒▒       ",
    " ▒▒ |  ▒▒    ",
    "▓▓▓ | ▓▓▓    ",
  ].join("\n"),
  [
    "  ▲   ▲      ",
    " ( ◉ ◉ )     ",
    " ░\\ ▼ /░     ",
    "  ▒▒-▒▒       ",
    " ▒▒ |  ▒▒    ",
    "░░░ | ▓▓▓    ",
  ].join("\n"),
  [
    "  ▲   ▲      ",
    " ( ◉ ◉ )     ",
    " ░\\ ▼ /░     ",
    "  ▒▒-▒▒       ",
    " ▒▒ |  ▒▒    ",
    "▓▓▓ | ▓▓▓    ",
  ].join("\n"),
  [
    "  ▲   ▲      ",
    " ( ◉ ◉ )     ",
    " ░\\ ▼ /░     ",
    "  ▒▒-▒▒       ",
    " ▒▒ |  ▒▒    ",
    "▓▓▓ | ░░░    ",
  ].join("\n"),
];

const DOG2_WALK_LEFT: string[] = DOG2_WALK_RIGHT.map(mirrorFrame);

const DOG2_HAPPY: string[] = [
  [
    "  ▲   ▲   <3",
    " ( ● ● )     ",
    " ░\\ U /░     ",
    "  ▒▒-▒▒       ",
    " ▒▒ |  ▒▒    ",
    "▓▓▓ | ▓▓▓    ",
  ].join("\n"),
  [
    " <3▲   ▲      ",
    " ( ● ● )     ",
    " ░\\ U /░     ",
    "  ▒▒-▒▒       ",
    " ▒▒ |  ▒▒    ",
    "▓▓▓ | ▓▓▓    ",
  ].join("\n"),
];

const DOG2_HUNGRY: string[] = [
  [
    "  ▲   ▲      ",
    " ( ◉ ◉ )  ?  ",
    " ░\\ ▼ /░     ",
    "  ▒▒-▒▒      ",
    " ▒▒ |mm| ▒▒   ",
    "  (███)       ",
  ].join("\n"),
  [
    "   ▲   ▲     ",
    "? ( ◉ ◉ )    ",
    "  ░\\ ▼ /░    ",
    "   ▒▒-▒▒     ",
    "  ▒▒ |mm|▒▒  ",
    "   (███)      ",
  ].join("\n"),
];

const DOG2_SLEEP: string[] = [
  [
    "  ▲   ▲    z",
    " ( ─ ─ )  z  ",
    "  ░░░░░  z   ",
    " ▓▓▓▓▓▓▓▓    ",
    " ▓ ▓ ▓ ▓    ",
    "▓▓▓▓▓▓▓▓▓   ",
  ].join("\n"),
  [
    "  ▲   ▲  z   ",
    " ( ─ ─ ) z   ",
    "  ░░░░░ z    ",
    " ▓▓▓▓▓▓▓▓    ",
    " ▓ ▓ ▓ ▓    ",
    "▓▓▓▓▓▓▓▓▓   ",
  ].join("\n"),
];

const DOG2_BLINK: string = [
  "  ▲   ▲      ",
  " ( ─ ─ )     ",
  " ░\\ ▼ /░     ",
  "  ▒▒-▒▒       ",
  " ▒▒ |  ▒▒    ",
  "▓▓▓ | ▓▓▓    ",
].join("\n");

const DOG2_EAT: string = [
  "  ▲   ▲      ",
  " ( O O )     ",
  " ░\\ O /░     ",
  "  ▒▒-▒▒      ",
  " ▒▒ |mm| ▒▒   ",
  "  (███)       ",
].join("\n");

const DOG2_JUMP: string[] = [
  [
    "   ▲   ▲     ",
    "  ( O O )    ",
    "  ░\\ O /░    ",
    "   (▓▓▓)     ",
    "   ▓▓▓▓▓     ",
    "    ▓▓▓      ",
  ].join("\n"),
  [
    "  ▲   ▲  _    ",
    " ( O O )_|_| ",
    " ░\\ O /░_|_| ",
    "  ▓▓▓   ▓▓▓  ",
    "  | |   | |  ",
    " _|_|   |_|_ ",
  ].join("\n"),
];

const FROG2_WALK_RIGHT: string[] = [
  [
    "    (◉) (◉)    ",
    "   ▓▓(───)▓▓   ",
    "    _< ░ >_    ",
    "     ▓▓   ▓▓   ",
  ].join("\n"),
  [
    "    (◉) (◉)    ",
    "   ▓▓(═══)▓▓   ",
    "    _< ░ >_    ",
    "     ▓▓   ▓▓   ",
  ].join("\n"),
  [
    "     (◉) (◉)   ",
    "    ▓▓(───)▓▓  ",
    "     _< ░ >_   ",
    "      ▓▓   ▓▓  ",
  ].join("\n"),
  [
    "    (●) (●)    ",
    "   ▓▓(───)▓▓   ",
    "    _<░░░>_    ",
    "     ▓▓   ▓▓   ",
  ].join("\n"),
];

const FROG2_WALK_LEFT: string[] = FROG2_WALK_RIGHT.map(mirrorFrame);

const FROG2_HAPPY: string[] = [
  [
    "    (●) (●) <3",
    "   ▓▓(───)▓▓   ",
    "    _< ░ >_    ",
    "     ▓▓   ▓▓   ",
  ].join("\n"),
  [
    " <3 (◉) (◉)    ",
    "   ▓▓(───)▓▓   ",
    "    _< ░ >_    ",
    "     ▓▓   ▓▓   ",
  ].join("\n"),
];

const FROG2_HUNGRY: string[] = [
  [
    "    (◉) (◉) ?  ",
    "   ▓▓(───)▓▓   ",
    "    _< ░ >_    ",
    "    (███)      ",
  ].join("\n"),
  [
    "  ? (◉) (◉)    ",
    "   ▓▓(───)▓▓   ",
    "    _< ░ >_    ",
    "     (███)     ",
  ].join("\n"),
];

const FROG2_SLEEP: string[] = [
  [
    "    (─) (─)  z",
    "   ▓▓(───)z    ",
    "    _< ░ >z    ",
    "     ▓▓   ▓▓   ",
  ].join("\n"),
  [
    "    (─) (─) z  ",
    "   ▓▓(───)z    ",
    "    _< ░> z    ",
    "     ▓▓   ▓▓   ",
  ].join("\n"),
];

const FROG2_BLINK: string = [
  "    (─) (─)     ",
  "   ▓▓(───)▓▓   ",
  "    _< ░ >_    ",
  "     ▓▓   ▓▓   ",
].join("\n");

const FROG2_EAT: string = [
  "    (◉) (◉)    ",
  "   ▓▓(OOO)▓▓   ",
  "    _<OOO>_    ",
  "     ▓▓   ▓▓   ",
].join("\n");

const FROG2_JUMP: string[] = [
  [
    "    (◉) (◉)    ",
    "   ▓▓(───)▓▓   ",
    "    _< ░ >_    ",
    "      ▓▓       ",
  ].join("\n"),
  [
    "    (●) (●)    ",
    "   ▓▓(OOO)▓▓   ",
    "    _<░░░>_    ",
    "   ▓▓     ▓▓  ",
  ].join("\n"),
];

const SKINS_ASCII1: Record<string, SkinFrames> = SKINS;

const SKINS_ASCII2: Record<string, SkinFrames> = {
  cat: {
    walkRight: CAT2_WALK_RIGHT,
    walkLeft: CAT2_WALK_LEFT,
    happy: CAT2_HAPPY,
    hungry: CAT2_HUNGRY,
    sleep: CAT2_SLEEP,
    jump: CAT2_JUMP,
    blink: CAT2_BLINK,
    eat: CAT2_EAT,
  },
  dog: {
    walkRight: DOG2_WALK_RIGHT,
    walkLeft: DOG2_WALK_LEFT,
    happy: DOG2_HAPPY,
    hungry: DOG2_HUNGRY,
    sleep: DOG2_SLEEP,
    jump: DOG2_JUMP,
    blink: DOG2_BLINK,
    eat: DOG2_EAT,
  },
  frog: {
    walkRight: FROG2_WALK_RIGHT,
    walkLeft: FROG2_WALK_LEFT,
    happy: FROG2_HAPPY,
    hungry: FROG2_HUNGRY,
    sleep: FROG2_SLEEP,
    jump: FROG2_JUMP,
    blink: FROG2_BLINK,
    eat: FROG2_EAT,
  },
};

// ---------------------------------------------------------------------------
// ASCII3 "Tamagotchi": 1-bit pixel blobs (cat 6, dog 8, frog 5 rows).
// Only █ + space, LCD-style: eyes are punched holes, pupils are █
// inside them, mouths/feet are holes. Walk rows stay mirror-safe.
// ---------------------------------------------------------------------------

const CAT3_WALK_RIGHT: string[] = [
  [
    "███         ███",
    "███████████████",
    "██   █████   ██",
    "███ █ ███ █ ███",
    "██████   ██████",
    "████ ██ ██ ████",
  ].join("\n"),
  [
    " ███         ███",
    " ███████████████",
    " ██   █████   ██",
    " ███ █ ███ █ ███",
    " ██████   ██████",
    " ████ ██ ██ ████",
  ].join("\n"),
  [
    "███         ███",
    "███████████████",
    "██   █████   ██",
    "███ █ ███ █ ███",
    "██████   ██████",
    "███ ███ ███ ███",
  ].join("\n"),
  [
    " ███         ███",
    " ███████████████",
    " ██   █████   ██",
    " ███ █ ███ █ ███",
    " ██████   ██████",
    " █████ █████ ███",
  ].join("\n"),
];

const CAT3_WALK_LEFT: string[] = CAT3_WALK_RIGHT.map(mirrorFrame);

const CAT3_HAPPY: string[] = [
  [
    "███         ███ <3",
    "███████████████",
    "███████████████",
    "███ █ ███ █ ███",
    "█████     █████",
    "████ ██ ██ ████",
  ].join("\n"),
  [
    "<3 ███         ███",
    " ███████████████",
    " ███████████████",
    " ███ █ ███ █ ███",
    " █████     █████",
    " ████ ██ ██ ████",
  ].join("\n"),
];

const CAT3_HUNGRY: string[] = [
  [
    "███         ███",
    "███████████████ ?",
    "██   █████   ██",
    "███ █ ███ █ ███",
    "█████     █████",
    "████ ██ ██ ████",
  ].join("\n"),
  [
    "? ███         ███",
    " ███████████████",
    " ██   █████   ██",
    " ███ █ ███ █ ███",
    " █████     █████",
    " ████ ██ ██ ████",
  ].join("\n"),
];

const CAT3_SLEEP: string[] = [
  [
    "███         ███  z",
    "███████████████ z",
    "███████████████",
    "███████████████",
    "██████   ██████",
    "████ ██ ██ ████",
  ].join("\n"),
  [
    "███         ███ z",
    "███████████████z",
    "███████████████",
    "███████████████",
    "██████   ██████",
    "████ ██ ██ ████",
  ].join("\n"),
];

const CAT3_BLINK: string = [
  "███         ███",
  "███████████████",
  "███████████████",
  "███████████████",
  "██████   ██████",
  "████ ██ ██ ████",
].join("\n");

const CAT3_EAT: string = [
  "███         ███",
  "███████████████",
  "██   █████   ██",
  "███ █ ███ █ ███",
  "████       ████",
  "████ ██ ██ ████",
].join("\n");

const CAT3_JUMP: string[] = [
  [
    " ███       ███",
    " █████████████",
    " ██ ███████ ██",
    " █████████████",
    " █████   █████",
    " █████████████",
  ].join("\n"),
  [
    "███         ███",
    "███████████████",
    "█ ███████████ █",
    "███████████████",
    "██           ██",
    "███ ███████ ███",
  ].join("\n"),
];

const DOG3_WALK_RIGHT: string[] = [
  [
    "███         ███",
    "████       ████",
    "███████████████",
    "██   █████   ██",
    "███ █ ███ █ ███",
    "███ ███████ ███",
    "█████     █████",
    "█████     █████",
  ].join("\n"),
  [
    " ███         ███",
    " ████       ████",
    " ███████████████",
    " ██   █████   ██",
    " ███ █ ███ █ ███",
    " ███ ███████ ███",
    " ████     █████",
    " █████     ████",
  ].join("\n"),
  [
    "███         ███",
    "████       ████",
    "███████████████",
    "██   █████   ██",
    "███ █ ███ █ ███",
    "███ ███████ ███",
    "██████   ██████",
    "██████   ██████",
  ].join("\n"),
  [
    " ███         ███",
    " ████       ████",
    " ███████████████",
    " ██   █████   ██",
    " ███ █ ███ █ ███",
    " ███ ███████ ███",
    " ██████   ██████",
    " ██████   ██████",
  ].join("\n"),
];

const DOG3_WALK_LEFT: string[] = DOG3_WALK_RIGHT.map(mirrorFrame);

const DOG3_HAPPY: string[] = [
  [
    "███         ███ <3",
    "████       ████",
    "███████████████",
    "███████████████",
    "███████████████",
    "███ ███████ ███",
    "█████     █████",
    "█████     █████",
  ].join("\n"),
  [
    "<3 ███         ███",
    " ████       ████",
    " ███████████████",
    " ███████████████",
    " ███████████████",
    " ███ ███████ ███",
    " ████     █████",
    " █████     ████",
  ].join("\n"),
];

const DOG3_HUNGRY: string[] = [
  [
    "███         ███",
    "████       ████ ?",
    "██   █████   ██",
    "███ █ ███ █ ███",
    "███ ███████ ███",
    "█████     █████",
    "█████     █████",
    "█████     █████",
  ].join("\n"),
  [
    "? ███         ███",
    " ████       ████",
    " ██   █████   ██",
    " ███ █ ███ █ ███",
    " ███ ███████ ███",
    " █████     █████",
    " █████     █████",
    " █████     █████",
  ].join("\n"),
];

const DOG3_SLEEP: string[] = [
  [
    "███         ███   z",
    "████       ████  z",
    "███████████████",
    "███████████████",
    "███████████████",
    "███ ███████ ███",
    "█████     █████",
    "█████     █████",
  ].join("\n"),
  [
    "███         ███ z",
    "████       ████z",
    "███████████████",
    "███████████████",
    "███████████████",
    "███ ███████ ███",
    "█████     █████",
    "█████     █████",
  ].join("\n"),
];

const DOG3_BLINK: string = [
  "███         ███",
  "████       ████",
  "███████████████",
  "███████████████",
  "███████████████",
  "███ ███████ ███",
  "█████     █████",
  "█████     █████",
].join("\n");

const DOG3_EAT: string = [
  "███         ███",
  "████       ████",
  "██   █████   ██",
  "███ █ ███ █ ███",
  "███ ███████ ███",
  "████       ████",
  "█████     █████",
  "█████     █████",
].join("\n");

const DOG3_JUMP: string[] = [
  [
    " ███       ███",
    " █████████████",
    " ██ ███████ ██",
    " █████████████",
    " █████████████",
    " █████   █████",
    " █████████████",
    " █████████████",
  ].join("\n"),
  [
    "███         ███",
    "███████████████",
    "█ ███████████ █",
    "███████████████",
    "███████████████",
    "██           ██",
    "███ ███████ ███",
    "███ ███████ ███",
  ].join("\n"),
];

const FROG3_WALK_RIGHT: string[] = [
  [
    " ███     ███",
    "█████████████",
    "██ ██ █ ██ ██",
    "██ ███████ ██",
    "███ █████ ███",
  ].join("\n"),
  [
    "  ███     ███",
    " █████████████",
    " ██ ██ █ ██ ██",
    " ██ ███████ ██",
    " ███ █████ ███",
  ].join("\n"),
  [
    " ███     ███",
    "█████████████",
    "██ ██ █ ██ ██",
    "██ ███████ ██",
    "████ ███ ████",
  ].join("\n"),
  [
    "  ███     ███",
    " █████████████",
    " ██ ██ █ ██ ██",
    " ██ ███████ ██",
    " ██ ███████ ██",
  ].join("\n"),
];

const FROG3_WALK_LEFT: string[] = FROG3_WALK_RIGHT.map(mirrorFrame);

const FROG3_HAPPY: string[] = [
  [
    " ███     ███  <3",
    "█████████████",
    "█████████████",
    "██ ███████ ██",
    "███ █████ ███",
  ].join("\n"),
  [
    "<3  ███     ███",
    " █████████████",
    " █████████████",
    " ██ ███████ ██",
    " ███ █████ ███",
  ].join("\n"),
];

const FROG3_HUNGRY: string[] = [
  [
    " ███     ███  ?",
    "█████████████",
    "██ ██ █ ██ ██",
    "██       ██",
    "███ █████ ███",
  ].join("\n"),
  [
    "?  ███     ███",
    " █████████████",
    " ██ ██ █ ██ ██",
    " ███     ███",
    " ███ █████ ███",
  ].join("\n"),
];

const FROG3_SLEEP: string[] = [
  [
    " ███     ███   z",
    "█████████████  z",
    "█████████████",
    "█████████████",
    "███ █████ ███",
  ].join("\n"),
  [
    " ███     ███  z",
    "█████████████ z",
    "█████████████",
    "█████████████",
    "███ █████ ███",
  ].join("\n"),
];

const FROG3_BLINK: string = [
  " ███     ███",
  "█████████████",
  "█████████████",
  "█████████████",
  "███ █████ ███",
].join("\n");

const FROG3_EAT: string = [
  " ███     ███",
  "█████████████",
  "██ ██ █ ██ ██",
  "██       ██",
  "███     ███",
].join("\n");

const FROG3_JUMP: string[] = [
  [
    " ███     ███",
    "█████████████",
    "██ ███████ ██",
    " ███████████",
    "  ███   ███",
  ].join("\n"),
  [
    " ███     ███",
    "█████████████",
    "█ █████████ █",
    "██         ██",
    "███       ███",
  ].join("\n"),
];

const SKINS_ASCII3: Record<string, SkinFrames> = {
  cat: {
    walkRight: CAT3_WALK_RIGHT,
    walkLeft: CAT3_WALK_LEFT,
    happy: CAT3_HAPPY,
    hungry: CAT3_HUNGRY,
    sleep: CAT3_SLEEP,
    jump: CAT3_JUMP,
    blink: CAT3_BLINK,
    eat: CAT3_EAT,
  },
  dog: {
    walkRight: DOG3_WALK_RIGHT,
    walkLeft: DOG3_WALK_LEFT,
    happy: DOG3_HAPPY,
    hungry: DOG3_HUNGRY,
    sleep: DOG3_SLEEP,
    jump: DOG3_JUMP,
    blink: DOG3_BLINK,
    eat: DOG3_EAT,
  },
  frog: {
    walkRight: FROG3_WALK_RIGHT,
    walkLeft: FROG3_WALK_LEFT,
    happy: FROG3_HAPPY,
    hungry: FROG3_HUNGRY,
    sleep: FROG3_SLEEP,
    jump: FROG3_JUMP,
    blink: FROG3_BLINK,
    eat: FROG3_EAT,
  },
};

/** All drawing styles: style id -> skin id -> frames. Pack-wide switch. */
export const SKIN_STYLES: Record<string, Record<string, SkinFrames>> = {
  ascii1: SKINS_ASCII1,
  ascii2: SKINS_ASCII2,
  ascii3: SKINS_ASCII3,
};

/** Frames for a skin in a style (unknown ids fall back to ASCII1 cat). */
export function framesFor(style: string, skinId: string): SkinFrames {
  const set = SKIN_STYLES[style] ?? SKINS_ASCII1;
  return set[skinId] ?? SKINS_ASCII1.cat;
}
