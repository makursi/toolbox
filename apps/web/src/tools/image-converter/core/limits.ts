import type { Refusal } from "./refusal";

/**
 * How much work one file may cost before the browser falls over.
 *
 * Every Tool runs in a tab, so an unbounded batch is a way to freeze the page
 * rather than a way to convert images. The byte limit is checked before
 * decoding; the pixel limit can only be checked once the file has been decoded,
 * because browsers disagree about what a canvas does past its area limit
 * (throw, blank, or clamp) and refusing early is the only behaviour that is the
 * same everywhere.
 */
export type Limits = {
  maxBytes: number;
  maxPixels: number;
};

export const defaultLimits: Limits = {
  maxBytes: 100 * 1024 * 1024,
  maxPixels: 268_435_456,
};

export type LimitFailure = Refusal & {
  reason: "too-large" | "too-many-pixels";
};

export type LimitResult = { ok: true } | LimitFailure;

/** Dimensions are optional: they are only known once the file has been decoded. */
export function checkLimits(
  input: { bytes?: number; width?: number; height?: number },
  limits: Limits = defaultLimits,
): LimitResult {
  if (input.bytes !== undefined && input.bytes > limits.maxBytes) {
    return {
      ok: false,
      reason: "too-large",
      message: `这个文件有 ${megabytes(input.bytes)} MB，上限是 ${megabytes(limits.maxBytes)} MB。`,
    };
  }

  if (input.width !== undefined && input.height !== undefined) {
    const pixels = input.width * input.height;
    if (pixels > limits.maxPixels) {
      return {
        ok: false,
        reason: "too-many-pixels",
        message: `这张图有 ${input.width}×${input.height} 像素，上限是 ${formatPixels(limits.maxPixels)}。`,
      };
    }
  }

  return { ok: true };
}

function megabytes(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}

/**
 * Chinese counts pixels in 万 and 亿; a megapixel is not a unit this interface
 * uses anywhere else, and "268 megapixels" was the one English phrase left in a
 * sentence a visitor reads. The name says it returns text, unlike its sibling
 * `megabytes`, which returns a number for the message to wrap.
 */
function formatPixels(count: number): string {
  if (count >= 100_000_000) return `${(count / 100_000_000).toFixed(2)} 亿像素`;
  // Under 万 the number itself is the clearest thing to say: rounding 5000 would
  // produce "1 万像素", which is not what the limit is.
  if (count < 10_000) return `${count} 像素`;

  return `${Math.round(count / 10_000)} 万像素`;
}
