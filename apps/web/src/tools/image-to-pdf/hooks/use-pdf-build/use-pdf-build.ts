import { useCallback, useEffect, useRef, useState } from "react";

import { describeFailure } from "@/tools/image-to-pdf/core/failures";
import type { Paper } from "@/tools/image-to-pdf/core/geometry";
import { pdfFileName } from "@/tools/image-to-pdf/core/naming";
import type { PageEntry } from "@/tools/image-to-pdf/hooks/use-page-list/use-page-list";
import { buildInWorker } from "@/tools/image-to-pdf/worker/builder";

/**
 * One run: what it produced, how far it has got, and the object URL it minted.
 *
 * The state is a union rather than a pair of booleans, because a result row can
 * only be in one of these states at a time and `idle` is not the same thing as
 * "building, with no result yet".
 *
 * The URL's whole life is here: created when a build succeeds, revoked when the
 * result is invalidated or the component unmounts. A page list that changes
 * while a stale download is on screen would otherwise hand a visitor a file that
 * does not match the preview, so `reset` is the invalidation as well as the
 * cleanup.
 */

export type BuildStatus = "idle" | "building" | "done" | "failed";

export type PdfResult = {
  /** The object URL the download link points at. */
  url: string;
  /** `图片-YYYY-MM-DD.pdf`, derived when the build finished. */
  name: string;
};

export function usePdfBuild() {
  const [status, setStatus] = useState<BuildStatus>("idle");
  const [result, setResult] = useState<PdfResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const url = useRef<string | null>(null);
  const running = useRef(false);

  const release = useCallback(() => {
    if (url.current !== null) URL.revokeObjectURL(url.current);
    url.current = null;
  }, []);

  // A visit that navigates away mid-build takes its Worker with it; a blob URL
  // the page it belonged to no longer needs is released here.
  useEffect(
    () => () => {
      release();
    },
    [release],
  );

  /** Back to "not converted yet", with no banner and no error: an invalidation, not a failure. */
  const reset = useCallback(() => {
    release();
    setResult(null);
    setFailure(null);
    setStatus("idle");
  }, [release]);

  const start = useCallback(
    async (pages: readonly PageEntry[], paper: Paper) => {
      if (pages.length === 0 || running.current) return;

      running.current = true;
      release();
      setResult(null);
      setFailure(null);
      setStatus("building");

      try {
        // The page sources are handed over transferred: the Worker owns the
        // bytes while it builds, and the page keeps no partial document.
        const sources = await Promise.all(pages.map((page) => page.file.arrayBuffer()));
        const bytes = await buildInWorker({ paper, pages: sources });

        const objectUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        url.current = objectUrl;
        setResult({ url: objectUrl, name: pdfFileName(new Date()) });
        setStatus("done");
      } catch (error) {
        // The console gets the raw failure; the row gets a sentence that was
        // written for a visitor.
        // oxlint-disable-next-line no-console -- a failed build is worth one line, and the interface has only the sentence.
        console.error("PDF build failed:", error);
        setFailure(describeFailure(error));
        setStatus("failed");
      } finally {
        running.current = false;
      }
    },
    [release],
  );

  return { status, result, failure, start, reset };
}
