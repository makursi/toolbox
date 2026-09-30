/** The upload limits for the cover generator (tickets #56, #58). */

/** A background image over this size is refused before it is read. */
export const MAX_BACKGROUND_BYTES = 10 * 1024 * 1024;

export function backgroundTooBig(sizeBytes: number): boolean {
  return sizeBytes > MAX_BACKGROUND_BYTES;
}

/** A font file over this size is refused before it is parsed. */
export const MAX_FONT_BYTES = 20 * 1024 * 1024;

export function fontTooBig(sizeBytes: number): boolean {
  return sizeBytes > MAX_FONT_BYTES;
}

/**
 * The pixel cap that pins the ratio table: the largest base ratio
 * (21:9 = 2560×1080) is the canvas limit, and the test asserts every ratio
 * against it. The export scale (issue #75) multiplies past it on purpose — a
 * scaled export has no ceiling of its own, SnapDOM's clamp is the guard.
 */
export const MAX_EXPORT_PIXELS = 2560 * 1080;
