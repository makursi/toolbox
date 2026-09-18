import { describe, expect, it } from "vitest";

import { admitFormat } from "@/tools/image-converter/core/admission";
import { imageFormats } from "@/tools/image-converter/core/formats";

/**
 * `admitFormat` is the one decision between "these bytes sniffed as something"
 * and "this file joins the queue", and its two refusals are sentences the
 * visitor reads. Both halves of that are worth a test: a format added to the
 * table must be accepted without anyone remembering to add it here, and the two
 * sentences are the product.
 *
 * It hands the admitted format back rather than only nodding, so that the queue
 * never has to re-derive "null and heic cannot get through here" a second time.
 * That is what the first case checks: the answer is the same format, not merely
 * an acceptance.
 */
describe("admitFormat", () => {
  it("accepts every format the Tool can convert, and names it", () => {
    for (const format of imageFormats) {
      expect(admitFormat(format), format).toEqual({ ok: true, format });
    }
  });

  it("refuses bytes that match nothing it knows", () => {
    expect(admitFormat(null)).toEqual({ ok: false, message: "无法识别这个文件的格式。" });
  });

  it("refuses HEIC by name rather than as an unknown file", () => {
    // The distinction is the whole reason HEIC is a sniffed answer and not a
    // `null`: "I do not know this" and "I know this and cannot read it" send the
    // visitor to different places.
    expect(admitFormat("heic")).toEqual({ ok: false, message: "暂不支持 HEIC 文件。" });
  });
});
