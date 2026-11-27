import type { JSONContent } from "@tiptap/react";

import { EMPTY_DOCUMENT } from "./document";

/**
 * GitHub Flavored Markdown to ProseMirror JSON (#211).
 *
 * This is the reader for the writer in `core/markdown.ts`: it accepts the GFM
 * this Tool exports and turns it back into the document the editor holds, so a
 * file written here (or anywhere else) can be continued here. It targets the
 * constructs the editor has a node or mark for (headings, paragraphs, nested
 * bulleted/ordered/task lists, quotes, fenced code with a language, rules, links,
 * emphasis, strike, inline code) and the export's one inline HTML construct,
 * underline written as `<u>…</u>`.
 *
 * It is forgiving on purpose: anything it does not recognise stays literal text,
 * and no input makes it throw. That is the opposite of a validator, and the right
 * shape for an import: a table or a reference-style link arrives as the words
 * that were there rather than as a refusal.
 *
 * The return value is plain JSON, with no DOM in sight: the editor hands it to
 * TipTap's own `setContent`, so the final document and its schema are TipTap's.
 * The Markdown path therefore never needs a browser; the HTML path cannot say
 * that (its parser is TipTap's), which is why `core/html-import.ts` returns
 * sanitised markup instead.
 */

/** A mark as ProseMirror JSON carries it. */
type Mark = NonNullable<JSONContent["marks"]>[number];

/** The placeholder for a hard break while a paragraph is still one string. */
const HARD_BREAK = "\u0000";

