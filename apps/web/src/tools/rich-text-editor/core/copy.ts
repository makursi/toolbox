import type { SaveStatus } from "./save";

/**
 * The sentences the save status shows, in the Tool's pure copy layer.
 *
 * They live here rather than in the toolbar for the same reason Image to PDF's
 * failure sentences live in its `core/`: the wording is a rule, and a unit test can
 * hold it without a browser. The toolbar only chooses which one to paint.
 *
 * `failed` is a sentence, not a word, because it is the one state that has to tell
 * the visitor what happened to what they wrote: the canvas still holds it, and the
 * retry beside the sentence is what writes it again.
 */
export const SAVE_STATUS_TEXT = {
  dirty: "未保存",
  saving: "保存中",
  saved: "已保存到本机",
  failed: "保存失败，草稿还在页面上。",
} as const satisfies Record<SaveStatus, string>;

/** The retry control's own name, beside the failure sentence. */
export const SAVE_RETRY_LABEL = "重试";
