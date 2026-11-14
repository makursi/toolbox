import { PdfFailure } from "../core/failures";
import type { BuildProgressMessage, BuildRequest, BuildResponse } from "./worker";

/**
 * The page side of the Worker protocol.
 *
 * One Worker per build. The document is one sequential output stream, so pages
 * cannot be assembled in parallel and a pool of Workers would only contend for
 * the one writer; the spec settled against a pool for that reason. The Worker is
 * terminated on every path, including failure and cancellation, and the next
 * build starts from a fresh Worker, so nothing from a finished or cancelled run
 * survives this seam.
 *
 * Only values cross back to the page: a progress count per finished page, and
 * then either the file or a code from the closed set in `core/failures.ts`. The
 * Worker's own uncaught errors become `interrupted`, and a response that does
 * not arrive is that same sentence. Cancellation is not a failure and does not
 * borrow a code: it rejects with `BuildCancelled`, which the run's state knows
 * how to put down without a sentence.
 */

let nextId = 0;

/**
 * The rejection a cancelled run produces.
 *
 * Deliberately not a `PdfFailure`: a cancelled run has no sentence, no banner
 * and no place in the closed set of failure codes. It means "nothing happened",
 * which is the state the page was in before 转换 was pressed.
 */
export class BuildCancelled extends Error {
  constructor() {
    super("the build was cancelled");
    this.name = "BuildCancelled";
  }
}

export type BuildOptions = {
  /** Called once per finished page, in page order, before the result arrives. */
  onProgress?: (progress: BuildProgressMessage) => void;
  /**
   * Aborting stops the run: the Worker is terminated where it is and the
   * promise rejects with `BuildCancelled`. A later build spawns a new Worker,
   * which is what "replace it" means at this seam.
   */
  signal?: AbortSignal;
};

/**
 * Build one document in a Worker and hand back its bytes.
 *
 * The caller gets the whole document or a failure, never a partial one. A
 * cancelled run gets neither: it is put down with `BuildCancelled` so the hook
 * can return to "not converted yet" instead of painting an error.
 */
export function buildInWorker(
  request: Omit<BuildRequest, "id">,
  options: BuildOptions = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const { onProgress, signal } = options;

  // A signal that is already aborted is not worth a Worker: reporting the
  // cancellation now is what keeps a run that was cancelled before it started
  // from spawning a thread nothing will terminate.
  if (signal?.aborted === true) return Promise.reject(new BuildCancelled());

  const id = nextId++;
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });

  return new Promise((resolve, reject) => {
    /**
     * Stop talking to this Worker. Called on every path, so the listeners and
     * the thread cannot outlive the promise: a terminated Worker cannot send a
     * late result, which is the half of cancellation the page can observe.
     */
    const settle = (result: () => void) => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("messageerror", onMessageError);
      worker.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
      worker.terminate();
      result();
    };

    const onAbort = () => settle(() => reject(new BuildCancelled()));

    const onMessage = (event: MessageEvent<BuildResponse>) => {
      const response = event.data;
      if (response.id !== id) return;

      if (response.type === "progress") {
        onProgress?.(response);
        return;
      }

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

    signal?.addEventListener("abort", onAbort, { once: true });

    worker.addEventListener("message", onMessage);
    worker.addEventListener("messageerror", onMessageError);
    worker.addEventListener("error", onError);

    worker.postMessage({ id, ...request }, request.pages);
  });
}
