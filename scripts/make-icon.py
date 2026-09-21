"""Generate assets/icon.png + assets/icon.ico from procedural pixel art.

Stdlib only (struct/zlib) so any agent or CI can regenerate:
    python scripts/make-icon.py
"""
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

# 32x32 pixel-art cat on a rounded dark tile. Letters are palette keys.
ART = [
    "...............................",
    "..RRRRRRRRRRRRRRRRRRRRRRRRRR...",
    ".RkkkkkkkkkkkkkkkkkkkkkkkkkkR..",
    ".RkkWWkkkkkkkkkkkkkkkkkkWWkkR..",
    ".RkWWWWkkkkkkkkkkkkkkkkWWWWkR..",
    ".RkWWWWkkkkkkkkkkkkkkkkWWWWkR..",
    ".RkkWWkkkkkkkkkkkkkkkkkkWWkkR..",
    ".RkkkkkkkkkkkkkkkkkkkkkkkkkkR..",
    ".RkkkkOOkkkkkkkkkkkkkkOOkkkkR..",
    ".RkkkOOOOkkkkkkkkkkkkOOOOkkkR..",
    ".RkkkOOOOkkkkkkkkkkkkOOOOkkkR..",
    ".RkkkkOOkkkkkkkkkkkkkkOOkkkkR..",
    ".RkkkkkkkkkkkNNkkkkkkkkkkkkR..",
    ".RkkkkkkkkkkNNNNkkkkkkkkkkkR..",
    ".RkkkkkkkkkkNNNNkkkkkkkkkkkR..",
    ".RkkkkkkkkkkkNNkkkkkkkkkkkkR..",
    ".RkkkkkkkkWWkkkkkkWWkkkkkkkR..",
    ".RkkkkkkkWWWWkkkkWWWWkkkkkkR..",
    ".RkkkkkkkWWWWkkkkWWWWkkkkkkR..",
    ".RkkkkkkkkWWkkkkkkWWkkkkkkkR..",
    ".RkkkkkkkkkkkkkkkkkkkkkkkkkR..",
    ".RkkkDDkkkkkkkkkkkkkkkkDDkkkR..",
    ".RkkkDDDkkkkkkkkkkkkkkDDDkkkR..",
    ".RkkkkDDDkkkkkkkkkkkDDDkkkkR..",
    ".RkkkkkDDDDkkkkkkkDDDDkkkkkR..",
    ".RkkkkkkkDDDDDDDDDDDkkkkkkkR..",
    ".RkkkkkkkkkkkkkkkkkkkkkkkkkR..",
    "..RkkkkkkkkkkkkkkkkkkkkkkkR...",
    "...RRRRRRRRRRRRRRRRRRRRRRR....",
    "...............................",
    "...............................",
    "...............................",
]

PALETTE = {
    ".": (0, 0, 0, 0),          # transparent
    "R": (0, 0, 0, 0),          # tile corner cutout
    "k": (244, 164, 96, 255),   # sandy fur
    "W": (255, 255, 255, 255),  # white (inner ear / muzzle)
    "O": (30, 30, 46, 255),     # dark (eyes)
    "N": (236, 112, 144, 255),  # pink nose
    "D": (120, 70, 40, 255),    # stripes
}

TILE = (30, 30, 46, 255)  # dark tile matching dark taskbars
TILE_R = 6


def in_tile(x: int, y: int, w: int, h: int) -> bool:
    if TILE_R <= x < w - TILE_R or TILE_R <= y < h - TILE_R:
        return True
    cx = min(max(x, TILE_R), w - 1 - TILE_R)
    cy = min(max(y, TILE_R), h - 1 - TILE_R)
    return (x - cx) ** 2 + (y - cy) ** 2 <= TILE_R**2


def render(size: int) -> bytes:
    n = len(ART)
    px = bytearray()
    for y in range(size):
        row = ART[(y * n) // size]
        m = len(row)
        for x in range(size):
            ch = row[(x * m) // size]
            if ch == "R":
                r, g, b, a = TILE if in_tile(x, y, size, size) else (0, 0, 0, 0)
            else:
                r, g, b, a = PALETTE[ch]
            px += bytes((r, g, b, a))
    return bytes(px)


def png_chunk(ctype: bytes, data: bytes) -> bytes:
    out = struct.pack(">I", len(data)) + ctype + data
    return out + struct.pack(">I", zlib.crc32(ctype + data) & 0xFFFFFFFF)


def encode_png(size: int, pixels: bytes) -> bytes:
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    raw = b"".join(b"\x00" + pixels[y * size * 4:(y + 1) * size * 4] for y in range(size))
    return (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", zlib.compress(raw, 9))
        + png_chunk(b"IEND", b"")
    )


def encode_ico(pngs: list[bytes], sizes: list[int]) -> bytes:
    header = struct.pack("<HHH", 0, 1, len(pngs))
    offset = 6 + 16 * len(pngs)
    entries = b""
    for png, size in zip(pngs, sizes):
        w = size if size < 256 else 0
        entries += struct.pack("<BBBBHHII", w, w, 0, 0, 1, 32, len(png), offset)
        offset += len(png)
    return header + entries + b"".join(pngs)


def main() -> None:
    ASSETS.mkdir(exist_ok=True)
    sizes = [16, 32, 48, 64, 128, 256]
    pngs = [encode_png(s, render(s)) for s in sizes]
    (ASSETS / "icon.png").write_bytes(pngs[-1])
    (ASSETS / "icon.ico").write_bytes(encode_ico(pngs, sizes))
    (ASSETS / "icon-16.png").write_bytes(pngs[0])
    print(f"wrote {ASSETS / 'icon.png'}, {ASSETS / 'icon.ico'} and {ASSETS / 'icon-16.png'}")


if __name__ == "__main__":
    main()
