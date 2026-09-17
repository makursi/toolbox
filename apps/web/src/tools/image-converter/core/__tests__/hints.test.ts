import { describe, expect, it } from "vitest";

import { backgroundHint, convertHint } from "../hints";

describe("convertHint", () => {
  it("names the missing file before the missing format", () => {
    // Both are missing; the first thing to do is the one said first.
    expect(convertHint(0, 0)).toBe("先添加文件。");
    expect(convertHint(0, 2)).toBe("先添加文件。");
  });

  it("asks for a target once there are files", () => {
    expect(convertHint(3, 0)).toBe("至少选择一个目标格式。");
  });

  it("says nothing when the button is live", () => {
    expect(convertHint(1, 1)).toBeNull();
  });
});

describe("backgroundHint", () => {
  it("does not talk about alpha when nothing is selected", () => {
    expect(backgroundHint(0, false)).toBe("先选择目标格式。");
  });

  it("explains the purpose when a target flattens transparency", () => {
    expect(backgroundHint(1, true)).toContain("不支持透明通道");
  });

  it("explains the disuse when every target keeps alpha", () => {
    // This is the case that used to leave a greyed-out swatch with no reason.
    expect(backgroundHint(2, false)).toContain("用不到背景色");
  });
});
