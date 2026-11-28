import type { JSONContent } from "@tiptap/react";

import { tokens, type Scheme } from "@/lib/tokens";

import { TEXT_ALIGN_ATTRIBUTE, canonicalTextAlign, headingTakesAlignment } from "./align";
import { codeText, documentTitle, headingLevel } from "./document";
import { DEFAULT_IMAGE_WIDTH, asImageWidth } from "./image";

/**
 * The document as a complete, standalone HTML file (#210).
 *
 * The exported file has to open on its own, away from this site: it carries a
 * doctype, a charset, the document's title in `<title>` and a small stylesheet,
 * and it names nothing it would have to fetch. The stylesheet is written in the
 * file rather than linked, and the font stack is the system's own — this site's
 * rule that nothing is loaded from a third party applies to what it exports too,
 * because the file a visitor sends someone must not become a request either.
 *
 * The markup is the document's own: every block and mark ProseMirror holds is
 * rendered as the element with that meaning, and every text run is escaped, so a
 * document that contains `<script>` is a document about `<script>`.
 *
 * An image embeds its bytes as `<img src="data:…">` and keeps the width the
 * document carries as the inline style the node stores (#219); a table becomes a
 * semantic `<table>` with a header row and a body. A highlighted run is `<mark>`,
 * and a block's alignment is a `style` on the element itself (#230); the
 * stylesheet carries the mark's fill per scheme, because the file has to open
 * away from the site that owns the token. Neither asks the file to fetch
 * anything, so the export keeps the same rule the page does.
 */

/** The marks with a plain element, applied innermost first. */
const MARK_ELEMENTS = [
  { element: "u", type: "underline" },
  { element: "s", type: "strike" },
  { element: "em", type: "italic" },
  { element: "mark", type: "highlight" },
  { element: "strong", type: "bold" },
] as const;

/** A mark's `type`, as it appears in ProseMirror JSON. */
type Mark = NonNullable<JSONContent["marks"]>[number];

/**
 * The highlight's fill in one scheme, as the stylesheet's `mark` rule.
 *
 * The two values are read from `lib/tokens.ts`, which is the one module that owns
 * colour (#111) and the table `tokens.test.ts` measures in both schemes. The file
 * they are written into has to open away from this site and cannot read its custom
 * properties (#230), so the values travel as literals; that is not a second copy of
 * them, because the copy this function replaces was the one that could drift.
 */
function markRule(scheme: Scheme): string {
  return `mark { background: ${tokens[scheme].highlight}; color: ${tokens[scheme].highlightInk}; }`;
}

/** The embedded stylesheet: one reading measure, a warm monochrome page, both schemes. */
const STYLESHEET = [
  ":root { color-scheme: light dark; }",
  "body { margin: 0; padding: 48px 24px; background: #faf9f7; color: #1c1b19; }",
  'article { max-width: 720px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; font-size: 16px; line-height: 1.75; }',
  "h1, h2, h3, h4, h5, h6 { margin: 1.6em 0 0.6em; line-height: 1.3; font-weight: 600; }",
  "h1 { margin-top: 0; font-size: 2rem; }",
  "h2 { font-size: 1.5rem; }",
  "h3 { font-size: 1.25rem; }",
  "p { margin: 0.75em 0; }",
  "ul, ol { margin: 0.75em 0; padding-left: 1.6em; }",
  "li { margin: 0.3em 0; }",
  "li > p { margin: 0; }",
  "img { display: block; max-width: 100%; height: auto; margin: 1.5em 0; }",
  "table { width: 100%; margin: 1.5em 0; border-collapse: collapse; }",
  "th, td { padding: 0.5em 0.75em; border: 1px solid #d6d1c7; text-align: left; vertical-align: top; }",
  "th { background: #f1efeb; font-weight: 600; }",
  "th p, td p { margin: 0; }",
  "blockquote { margin: 1.25em 0; padding-left: 1em; border-left: 3px solid #d6d1c7; color: #57534b; }",
  "hr { margin: 2em 0; border: 0; border-top: 1px solid #d6d1c7; }",
  "a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }",
  markRule("light"),
  "code { padding: 0.15em 0.35em; border-radius: 4px; background: #f1efeb; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9em; }",
  "pre { margin: 1.25em 0; padding: 16px; overflow-x: auto; border-radius: 8px; background: #f1efeb; line-height: 1.6; }",
  "pre code { padding: 0; background: none; font-size: 0.875rem; }",
  "ul.task-list { padding-left: 0; list-style: none; }",
  "ul.task-list ul.task-list { padding-left: 1.6em; }",
  "li.task-list-item input { margin-right: 0.5em; }",
  "@media (prefers-color-scheme: dark) {",
  "  body { background: #1c1b19; color: #f2efe8; }",
  "  blockquote { border-left-color: #4a463f; color: #b8b2a7; }",
  "  hr { border-top-color: #4a463f; }",
  "  th, td { border-color: #4a463f; }",
  "  th { background: #2b2926; }",
  "  code, pre { background: #2b2926; }",
  `  ${markRule("dark")}`,
  "}",
].join("\n");

