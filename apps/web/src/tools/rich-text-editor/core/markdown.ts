import type { JSONContent } from "@tiptap/react";

import { codeText, headingLevel } from "./document";

/**
 * The document as GitHub Flavored Markdown (#210).
 *
 * ProseMirror JSON is the document; Markdown is derived from it on export and is
 * never parsed back into it here (that is the import slice). The writer therefore
 * answers one question: what does this document *say* in GFM? It keeps every
 * block the editor can make (headings, paragraphs, nested lists, task items,
 * quotes, fenced code with its language, rules, images, tables) and every mark it
 * can apply, and it escapes text so a visitor's literal `*` or a paragraph that
 * starts with `1.` stays literal rather than becoming syntax.
 *
 * Underline is the one mark GFM has no form for, so it is written as inline HTML
 * (`<u>…</u>`), which GFM allows. Code is a span of its own: its content is
 * literal, so it is never escaped and its fence is grown past any backtick run
 * inside it.
 *
 * An image keeps its alt and its bytes but not its width: GFM has no width syntax,
 * so the width is dropped here and here only (#219). The document still keeps it,
 * and the HTML export carries it; `rules.md` records the degradation.
 *
 * A table is a GFM pipe table, its first row the header (the row the editor makes
 * a header row). GFM reads a row before it reads inline syntax, so a cell is
 * escaped for the row as well as for the format, and a cell holds inline content
 * only: a cell's second paragraph becomes `<br>` rather than starting a line.
 *
 * An empty document exports as an empty string rather than a lone newline: both
 * an empty file and a file of one newline are valid GFM, and `""` is the one that
 * says the document has nothing in it. Every non-empty document ends with exactly
 * one newline, which is the line a POSIX text file ends on.
 */

/** Characters that would start inline syntax wherever they stand, escaped everywhere. */
const INLINE_SYNTAX = /[\\`*_[\]<>~&]/gu;

/** Characters that would start a block at the beginning of a line, up to three spaces in. */
const LINE_START = /^( {0,3})([#>\-+=])/u;

/** An ordered-list marker at the beginning of a line: `1.` or `1)`. */
const ORDERED_MARKER = /^( {0,3})(\d{1,9})([.)])/u;

/** The three marks with a GFM pair of delimiters, innermost wrapper first. */
const DELIMITED_MARKS = [
  { close: "*", open: "*", type: "italic" },
  { close: "**", open: "**", type: "bold" },
  { close: "~~", open: "~~", type: "strike" },
] as const;

/** A mark's `type`, as it appears in ProseMirror JSON. */
type Mark = NonNullable<JSONContent["marks"]>[number];

/**
 * Escape a run of text so GFM reads it as text.
 *
 * `escapeLineStart` is applied by the caller that knows the run is at a line's
 * first column; everything else here is syntax wherever it appears.
 */
function escapeText(text: string): string {
  return text.replace(INLINE_SYNTAX, "\\$&");
}

/** Escape a block marker that would turn this text into a block at line start. */
function escapeLineStart(text: string): string {
  if (LINE_START.test(text)) return text.replace(LINE_START, "$1\\$2");

  return text.replace(ORDERED_MARKER, "$1$2\\$3");
}

/**
 * A code span whose fence is longer than any backtick run inside it; CommonMark
 * also wants one space of padding when the content would otherwise touch the
 * fence at a backtick or begin and end with spaces.
 */
function codeSpan(text: string): string {
  const runs = text.match(/`+/gu) ?? [];
  const fence = "`".repeat(Math.max(0, ...runs.map((run) => run.length)) + 1);
  const padded =
    text.startsWith("`") || text.endsWith("`") || (text.startsWith(" ") && text.endsWith(" "));

  return `${fence}${padded ? ` ${text} ` : text}${fence}`;
}

