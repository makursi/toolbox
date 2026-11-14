/**
 * The one geometry function this Tool has.
 *
 * It maps a page's inputs — the image's stored pixel dimensions, the chosen
 * paper, and the EXIF orientation that turns the picture — to the two things its
 * two consumers need: a page box in points and the image's rectangle inside it.
 * The page list draws its miniature from the same rectangle the PDF writer puts
 * in the content stream, so the preview cannot disagree with the download.
 *
 * Fit is always contain and centre. There is no crop mode, no margin parameter
 * and no orientation control: the page takes the image's orientation, because
 * asking a visitor which way round their photo is would be asking a question the
 * image already answers.
 */

import { displaySize, type ExifOrientation } from "./orientation";

/** A width and a height, in points. */
export type PaperSize = { width: number; height: number };

/** The image's own pixel dimensions, before any paper is considered. */
export type ImageSize = { width: number; height: number };

/** A rectangle in PDF coordinates: origin bottom-left, `x`/`y` its lower corner. */
export type Rectangle = { x: number; y: number; width: number; height: number };

/** The page's box and the rectangle the image occupies inside it. */
export type PageGeometry = { page: PaperSize; image: Rectangle };

/** The papers the Tool offers. `original` means the image's own pixel size at 96 dpi. */
export type Paper = "a4" | "letter" | "original";

/** What a fresh page starts on. #194's control takes this as its initial value. */
export const DEFAULT_PAPER: Paper = "a4";

/** The papers the control offers, in the order it offers them. */
export const PAPERS: readonly Paper[] = ["a4", "letter", "original"];

/**
 * The two fixed papers, in points, in portrait orientation. A landscape image
 * asks for the swapped pair: orientation follows the image, never a control.
 */
export const A4: PaperSize = { width: 595.28, height: 841.89 };
export const LETTER: PaperSize = { width: 612, height: 792 };

/**
 * 96 dpi expressed in points per pixel (`72 / 96`). 原始尺寸 is the image's pixel
 * dimensions scaled by this, which is what makes "the image's own size" mean the
 * size a visitor recognises rather than a paper name.
 */
export const ORIGINAL_SCALE = 0.75;

/**
 * The page box for `paper`, in the orientation of `image`.
 *
 * A square counts as portrait. `original` needs no swap: `ORIGINAL_SCALE` does
 * not change which side is longer.
 */
function paperFor(image: ImageSize, paper: Paper): PaperSize {
  if (paper === "original") {
    return { width: image.width * ORIGINAL_SCALE, height: image.height * ORIGINAL_SCALE };
  }

  const size = paper === "a4" ? A4 : LETTER;
  const landscape = image.width > image.height;

  return landscape ? { width: size.height, height: size.width } : { ...size };
}

/**
 * The page and the image's rectangle on it: the image scaled to the smaller of
 * the two ratios, then centred on both axes.
 *
 * `orientation` is the EXIF value that turns the stored picture. The last four
 * values swap its sides, so the page is laid out for the dimensions a visitor
 * sees; a page drawn from the stored dimensions would letterbox a turned photo
 * against its own frame.
 */
export function pageGeometry(
  image: ImageSize,
  paper: Paper,
  orientation: ExifOrientation = 1,
): PageGeometry {
  const viewed = displaySize(image, orientation);
  const page = paperFor(viewed, paper);

  const scale = Math.min(page.width / viewed.width, page.height / viewed.height);
  const width = viewed.width * scale;
  const height = viewed.height * scale;

  return {
    page,
    image: {
      x: (page.width - width) / 2,
      y: (page.height - height) / 2,
      width,
      height,
    },
  };
}
