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
 * Whether the document says nothing at all (#211).
 *
 * Import asks before replacing a document with content. The question is whether
 * something would be lost, so it is about what the document *says* rather than
 * about its node count: the starting document is already two empty blocks, and a
 * title the visitor typed into is content even though the body is still empty.
 *
 * A non-text leaf counts: a rule is something a visitor placed, while a hard
 * break alone (an empty line) is not. An empty code block or heading is not
 * content either, because it paints nothing and exports as nothing.
 */
export function isEmptyDocument(document: JSONContent): boolean {
  return !(document.content ?? []).some(hasContent);
}

function hasContent(node: JSONContent): boolean {
  if (typeof node.text === "string" && node.text.trim() !== "") return true;
  if (node.type === "horizontalRule") return true;
  // An image is content even though it holds no words (#216): a picture the visitor
  // placed is exactly what an import would silently replace, and it is a leaf, so
  // no walk below would find anything to count.
  if (node.type === "image") return true;

  return (node.content ?? []).some(hasContent);
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

/**
 * The literal text inside a code block, hard breaks included.
 *
 * The two writers derive it the same way because a code block holds its content as
 * text nodes and hard breaks, and neither Markdown's fence nor HTML's `<pre>` may
 * gain or lose a newline on the way out. It lives here rather than beside one of
 * them so the two exports cannot disagree about what a code block says.
 */
export function codeText(node: JSONContent): string {
  return (node.content ?? [])
    .map((child) => (typeof child.text === "string" ? child.text : codeText(child)))
    .join("")
    .replace(/\r\n?/gu, "\n");
}

/**
 * The heading level a document may carry, clamped to the six levels both formats
 * have.
 *
 * A level outside 1–6 is not something the editor's schema can produce, so this is
 * a guard at the boundary rather than a policy: a document that arrived by some
 * other route writes as an H1 instead of as `h0` or seven hashes.
 */
export function headingLevel(node: JSONContent): number {
  const level = Number(node.attrs?.level ?? 1);

  return Number.isInteger(level) && level >= 1 && level <= 6 ? level : 1;
}
