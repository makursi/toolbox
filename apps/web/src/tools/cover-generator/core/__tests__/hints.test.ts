import { describe, expect, it } from "vitest";

import {
  backgroundProcessingReason,
  iconColorReason,
  systemFontPickerReason,
  systemFontsDenied,
  systemFontsUnsupported,
} from "../hints";

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

/**
 * The three sentences a disabled control on this page says, and the property the
 * component cannot show on its own: that two states disabling one control read
 * *differently*, which is the rule `components.md` states.
 */
describe("disabled-control reasons", () => {
  it("says nothing while the background's post-processing is enabled", () => {
    expect(backgroundProcessingReason({ transparent: false, hasBackground: true })).toBeNull();
  });

  it("reads differently for the two states that disable it", () => {
    const transparent = backgroundProcessingReason({ transparent: true, hasBackground: true });
    const noBackground = backgroundProcessingReason({ transparent: false, hasBackground: false });
    expect(transparent).not.toBeNull();
    expect(noBackground).not.toBeNull();
    expect(transparent).not.toBe(noBackground);
  });

  it("names the step for each of those states", () => {
    expect(backgroundProcessingReason({ transparent: true, hasBackground: true })).toBe(
      "「背景透明」打开时不处理背景图，先关掉它。",
    );
    expect(backgroundProcessingReason({ transparent: false, hasBackground: false })).toBe(
      "先加一张背景图，模糊与灰度才有作用。",
    );
  });

  it("ties the icon colour to the switch that takes it over", () => {
    expect(iconColorReason(false)).toBeNull();
    expect(iconColorReason(true)).toBe("「颜色同步」打开时，图标颜色跟随文字颜色。");
  });

  it("explains the font picker only while nothing else does", () => {
    expect(systemFontPickerReason({ hasList: true, hint: null })).toBeNull();
    expect(
      systemFontPickerReason({ hasList: false, hint: "此浏览器不支持读取系统字体。" }),
    ).toBeNull();
    expect(systemFontPickerReason({ hasList: false, hint: null })).toBe(
      "还没读取系统字体，先按「获取系统字体」。",
    );
  });

  it("keeps every sentence in the language of the interface", () => {
    const sentences = [
      backgroundProcessingReason({ transparent: true, hasBackground: true }),
      backgroundProcessingReason({ transparent: false, hasBackground: false }),
      iconColorReason(true),
      systemFontPickerReason({ hasList: false, hint: null }),
    ];
    for (const sentence of sentences) {
      expect(sentence).toMatch(/^[^\sA-Za-z]+$/);
    }
  });
});
