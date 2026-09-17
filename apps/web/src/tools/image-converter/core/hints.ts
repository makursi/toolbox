/**
 * The sentences that explain a control nobody can use yet.
 *
 * A disabled control that does not say why is a dead end: it greys out and the
 * visitor is left guessing which of several conditions they are missing. These
 * live in the pure half so the wording can be tested without a browser —
 * `limits.ts` already keeps its refusal messages in the same place.
 */

/**
 * What the background colour is for, given what is selected.
 *
 * The control is disabled unless some target format has no alpha channel, so the
 * sentence has to change with the selection rather than describe one case.
 */
export function backgroundHint(targets: number, flattening: boolean): string {
  if (targets === 0) return "先选择目标格式。";

  return flattening
    ? "为不支持透明通道的格式填充透明像素。"
    : "选中的格式都支持透明通道，用不到背景色。";
}

/** Why the batch cannot start, or `null` when the Convert button is live. */
export function convertHint(files: number, targets: number): string | null {
  if (files === 0) return "先添加文件。";
  if (targets === 0) return "至少选择一个目标格式。";

  return null;
}
