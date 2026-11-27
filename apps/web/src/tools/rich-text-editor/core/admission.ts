import type { JSONContent } from "@tiptap/react";

/**
 * What an image has to be before it can join the document (#216).
 *
 * This module decides, and it decides without a DOM: it takes the bytes a file
 * starts with and the size it declares, and answers kept or refused. That is the
 * whole point of the shape — the caller reads sixteen bytes and a number, and the
 * rule can be held by a Node test instead of by a browser. Reading the whole file
 * happens after the answer, which is what "the size is read before the bytes"
 * means in practice: a 200 MB file is refused without being read at all.
 *
 * The type is sniffed rather than trusted from the file's name or its MIME
 * declaration: both are the visitor's or the browser's guess, and a `.png` that is
 * really a PDF would otherwise be stored as an image that never renders.
 *
 * The four limits are the spec's (issue #215's Implementation Decisions), not
 * tuning: JPEG, PNG and WebP are capped at 5 MB each, GIF at 2 MB because an
 * animated file is the one image that can be enormous without looking it, ten
 * images per document, and 40 MB of image bytes in total. The total is measured on
 * the decoded bytes, not on the base64 text a data URL stores, because base64
 * inflates by a third and the spec's number is about the images.
 */

/** One megabyte, in the unit the limits are written in. */
const MB = 1024 * 1024;

/** The per-file limit for JPEG, PNG and WebP. */
export const MAX_IMAGE_BYTES = 5 * MB;

/** The per-file limit for GIF, which can carry a whole animation. */
export const MAX_GIF_BYTES = 2 * MB;

/** How many images one document may hold. */
export const MAX_IMAGES_PER_DOCUMENT = 10;

/** How many image bytes one document may hold in total. */
export const MAX_TOTAL_IMAGE_BYTES = 40 * MB;

/**
 * How many bytes a sniff reads.
 *
 * Sixteen covers the longest signature the four formats use: WebP's `WEBP` fourcc
 * sits at byte 8 and ends at byte 12. A file shorter than this cannot be any of
 * them, which is what makes a truncated head answer "not an image".
 */
export const SNIFF_BYTES = 16;

/**
 * What a picker offers, as a hint rather than a rule.
 *
 * `accept` narrows the file dialog a visitor sees; it does not decide anything.
 * A file dragged in or pasted past the dialog never meets it, and a browser is free
 * to ignore it, so the sniffer above stays the only authority.
 */
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

/** The four formats the editor keeps. */
export type ImageKind = "jpeg" | "png" | "webp" | "gif";

/**
 * A file as admission sees it: its first bytes, and the size it declares.
 *
 * Both fields are `File` facts, and neither is the file: the head is what the
 * sniffer reads, and the size is read from the file's metadata before any of its
 * content is. The separation is the contract — a caller that read the whole file
 * first to find out how big it was would have already paid the cost admission is
 * here to avoid.
 */
export interface ImageProbe {
  readonly head: Uint8Array;
  readonly size: number;
}

/** What a document already holds: the two limits that are about the document. */
export interface AdmissionState {
  readonly count: number;
  readonly totalBytes: number;
}

/**
 * Which rule refused a file.
 *
 * Four values, each with its own sentence in `core/copy.ts`: the visitor's next
 * move differs by rule, and "that did not work" would leave them guessing.
 */
export type ImageRefusal = "count" | "size" | "total" | "type";

/** The decision: kept, with what was sniffed, or refused, with which rule. */
export type AdmissionVerdict =
  | { readonly kind: "admitted"; readonly type: ImageKind; readonly size: number }
  | { readonly kind: "refused"; readonly refusal: ImageRefusal };

function startsWith(head: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (head.length < offset + signature.length) return false;

  return signature.every((byte, index) => head[offset + index] === byte);
}

function ascii(head: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...head.slice(offset, offset + length));
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * The format a file's first bytes name, or `null` when they name none of the four.
 *
 * The checks are the formats' own magic numbers rather than a guess from a name or
 * a MIME type, and they are checked in order of specificity: a PNG's eight-byte
 * signature, a JPEG's `FF D8 FF` start, a GIF's `GIF87a`/`GIF89a`, and the RIFF
 * container, whose fourcc at byte 8 says whether it is WebP or something else that
 * shares the header (a WAV file also starts with `RIFF`).
 */
