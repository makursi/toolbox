import { useCallback, useRef, useState } from "react";

import { readJpeg, type JpegInfo } from "@/tools/image-to-pdf/core/jpeg";

/**
 * The pages a visit is working on, in page order.
 *
 * A page is one image: its file, and the dimensions the Tool read from the
 * file's own header. The dimensions are kept rather than re-read at render time
 * because the miniature and the PDF are both drawn from them.
 *
 * Admission here is minimal on purpose: a file whose header cannot be walked
 * never becomes a page. #193 owns the refusal sentences, the limits and the
 * other two formats, and widens this hook rather than replacing it.
 */

/** One page in the list. */
export type PageEntry = {
  id: number;
  file: File;
  width: number;
  height: number;
};

/**
 * How much of a file is read to find its frame header. EXIF thumbnails can push
 * the `SOF` past 64 KB, so this is generous; a file whose header is somehow
 * later than this is read whole.
 */
const headBytes = 512 * 1024;

export function usePageList() {
  const [pages, setPages] = useState<PageEntry[]>([]);
  // Read only inside `addFiles`, which awaits between files: a counter that
  // moves synchronously is what keeps two adds from handing out the same id.
  const nextId = useRef(0);

  const addFiles = useCallback(async (incoming: readonly File[]) => {
    if (incoming.length === 0) return;

    const accepted: PageEntry[] = [];

    for (const file of incoming) {
      const info = await readJpegFile(file);
      if (info === null) continue;
      accepted.push({ id: nextId.current++, file, width: info.width, height: info.height });
    }

    if (accepted.length > 0) setPages((previous) => [...previous, ...accepted]);
  }, []);

  const remove = useCallback((id: number) => {
    setPages((previous) => previous.filter((page) => page.id !== id));
  }, []);

  const clear = useCallback(() => setPages([]), []);

  return { pages, addFiles, remove, clear };
}

/**
 * The header of one file, read from as much of its start as the frame needs.
 *
 * The first read is the cheap one; a `SOF` beyond it (an EXIF thumbnail can be
 * larger than 512 KB) means the segment was cut, so the whole file is read and
 * the walk runs again. A file that is not a JPEG is `null` either way.
 */
async function readJpegFile(file: File): Promise<JpegInfo | null> {
  const head = new Uint8Array(await file.slice(0, headBytes).arrayBuffer());
  const info = readJpeg(head);
  if (info !== null || file.size <= headBytes) return info;

  return readJpeg(new Uint8Array(await file.arrayBuffer()));
}
