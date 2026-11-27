import { describe, expect, it } from "vitest";

import { readImageSize } from "@/lib/image-header";

/**
 * A cover's pixel dimensions, read from the file's own header.
 *
 * The cover assertion needs the pixels a visitor will see, and the only honest
 * source for those is the file the registry names — not a script's report of
 * what it wrote. JPEG carries its size inside the `SOFn` frame, behind any
 * number of length-prefixed segments; PNG and WebP each put theirs in the first
 * chunk, and a WebP has three of those shapes (`VP8 `, `VP8L`, `VP8X`).
 *
 * Fixtures are built inline. A signature and a length are numbers, and a
 * committed binary would be one more thing review has to trust.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

function ascii(text: string): number[] {
  return text.split("").map((character) => character.charCodeAt(0));
}

function little(value: number, size: number): number[] {
  return Array.from({ length: size }, (_, index) => (value >> (index * 8)) & 0xff);
}

function big(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

/**
 * An 8-bit RGBA PNG header (bit depth 8, colour type 6), ending after IHDR's
 * compression, filter and interlace bytes.
 */
function png(width: number, height: number): Uint8Array {
  return bytes(
    ...PNG_SIGNATURE,
    ...big(13),
    ...ascii("IHDR"),
    ...big(width),
    ...big(height),
    8,
    6,
    0,
    0,
    0,
  );
}

/** A RIFF container whose first chunk is `chunk` with `payload`. */
function webp(chunk: string, payload: number[]): Uint8Array {
  const riffSize = 4 + 8 + payload.length;

  return bytes(
    ...ascii("RIFF"),
    ...little(riffSize, 4),
    ...ascii("WEBP"),
    ...ascii(chunk),
    ...little(payload.length, 4),
    ...payload,
  );
}

/** `VP8X` keeps the canvas size, minus one, after its flags and reserved bytes. */
function vp8xPayload(width: number, height: number): number[] {
  return [0x02, 0, 0, 0, ...little(width - 1, 3), ...little(height - 1, 3)];
}

/** `VP8 ` puts the size after the key frame's start code. */
function vp8Payload(width: number, height: number): number[] {
  return [0x00, 0x00, 0x00, 0x9d, 0x01, 0x2a, ...little(width, 2), ...little(height, 2)];
}

/** `VP8L` packs width minus one and height minus one into fourteen bits each. */
function vp8lPayload(width: number, height: number): number[] {
  const packed = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);

  return [0x2f, ...little(packed, 4)];
}

/** A `SOF0` frame: precision, height, width, then three components. */
function sof0(width: number, height: number): number[] {
  const payload = [
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    3,
    1,
    0x11,
    0,
    2,
    0x11,
    0,
    3,
    0x11,
    0,
  ];
  const length = payload.length + 2;

  return [0xff, 0xc0, (length >> 8) & 0xff, length & 0xff, ...payload];
}

/**
 * A JPEG with one `APP0` segment before the `SOF0` frame, so the walk has to
 * skip a length-prefixed segment before it finds the size.
 */
function jpeg(width: number, height: number): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46];

  return bytes(0xff, 0xd8, ...app0, ...sof0(width, height));
}

/** A JPEG whose `APP1` segment carries `payload`, before the `SOF0` frame. */
function jpegWithApp1(payload: number[], width: number, height: number): Uint8Array {
  const length = payload.length + 2;

  return bytes(
    0xff,
    0xd8,
    0xff,
    0xe1,
    (length >> 8) & 0xff,
    length & 0xff,
    ...payload,
    ...sof0(width, height),
  );
}

/**
 * One little-endian `APP1/Exif` payload: the signature, a TIFF header and a
 * single directory entry holding the orientation tag as a SHORT.
 */
