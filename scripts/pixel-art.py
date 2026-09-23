"""Pixel-art frames for the ASCII4 ("pixel") drawing style + PNG icons.

Single source of truth for the new look: palette-letter grids for every
pet pose (cat/dog/frog) and the poop pile. Two outputs:

1.  src/renderer/ascii4-generated.ts — text frames (full-block glyphs only)
    plus parallel COLORS tables (palette letter per cell) for the fixed
    per-glyph palettes in src/renderer/ascii.ts.
2.  assets/pixel-{cat,dog,frog,poop}.png — icons for all characters/items.

Rules: every filled cell is a full block (no half-shades); color comes
from the letter tables, never from the glyph. Silhouettes differ strongly:
cat = tall pointy ears + whiskers + slim body (12x7), dog = floppy ears +
big snout + stocky body (12x8), frog = top eyes + wide mouth (12x6).

Grid rules (mirror test/skins.test.mjs): per skin-style all frames share one
native height (2..8 rows), every line holds a non-space glyph (no blank
lines), walkRight has 4 frames, happy/hungry/sleep/jump are pairs.

Stdlib only (struct/zlib), same as scripts/make-icon.py:
    python scripts/pixel-art.py
"""

import struct
import sys
import zlib
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent.parent
OUT_TS = ROOT / "src" / "renderer" / "ascii4-generated.ts"
ASSETS = ROOT / "assets"

FULL = chr(9608)  # full block: the ONLY fill glyph
DOT = chr(9679)  # bullet: nose/tongue accent

# Palette letters -> glyphs. Text eyes/details pass through unchanged.
# V = mouth cavity (own letter so it gets a solid interior color).
GLYPH = {
    ".": " ",
    "k": FULL,
    "W": FULL,
    "L": FULL,
    "O": FULL,
    "N": DOT,
    "D": FULL,
    "V": FULL,
}

TEXT_GLYPHS = set("Uo-?z")

# Palette letters -> RGB for the PNG icons (per skin fur).
SKIN_RGB = {
    "cat": {"k": (23, 23, 29), "W": (242, 242, 247), "L": (38, 38, 46), "V": (107, 58, 77)},
    "dog": {"k": (232, 130, 58), "W": (255, 217, 160), "L": (221, 122, 51), "V": (122, 46, 20)},
    "frog": {"k": (46, 230, 107), "W": (201, 245, 208), "L": (53, 179, 86), "V": (20, 83, 45)},
    "poop": {"k": (150, 100, 60)},
}
RGB_BASE = {
    ".": (0, 0, 0, 0),
    "O": (10, 10, 14, 255),
    "N": (255, 107, 157, 255),
    "D": (10, 10, 14, 255),
    "V": (40, 20, 26, 255),
    "U": (10, 10, 14, 255),
    "o": (10, 10, 14, 255),
    "-": (10, 10, 14, 255),
    "?": (255, 217, 122, 255),
    "z": (154, 215, 255, 255),
}


def frame(rows):
    return ["".join(r) for r in rows]


# ---------------------------------------------------------------------------
# Cat: tall pointy ears, whiskers, slim body. 12x7.
# ---------------------------------------------------------------------------
CAT_EARS = [".k........k.", ".kk......kk."]
CAT_EARS_FLAT = [".kkk....kkk."]
CAT_HEAD = [".kkkkkkkkkk."]
CAT_FACE = {
    "normal": ["--kOkkkkOk--"],
    "happy": ["--kUkkkkUk--"],
    "hungry": ["--kokkkkok--"],
    "sleep": ["--k-kkkk-k--"],
    "eat": ["--kOkkkkOk--"],
}
CAT_MUZZLE = {
    "normal": [".kkkNNNNkkk."],
    "happy": [".kkkNUUNkkk."],
    "eat": [".kkkNVVNkkk."],
}
CAT_BODY = ["..kkkkkkkk.."]
CAT_LEGS = {
    "down": ["..kkk..kkk.."],
    "left": ["..kLk..kkk.."],
    "right": ["..kkk..kLk.."],
    "up": ["..kLk..kLk.."],
    "tuck": ["...kkkkkk..."],
}

