/**
 * The pixel dimensions an image's own bytes declare, for the cover assertion.
 *
 * A Tool Card renders a cover from `public/`, and what the card can show is a
 * fact about the file, not about the script that wrote it. So the assertion
 * reads the same bytes the browser will: JPEG's `SOFn` frame, PNG's `IHDR`
 * chunk, or the first chunk of a WebP. Nothing here decodes pixels, and nothing
 * here adds a dependency.
 *
 * `src/tools/image-to-pdf/core/image-size.ts` already walks the same three
 * headers, and this is deliberately a second reader rather than an import: that
 * one belongs to that Tool's core and reports the JPEG's EXIF orientation too,
 * because its page needs the turn as well as the size, and a site-level module
 * may not depend on one Tool's core
 * (`docs/adr/0014-tool-scoped-rules-live-with-the-tool.md`). The site's
 * question is the smaller one, and the duplicate walk is the price of each
 * owner keeping its own reader.
 *
 * The format is sniffed from the signature, never the extension: the registry
 * names a URL, and a `.jpg` that is really a PNG still has a size.
 */

/** Width and height in pixels, as the file's header states them. */
export type ImageSize = { width: number; height: number };

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Every `SOFn` marker: they all carry the same first seven payload bytes, and
 * the ones whose frame type this module does not care about are still a frame,
 * so the walk stops there rather than treating the segment as unknown data.
 */
const frameMarkers = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/**
 * An image's dimensions, or `null` when no header this reader knows can be
 * read from the bytes.
 *
 * Malformed input answers `null` rather than throwing: the caller has a
 * sentence for "this cover's header could not be read", and a parser's own
 * complaint is not that sentence.
 */
export function readImageSize(bytes: Uint8Array): ImageSize | null {
  return readJpegSize(bytes) ?? readPngSize(bytes) ?? readWebpSize(bytes);
}

/** The marker walk: skip length-prefixed segments until the first `SOFn`. */
function readJpegSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  // A view rather than indexed reads: every accessor answers a number for a
  // range the bounds checks below have already proved.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // The first two bytes were SOI; every segment from here carries a marker.
  let offset = 2;

  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return null;

    let marker = view.getUint8(offset + 1);
    // A marker may be preceded by any number of 0xFF fill bytes.
    while (marker === 0xff && offset + 5 <= view.byteLength) {
      offset += 1;
      marker = view.getUint8(offset + 1);
    }

    offset += 2;

    // A nested SOI, end of image, or start of scan before a frame means this
    // header never carried one.
    if (marker === 0xd8) return null;
    if (marker === 0xd9 || marker === 0xda) return null;
    // Standalone markers carry no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;

    if (offset + 2 > view.byteLength) return null;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > view.byteLength) return null;

    if (frameMarkers.has(marker)) {
      // The `SOFn` payload is precision (1), height (2), width (2), so the
      // segment must carry at least seven bytes counting its length field.
      if (length < 7) return null;

      // The offset is the segment's first length byte; the payload starts after it.
      const height = view.getUint16(offset + 3);
      const width = view.getUint16(offset + 5);

      return sizeOrNull(width, height);
    }

    // Skip this segment's payload; its length includes the two length bytes.
    offset += length;
  }

  return null;
}

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

/** The dimensions, unless a zero side makes the frame impossible. */
function sizeOrNull(width: number, height: number): ImageSize | null {
  return width === 0 || height === 0 ? null : { width, height };
}

/** The ASCII text of `length` bytes at `offset`; callers bound-check first. */
function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let text = "";
  for (let index = 0; index < length; index += 1) {
    text += String.fromCharCode(bytes[offset + index] ?? 0);
  }

  return text;
}

/** A little-endian unsigned integer of `length` bytes; callers bound-check first. */
function little(bytes: Uint8Array, offset: number, length: number): number {
  let value = 0;
  for (let index = 0; index < length; index += 1) {
    value |= (bytes[offset + index] ?? 0) << (index * 8);
  }

  return value;
}
