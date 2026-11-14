import { describe, expect, it } from "vitest";

import {
  describeFailure,
  failureCode,
  failureSentence,
  PdfFailure,
  type PdfFailureCode,
} from "@/tools/image-to-pdf/core/failures";
import { imageTooManyPixelsSentence } from "@/tools/image-to-pdf/core/limits";

/**
 * The closed set of ways a build can fail, and the fallback that keeps it
 * closed.
 *
 * The visitor reads one plain sentence per code; a decoder's or a Worker's own
 * text is written for a developer and stays in the console. The wording is
 * stated here rather than derived from the code, so a sentence that quietly
 * changes is a failing test and not a new release.
 */

const codes: PdfFailureCode[] = [
  "unreadable",
  "unsupported",
  "too-many-pixels",
  "interrupted",
  "unknown",
];

describe("the failure codes", () => {
  it("each carry one plain sentence", () => {
    expect(failureSentence("unreadable")).toBe("这张图片读不出来，换一张再试。");
    expect(failureSentence("unsupported")).toBe("这张图片暂时无法直接写入 PDF，换一张再试。");
    expect(failureSentence("too-many-pixels")).toBe(imageTooManyPixelsSentence);
    expect(failureSentence("interrupted")).toBe("生成被中断了，请再试一次。");
    expect(failureSentence("unknown")).toBe("生成 PDF 失败，请再试一次。");
  });

  it("are distinct, and none is an em dash or an empty string", () => {
    const sentences = new Set(codes.map((code) => failureSentence(code)));

    expect(sentences.size).toBe(codes.length);
    for (const sentence of sentences) {
      expect(sentence).not.toBe("");
      expect(sentence).not.toContain("—");
      expect(sentence).not.toContain("–");
    }
  });

  it("reuse the pixel limit's sentence for the limit reached during a build", () => {
    // One condition, one sentence, however it was discovered: admission reads
    // the header and the Worker reads the decoded size.
    expect(failureSentence("too-many-pixels")).toBe(imageTooManyPixelsSentence);
    expect(failureSentence("unsupported")).not.toContain("JPEG");
    expect(failureSentence("unsupported")).not.toContain("PNG");
  });
});

describe("a failure reaches the visitor as a sentence", () => {
  it("keeps the code of a PdfFailure", () => {
    expect(failureCode(new PdfFailure("unsupported"))).toBe("unsupported");
    expect(describeFailure(new PdfFailure("interrupted"))).toBe("生成被中断了，请再试一次。");
  });

  it("falls back to the generic sentence for anything it does not recognise", () => {
    for (const error of [new Error("ECONNRESET"), "a string", null, undefined, 42]) {
      expect(failureCode(error)).toBe("unknown");
      expect(describeFailure(error)).toBe("生成 PDF 失败，请再试一次。");
    }
  });

  it("never lets the raw error text into the interface", () => {
    const raw = new Error("The source image could not be decoded.");
    const failure = new PdfFailure("unreadable", { cause: raw });

    expect(describeFailure(failure)).toBe("这张图片读不出来，换一张再试。");
    expect(describeFailure(raw)).not.toContain("could not be decoded");
  });
});
