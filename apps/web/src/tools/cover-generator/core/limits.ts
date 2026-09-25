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
