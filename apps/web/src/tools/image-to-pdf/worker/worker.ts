import { failureCode, PdfFailure, type PdfFailureCode } from "../core/failures";
import { pageGeometry, type Paper } from "../core/geometry";
import { readJpeg, routeJpeg } from "../core/jpeg";
import { MAX_IMAGE_PIXELS } from "../core/limits";
import type { ExifOrientation } from "../core/orientation";
import { flateRgb } from "../core/packing";
import { buildPdf, type PdfPage } from "../core/pdf";
import { isAcceptedFormat, sniffFormat } from "../core/sniff";

/**
 * The Worker side of one document.
 *
 * It receives the page sources and the paper, sniffs each page's bytes itself so
 * that nothing the page claims about its files is trusted, and writes the whole
 * document here. One request in, one response out; #197 adds progress messages
 * and a cancel to the same protocol.
 *
 * Two image paths meet here and nowhere above. A baseline JPEG keeps its own
 * bytes (`/Filter /DCTDecode`, no decode, no re-encode) and its EXIF turn
 * becomes a content-stream matrix. A progressive or four-channel JPEG, a PNG or
 * a WebP cannot take that path: the browser decodes it here and the pixels go to
 * the writer as raw RGB samples, with the same matrix from the same header. Both
 * paths end in one `PdfPage`, so the writer decides the stream from the image
 * kind and nothing above this file grows a branch.
 */

export type BuildRequest = {
  id: number;
  paper: Paper;
  /** The page sources in page order. The buffers are transferred, not copied. */
  pages: ArrayBuffer[];
};

export type BuildResponse =
  | { id: number; ok: true; bytes: ArrayBuffer }
  | { id: number; ok: false; code: PdfFailureCode };

/**
 * Just enough of the worker global to talk over `postMessage`.
 *
 * Spelled out rather than pulled from the `WebWorker` lib, which cannot be
 * loaded alongside `DOM` without the two disagreeing about shared names.
 */
type WorkerContext = {
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent<BuildRequest>) => void,
  ) => void;
  postMessage: (message: BuildResponse, transfer?: Transferable[]) => void;
};

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `self` is the worker global at runtime; the DOM lib types it as a Window.
const context = self as unknown as WorkerContext;

context.addEventListener("message", (event: MessageEvent<BuildRequest>) => {
  void respond(event.data);
});

async function respond(request: BuildRequest): Promise<void> {
  try {
    const pages: PdfPage[] = [];
    // One page at a time: a decode is the expensive step, and a document is one
    // sequence of bytes anyway.
    for (const source of request.pages) pages.push(await toPage(source, request.paper));

    const bytes = buildPdf(pages);

    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage takes a transfer list, not a target origin.
    context.postMessage({ id: request.id, ok: true, bytes: bytes.buffer }, [bytes.buffer]);
  } catch (error) {
    // The visitor gets the sentence; the console gets the thing that actually
    // threw. A Worker has nowhere else to put it.
    // oxlint-disable-next-line no-console -- a failed build is worth one line, and a Worker has nowhere else to put it.
    console.error("PDF build failed:", error);
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage takes a transfer list, not a target origin.
    context.postMessage({ id: request.id, ok: false, code: failureCode(error) });
  }
}

/**
 * One page source to one page of the document.
 *
 * The format and the header walk both run here rather than trusting anything the
 * page claims. `routeJpeg` is the one decision about a JPEG: a baseline 1- or
 * 3-channel file keeps its original bytes and is turned by the writer's matrix;
 * a progressive or four-channel one is decoded into RGB samples; a frame neither
 * path can read is refused with the `unsupported` sentence. PNG and WebP are
 * decoded for the same reason a progressive JPEG is: no PDF filter carries their
 * compressed bytes.
 */
async function toPage(buffer: ArrayBuffer, paper: Paper): Promise<PdfPage> {
  const bytes = new Uint8Array(buffer);
  const format = sniffFormat(bytes);

  // A page only reaches the Worker after admission, so this is a guard against
  // a page list that changed underneath a run rather than a visitor-facing case.
  if (format === null || !isAcceptedFormat(format)) throw new PdfFailure("unreadable");

  if (format === "jpeg") {
    const info = readJpeg(bytes);
    if (info === null) throw new PdfFailure("unreadable");

    const route = routeJpeg(info);
    if (route === "unsupported") throw new PdfFailure("unsupported");
    if (route === "decode") return decodedPage(bytes, paper, info.orientation);

    return {
      // The page is laid out for the dimensions a visitor sees; the image
      // stream keeps the stored ones, because those are its samples.
      geometry: pageGeometry(info, paper, info.orientation),
      image: {
        kind: "jpeg",
        bytes,
        width: info.width,
        height: info.height,
        channels: info.channels,
        orientation: info.orientation,
      },
    };
  }

  return decodedPage(bytes, paper);
}

/**
 * A decoded image to a page of raw RGB samples.
 *
 * The geometry comes from the dimensions the decoder reported, not from the
 * file's header: those are the pixels being written, and a page whose box
 * disagreed with its own samples would letterbox the image against itself. The
 * pixel limit is checked here as well as at admission because a header is a
 * claim, and this is the first place that knows the true size.
 *
 * `orientation` is the EXIF turn the *file* carried. The decoder is asked for
 * the stored pixels (`imageOrientation: "none"`), so the samples and the
 * dimensions are the recorded picture and the writer applies the same matrix a
 * passed-through JPEG gets. Letting the decoder turn the picture instead would
 * put the same rule in a browser's hands on one path and in a tested table on
 * the other.
 */
async function decodedPage(
  bytes: Uint8Array<ArrayBuffer>,
  paper: Paper,
  orientation: ExifOrientation = 1,
): Promise<PdfPage> {
  const bitmap = await decode(bytes);

  try {
    if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) throw new PdfFailure("too-many-pixels");

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    // `alpha: true` (the default) on purpose: the composite onto white page
    // paper is `core/packing.ts`'s job, where a unit test can hold it. Letting
    // the canvas do it would flatten through an unspecified background and take
    // the rule out of the tested layer.
    const context2d = canvas.getContext("2d");
    if (context2d === null) throw new PdfFailure("unknown");

    context2d.drawImage(bitmap, 0, 0);
    const pixels = context2d.getImageData(0, 0, bitmap.width, bitmap.height);
    const samples = flateRgb(new Uint8Array(pixels.data.buffer), bitmap.width, bitmap.height);

    return {
      geometry: pageGeometry({ width: bitmap.width, height: bitmap.height }, paper, orientation),
      image: {
        kind: "raw-rgb",
        bytes: samples,
        width: bitmap.width,
        height: bitmap.height,
        orientation,
      },
    };
  } finally {
    // The bitmap holds decoded pixels; the samples above are their own copy.
    bitmap.close();
  }
}

/**
 * Decode a blob in the browser's own decoder.
 *
 * `imageOrientation: "none"` is explicit rather than assumed: it asks for the
 * pixels as the file stores them, which is what lets the tested orientation
 * matrix be the only thing that turns a picture, on this path and the
 * passthrough one alike. A file that will not decode is the visitor-facing
 * failure here, and the browser's message for it is written for a developer:
 * "The source image could not be decoded." The error is kept as the cause and
 * goes to the console; the sentence `unreadable` carries is the one the visitor
 * reads.
 */
async function decode(bytes: Uint8Array<ArrayBuffer>): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(new Blob([bytes]), { imageOrientation: "none" });
  } catch (error) {
    throw new PdfFailure("unreadable", { cause: error });
  }
}
