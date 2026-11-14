import { useCallback, useEffect, useRef, useState } from "react";

import { describeFailure } from "@/tools/image-to-pdf/core/failures";
import type { Paper } from "@/tools/image-to-pdf/core/geometry";
import { pdfFileName } from "@/tools/image-to-pdf/core/naming";
import type { PageEntry } from "@/tools/image-to-pdf/hooks/use-page-list/use-page-list";
import { buildInWorker, BuildCancelled } from "@/tools/image-to-pdf/worker/builder";

/**
 * One run: what it produced, how far it has got, and the bytes it built.
 *
 * The state is a union rather than a pair of booleans, because a result row can
 * only be in one of these states at a time and `idle` is not the same thing as
 * "building, with no result yet".
 *
 * `progress` is separate from `status` because it also describes a run that has
 * ended: the last count stays on screen beside the download. It is `null` only
 * when there is no run to describe, which is exactly the "not converted yet"
 * state that an invalidation and a cancellation both restore.
 *
 * The bytes and the derived name are the run's state; the object URL is not.
 * A produced file is invalidated by clearing this state, and the element that
 * shows the result mints its `blob:` URL from the bytes with the shared
 * `useObjectUrl` hook, so invalidation, cancellation and unmount all release it
 * by construction. A page list that changes while a stale download is on screen
 * would otherwise hand a visitor a file that does not match the preview, so
 * `reset` is the invalidation as well as the cleanup.
 */

export type BuildStatus = "idle" | "building" | "done" | "failed";

/** How many pages a run has finished, out of how many it planned. */
export type BuildProgress = { done: number; total: number };

export type PdfResult = {
  /** The finished document, held for the result element that shows it. */
  bytes: Uint8Array<ArrayBuffer>;
  /** `图片-YYYY-MM-DD.pdf`, derived when the build finished. */
  name: string;
};

export function usePdfBuild() {
  const [status, setStatus] = useState<BuildStatus>("idle");
  const [result, setResult] = useState<PdfResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [progress, setProgress] = useState<BuildProgress | null>(null);
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);
  /**
   * Which run owns the form.
   *
   * A cancelled run's promise settles after the visitor has already moved on.
   * Comparing this number against the run that started is what stops that late
   * settlement from painting a result, a failure or a progress count over the
   * run that replaced it.
   */
  const generation = useRef(0);

  /**
   * Back to "not converted yet": no download, no banner, no progress, and no
   * Worker. This is one function because it is one state: the page reaches it by
   * invalidating a produced file (a change to the list or the paper) and the
   * visitor reaches it by pressing 取消. Neither is a failure.
   */
  const stop = useCallback(() => {
    generation.current += 1;
    controller.current?.abort();
    controller.current = null;
    running.current = false;
    setResult(null);
    setFailure(null);
    setProgress(null);
    setStatus("idle");
  }, []);

  // A visit that navigates away mid-run takes its Worker with it. No state is
  // set: this component is going away, and the point is only that nothing keeps
  // running for a page nobody is looking at. The result element unmounts with
  // it, so `useObjectUrl` releases the URL on the same exit.
  useEffect(
    () => () => {
      generation.current += 1;
      controller.current?.abort();
      controller.current = null;
      running.current = false;
    },
    [],
  );

  const start = useCallback(async (pages: readonly PageEntry[], paper: Paper) => {
    if (pages.length === 0 || running.current) return;

    const run = generation.current + 1;
    generation.current = run;
    const abort = new AbortController();
    controller.current = abort;
    running.current = true;

    setResult(null);
    setFailure(null);
    // The run's size is known before the first page finishes, so the line
    // starts at "0 of N" rather than appearing after the first decode.
    setProgress({ done: 0, total: pages.length });
    setStatus("building");

    try {
      // The page sources are handed over transferred: the Worker owns the
      // bytes while it builds, and the page keeps no partial document.
      const sources = await Promise.all(pages.map((page) => page.file.arrayBuffer()));

      // A cancel during the reads is already a cancelled run: the Worker it
      // would have spawned is never spawned.
      if (run !== generation.current) return;

      const bytes = await buildInWorker(
        { paper, pages: sources },
        {
          signal: abort.signal,
          onProgress: (next) => {
            if (run === generation.current) {
              setProgress({ done: next.done, total: next.total });
            }
          },
        },
      );

      // A Worker that was terminated cannot send, but a result that was
      // already in flight when the visitor pressed 取消 must not be painted.
      if (run !== generation.current) return;

      setResult({ bytes, name: pdfFileName(new Date()) });
      setStatus("done");
    } catch (error) {
      // A cancelled run is not a failure: the form is already back in "not
      // converted yet", and the console has nothing to explain.
      if (run !== generation.current || error instanceof BuildCancelled) return;

      // The console gets the raw failure; the row gets a sentence that was
      // written for a visitor.
      // oxlint-disable-next-line no-console -- a failed build is worth one line, and the interface has only the sentence.
      console.error("PDF build failed:", error);
      setFailure(describeFailure(error));
      setStatus("failed");
    } finally {
      // Only the run that owns the form may put it down: a cancelled run's
      // `finally` must not reopen the form while its replacement is running.
      if (run === generation.current) {
        running.current = false;
        controller.current = null;
      }
    }
  }, []);

  return { status, result, failure, progress, start, reset: stop, cancel: stop };
}