/** The characters a backslash may escape in Markdown. */
const ESCAPABLE = /^[\\`*_[\]{}()#+\-.!>~|]$/u;

/** An opening code fence: up to three spaces, at least three backticks or tildes, an info string. */
const FENCE = /^( {0,3})(`{3,}|~{3,})[ \t]*([^`]*)$/u;

/** An ATX heading, with the optional closing hash run left in the text. */
const HEADING = /^( {0,3})(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/u;

/** A thematic break: three or more of one marker, spaces allowed between. */
const RULE = /^( {0,3})(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/u;

/** A blockquote line, with one optional space after the marker removed. */
const QUOTE = /^( {0,3})>[ \t]?(.*)$/u;

/** A bulleted list item. */
const BULLET = /^([ \t]*)([-+*])([ \t]+|$)(.*)$/u;

/** An ordered list item, keeping its number and its `.` or `)`. */
const ORDERED = /^([ \t]*)(\d{1,9})([.)])([ \t]+|$)(.*)$/u;

/** The GFM task marker at the start of a list item's content. */
const TASK = /^\[([ xX])\](?:[ \t]+|$)(.*)$/u;

/** One list item's marker, read from the line it starts. */
interface Marker {
  readonly indent: number;
  readonly ordered: boolean;
  readonly start: number;
  readonly bullet: string;
  readonly content: string;
  readonly task: boolean;
  readonly checked: boolean;
  /** The column the item's own content starts at, for dedenting its continuation lines. */
  readonly contentIndent: number;
}

/** One list item while its lines are still being collected. */
interface ItemDraft {
  readonly lines: string[];
  readonly task: boolean;
  readonly checked: boolean;
  readonly contentIndent: number;
}

/** An emphasis delimiter and the marks it turns on. */
interface EmphasisRule {
  readonly delimiter: string;
  readonly marks: readonly Mark[];
}

/**
 * Delimiters longest first, so `**` is never read as two `*`s. `_` and `*` share
 * the italic mark; `~~` is GFM's strike; `***` is both.
 */
const EMPHASIS: readonly EmphasisRule[] = [
  { delimiter: "***", marks: [{ type: "bold" }, { type: "italic" }] },
  { delimiter: "___", marks: [{ type: "bold" }, { type: "italic" }] },
  { delimiter: "**", marks: [{ type: "bold" }] },
  { delimiter: "__", marks: [{ type: "bold" }] },
  { delimiter: "~~", marks: [{ type: "strike" }] },
  { delimiter: "*", marks: [{ type: "italic" }] },
  { delimiter: "_", marks: [{ type: "italic" }] },
];

/**
 * The document a Markdown file describes.
 *
 * An empty (or whitespace-only) file is the empty document rather than a `doc`
 * with no blocks: the editor's starting document is the definition of "nothing",
 * and importing a blank file should leave the same two placeholders a fresh page
 * shows. Every other file is its parsed blocks, in order.
 */
export function documentFromMarkdown(source: string): JSONContent {
  const lines = source
    .replace(/^\uFEFF/u, "")
    .replace(/\r\n?/gu, "\n")
    .split("\n");
  const content = parseBlocks(lines);

  return content.length === 0 ? EMPTY_DOCUMENT : { content, type: "doc" };
}

/** The number of columns a run of leading whitespace occupies, with four-column tabs. */
function columnsOf(whitespace: string): number {
  let column = 0;

  for (const character of whitespace) {
    column = character === "\t" ? column + 4 - (column % 4) : column + 1;
  }

  return column;
}

/** The count of columns a line starts at. */
function leadingColumns(line: string): number {
  return columnsOf(/^[ \t]*/u.exec(line)?.[0] ?? "");
}

/** A line with at most `count` columns of its leading whitespace removed. */
function stripColumns(line: string, count: number): string {
  let column = 0;
  let index = 0;

  while (index < line.length && column < count) {
    const character = line[index];
    if (character === " ") {
      column += 1;
      index += 1;
      continue;
    }
    if (character === "\t") {
      column += 4 - (column % 4);
      index += 1;
      continue;
    }
    break;
  }

  return line.slice(index);
}

function isBlank(line: string): boolean {
  return /^[ \t]*$/u.test(line);
}

/** The first non-blank line at or after `from`, or `-1`. */
function nextNonBlank(lines: readonly string[], from: number): number {
  for (let index = from; index < lines.length; index += 1) {
    if (!isBlank(lines[index] ?? "")) return index;
  }

  return -1;
}

/**
 * A list marker at the start of a line, with its content and task state.
 *
 * The content column is computed from the marker's own width and the whitespace
 * that follows it, because a nested list indents to where the item's text starts:
 * two under `-`, three under `1.`, six under `- [ ]`. That is what CommonMark
 * asks for, and it is the rule the writer in `markdown.ts` uses too.
 */
function markerOf(line: string): Marker | null {
  const bullet = BULLET.exec(line);
  if (bullet !== null) {
    const indent = columnsOf(bullet[1] ?? "");
    const spacing = columnsOf(bullet[3] ?? "");
    const markerIndent = indent + 1 + Math.max(1, spacing);
    let content = bullet[4] ?? "";
    let task = false;
    let checked = false;
    const taskMatch = TASK.exec(content);

    if (taskMatch !== null) {
      task = true;
      checked = (taskMatch[1] ?? " ").toLowerCase() === "x";
      content = taskMatch[2] ?? "";
    }

    return {
      bullet: bullet[2] ?? "-",
      checked,
      content,
      // A task item's content starts after `- [x] ` as well, which is the column
      // the writer indents a nested list to (`markdown.ts` computes the same six).
      contentIndent: task ? markerIndent + 4 : markerIndent,
      indent,
      ordered: false,
      start: 1,
      task,
    };
  }

  const ordered = ORDERED.exec(line);
  if (ordered !== null) {
    const digits = ordered[2] ?? "";
    const indent = columnsOf(ordered[1] ?? "");
    const spacing = columnsOf(ordered[4] ?? "");

    return {
      bullet: ordered[3] ?? ".",
      checked: false,
      content: ordered[5] ?? "",
      contentIndent: indent + digits.length + 1 + Math.max(1, spacing),
      indent,
      ordered: true,
      start: Number(digits),
      task: false,
    };
  }

  return null;
}

/** Whether a line begins a block the paragraph reader must stop at. */
function startsBlock(line: string): boolean {
  if (FENCE.test(line) || RULE.test(line) || HEADING.test(line) || QUOTE.test(line)) return true;

  const marker = markerOf(line);

  return marker !== null && marker.indent <= 3;
}

/**
 * A sequence of blocks.
 *
 * The order of the tests is the order the constructs can be mistaken for one
 * another: a fence before a heading (a fence's info string may hold `#`), a rule
 * before a list (`- - -` is a break, not an item), a quote before a list (a
 * nested quote starts with `>`), and every one of them before a paragraph.
 */
function parseBlocks(lines: readonly string[]): JSONContent[] {
  const blocks: JSONContent[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (isBlank(line)) {
      index += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence !== null) {
      const result = parseFence(lines, index, fence);
      blocks.push(result.node);
      index = result.next;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ type: "horizontalRule" });
      index += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading !== null) {
      blocks.push(headingNode(heading));
      index += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const result = parseQuote(lines, index);
      blocks.push(result.node);
      index = result.next;
      continue;
    }

    const marker = markerOf(line);
    if (marker !== null && marker.indent <= 3) {
      const result = parseList(lines, index, marker);
      blocks.push(result.node);
      index = result.next;
      continue;
    }

    const result = parseParagraph(lines, index);
    blocks.push(result.node);
    index = result.next;
  }

  return blocks;
}

