import type { ImageRefusal } from "./admission";
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

/**
 * Why a history control is greyed out (#207).
 *
 * A disabled control that says nothing is a dead end
 * (`apps/web/docs/design/components.md`), and these two are the only controls in
 * the toolbar that are disabled at rest: a fresh document can neither be undone
 * nor redone. The sentences come from this layer rather than the component for the
 * same reason the save status does — the wording is a rule a unit test can hold,
 * and it has to follow the state rather than be one generic "nothing to do".
 *
 * The Tool carries them on the control (its `title` and an associated
 * description) rather than in a line beside it: the history group is two icon-only
 * buttons in a single pinned row, and a second line would move the canvas under the
 * visitor's caret the first time a step became available.
 */
export const HISTORY_DISABLED_REASON = {
  redo: "没有可重做的步骤。",
  undo: "没有可撤销的步骤。",
} as const;

/**
 * The words the two keyboard-first surfaces carry, in one place.
 *
 * They live in the pure core for the reason every sentence in this Tool does: the
 * browser gate spells the same sentences out and would otherwise agree with the
 * component whether or not the component is right. The command labels and their
 * icons are not here: those are the command table's (`core/commands.ts`), and a
 * second copy is the thing this slice is here to prevent.
 *
 * The punctuation rules are `apps/web/docs/design/copy.md`'s: full-width marks in
 * Chinese, and no em dash or `——` anywhere a visitor can read.
 */

/** The accessible name of the slash menu, and what a menu region is called. */
export const SLASH_MENU_LABEL = "插入内容";

/** What the slash menu says when the typed query matches no command. */
export const SLASH_MENU_EMPTY = "没有匹配的命令";

/**
 * The accessible name of the toolbar that follows a selection.
 *
 * It is named rather than anonymous on purpose: a second row of the same marks as
 * the pinned toolbar reads as a duplicate to a screen reader unless the region
 * says which one it is.
 */
export const SELECTION_TOOLBAR_LABEL = "选中文本的格式";

/**
 * The import confirmation's words (#211).
 *
 * The dialog exists only after a file is chosen while the draft says something, so
 * its sentences are in no pre-rendered HTML until then; holding them here is what
 * lets the punctuation rule be read without a browser, the same reason the slash
 * menu's sentences are here.
 */
export const IMPORT_DIALOG_TITLE = "替换当前文档？";
export const IMPORT_DIALOG_DESCRIPTION = "导入的文件会替换当前文档，取消则保持原样。";
export const IMPORT_CANCEL_LABEL = "取消";
export const IMPORT_CONFIRM_LABEL = "替换";

/**
 * The four sentences an image is refused with (#216).
 *
 * Admission decides which rule was broken, and these say it: a refusal that does
 * not name the rule leaves the visitor to guess whether the fix is a smaller file,
 * a different format, or deleting an image first. They are here rather than in the
 * insert module for the reason every sentence in this Tool is — the wording is a
 * rule a unit test can read, and the gate spells out the same sentences.
 *
 * The limits are written out, not derived from `core/admission.ts`, so a number
 * changed in one place and not the other is a red test rather than a sentence that
 * promises 5 MB while the rule takes 2.
 *
 * `satisfies Record<ImageRefusal, string>` is what makes a fifth rule with no
 * sentence a `tsc` error, the same way `SAVE_STATUS_TEXT` covers every save state.
 */
export const IMAGE_REFUSAL_TEXT = {
  count: "一份文档最多放十张图片。",
  size: "图片太大了：JPEG、PNG、WebP 不超过 5 MB，GIF 不超过 2 MB。",
  total: "文档里的图片总共不能超过 40 MB。",
  type: "只支持 JPEG、PNG、WebP 和 GIF 图片。",
} as const satisfies Record<ImageRefusal, string>;

/**
 * The toolbar control that opens the image picker.
 *
 * The command table calls the row 图片, because that is the word the slash menu
 * lists and the visitor types; on the toolbar the same row is an action whose name
 * says what pressing it does, which is the name the hit-area instrument declares.
 */
export const IMAGE_INSERT_LABEL = "插入图片";

/**
 * The alt text an image gets when its file's name says nothing (#216).
 *
 * A file's name without its extension is the only description the Tool has at
 * insert time (`editor/insert-image.ts`), and the name can be empty of meaning: a
 * screenshot arrives as `image.png`, a download as `.png`. An `<img>` with no alt
 * is announced by its file name at best and skipped at worst, so the fallback is a
 * word a screen reader can read, and it is a word the visitor sees in the panel's
 * field — which is why it lives here rather than in the module that inserts.
 */
export const IMAGE_ALT_FALLBACK = "图片";
