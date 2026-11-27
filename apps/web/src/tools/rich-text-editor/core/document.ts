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