/**
 * A fenced code block.
 *
 * The fence's own indentation is taken off its content, as CommonMark asks, and
 * the info string's first word is the language. The body is the text between the
 * fences with no trailing newline: a ProseMirror code block's text is the lines
 * themselves, and the writer adds the closing line's newline back on export.
 */
function parseFence(
  lines: readonly string[],
  start: number,
  opening: RegExpExecArray,
): { node: JSONContent; next: number } {
  const indent = (opening[1] ?? "").length;
  const fence = opening[2] ?? "```";
  const character = fence[0] ?? "`";
  const language = (opening[3] ?? "").trim().split(/[ \t]+/u)[0] ?? "";
  const closing = new RegExp(`^ {0,3}${character}{${fence.length},}[ \\t]*$`, "u");
  const body: string[] = [];
  let index = start + 1;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (closing.test(line)) {
      index += 1;
      break;
    }
    body.push(stripColumns(line, indent));
    index += 1;
  }

  const text = body.join("\n");
  const node: JSONContent = { type: "codeBlock" };

  if (language !== "") node.attrs = { language };
  if (text !== "") node.content = [{ text, type: "text" }];

  return { node, next: index };
}

/** One ATX heading; the trailing hash run is decoration, not content. */
function headingNode(match: RegExpExecArray): JSONContent {
  const level = (match[2] ?? "#").length;
  const text = (match[3] ?? "").replace(/[ \t]+#+[ \t]*$/u, "");
  const content = parseInline(text);

  return {
    attrs: { level },
    ...(content.length === 0 ? {} : { content }),
    type: "heading",
  };
}

/**
 * A blockquote: the consecutive quoted lines, with their markers taken off,
 * parsed as the blocks they describe. A blank line between two quoted lines stays
 * inside the quote, which is how a quoted document with paragraphs survives.
 */
function parseQuote(lines: readonly string[], start: number): { node: JSONContent; next: number } {
  const inner: string[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const quoted = QUOTE.exec(line);

    if (quoted !== null) {
      inner.push(quoted[2] ?? "");
      index += 1;
      continue;
    }

    if (isBlank(line)) {
      const next = nextNonBlank(lines, index + 1);

      if (next !== -1 && QUOTE.test(lines[next] ?? "")) {
        inner.push("");
        index += 1;
        continue;
      }
    }

    break;
  }

  const content = parseBlocks(inner);

  return {
    node: {
      content: content.length === 0 ? [{ type: "paragraph" }] : content,
      type: "blockquote",
    },
    next: index,
  };
}

/**
 * One list, at one indentation.
 *
 * Items at the marker's own indentation are siblings. A line indented further
 * belongs to the item above it, dedented to the item's content column, and is
 * parsed recursively: that is what makes a nested list a nested list instead of a
 * flattened run of items. A blank line continues the list only when the next
 * non-blank line is still indented into it.
 *
 * A list becomes a task list when any of its items carries a `[ ]` / `[x]`
 * marker. The editor cannot mix `listItem` and `taskItem` in one list, so the
 * other items in that list become unchecked task items; GFM writers rarely mix
 * them, and a mixed one still reads as the document it describes.
 */
function parseList(
  lines: readonly string[],
  start: number,
  first: Marker,
): { node: JSONContent; next: number } {
  const base = first.indent;
  const ordered = first.ordered;
  const bullet = first.bullet;
  const items: ItemDraft[] = [];
  let current: ItemDraft | null = null;
  let index = start;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (isBlank(line)) {
      const next = nextNonBlank(lines, index + 1);
      if (next === -1) {
        index += 1;
        continue;
      }

      const following = lines[next] ?? "";
      const marker = markerOf(following);

      if (marker !== null && marker.indent >= base) {
        current?.lines.push("");
        index += 1;
        continue;
      }
      if (marker === null && leadingColumns(following) > base) {
        current?.lines.push("");
        index += 1;
        continue;
      }

      break;
    }

    const marker = markerOf(line);

    if (marker !== null && marker.indent === base) {
      if (marker.ordered !== ordered) break;
      if (!ordered && marker.bullet !== bullet) break;

      current = {
        checked: marker.checked,
        contentIndent: marker.contentIndent,
        lines: [marker.content],
        task: marker.task,
      };
      items.push(current);
      index += 1;
      continue;
    }

    if (marker !== null && marker.indent > base) {
      if (current === null) break;
      current.lines.push(stripColumns(line, current.contentIndent));
      index += 1;
      continue;
    }

    if (marker === null && leadingColumns(line) > base) {
      if (current === null) break;
      current.lines.push(stripColumns(line, current.contentIndent));
      index += 1;
      continue;
    }

    break;
  }

  const task = items.some((item) => item.task);
  const content = items.map((item) => listItemNode(item, task));

  if (task) return { node: { content, type: "taskList" }, next: index };

  if (ordered) {
    return {
      node: { attrs: { start: first.start }, content, type: "orderedList" },
      next: index,
    };
  }

  return { node: { content, type: "bulletList" }, next: index };
}

