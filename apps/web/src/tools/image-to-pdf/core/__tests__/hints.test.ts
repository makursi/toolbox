import { describe, expect, it } from "vitest";

import { DEFAULT_PAPER, PAPERS } from "@/tools/image-to-pdf/core/geometry";
import { originalSizeHint, paperLabels } from "@/tools/image-to-pdf/core/hints";

/**
 * The words on the page that a test can hold. The paper row's three names are
 * one word each, and the explanation of 原始尺寸 is the one sentence on this page
 * that reads as paper to some visitors and as pixels to others, so it says what
 * the tool means by it and the unit test keeps it saying that.
 */

describe("the paper row's words", () => {
  it("offers the three papers in the control's order, defaulting to A4", () => {
    expect(PAPERS).toEqual(["a4", "letter", "original"]);
    expect(PAPERS[0]).toBe(DEFAULT_PAPER);
    expect(DEFAULT_PAPER).toBe("a4");
  });

  it("names every paper the control offers", () => {
    expect(paperLabels).toEqual({ a4: "A4", letter: "Letter", original: "原始尺寸" });
  });

  it("explains 原始尺寸 as the image's own pixels at 96 dpi, not as paper", () => {
    expect(originalSizeHint).toContain("像素");
    expect(originalSizeHint).toContain("96 dpi");
    expect(originalSizeHint).toContain("0.75");
    expect(originalSizeHint).toContain("不是一种纸");
    // The site's copy rule: no em dash anywhere a visitor reads.
    expect(originalSizeHint).not.toContain("—");
  });
});
