import { describe, expect, it } from "vitest";

import {
  MAX_BACKGROUND_BYTES,
  MAX_FONT_BYTES,
  backgroundTooBig,
  fontTooBig,
} from "@/tools/cover-generator/core/limits";

/**
 * The upload limits for the cover generator. The background cap is a product
 * number (10 MB), decided in the same spirit as the Image Converter's limits;
 * the test pins the boundary so the refusal copy never disagrees with it.
 */
describe("background upload limits", () => {
  it("refuses a background over the cap and accepts one at it", () => {
    expect(backgroundTooBig(MAX_BACKGROUND_BYTES + 1)).toBe(true);
    expect(backgroundTooBig(MAX_BACKGROUND_BYTES)).toBe(false);
  });
});

describe("font upload limits", () => {
  it("refuses a font over the cap and accepts one at it", () => {
    expect(fontTooBig(MAX_FONT_BYTES + 1)).toBe(true);
    expect(fontTooBig(MAX_FONT_BYTES)).toBe(false);
  });
});
