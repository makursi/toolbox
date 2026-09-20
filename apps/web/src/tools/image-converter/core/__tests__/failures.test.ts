import { describe, expect, it } from "vitest";

import {
  ConversionFailure,
  describeFailure,
  failureCause,
  type FailureKind,
} from "@/tools/image-converter/core/failures";

const kinds: FailureKind[] = [
  "decode",
  "canvas",
  "encode",
  "too-many-pixels",
  "interrupted",
  "gone",
  "unknown",
];

describe("describeFailure", () => {
  it("has something to say about every kind it knows", () => {
    for (const kind of kinds) {
      expect(describeFailure(new ConversionFailure(kind)), kind).not.toBe("");
    }
  });

  it("says it in the language of the interface", () => {
    // Deliberately stricter than section 8 of apps/web/docs/design.md, which lets
    // abbreviations like PNG or WebP through: none of these sentences needs one,
    // and the point is to catch a browser string arriving. No ASCII space either,
    // which is its own tell in a Chinese sentence. If one ever does need either,
    // widen this test and the section together.
    for (const kind of kinds) {
      expect(describeFailure(new ConversionFailure(kind)), kind).toMatch(/^[^\sA-Za-z]+$/);
    }
  });

  it("prefers a sentence that measured something", () => {
    // Deliberately not the wording `limits.ts` produces: this test is about the
    // override, and a change to that wording should only touch one test file.
    const measured = "这张图有 30000×30000 像素，超出了上限。";

    expect(describeFailure(new ConversionFailure("too-many-pixels", { sentence: measured }))).toBe(
      measured,
    );
  });

  it("falls back for a failure it did not raise", () => {
    const browser = new Error("The source image could not be decoded.");

    expect(describeFailure(browser)).toBe(describeFailure(new ConversionFailure("unknown")));
    expect(describeFailure(browser)).not.toContain("decoded");
  });

  it("falls back for something that is not an error at all", () => {
    expect(describeFailure("boom")).toBe(describeFailure(new ConversionFailure("unknown")));
  });

  it("keeps whatever caused it, so the console can still say what happened", () => {
    const cause = new Error("AVIF encode failed");

    expect(new ConversionFailure("encode", { cause }).cause).toBe(cause);
  });

  it("unwraps a failure to its cause, and passes anything else through", () => {
    const cause = new Error("AVIF encode failed");
    const wrapped = new ConversionFailure("encode", { cause });

    expect(failureCause(wrapped)).toBe(cause);
    // A failure with nothing behind it logs itself rather than `undefined`.
    expect(failureCause(new ConversionFailure("canvas"))).toBeInstanceOf(ConversionFailure);
    expect(failureCause(cause)).toBe(cause);
  });
});