/** One item's blocks, always starting with the paragraph its schema requires. */
function listItemNode(item: ItemDraft, task: boolean): JSONContent {
  const blocks = parseBlocks(item.lines);

  if (blocks.length === 0) blocks.push({ type: "paragraph" });
  if (blocks[0]?.type !== "paragraph") blocks.unshift({ type: "paragraph" });

  return task
    ? { attrs: { checked: item.checked }, content: blocks, type: "taskItem" }
    : { content: blocks, type: "listItem" };
}

/**
 * A paragraph: consecutive plain lines, joined as one run of inline content.
 *
 * A line ending in two spaces or a backslash is a hard break; every other line
 * break is a space, because a soft break in Markdown renders as one. The sentence
 * itself is then read by `parseInline`.
 */
function parseParagraph(
  lines: readonly string[],
  start: number,
): { node: JSONContent; next: number } {
  const collected: string[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (isBlank(line) || startsBlock(line)) break;
    collected.push(line);
    index += 1;
  }

  let source = collected
    .map((line, position) => {
      const hard = /(?: {2,}|\\)$/u.test(line);
      const text = (hard ? line.replace(/(?: {2,}|\\)$/u, "") : line).replace(/^[ \t]+/u, "");

      if (hard) return `${text}${HARD_BREAK}`;

      return position < collected.length - 1 ? `${text} ` : text;
    })
    .join("");

  // A hard break with no line after it is not a break.
  while (source.endsWith(HARD_BREAK)) source = source.slice(0, -1);

  const content = parseInline(source);

  return {
    node: { ...(content.length === 0 ? {} : { content }), type: "paragraph" },
    next: index,
  };
}

/** A text node carrying the marks it was read under. */
function textNode(text: string, marks: readonly Mark[]): JSONContent {
  return marks.length === 0 ? { text, type: "text" } : { marks: [...marks], text, type: "text" };
}

/** Two marks are the same when their type and their link destination are. */
function sameMark(left: Mark, right: Mark): boolean {
  return left.type === right.type && (left.attrs?.href ?? "") === (right.attrs?.href ?? "");
}

/** The marks of a list, with the extras added once each. */
function addMarks(marks: readonly Mark[], extra: readonly Mark[]): Mark[] {
  const result = [...marks];

  for (const mark of extra) {
    if (!result.some((existing) => sameMark(existing, mark))) result.push(mark);
  }

  return result;
}

/** The nodes with a mark added to each text node that does not carry it. */
function applyMark(nodes: readonly JSONContent[], mark: Mark): JSONContent[] {
  return nodes.map((node) => {
    if (node.type !== "text") return node;

    const marks = node.marks ?? [];
    if (marks.some((existing) => sameMark(existing, mark))) return node;

    return { ...node, marks: [...marks, mark] };
  });
}

/** Adjacent text with identical marks, as one node. */
function mergeTextNodes(nodes: readonly JSONContent[]): JSONContent[] {
  const merged: JSONContent[] = [];

  for (const node of nodes) {
    const previous = merged[merged.length - 1];
    const marks = node.marks ?? [];

    if (
      node.type === "text" &&
      previous?.type === "text" &&
      marks.length === (previous.marks ?? []).length &&
      marks.every((mark, index) => sameMark(mark, (previous.marks ?? [])[index] ?? { type: "" }))
    ) {
      merged[merged.length - 1] = {
        ...previous,
        text: `${previous.text ?? ""}${node.text ?? ""}`,
      };
      continue;
    }

    merged.push(node);
  }

  return merged;
}

/** One hunk of inline content and where in the source it ends. */
interface InlineResult {
  readonly nodes: JSONContent[];
  readonly next: number;
}

