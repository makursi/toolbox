import { describe, expect, it } from "vitest";

import { SAVE_RETRY_LABEL, SAVE_STATUS_TEXT } from "@/tools/rich-text-editor/core/copy";

/**
 * The save status's words, held as wording rather than as implementation.
 *
 * These sentences are what a visitor reads beside the file menu, so the test spells
 * them out the way the gate spells out the placeholders: a copy change is then a
 * visible diff in two places and not a quiet drift between the code and its claim.
 * The punctuation rule is the site's (`apps/web/docs/design/copy.md`): Chinese copy
 * uses full-width punctuation, and neither an em dash nor its Chinese double form
 * appears in user-visible text.
 */
describe("the save status copy", () => {
  it("names every state in the words the ticket uses", () => {
    expect(SAVE_STATUS_TEXT).toEqual({
      dirty: "未保存",
      saving: "保存中",
      saved: "已保存到本机",
      failed: "保存失败，草稿还在页面上。",
    });
  });

  it("tells a failed visitor what is still there and offers the retry", () => {
    expect(SAVE_STATUS_TEXT.failed).toContain("保存失败");
    expect(SAVE_STATUS_TEXT.failed).toContain("草稿还在页面上");
    expect(SAVE_RETRY_LABEL).toBe("重试");
  });

  it("keeps the copy out of the banned punctuation", () => {
    for (const sentence of [...Object.values(SAVE_STATUS_TEXT), SAVE_RETRY_LABEL]) {
      expect(sentence, sentence).not.toContain("—");
      expect(sentence, sentence).not.toContain("–");
      expect(sentence, sentence).not.toContain("——");
    }

    // The failure sentence is the one with punctuation in it, and it is full-width.
    expect(SAVE_STATUS_TEXT.failed).toContain("。");
  });
});
