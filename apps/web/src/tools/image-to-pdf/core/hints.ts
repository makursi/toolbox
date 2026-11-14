/**
 * The words on the page that are not a field's content.
 *
 * They live here, in the pure layer, so a test can hold the wording rather than
 * a browser having to read it out of the DOM. The Tool has one main action and
 * one reason it can be unavailable; #193 adds the refusal sentences beside them,
 * and #197 the progress words.
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

/** What the result row says while the Worker is building. */
export const buildingHint = "正在生成 PDF。";

/** The heading over the input region. */
export const addHeading = "添加图片";

/** The heading over the page list. */
export const pagesHeading = "页面";

/** The list's empty state. */
export const emptyPages = "选好的图片会排在这里，每张一页。";

/** The list's clear action. */
export const clearLabel = "清空";

/** One row's remove control. The same name on every row, so it can be declared once. */
export const removeLabel = "移除";

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
