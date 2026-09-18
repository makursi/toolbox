import { useCallback, useRef, useState } from "react";

import { admitFormat } from "@/tools/image-converter/core/admission";
import type { ImageFormat } from "@/tools/image-converter/core/formats";
import { checkLimits } from "@/tools/image-converter/core/limits";
import { sniffByteLength, sniffFormat } from "@/tools/image-converter/core/sniff";

/** A file that was refused before it could join the queue, and the reason. */
export type RefusedFile = { name: string; message: string };

/**
 * A file that joined the queue, what its own bytes say it is, and the place it
 * holds in the list.
 *
 * The format is kept rather than sniffed again when the list renders: admission
 * has already read the bytes, and the list shows the format the Tool actually
 * read rather than the one the file's name claims.
 *
 * The id exists so a row can be keyed by the file it is showing rather than by
 * where it happens to sit. With a positional key, removing one row remounts
 * every row below it, and a remount throws away that row's thumbnail and decodes
 * it a second time — a blank row and a wasted decode, for a file nothing
 * happened to.
 */
export type QueuedFile = { id: number; file: File; format: ImageFormat };

/**
 * The files a visit is working on, and the ones that never made it in.
 *
 * Two states rather than one, because they answer different questions: the
 * queue is what a Batch runs over, and the refusals are what the visitor has to
 * act on before that Batch is what they meant. Adding is asynchronous — each
 * file's first bytes are read to learn what it really is, whatever its name
 * claims — so a Batch can never start half-way through an add; the button only
 * sees the queue as it stands.
 *
 * Keeping the file and the refusals together is also what makes "clear" one
 * act: a refusal left behind under an empty list describes nothing.
 */
export function useFileQueue() {
  const [entries, setEntries] = useState<QueuedFile[]>([]);
  const [refused, setRefused] = useState<RefusedFile[]>([]);
  // Read only inside `addFiles`, which awaits between files: a counter that
  // moves synchronously is what keeps two adds from handing out the same id.
  const nextId = useRef(0);

  const addFiles = useCallback(async (incoming: readonly File[]) => {
    if (incoming.length === 0) return;

    const accepted: QueuedFile[] = [];
    const rejections: RefusedFile[] = [];

    for (const file of incoming) {
      const size = checkLimits({ bytes: file.size });
      if (!size.ok) {
        rejections.push({ name: file.name, message: size.message });
        continue;
      }

      // Extensions lie, so the format comes from the bytes themselves. Read as
      // many as `sniffFormat` may look at, or a brand late in an ISO-BMFF
      // header would be missed.
      const head = new Uint8Array(await file.slice(0, sniffByteLength).arrayBuffer());
      const admission = admitFormat(sniffFormat(head));

      if (admission.ok) accepted.push({ id: nextId.current++, file, format: admission.format });
      else rejections.push({ name: file.name, message: admission.message });
    }

    setEntries((previous) => [...previous, ...accepted]);
    setRefused((previous) => [...previous, ...rejections]);
  }, []);

  const remove = useCallback((id: number) => {
    setEntries((previous) => previous.filter((entry) => entry.id !== id));
  }, []);

  const clearFiles = useCallback(() => {
    setEntries([]);
    setRefused([]);
  }, []);

  return { entries, refused, addFiles, remove, clearFiles };
}
