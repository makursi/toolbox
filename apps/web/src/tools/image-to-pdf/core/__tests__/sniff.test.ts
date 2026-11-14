import { describe, expect, it } from "vitest";

import { isAcceptedFormat, sniffByteLength, sniffFormat } from "@/tools/image-to-pdf/core/sniff";

/**
 * The byte sniff. It answers what a file is from its leading bytes, because the
 * name and the declared type are the two things a renamed file controls.
 *
 * Every fixture is built here rather than committed: these are signatures, not
 * photographs, and a signature is a handful of numbers.
 */

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

function ascii(text: string): number[] {
  return text.split("").map((character) => character.charCodeAt(0));
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** An ISO-BMFF `ftyp` box: the container AVIF and HEIC share. */
function isoBmff(majorBrand: string, compatibleBrands: string[]): Uint8Array {
  const body = [
    ...ascii("ftyp"),
    ...ascii(majorBrand),
    0,
    0,
    0,
    0,
    ...compatibleBrands.flatMap((brand) => ascii(brand)),
  ];
  const size = body.length + 4;

  return bytes((size >> 24) & 0xff, (size >> 16) & 0xff, (size >> 8) & 0xff, size & 0xff, ...body);
}

describe("sniffFormat", () => {
  it("reads a JPEG from its start-of-image marker", () => {
    expect(sniffFormat(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe("jpeg");
  });

  it("reads a PNG from its eight-byte signature", () => {
    expect(sniffFormat(bytes(...PNG_SIGNATURE, 0, 0, 0, 13))).toBe("png");
  });

  it("reads a WebP from the RIFF container and the WEBP fourcc", () => {
    expect(sniffFormat(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")))).toBe("webp");
  });

  it("recognises both GIF signatures as an image this Tool does not take", () => {
    expect(sniffFormat(bytes(...ascii("GIF87a"), 0, 0))).toBe("gif");
    expect(sniffFormat(bytes(...ascii("GIF89a"), 0, 0))).toBe("gif");
  });

  it("recognises BMP from its two-byte signature", () => {
    expect(sniffFormat(bytes(0x42, 0x4d, 0x36, 0x00))).toBe("bmp");
  });

  it("recognises AVIF by its ftyp brand", () => {
    expect(sniffFormat(isoBmff("avif", ["avif", "mif1"]))).toBe("avif");
    expect(sniffFormat(isoBmff("mif1", ["mif1", "avif"]))).toBe("avif");
  });

  it("recognises HEIC by its ftyp brand, including the generic HEIF brands", () => {
    expect(sniffFormat(isoBmff("heic", ["heic", "mif1"]))).toBe("heic");
    expect(sniffFormat(isoBmff("mif1", ["mif1"]))).toBe("heic");
  });

  it("answers null for anything that is not an image", () => {
    expect(sniffFormat(bytes())).toBeNull();
    expect(sniffFormat(bytes(...ascii("this is a text file, renamed to .png")))).toBeNull();
    expect(sniffFormat(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE")))).toBeNull();
    expect(sniffFormat(isoBmff("mp42", ["isom", "mp42"]))).toBeNull();
  });

  it("answers null for a signature cut short before it is complete", () => {
    expect(sniffFormat(bytes(0x89, 0x50, 0x4e))).toBeNull();
    expect(sniffFormat(bytes(0xff, 0xd8))).toBeNull();
  });

  it("reads the whole ftyp brand list within the declared byte length", () => {
    const avif = isoBmff("mif1", ["mif1", "miaf", "avif"]);
    expect(avif.length).toBeLessThanOrEqual(sniffByteLength);
    expect(sniffFormat(avif)).toBe("avif");
  });
});

describe("isAcceptedFormat", () => {
  it("takes exactly JPEG, PNG and WebP", () => {
    expect(isAcceptedFormat("jpeg")).toBe(true);
    expect(isAcceptedFormat("png")).toBe(true);
    expect(isAcceptedFormat("webp")).toBe(true);
  });

  it("refuses every recognised format this Tool does not take", () => {
    expect(isAcceptedFormat("avif")).toBe(false);
    expect(isAcceptedFormat("bmp")).toBe(false);
    expect(isAcceptedFormat("gif")).toBe(false);
    expect(isAcceptedFormat("heic")).toBe(false);
  });
});
