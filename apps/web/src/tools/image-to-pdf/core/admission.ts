import type { ImageSize } from "./geometry";
import {
  imageTooLargeSentence,
  imageTooManyPixelsSentence,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_PIXELS,
  MAX_IMAGES,
  MAX_TOTAL_BYTES,
  tooManyImagesSentence,
  totalTooLargeSentence,
} from "./limits";
import {
  damagedImageSentence,
  notAnImageSentence,
  unsupportedFormatSentence,
  type Refusal,
} from "./refusal";
import { isAcceptedFormat, type ImageFormat, type SniffedFormat } from "./sniff";

/**
 * Who gets into the page list, and in what order.
 *
 * The hook reads the bytes; this decides. Everything that can refuse a file is
 * here, so the rules can be tested without a browser, a File or a decoder: the
 * format the bytes named, whether its header could be walked, the file's size,
 * the number of pixels its header names, and what the list already holds.
 *
 * The batch is walked in input order and the running totals are kept locally,
 * so a refused file costs nothing: a batch of twenty-five images keeps the
 * first twenty, and a file that would push the total over the limit does not
 * stop a smaller one after it from fitting.
 */

/** What the caller knows about one incoming file before the decision. */
export type Candidate = {
  name: string;
  size: number;
  /** What `sniffFormat` answered, or `null` when the bytes are not an image. */
  format: SniffedFormat | null;
  /**
   * The dimensions the header walk found, or `null` when it stopped early.
   *
   * A page cannot be drawn without them, so a recognised format whose own
   * header cannot say how big it is never reaches the list. The same pair also
   * answers the pixel limit: a header can name 50 M pixels in a few dozen
   * bytes, and refusing it here is what keeps a decoder from being asked for
   * that canvas at all.
   */
  pixels: ImageSize | null;
};

/** What the list already holds. */
export type ListTotals = { count: number; bytes: number };

/** One file's outcome, in the same order as the incoming batch. */
export type AdmissionDecision<T extends Candidate> =
  | { ok: true; file: T; format: ImageFormat; pixels: ImageSize }
  | ({ ok: false; file: T } & Refusal);

/**
 * Decide every file in `incoming`, in input order.
 *
 * `list` is the current list's count and total bytes, not this batch's: the
 * count and total limits are per list, which is what makes adding a second
 * batch hit the same ceiling as the first. The caller appends the accepted
 * decisions and reports the rest.
 */
export function admitImages<T extends Candidate>(
  incoming: readonly T[],
  list: ListTotals,
): AdmissionDecision<T>[] {
  const decisions: AdmissionDecision<T>[] = [];
  let count = list.count;
  let bytes = list.bytes;

  for (const file of incoming) {
    if (file.format === null) {
      decisions.push({ ok: false, file, message: notAnImageSentence });
      continue;
    }

    if (!isAcceptedFormat(file.format)) {
      decisions.push({ ok: false, file, message: unsupportedFormatSentence });
      continue;
    }

    if (file.pixels === null) {
      decisions.push({ ok: false, file, message: damagedImageSentence });
      continue;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      decisions.push({ ok: false, file, message: imageTooLargeSentence });
      continue;
    }

    if (count >= MAX_IMAGES) {
      decisions.push({ ok: false, file, message: tooManyImagesSentence });
      continue;
    }

    if (bytes + file.size > MAX_TOTAL_BYTES) {
      decisions.push({ ok: false, file, message: totalTooLargeSentence });
      continue;
    }

    // The pixel limit is measured from the header the caller already read, so a
    // panorama is refused here rather than when a decoder asks for its canvas.
    // It is checked last so the limits about the file itself answer first: this
    // one is about what a decoder would have to allocate for it.
    if (file.pixels.width * file.pixels.height > MAX_IMAGE_PIXELS) {
      decisions.push({ ok: false, file, message: imageTooManyPixelsSentence });
      continue;
    }

    decisions.push({ ok: true, file, format: file.format, pixels: file.pixels });
    count += 1;
    bytes += file.size;
  }

  return decisions;
}
