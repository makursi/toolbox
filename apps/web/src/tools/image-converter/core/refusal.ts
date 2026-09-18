/**
 * "No, and here is the sentence the visitor reads."
 *
 * Two checks answer a file this way: the size and pixel limits, and whether the
 * sniffed format is one this Tool converts. They are separate decisions with
 * separate wording, but the visitor-facing shape of a refusal is one thing, and
 * it is the shape the UI and the queue both branch on — so it is spelled once
 * here rather than once per check. Each check then pairs it with whatever an
 * acceptance has to hand back: `Admission` carries the format it let through,
 * `LimitResult` the reason it did not, and neither needs a shared "accepted"
 * shape that says nothing.
 */
export type Refusal = { ok: false; message: string };