# Walk bounces: even frames ride high (tall ears, short legs),
# odd frames crouch (flat ears, double body, long legs). All 4 unique.
CAT_WALK = [
    frame(CAT_EARS + CAT_HEAD + CAT_FACE["normal"] + CAT_MUZZLE["normal"] + CAT_BODY + CAT_LEGS["down"]),
    frame(CAT_EARS_FLAT + CAT_HEAD + CAT_FACE["normal"] + CAT_MUZZLE["normal"] + CAT_BODY + CAT_BODY + CAT_LEGS["down"]),
    frame(CAT_EARS + CAT_HEAD + CAT_FACE["normal"] + CAT_MUZZLE["normal"] + CAT_BODY + CAT_LEGS["down"]),
    frame(CAT_EARS_FLAT + CAT_HEAD + CAT_FACE["normal"] + CAT_MUZZLE["normal"] + CAT_BODY + CAT_BODY + CAT_LEGS["down"]),
]
CAT_HAPPY = [
    frame(CAT_EARS + CAT_HEAD + CAT_FACE["happy"] + CAT_MUZZLE["happy"] + CAT_BODY + CAT_LEGS["down"]),
    frame(CAT_EARS + CAT_HEAD + CAT_FACE["happy"] + CAT_MUZZLE["happy"] + CAT_BODY + CAT_LEGS["up"]),
]
CAT_HUNGRY = [
    frame(CAT_EARS + [CAT_HEAD[0] + " ?"] + CAT_FACE["hungry"] + CAT_MUZZLE["normal"] + CAT_BODY + CAT_LEGS["down"]),
    frame(CAT_EARS + [CAT_HEAD[0] + "  ?"] + CAT_FACE["hungry"] + CAT_MUZZLE["normal"] + CAT_BODY + CAT_LEGS["down"]),
]
CAT_SLEEP = [
    frame([CAT_EARS[0] + " z"] + [CAT_EARS[1]] + CAT_HEAD + CAT_FACE["sleep"] + CAT_MUZZLE["normal"] + CAT_BODY + CAT_LEGS["down"]),
    frame([CAT_EARS[0] + "  z"] + [CAT_EARS[1]] + CAT_HEAD + CAT_FACE["sleep"] + CAT_MUZZLE["normal"] + CAT_BODY + CAT_LEGS["down"]),
]
CAT_JUMP = [
    frame(CAT_EARS + CAT_HEAD + CAT_FACE["happy"] + CAT_MUZZLE["happy"] + CAT_BODY + CAT_LEGS["tuck"]),
    frame(CAT_EARS + CAT_HEAD + CAT_FACE["normal"] + CAT_MUZZLE["normal"] + CAT_BODY + CAT_LEGS["down"]),
]
CAT_BLINK = frame(CAT_EARS + CAT_HEAD + CAT_FACE["sleep"] + CAT_MUZZLE["normal"] + CAT_BODY + CAT_LEGS["down"])
CAT_EAT = frame(CAT_EARS + CAT_HEAD + CAT_FACE["eat"] + CAT_MUZZLE["eat"] + CAT_BODY + CAT_LEGS["down"])

# ---------------------------------------------------------------------------
# Dog: floppy ears, big snout, stocky body. 12x8.
# ---------------------------------------------------------------------------
DOG_EARS = [".kkk....kkk.", ".kkkk..kkkk."]
DOG_EARS_FLAT = [".kkkk..kkkk."]
DOG_HEAD = [".kkkkkkkkkk."]
DOG_FACE = {
    "normal": [".kOkkkkkkOk."],
    "happy": [".kUkkkkkkUk."],
    "hungry": [".kokkkkkkok."],
    "sleep": [".k-kkkkkk-k."],
    "eat": [".kOkkkkkkOk."],
}
DOG_SNOUT = {
    "normal": [".kkWWWWWWkk."],
    "happy": [".kkWWNNWWkk."],
    "eat": [".kkWWVVWWkk."],
}
DOG_MID = {
    "normal": ["..kkkkkkkk.."],
    "happy": ["..kkkNNkkk.."],
    "eat": ["..kkkVVkkk.."],
}
DOG_BODY = ["..kkkkkkkk.."]
DOG_LEGS = {
    "down": ["..kkk..kkk.."],
    "left": ["..kLk..kkk.."],
    "right": ["..kkk..kLk.."],
    "up": ["..kLk..kLk.."],
    "paws": ["..kWk..kWk.."],
    "tuck": ["...kkkkkk..."],
}

