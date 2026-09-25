import { describe, expect, it } from "vitest";

import {
  defaultCoverName,
  ratioFileLabel,
  sanitizeFileName,
  uniqueCoverName,
} from "@/tools/cover-generator/core/naming";

/**
 * The filename rule from issue #50: default = ratio + the two texts, made safe
 * for the filesystem, de-duplicated with a numeric suffix the way the Image
 * Converter does. The colon is not an accident of style: "16:9" is how a ratio
 * is *shown*, but Windows refuses `:` in a filename, so the file label has to
 * be a different thing from the badge on the canvas.
 */
describe("cover filename rule", () => {
  it("turns a ratio key into a filesystem-safe label", () => {
    expect(ratioFileLabel("16:9")).toBe("16-9");
    expect(ratioFileLabel("21:9")).toBe("21-9");
  });

  it("strips the characters no filesystem accepts", () => {
    expect(sanitizeFileName('a:b\\c*d?e"f<g>h|i')).toBe("abcdefghi");
    expect(sanitizeFileName(" 示例 ")).toBe("示例");
  });

  it("names a cover by its ratio and its two texts", () => {
    expect(defaultCoverName("16:9", "示例", "文本")).toBe("16-9-示例文本");
    expect(defaultCoverName("1:1", "A", "")).toBe("1-1-A");
  });

  it("de-duplicates against names already taken, the Image Converter way", () => {
    const base = "16-9-示例文本";
    expect(uniqueCoverName(base, new Set([base]))).toBe(`${base}-1`);
    expect(uniqueCoverName(base, new Set([base, `${base}-1`]))).toBe(`${base}-2`);
    expect(uniqueCoverName(base, new Set())).toBe(base);
  });
});