export function sniffImageType(head: Uint8Array): ImageKind | null {
  if (startsWith(head, PNG_SIGNATURE)) return "png";
  if (startsWith(head, [0xff, 0xd8, 0xff])) return "jpeg";

  if (ascii(head, 0, 4) === "GIF8" && (head[4] === 0x37 || head[4] === 0x39) && head[5] === 0x61) {
    return "gif";
  }

  if (ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 4) === "WEBP") return "webp";

  return null;
}

/** The size a format may reach, in bytes. */
export function imageByteLimit(type: ImageKind): number {
  return type === "gif" ? MAX_GIF_BYTES : MAX_IMAGE_BYTES;
}

/** What a data URL's payload holds, in bytes, or `0` when it is not a base64 URL. */
function dataUrlByteLength(src: unknown): number {
  if (typeof src !== "string" || !src.startsWith("data:")) return 0;

  const comma = src.indexOf(",");
  if (comma === -1 || !src.slice(5, comma).endsWith(";base64")) return 0;

  const payload = src.slice(comma + 1);
  if (payload === "") return 0;

  // Base64 packs four characters into three bytes, and the trailing `=` padding
  // is not one of the bytes: without subtracting it every three-image document is
  // two bytes closer to the limit than it really is.
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;

  return Math.floor((payload.length * 3) / 4) - padding;
}

/**
 * What the document already holds, read from the document rather than from a counter.
 *
 * A count beside the editor would be a second answer to "how many images are in the
 * document", and it could disagree with the JSON the moment the visitor undoes an
 * insertion: the counter would still include an image that is gone. Walking the
 * document this file is admitted into is the one number that cannot drift, and it
 * is why undo and delete need no bookkeeping here.
 *
 * An image whose source is not a data URL counts as an image but contributes no
 * bytes: the count is about the node the document holds, while the total is about
 * what that node stores.
 */
export function imageUsage(document: JSONContent): AdmissionState {
  let count = 0;
  let totalBytes = 0;

  const walk = (node: JSONContent): void => {
    if (node.type === "image") {
      count += 1;
      totalBytes += dataUrlByteLength(node.attrs?.src);
    }

    for (const child of node.content ?? []) walk(child);
  };

  walk(document);

  return { count, totalBytes };
}

/**
 * Whether one file may join a document that already holds `usage`.
 *
 * The order of the checks is the order of the questions a visitor can answer. Is
 * this an image at all, and one of the four? Then: is there room for another image
 * in this document, which no file's contents change? Then: is this particular file
 * too big for its format? Then: is the document's total about to be exceeded? The
 * count sits before the size deliberately — a full document refuses the eleventh
 * image whatever its size, and telling the visitor to shrink the file would send
 * them to resize something that still could not be inserted.
 */
export function admitImage(file: ImageProbe, usage: AdmissionState): AdmissionVerdict {
  const type = sniffImageType(file.head);
  if (type === null) return { kind: "refused", refusal: "type" };

  if (usage.count >= MAX_IMAGES_PER_DOCUMENT) return { kind: "refused", refusal: "count" };

  if (file.size > imageByteLimit(type)) return { kind: "refused", refusal: "size" };

  if (usage.totalBytes + file.size > MAX_TOTAL_IMAGE_BYTES) {
    return { kind: "refused", refusal: "total" };
  }

  return { kind: "admitted", size: file.size, type };
}

/**
 * What a document would hold if the image at `replacedSrc` were swapped for another
 * file (#218).
 *
 * 替换 is not a second insert: the bytes replace the ones an image already holds, so
 * the document gains no image and no allocation. Measuring a replacement against the
 * document as it stands would refuse to correct the tenth picture in a full
 * document — "a document may hold ten images" is satisfied by a swap — and would
 * refuse a 4 MB file into a document whose 40 MB is partly this image's own bytes.
 *
 * The replaced image is taken out by its source rather than by its position: this
 * module reads the document as data and has no positions, and the source is what the
 * count and the total are both about. A source that holds no bytes (a remote URL,
 * which the CSP never draws) subtracts nothing from the total and still counts one
 * image, which is exactly how `imageUsage` counted it.
 */
export function imageUsageAfterReplacement(
  usage: AdmissionState,
  replacedSrc: unknown,
): AdmissionState {
  return {
    count: Math.max(0, usage.count - 1),
    totalBytes: Math.max(0, usage.totalBytes - dataUrlByteLength(replacedSrc)),
  };
}
