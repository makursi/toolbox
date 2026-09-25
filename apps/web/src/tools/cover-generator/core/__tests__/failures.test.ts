import { describe, expect, it } from "vitest";

import {
  fontUnreadable,
  refuseBackgroundImage,
  refuseFontFile,
} from "@/tools/cover-generator/core/failures";

/**
 * The refusal sentences a visitor reads. The values are worked examples, not
 * recomputations of the code — the sentences are copy, unit-tested the way the
 * Image Converter's failure lines are.
 */
describe("background refusal copy", () => {
  it("says how big the file was and what the limit is", () => {
    expect(refuseBackgroundImage(12 * 1024 * 1024)).toBe("这个背景图有 12 MB，上限是 10 MB。");
  });
});

describe("font refusal copy", () => {
  it("says how big the file was and what the limit is", () => {
    expect(refuseFontFile(21 * 1024 * 1024)).toBe("这个字体有 21 MB，上限是 20 MB。");
  });

  it("names the unreadable case plainly", () => {
    expect(fontUnreadable()).toBe("这个字体文件无法载入。");
  });
});
