import type { JSONContent } from "@tiptap/react";

/**
 * What an empty document is: a title block and one paragraph, both empty.
 *
 * The title is the document's first line rather than a second input beside the
 * canvas, so the exported file's title and the line a visitor types into are the
 * same node. `level: 1` is the H1 the document keeps in the export as well; the
 * page's own H1 is the Tool's name, at a different scope.
 *
 * It lives in the pure core because two places need the same document: the
 * editor, which starts from it, and 清空, which returns to it. A copy in each
 * would be two answers to "what is an empty document" that can drift.
 */
export const EMPTY_DOCUMENT: JSONContent = {
  type: "doc",
  content: [{ type: "heading", attrs: { level: 1 } }, { type: "paragraph" }],
};

/**
 * The words a node holds, joined without separators: the document's own text,
 * with a hard break contributing nothing rather than a space.
 */
function wordsOf(node: JSONContent): string {
  if (typeof node.text === "string") return node.text;

  return (node.content ?? []).map(wordsOf).join("");
}

/**
 * The document's title: the first heading at the top level, or `""` when there
 * is none.
 *
 * It is the first heading rather than the first block because the title block is
 * the document's first line and an H1 by construction, and because the HTML
 * export puts the same words in `<title>` (#210). A heading the visitor makes
 * further down is not the title; the first one is. The title of a document with
 * no heading at all is empty, and each consumer decides what an empty title
 * exports as: the filename falls back to 文档, the HTML `<title>` to 无标题.
 */
export function documentTitle(document: JSONContent): string {
  const heading = (document.content ?? []).find((node) => node.type === "heading");

  return heading === undefined ? "" : wordsOf(heading).trim();
}
