/** The upload limits for the cover generator (ticket #56). */

/** A background image over this size is refused before it is read. */
export const MAX_BACKGROUND_BYTES = 10 * 1024 * 1024;

export function backgroundTooBig(sizeBytes: number): boolean {
  return sizeBytes > MAX_BACKGROUND_BYTES;
}
