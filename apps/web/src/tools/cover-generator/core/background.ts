/**
 * The background post-processing: blur and grayscale, applied to the background
 * image only. Both are a 0–100 strength in the composition; the blur maps
 * through a quadratic ease to a 50px ceiling (the ThisCover feel — small values
 * are barely visible, the top end is 50px), while grayscale is linear. The
 * functions emit the complete CSS filter fragment, so the render layer only
 * joins them — it carries no `px`/`%` arithmetic of its own.
 */

/** The blur ceiling, in pixels, a strength of 100 reaches. */
const MAX_BLUR_PX = 50;

/** The blur ease exponent: 2 is quadratic. */
const BLUR_EXPONENT = 2;

/** Clamp a slider strength into the 0–100 range it is defined on. */
function clamp(strength: number): number {
  return Math.min(Math.max(strength, 0), 100);
}

/** The blur strength (0–100) as a complete CSS filter, e.g. `blur(12.50px)`. */
export function blurFilter(strength: number): string {
  const ratio = clamp(strength) / 100;
  const px = (MAX_BLUR_PX * ratio ** BLUR_EXPONENT).toFixed(2);
  return `blur(${px}px)`;
}

/** The grayscale strength (0–100) as a complete CSS filter, e.g. `grayscale(30%)`. */
export function grayscaleFilter(strength: number): string {
  return `grayscale(${clamp(strength)}%)`;
}

/**
 * The `backdropFilter` value for the post-processing overlay, or `null` when
 * there is nothing to do: there must be a background image, not a transparent
 * export (a transparent PNG has no backdrop to process), and at least one of
 * the two strengths must be non-zero. An empty `backdropFilter` would render
 * nothing, so the null lets the caller skip the overlay entirely.
 */
export function backdropFilter(
  backgroundImage: string | null,
  blur: number,
  grayscale: number,
  transparent: boolean,
): string | null {
  if (backgroundImage === null || transparent) return null;
  const parts = [
    blur > 0 ? blurFilter(blur) : "",
    grayscale > 0 ? grayscaleFilter(grayscale) : "",
  ].filter(Boolean);
  return parts.length === 0 ? null : parts.join(" ");
}
