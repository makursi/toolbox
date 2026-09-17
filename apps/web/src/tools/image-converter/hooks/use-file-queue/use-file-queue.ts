import { useCallback, useState } from "react";

import { admitFormat } from "@/tools/image-converter/core/admission";
import { checkLimits } from "@/tools/image-converter/core/limits";
import { sniffByteLength, sniffFormat } from "@/tools/image-converter/core/sniff";

/** A file that was refused before it could join the queue, and the reason. */
export type RefusedFile = { name: string; message: string };

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
  const [files, setFiles] = useState<File[]>([]);
  const [refused, setRefused] = useState<RefusedFile[]>([]);

  const addFiles = useCallback(async (incoming: readonly File[]) => {
    if (incoming.length === 0) return;

    const accepted: File[] = [];
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

      if (admission.ok) accepted.push(file);
      else rejections.push({ name: file.name, message: admission.message });
    }

    setFiles((previous) => [...previous, ...accepted]);
    setRefused((previous) => [...previous, ...rejections]);
  }, []);

  const removeAt = useCallback((index: number) => {
    setFiles((previous) => previous.filter((_, at) => at !== index));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setRefused([]);
  }, []);

  return { files, refused, addFiles, removeAt, clearFiles };
}
