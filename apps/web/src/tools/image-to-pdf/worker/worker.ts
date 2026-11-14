import { failureCode, PdfFailure, type PdfFailureCode } from "../core/failures";
import { pageGeometry, type Paper } from "../core/geometry";
import { canPassThrough, readJpeg } from "../core/jpeg";
import { buildPdf, type PdfPage } from "../core/pdf";

/**
 * The Worker side of one document.
 *
 * It receives the page sources and the paper, walks each JPEG's header itself so
 * that nothing the page claims about its files is trusted, and writes the whole
 * document here. One request in, one response out; #197 adds progress messages
 * and a cancel to the same protocol.
 *
 * It needs no DOM, no canvas and no PDF library: the pure core does the work,
 * and everything expensive is on the page's behalf in this thread.
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
  respond(event.data);
});

function respond(request: BuildRequest): void {
  try {
    const pages = request.pages.map((bytes) => toPage(bytes, request.paper));
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
 * The header walk runs here rather than trusting dimensions sent from the page,
 * and the passthrough predicate decides the path: a baseline 1- or 3-channel
 * JPEG keeps its original bytes; everything else is refused for now, because
 * #195 adds the decode path and writing a stream the predicate did not approve
 * would be the one way this Tool could produce a wrong file.
 */
function toPage(buffer: ArrayBuffer, paper: Paper): PdfPage {
  const bytes = new Uint8Array(buffer);
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
