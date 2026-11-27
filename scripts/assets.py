#!/usr/bin/env python3
"""Cover pipeline for the Tool Registry.

Crops a supplied illustration to the card's frame, re-encodes it as JPEG, and
puts the two files where `apps/web/docs/design/assets.md` says they belong:

    apps/web/assets/tools/<slug>/cover.<ext>   the source of record (not served)
    apps/web/public/tools/<slug>/cover.jpg     the cover the card loads

The crop is centred and never upscales: a source smaller than the minimum frame
is refused rather than enlarged. EXIF orientation is applied before the crop,
so a phone photo is not laid down sideways. The source is copied, never moved,
and kept so the crop can be redone; the output is a JPEG re-encode, which is
irreversible.

    python scripts/assets.py cover --slug rich-text-editor --input path/to/source.jpg
    python scripts/assets.py cover --slug rich-text-editor --input source.jpg --dry-run

Requires Pillow (`python -m pip install Pillow`) and nothing else.
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover - the message is the point
    sys.exit("Pillow is not installed. Run: python -m pip install Pillow")

REPO = Path(__file__).resolve().parent.parent
WEB = REPO / "apps" / "web"
PUBLIC = WEB / "public"
ASSETS = WEB / "assets"

#: The card's frame is 4:3 and at least 1320x990 (assets.md).
MIN_SIZE = (1320, 990)
DEFAULT_RATIO = "4:3"
DEFAULT_WIDTH = 1440
DEFAULT_QUALITY = 88
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]*$")


def parse_ratio(text: str) -> tuple[int, int]:
    match = re.fullmatch(r"\s*(\d+)\s*:\s*(\d+)\s*", text)
    if match is None or int(match[1]) == 0 or int(match[2]) == 0:
        raise argparse.ArgumentTypeError(f"not a ratio like 4:3: {text!r}")
    return int(match[1]), int(match[2])


def parse_slug(text: str) -> str:
    if SLUG.fullmatch(text) is None:
        raise argparse.ArgumentTypeError(f"not a kebab-case slug: {text!r}")
    return text


def centred_crop(size: tuple[int, int], ratio: tuple[int, int]) -> tuple[int, int, int, int]:
    """The largest box of `ratio` inside `size`, centred."""
    width, height = size
    rw, rh = ratio
    if width * rh >= height * rw:
        cropped_width = round(height * rw / rh)
        left = (width - cropped_width) // 2
        return left, 0, left + cropped_width, height
    cropped_height = round(width * rh / rw)
    top = (height - cropped_height) // 2
    return 0, top, width, top + cropped_height


def flatten(image: Image.Image) -> Image.Image:
    """Apply EXIF orientation and drop alpha onto white, the card's own ground."""
    image = ImageOps.exif_transpose(image)
    if image.mode in {"RGBA", "LA", "P"}:
        rgba = image.convert("RGBA")
        ground = Image.new("RGB", rgba.size, "white")
        ground.paste(rgba, mask=rgba.getchannel("A"))
        return ground
    return image.convert("RGB")


def cover(args: argparse.Namespace) -> int:
    source = Path(args.input).expanduser().resolve()
    if not source.is_file():
        print(f"no such input: {source}", file=sys.stderr)
        return 1

    with Image.open(source) as opened:
        image = flatten(opened)
        box = centred_crop(image.size, args.ratio)
        cropped = image.crop(box)
        if cropped.width < MIN_SIZE[0] or cropped.height < MIN_SIZE[1]:
            print(
                f"{source.name} is {image.width}x{image.height}; its {args.ratio[0]}:{args.ratio[1]} "
                f"crop is {cropped.width}x{cropped.height}, under the {MIN_SIZE[0]}x{MIN_SIZE[1]} frame",
                file=sys.stderr,
            )
            return 1
        width = min(args.width, cropped.width)
        height = round(width * cropped.height / cropped.width)
        if width != cropped.width:
            cropped = cropped.resize((width, height), Image.Resampling.LANCZOS)

    suffix = source.suffix.lower()
    source_target = ASSETS / "tools" / args.slug / f"cover{suffix}"
    public_target = PUBLIC / "tools" / args.slug / "cover.jpg"

    print(f"source   {source}")
    print(f"         {image.width}x{image.height}, {source.stat().st_size:,} bytes")
    print(f"crop     {box[2] - box[0]}x{box[3] - box[1]} at {box[0]},{box[1]}")
    print(f"cover    {width}x{height}, ratio {args.ratio[0]}:{args.ratio[1]}")
    print(f"asset    {source_target.relative_to(REPO)}")
    print(f"served   {public_target.relative_to(REPO)}")

    if args.dry_run:
        print("dry run: nothing written")
        return 0

    source_target.parent.mkdir(parents=True, exist_ok=True)
    if source_target.resolve() != source:
        shutil.copy2(source, source_target)
        print(f"copied   source of record, {source_target.stat().st_size:,} bytes")
    else:
        print("copied   source is already the source of record")

    public_target.parent.mkdir(parents=True, exist_ok=True)
    cropped.save(public_target, "JPEG", quality=args.quality, optimize=True, subsampling=2)
    print(f"wrote    {public_target.stat().st_size:,} bytes at quality {args.quality}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Cover pipeline for the Tool Registry.")
    sub = parser.add_subparsers(dest="command", required=True)

    cover_parser = sub.add_parser("cover", help="crop a supplied image to the card's frame")
    cover_parser.add_argument("--slug", required=True, type=parse_slug)
    cover_parser.add_argument("--input", required=True)
    cover_parser.add_argument("--ratio", default=DEFAULT_RATIO, type=parse_ratio)
    cover_parser.add_argument("--width", default=DEFAULT_WIDTH, type=int)
    cover_parser.add_argument("--quality", default=DEFAULT_QUALITY, type=int)
    cover_parser.add_argument("--dry-run", action="store_true")
    cover_parser.set_defaults(run=cover)

    args = parser.parse_args(argv)
    return args.run(args)


if __name__ == "__main__":
    raise SystemExit(main())