/**
 * An image as the one line GFM has for it: the alt text in the label and the
 * document's own bytes as the destination.
 *
 * The alt is escaped like any other text run, because GFM reads the label as
 * inline content: an alt with a `]` would end it early. An image without alt text
 * keeps the empty label (`![](…)`) rather than gaining a placeholder, which is
 * what "alt text or nothing" means to a screen reader. A line break in an alt is
 * folded to a space so the image cannot end its own line.
 *
 * The width is not written: GFM has no width syntax. It is the one thing this
 * writer drops, and it is recorded in `rules.md`; the document and the HTML export
 * both keep it, so no reader of this file loses the picture.
 */
function imageMarkdown(node: JSONContent): string {
  const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt.replace(/\r\n?|\n/gu, " ") : "";
  const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";

  // An image with no source has nothing to load; text is what remains of it, the
  // same answer the import gives an image it cannot draw (#220's rule).
  if (src === "") return escapeText(alt);

  return `![${escapeText(alt)}](${linkDestination(src)})`;
}

/**
 * A link destination: parentheses and backslashes are escaped, and a destination
 * with whitespace or angle brackets is wrapped in `<…>`, where only those two
 * characters need escaping.
 */
function linkDestination(href: string): string {
  if (/[\s()<>]/u.test(href)) return `<${href.replace(/[\\<>]/gu, "\\$&")}>`;

  return href.replace(/[\\()]/gu, "\\$&");
}

/** Wrap a run in the marks it carries, link outermost so `[**text**](url)` reads. */
function applyMarks(text: string, marks: readonly Mark[]): string {
  const types = new Set(marks.map((mark) => mark.type));
  let output = text;

  for (const type of ["underline", "strike", "italic", "bold"] as const) {
    if (!types.has(type)) continue;

    if (type === "underline") {
      output = `<u>${output}</u>`;
      continue;
    }

    const delimiters = DELIMITED_MARKS.find((mark) => mark.type === type);
    if (delimiters !== undefined) output = `${delimiters.open}${output}${delimiters.close}`;
  }

  if (types.has("link")) {
    const href = marks.find((mark) => mark.type === "link")?.attrs?.href;
    if (typeof href === "string" && href !== "") output = `[${output}](${linkDestination(href)})`;
  }

  return output;
}

/** One text node: its marks, and the line-start guard the first run of a line needs. */
function renderText(node: JSONContent, atLineStart: boolean): string {
  const text = node.text ?? "";
  const marks = node.marks ?? [];

  if (marks.some((mark) => mark.type === "code")) return codeSpan(text);

  const escaped = escapeText(text);
  const safe = atLineStart && marks.length === 0 ? escapeLineStart(escaped) : escaped;

  return applyMarks(safe, marks);
}

/**
 * A block's inline content.
 *
 * `atLineStart` is true for the first run of a paragraph, which is the only place
 * the writer's own output puts text at a line's first column (a heading, a list
 * item and a quote all stand behind a marker). A hard break starts a new line, so
 * it arms the guard again for the run after it.
 */
function renderInline(nodes: readonly JSONContent[] | undefined, atLineStart = false): string {
  let output = "";
  let lineStart = atLineStart;

  for (const node of nodes ?? []) {
    if (node.type === "hardBreak") {
      output += "\\\n";
      lineStart = true;
      continue;
    }

    if (node.type === "text" && typeof node.text === "string" && node.text !== "") {
      output += renderText(node, lineStart);
      lineStart = false;
      continue;
    }

    if (node.content !== undefined) {
      output += renderInline(node.content, lineStart);
      lineStart = false;
    }
  }

  return output;
}

/**
 * A fenced code block, with its language when the document carries one.
 *
 * The fence is grown past any backtick run in the body so the block cannot close
 * itself early; a body without a final newline gets one, because the closing
 * fence has to start its own line.
 */
