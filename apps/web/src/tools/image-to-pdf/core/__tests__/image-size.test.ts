import { describe, expect, it } from "vitest";

import { readImageSize } from "@/tools/image-to-pdf/core/image-size";

/**
 * An accepted image's pixel dimensions, read from its own header.
 *
 * The row's miniature and the PDF writer's geometry both need the dimensions,
 * and neither may wait for a decode to learn them. JPEG already has its walk;
 * PNG and WebP are read here for the three chunk shapes a WebP can start with.
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

function big(value: number): number[] {
  return [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

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

function little(value: number, size: number): number[] {
  return Array.from({ length: size }, (_, index) => (value >> (index * 8)) & 0xff);
}

/** A RIFF container whose first chunk is `id` with `payload`. */
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

function jpeg(width: number, height: number): Uint8Array {
  const frame = [
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
  const length = frame.length + 2;

  return bytes(0xff, 0xd8, 0xff, 0xc0, (length >> 8) & 0xff, length & 0xff, ...frame);
}

describe("readImageSize", () => {
  it("reads a PNG's IHDR", () => {
    expect(readImageSize("png", png(3840, 2160))).toEqual({ width: 3840, height: 2160 });
  });

  it("reads an extended WebP from its VP8X canvas size", () => {
    expect(
      readImageSize("webp", webp("VP8X", [0x02, 0, 0, 0, ...little(1919, 3), ...little(1079, 3)])),
    ).toEqual({ width: 1920, height: 1080 });
  });

  it("reads a lossy WebP from its VP8 key frame", () => {
    expect(
      readImageSize(
        "webp",
        webp("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, ...little(640, 2), ...little(480, 2)]),
      ),
    ).toEqual({ width: 640, height: 480 });
  });

  it("reads a lossless WebP from its VP8L bit stream", () => {
    // width-1 in the low 14 bits, height-1 in the next 14.
    const packed = 332 | (776 << 14);
    expect(readImageSize("webp", webp("VP8L", [0x2f, ...little(packed, 4)]))).toEqual({
      width: 333,
      height: 777,
    });
  });

  it("reads a JPEG through the existing header walk", () => {
    expect(readImageSize("jpeg", jpeg(1200, 800))).toEqual({ width: 1200, height: 800 });
  });

  it("answers null for a header cut short before its dimensions", () => {
    expect(readImageSize("png", bytes(...PNG_SIGNATURE, 0, 0, 0, 13))).toBeNull();
    expect(readImageSize("webp", bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")))).toBeNull();
    expect(readImageSize("jpeg", bytes(0xff, 0xd8))).toBeNull();
  });

  it("answers null when the bytes are not the format the caller named", () => {
    expect(readImageSize("png", jpeg(10, 10))).toBeNull();
    expect(readImageSize("jpeg", png(10, 10))).toBeNull();
    expect(readImageSize("webp", png(10, 10))).toBeNull();
  });

  it("answers null for an image with a zero side", () => {
    expect(readImageSize("png", png(0, 100))).toBeNull();
  });

  it("answers null for a WebP chunk it does not know", () => {
    expect(readImageSize("webp", webp("ANIM", [0, 0, 0, 0]))).toBeNull();
  });
});