# Walk bounces like the cat (tall ears / crouch), plus panting tongue
# on the crouched frames and light paws on the long-legged one.
DOG_WALK = [
    frame(DOG_EARS + DOG_HEAD + DOG_FACE["normal"] + DOG_SNOUT["normal"] + DOG_MID["normal"] + DOG_BODY + DOG_LEGS["down"]),
    frame(DOG_EARS_FLAT + DOG_HEAD + DOG_FACE["normal"] + DOG_SNOUT["normal"] + DOG_MID["normal"] + DOG_BODY + DOG_BODY + DOG_LEGS["down"]),
    frame(DOG_EARS + DOG_HEAD + DOG_FACE["normal"] + DOG_SNOUT["normal"] + DOG_MID["normal"] + DOG_BODY + DOG_LEGS["down"]),
    frame(DOG_EARS_FLAT + DOG_HEAD + DOG_FACE["normal"] + DOG_SNOUT["normal"] + DOG_MID["normal"] + DOG_BODY + DOG_BODY + DOG_LEGS["down"]),
]
DOG_HAPPY = [
    frame(DOG_EARS + DOG_HEAD + DOG_FACE["happy"] + DOG_SNOUT["happy"] + DOG_MID["happy"] + DOG_BODY + DOG_LEGS["down"]),
    frame(DOG_EARS + DOG_HEAD + DOG_FACE["happy"] + DOG_SNOUT["happy"] + DOG_MID["happy"] + DOG_BODY + DOG_LEGS["up"]),
]
DOG_HUNGRY = [
    frame(DOG_EARS + [DOG_HEAD[0] + " ?"] + DOG_FACE["hungry"] + DOG_SNOUT["normal"] + DOG_MID["normal"] + DOG_BODY + DOG_LEGS["down"]),
    frame(DOG_EARS + [DOG_HEAD[0] + "  ?"] + DOG_FACE["hungry"] + DOG_SNOUT["normal"] + DOG_MID["normal"] + DOG_BODY + DOG_LEGS["down"]),
]
DOG_SLEEP = [
    frame([DOG_EARS[0] + " z"] + [DOG_EARS[1]] + DOG_HEAD + DOG_FACE["sleep"] + DOG_SNOUT["normal"] + DOG_MID["normal"] + DOG_BODY + DOG_LEGS["down"]),
    frame([DOG_EARS[0] + "  z"] + [DOG_EARS[1]] + DOG_HEAD + DOG_FACE["sleep"] + DOG_SNOUT["normal"] + DOG_MID["normal"] + DOG_BODY + DOG_LEGS["down"]),
]
DOG_JUMP = [
    frame(DOG_EARS + DOG_HEAD + DOG_FACE["happy"] + DOG_SNOUT["happy"] + DOG_MID["happy"] + DOG_BODY + DOG_LEGS["tuck"]),
    frame(DOG_EARS + DOG_HEAD + DOG_FACE["normal"] + DOG_SNOUT["normal"] + DOG_MID["normal"] + DOG_BODY + DOG_LEGS["down"]),
]
DOG_BLINK = frame(DOG_EARS + DOG_HEAD + DOG_FACE["sleep"] + DOG_SNOUT["normal"] + DOG_MID["normal"] + DOG_BODY + DOG_LEGS["down"])
DOG_EAT = frame(DOG_EARS + DOG_HEAD + DOG_FACE["eat"] + DOG_SNOUT["eat"] + DOG_MID["eat"] + DOG_BODY + DOG_LEGS["down"])

# ---------------------------------------------------------------------------
# Frog: eyes on top, wide mouth. 12x6.
# ---------------------------------------------------------------------------
FROG_EYES = {
    "normal": ["..OO....OO.."],
    "happy": ["..UU....UU.."],
    "hungry": ["..oo....oo.."],
    "sleep": ["..--....--.."],
    "eat": ["..OO....OO.."],
}
FROG_HEAD = [".kkkkkkkkkk."]
FROG_MOUTH = {
    "normal": [".kkNNNNNNkk."],
    "happy": [".kkNUUUUNkk."],
    "eat": [".kkOVVVVOkk."],
}
FROG_BODY = ["..kkkkkkkk.."]
FROG_FEET = {
    "down": [".kWk....kWk."],
    "left": [".kLk....kWk."],
    "right": [".kWk....kLk."],
    "tuck": ["...kkkkkk..."],
}

