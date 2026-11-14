/**
 * How much one visit may put in one document.
 *
 * The count is also a page count, which is what makes it meaningful here: a
 * twenty-first image would be a twenty-first page. The per-image byte limit
 * bounds one file; the total bounds the batch, because twenty files just under
 * the per-image limit are still more than a tab should hold. The pixel limit
 * bounds one decode instead: a small file can name a very large canvas, and a
 * PNG or WebP page costs a browser decode before it can be written.
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

/**
 * The most pixels one image may decode to. A header can claim this many
 * without holding a single byte of pixel data, so the number is read from the
 * header at admission, and the decoded dimensions are checked again in the
 * Worker because a header is not a promise.
 */
export const MAX_IMAGE_PIXELS = 40_000_000;

const MEGABYTE = 1024 * 1024;
const PIXELS_PER_WAN = 10_000;

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

/**
 * Why a file was left out because one decode would be too large. The sentence
 * names the limit in 万像素, the unit a visitor reads on a camera's spec sheet,
 * rather than in the raw 40000000.
 */
export const imageTooManyPixelsSentence = `这张图片超过 ${String(MAX_IMAGE_PIXELS / PIXELS_PER_WAN)} 万像素的上限，没有加入。`;