function exifPayload(orientation: number): number[] {
  return [
    ...ascii("Exif"),
    0x00,
    0x00, // the signature's terminator
    0x49,
    0x49, // "II": little-endian
    0x2a,
    0x00, // 42
    0x08,
    0x00,
    0x00,
    0x00, // the first directory, eight bytes into the TIFF header
    0x01,
    0x00, // one entry
    0x12,
    0x01, // tag 0x0112, the orientation
    0x03,
    0x00, // type 3, SHORT
    0x01,
    0x00,
    0x00,
    0x00, // one value
    orientation,
    0x00,
    0x00,
    0x00, // the value, then padding to four bytes
    0x00,
    0x00,
    0x00,
    0x00, // no next directory
  ];
}

describe("readImageSize", () => {
  it("reads a JPEG from its SOF frame", () => {
    expect(readImageSize(jpeg(1200, 800))).toEqual({ width: 1200, height: 800 });
  });

  it("reads a PNG from its IHDR chunk", () => {
    expect(readImageSize(png(3840, 2160))).toEqual({ width: 3840, height: 2160 });
  });

  it("reads the size of each of the three WebP variants", () => {
    expect(readImageSize(webp("VP8X", vp8xPayload(1920, 1080)))).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(readImageSize(webp("VP8 ", vp8Payload(640, 480)))).toEqual({
      width: 640,
      height: 480,
    });
    expect(readImageSize(webp("VP8L", vp8lPayload(1001, 750)))).toEqual({
      width: 1001,
      height: 750,
    });
  });

  it("reports the dimensions a JPEG's EXIF turn displays", () => {
    // 5-8 turn the picture by a quarter, so the stored sides swap.
    for (const orientation of [5, 6, 7, 8]) {
      expect(readImageSize(jpegWithApp1(exifPayload(orientation), 1200, 800))).toEqual({
        width: 800,
        height: 1200,
      });
    }

    // 1-4 keep them: 2 and 4 mirror, 3 is a half turn, none swaps the sides.
    for (const orientation of [1, 2, 3, 4]) {
      expect(readImageSize(jpegWithApp1(exifPayload(orientation), 1200, 800))).toEqual({
        width: 1200,
        height: 800,
      });
    }
  });

  it("treats a malformed Exif segment as upright", () => {
    // "Exif\0\0" then a big-endian TIFF header whose directory offset runs past
    // the segment. Nothing here can be read, so the stored size is displayed —
    // the choice pinned for a segment that parses to nothing.
    const malformed = [
      ...ascii("Exif"),
      0x00,
      0x00,
      0x4d,
      0x4d,
      0x00,
      0x2a,
      0xff,
      0xff,
      0xff,
      0xff,
    ];

    expect(readImageSize(jpegWithApp1(malformed, 1200, 800))).toEqual({
      width: 1200,
      height: 800,
    });
  });

  it("leaves PNG and WebP upright", () => {
    expect(readImageSize(png(1200, 800))).toEqual({ width: 1200, height: 800 });
    expect(readImageSize(webp("VP8X", vp8xPayload(1200, 800)))).toEqual({
      width: 1200,
      height: 800,
    });
  });

  it("answers null when the header cannot be read", () => {
    // No signature at all.
    expect(readImageSize(bytes())).toBeNull();
    // SOI and nothing after it.
    expect(readImageSize(bytes(0xff, 0xd8))).toBeNull();
    // A PNG signature, then a chunk that is not the header.
    expect(
      readImageSize(
        bytes(...PNG_SIGNATURE, ...big(13), ...ascii("IDAT"), ...big(1), ...big(1), 8, 6, 0, 0, 0),
      ),
    ).toBeNull();
    // A VP8 key frame whose start code is not the one a size follows.
    expect(
      readImageSize(webp("VP8 ", [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])),
    ).toBeNull();
    // A RIFF container with a chunk this reader does not know.
    expect(
      readImageSize(
        bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"), ...ascii("NOPE"), 0, 0, 0, 0),
      ),
    ).toBeNull();
  });
});
