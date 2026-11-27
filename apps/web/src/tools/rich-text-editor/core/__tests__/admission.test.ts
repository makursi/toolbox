import type { JSONContent } from "@tiptap/react";
import { describe, expect, it } from "vitest";

import {
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_DOCUMENT,
  MAX_TOTAL_IMAGE_BYTES,
  type AdmissionState,
  type ImageProbe,
  admitImage,
  dataUrlImageProbe,
  imageUsage,
  imageUsageAfterReplacement,
  importAdmission,
  sniffImageType,
} from "@/tools/rich-text-editor/core/admission";

/**
 * Admission, as the rules a visitor's file runs into (#216).
 *
 * The module takes a file's first bytes and its declared size, so every case here
 * is the external question — "would this file be kept, and if not, which rule
 * refused it" — and none of them needs a DOM, a `File` or a browser. The limits
 * are exercised at their own edge (exactly the limit is admitted, one byte over is
 * refused) because an off-by-one here is a file the visitor cannot insert and
 * cannot explain.
 *
 * The images below are the shortest heads that carry each format's signature: the
 * sniffer's contract is about the first bytes, so a real photograph and a
 * sixteen-byte prefix are the same input to it. The size is separate from the
 * bytes on purpose — that is what "the size is read before the file" means.
 */

/** One megabyte in the unit the limits are written in. */
const MB = 1024 * 1024;

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0,
]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const GIF = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEBP = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0, 0, 0,
]);
const TEXT = new TextEncoder().encode("this is not an image at all");

const probe = (head: Uint8Array, size: number): ImageProbe => ({ head, size });

/** A document with nothing in it: no images to count, no bytes to add up. */
const EMPTY: AdmissionState = { count: 0, totalBytes: 0 };

/** A data URL holding `bytes` zero bytes, so its decoded length is predictable. */
function dataUrlOf(bytes: number): string {
  return `data:image/png;base64,${Buffer.alloc(bytes).toString("base64")}`;
}

const image = (src: string): JSONContent => ({
  attrs: { alt: null, src, width: 100 },
  type: "image",
});

describe("sniffImageType", () => {
  it("names each of the four formats from its own first bytes", () => {
    expect(sniffImageType(PNG)).toBe("png");
    expect(sniffImageType(JPEG)).toBe("jpeg");
    expect(sniffImageType(GIF)).toBe("gif");
    expect(sniffImageType(WEBP)).toBe("webp");
  });

  it("accepts both GIF revisions", () => {
    const gif87 = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
    const gif89 = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

    expect(sniffImageType(gif87)).toBe("gif");
    expect(sniffImageType(gif89)).toBe("gif");
  });

  it("answers null for a head that is not one of them, including a truncated one", () => {
    expect(sniffImageType(TEXT)).toBeNull();
    expect(sniffImageType(new Uint8Array(0))).toBeNull();
    // A PNG's signature cut short is not a PNG: the rule reads bytes, not names.
    expect(sniffImageType(PNG.slice(0, 4))).toBeNull();
    // RIFF alone is how a WAV begins; the fourcc at byte 8 is what makes it WebP.
    expect(sniffImageType(WEBP.slice(0, 8))).toBeNull();
  });
});

