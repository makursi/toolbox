import type { JSONContent } from "@tiptap/react";

import {
  dataUrlImageProbe,
  importAdmission,
  type ImageRefusal,
  type ImportAdmission,
} from "./admission";
import { EMPTY_DOCUMENT } from "./document";
import { imageAltText } from "./image";

/**
 * GitHub Flavored Markdown to ProseMirror JSON (#211, tables and images #220).
 *
 * This is the reader for the writer in `core/markdown.ts`: it accepts the GFM
 * this Tool exports and turns it back into the document the editor holds, so a
 * file written here (or anywhere else) can be continued here. It targets the
 * constructs the editor has a node or mark for (headings, paragraphs, nested
 * bulleted/ordered/task lists, quotes, fenced code with a language, rules, links,
 * emphasis, strike, inline code, pipe tables and images) and the export's two
 * inline HTML constructs, underline written as `<u>…</u>` and highlight written as
 * `<mark>…</mark>` (#230). Block alignment has no GFM form, so a file cannot carry
 * it: the reader has nothing to read, which is the writer's degradation seen from
 * the other side.
 *
 * It is forgiving on purpose: anything it does not recognise stays literal text,
 * and no input makes it throw. That is the opposite of a validator, and the right
 * shape for an import: a reference-style link arrives as the words that were there
 * rather than as a refusal.
 *
 * Two shapes of this document are not GFM's. An image is a block node, so a data
 * image becomes a block of its own and the words around it keep their paragraphs;
 * and a table's first row is its header row, so the reader makes that row's cells
 * `tableHeader` and the rest `tableCell`. Both are what the writer reads back into.
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

/** One delimiter-row cell: dashes with an optional alignment colon on either side. */
const DELIMITER_CELL = /^:?-+:?$/u;

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
 * What a Markdown file imports as: the document, and the images it could not keep.
 *
 * The two travel together because the import has something to say about a refused
 * image — the same sentence an inserted file is refused with (`core/copy.ts`) — and
 * the document alone cannot carry it. `documentFromMarkdown` is the same read for a
 * caller with nothing to say.
 */
export interface MarkdownImport {
  readonly document: JSONContent;
  readonly refusals: readonly ImageRefusal[];
}

/**
 * The document a Markdown file describes.
 *
 * An empty (or whitespace-only) file is the empty document rather than a `doc`
 * with no blocks: the editor's starting document is the definition of "nothing",
 * and importing a blank file should leave the same two placeholders a fresh page
 * shows. Every other file is its parsed blocks, in order.
 *
 * The images are then put through the same admission an inserted file meets
 * (#220): an import is a whole document, so the count and the total start empty,
 * and an image that breaks a rule becomes its alt text — the same answer a remote
 * source gets — rather than a picture the document could not have held.
 */
export function importMarkdown(source: string): MarkdownImport {
  const lines = source
    .replace(/^\uFEFF/u, "")
    .replace(/\r\n?/gu, "\n")
    .split("\n");
  const admission = importAdmission();
  const blocks = admitImages(parseBlocks(lines), admission);

  return {
    document: blocks.length === 0 ? EMPTY_DOCUMENT : { content: blocks, type: "doc" },
    refusals: admission.refusals,
  };
}

/** The document alone, for a caller that has no use for the refusal sentences. */
export function documentFromMarkdown(source: string): JSONContent {
  return importMarkdown(source).document;
}

/**
 * The parsed blocks with only the images a document may hold, and the rules the
 * others broke.
 *
 * A refused image becomes a paragraph of its alt text, and an image with no alt
 * text leaves nothing rather than an empty block: "the picture is not in this
 * document" and "the words about it are" are the two halves of one answer, and it
 * is the same answer for a source this Tool cannot draw at all (a remote URL never
 * becomes an image node in the first place). A table cell that held only a refused
 * image keeps the one block its schema requires.
 */
