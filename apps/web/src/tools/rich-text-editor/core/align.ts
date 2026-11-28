/**
 * Alignment's shape (#230), the half both HTML paths share.
 *
 * Alignment is an attribute of a text block, not a node of its own and not a
 * mark: the document stores `textAlign` on a paragraph or a heading, and HTML
 * stores the same fact as `style="text-align: …"`. Left is the **absence** of the
 * attribute rather than a value it carries, which is why this module answers with
 * `null` for it: a document that says `left` and a document that says nothing are
 * the same document, and the writer and the sanitiser have to agree about that or
 * an export/import round trip would add an attribute every time.
 *
 * Only the values the model accepts are here. `justify` is deliberately absent:
 * the spec excluded it, so a `justify` in an imported file is dropped rather than
 * becoming a value the toolbar has no row for.
 */

/** The three alignments, in the order the toolbar offers them. */
export const TEXT_ALIGNMENTS = ["left", "center", "right"] as const;

export type TextAlignment = (typeof TEXT_ALIGNMENTS)[number];

/**
 * The node types alignment is a property of.
 *
 * Lists, images, tables and the blockquote are not among them. A list item holds
 * a paragraph and so does a quote, so the attribute still lands on that paragraph,
 * which is what the writer sets anyway; what the model rules out is an alignment
 * on the list or the quote node itself.
 */
export const TEXT_ALIGN_NODE_TYPES = ["paragraph", "heading"] as const;

/** The attribute name TipTap's text-align extension stores on the block. */
export const TEXT_ALIGN_ATTRIBUTE = "textAlign";

/** The two values HTML has a style for: left is the attribute's absence. */
export type WrittenTextAlignment = Exclude<TextAlignment, "left">;

/**
 * The canonical HTML form of a stored or parsed alignment, or `null` for none.
 *
 * Both directions of the format go through this one function, so the style an
 * export writes and the style the sanitiser reads back cannot drift: a value is
 * accepted case-insensitively and with surrounding space (CSS keywords are ASCII
 * case-insensitive), `left` and anything outside the model answer `null`, and the
 * caller writes exactly `text-align: ${value}` from it.
 */
export function canonicalTextAlign(value: unknown): WrittenTextAlignment | null {
  if (typeof value !== "string") return null;

  const alignment = value.trim().toLowerCase();

  return alignment === "center" || alignment === "right" ? alignment : null;
}
