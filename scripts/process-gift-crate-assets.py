#!/usr/bin/env python3
"""Build web-ready gift crate break animation assets from a chroma-key sheet."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable

from PIL import Image


FRAME_COUNT = 6
FRAME_DURATION_MS = 140
KEY_COLOR = (255, 0, 255)
TRANSPARENT_THRESHOLD = 18
OPAQUE_THRESHOLD = 130
ALPHA_NOISE_FLOOR = 8

FRAME_STATES = [
    ("intact", "intact closed gift crate"),
    ("small-cracks", "small visible cracks"),
    ("deep-cracks", "deeper cracks and loosened ribbon"),
    ("lid-splitting", "lid splitting open"),
    ("breaking-apart", "crate breaking apart"),
    ("broken-pieces", "final broken pieces and debris"),
]


def smoothstep(value: float) -> float:
    clamped = max(0.0, min(1.0, value))
    return clamped * clamped * (3.0 - 2.0 * clamped)


def channel_distance(rgb: tuple[int, int, int], key: tuple[int, int, int]) -> int:
    return max(abs(rgb[0] - key[0]), abs(rgb[1] - key[1]), abs(rgb[2] - key[2]))


def is_key_like(rgb: tuple[int, int, int]) -> bool:
    red, green, blue = rgb
    return red >= 160 and blue >= 160 and green <= 140 and min(red, blue) - green >= 35


def alpha_for_pixel(rgb: tuple[int, int, int]) -> int:
    distance = channel_distance(rgb, KEY_COLOR)
    if distance <= TRANSPARENT_THRESHOLD:
        return 0
    if not is_key_like(rgb):
        return 255
    if distance >= OPAQUE_THRESHOLD:
        return 255

    ratio = (distance - TRANSPARENT_THRESHOLD) / (OPAQUE_THRESHOLD - TRANSPARENT_THRESHOLD)
    alpha = round(255 * smoothstep(ratio))
    return 0 if alpha <= ALPHA_NOISE_FLOOR else alpha


def despill_pixel(rgb: tuple[int, int, int], alpha: int) -> tuple[int, int, int]:
    if alpha >= 252:
        return rgb

    red, green, blue = rgb
    if not is_key_like(rgb):
        return rgb

    cap = max(green + 18, 0)
    return (min(red, cap), green, min(blue, cap))


def remove_key(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()

    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, existing_alpha = pixels[x, y]
            rgb = (red, green, blue)
            alpha = round(alpha_for_pixel(rgb) * (existing_alpha / 255))

            if alpha == 0:
                pixels[x, y] = (0, 0, 0, 0)
                continue

            clean_rgb = despill_pixel(rgb, alpha)
            pixels[x, y] = (*clean_rgb, alpha)

    return rgba


def composite_on_white(image: Image.Image) -> Image.Image:
    background = Image.new("RGBA", image.size, (255, 255, 255, 255))
    background.alpha_composite(image)
    return background.convert("RGB")


def frame_filename(index: int, slug: str) -> str:
    return f"frame-{index + 1:02d}-{slug}.png"


def save_png(image: Image.Image, path: Path) -> None:
    image.save(path, "PNG", optimize=True)


def build_frame(source: Image.Image, column_index: int, frame_size: int) -> Image.Image:
    column_width = source.width // FRAME_COUNT
    left = column_index * column_width
    right = left + column_width if column_index < FRAME_COUNT - 1 else source.width
    crop = source.crop((left, 0, right, source.height))
    keyed = remove_key(crop)
    frame = Image.new("RGBA", (frame_size, frame_size), (0, 0, 0, 0))
    frame.alpha_composite(keyed, ((frame_size - keyed.width) // 2, (frame_size - keyed.height) // 2))
    return frame


def build_sheet(frames: Iterable[Image.Image], *, white: bool, frame_size: int) -> Image.Image:
    mode = "RGB" if white else "RGBA"
    background = (255, 255, 255) if white else (0, 0, 0, 0)
    sheet = Image.new(mode, (frame_size * FRAME_COUNT, frame_size), background)

    for index, frame in enumerate(frames):
        output_frame = composite_on_white(frame) if white else frame
        sheet.paste(output_frame, (index * frame_size, 0), None if white else output_frame)

    return sheet


def write_metadata(output_dir: Path, frame_size: int) -> None:
    frames = [
        {
            "index": index + 1,
            "file": frame_filename(index, slug),
            "state": state,
            "durationMs": FRAME_DURATION_MS,
        }
        for index, (slug, state) in enumerate(FRAME_STATES)
    ]
    metadata = {
        "frameCount": FRAME_COUNT,
        "frameWidth": frame_size,
        "frameHeight": frame_size,
        "durationMs": FRAME_DURATION_MS,
        "loop": False,
        "sheets": {
            "white": "gift-crate-break-sheet-white.png",
            "transparent": "gift-crate-break-sheet-transparent.png",
        },
        "frames": frames,
    }
    (output_dir / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")


def process_assets(source_path: Path, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    with Image.open(source_path) as image:
        source = image.convert("RGB")

    if source.width % FRAME_COUNT != 0:
        raise ValueError(f"Source width {source.width} is not divisible by {FRAME_COUNT}")

    frame_size = max(source.height, source.width // FRAME_COUNT)
    frames = [build_frame(source, index, frame_size) for index in range(FRAME_COUNT)]

    for index, frame in enumerate(frames):
        slug, _ = FRAME_STATES[index]
        save_png(frame, output_dir / frame_filename(index, slug))

    save_png(
        build_sheet(frames, white=True, frame_size=frame_size),
        output_dir / "gift-crate-break-sheet-white.png",
    )
    save_png(
        build_sheet(frames, white=False, frame_size=frame_size),
        output_dir / "gift-crate-break-sheet-transparent.png",
    )
    write_metadata(output_dir, frame_size)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Generated chroma-key sprite sheet PNG.")
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("public/gift-crate"),
        help="Directory for web-ready assets.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    process_assets(args.source, args.out_dir)


if __name__ == "__main__":
    main()