function admitImages(nodes: readonly JSONContent[], admission: ImportAdmission): JSONContent[] {
  return nodes.flatMap((node) => {
    if (node.type === "image") {
      const verdict = admission.admit(node.attrs?.src);

      if (verdict?.kind === "admitted") return [node];

      const alt = imageAltText(node.attrs?.alt);

      return alt === null ? [] : [{ content: [{ text: alt, type: "text" }], type: "paragraph" }];
    }

    const content = node.content;
    if (content === undefined) return [node];

    const admitted = admitImages(content, admission);

    if (admitted.length === 0 && (node.type === "tableCell" || node.type === "tableHeader")) {
      return [{ ...node, content: [{ type: "paragraph" }] }];
    }

    return [{ ...node, content: admitted }];
  });
}

/** Whether a row's last pipe is its own edge rather than a literal an escape made. */
function endsWithRowPipe(line: string): boolean {
  const trimmed = line.trimEnd();
  if (!trimmed.endsWith("|")) return false;

  let backslashes = 0;
  let index = trimmed.length - 2;

  while (index >= 0 && trimmed[index] === "\\") {
    backslashes += 1;
    index -= 1;
  }

  // An odd run of backslashes escapes the pipe, so a row that ends in `\|` has a
  // last cell rather than an edge to drop.
  return backslashes % 2 === 0;
}

/** One cell's text, unescaped: a GFM cell holds inline content, so it goes to `parseInline`. */
function cellsOfRow(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let index = 0;

  while (index < line.length) {
    const character = line[index] ?? "";

    // A backslash takes the next character with it, so `\|` is a literal pipe and
    // `\\` is a literal backslash that does not escape the pipe after it. The pair
    // is kept whole here and undone by `parseInline`, which already knows both.
    if (character === "\\") {
      cell += character;
      index += 1;
      if (index < line.length) {
        cell += line[index] ?? "";
        index += 1;
      }
      continue;
    }

    if (character === "|") {
      cells.push(cell);
      cell = "";
      index += 1;
      continue;
    }

    cell += character;
    index += 1;
  }

  cells.push(cell);

  // The pipes at the two ends of a row are decoration rather than a leading and a
  // trailing empty cell; a row without them has neither to drop.
  if (line.trimStart().startsWith("|")) cells.shift();
  if (cells.length > 0 && endsWithRowPipe(line)) cells.pop();

  return cells.map((text) => text.trim());
}

/**
 * A table's first two lines, when they are one: the header row and the delimiter
 * row under it, with the column count the header had.
 *
 * The delimiter row is what makes the lines a table — GFM has no table without it —
 * and it has to have the header's own cell count, because a count that disagrees is
 * a pipe used for something else rather than a table. Alignment colons are read and
 * dropped: the document has no column alignment to put them in, and inventing one
 * here would be a second document model.
 */
function tableStart(lines: readonly string[], index: number): number | null {
  const header = lines[index];
  const delimiter = lines[index + 1];

  if (header === undefined || delimiter === undefined) return null;
  if (!header.includes("|") || !delimiter.includes("|")) return null;

  const cells = cellsOfRow(header);
  const rule = cellsOfRow(delimiter);

  if (cells.length === 0 || rule.length !== cells.length) return null;
  if (!rule.every((cell) => DELIMITER_CELL.test(cell))) return null;

  return cells.length;
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
 * nested quote starts with `>`), a list before a table (a header row never looks
 * like an item, but a cell may hold a marker's characters), and every one of them
 * before a paragraph.
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

    const columns = tableStart(lines, index);
    if (columns !== null) {
      const result = parseTable(lines, index, columns);
      blocks.push(result.node);
      index = result.next;
      continue;
    }

    const result = parseParagraph(lines, index);
    blocks.push(...result.nodes);
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
  // A heading holds inline content only, and an image is a block node: an image
  // written in a heading stays the words of its alt text rather than an image the
  // schema would refuse.
  const content = mergeTextNodes(flattenImages(parseInline(text)));

  return {
    attrs: { level },
    ...(content.length === 0 ? {} : { content }),
    type: "heading",
  };
}

