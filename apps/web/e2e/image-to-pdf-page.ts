import { readFile } from "node:fs/promises";

import { expect, type BrowserContext, type Page } from "@playwright/test";
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";

/**
 * How the gate drives the Image to PDF Tool.
 *
 * Everything here is a page-level action or a reading of the file that came out,
 * because this is where the spec sits: a real browser, the production build, a
 * real JPEG through the page's own file input, and a download parsed by a
 * library the site does not ship.
 */

export const TOOL_PATH = "/tools/image-to-pdf";

/** Open the Tool and wait until React has claimed the page. */
export async function open(page: Page): Promise<void> {
  await page.goto(TOOL_PATH);
  await page.waitForFunction(() =>
    [...document.querySelectorAll("body *")].some((element) =>
      Object.keys(element).some((key) => key.startsWith("__reactFiber")),
    ),
  );
}

export type NamedBytes = { name: string; mimeType: string; buffer: Buffer };

/**
 * A JPEG, built by the browser's own canvas encoder.
 *
 * It is built in a page of its own, not in the page about to upload it: a
 * fixture that is generated and handed over in one renderer is the habit the
 * repository's Gotchas warn about, and a separate page is free here.
 *
 * Portrait by default on purpose: A4 is used in the image's orientation, so a
 * 3:4 photo makes the expected media box the portrait pair a reader recognises.
 * The options are what the batch spec uses to tell two pages apart by their
 * shape and to prove page order rather than only page count.
 */
export async function jpeg(
  context: BrowserContext,
  options: { width?: number; height?: number; name?: string } = {},
): Promise<NamedBytes> {
  const width = options.width ?? 96;
  const height = options.height ?? 128;
  const name = options.name ?? "portrait.jpg";

  const builder = await context.newPage();

  try {
    const dataUrl = await builder.evaluate(
      ({ width: canvasWidth, height: canvasHeight }) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const context2d = canvas.getContext("2d");
        if (context2d === null) throw new Error("no 2d context to build the fixture in");

        // A photograph-like frame: two tones and a band, so the JPEG's own
        // encoder has something to encode rather than a flat colour.
        context2d.fillStyle = "#f2efe8";
        context2d.fillRect(0, 0, canvasWidth, canvasHeight);
        context2d.fillStyle = "#2b2b2b";
        context2d.fillRect(
          Math.round(canvasWidth * 0.125),
          Math.round(canvasHeight * 0.125),
          Math.round(canvasWidth * 0.75),
          Math.round(canvasHeight * 0.5),
        );
        context2d.fillStyle = "#8a877f";
        context2d.fillRect(0, Math.round(canvasHeight * 0.75), canvasWidth, 4);

        return canvas.toDataURL("image/jpeg", 0.9);
      },
      { width, height },
    );

    const buffer = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
    expect(buffer.subarray(0, 3).toString("hex"), "the fixture is not a JPEG").toBe("ffd8ff");

    // The expectation below is stated in these dimensions, so the fixture is
    // decoded once and checked before it is handed to the Tool.
    const decoded = await builder.evaluate(async (source) => {
      const image = new Image();
      image.src = source;
      await image.decode();

      return { width: image.naturalWidth, height: image.naturalHeight };
    }, dataUrl);

    expect(decoded).toEqual({ width, height });

    return { name, mimeType: "image/jpeg", buffer };
  } finally {
    await builder.close();
  }
}

/** Hand files to the Tool the way the picker does, through its own file input. */
export async function chooseFiles(page: Page, files: NamedBytes[]): Promise<void> {
  await page.locator('input[type="file"]').first().setInputFiles(files);
}

/**
 * Hand files to the Tool the way a drop does, on the region that accepts one.
 *
 * The region is the element the drop handlers are bound to, and it changes its
 * shape rather than its identity when the list fills up, which is why the
 * selector is the attribute rather than a class. The bytes are base64 in the
 * payload because a page's arguments cross into the renderer as JSON.
 */
