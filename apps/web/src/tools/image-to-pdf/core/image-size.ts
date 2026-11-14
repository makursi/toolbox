import { ascii } from "./bytes";
import type { ImageSize } from "./geometry";
import { readJpeg } from "./jpeg";
import type { ExifOrientation } from "./orientation";
import type { ImageFormat } from "./sniff";

/**
 * An accepted image's header: the dimensions it stores and the EXIF turn.
 *
 * A page needs both together. The dimensions decide the paper's proportions
 * before anything is decoded, and the orientation decides which of them is the
 * width a visitor sees; handing them out as one value is what keeps a caller
 * from taking the size and forgetting the turn.
 */
export type ImageHeader = { size: ImageSize; orientation: ExifOrientation };

/**
 * An accepted image's header, or `null` when the bytes stop before it.
 *
 * The row's miniature and the PDF writer's geometry both need this, and asking a
 * decoder for it would make a list of twenty images cost twenty decodes before
 * anything is drawn. So the header answers instead: JPEG has its own walk, and
 * PNG and WebP each put the size in the first chunk. Only JPEG carries the EXIF
 * orientation this Tool reads; a PNG or a WebP is upright.
 *
 * Nothing here decodes pixels. Admission reads the same numbers to hold the pixel
 * limit without a decode; the Worker's decode path takes its geometry from the
 * dimensions the decoder reports, which is the first place a header's claim is
 * checked against pixels.
 */
export function readImageHeader(format: ImageFormat, bytes: Uint8Array): ImageHeader | null {
  if (format === "jpeg") {
    const info = readJpeg(bytes);

    return info === null
      ? null
      : { size: { width: info.width, height: info.height }, orientation: info.orientation };
  }

  const size = format === "png" ? readPngSize(bytes) : readWebpSize(bytes);

  return size === null ? null : { size, orientation: 1 };
}

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The 13-byte header chunk a PNG must start with: length, "IHDR", width, height. */
function readPngSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.byteLength < 24) return null;
  if (!pngSignature.every((byte, index) => bytes[index] === byte)) return null;
  if (ascii(bytes, 12, 4) !== "IHDR") return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  return sizeOrNull(view.getUint32(16), view.getUint32(20));
}

/**
 * The first chunk of a WebP says which variant it is and where the size lives:
 * `VP8X` for an extended file (animations, alpha, metadata) keeps the canvas
 * size right after its flags, while the simple `VP8 ` and `VP8L` frames put it
 * inside the frame header.
 */
function readWebpSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.byteLength < 21) return null;
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return null;

  switch (ascii(bytes, 12, 4)) {
    case "VP8X": {
      if (bytes.byteLength < 30) return null;

      // flags (1), reserved (3), canvas width - 1 (3, little-endian), height - 1 (3).
      const width = 1 + little(bytes, 24, 3);
      const height = 1 + little(bytes, 27, 3);

      return sizeOrNull(width, height);
    }
    case "VP8 ": {
      if (bytes.byteLength < 30) return null;

      // The key frame's start code follows a three-byte frame tag. A frame that
      // does not begin with it is not one this walk understands.
      if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;

      return sizeOrNull(little(bytes, 26, 2) & 0x3fff, little(bytes, 28, 2) & 0x3fff);
    }
    case "VP8L": {
      if (bytes.byteLength < 25 || bytes[20] !== 0x2f) return null;

      // After the 0x2f signature, four bytes hold width - 1 in fourteen bits and
      // height - 1 in the next fourteen, with the alpha bit and version after.
      const packed = little(bytes, 21, 4);
      const width = 1 + (packed & 0x3fff);
      const height = 1 + ((packed >> 14) & 0x3fff);

      return sizeOrNull(width, height);
    }
    default:
      return null;
  }
}

/** The dimensions, unless a zero side makes the page impossible. */
function sizeOrNull(width: number, height: number): ImageSize | null {
  return width === 0 || height === 0 ? null : { width, height };
}

/** A little-endian unsigned integer of `length` bytes. */
function little(bytes: Uint8Array, offset: number, length: number): number {
  let value = 0;
  for (let index = 0; index < length; index += 1) {
    value |= (bytes[offset + index] ?? 0) << (index * 8);
  }

  return value;
}
