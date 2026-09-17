/**
 * The sentences that explain a control nobody can use yet.
 *
 * A disabled control that does not say why is a dead end: it greys out and the
 * visitor is left guessing which of several conditions they are missing. This
 * lives in the pure half so the wording can be tested without a browser —
 * `limits.ts` already keeps its refusal messages in the same place.
 */

/** Why the batch cannot start, or `null` when the Convert button is live. */
export function convertHint(files: number, targets: number): string | null {
  if (files === 0) return "先添加文件。";
  if (targets === 0) return "至少选择一个目标格式。";

  return null;
}
