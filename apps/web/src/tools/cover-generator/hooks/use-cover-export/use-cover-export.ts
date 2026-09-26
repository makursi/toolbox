import { snapdom } from "@zumer/snapdom";
import { useState, type RefObject } from "react";

import {
  defaultCoverName,
  sanitizeFileName,
  uniqueCoverName,
} from "@/tools/cover-generator/core/naming";
import type { Ratio } from "@/tools/cover-generator/core/ratios";
import type { Composition } from "@/tools/cover-generator/core/state";

/**
 * The download: the off-screen composition at its full pixel size, captured by
 * SnapDOM and handed to the browser as a PNG named by the rule.
 *
 * The dependencies arrive as parameters — the element to capture and the
 * composition to capture from — the way `useFileThumbnail` takes its file, so
 * the hook has no reach back into the editor. The `exporting` flag is this
 * concern's own state: it disables the download button while SnapDOM runs.
 */
export function useCoverExport(
  exportRef: RefObject<HTMLDivElement | null>,
  composition: Composition,
  ratio: Ratio,
) {
  const [exporting, setExporting] = useState(false);

  async function exportCover() {
    const element = exportRef.current;
    if (element === null) return;
    setExporting(true);
    try {
      const result = await snapdom(element, {
        width: ratio.width,
        height: ratio.height,
        format: "png",
        backgroundColor: composition.transparent ? null : undefined,
        // SnapDOM warns when inline/table-cell text may re-wrap under font
        // fallback; reconcile pins exact layout (see the #61 finding in the
        // README).
        reconcile: true,
      });
      const blob = await result.toBlob({ format: "png" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const base =
        composition.filename.trim() === ""
          ? defaultCoverName(composition.ratioId, composition.leftText, composition.rightText)
          : sanitizeFileName(composition.filename);
      anchor.href = url;
      anchor.download = `${uniqueCoverName(base, new Set())}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return { exportCover, exporting };
}
