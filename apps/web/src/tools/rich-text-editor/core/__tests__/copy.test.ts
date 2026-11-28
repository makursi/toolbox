import { describe, expect, it } from "vitest";

import {
  BLOCK_DISABLED_REASON,
  HISTORY_DISABLED_REASON,
  IMAGE_ALT_FALLBACK,
  IMAGE_INSERT_LABEL,
  IMAGE_REFUSAL_TEXT,
  IMPORT_CANCEL_LABEL,
  IMPORT_CONFIRM_LABEL,
  IMPORT_DIALOG_DESCRIPTION,
  IMPORT_DIALOG_TITLE,
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
/**
 * The history controls' reasons (#207).
 *
 * A disabled undo or redo that says nothing is the dead end
 * `apps/web/docs/design/components.md` forbids. The two sentences are held here so
 * the reason is a wording rule rather than a string in the component, and so the
 * "nothing to undo" and "nothing to redo" cases cannot quietly become the same
 * generic sentence.
 */
describe("the history reasons", () => {
  it("says which history step is missing, per control", () => {
    expect(HISTORY_DISABLED_REASON.undo).toContain("撤销");
    expect(HISTORY_DISABLED_REASON.redo).toContain("重做");
    expect(HISTORY_DISABLED_REASON.undo).not.toBe(HISTORY_DISABLED_REASON.redo);
  });

  it("ends with a full-width stop and carries no dash", () => {
    for (const sentence of Object.values(HISTORY_DISABLED_REASON)) {
      expect(sentence.endsWith("。")).toBe(true);
      expect(sentence).not.toMatch(/[—–]/);
      expect(sentence).not.toContain("——");
    }
  });
});

/**
 * The block menu's two disabled reasons (#229).
 *
 * 上移 on the first block and 下移 on the last one are the only rows of that menu
 * that are greyed out, and each has to say which end it is: "nothing to do" would
 * leave the visitor guessing whether the block is already first or the document is
 * broken. The sentences are held here for the reason the history reasons are — the
 * wording is a rule a unit test can read, and the gate spells out the same words.
 */
describe("the block reasons", () => {
  it("says which end of the document the block is at, per direction", () => {
    expect(BLOCK_DISABLED_REASON).toEqual({
      "move-down": "这已经是最后一个块，不能再下移。",
      "move-up": "这已经是第一个块，不能再上移。",
    });
  });

  it("ends with a full-width stop and carries no dash", () => {
    for (const sentence of Object.values(BLOCK_DISABLED_REASON)) {
      expect(sentence.endsWith("。"), sentence).toBe(true);
      expect(sentence, sentence).not.toMatch(/[—–]/);
      expect(sentence, sentence).not.toContain("——");
      expect(sentence, sentence).not.toMatch(/[,.;:!?]$/);
    }
  });
});

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

/**
 * The import confirmation's words (#211).
 *
 * The dialog asks a question and offers two answers, so the test holds all four
 * sentences: the question is a question, the second sentence says what replacing
 * loses, and the answers are the verbs the buttons carry.
 */
describe("the import confirmation copy", () => {
  const sentences = [
    IMPORT_DIALOG_TITLE,
    IMPORT_DIALOG_DESCRIPTION,
    IMPORT_CANCEL_LABEL,
    IMPORT_CONFIRM_LABEL,
  ];

  it("asks before replacing, and says what the two answers do", () => {
    expect(IMPORT_DIALOG_TITLE).toBe("替换当前文档？");
    expect(IMPORT_DIALOG_DESCRIPTION).toContain("替换当前文档");
    expect(IMPORT_DIALOG_DESCRIPTION).toContain("取消");
    expect(IMPORT_CANCEL_LABEL).toBe("取消");
    expect(IMPORT_CONFIRM_LABEL).toBe("替换");
  });

  it("carries no em dash, en dash or Chinese dash, and uses full-width marks", () => {
    for (const sentence of sentences) {
      expect(sentence).not.toMatch(/[—–]/);
      expect(sentence).not.toContain("——");
      expect(sentence).not.toMatch(/[,.;:!?]$/);
    }

    expect(IMPORT_DIALOG_TITLE.endsWith("？")).toBe(true);
    expect(IMPORT_DIALOG_DESCRIPTION.endsWith("。")).toBe(true);
  });
});

/**
 * The four sentences an image is refused with (#216).
 *
 * A refusal has to name the rule it broke, because the visitor's next move depends
 * on which one it was: a resized file fixes 过大, a different screenshot fixes 类型,
 * and a full document fixes neither. So the four are held apart here, with the
 * limits the rules actually enforce spelled out — the numbers exist in two places
 * (the admission module and these sentences) and only one of them can be wrong
 * without this test noticing.
 */
describe("the image refusal copy", () => {
  it("has one different sentence for each of the four rules", () => {
    const sentences = Object.values(IMAGE_REFUSAL_TEXT);

    expect(sentences).toHaveLength(4);
    expect(new Set(sentences).size).toBe(4);
  });

  it("names the formats it takes and the two per-file limits", () => {
    expect(IMAGE_REFUSAL_TEXT.type).toContain("JPEG");
    expect(IMAGE_REFUSAL_TEXT.type).toContain("PNG");
    expect(IMAGE_REFUSAL_TEXT.type).toContain("WebP");
    expect(IMAGE_REFUSAL_TEXT.type).toContain("GIF");
    expect(IMAGE_REFUSAL_TEXT.size).toContain("5 MB");
    expect(IMAGE_REFUSAL_TEXT.size).toContain("2 MB");
  });

  it("says what the document's two limits are", () => {
    expect(IMAGE_REFUSAL_TEXT.count).toContain("十张");
    expect(IMAGE_REFUSAL_TEXT.total).toContain("40 MB");
  });

  it("is a sentence: full-width stop, no dash, no Latin mark at the end", () => {
    for (const sentence of Object.values(IMAGE_REFUSAL_TEXT)) {
      expect(sentence.endsWith("。"), sentence).toBe(true);
      expect(sentence, sentence).not.toMatch(/[—–]/);
      expect(sentence, sentence).not.toContain("——");
      expect(sentence, sentence).not.toMatch(/[,.;:!?]$/);
    }
  });

  it("names the toolbar control the visitor opens", () => {
    expect(IMAGE_INSERT_LABEL).toBe("插入图片");
  });

  it("has a word for the alt text when the file's name says nothing", () => {
    // A file called `image.png` or `.png` leaves no words, and an `<img>` with no
    // alt is skipped or read out as its file name: the fallback is the only
    // description a screen reader gets, so its wording is held here.
    expect(IMAGE_ALT_FALLBACK).toBe("图片");
    expect(IMAGE_ALT_FALLBACK).not.toMatch(/[—–,.;:!?]/);
  });
});
