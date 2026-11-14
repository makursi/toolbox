/**
 * The words on the page that are not a field's content.
 *
 * They live here, in the pure layer, so a test can hold the wording rather than
 * a browser having to read it out of the DOM. The Tool has one main action and
 * one reason it can be unavailable; #193 adds the refusal sentences beside them,
 * and #197 the progress words.
 */

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
