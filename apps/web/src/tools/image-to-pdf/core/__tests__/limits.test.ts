import { describe, expect, it } from "vitest";

import {
  imageTooLargeSentence,
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
  MAX_TOTAL_BYTES,
  tooManyImagesSentence,
  totalTooLargeSentence,
} from "@/tools/image-to-pdf/core/limits";

/**
 * The three limits and the sentence each refusal is listed under. The numbers
 * are the product decision; the sentences name them, so a visitor learns the
 * limit rather than just being told no.
 *
 * The 40 M pixel limit is not here: it bounds a decode, so it arrives with
 * #195's decode path.
 */
const MB = 1024 * 1024;

describe("limits", () => {
  it("allows 20 images, 20 MB each, 100 MB in total", () => {
    expect(MAX_IMAGES).toBe(20);
    expect(MAX_IMAGE_BYTES).toBe(20 * MB);
    expect(MAX_TOTAL_BYTES).toBe(100 * MB);
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
});
