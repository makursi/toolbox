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
