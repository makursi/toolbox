import { describe, expect, it } from "vitest";

import { centredFrame, coverFrameRefusal } from "@/lib/cover-frame";
import { readImageSize, type ImageSize } from "@/lib/image-header";

/**
 * The card's frame, and the sentence a cover that does not fill it earns.
 *
 * The claim is **the file covers the card's 4:3 box**, not "the file is 4:3":
 * the card reserves a 4:3 frame and crops the cover into it, so a 16:9 file can
 * still pass — the Cover Generator's 1920×1080 cover leaves a 1440×1080 frame.
 * The floor is 1320×990, below which the card would upscale and blur.
 *
 * The refusal path is exercised on a tiny image built inline, so a file on disk
 * is not needed to prove the message names the file and the numbers. The
 * registry assertion in `public-assets.test.ts` is what reads the real covers.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

function ascii(text: string): number[] {
  return text.split("").map((character) => character.charCodeAt(0));
}

function big(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

/** A header-only PNG: enough bytes for the reader, no pixel data. */
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

describe("centredFrame", () => {
  it("crops a 16:9 landscape source to a 4:3 frame", () => {
    expect(centredFrame({ width: 1920, height: 1080 })).toEqual({ width: 1440, height: 1080 });
  });

  it("leaves a source that already is 4:3 whole", () => {
    expect(centredFrame({ width: 1440, height: 1080 })).toEqual({ width: 1440, height: 1080 });
  });

  it("crops a portrait source to a 4:3 frame", () => {
    expect(centredFrame({ width: 1080, height: 1440 })).toEqual({ width: 1080, height: 810 });
  });

  it("crops a square source to a 4:3 frame", () => {
    expect(centredFrame({ width: 1000, height: 1000 })).toEqual({ width: 1000, height: 750 });
  });

  it("floors the derived side instead of rounding up", () => {
    // 1001×3/4 is 750.75. Rounding would claim 751, which the impossible frame
    // does not have; the floor is what keeps the number from overstating it.
    expect(centredFrame({ width: 1001, height: 1000 })).toEqual({ width: 1001, height: 750 });
  });
});

/** The refusal sentence, or a failure when the cover was not refused. */
function refused(file: string, size: ImageSize | null): string {
  const refusal = coverFrameRefusal(file, size);

  if (refusal === null) throw new Error(`${file} was not refused`);

  return refusal;
}

describe("coverFrameRefusal", () => {
  it("passes a 4:3 cover exactly at the floor", () => {
    expect(
      coverFrameRefusal("/tools/image-to-pdf/cover.jpg", { width: 1440, height: 1080 }),
    ).toBeNull();
    expect(coverFrameRefusal("/tools/edge/cover.jpg", { width: 1320, height: 990 })).toBeNull();
  });

  it("passes the 16:9 cover the card crops, because its frame is 1440×1080", () => {
    expect(
      coverFrameRefusal("/tools/cover-generator/cover.jpg", { width: 1920, height: 1080 }),
    ).toBeNull();
  });

  it("refuses a frame one pixel under the floor and names the numbers", () => {
    // 1319×990 is narrower than 4:3, so its centred frame is 1319×989: one
    // pixel short in height, which is a refusal even though the file is wide.
    const file = "/tools/short/cover.png";
    const size = readImageSize(png(1319, 990));

    expect(size).toEqual({ width: 1319, height: 990 });

    const refusal = refused(file, size);

    expect(refusal).toContain(file);
    expect(refusal).toContain("1319×990");
    expect(refusal).toContain("1319×989");
    expect(refusal).toContain("1320×990");
  });

  it("refuses a 100×100 thumbnail built inline and names the numbers", () => {
    const file = "/tools/thumbnail/cover.png";
    const size = readImageSize(png(100, 100));

    expect(size).toEqual({ width: 100, height: 100 });

    const refusal = refused(file, size);

    expect(refusal).toContain(file);
    expect(refusal).toContain("100×100");
    expect(refusal).toContain("100×75");
    expect(refusal).toContain("1320×990");
  });

  it("refuses a cover whose header could not be read, naming the file", () => {
    const file = "/tools/unreadable/cover.jpg";
    // SOI followed by bytes that are not a segment: the reader answers null.
    const size = readImageSize(bytes(0xff, 0xd8, 0x00, 0x00));

    expect(size).toBeNull();

    const refusal = refused(file, size);

    expect(refusal).toContain(file);
    expect(refusal).toContain("JPEG, PNG or WebP");
  });
});
