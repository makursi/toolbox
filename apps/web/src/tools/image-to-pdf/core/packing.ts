import { zlibSync } from "fflate";

/**
 * RGBA pixels in, a PDF image stream's samples out.
 *
 * PNG and WebP cannot go into a PDF the way a JPEG can: there is no filter that
 * carries their own compressed bytes through intact. So the browser decodes them
 * and this module turns what a decoder gives back into what the writer needs:
 * packed RGB samples, composited onto white, optionally zlib-compressed for
 * `/FlateDecode`.
 *
 * Both halves are pure. No canvas, no `ImageData`, no `File` and no DOM: the
 * decoder belongs to the Worker, and this module only moves numbers. That is
 * what lets a unit test hold the one rule a mistake here would break loudly — a
 * transparent pixel must become paper, not a black rectangle — without a browser
 * in the loop.
 */

/**
 * Pack RGBA samples into the RGB triples a `/DeviceRGB` image stream carries.
 *
 * A PDF image has no alpha channel in this Tool, and a page is white paper, so
 * transparency is resolved per channel the way ink over paper is:
 * `c * a + 255 * (1 - a)`, with `a` the alpha as a fraction. Dropping the alpha
 * instead would write every transparent pixel as black.
 *
 * `rgba` must be exactly `width * height * 4` bytes; anything else is a caller's
 * mistake, and writing it would produce an image whose samples run out before
 * its width and height do.
 */
export function packRgb(rgba: Uint8Array, width: number, height: number): Uint8Array<ArrayBuffer> {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError(
      `packRgb needs positive integer dimensions, got ${String(width)}x${String(height)}`,
    );
  }

  const pixels = width * height;
  if (rgba.byteLength !== pixels * 4) {
    throw new RangeError(
      `packRgb needs RGBA samples (${String(pixels * 4)} bytes) for ${String(width)}x${String(height)}, got ${String(rgba.byteLength)}`,
    );
  }

  const view = new DataView(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  const rgb = new Uint8Array(pixels * 3);

  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const source = pixel * 4;
    const alpha = view.getUint8(source + 3) / 255;
    const paper = 255 * (1 - alpha);
    const target = pixel * 3;

    rgb[target] = Math.round(view.getUint8(source) * alpha + paper);
    rgb[target + 1] = Math.round(view.getUint8(source + 1) * alpha + paper);
    rgb[target + 2] = Math.round(view.getUint8(source + 2) * alpha + paper);
  }

  return rgb;
}

/**
 * The packed samples, zlib-wrapped.
 *
 * PDF's `/FlateDecode` is **zlib**, not raw deflate: a reader expects the
 * two-byte zlib header and the checksum `zlibSync` writes, and a raw
 * `deflateSync` stream is a file the reader refuses. There is no `/DecodeParms`:
 * the samples are written as they are, with no predictor, which
 * `docs/adr/0020-the-pdf-writer-is-ours.md` records as the deliberate choice.
 */
export function flateRgb(rgba: Uint8Array, width: number, height: number): Uint8Array<ArrayBuffer> {
  // `new Uint8Array` copies a view into a plain ArrayBuffer: the writer transfers
  // it, and `fflate`'s typed answer is not narrowed to one buffer type.
  return new Uint8Array(zlibSync(packRgb(rgba, width, height)));
}
