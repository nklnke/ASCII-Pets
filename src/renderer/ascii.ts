// ALL ascii art lives here. Renderer only picks frames, never hardcodes art.
//
// Walk cycles are 4 frames (contact-A, passing, contact-B, passing) played
// at ~10fps. happy/hungry/sleep are 2-frame loops (bounce, shiver, Z-drift).
// jump is a tuck/stretch pair played over the jump parabola.

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

const CAT_WALK_RIGHT: string[] = [
  [
    "  /\\_/\\   ",
    " ( o.o )> ",
    "  > ^ <  ",
    "  /   \\ ",
    " |     |  ",
  ].join("\n"),
  [
    "  /\\_/\\   ",
    " ( o.o )> ",
    "  > ^ <  ",
    "   |   |  ",
    "   |   |  ",
  ].join("\n"),
  [
    "  /\\_/\\   ",
    " ( o.o )> ",
    "  > ^ <  ",
    "   \\   /",
    "  |     | ",
  ].join("\n"),
  [
    "  /\\_/\\   ",
    " ( o.o )> ",
    "  > ^ <  ",
    "    | |   ",
    "    | |   ",
  ].join("\n"),
];

const CAT_WALK_LEFT: string[] = [
  [
    "   /\\_/\\  ",
    " <( o.o ) ",
    "   > ^ <  ",
    "   /   \\ ",
    "  |     | ",
  ].join("\n"),
  [
    "   /\\_/\\  ",
    " <( o.o ) ",
    "   > ^ <  ",
    "  |   |   ",
    "  |   |   ",
  ].join("\n"),
  [
    "   /\\_/\\  ",
    " <( o.o ) ",
    "   > ^ <  ",
    "  \\   /  ",
    "   |     |",
  ].join("\n"),
  [
    "   /\\_/\\  ",
    " <( o.o ) ",
    "   > ^ <  ",
    "   | |    ",
    "   | |    ",
  ].join("\n"),
];

const CAT_HAPPY: string[] = [
  [
    "  /\\_/\\   ",
    " ( ^.^ ) <3",
    "  > ^ <  ",
    "  /   \\ ",
    " | \\_/ | ",
  ].join("\n"),
  [
    " <3 /\\_/\\  ",
    " ( ^.^ )   ",
    "  > U <   ",
    "  /   \\  ",
    " | \\_/ |  ",
  ].join("\n"),
];

const CAT_HUNGRY: string[] = [
  [
    "  /\\_/\\   ",
    " ( o.o )  ",
    "  > w <   ",
    "  /   \\ ",
    " | (?) |  ",
  ].join("\n"),
  [
    "   /\\_/\\   ",
    "  ( o.o )  ",
    "   > w <   ",
    "   /   \\  ",
    "  | (?) |  ",
  ].join("\n"),
];

const CAT_SLEEP: string[] = [
  [
    "  /\\_/\\    z",
    " ( -.- )  z ",
    "  > ^ <  z  ",
    "  /   \\ ",
    " | ___ |  ",
  ].join("\n"),
  [
    "  /\\_/\\  z  ",
    " ( -.- ) z   ",
    "  > ^ < z    ",
    "  /   \\ ",
    " | ___ |  ",
  ].join("\n"),
];

const CAT_BLINK: string = [
  "  /\\_/\\   ",
  " ( -.- )> ",
  "  > ^ <  ",
  "  /   \\ ",
  " |     |  ",
].join("\n");

const CAT_EAT: string = [
  "  /\\_/\\   ",
  " ( O.O )> ",
  "  > O <   ",
  "  /   \\ ",
  " | \\_/ | ",
].join("\n");

const CAT_JUMP: string[] = [
  [
    "  /\\_/\\   ",
    " ( o.o )> ",
    "  > ^ <  ",
    "   | |   ",
    "  _| |_  ",
  ].join("\n"),
  [
    "  /\\_/\\   ",
    " ( O.O )> ",
    "  > ^ <  ",
    "  |   |  ",
    " |     |  ",
  ].join("\n"),
];

const DOG_WALK_RIGHT: string[] = [
  [
    "  /\\__      ",
    "~ ( o.o )>  ",
    "   > w <    ",
    "   /   \\   ",
    "  |     |   ",
  ].join("\n"),
  [
    "  /\\__      ",
    "~ ( o.o )>  ",
    "   > w <    ",
    "    | |     ",
    "    | |     ",
  ].join("\n"),
  [
    "  /\\__      ",
    "~ ( o.o )>  ",
    "   > w <    ",
    "   \\   /   ",
    "  |     |   ",
  ].join("\n"),
  [
    "  /\\__      ",
    "~ ( o.o )>  ",
    "   > w <    ",
    "   |   |    ",
    "   |   |    ",
  ].join("\n"),
];

const DOG_WALK_LEFT: string[] = [
  [
    "      __/\\  ",
    "  <( o.o ) ~",
    "    > w <   ",
    "   /   \\   ",
    "   |     |  ",
  ].join("\n"),
  [
    "      __/\\  ",
    "  <( o.o ) ~",
    "    > w <   ",
    "     | |    ",
    "     | |    ",
  ].join("\n"),
  [
    "      __/\\  ",
    "  <( o.o ) ~",
    "    > w <   ",
    "  \\   /    ",
    "   |     |  ",
  ].join("\n"),
  [
    "      __/\\  ",
    "  <( o.o ) ~",
    "    > w <   ",
    "    |   |   ",
    "    |   |   ",
  ].join("\n"),
];

