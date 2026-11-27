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
 * The floor is 1320×990: below it the card would upscale the file and the
 * visitor would see a blur. The floor is expressed for the 4:3 frame, so the
 * numbers mean the same thing whatever ratio the source file has.
 */

/** The card's frame: the 4:3 shape the card reserves for a cover. */
const cardRatio: ImageSize = { width: 4, height: 3 };

/** The smallest frame the card can show at its width without upscaling. */
const cardFloor: ImageSize = { width: 1320, height: 990 };

/**
 * The largest centred box of `ratio` that fits inside `size`.
 *
 * The derived side is floored, never rounded: this number is the frame the card
 * can actually fill, so a fraction of a pixel is pixels the file does not have.
 * Rounding up would let a 1319-pixel source claim 990 and pass a check written
 * for a 989-pixel frame.
 */
export function centredFrame(size: ImageSize, ratio: ImageSize = cardRatio): ImageSize {
  if (size.width === 0 || size.height === 0) return { width: 0, height: 0 };

  if (size.width * ratio.height <= size.height * ratio.width) {
    return {
      width: size.width,
      height: Math.floor((size.width * ratio.height) / ratio.width),
    };
  }

  return {
    width: Math.floor((size.height * ratio.width) / ratio.height),
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
    return `cover ${cover} has no pixel size this reader can read: its header is not a JPEG, PNG or WebP it knows`;
  }

  const frame = centredFrame(size);

  if (frame.width >= cardFloor.width && frame.height >= cardFloor.height) return null;

  return `cover ${cover} is ${size.width}×${size.height}; its centred 4:3 frame is ${frame.width}×${frame.height}, under the card's ${cardFloor.width}×${cardFloor.height} minimum`;
}
