import { describe, expect, it } from "vitest";

import {
  damagedImageSentence,
  notAnImageSentence,
  unsupportedFormatSentence,
} from "@/tools/image-to-pdf/core/refusal";

/**
 * The sentences a refused file is listed under.
 *
 * One sentence covers every format this Tool recognises and does not take. A
 * per-format list would expire the first time a format was added, and the
 * visitor does not need the name of the format to act on it: JPEG, PNG or WebP
 * is the positive restatement of the rule.
 */
describe("refusal sentences", () => {
  it("refuses every unsupported format with the same sentence, without naming one", () => {
    expect(unsupportedFormatSentence).toBe(
      "这个格式的图片暂时不支持，请换成 JPEG、PNG 或 WebP 的图片。",
    );

    for (const refused of ["AVIF", "BMP", "HEIC", "GIF"]) {
      expect(unsupportedFormatSentence).not.toContain(refused);
    }
  });

  it("says a file that is not an image is not an image", () => {
    expect(notAnImageSentence).toBe("这个文件不是图片，换一个再试。");
  });

  it("has a sentence for a recognised image whose own header cannot be read", () => {
    expect(damagedImageSentence).toBe("这张图片已经损坏，读不出来，换一张再试。");
  });

  it("keeps the three sentences distinct", () => {
    const sentences = new Set([
      unsupportedFormatSentence,
      notAnImageSentence,
      damagedImageSentence,
    ]);
    expect(sentences.size).toBe(3);
  });
});