/**
 * Inline Markdown: escapes, code spans, underline, autolinks, links and emphasis.
 *
 * The reader walks the string once and falls back to literal text at every
 * construct it cannot close. It is recursive where Markdown is: a link's label
 * and an emphasis's body are parsed by the same function, so `**bold with
 * *italic* inside**` reads the way it looks.
 */
function parseInline(source: string, marks: readonly Mark[] = []): JSONContent[] {
  const nodes: JSONContent[] = [];
  let buffer = "";

  const flush = () => {
    if (buffer === "") return;
    nodes.push(textNode(buffer, marks));
    buffer = "";
  };

  let index = 0;

  while (index < source.length) {
    const character = source[index] ?? "";

    if (character === HARD_BREAK) {
      flush();
      nodes.push({ type: "hardBreak" });
      index += 1;
      continue;
    }

    if (character === "\n" || character === "\r") {
      buffer += " ";
      index += 1;
      continue;
    }

    if (character === "\\") {
      const next = source[index + 1];

      if (next !== undefined && ESCAPABLE.test(next)) {
        buffer += next;
        index += 2;
        continue;
      }

      buffer += character;
      index += 1;
      continue;
    }

    if (character === "`") {
      const run = source.slice(index).match(/^`+/u)?.[0] ?? "`";
      const close = findRun(source, index + run.length, "`", run.length);

      if (close !== -1) {
        flush();
        nodes.push(
          textNode(
            codeText(source.slice(index + run.length, close)),
            addMarks(marks, [{ type: "code" }]),
          ),
        );
        index = close + run.length;
        continue;
      }

      buffer += run;
      index += run.length;
      continue;
    }

    if (character === "<") {
      const result = inlineAngle(source, index, marks);

      if (result !== null) {
        flush();
        nodes.push(...result.nodes);
        index = result.next;
        continue;
      }

      buffer += character;
      index += 1;
      continue;
    }

    if (character === "[") {
      const result = inlineLink(source, index, marks);

      if (result !== null) {
        flush();
        nodes.push(...result.nodes);
        index = result.next;
        continue;
      }

      buffer += character;
      index += 1;
      continue;
    }

    if (character === "!" && source[index + 1] === "[") {
      buffer += character;
      index += 1;
      continue;
    }

    if (character === "*" || character === "_" || character === "~") {
      const result = inlineEmphasis(source, index, marks);

      if (result !== null) {
        flush();
        nodes.push(...result.nodes);
        index = result.next;
        continue;
      }

      buffer += character;
      index += 1;
      continue;
    }

    buffer += character;
    index += 1;
  }

  flush();

  return mergeTextNodes(nodes);
}

/**
 * A code span's text, with CommonMark's one-space padding rule and a line break
 * inside the span read as a space.
 */
function codeText(raw: string): string {
  let text = raw.replace(/\r?\n/gu, " ");

  if (text.length > 2 && text.startsWith(" ") && text.endsWith(" ") && /[^ ]/u.test(text)) {
    text = text.slice(1, -1);
  }

  return text;
}

/** The next run of exactly `length` copies of `character`, or `-1`. */
function findRun(source: string, from: number, character: string, length: number): number {
  let index = from;

  while (index < source.length) {
    if (source[index] !== character) {
      index += 1;
      continue;
    }

    let run = 1;
    while (source[index + run] === character) run += 1;

    if (run === length) return index;
    index += run;
  }

  return -1;
}

/**
 * An angle construct: the export's inline `<u>…</u>` underline, or a GFM
 * autolink. Anything else is literal `<`, which is what makes a pasted tag in a
 * Markdown file stay text.
 */
function inlineAngle(source: string, index: number, marks: readonly Mark[]): InlineResult | null {
  const rest = source.slice(index);
  const underline = /^<u>/iu.exec(rest);

  if (underline !== null) {
    const close = rest.toLowerCase().indexOf("</u>");

    if (close !== -1) {
      const inner = rest.slice(underline[0].length, close);

      return {
        nodes: parseInline(inner, addMarks(marks, [{ type: "underline" }])),
        next: index + close + "</u>".length,
      };
    }
  }

  const autolink = /^<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s<>]*)>/u.exec(rest);

  if (autolink !== null) {
    const target = autolink[1] ?? "";

    return {
      nodes: [textNode(target, addMarks(marks, [{ attrs: { href: target }, type: "link" }]))],
      next: index + autolink[0].length,
    };
  }

  return null;
}