const DOG_HAPPY: string[] = [
  [
    "  /\\__  <3  ",
    "~ ( ^.^ )   ",
    "   > U <    ",
    "   /   \\   ",
    "  | \\_/ |  ",
  ].join("\n"),
  [
    "  <3 /\\__   ",
    "~ ( ^.^ )   ",
    "   > U <    ",
    "   /   \\  ",
    "  | \\_/ |  ",
  ].join("\n"),
];

const DOG_HUNGRY: string[] = [
  [
    "  /\\__      ",
    "~ ( o.o )   ",
    "   > w <    ",
    "   /   \\   ",
    "  | (__) |  ",
  ].join("\n"),
  [
    "   /\\__      ",
    " ~ ( o.o )   ",
    "    > w <    ",
    "    /   \\   ",
    "   | (__) |  ",
  ].join("\n"),
];

const DOG_SLEEP: string[] = [
  [
    "  /\\__     z",
    "~ ( -.- )  z ",
    "   > ^ <  z  ",
    "   /   \\    ",
    "  | ___ |    ",
  ].join("\n"),
  [
    "  /\\__   z  ",
    "~ ( -.- )z   ",
    "   > ^ < z   ",
    "   /   \\   ",
    "  | ___ |    ",
  ].join("\n"),
];

const DOG_BLINK: string = [
  "  /\\__      ",
  "~ ( -.- )>  ",
  "   > w <    ",
  "   /   \\   ",
  "  |     |   ",
].join("\n");

const DOG_EAT: string = [
  "  /\\__      ",
  "~ ( O.O )>  ",
  "   > O <    ",
  "   /   \\   ",
  "  | \\_/ |  ",
].join("\n");

const DOG_JUMP: string[] = [
  [
    "  /\\__      ",
    "~ ( o.o )>  ",
    "   > w <    ",
    "    | |     ",
    "   _| |_    ",
  ].join("\n"),
  [
    "  /\\__      ",
    "~ ( O.O )>  ",
    "   > O <    ",
    "   |   |    ",
    "  |     |   ",
  ].join("\n"),
];

// Frog is a hopper: its "walk" frames are sitting/breathing variants
// (throat sac inflates), locomotion goes through the jump frames.

const FROG_WALK_RIGHT: string[] = [
  [
    "  O    O    ",
    " ( o..o )>  ",
    "  \\ __ /   ",
    "  /    \\   ",
    " |_    _|   ",
  ].join("\n"),
  [
    "  O    O    ",
    " ( o..o )>  ",
    "  \\ UU /   ",
    "  /    \\   ",
    " |_    _|   ",
  ].join("\n"),
  [
    "  O    O    ",
    " ( o..o )>  ",
    "  \\ __ /   ",
    "  /    \\   ",
    " |_    _|   ",
  ].join("\n"),
  [
    "  O    O    ",
    " ( o..o )>  ",
    "   \\UU/    ",
    "  /    \\   ",
    " |_    _|   ",
  ].join("\n"),
];

const FROG_WALK_LEFT: string[] = [
  [
    "    O    O  ",
    "  <( o..o ) ",
    "   / __ \\  ",
    "   /    \\  ",
    "   |_    _| ",
  ].join("\n"),
  [
    "    O    O  ",
    "  <( o..o ) ",
    "   / UU \\  ",
    "   /    \\  ",
    "   |_    _| ",
  ].join("\n"),
  [
    "    O    O  ",
    "  <( o..o ) ",
    "   / __ \\  ",
    "   /    \\  ",
    "   |_    _| ",
  ].join("\n"),
  [
    "    O    O  ",
    "  <( o..o ) ",
    "    /UU\\   ",
    "   /    \\  ",
    "   |_    _| ",
  ].join("\n"),
];

const FROG_HAPPY: string[] = [
  [
    "  O    O <3 ",
    " ( ^..^ )   ",
    "  \\ __ /   ",
    "  /    \\  ",
    " |_ \\_/ |  ",
  ].join("\n"),
  [
    " <3 O  O    ",
    " ( ^..^ )   ",
    "  \\ OO /   ",
    "  /    \\  ",
    " |_ \\_/ |  ",
  ].join("\n"),
];

const FROG_HUNGRY: string[] = [
  [
    "  O    O  . ",
    " ( o..o )   ",
    "  \\ __ /   ",
    "  /    \\  ",
    " |_ (?) |  ",
  ].join("\n"),
  [
    "   O    O . ",
    "  ( o..o )  ",
    "   \\ OO/   ",
    "   /   \\   ",
    "  |_ (?)|  ",
  ].join("\n"),
];

const FROG_SLEEP: string[] = [
  [
    "  O    O    z",
    " ( -..- )  z ",
    "  \\ __ / z  ",
    "  /    \\  ",
    " |_ ___ |  ",
  ].join("\n"),
  [
    "  O    O  z  ",
    " ( -..- )z   ",
    "  \\ __ /z   ",
    "  /    \\  ",
    " |_ ___ |  ",
  ].join("\n"),
];

const FROG_BLINK: string = [
  "  O    O    ",
  " ( -..- )>  ",
  "  \\ __ /   ",
  "  /    \\  ",
  " |_    _|   ",
].join("\n");

const FROG_EAT: string = [
  "  O    O    ",
  " ( O..O )>  ",
  "  \\ OO /   ",
  "  /    \\  ",
  " |_ \\_/ |  ",
].join("\n");

const FROG_JUMP: string[] = [
  [
    "  O    O    ",
    " ( o..o )>  ",
    "  \\ __ /   ",
    "   |   |    ",
    "   _| |_    ",
  ].join("\n"),
  [
    "  O    O    ",
    " ( O..O )>  ",
    "  \\ OO /   ",
    "  |     |   ",
    " |       |  ",
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
