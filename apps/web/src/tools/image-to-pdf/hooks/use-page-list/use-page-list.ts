import { useCallback, useRef, useState } from "react";

import { admitImages, type Candidate } from "@/tools/image-to-pdf/core/admission";
import { readImageHeader, type ImageHeader } from "@/tools/image-to-pdf/core/image-size";
import { movePage } from "@/tools/image-to-pdf/core/order";
import type { ExifOrientation } from "@/tools/image-to-pdf/core/orientation";
import {
  isAcceptedFormat,
  sniffByteLength,
  sniffFormat,
  type ImageFormat,
} from "@/tools/image-to-pdf/core/sniff";

/**
 * The pages a visit is working on, in page order, and the files that were
 * refused.
 *
 * A page is one image: its file, the format the bytes named, the dimensions read
 * from its own header, and the EXIF turn that header carries. All of them are
 * kept rather than re-read at render time, because the miniature and the PDF are
 * both drawn from them.
 *
 * Admission is one pure decision per batch (`core/admission.ts`): this hook only
 * reads the bytes, asks it, and appends the accepted pages. The refusals are
 * kept beside the pages so one clear action clears both; an empty list with a
 * refusal under it is still showing why the last batch did not arrive.
 */

/** A file that was refused before it could join the list, and the sentence it is listed under. */
export type RefusedFile = { name: string; message: string };

/** One page in the list. */
export type PageEntry = {
  id: number;
  file: File;
  /** The format the file's bytes name, never the one its name claims. */
  format: ImageFormat;
  /** The stored dimensions: what the page's geometry is laid out from. */
  width: number;
  height: number;
  /** The EXIF turn the header carried; 1 for a PNG or a WebP. */
  orientation: ExifOrientation;
};

/**
 * How much of a file is read to find its header. A JPEG's `SOF` can sit behind
 * a large EXIF thumbnail, so this is generous; a file whose header is somehow
 * later than this is read whole. PNG's `IHDR` and WebP's first chunk are in the
 * first few dozen bytes, so they never need the second read.
 */
const headBytes = 512 * 1024;

export function usePageList() {
  const [pages, setPages] = useState<PageEntry[]>([]);
  const [refused, setRefused] = useState<RefusedFile[]>([]);
  // The rendered pages, readable synchronously: admission depends on what the
  // list already holds, and a second add must see the first one's pages.
  const current = useRef<PageEntry[]>([]);
  // Adds run one after another. Two batches that both read the same totals
  // could otherwise both fit under a limit that only one of them should.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // Read only inside the queued add: a counter that moves synchronously is what
  // keeps two adds from handing out the same id.
  const nextId = useRef(0);

  const addFiles = useCallback((incoming: readonly File[]): Promise<number> => {
    if (incoming.length === 0) return Promise.resolve(0);

    const job = queue.current.then(async () => {
      const candidates: Candidate[] = [];
      // The turn travels beside the dimensions: the decision below only reads
      // the pixels, and the accepted page keeps the orientation the same read
      // found.
      const orientations: ExifOrientation[] = [];

      for (const file of incoming) {
        // Extensions lie, so the format comes from the bytes themselves.
        const head = new Uint8Array(await file.slice(0, sniffByteLength).arrayBuffer());
        const format = sniffFormat(head);
        const header =
          format !== null && isAcceptedFormat(format) ? await readHeader(file, format) : null;

        candidates.push({ name: file.name, size: file.size, format, pixels: header?.size ?? null });
        orientations.push(header?.orientation ?? 1);
      }

      const decisions = admitImages(candidates, {
        count: current.current.length,
        bytes: totalBytes(current.current),
      });

      const accepted: PageEntry[] = [];
      const rejections: RefusedFile[] = [];

      for (const [index, file] of [...incoming].entries()) {
        const decision = decisions[index];
        if (decision === undefined) continue;

        if (!decision.ok) {
          rejections.push({ name: file.name, message: decision.message });
          continue;
        }

        accepted.push({
          id: nextId.current++,
          file,
          format: decision.format,
          height: decision.pixels.height,
          orientation: orientations[index] ?? 1,
          width: decision.pixels.width,
        });
      }

      current.current = [...current.current, ...accepted];
      setPages(current.current);
      if (rejections.length > 0) setRefused((previous) => [...previous, ...rejections]);

      return accepted.length;
    });

    queue.current = job.then(
      () => undefined,
      () => undefined,
    );

    return job;
  }, []);

  const remove = useCallback((id: number) => {
    current.current = current.current.filter((page) => page.id !== id);
    setPages(current.current);
  }, []);

  /**
   * Put the page with `activeId` where the page with `overId` is.
   *
   * The drag layer reports ids, not positions, so this is where the two are
   * turned into each other and `core/order.ts` is asked for the new order. It
   * answers whether anything changed, because a drop back onto the row's own
   * position is not a change to the document and must not invalidate a result.
   */
  const reorder = useCallback((activeId: number, overId: number): boolean => {
    const from = current.current.findIndex((page) => page.id === activeId);
    const to = current.current.findIndex((page) => page.id === overId);

    if (from === -1 || to === -1 || from === to) return false;

    current.current = movePage(current.current, from, to);
    setPages(current.current);
    return true;
  }, []);

  const clear = useCallback(() => {
    current.current = [];
    setPages([]);
    setRefused([]);
  }, []);

  return { pages, refused, addFiles, remove, reorder, clear };
}

/** The bytes the list already holds, which the total limit is measured against. */
function totalBytes(pages: readonly PageEntry[]): number {
  return pages.reduce((total, page) => total + page.file.size, 0);
}

/**
 * One file's header from its own bytes: the dimensions and, for a JPEG, the
 * EXIF turn.
 *
 * The first read is the cheap one; a `SOF` beyond it (an EXIF thumbnail can be
 * larger than 512 KB) means the header was cut, so the whole file is read and
 * the walk runs again. `null` means no header this Tool can read, which
 * admission turns into a refusal rather than a page with no shape.
 */
async function readHeader(file: File, format: ImageFormat): Promise<ImageHeader | null> {
  const head = new Uint8Array(await file.slice(0, headBytes).arrayBuffer());
  const header = readImageHeader(format, head);

  // Only a JPEG's frame can sit beyond the first read. PNG's IHDR and WebP's
  // first chunk are at the start, so reading a large PNG again would only
  // re-confirm that its header is missing.
  if (format !== "jpeg" || header !== null || file.size <= headBytes) return header;

  return readImageHeader(format, new Uint8Array(await file.arrayBuffer()));
}
