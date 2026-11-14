import { PdfFailure } from "../core/failures";
import type { BuildRequest, BuildResponse } from "./worker";

/**
 * The page side of the Worker protocol.
 *
 * One Worker per build: the document is one sequential output stream, so a pool
 * would only parallelise work that has one place to go. The Worker is
 * terminated on every path, including failure, so a build that dies does not
 * leave a thread behind. #197 replaces a cancelled Worker through this same
 * seam.
 */

let nextId = 0;

/**
 * Build one document in a Worker and hand back its bytes.
 *
 * Only `PdfFailure` codes cross back to the page: the Worker's own uncaught
 * errors become `interrupted`, and a response that does not arrive is that
 * same sentence. The caller has phrases for every code, so no raw message can
 * reach a visitor through this function.
 */
export function buildInWorker(request: Omit<BuildRequest, "id">): Promise<Uint8Array<ArrayBuffer>> {
  const id = nextId++;
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });

  return new Promise((resolve, reject) => {
    const settle = (result: () => void) => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("messageerror", onMessageError);
      worker.removeEventListener("error", onError);
      worker.terminate();
      result();
    };

    const onMessage = (event: MessageEvent<BuildResponse>) => {
      const response = event.data;
      if (response.id !== id) return;

      if (response.ok) {
        const bytes = response.bytes;
        settle(() => resolve(new Uint8Array(bytes)));
      } else {
        const code = response.code;
        settle(() => reject(new PdfFailure(code)));
      }
    };
    const onError = (event: ErrorEvent) =>
      settle(() => reject(new PdfFailure("interrupted", { cause: event.error ?? event.message })));
    const onMessageError = () =>
      settle(() =>
        reject(new PdfFailure("interrupted", { cause: "the Worker sent an unreadable message" })),
      );

    worker.addEventListener("message", onMessage);
    worker.addEventListener("messageerror", onMessageError);
    worker.addEventListener("error", onError);

    worker.postMessage({ id, ...request }, request.pages);
  });
}
