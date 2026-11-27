import type { ImageSize } from "@/lib/image-header";

/**
 * The card's frame, and the sentence a cover that does not fill it earns.
 *
 * A Tool Card reserves a 4:3 frame and paints the cover into it with
 * `object-fit: cover`, so the claim this module checks is **the file covers the
 * card's 4:3 box**, not "the file is 4:3". A 16:9 cover still covers the card
 * when the frame its crop leaves is big enough: the Cover Generator's
 * 1920×1080 file leaves 1440×1080, which passes.
 *
 * The floor is 1320×990, and it is a quality margin rather than the point at
 * which the card runs out of pixels: the frame is 220×165 on a wide screen
 * (`md:w-[220px]` at 4:3, capped at 180px tall) and at most about 240×180 on a
 * phone, so even a 660×495 cover is still downscaled, and the true upscale
 * point is around 480×360. 1320×990 is six times the wide card's box — three
 * times the 440×330 a 2× screen needs — which is the margin the register's rule
 * buys. The floor is expressed for the 4:3 frame, so the numbers mean the same
 * thing whatever ratio the source file has.
 *
 * The same floor is written twice on purpose: `scripts/assets.py` refuses at
 * write time and this module refuses at read time, so neither is a stray copy.
 * The script floors its derived side exactly as `centredFrame` does, so the box
 * the command writes is the box this measures.
 */

/** The two sides of a ratio in their reduced terms — a shape, not pixels. */
type Ratio = readonly [width: number, height: number];

/** The card's frame: the 4:3 shape the card reserves for a cover. */
const cardRatio: Ratio = [4, 3];

/**
 * The smallest 4:3 frame a cover may leave: a quality margin six times the
 * card's 220×165 wide-screen box, not the point at which it would upscale.
 */
const cardFloor: ImageSize = { width: 1320, height: 990 };

/**
 * The largest centred 4:3 frame that fits inside `size`.
 *
 * The derived side is floored, never rounded: the floored side is the largest
 * one that still has the ratio, and a rounded side would exceed it. For a
 * 1001×1000 source the height is 1001×3/4 = 750.75, so 750 is the largest whole
 * height the 4:3 box allows; 751 would be taller than the ratio permits, even
 * though the source itself is 1000 tall.
 */
export function centredFrame(size: ImageSize): ImageSize {
  const [ratioWidth, ratioHeight] = cardRatio;

  if (size.width * ratioHeight <= size.height * ratioWidth) {
    return {
      width: size.width,
      height: Math.floor((size.width * ratioHeight) / ratioWidth),
    };
  }

  return {
    width: Math.floor((size.height * ratioWidth) / ratioHeight),
    height: size.height,
  };
}

/**
 * The sentence a maintainer can act on, or `null` when the cover fills the card.
 *
 * `cover` is the URL the registry declares, so the sentence points at the exact
 * string to fix. The numbers are all in it — the file's size, the frame its
 * centred 4:3 crop leaves, and the floor — because "too small" alone sends the
 * reader back to the image to measure it again.
 */
export function coverFrameRefusal(cover: string, size: ImageSize | null): string | null {
  if (size === null) {
    return `cover ${cover} has no readable header: its bytes are not a JPEG, PNG or WebP this reader knows`;
  }

  const frame = centredFrame(size);

  if (frame.width >= cardFloor.width && frame.height >= cardFloor.height) return null;

  return `cover ${cover} is ${size.width}×${size.height}; its centred 4:3 frame is ${frame.width}×${frame.height}, under the card's ${cardFloor.width}×${cardFloor.height} minimum`;
}
