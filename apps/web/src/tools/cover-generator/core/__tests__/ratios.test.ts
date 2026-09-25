import { describe, expect, it } from "vitest";

import {
  DEFAULT_RATIO,
  pixelCaption,
  ratioByKey,
  ratios,
} from "@/tools/cover-generator/core/ratios";

/**
 * The four ratios are the product decision from issue #50, with the pixel bases
 * confirmed in the same discussion — the expected values here are the decision
 * table, not a recomputation of the code (see the TDD skill's anti-patterns).
 */
describe("ratio presets", () => {
  it("offers the four decided ratios at their decided pixel bases", () => {
    expect(ratios.map((r) => [r.key, r.width, r.height])).toEqual([
      ["1:1", 1080, 1080],
      ["4:3", 1320, 990],
      ["16:9", 1280, 720],
      ["21:9", 2560, 1080],
    ]);
  });

  it("looks a ratio up by its key", () => {
    expect(ratioByKey("16:9")?.width).toBe(1280);
    expect(ratioByKey("nope")).toBeUndefined();
  });

  it("defaults to 16:9", () => {
    expect(DEFAULT_RATIO).toBe("16:9");
  });

  it("writes the pixel caption a visitor reads", () => {
    // The multiplication sign is copy, not code: it is the character the UI
    // shows next to the ratio.
    expect(pixelCaption("16:9")).toBe("1280×720");
    expect(pixelCaption("4:3")).toBe("1320×990");
  });
});