export async function dropFiles(page: Page, files: NamedBytes[]): Promise<void> {
  await page.locator("[data-dropzone]").evaluate(
    (element, entries) => {
      const transfer = new DataTransfer();
      for (const entry of entries) {
        const binary = atob(entry.base64);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        transfer.items.add(new File([bytes], entry.name, { type: entry.mimeType }));
      }

      element.dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }),
      );
    },
    files.map((file) => ({
      name: file.name,
      mimeType: file.mimeType,
      base64: file.buffer.toString("base64"),
    })),
  );
}

/**
 * A real 1×1 GIF: a format the sniffer recognises and the Tool does not take.
 *
 * The bytes are the format's own smallest example, so the refusal under test is
 * the one a visitor's animated sticker would get, not a made-up prefix.
 */
export function gifFile(name = "sticker.gif"): NamedBytes {
  return {
    name,
    mimeType: "image/gif",
    buffer: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
  };
}

/**
 * An AVIF-looking file: a real ISO-BMFF `ftyp` box with the `avif` brand.
 *
 * It is not decodable AVIF, because this Tool never decodes it: the gate's
 * subject is the sniff at the byte level, and the file's purpose is to carry
 * the container a phone or an editor actually writes when it says AVIF.
 */
export function avifFile(name = "photo.avif"): NamedBytes {
  const body = Buffer.concat([
    Buffer.from("ftyp"),
    Buffer.from("avif"),
    Buffer.from([0, 0, 0, 0]),
    Buffer.from("mif1"),
    Buffer.from("avif"),
  ]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(body.length + size.length);

  return { name, mimeType: "image/avif", buffer: Buffer.concat([size, body]) };
}

/**
 * Text renamed to `.png`, with the declared type to match.
 *
 * Both the name and the declared type lie; the bytes do not. This is the case
 * the input's missing `accept` attribute exists for, and the one that must be
 * refused as "not an image" rather than reach the decoder.
 */
export function renamedTextFile(name = "not-really.png"): NamedBytes {
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from("this is a text file with a picture's name\n", "utf8"),
  };
}

/** `图片-YYYY-MM-DD.pdf`, in the browser's (this machine's) local calendar day. */
export function todayPdfName(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `图片-${year}-${month}-${day}.pdf`;
}

/** What a second implementation reads back from the downloaded file. */
export type PdfFacts = {
  bytes: Buffer;
  pageCount: number;
  mediaBoxes: { width: number; height: number }[];
  /** One entry per page: the number of image XObjects its resources name. */
  imagesPerPage: number[];
  /** The raw contents of every image XObject, in document order. */
  imageStreams: Buffer[];
};

/**
 * Read the download with `pdf-lib` — a library the site does not ship, installed
 * as a dev dependency. It is a second implementation on purpose: the gate checks
 * this repository's writer against it, rather than against itself.
 */
export async function inspectDownloadedPdf(path: string): Promise<PdfFacts> {
  const bytes = await readFile(path);
  const document = await PDFDocument.load(bytes);

  const mediaBoxes: { width: number; height: number }[] = [];
  const imagesPerPage: number[] = [];
  const imageStreams: Buffer[] = [];

  for (const page of document.getPages()) {
    const box = page.getMediaBox();
    mediaBoxes.push({ width: box.width, height: box.height });

    const resources = page.node.Resources();
    const xobjects = resources?.lookup(PDFName.of("XObject"));

    if (!(xobjects instanceof PDFDict)) {
      imagesPerPage.push(0);
      continue;
    }

    const names = xobjects.keys();
    imagesPerPage.push(names.length);

    for (const name of names) {
      const stream = xobjects.lookup(name);
      if (!(stream instanceof PDFRawStream)) continue;
      imageStreams.push(Buffer.from(stream.contents));
    }
  }

  return {
    bytes,
    pageCount: document.getPageCount(),
    mediaBoxes,
    imagesPerPage,
    imageStreams,
  };
}
