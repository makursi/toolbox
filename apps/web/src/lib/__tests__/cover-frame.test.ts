import { describe, expect, it } from "vitest";

import { centredFrame, coverFrameRefusal } from "@/lib/cover-frame";
import type { ImageSize } from "@/lib/image-header";

/**
 * The card's frame, and the sentence a cover that does not fill it earns.
 *
 * The claim is **the file covers the card's 4:3 box**, not "the file is 4:3":
 * the card reserves a 4:3 frame and crops the cover into it, so a 16:9 file can
 * still pass — the Cover Generator's 1920×1080 cover leaves a 1440×1080 frame.
 * The floor is 1320×990, below which the card would upscale and blur.
 *
 * The refusal path is exercised on constructed sizes, so a file on disk is not
 * needed to prove the message names the file and the numbers. The registry
 * assertion in `public-assets.test.ts` is what reads the real covers.
 */

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
    const refusal = refused("/tools/short/cover.jpg", { width: 1319, height: 990 });

    expect(refusal).toContain("/tools/short/cover.jpg");
    expect(refusal).toContain("1319×990");
    expect(refusal).toContain("1319×989");
    expect(refusal).toContain("1320×990");
  });

  it("refuses a 100×100 thumbnail and names the numbers", () => {
    const refusal = refused("/tools/thumbnail/cover.jpg", { width: 100, height: 100 });

    expect(refusal).toContain("/tools/thumbnail/cover.jpg");
    expect(refusal).toContain("100×100");
    expect(refusal).toContain("100×75");
    expect(refusal).toContain("1320×990");
  });

  it("refuses a cover whose header could not be read, naming the file", () => {
    const refusal = refused("/tools/unreadable/cover.jpg", null);

    expect(refusal).toContain("/tools/unreadable/cover.jpg");
    expect(refusal).toContain("JPEG, PNG or WebP");
  });
});