describe("admitImage", () => {
  it("admits JPEG, PNG and WebP at exactly 5 MB and GIF at exactly 2 MB", () => {
    expect(admitImage(probe(PNG, MAX_IMAGE_BYTES), EMPTY)).toEqual({
      kind: "admitted",
      size: MAX_IMAGE_BYTES,
      type: "png",
    });
    expect(admitImage(probe(JPEG, MAX_IMAGE_BYTES), EMPTY).kind).toBe("admitted");
    expect(admitImage(probe(WEBP, MAX_IMAGE_BYTES), EMPTY).kind).toBe("admitted");
    expect(admitImage(probe(GIF, 2 * MB), EMPTY).kind).toBe("admitted");
  });

  it("refuses one byte over each format's own limit with the size sentence", () => {
    for (const head of [PNG, JPEG, WEBP]) {
      expect(admitImage(probe(head, MAX_IMAGE_BYTES + 1), EMPTY)).toEqual({
        kind: "refused",
        refusal: "size",
      });
    }

    expect(admitImage(probe(GIF, 2 * MB + 1), EMPTY)).toEqual({ kind: "refused", refusal: "size" });
    // The GIF limit is lower than the shared one, so a 3 MB GIF is refused even
    // though a 3 MB PNG is not.
    expect(admitImage(probe(GIF, 3 * MB), EMPTY).kind).toBe("refused");
    expect(admitImage(probe(PNG, 3 * MB), EMPTY).kind).toBe("admitted");
  });

  it("refuses a file whose bytes are not an image, whatever its size", () => {
    expect(admitImage(probe(TEXT, 12), EMPTY)).toEqual({ kind: "refused", refusal: "type" });
    expect(admitImage(probe(TEXT, 0), EMPTY)).toEqual({ kind: "refused", refusal: "type" });
  });

  it("refuses an eleventh image, and admits the tenth", () => {
    expect(admitImage(probe(PNG, 1024), { count: MAX_IMAGES_PER_DOCUMENT, totalBytes: 0 })).toEqual(
      { kind: "refused", refusal: "count" },
    );
    expect(
      admitImage(probe(PNG, 1024), { count: MAX_IMAGES_PER_DOCUMENT - 1, totalBytes: 0 }).kind,
    ).toBe("admitted");
  });

  it("refuses an image that would take the document over 40 MB, and admits one that lands on it", () => {
    expect(
      admitImage(probe(PNG, 4 * MB), {
        count: 8,
        totalBytes: MAX_TOTAL_IMAGE_BYTES - 4 * MB,
      }).kind,
    ).toBe("admitted");

    expect(
      admitImage(probe(PNG, MAX_IMAGE_BYTES), {
        count: 8,
        totalBytes: MAX_TOTAL_IMAGE_BYTES - 4 * MB,
      }),
    ).toEqual({ kind: "refused", refusal: "total" });
  });

  it("checks the document's limits as each image arrives, not the file's name", () => {
    // Same bytes, same size, the only difference is what the document already holds:
    // so the refusal is about the document and not about the file.
    const state: AdmissionState = { count: 0, totalBytes: 0 };
    const file = probe(PNG, 1024);

    expect(admitImage(file, state).kind).toBe("admitted");
    expect(admitImage(file, { count: state.count + 10, totalBytes: state.totalBytes }).kind).toBe(
      "refused",
    );
  });
});

describe("imageUsage", () => {
  it("counts the images in the document and adds up what their data URLs hold", () => {
    const document: JSONContent = {
      content: [
        { attrs: { level: 1 }, content: [{ text: "标题", type: "text" }], type: "heading" },
        image(dataUrlOf(3000)),
        { content: [{ text: "正文", type: "text" }], type: "paragraph" },
        image(dataUrlOf(2000)),
      ],
      type: "doc",
    };

    expect(imageUsage(document)).toEqual({ count: 2, totalBytes: 5000 });
  });

  it("measures the decoded bytes rather than the base64 string's length, padding included", () => {
    expect(imageUsage({ content: [image(dataUrlOf(1))], type: "doc" }).totalBytes).toBe(1);
    expect(imageUsage({ content: [image(dataUrlOf(2))], type: "doc" }).totalBytes).toBe(2);
    expect(imageUsage({ content: [image(dataUrlOf(3))], type: "doc" }).totalBytes).toBe(3);
  });

  it("counts an image whose source is not a data URL but adds no bytes for it", () => {
    // A remote image cannot render behind the CSP, but the count is about the node
    // the document holds, and a node that reports no size must not make the total
    // wrong by counting its URL's characters.
    expect(
      imageUsage({
        content: [image("https://example.com/photo.png"), image(dataUrlOf(10))],
        type: "doc",
      }),
    ).toEqual({ count: 2, totalBytes: 10 });
  });

  it("finds no images in a document of text", () => {
    expect(
      imageUsage({
        content: [{ content: [{ text: "只有字。", type: "text" }], type: "paragraph" }],
        type: "doc",
      }),
    ).toEqual({ count: 0, totalBytes: 0 });
  });
});

/**
 * What a replacement is measured against (#218).
 *
 * 替换 swaps the bytes of an image the document already holds, so the image being
 * replaced is not one more image and its bytes are not one more allocation: a full
 * ten-image document must still be able to correct a picture. Reading the document's
 * usage and taking the replaced node out of it is that rule, and it is here rather
 * than in the insert module so it can be held without a browser.
 */
