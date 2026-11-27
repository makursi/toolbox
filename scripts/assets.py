#!/usr/bin/env python3
"""Cover pipeline for the Tool Registry.

Crops a supplied illustration to the card's frame, re-encodes it as JPEG, and
puts the two files where `apps/web/docs/design/assets.md` says they belong:

    apps/web/assets/tools/<slug>/cover.<ext>   the source of record (not served)
    apps/web/public/tools/<slug>/cover.jpg     the cover the card loads

The geometry is fixed: apply EXIF orientation, flatten any alpha onto white,
take the largest centred box of the ratio (4:3 by default), and refuse the
source if that box is under 1320x990 -- never upscale. The output is 1440 wide
by default, capped at the crop's own width; its centred 4:3 frame is then
measured and refused when that is under 1320x990 too, so `--ratio` and
`--width` cannot write a cover the card's assertion rejects (`--ratio 16:9
--width 1920` passes; `--ratio 16:9 --width 1440` and `--width 800` do not).
The output is re-encoded as a JPEG at quality 88, which is irreversible.

The default copies the input and leaves it in place. `--move` deletes the
input once both files are written, whatever path it is given -- the drop box
(`apps/web/assets/inbox/`) is its purpose, not its boundary -- and keeps an
input that is already one of the destinations. A failed run never consumes the
input: the served cover is written before the input is removed. The slug must
be kebab-case, so a path cannot escape the asset tree.

    python scripts/assets.py cover --slug rich-text-editor --input path/to/source.jpg
    python scripts/assets.py cover --slug rich-text-editor --input inbox/x.jpg --move
    python scripts/assets.py cover --slug rich-text-editor --input source.jpg --dry-run

A dry run prints the source size, the crop box, the output size and both paths,
and writes nothing, directories included. Requires Pillow (`python -m pip
install Pillow`) and nothing else.
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

#: The card's frame is 4:3 and at least 1320x990 (assets.md). The floor is
#: written twice on purpose: this refuses at write time, `cover-frame.ts`
#: refuses at read time, so neither is a stray copy. `centred_crop` floors its
#: derived side exactly as that file's `centredFrame` does, so the box written
#: here is the box measured there.
MIN_SIZE = (1320, 990)
#: The card's own shape, which the output is measured against whatever `--ratio` is.
CARD_RATIO = (4, 3)
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
    """The largest box of `ratio` inside `size`, centred.

    The derived side is floored with `//`, matching `centredFrame` in
    `apps/web/src/lib/cover-frame.ts`: a rounded side would exceed the ratio, so
    the box written here is the box that assertion measures.
    """
    width, height = size
    rw, rh = ratio
    if width * rh >= height * rw:
        cropped_width = height * rw // rh
        left = (width - cropped_width) // 2
        return left, 0, left + cropped_width, height
    cropped_height = width * rh // rw
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
        # The card crops its own 4:3 frame out of this output, so measure that
        # frame after the cap and the resize decide the size -- the knobs may not
        # write a cover the read-time assertion refuses.
        frame_left, frame_top, frame_right, frame_bottom = centred_crop((width, height), CARD_RATIO)
        frame_width, frame_height = frame_right - frame_left, frame_bottom - frame_top
        if frame_width < MIN_SIZE[0] or frame_height < MIN_SIZE[1]:
            print(
                f"--ratio {args.ratio[0]}:{args.ratio[1]} --width {args.width} writes "
                f"{width}x{height}, whose centred 4:3 frame is {frame_width}x{frame_height}, "
                f"under the {MIN_SIZE[0]}x{MIN_SIZE[1]} frame",
                file=sys.stderr,
            )
            return 1
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

    # An input that is already a destination is the thing a re-run reproduces,
    # not a thing to overwrite or delete.
    keeps_source = source in {source_target.resolve(), public_target.resolve()}

    source_target.parent.mkdir(parents=True, exist_ok=True)
    public_target.parent.mkdir(parents=True, exist_ok=True)
    if source_target.resolve() != source:
        shutil.copy2(source, source_target)
        print(f"copied   source of record, {source_target.stat().st_size:,} bytes")
    else:
        print("copied   source is already the source of record")

    cropped.save(public_target, "JPEG", quality=args.quality, optimize=True, subsampling=2)
    print(f"wrote    {public_target.stat().st_size:,} bytes at quality {args.quality}")

    # The served cover is on disk before the input goes, so any failure above
    # leaves the drop box exactly as it was.
    if args.move:
        if keeps_source:
            print("kept     input is already a destination")
        else:
            source.unlink()
            print(f"moved    consumed {source.name}")
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
    cover_parser.add_argument(
        "--move",
        action="store_true",
        help=(
            "delete the input once both files are written, keeping one that is "
            "already a destination; the drop box is its purpose, not its boundary"
        ),
    )
    cover_parser.set_defaults(run=cover)

    args = parser.parse_args(argv)
    return args.run(args)


if __name__ == "__main__":
    raise SystemExit(main())