/** The inline nodes with each image replaced by its alt text. */
function flattenImages(nodes: readonly JSONContent[]): JSONContent[] {
  return nodes.flatMap((node) => {
    if (node.type !== "image") return [node];

    const alt = imageAltText(node.attrs?.alt);

    return alt === null ? [] : [{ text: alt, type: "text" }];
  });
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

/** One row of a table, padded or cut to the header's own width. */
function rowCells(line: string, columns: number): string[] {
  const cells = cellsOfRow(line);

  return Array.from({ length: columns }, (_, column) => cells[column] ?? "");
}

/** A cell's inline content as the blocks a table cell holds. */
function cellBlocks(text: string): JSONContent[] {
  const blocks = blocksOfInline(parseInline(text));

  return blocks.length === 0 ? [{ type: "paragraph" }] : blocks;
}

/**
 * A GFM pipe table (#220): the header row, the delimiter row dropped, the body rows.
 *
 * The first row's cells are `tableHeader` because the writer treats the first row
 * as the header in both formats, and a reader that gave a different answer would be
 * reading a different document. A body row is a following non-blank line that has
 * not started another block and still has a pipe in it: GFM itself reads a pipe-less
 * line as a one-cell row, but that turns an ordinary paragraph after a table into
 * part of it, and a paragraph is the reading a person expects. Every row is padded
 * or cut to the header's width, which is what GFM asks a reader to do with one.
 */
function parseTable(
  lines: readonly string[],
  start: number,
  columns: number,
): { node: JSONContent; next: number } {
  const rows: string[][] = [rowCells(lines[start] ?? "", columns)];
  let index = start + 2;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (isBlank(line) || startsBlock(line) || !line.includes("|")) break;

    rows.push(rowCells(line, columns));
    index += 1;
  }

  return {
    node: {
      content: rows.map((cells, row) => ({
        content: cells.map((text) => ({
          content: cellBlocks(text),
          type: row === 0 ? "tableHeader" : "tableCell",
        })),
        type: "tableRow",
      })),
      type: "table",
    },
    next: index,
  };
}

/**
 * Inline content as the blocks the document can hold.
 *
 * An image is a block node in this editor (#216) while GFM writes it inline, so a
 * run of inline content is split around it: the words keep their own paragraphs
 * and each image becomes a block of its own, in the order they were written. A
 * table cell uses the same split, because a cell holds blocks too and the writer
 * flattens them back onto one line.
 */
function blocksOfInline(nodes: readonly JSONContent[]): JSONContent[] {
  const blocks: JSONContent[] = [];
  let run: JSONContent[] = [];

  const flush = () => {
    const content = trimRun(run);

    if (content.length > 0) blocks.push({ content, type: "paragraph" });
    run = [];
  };

  for (const node of nodes) {
    if (node.type === "image") {
      flush();
      blocks.push(node);
      continue;
    }

    run.push(node);
  }

  flush();

  return blocks;
}

/**
 * A run of inline nodes with the whitespace an image's split left at its edges
 * taken off, so the paragraph beside a picture does not begin with the space that
 * was written to separate the two.
 */
function trimRun(nodes: readonly JSONContent[]): JSONContent[] {
  const trimmed = [...nodes];
  const first = trimmed[0];

  if (first?.type === "text" && typeof first.text === "string") {
    trimmed[0] = { ...first, text: first.text.replace(/^[ \t]+/u, "") };
  }

  const last = trimmed[trimmed.length - 1];

  if (last?.type === "text" && typeof last.text === "string") {
    trimmed[trimmed.length - 1] = { ...last, text: last.text.replace(/[ \t]+$/u, "") };
  }

  return trimmed.filter((node) => node.type !== "text" || (node.text ?? "") !== "");
}

/**
 * A paragraph: consecutive plain lines, joined as one run of inline content.
 *
 * A line ending in two spaces or a backslash is a hard break; every other line
 * break is a space, because a soft break in Markdown renders as one. The sentence
 * itself is then read by `parseInline`, and the run is split into the blocks the
 * document can hold — a line that is only a data image is a picture rather than an
 * empty paragraph around one. A line that starts a table ends the paragraph here,
 * so a table may sit directly under prose.
 */