describe("imageUsageAfterReplacement", () => {
  it("counts the replaced image out, so a full document can still swap one", () => {
    const replaced: AdmissionState = { count: MAX_IMAGES_PER_DOCUMENT, totalBytes: 5000 };
    const usage = imageUsageAfterReplacement(replaced, dataUrlOf(1000));

    expect(usage).toEqual({ count: MAX_IMAGES_PER_DOCUMENT - 1, totalBytes: 4000 });
    // The eleventh image is refused, but replacing one of the ten is not an
    // eleventh: the file that swaps in is still admitted.
    expect(admitImage(probe(PNG, 1024), usage).kind).toBe("admitted");
  });

  it("frees the bytes the replaced image held, so the total is about what is kept", () => {
    const usage = imageUsageAfterReplacement(
      { count: 2, totalBytes: MAX_TOTAL_IMAGE_BYTES },
      dataUrlOf(4 * MB),
    );

    expect(usage.totalBytes).toBe(MAX_TOTAL_IMAGE_BYTES - 4 * MB);
    // 36 MB kept plus this 4 MB file lands on the limit rather than over it.
    expect(admitImage(probe(PNG, 4 * MB), usage).kind).toBe("admitted");
  });

  it("never goes below zero for a source that holds no bytes of its own", () => {
    expect(
      imageUsageAfterReplacement({ count: 0, totalBytes: 0 }, "https://example.com/photo.png"),
    ).toEqual({ count: 0, totalBytes: 0 });
  });
});

/**
 * A data URL measured as if it were a file (#220).
 *
 * An imported document carries its images as strings, not as files, so the limits
 * have to reach into the string: the head is decoded from the payload's first
 * characters and the size from its own length. A source that is not a base64
 * `data:` URL answers `null` — there is no file there to measure, and the import
 * turns it into its alt text rather than calling it an image.
 */
describe("dataUrlImageProbe", () => {
  const PNG_1X1 =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  it("reads a base64 data URL's head and its decoded size", () => {
    const file = dataUrlImageProbe(PNG_1X1);

    expect(file === null ? null : sniffImageType(file.head)).toBe("png");
    expect(file?.size).toBe(70);
    expect(dataUrlImageProbe(dataUrlOf(3000))?.size).toBe(3000);
    // The head is decoded four characters at a time, so the sniff sees the
    // signature in its own order rather than off by the padding.
    expect(dataUrlImageProbe(dataUrlOf(3))?.head.length).toBeGreaterThan(0);
  });

  it("answers null for a source that is not a measurable data URL", () => {
    expect(dataUrlImageProbe("https://example.com/photo.png")).toBeNull();
    expect(dataUrlImageProbe("/photo.png")).toBeNull();
    expect(dataUrlImageProbe("data:image/png,not-base64")).toBeNull();
    expect(dataUrlImageProbe("data:image/png;base64,")).toBeNull();
    expect(dataUrlImageProbe("")).toBeNull();
    expect(dataUrlImageProbe(null)).toBeNull();
    expect(dataUrlImageProbe(undefined)).toBeNull();
  });
});

/**
 * A whole document's images arriving at once (#220).
 *
 * The same rule as an insert, asked of a batch: the count and the total start empty
 * because an import replaces the document, and every image after the tenth is
 * refused whatever its size. The refusals accumulate in the order the images
 * appeared, which is what lets the import show the first one as its sentence.
 */
describe("importAdmission", () => {
  const PNG_1X1 =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  it("admits ten images in order and refuses the eleventh by count", () => {
    const admission = importAdmission();

    for (let index = 0; index < MAX_IMAGES_PER_DOCUMENT; index += 1) {
      expect(admission.admit(PNG_1X1)).toEqual({ kind: "admitted", size: 70, type: "png" });
    }

    expect(admission.admit(PNG_1X1)).toEqual({ kind: "refused", refusal: "count" });
    expect(admission.refusals).toEqual(["count"]);
  });

  it("refuses one file over its format's limit while admitting the one before it", () => {
    const admission = importAdmission();
    /** A PNG-headed payload of `bytes` bytes, so the sniffer and the size both read it. */
    const dataUrlOfSize = (bytes: number): string => {
      const payload = Buffer.alloc(bytes);
      PNG.forEach((byte, index) => {
        payload[index] = byte;
      });

      return `data:image/png;base64,${payload.toString("base64")}`;
    };

    expect(admission.admit(dataUrlOfSize(MAX_IMAGE_BYTES))).toMatchObject({ kind: "admitted" });
    expect(admission.admit(dataUrlOfSize(MAX_IMAGE_BYTES + 1))).toEqual({
      kind: "refused",
      refusal: "size",
    });
  });

  it("answers null — and no sentence — for a source it cannot measure", () => {
    const admission = importAdmission();

    expect(admission.admit("https://example.com/photo.png")).toBeNull();
    expect(admission.refusals).toEqual([]);
  });
});
