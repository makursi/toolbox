/**
 * The byte reads more than one header walk needs.
 *
 * `ascii` was written three times before #191's review collected it: the
 * sniffer, the image-size reader and the EXIF reader all pull a fixed-width run
 * of ASCII out of a `Uint8Array` (a signature, a brand, a TIFF byte-order
 * mark). `startsWith` is the sniffer's signature test, kept beside the other
 * one because it is the same kind of read.
 *
 * Nothing here decodes image data, and nothing throws: bytes that stop short
 * answer `null`, which the callers treat as "not this thing".
 */

/**
 * `length` bytes at `offset` as a string, one character per byte, or `null`
 * when the array stops before the run does.
 */
export function ascii(bytes: Uint8Array, offset: number, length: number): string | null {
  if (offset + length > bytes.byteLength) return null;

  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

/** Whether the bytes begin with every value in `signature`. */
export function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}