function fencedCode(node: JSONContent): string {
  const language = typeof node.attrs?.language === "string" ? node.attrs.language.trim() : "";
  const text = codeText(node);
  const runs = text.match(/`+/gu) ?? [];
  const fence = "`".repeat(Math.max(3, ...runs.map((run) => run.length + 1)));

  return `${fence}${language}\n${text === "" || text.endsWith("\n") ? text : `${text}\n`}${fence}`;
}

/**
 * One list item: its marker, the first paragraph beside it, and everything else
 * indented to the item's content column.
 *
 * The content column is the marker's own width, so a nested list indents to where
 * the item's text starts: two spaces under `-`, three under `1.`, six under
 * `- [ ]`. That is what CommonMark asks for, and it is why the indent is computed
 * from the marker rather than fixed at two spaces.
 */
function renderListItem(item: JSONContent, marker: string, indent: number): string {
  const contentIndent = indent + marker.length + 1;
  const pad = " ".repeat(indent);
  const children = item.content ?? [];
  const first = children[0];
  const firstParagraph = first?.type === "paragraph" ? first : undefined;
  const body = firstParagraph === undefined ? [] : renderInline(firstParagraph.content).split("\n");
  const [head = "", ...continuation] = body;
  const rest = firstParagraph === undefined ? children : children.slice(1);

  const lines = [`${pad}${marker}${head === "" ? "" : ` ${head}`}`];
  for (const line of continuation) lines.push(" ".repeat(contentIndent) + line);

  let blocks = 0;
  for (const child of rest) {
    if (child.type === "bulletList" || child.type === "orderedList" || child.type === "taskList") {
      lines.push(renderList(child, contentIndent));
      blocks = 0;
      continue;
    }

    const block = renderBlock(child);
    if (block === "") continue;

    if (blocks > 0) lines.push("");
    for (const line of block.split("\n")) {
      lines.push(line === "" ? "" : " ".repeat(contentIndent) + line);
    }
    blocks += 1;
  }

  return lines.join("\n");
}

/** A bulleted, ordered or task list at one indentation. */
function renderList(node: JSONContent, indent: number): string {
  const ordered = node.type === "orderedList";
  const task = node.type === "taskList";
  const first = Number(node.attrs?.start ?? 1);
  let number = Number.isFinite(first) ? first : 1;
  const lines: string[] = [];

  for (const item of node.content ?? []) {
    if (item.type !== "listItem" && item.type !== "taskItem") continue;

    const marker = task
      ? `- [${item.attrs?.checked === true ? "x" : " "}]`
      : ordered
        ? `${number}.`
        : "-";

    lines.push(renderListItem(item, marker, indent));
    if (ordered) number += 1;
  }

  return lines.join("\n");
}

/**
 * One row of a pipe table, padded to the grid's width.
 *
 * Every row is padded to the widest row rather than left short: GFM ends a row at
 * its own pipe count, so a table whose rows disagree is not one table. A table the
 * editor makes is rectangular, so this guard is for a document from elsewhere.
 */
function pipeRow(cells: readonly string[], columns: number): string {
  const padded = Array.from({ length: columns }, (_, index) => cells[index] ?? "");

  return `| ${padded.join(" | ")} |`;
}

/**
 * A cell's text, escaped for the row before the format.
 *
 * GFM splits a row into cells before it reads inline syntax, so a `|` splits cells
 * even inside a code span; the table parser reads the `\|` back as a literal pipe.
 * Everything else is the writer's ordinary escaping, with the marks around it.
 */
function renderCellText(node: JSONContent): string {
  const text = node.text ?? "";
  const marks = node.marks ?? [];

  if (marks.some((mark) => mark.type === "code")) return codeSpan(text.replace(/\|/gu, "\\|"));

  return applyMarks(escapeText(text).replace(/\|/gu, "\\|"), marks);
}

/**
 * An image as a cell's inline text.
 *
 * The row is split into cells before the image's own syntax is read, so a `|` in
 * the alt text has to be escaped for the row too; the source is a `data:` URL and
 * cannot contain one, but escaping the whole line is the one rule that cannot miss.
 */
function cellImageMarkdown(node: JSONContent): string {
  return imageMarkdown(node).replace(/\|/gu, "\\|");
}

/**
 * A cell's inline content, with the row's own rules: no line-start guard, and a
 * hard break written as `<br>`.
 *
 * A newline inside a row would end the row rather than start a line, and `<br>` is
 * the one inline form GFM readers keep on the same row.
 */
function renderCellInline(nodes: readonly JSONContent[] | undefined): string {
  let output = "";

  for (const node of nodes ?? []) {
    if (node.type === "hardBreak") {
      output += "<br>";
      continue;
    }

    if (node.type === "image") {
      output += cellImageMarkdown(node);
      continue;
    }

    if (node.type === "text" && typeof node.text === "string" && node.text !== "") {
      output += renderCellText(node);
      continue;
    }

    if (node.content !== undefined) output += renderCellInline(node.content);
  }

  return output;
}

/** One cell block as the single line a row can hold. */
function renderCellBlock(block: JSONContent): string {
  if (block.type === "image") return cellImageMarkdown(block);
  if (block.type === "paragraph") return renderCellInline(block.content);

  // GFM cannot nest a block such as a list in a cell: the words survive, the
  // structure does not, and `<br>` is what keeps the lines apart.
  return (block.content ?? [])
    .map(renderCellBlock)
    .filter((line) => line !== "")
    .join("<br>");
}

/** One cell as its row's text: its blocks flattened, joined by `<br>`. */
function renderCell(node: JSONContent): string {
  return (node.content ?? [])
    .map(renderCellBlock)
    .filter((line) => line !== "")
    .join("<br>");
}

/**
 * A table as a GFM pipe table (#219).
 *
 * The first row is the header because that is the row the editor makes a header
 * row; GFM has room for exactly one, and the delimiter row under it is what tells
 * a reader these lines are a table. A table with no rows says nothing, the same
 * answer an empty heading gets.
 */
function renderTable(node: JSONContent): string {
  const rows = (node.content ?? [])
    .filter((child) => child.type === "tableRow")
    .map((row) =>
      (row.content ?? [])
        .filter((child) => child.type === "tableCell" || child.type === "tableHeader")
        .map(renderCell),
    );
  const columns = Math.max(0, ...rows.map((cells) => cells.length));
  const [header = [], ...body] = rows;

  if (rows.length === 0 || columns === 0) return "";

  return [
    pipeRow(header, columns),
    pipeRow(
      Array.from({ length: columns }, () => "---"),
      columns,
    ),
    ...body.map((cells) => pipeRow(cells, columns)),
  ].join("\n");
}

/** One block as GFM lines, with no trailing newline; `""` means it says nothing. */
function renderBlock(node: JSONContent): string {
  switch (node.type) {
    case "heading": {
      const inline = renderInline(node.content);
      if (inline === "") return "";

      return `${"#".repeat(headingLevel(node))} ${inline}`;
    }

    case "paragraph":
      return renderInline(node.content, true);

    case "image":
      return imageMarkdown(node);

    case "table":
      return renderTable(node);

    case "blockquote": {
      const inner = (node.content ?? [])
        .map(renderBlock)
        .filter((block) => block !== "")
        .join("\n\n");

      if (inner === "") return "";

      return inner
        .split("\n")
        .map((line) => (line === "" ? ">" : `> ${line}`))
        .join("\n");
    }

    case "codeBlock":
      return fencedCode(node);

    case "horizontalRule":
      return "---";

    case "bulletList":
    case "orderedList":
    case "taskList":
      return renderList(node, 0);

    default:
      return (node.content ?? [])
        .map(renderBlock)
        .filter((block) => block !== "")
        .join("\n\n");
  }
}

/**
 * The document as GFM: blocks separated by one blank line, and a non-empty
 * document closed by a single newline.
 */
export function markdownFromDocument(document: JSONContent): string {
  const blocks = (document.content ?? []).map(renderBlock).filter((block) => block !== "");

  return blocks.length === 0 ? "" : `${blocks.join("\n\n")}\n`;
}