FROG_WALK = [
    frame(FROG_EYES["normal"] + FROG_HEAD + FROG_MOUTH["normal"] + FROG_HEAD + FROG_BODY + FROG_FEET["down"]),
    frame(FROG_EYES["normal"] + FROG_HEAD + FROG_MOUTH["normal"] + FROG_HEAD + FROG_BODY + FROG_FEET["down"]),
    frame(FROG_EYES["normal"] + FROG_HEAD + FROG_MOUTH["normal"] + FROG_HEAD + FROG_BODY + FROG_FEET["down"]),
    frame(FROG_EYES["normal"] + FROG_HEAD + FROG_MOUTH["normal"] + FROG_HEAD + FROG_BODY + FROG_FEET["down"]),
]
FROG_HAPPY = [
    frame(FROG_EYES["happy"] + FROG_HEAD + FROG_MOUTH["happy"] + FROG_HEAD + FROG_BODY + FROG_FEET["down"]),
    frame(FROG_EYES["happy"] + FROG_HEAD + FROG_MOUTH["happy"] + FROG_HEAD + FROG_BODY + FROG_FEET["left"]),
]
FROG_HUNGRY = [
    frame(FROG_EYES["hungry"] + [FROG_HEAD[0] + " ?"] + FROG_MOUTH["normal"] + FROG_HEAD + FROG_BODY + FROG_FEET["down"]),
    frame(FROG_EYES["hungry"] + [FROG_HEAD[0] + "  ?"] + FROG_MOUTH["normal"] + FROG_HEAD + FROG_BODY + FROG_FEET["left"]),
]
FROG_SLEEP = [
    frame([FROG_EYES["sleep"][0] + " z"] + FROG_HEAD + FROG_MOUTH["normal"] + FROG_HEAD + FROG_BODY + FROG_FEET["down"]),
    frame([FROG_EYES["sleep"][0] + "  z"] + FROG_HEAD + FROG_MOUTH["normal"] + FROG_HEAD + FROG_BODY + FROG_FEET["down"]),
]
FROG_JUMP = [
    frame(FROG_EYES["happy"] + FROG_HEAD + FROG_MOUTH["happy"] + FROG_HEAD + FROG_BODY + FROG_FEET["tuck"]),
    frame(FROG_EYES["normal"] + FROG_HEAD + FROG_MOUTH["normal"] + FROG_HEAD + FROG_BODY + FROG_FEET["down"]),
]
FROG_BLINK = frame(FROG_EYES["sleep"] + FROG_HEAD + FROG_MOUTH["normal"] + FROG_HEAD + FROG_BODY + FROG_FEET["down"])
FROG_EAT = frame(FROG_EYES["eat"] + FROG_HEAD + FROG_MOUTH["eat"] + FROG_HEAD + FROG_BODY + FROG_FEET["down"])

POOP = [
    "....kkkk....",
    "..kkkkkkkk..",
    "kkkkkkkkkkkk",
]

SKINS = {
    "cat": {"walk": CAT_WALK, "happy": CAT_HAPPY, "hungry": CAT_HUNGRY, "sleep": CAT_SLEEP, "jump": CAT_JUMP, "blink": CAT_BLINK, "eat": CAT_EAT},
    "dog": {"walk": DOG_WALK, "happy": DOG_HAPPY, "hungry": DOG_HUNGRY, "sleep": DOG_SLEEP, "jump": DOG_JUMP, "blink": DOG_BLINK, "eat": DOG_EAT},
    "frog": {"walk": FROG_WALK, "happy": FROG_HAPPY, "hungry": FROG_HUNGRY, "sleep": FROG_SLEEP, "jump": FROG_JUMP, "blink": FROG_BLINK, "eat": FROG_EAT},
}


def to_glyphs(rows):
    return ["".join(GLYPH.get(ch, ch) for ch in row) for row in rows]


def validate():
    errors = []
    for skin, poses in SKINS.items():
        if len(poses["walk"]) < 4:
            errors.append(f"{skin}: walk needs 4 frames")
        for name in ("happy", "hungry", "sleep", "jump"):
            if len(poses[name]) < 2:
                errors.append(f"{skin}: {name} needs a pair")
        frames = poses["walk"] + poses["happy"] + poses["hungry"] + poses["sleep"] + poses["jump"] + [poses["blink"], poses["eat"]]
        heights = {len(f) for f in frames}
        if len(heights) != 1:
            errors.append(f"{skin}: mixed heights {sorted(heights)}")
        h = next(iter(heights))
        if not 2 <= h <= 8:
            errors.append(f"{skin}: height {h} out of range")
        for f in frames:
            for line in f:
                if not line.strip():
                    errors.append(f"{skin}: blank line in a frame")
                for ch in line:
                    if ch != " " and ch not in GLYPH and ch not in TEXT_GLYPHS:
                        errors.append(f"{skin}: unknown glyph {ch!r}")
    if errors:
        raise SystemExit("pixel-art validation failed:\n" + "\n".join(errors))