function parseParagraph(
  lines: readonly string[],
  start: number,
): { nodes: JSONContent[]; next: number } {
  const collected: string[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (isBlank(line) || startsBlock(line) || tableStart(lines, index) !== null) break;
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

  return { nodes: blocksOfInline(parseInline(source)), next: index };
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
      const result = inlineImage(source, index, marks);

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
 * An angle construct: the export's inline `<u>…</u>` underline and `<mark>…</mark>`
 * highlight, a `<br>`, or a GFM autolink. Anything else is literal `<`, which is
 * what makes a pasted tag in a Markdown file stay text.
 *
 * `<br>` is here because the writer puts one inside a table cell: a real newline
 * would end the row, so a cell's hard break is written as `<br>` and has to be read
 * back as one.
 *
 * Both inline-HTML marks are read the same way, and the body is parsed by the same
 * `parseInline`, so `<mark>` inside a bold span and a bold run inside `<mark>` both
 * come back with both marks. Their tags are matched case-insensitively, as HTML's
 * are.
 */
function inlineAngle(source: string, index: number, marks: readonly Mark[]): InlineResult | null {
  const rest = source.slice(index);

  for (const inline of [
    { close: "</u>", mark: { type: "underline" } as const, open: /^<u>/iu },
    { close: "</mark>", mark: { type: "highlight" } as const, open: /^<mark>/iu },
  ]) {
    const opening = inline.open.exec(rest);

    if (opening === null) continue;

    const close = rest.toLowerCase().indexOf(inline.close);

    if (close !== -1) {
      const inner = rest.slice(opening[0].length, close);

      return {
        nodes: parseInline(inner, addMarks(marks, [inline.mark])),
        next: index + close + inline.close.length,
      };
    }
  }

  const lineBreak = /^<br\s*\/?>/iu.exec(rest);

  if (lineBreak !== null) {
    return { nodes: [{ type: "hardBreak" }], next: index + lineBreak[0].length };
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

  // An image inside a label is its alt text: a link's content is inline, and an
  // image is a block node this document cannot put in one.
  const label = flattenImages(parseInline(source.slice(index + 1, labelEnd), marks));
  const text = label.length === 0 ? [textNode(destination, marks)] : label;

  return {
    nodes: applyMark(text, { attrs: { href: destination }, type: "link" }),
    next: end + 1,
  };
}

/**
 * An image: `![alt](destination)`, read as the node the document has for it.
 *
 * Only a source this Tool can measure becomes an image node — a base64 `data:` URL.
 * GFM would read a remote `https:` image as one, but the CSP draws nothing from
 * another origin and the site has no upload service, so a remote source is not a
 * picture here: the alt text is the text that remains, in the place the image stood
 * (#220's rule, and the same answer admission gives an image it refuses).
 *
 * The alt is a description rather than markup, so it is unescaped rather than parsed
 * as inline content: `**` in an alt is the two characters a screen reader says.
 */
function inlineImage(source: string, index: number, marks: readonly Mark[]): InlineResult | null {
  const labelEnd = findPairEnd(source, index + 2, "[", "]");

  if (labelEnd === -1 || source[labelEnd + 1] !== "(") return null;

  const end = findPairEnd(source, labelEnd + 2, "(", ")");

  if (end === -1) return null;

  const destination = parseDestination(source.slice(labelEnd + 2, end));

  if (destination === null) return null;

  const alt = unescapeLabel(source.slice(index + 2, labelEnd));

  if (dataUrlImageProbe(destination) === null) {
    const remaining = imageAltText(alt);

    return { nodes: remaining === null ? [] : [textNode(remaining, marks)], next: end + 1 };
  }

  return { nodes: [{ attrs: { alt, src: destination }, type: "image" }], next: end + 1 };
}

/**
 * An image's label as its plain text.
 *
 * The writer escapes the alt like any other text run (and a cell escapes its pipe
 * too), so the escapes are undone here — but no mark is read, because the label is
 * a description rather than content the image can format.
 */
function unescapeLabel(raw: string): string {
  return raw.replace(/\\([\\`*_[\]<>~&|])/gu, "$1");
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
