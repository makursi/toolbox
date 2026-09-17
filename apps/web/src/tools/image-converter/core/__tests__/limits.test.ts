import { describe, expect, it } from "vitest";

import { checkLimits, defaultLimits, type LimitResult } from "@/tools/image-converter/core/limits";

/** Narrowing helper: the tests below are all about which failure came back. */
function failure(result: LimitResult): Extract<LimitResult, { ok: false }> {
  if (result.ok) throw new Error("expected the limits to reject this input");

  return result;
}

describe("checkLimits", () => {
  it("accepts a file inside both limits", () => {
    expect(checkLimits({ bytes: 1024, width: 800, height: 600 })).toEqual({ ok: true });
  });

  it("accepts a file whose dimensions are not known yet", () => {
    expect(checkLimits({ bytes: 1024 })).toEqual({ ok: true });
  });

  it("rejects a file over the byte limit", () => {
    expect(failure(checkLimits({ bytes: defaultLimits.maxBytes + 1 })).reason).toBe("too-large");
  });

  it("rejects an image over the pixel limit", () => {
    expect(failure(checkLimits({ width: 20000, height: 20000 })).reason).toBe("too-many-pixels");
  });

  it("checks bytes before pixels so the cheaper failure wins", () => {
    const result = checkLimits({
      bytes: defaultLimits.maxBytes + 1,
      width: 20000,
      height: 20000,
    });

    expect(failure(result).reason).toBe("too-large");
  });

  it("explains the failure in the message", () => {
    expect(failure(checkLimits({ width: 20000, height: 20000 })).message).toContain("20000");
  });

  it("states the pixel limit in the units the interface uses", () => {
    // It used to read "上限是 268 megapixels." — an English unit and an ASCII
    // full stop in a sentence a visitor reads.
    expect(failure(checkLimits({ width: 20000, height: 20000 })).message).toBe(
      "这张图有 20000×20000 像素，上限是 2.68 亿像素。",
    );
  });

  it("writes a limit below 亿 in 万 instead", () => {
    const result = checkLimits(
      { width: 8000, height: 8000 },
      { maxBytes: 1024, maxPixels: 50_000_000 },
    );

    expect(failure(result).message).toBe("这张图有 8000×8000 像素，上限是 5000 万像素。");
  });

  it("writes a limit below 万 in plain pixels, not as 0 万", () => {
    const result = checkLimits({ width: 100, height: 100 }, { maxBytes: 1024, maxPixels: 5000 });

    expect(failure(result).message).toBe("这张图有 100×100 像素，上限是 5000 像素。");
  });

  it("honours custom limits", () => {
    const result = checkLimits({ bytes: 2048 }, { maxBytes: 1024, maxPixels: 1024 });

    expect(result.ok).toBe(false);
  });
});
