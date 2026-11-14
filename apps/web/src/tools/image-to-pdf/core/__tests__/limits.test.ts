import { describe, expect, it } from "vitest";

import { failureSentence } from "@/tools/image-to-pdf/core/failures";
import {
  imageTooLargeSentence,
  imageTooManyPixelsSentence,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_PIXELS,
  MAX_IMAGES,
  MAX_TOTAL_BYTES,
  tooManyImagesSentence,
  totalTooLargeSentence,
} from "@/tools/image-to-pdf/core/limits";

/**
 * The four limits and the sentence each refusal is listed under. The numbers
 * are the product decision; the sentences name them, so a visitor learns the
 * limit rather than just being told no.
 *
 * The pixel limit is the one that bounds a decode rather than a file: bytes
 * alone cannot stop a small file from asking for a very large canvas.
 */
const MB = 1024 * 1024;

describe("limits", () => {
  it("allows 20 images, 20 MB each, 100 MB in total, 40 M pixels each", () => {
    expect(MAX_IMAGES).toBe(20);
    expect(MAX_IMAGE_BYTES).toBe(20 * MB);
    expect(MAX_TOTAL_BYTES).toBe(100 * MB);
    expect(MAX_IMAGE_PIXELS).toBe(40_000_000);
  });

  it("names the count limit in its sentence", () => {
    expect(tooManyImagesSentence).toBe("一个列表最多 20 张图片，这张没有加入。");
  });

  it("names the per-image limit in its sentence", () => {
    expect(imageTooLargeSentence).toBe("这张图片超过 20 MB 的单张上限，没有加入。");
  });

  it("names the total limit in its sentence", () => {
    expect(totalTooLargeSentence).toBe("所有图片合计不能超过 100 MB，这张没有加入。");
  });

  it("names the pixel limit in its sentence, as the number a visitor recognises", () => {
    expect(imageTooManyPixelsSentence).toBe("这张图片超过 4000 万像素的上限，没有加入。");
  });

  it("gives the pixel limit's build failure the same sentence the refusal uses", () => {
    // One condition, one sentence: whether admission refused the file or a
    // decode found dimensions its header lied about, the visitor reads this.
    expect(failureSentence("too-many-pixels")).toBe(imageTooManyPixelsSentence);
  });
});
