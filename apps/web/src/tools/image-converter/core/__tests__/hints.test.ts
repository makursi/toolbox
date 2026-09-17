import { describe, expect, it } from "vitest";

import { convertHint } from "../hints";

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
