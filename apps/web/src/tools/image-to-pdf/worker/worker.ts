import { failureCode, PdfFailure, type PdfFailureCode } from "../core/failures";
import { pageGeometry, type Paper } from "../core/geometry";
import { canPassThrough, readJpeg } from "../core/jpeg";
import { MAX_IMAGE_PIXELS } from "../core/limits";
import { flateRgb } from "../core/packing";
import { buildPdf, type PdfPage } from "../core/pdf";
import { isAcceptedFormat, sniffFormat } from "../core/sniff";

/**
 * The Worker side of one document.
 *
 * It receives the page sources and the paper, sniffs each page's bytes itself so
 * that nothing the page claims about its files is trusted, and writes the whole
 * document here. One request in, a progress message after every finished page,
 * and one result out. The result is either the file or a code from the closed
 * set in `core/failures.ts`; a cancelled run never reaches this side, because
 * the page terminates the Worker instead of asking it to stop.
 *
 * The pages are handled one at a time, and that is a decision rather than a
 * simplification: a PDF is one output stream, so pages cannot be written in
 * parallel, and the expensive step (a decode plus a deflate) already owns the
 * Worker's only thread. A pool would add threads that still have to hand their
 * pages to one writer in order, which buys no time and costs the memory of
 * several decoded images at once. The spec settled the same way: one dedicated
 * Worker, no pool.
 *
 * Two image paths meet here and nowhere above. A baseline JPEG keeps its own
 * bytes (`/Filter /DCTDecode`, no decode, no re-encode). A PNG or WebP cannot:
 * there is no PDF filter that carries its compressed bytes through, so the
 * browser decodes it here and the pixels go to the writer as raw RGB samples.
 * Both paths end in one `PdfPage`, so the writer decides the stream from the
 * image kind and nothing above this file grows a branch.
 */

export type BuildRequest = {
  id: number;
  paper: Paper;
  /** The page sources in page order. The buffers are transferred, not copied. */
  pages: ArrayBuffer[];
};

/** One finished page, sent before the document exists so the page can count. */
export type BuildProgressMessage = {
  id: number;
  type: "progress";
  done: number;
  total: number;
};

export type BuildResultMessage =
  | { id: number; type: "result"; ok: true; bytes: ArrayBuffer }
  | { id: number; type: "result"; ok: false; code: PdfFailureCode };

export type BuildResponse = BuildProgressMessage | BuildResultMessage;

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
    const total = request.pages.length;

    // One page at a time, in page order. The document is one sequence of bytes,
    // so this is the only order the writer can take; the count after each page
    // is what makes a run that takes tens of seconds visibly alive.
    for (const [index, source] of request.pages.entries()) {
      pages.push(await toPage(source, request.paper));
      post({ done: index + 1, id: request.id, total, type: "progress" });
    }

    const bytes = buildPdf(pages);

    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage takes a transfer list, not a target origin.
    context.postMessage({ id: request.id, ok: true, type: "result", bytes: bytes.buffer }, [
      bytes.buffer,
    ]);
  } catch (error) {
    // The visitor gets the sentence; the console gets the thing that actually
    // threw. A Worker has nowhere else to put it.
    // oxlint-disable-next-line no-console -- a failed build is worth one line, and a Worker has nowhere else to put it.
    console.error("PDF build failed:", error);
    post({ code: failureCode(error), id: request.id, ok: false, type: "result" });
  }
}

/** Report one message to the page. `total` is resent with every progress count so a reader never has to remember it. */
function post(message: BuildResponse): void {
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage takes a transfer list, not a target origin.
  context.postMessage(message);
}

/**
 * One page source to one page of the document.
 *
 * The format and the header walk both run here rather than trusting anything the
 * page claims. The passthrough predicate still decides the JPEG path: a baseline
 * 1- or 3-channel JPEG keeps its original bytes, and progressive or 4-channel
 * JPEGs are refused for now because #198 owns their decode, not this ticket.
 * PNG and WebP are decoded because the writer cannot carry their own bytes.
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
    if (!canPassThrough(info)) throw new PdfFailure("unsupported");

    return {
      geometry: pageGeometry(info, paper),
      image: {
        kind: "jpeg",
        bytes,
        width: info.width,
        height: info.height,
        channels: info.channels,
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
 */
async function decodedPage(bytes: Uint8Array<ArrayBuffer>, paper: Paper): Promise<PdfPage> {
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
      geometry: pageGeometry(bitmap, paper),
      image: {
        kind: "raw-rgb",
        bytes: samples,
        width: bitmap.width,
        height: bitmap.height,
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
 * A file that will not decode is the visitor-facing failure here, and the
 * browser's message for it is written for a developer: "The source image could
 * not be decoded." The error is kept as the cause and goes to the console; the
 * sentence `unreadable` carries is the one the visitor reads.
 */
async function decode(bytes: Uint8Array<ArrayBuffer>): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(new Blob([bytes]));
  } catch (error) {
    throw new PdfFailure("unreadable", { cause: error });
  }
}
