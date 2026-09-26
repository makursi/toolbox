import { describe, expect, it } from "vitest";

import { systemFontsDenied, systemFontsUnsupported } from "../hints";

describe("system-font hints", () => {
  it("distinguishes a missing API from a refused permission", () => {
    expect(systemFontsUnsupported()).not.toBe(systemFontsDenied());
  });

  it("says it in the language of the interface", () => {
    // The same discipline as `failures.test.ts`: no browser string, no ASCII.
    for (const sentence of [systemFontsUnsupported(), systemFontsDenied()]) {
      expect(sentence).toMatch(/^[^\sA-Za-z]+$/);
    }
  });

  it("names the browser for the missing-API case", () => {
    expect(systemFontsUnsupported()).toBe("此浏览器不支持读取系统字体。");
  });

  it("names the refusal for the denied case", () => {
    expect(systemFontsDenied()).toBe("读取系统字体被拒绝。");
  });
});
