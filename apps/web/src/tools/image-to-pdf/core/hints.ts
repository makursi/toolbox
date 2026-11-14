/**
 * The words on the page that are not a field's content.
 *
 * They live here, in the pure layer, so a test can hold the wording rather than
 * a browser having to read it out of the DOM. The Tool has one main action, one
 * reason it can be unavailable, and one line for how far a run has got; the
 * refusal sentences beside them are in `core/refusal.ts` and `core/limits.ts`.
 */

import type { Paper } from "./geometry";

/** The picker's accessible name. It never changes with state, so an instrument can declare it once. */
export const pickLabel = "选择图片";

/** The single action that builds the document. */
export const convertLabel = "转换";

/** The produced file's download control. */
export const downloadLabel = "下载";

/** Why 转换 is unavailable while there is nothing to convert. */
export const noImagesHint = "还没有图片，先选择一张。";

/**
 * The cancel control's name. It is fixed on purpose: the hit-area instrument
 * declares a control by its accessible name, and this one exists only while a
 * run is in flight, so it has to be the same two characters every time.
 */
export const cancelLabel = "取消";

/**
 * How far a run has got, as finished pages out of planned pages.
 *
 * The number is one message per finished page from the Worker, so this is what
 * both the visible line and the live region say. Two numbers rather than a
 * percentage: a visitor counting pages should not have to convert a bar back
 * into pages.
 */
export function progressText(done: number, total: number): string {
  return `已完成 ${String(done)} / ${String(total)} 页`;
}

/** The heading over the input region. */
export const addHeading = "添加图片";

/** The one line that replaces the full drop zone once the list has pages. */
export const addMoreLabel = "继续添加";

/** The heading over the list of files that were refused. */
export const refusedTitle = "有文件没能加入";

/** The heading over the page list. */
export const pagesHeading = "页面";

/** The list's empty state. */
export const emptyPages = "选好的图片会排在这里，每张一页。";

/** The list's clear action. */
export const clearLabel = "清空";

/** One row's remove control. The same name on every row, so it can be declared once. */
export const removeLabel = "移除";

/**
 * One row's drag handle. The same name on every row on purpose: the hit-area
 * instrument declares a control by its accessible name and cannot declare twenty
 * different ones, so the handle is one control repeated, not twenty controls.
 */
export const orderHandleLabel = "拖动排序";

/**
 * What a screen reader says about the handle's role, beside its name. dnd-kit
 * puts this on `aria-roledescription`, so it has to be the page's language
 * rather than the library's `sortable`.
 */
export const orderRoleDescription = "可排序页面";

/**
 * The keyboard instructions, read through the `aria-describedby` dnd-kit puts on
 * the handle. A visitor who does not use a pointer learns the keys here rather
 * than from a Tooltip they cannot reach with a key.
 */
export const orderInstructions =
  "按空格键拿起这一页，用上、下方向键移动，再按空格键放下；按 Esc 取消。";

/**
 * The three announcements and the cancellation, in the page's language.
 *
 * dnd-kit reads these through its live region, so they are the whole of what a
 * screen-reader visitor hears between lifting a row and putting it down. The
 * page and the position are different numbers once a row has moved, and both are
 * spoken for that reason.
 */

/** Announced when a row is lifted. */
export function orderPickedUp(page: number, total: number): string {
  return `已拿起第 ${page} 页，共 ${total} 页。用上、下方向键移动，按空格键放下。`;
}

/** Announced after each move, with the position the row would land in. */
export function orderMoved(page: number, position: number, total: number): string {
  return `第 ${page} 页已移到第 ${position} 位，共 ${total} 页。`;
}

/** Announced when a row is put down. */
export function orderDropped(page: number, position: number): string {
  return `已放下，第 ${page} 页现在在第 ${position} 位。`;
}

/** Announced when a lift is cancelled with Esc: the list did not change. */
export const orderCancelled = "已取消排序，页面顺序没有改变。";

/** The promise at the point of action, as the reference Tool puts it there rather than under the title. */
export const onDevicePromise = "文件不会上传，全程只在这个标签页里完成。";

/** The heading over the page-size row. #194's control sits between the list and the result row. */
export const paperHeading = "页面尺寸";

/**
 * The three papers' names, keyed by the type so a paper cannot arrive without
 * one. The order the row offers them in is `PAPERS` in `core/geometry.ts`.
 */
export const paperLabels: Record<Paper, string> = {
  a4: "A4",
  letter: "Letter",
  original: "原始尺寸",
};

/**
 * Why 原始尺寸 is not a paper size. This is the one phrase on the page that reads
 * as paper to some visitors and as pixels to others, so it states the conversion
 * rather than leaving the visitor to guess: 96 dpi, one pixel is 0.75 pt.
 */
export const originalSizeHint =
  "原始尺寸是图片自己的像素尺寸（96 dpi，1 像素 = 0.75 磅），不是一种纸。";