/**
 * The index of the bracket that closes the one opened at `from - 1`, or `-1`.
 *
 * A link label and a link destination are the same scan with a different pair of
 * brackets: nested pairs count, and a backslash escapes the character after it so
 * an escaped bracket cannot close. One helper rather than two identical walks, so a
 * fix to the escaping rule reaches both halves of a link.
 */
function findPairEnd(source: string, from: number, open: string, close: string): number {
  let depth = 1;
  let index = from;

  while (index < source.length) {
    const character = source[index];

    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === open) depth += 1;
    else if (character === close) {
      depth -= 1;
      if (depth === 0) return index;
    }

    index += 1;
  }

  return -1;
}

/** A link destination, with an optional title dropped and escapes undone. */
function parseDestination(raw: string): string | null {
  const text = raw.trim();
  if (text === "") return null;
  if (text.startsWith("<")) {
    const end = text.indexOf(">");
    if (end === -1) return null;

    const destination = text.slice(1, end).replace(/\\([\\`*_[\]()<>])/gu, "$1");

    return destination === "" ? null : destination;
  }

  const [first = ""] = text.split(/[ \t]+/u);
  const destination = first.replace(/\\([\\`*_[\]()<>])/gu, "$1");

  return destination === "" ? null : destination;
}

/** A link, when the label is followed by a destination; literal `[` otherwise. */
function inlineLink(source: string, index: number, marks: readonly Mark[]): InlineResult | null {
  const labelEnd = findPairEnd(source, index + 1, "[", "]");

  if (labelEnd === -1 || source[labelEnd + 1] !== "(") return null;

  const end = findPairEnd(source, labelEnd + 2, "(", ")");

  if (end === -1) return null;

  const destination = parseDestination(source.slice(labelEnd + 2, end));

  if (destination === null) return null;

  const label = parseInline(source.slice(index + 1, labelEnd), marks);
  const text = label.length === 0 ? [textNode(destination, marks)] : label;

  return {
    nodes: applyMark(text, { attrs: { href: destination }, type: "link" }),
    next: end + 1,
  };
}

/** Whether a character can be part of a word, for the `_` intraword rule. */
function isWordCharacter(character: string | undefined): boolean {
  return /^[A-Za-z0-9_]$/u.test(character ?? "");
}

/** One emphasis construct at `index`, or `null` when it does not close. */
function inlineEmphasis(
  source: string,
  index: number,
  marks: readonly Mark[],
): InlineResult | null {
  const character = source[index] ?? "";

  for (const rule of EMPHASIS) {
    if (rule.delimiter[0] !== character) continue;
    if (!source.startsWith(rule.delimiter, index)) continue;

    const after = source[index + rule.delimiter.length];

    if (after === undefined || /\s/u.test(after)) continue;
    if (character === "_" && isWordCharacter(source[index - 1])) continue;

    const close = findClosing(source, index + rule.delimiter.length, rule.delimiter);

    if (close === -1) continue;

    const inner = source.slice(index + rule.delimiter.length, close);

    if (inner === "") continue;

    const parsed = parseInline(inner, marks);

    if (parsed.length === 0) continue;

    return {
      nodes: rule.marks.reduce((current, mark) => applyMark(current, mark), parsed),
      next: close + rule.delimiter.length,
    };
  }

  return null;
}

/**
 * The closing delimiter's position.
 *
 * A run longer than the delimiter lends its last characters to the close, which
 * is what lets `**bold *italic***` read as bold around italic: the inner `*` is
 * left inside the bold span and closes the italic one. A delimiter may not close
 * on whitespace, and `_` may not close mid-word.
 */
function findClosing(source: string, from: number, delimiter: string): number {
  const character = delimiter[0] ?? "";
  let index = from;

  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }

    // A code span's content is literal, so a delimiter inside one cannot close an
    // emphasis that started outside it: `**`code**`**` is bold around a code span.
    if (source[index] === "`") {
      let run = 1;
      while (source[index + run] === "`") run += 1;

      const close = findRun(source, index + run, "`", run);

      index = close === -1 ? index + run : close + run;
      continue;
    }

    if (source[index] !== character) {
      index += 1;
      continue;
    }

    let run = 1;
    while (source[index + run] === character) run += 1;

    if (run < delimiter.length) {
      index += run;
      continue;
    }

    const start = index + run - delimiter.length;
    const before = source[start - 1] ?? "";
    const after = source[start + delimiter.length] ?? "";

    if (start <= from || before === "" || /\s/u.test(before)) {
      index += run;
      continue;
    }

    if (character === "_" && isWordCharacter(after)) {
      index += run;
      continue;
    }

    return start;
  }

  return -1;
}
