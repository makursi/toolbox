import type { JSONContent } from "@tiptap/react";

/**
 * The document as GitHub Flavored Markdown (#210).
 *
 * ProseMirror JSON is the document; Markdown is derived from it on export and is
 * never parsed back into it here (that is the import slice). The writer therefore
 * answers one question: what does this document *say* in GFM? It keeps every
 * block the editor can make (headings, paragraphs, nested lists, task items,
 * quotes, fenced code with its language, rules) and every mark it can apply, and
 * it escapes text so a visitor's literal `*` or a paragraph that starts with
 * `1.` stays literal rather than becoming syntax.
 *
 * Underline is the one mark GFM has no form for, so it is written as inline HTML
 * (`<u>…</u>`), which GFM allows. Code is a span of its own: its content is
 * literal, so it is never escaped and its fence is grown past any backtick run
 * inside it.
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

/** The literal text inside a code block, hard breaks included. */
function codeText(node: JSONContent): string {
  return (node.content ?? [])
    .map((child) => (typeof child.text === "string" ? child.text : codeText(child)))
    .join("")
    .replace(/\r\n?/gu, "\n");
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

/** The heading level a document may carry, clamped to the six GFM has. */
function headingLevel(node: JSONContent): number {
  const level = Number(node.attrs?.level ?? 1);

  return Number.isInteger(level) && level >= 1 && level <= 6 ? level : 1;
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
