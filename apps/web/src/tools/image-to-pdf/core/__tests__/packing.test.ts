import { unzlibSync } from "fflate";
import { describe, expect, it } from "vitest";

import { flateRgb, packRgb } from "@/tools/image-to-pdf/core/packing";

/**
 * The pixels a browser decodes are RGBA; a PDF image stream is neither the same
 * shape nor the same colour: it wants packed RGB samples, already flattened,
 * because a PDF has no alpha channel here and a page is white paper. The
 * composite is the part a unit test can hold: a transparent pixel that comes
 * out black is the bug this module exists to prevent.
 *
 * The compressed form is asserted through a second reader (`fflate`'s own
 * unzlib) rather than against a golden byte string, and by the zlib header the
 * format insists on: a raw deflate stream would fail both.
 */
describe("packRgb", () => {
  it("drops the alpha channel: one RGB triple per pixel, in row order", () => {
    const rgba = new Uint8Array([10, 20, 30, 255, 40, 50, 60, 255]);

    expect([...packRgb(rgba, 2, 1)]).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it("paints a fully transparent pixel white, not black", () => {
    // The decoded RGBA of a transparent pixel is (0, 0, 0, 0): dropping alpha
    // would write black, which is what a logo must not turn into on paper.
    expect([...packRgb(new Uint8Array([0, 0, 0, 0]), 1, 1)]).toEqual([255, 255, 255]);
  });

  it("mixes a half-transparent pixel with white per channel", () => {
    // alpha 128/255: c*a + 255*(1-a) is 227, 177, 152 for (200, 100, 50).
    expect([...packRgb(new Uint8Array([200, 100, 50, 128]), 1, 1)]).toEqual([227, 177, 152]);
  });

  it("leaves an opaque pixel its own colour", () => {
    expect([...packRgb(new Uint8Array([12, 34, 56, 255]), 1, 1)]).toEqual([12, 34, 56]);
  });

  it("writes width * height * 3 samples", () => {
    expect(packRgb(new Uint8Array(3 * 4 * 4), 3, 4)).toHaveLength(36);
  });

  it("refuses a buffer that does not hold those dimensions as RGBA", () => {
    // A short buffer is a caller's mistake, not a visitor's: throwing here keeps
    // it from becoming a PDF whose samples run past their width and height.
    expect(() => packRgb(new Uint8Array(3), 1, 1)).toThrow(/RGBA/);
    expect(() => packRgb(new Uint8Array(4), 0, 1)).toThrow(/dimensions/);
  });
});

describe("flateRgb", () => {
  it("wraps the packed samples in zlib, which is what /FlateDecode reads", () => {
    // A 2x1 image: opaque red and transparent black. The unpacked result is the
    // same samples packRgb writes, and the header is zlib's, not raw deflate's.
    const rgba = new Uint8Array([255, 0, 0, 255, 0, 0, 0, 0]);
    const compressed = flateRgb(rgba, 2, 1);

    expect(compressed[0]).toBe(0x78);
    // CMF/FLG: the two header bytes check to a multiple of 31 in zlib.
    expect(((compressed[0]! << 8) | compressed[1]!) % 31).toBe(0);

    expect([...unzlibSync(compressed)]).toEqual([255, 0, 0, 255, 255, 255]);
  });

  it("is the packed samples, compressed, not the raw pixels", () => {
    const rgba = new Uint8Array(64 * 64 * 4).fill(0x20);
    const compressed = flateRgb(rgba, 64, 64);

    expect(compressed.byteLength).toBeLessThan(packRgb(rgba, 64, 64).byteLength);
    expect([...unzlibSync(compressed)]).toEqual([...packRgb(rgba, 64, 64)]);
  });
});
