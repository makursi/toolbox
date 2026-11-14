/**
 * How much one visit may put in one document.
 *
 * The count is also a page count, which is what makes it meaningful here: a
 * twenty-first image would be a twenty-first page. The per-image byte limit
 * bounds one file; the total bounds the batch, because twenty files just under
 * the per-image limit are still more than a tab should hold. The 40 M pixel
 * limit is not here: it bounds one decode, so it arrives with #195's decode
 * path.
 *
 * Each refusal names the limit it was refused by. A sentence that only says no
 * leaves the visitor guessing whether to remove a file, shrink one, or split
 * the document in two.
 */

/** The most images one list may hold. */
export const MAX_IMAGES = 20;

/** The per-image byte limit, in megabytes, as the sentence names it. */
export const MAX_IMAGE_MEGABYTES = 20;

/** The whole-list byte limit, in megabytes, as the sentence names it. */
export const MAX_TOTAL_MEGABYTES = 100;

const MEGABYTE = 1024 * 1024;

/** The per-image byte limit. */
export const MAX_IMAGE_BYTES = MAX_IMAGE_MEGABYTES * MEGABYTE;

/** The whole-list byte limit. */
export const MAX_TOTAL_BYTES = MAX_TOTAL_MEGABYTES * MEGABYTE;

/** Why a file was left out because the list is full. */
export const tooManyImagesSentence = `一个列表最多 ${String(MAX_IMAGES)} 张图片，这张没有加入。`;

/** Why a file was left out because it is over the per-image limit. */
export const imageTooLargeSentence = `这张图片超过 ${String(MAX_IMAGE_MEGABYTES)} MB 的单张上限，没有加入。`;

/** Why a file was left out because the batch would be over the total limit. */
export const totalTooLargeSentence = `所有图片合计不能超过 ${String(MAX_TOTAL_MEGABYTES)} MB，这张没有加入。`;
