import { describe, expect, it } from "vitest";

import {
  backdropFilter,
  blurFilter,
  grayscaleFilter,
} from "@/tools/cover-generator/core/background";

/**
 * The background post-processing mapping: blur and grayscale are each a 0–100
 * strength on the slider; the blur is non-linear (a quadratic ease to a 50px
 * ceiling, the ThisCover feel) while grayscale is linear. Each function emits
 * the complete CSS filter fragment, so the render layer carries no `px`/`%` of
 * its own.
 */
describe("blur filter", () => {
  it("maps the strength quadratically to a 50px ceiling as a full fragment", () => {
    expect(blurFilter(0)).toBe("blur(0.00px)");
    expect(blurFilter(50)).toBe("blur(12.50px)");
    expect(blurFilter(100)).toBe("blur(50.00px)");
  });

  it("clamps out-of-range strengths into 0–100", () => {
    expect(blurFilter(-10)).toBe("blur(0.00px)");
    expect(blurFilter(120)).toBe("blur(50.00px)");
  });
});

describe("grayscale filter", () => {
  it("maps the strength linearly and clamps into 0–100 as a full fragment", () => {
    expect(grayscaleFilter(0)).toBe("grayscale(0%)");
    expect(grayscaleFilter(30)).toBe("grayscale(30%)");
    expect(grayscaleFilter(100)).toBe("grayscale(100%)");
    expect(grayscaleFilter(-1)).toBe("grayscale(0%)");
    expect(grayscaleFilter(101)).toBe("grayscale(100%)");
  });
});

describe("backdropFilter", () => {
  it("is null without a background image or when transparent", () => {
    expect(backdropFilter(null, 10, 20, false)).toBe(null);
    expect(backdropFilter("data:image/png;base64,AA", 10, 20, true)).toBe(null);
  });

  it("is null when both strengths are zero", () => {
    expect(backdropFilter("data:image/png;base64,AA", 0, 0, false)).toBe(null);
  });

  it("joins only the non-zero fragments", () => {
    expect(backdropFilter("data:image/png;base64,AA", 50, 0, false)).toBe("blur(12.50px)");
    expect(backdropFilter("data:image/png;base64,AA", 0, 30, false)).toBe("grayscale(30%)");
    expect(backdropFilter("data:image/png;base64,AA", 50, 30, false)).toBe(
      "blur(12.50px) grayscale(30%)",
    );
  });
});