BS = chr(92)


def ts_escape(s):
    return s.replace(BS, BS + BS).replace('"', BS + '"')


def ts_str(rows):
    return '"' + (BS + "n").join(ts_escape(r) for r in to_glyphs(rows)) + '"'


def ts_letters(rows):
    return '"' + (BS + "n").join(ts_escape(r) for r in rows) + '"'


def emit_ts():
    out = [
        "// GENERATED by scripts/pixel-art.py — do not hand-edit.",
        "// Regenerate: python scripts/pixel-art.py",
        "",
    ]
    for skin, poses in SKINS.items():
        tag = skin.upper()
        out.append(f"export const {tag}4_WALK_RIGHT: string[] = [")
        out.extend(f"  {ts_str(f)}," for f in poses["walk"])
        out.append("];")
        for name in ("happy", "hungry", "sleep", "jump"):
            out.append(f"export const {tag}4_{name.upper()}: string[] = [")
            out.extend(f"  {ts_str(f)}," for f in poses[name])
            out.append("];")
        out.append(f"export const {tag}4_BLINK: string = {ts_str(poses['blink'])};")
        out.append(f"export const {tag}4_EAT: string = {ts_str(poses['eat'])};")
        out.append(f"export const {tag}4_COLORS = {{")
        out.append("  walkRight: [")
        out.extend(f"    {ts_letters(f)}," for f in poses["walk"])
        out.append("  ],")
        for name in ("happy", "hungry", "sleep", "jump"):
            out.append(f"  {name}: [")
            out.extend(f"    {ts_letters(f)}," for f in poses[name])
            out.append("  ],")
        out.append(f"  blink: {ts_letters(poses['blink'])},")
        out.append(f"  eat: {ts_letters(poses['eat'])},")
        out.append("};")
        out.append("")
    out.append(f"export const POOP4: string = {ts_str(POOP)};")
    out.append("")
    OUT_TS.write_text(chr(10).join(out), encoding="utf-8")


def png_chunk(ctype: bytes, data: bytes) -> bytes:
    out = struct.pack(">I", len(data)) + ctype + data
    return out + struct.pack(">I", zlib.crc32(ctype + data) & 0xFFFFFFFF)


def encode_png(w: int, h: int, pixels: bytes) -> bytes:
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    raw = b"".join(b"\x00" + pixels[y * w * 4:(y + 1) * w * 4] for y in range(h))
    return (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", zlib.compress(raw, 9))
        + png_chunk(b"IEND", b"")
    )


def render_png(skin: str, rows, cell=8) -> bytes:
    fur = SKIN_RGB.get(skin, {})
    h = len(rows)
    w = max(len(r) for r in rows)
    px = bytearray()
    for y in range(h * cell):
        row = rows[y // cell]
        for x in range(w * cell):
            ch = row[x // cell] if x // cell < len(row) else "."
            if ch in fur:
                px += bytes(fur[ch])
            else:
                px += bytes(RGB_BASE.get(ch, (10, 10, 14, 255)))
    return encode_png(w * cell, h * cell, bytes(px))


def emit_png():
    ASSETS.mkdir(exist_ok=True)
    for skin, poses in SKINS.items():
        (ASSETS / f"pixel-{skin}.png").write_bytes(render_png(skin, poses["walk"][0]))
    (ASSETS / "pixel-poop.png").write_bytes(render_png("poop", POOP))


def preview():
    for skin, poses in SKINS.items():
        print(f"===== {skin} =====")
        try:
            for row in to_glyphs(poses["walk"][0]):
                print(row)
        except Exception:
            for row in poses["walk"][0]:
                print(row)


def main() -> None:
    validate()
    emit_ts()
    emit_png()
    preview()
    print(f"wrote {OUT_TS} + assets/pixel-*.png")


if __name__ == "__main__":
    main()
