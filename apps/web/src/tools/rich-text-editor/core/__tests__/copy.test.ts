import { describe, expect, it } from "vitest";

import {
  SAVE_RETRY_LABEL,
  SAVE_STATUS_TEXT,
  SELECTION_TOOLBAR_LABEL,
  SLASH_MENU_EMPTY,
  SLASH_MENU_LABEL,
} from "@/tools/rich-text-editor/core/copy";

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

/**
 * The sentences the two menu surfaces carry.
 *
 * A wording test is a punctuation test here: the site's copy rule is that nothing a
 * visitor reads carries an em dash or a Chinese `——` (`apps/web/docs/design/copy.md`),
 * and the rule is enforced on the rendered HTML by the design checklist rather than
 * by a test — except for sentences that arrive in a popup, which are in no
 * pre-rendered HTML until a keystroke opens them. So the sentences are held here,
 * where the punctuation can be read without a browser.
 */
describe("the menu copy", () => {
  const sentences = [SLASH_MENU_LABEL, SLASH_MENU_EMPTY, SELECTION_TOOLBAR_LABEL];

  it("says something", () => {
    for (const sentence of sentences) {
      expect(sentence.trim()).not.toBe("");
    }
  });

  it("carries no em dash, en dash or Chinese dash", () => {
    for (const sentence of sentences) {
      expect(sentence).not.toMatch(/[—–]/);
      expect(sentence).not.toContain("——");
    }
  });

  it("ends a Chinese sentence with full-width punctuation rather than a Latin mark", () => {
    for (const sentence of sentences) {
      expect(sentence).not.toMatch(/[,.;:!?]$/);
    }

    expect(SLASH_MENU_EMPTY.endsWith("。")).toBe(false);
    expect(SLASH_MENU_EMPTY).toBe("没有匹配的命令");
  });
});
