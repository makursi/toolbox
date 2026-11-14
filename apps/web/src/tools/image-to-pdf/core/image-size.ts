import type { ImageSize } from "./geometry";
import { readJpeg } from "./jpeg";
import type { ImageFormat } from "./sniff";

/**
 * An accepted image's pixel dimensions, read from its own header.
 *
 * The row's miniature and the PDF writer's geometry both need the dimensions,
 * and asking a decoder for them would make a list of twenty images cost twenty
 * decodes before anything is drawn. So the header answers instead: JPEG has its
 * own walk, and PNG and WebP each put the size in the first chunk.
 *
 * Nothing here decodes pixels. A header that stops before the dimensions is
 * `null`, which the caller turns into a refusal sentence rather than a guess.
 * Admission reads the same numbers to hold the pixel limit without a decode; the
 * Worker's decode path takes its geometry from the dimensions the decoder
 * reports, which is the first place a header's claim is checked against pixels.
 */
export function readImageSize(format: ImageFormat, bytes: Uint8Array): ImageSize | null {
  if (format === "jpeg") {
    const info = readJpeg(bytes);

    return info === null ? null : { width: info.width, height: info.height };
  }

  if (format === "png") return readPngSize(bytes);

  return readWebpSize(bytes);
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

function ascii(bytes: Uint8Array, offset: number, length: number): string | null {
  if (offset + length > bytes.length) return null;

  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}
