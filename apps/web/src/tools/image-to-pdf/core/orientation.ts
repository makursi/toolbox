/**
 * EXIF orientation: the eight values a camera writes into `APP1/Exif`, the
 * matrix each one produces, and the size swap the last four ask for.
 *
 * A phone stores a portrait photo as sideways pixels and records which way to
 * turn it in metadata. A PDF has no notion of that metadata, so the turn has to
 * become part of the page: `core/pdf.ts` folds `orientationMatrix` into its
 * content stream's `cm` matrix, which places the unchanged JPEG correctly
 * without decoding or re-encoding it. A negative scale is legal in that matrix,
 * which is what makes the four mirrored values as cheap as the four rotations.
 *
 * The last four values turn the picture by a quarter, so the image's own width
 * and height swap with it. `displaySize` is that swap; `core/geometry.ts` applies
 * it before laying the page out, so a rotated photo gets a page of the right
 * proportions rather than a letterboxed one.
 *
 * Nothing here decodes or draws anything: this module is table and arithmetic,
 * which is what lets the unit tests hold every one of the eight values.
 */

import { ascii, startsWith } from "./bytes";

/** The eight orientation values EXIF defines, in the order it defines them. */
export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Every value, for tests and for a caller that wants to walk the table. */
export const ORIENTATIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const satisfies readonly ExifOrientation[];

/**
 * An affine matrix in the six-number order PDF's `cm` operator uses:
 * `x' = a x + c y + e`, `y' = b x + d y + f`.
 */
export type Matrix = readonly [number, number, number, number, number, number];

/** A width and a height, in pixels. */
type Size = { width: number; height: number };

/**
 * What each value does to the picture, as the matrix it applies to a unit square
 * with its origin at the stored picture's lower-left corner and y running up
 * (PDF's convention). Values 5-8 turn the picture, which is why their matrix
 * swaps the axes; values 2 and 4 mirror it, which is why their matrix has a
 * negative scale.
 */
export const ORIENTATION_MATRICES: Record<ExifOrientation, Matrix> = {
  // 1: as recorded.
  1: [1, 0, 0, 1, 0, 0],
  // 2: mirrored horizontally.
  2: [-1, 0, 0, 1, 1, 0],
  // 3: turned 180 degrees.
  3: [-1, 0, 0, -1, 1, 1],
  // 4: mirrored vertically.
  4: [1, 0, 0, -1, 0, 1],
  // 5: mirrored horizontally, then turned 270 degrees clockwise.
  5: [0, -1, -1, 0, 1, 1],
  // 6: turned 90 degrees clockwise.
  6: [0, -1, 1, 0, 0, 1],
  // 7: mirrored horizontally, then turned 90 degrees clockwise.
  7: [0, 1, 1, 0, 0, 0],
  // 8: turned 270 degrees clockwise.
  8: [0, 1, -1, 0, 1, 0],
};

/** Whether this value turns the picture by a quarter, swapping its two sides. */
export function swapsSides(orientation: ExifOrientation): boolean {
  return orientation >= 5;
}

/** The matrix `orientation` applies to a unit square, in PDF's coordinate sense. */
export function orientationMatrix(orientation: ExifOrientation): Matrix {
  return ORIENTATION_MATRICES[orientation];
}

/**
 * The picture's dimensions as a visitor sees them.
 *
 * The pixel count is unchanged by a turn, so this is safe to use for the pixel
 * limit; only which side is longer changes, and that is what a page's shape is
 * made of.
 */
export function displaySize(size: Size, orientation: ExifOrientation): Size {
  return swapsSides(orientation)
    ? { width: size.height, height: size.width }
    : { width: size.width, height: size.height };
}

/**
 * Read the orientation out of one `APP1` segment's payload.
 *
 * `payload` starts at the segment's data, so it begins with the `Exif\0\0`
 * signature followed by a TIFF header and its first directory. A segment that is
 * not Exif, a directory that does not reach the tag, a tag of another type and a
 * value outside 1-8 all answer `null`: the caller then treats the picture as
 * upright, which is the same thing a reader without the tag does. Nothing here
 * throws on bytes it does not understand.
 */
export function readExifOrientation(payload: Uint8Array): ExifOrientation | null {
  // "Exif" and the two zero bytes that follow it.
  if (payload.byteLength < 14) return null;
  const signature = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  if (!startsWith(payload, signature)) return null;

  const tiff = 6;
  const order = ascii(payload, tiff, 2);
  if (order !== "II" && order !== "MM") return null;

  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const little = order === "II";

  if (u16(view, tiff + 2, little) !== 42) return null;

  const directory = tiff + u32(view, tiff + 4, little);
  if (directory + 2 > payload.byteLength) return null;

  const count = u16(view, directory, little);
  // A count that would run off the segment is malformed; the bound keeps the
  // walk from trusting a number the file could make arbitrarily large.
  if (directory + 2 + count * 12 > payload.byteLength) return null;

  for (let entry = 0; entry < count; entry += 1) {
    const at = directory + 2 + entry * 12;
    if (u16(view, at, little) !== 0x0112) continue;

    // Orientation is a SHORT with one value; anything else is not the tag this
    // reader understands, and guessing would place the picture wrongly.
    if (u16(view, at + 2, little) !== 3 || u32(view, at + 4, little) < 1) return null;

    return asOrientation(u16(view, at + 8, little));
  }

  return null;
}

/** The value if EXIF defines it, otherwise `null`. */
function asOrientation(value: number): ExifOrientation | null {
  return ORIENTATIONS.find((orientation) => orientation === value) ?? null;
}

function u16(view: DataView, offset: number, little: boolean): number {
  return little ? view.getUint16(offset, true) : view.getUint16(offset, false);
}

function u32(view: DataView, offset: number, little: boolean): number {
  return little ? view.getUint32(offset, true) : view.getUint32(offset, false);
}
