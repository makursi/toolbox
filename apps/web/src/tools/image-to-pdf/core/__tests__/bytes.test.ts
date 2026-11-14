import { describe, expect, it } from "vitest";

import { ascii, startsWith } from "@/tools/image-to-pdf/core/bytes";

/**
 * The two byte reads three header walks share.
 *
 * They are the extraction's own tests rather than only its consumers': a run
 * that stops short must answer `null` (not a truncated string), and a signature
 * test must not read past the end of the array.
 */

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);

describe("ascii", () => {
  it("reads a fixed-width run one character per byte", () => {
    expect(ascii(bytes(0x52, 0x49, 0x46, 0x46), 0, 4)).toBe("RIFF");
  });

  it("reads at an offset", () => {
    expect(ascii(bytes(0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50), 4, 4)).toBe("WEBP");
  });

  it("answers null when the run would pass the end", () => {
    expect(ascii(bytes(0x52, 0x49, 0x46), 0, 4)).toBeNull();
    expect(ascii(bytes(0x52, 0x49, 0x46), 2, 4)).toBeNull();
  });
});

describe("startsWith", () => {
  it("accepts the exact leading run", () => {
    expect(startsWith(bytes(1, 2, 3, 4), [1, 2, 3])).toBe(true);
  });

  it("rejects a different byte and a shorter array", () => {
    expect(startsWith(bytes(1, 2, 9, 4), [1, 2, 3])).toBe(false);
    expect(startsWith(bytes(1, 2), [1, 2, 3])).toBe(false);
  });
});