/** Escape a text run or an attribute value; the two differ only in where they are read. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}

/** A code block's language, reduced to the characters a class name accepts. */
function languageClass(node: JSONContent): string {
  const language = typeof node.attrs?.language === "string" ? node.attrs.language.trim() : "";
  const safe = language.replace(/[^A-Za-z0-9_+#.-]/gu, "");

  return safe === "" ? "" : ` class="language-${escapeHtml(safe)}"`;
}

/**
 * Wrap a run in the marks it carries, link outermost so the whole emphasised
 * phrase is the link's text.
 */
function applyMarks(text: string, marks: readonly Mark[]): string {
  const types = new Set(marks.map((mark) => mark.type));
  let output = text;

  for (const mark of MARK_ELEMENTS) {
    if (types.has(mark.type)) output = `<${mark.element}>${output}</${mark.element}>`;
  }

  if (types.has("link")) {
    const href = marks.find((mark) => mark.type === "link")?.attrs?.href;
    if (typeof href === "string" && href !== "") {
      output = `<a href="${escapeHtml(href)}">${output}</a>`;
    }
  }

  return output;
}

/** One text node: code first, because a code span's content is literal. */
function renderText(node: JSONContent): string {
  const text = node.text ?? "";
  const marks = node.marks ?? [];

  if (marks.some((mark) => mark.type === "code"))
    return applyMarks(`<code>${escapeHtml(text)}</code>`, marks);

  return applyMarks(escapeHtml(text), marks);
}

/** A block's inline content. */
function renderInline(nodes: readonly JSONContent[] | undefined): string {
  let output = "";

  for (const node of nodes ?? []) {
    if (node.type === "hardBreak") {
      output += "<br>";
      continue;
    }

    if (node.type === "text" && typeof node.text === "string" && node.text !== "") {
      output += renderText(node);
      continue;
    }

    if (node.content !== undefined) output += renderInline(node.content);
  }

  return output;
}

/** One list item, with its marker as the element the list asked for. */
function renderListItem(item: JSONContent, task: boolean): string {
  const children = item.content ?? [];
  const first = children[0];
  const firstParagraph = first?.type === "paragraph" ? first : undefined;
  const head = firstParagraph === undefined ? "" : renderInline(firstParagraph.content);
  const rest = firstParagraph === undefined ? children : children.slice(1);
  const checkbox = task
    ? `<input type="checkbox" disabled${item.attrs?.checked === true ? " checked" : ""}>`
    : "";
  const className = task ? ' class="task-list-item"' : "";

  const blocks = rest.map(renderBlock).filter((block) => block !== "");

  return `<li${className}>${checkbox}${head}${blocks.length === 0 ? "" : `\n${blocks.join("\n")}`}</li>`;
}

/** A bulleted, ordered or task list. */
function renderList(node: JSONContent): string {
  const task = node.type === "taskList";
  const ordered = node.type === "orderedList";
  const items = (node.content ?? [])
    .filter((item) => item.type === "listItem" || item.type === "taskItem")
    .map((item) => renderListItem(item, task));

  if (items.length === 0) return "";

  if (task) return `<ul class="task-list">\n${items.join("\n")}\n</ul>`;

  if (ordered) {
    const start = Number(node.attrs?.start ?? 1);
    const attribute = Number.isFinite(start) && start !== 1 ? ` start="${String(start)}"` : "";

    return `<ol${attribute}>\n${items.join("\n")}\n</ol>`;
  }

  return `<ul>\n${items.join("\n")}\n</ul>`;
}

/**
 * An image's width as a percentage of the reading measure.
 *
 * The rule is `core/image.ts`'s, shared with the node: this writer is handed JSON
 * rather than a node, and a draft can be hand-edited, so the two entry points must
 * clamp and default the same way. Past the measure the picture would be the one
 * thing that overflows the column the width exists to keep it inside.
 */
function imageWidth(node: JSONContent): number {
  return asImageWidth(node.attrs?.width) ?? DEFAULT_IMAGE_WIDTH;
}

/**
 * A block's alignment as the one style attribute this format gives it (#230).
 *
 * The model stores `textAlign` on the block and HTML stores it as a style on the
 * same element; `left` is the attribute's absence, so a block that says it (or
 * says something outside the model) exports with no style at all. The canonical
 * form comes from `core/align.ts`, which the sanitiser reads with too, so the file
 * this writer produces and the file that reader accepts cannot disagree.
 *
 * A heading 4–6 writes no style even when its node carries one: alignment's scope
 * is headings 1–3 (`TEXT_ALIGN_HEADING_LEVELS`), a level outside it is a heading no
 * toolbar row can name, and writing the style would put a state the toolbar cannot
 * undo into the file. The heading itself is written normally — the scope bounds the
 * attribute, not the block.
 */
function alignmentStyle(node: JSONContent): string {
  if (node.type === "heading" && !headingTakesAlignment(headingLevel(node))) return "";

  const alignment = canonicalTextAlign(node.attrs?.[TEXT_ALIGN_ATTRIBUTE]);

  return alignment === null ? "" : ` style="text-align: ${alignment}"`;
}

/**
 * An image as `<img>`: its bytes, its alt text and the width the Markdown writer
 * has to drop.
 *
 * Both attributes are escaped, so an alt with a `"` cannot end the attribute and a
 * source with an `&` stays one value. An image with no source has nothing to
 * paint; its alt text is what remains of it, which is the same answer the import
 * gives an image it cannot draw.
 */
function renderImage(node: JSONContent): string {
  const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
  const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";

  if (src === "") return escapeHtml(alt);

  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="width: ${imageWidth(node)}%">`;
}

/**
 * One cell: its first paragraph inline and any further block under it, the shape
 * `<li>` already uses. The usual cell is what the editor makes, a single
 * paragraph, so it reads as `<td>text</td>` rather than a box around a paragraph.
 */
function renderCell(cell: JSONContent): string {
  const children = cell.content ?? [];
  const first = children[0];
  const firstParagraph = first?.type === "paragraph" ? first : undefined;
  const head = firstParagraph === undefined ? "" : renderInline(firstParagraph.content);
  const rest = firstParagraph === undefined ? children : children.slice(1);
  const blocks = rest.map(renderBlock).filter((block) => block !== "");

  return `${head}${blocks.length === 0 ? "" : `\n${blocks.join("\n")}`}`;
}

/**
 * A table as a semantic `<table>` (#219): the first row in `<thead>` with `<th>`
 * cells, the rest in `<tbody>` with `<td>` cells.
 *
 * The split is by row rather than by the cell node the document carries, so a
 * first row of `tableCell`s is still the header: both writers treat the first row
 * as the header, and a reader that gets two different answers from one document
 * would be reading two documents. A table with no cells says nothing.
 */
function renderTable(node: JSONContent): string {
  const rows = (node.content ?? []).filter((child) => child.type === "tableRow");
  const [first, ...rest] = rows;

  if (first === undefined) return "";

  const renderRow = (row: JSONContent, header: boolean): string => {
    const element = header ? "th" : "td";
    const cells = (row.content ?? [])
      .filter((child) => child.type === "tableCell" || child.type === "tableHeader")
      .map((cell) => `<${element}>${renderCell(cell)}</${element}>`);

    return cells.length === 0 ? "" : `<tr>\n${cells.join("\n")}\n</tr>`;
  };

  const head = renderRow(first, true);
  if (head === "") return "";

  const body = rest.map((row) => renderRow(row, false)).filter((row) => row !== "");
  const sections = [`<thead>\n${head}\n</thead>`];
  if (body.length > 0) sections.push(`<tbody>\n${body.join("\n")}\n</tbody>`);

  return `<table>\n${sections.join("\n")}\n</table>`;
}

/** One block as HTML; `""` means it says nothing. */
function renderBlock(node: JSONContent): string {
  switch (node.type) {
    case "heading": {
      const inline = renderInline(node.content);
      if (inline === "") return "";
      const level = String(headingLevel(node));

      return `<h${level}${alignmentStyle(node)}>${inline}</h${level}>`;
    }

    case "paragraph": {
      const inline = renderInline(node.content);

      return inline === "" ? "" : `<p${alignmentStyle(node)}>${inline}</p>`;
    }

    case "image":
      return renderImage(node);

    case "table":
      return renderTable(node);

    case "blockquote": {
      const inner = (node.content ?? [])
        .map(renderBlock)
        .filter((block) => block !== "")
        .join("\n");

      return inner === "" ? "" : `<blockquote>\n${inner}\n</blockquote>`;
    }

    case "codeBlock":
      return `<pre><code${languageClass(node)}>${escapeHtml(codeText(node))}</code></pre>`;

    case "horizontalRule":
      return "<hr>";

    case "bulletList":
    case "orderedList":
    case "taskList":
      return renderList(node);

    default:
      return (node.content ?? [])
        .map(renderBlock)
        .filter((block) => block !== "")
        .join("\n");
  }
}

/**
 * The complete document: doctype, charset, title, stylesheet and the article the
 * document's blocks become.
 *
 * A document with no heading still opens with a name: `<title>无标题</title>` is
 * the same sentence the empty title block paints in the editor, so the browser
 * tab and the page agree about what this file is.
 */
export function htmlFromDocument(document: JSONContent): string {
  const title = documentTitle(document);
  const article = (document.content ?? [])
    .map(renderBlock)
    .filter((block) => block !== "")
    .join("\n");

  const lines = [
    "<!doctype html>",
    '<html lang="zh-CN">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title === "" ? "无标题" : title)}</title>`,
    "<style>",
    STYLESHEET,
    "</style>",
    "</head>",
    "<body>",
    "<article>",
  ];

  if (article !== "") lines.push(article);
  lines.push("</article>", "</body>", "</html>", "");

  return lines.join("\n");
}
