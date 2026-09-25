import { describe, expect, it } from "vitest";

import { refuseBackgroundImage } from "@/tools/cover-generator/core/failures";

/**
 * The refusal sentence a visitor reads when a background is too big. The value
 * is a worked example, not a recomputation of the code — the sentence is copy,
 * unit-tested the way the Image Converter's failure lines are.
 */
describe("background refusal copy", () => {
  it("says how big the file was and what the limit is", () => {
    expect(refuseBackgroundImage(12 * 1024 * 1024)).toBe("这个背景图有 12 MB，上限是 10 MB。");
  });
});
