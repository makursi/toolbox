import type { JSONContent } from "@tiptap/react";
import { describe, expect, it } from "vitest";

import {
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_DOCUMENT,
  MAX_TOTAL_IMAGE_BYTES,
  type AdmissionState,
  type ImageProbe,
  admitImage,
  imageUsage,
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
