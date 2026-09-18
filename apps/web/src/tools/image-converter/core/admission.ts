import type { ImageFormat } from "./formats";
import type { Refusal } from "./refusal";
import type { SniffedFormat } from "./sniff";

/**
 * An acceptance carries the format it accepted.
 *
 * The queue has to show the visitor what each file really is, and the sniffed
 * format is that answer — so the gate hands it back instead of the caller
 * working out a second time which sniffed answers it let through. A refusal has
 * nothing to carry, and `Refusal` is the same shape `limits.ts` answers with.
 */
export type Admission = { ok: true; format: ImageFormat } | Refusal;

/**
 * Whether a file the sniffer has read may join the queue.
 *
 * These two sentences used to sit in the component, next to the only place that
 * used them. They are the same kind of thing as the refusals in `limits.ts` — a
 * sentence the visitor reads instead of a file — so they live in the tested half
 * for the same reason: the wording is the product, and checking a full stop
 * should not need a browser.
 *
 * Written as a refusal only, never as a list of what is allowed: a format added
 * to the table is then accepted without anyone remembering to add it here too.
 */
export function admitFormat(format: SniffedFormat | null): Admission {
  if (format === null) return { ok: false, message: "无法识别这个文件的格式。" };
  if (format === "heic") return { ok: false, message: "暂不支持 HEIC 文件。" };

  return { ok: true, format };
}
