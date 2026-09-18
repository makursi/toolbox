/**
 * The line above the file list: how many files are in it, and how many outputs
 * are waiting further down the page.
 *
 * Both numbers, because the 清空 button sits beside this line and empties both
 * lists. A button that removes the downloads without ever having mentioned them
 * is the thing this sentence exists to prevent, which is also why the two are
 * joined into one string instead of being rendered as two labels: they are one
 * statement about one control.
 *
 * In the pure half for the same reason as `hints.ts` — it is a sentence the
 * visitor reads, so the wording is checked without a browser.
 */
export function addedSummary(files: number, outputs: number): string | null {
  const counts: string[] = [];
  if (files > 0) counts.push(`已添加 ${files} 张`);
  if (outputs > 0) counts.push(`已生成 ${outputs} 个文件`);

  // Null rather than an empty string: the caller uses this to decide whether the
  // row exists at all, and "no counts" and "a count of nothing" are not the same
  // answer. The rejected list is what the row can still be left holding.
  return counts.length === 0 ? null : counts.join("，");
}
