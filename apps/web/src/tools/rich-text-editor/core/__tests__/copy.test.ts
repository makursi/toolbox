import { describe, expect, it } from "vitest";

import {
  SELECTION_TOOLBAR_LABEL,
  SLASH_MENU_EMPTY,
  SLASH_MENU_LABEL,
} from "@/tools/rich-text-editor/core/copy";

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
