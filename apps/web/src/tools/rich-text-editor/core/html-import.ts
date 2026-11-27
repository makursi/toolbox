/**
 * Sanitised HTML for the editor's paste and import paths (#211, tables and images #220).
 *
 * The editor's schema is a closed list: a document has paragraphs, headings,
 * lists, quotes, code blocks, rules, images and tables, and inline text has bold,
 * italic, underline, strike, code and link. Everything else a pasted or imported
 * document may carry (scripts, stylesheets, a `<head>`, layout wrappers, event
 * handlers, `javascript:` URLs, a remote image, a `data:` URL over one of the
 * image limits) is either dropped or unwrapped here, before a parser ever sees it.
 *
 * The output is a fragment of the elements the schema does know, and the final
 * conversion to JSON is TipTap's own: the editor hands this markup to
 * `setContent`, whose DOMParser is the authority on the document that results.
 * That is why this module returns a string rather than JSON: writing a second
 * ProseMirror parser here would be a second answer to a question the schema
 * already answers, and the pure, Node-testable half is exactly the sanitising.
 *
 * The editor's paste path is the same function (`transformPastedHTML`), so a
 * pasted `<script>` and an imported `<script>` are removed by one rule rather
 * than two.
 *
 * An image source is kept only when it is a `data:` URL this Tool can measure, and
 * the image then meets the same admission an inserted file does — an import is a
 * whole document, so its batch starts empty and every image after the tenth is
 * dropped whatever its size. A source that fails either test leaves its alt text,
 * which is the answer the Markdown reader gives the same file (#220).
 *
 * The parser is a forgiving tokeniser over a small tree, not a browser: an
 * unclosed tag, a stray `<` or a mismatched closing tag is text or is closed by
 * its parent, and no input makes this throw. Text is entity-decoded on the way in
 * and escaped on the way out, so `&amp;` survives as one `&` rather than becoming
 * `&amp;amp;`.
 */

import { importAdmission, type ImageRefusal, type ImportAdmission } from "./admission";
import { imageAltText } from "./image";

interface TextNode {
  readonly type: "text";
  readonly text: string;
}

interface ElementNode {
  readonly type: "element";
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly children: readonly HtmlNode[];
}

type HtmlNode = TextNode | ElementNode;

/** Elements with no closing tag. */
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

/** Elements dropped with everything inside them: none of it is the document. */
const DROPPED_ELEMENTS = new Set([
  "applet",
  "area",
  "audio",
  "base",
  "canvas",
  "embed",
  "frame",
  "frameset",
  "head",
  "iframe",
  "input",
  "link",
  "map",
  "math",
  "meta",
  "noscript",
  "object",
  "script",
  "style",
  "svg",
  "template",
  "title",
  "video",
]);

/** Elements the editor has a node or mark for. */
const KEPT_ELEMENTS = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "strong",
  "u",
  "ul",
]);

/** Element names that mean an element the schema knows under another name. */
const TAG_ALIASES: Readonly<Record<string, string>> = {
  b: "strong",
  del: "s",
  i: "em",
  ins: "u",
  kbd: "code",
  samp: "code",
  strike: "s",
  tt: "code",
};

/** The named entities a document from elsewhere is likely to use. */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: "\u00A0",
  quot: '"',
};

/** The URL schemes a link may keep. */
const ALLOWED_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

/** A link's language class, as the editor's code block reads it back. */
const LANGUAGE_CLASS = /^language-([A-Za-z0-9_+#.-]+)$/u;

/** The sanitised fragment, and the images whose source or size it had to refuse. */
export interface HtmlImport {
  readonly html: string;
  readonly refusals: readonly ImageRefusal[];
}

/**
 * What an imported HTML file becomes: the fragment, and the rules its images broke.
 *
 * The two travel together because an import has a sentence to show about a refused
 * image (the one `core/copy.ts` gives every refusal), and the fragment alone cannot
 * carry it. The admission starts empty: an import replaces the document, so the
 * count and the total are about the file's own images.
 */
export function importHtml(source: string): HtmlImport {
  const admission = importAdmission();
  const html = serialize(transformNodes(parseFragment(source), { admission }));

  return { html, refusals: admission.refusals };
}

/**
 * The sanitised fragment for a pasted or imported document.
 *
 * `""` means the source held nothing the editor can carry. Callers treat that as
 * an empty document rather than as markup. The refusal sentences are dropped here
 * because the paste path has nowhere to say one; the image is refused all the same,
 * and its alt text is what the document gets.
 */
export function sanitizeHtml(source: string): string {
  return importHtml(source).html;
}

/** What the transform needs besides the tree: the batch's running image admission. */
interface SanitizeContext {
  readonly admission: ImportAdmission;
}

/** A stack entry while the tree is being built: the root, or an open element. */
interface StackNode {
  readonly tag: string;
  readonly children: HtmlNode[];
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/gu, (match, body: string) => {
    if (body.startsWith("#")) {
      const hexadecimal = body[1] === "x" || body[1] === "X";
      const code = Number.parseInt(
        hexadecimal ? body.slice(2) : body.slice(1),
        hexadecimal ? 16 : 10,
      );

      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }

    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** The index of the `>` that ends the tag starting at `start`, or `-1`. */
function findTagEnd(source: string, start: number): number {
  let quote: string | null = null;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];

    if (quote !== null) {
      if (character === quote) quote = null;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === ">") return index;
  }

  return -1;
}

/** An element's attributes, with entities decoded and names lowercased. */
function parseAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/gu;
  let match: RegExpExecArray | null = pattern.exec(raw);

  while (match !== null) {
    const name = (match[1] ?? "").toLowerCase();

    if (name !== "" && !(name in attrs)) {
      attrs[name] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
    }

    match = pattern.exec(raw);
  }

  return attrs;
}

/** A forgiving tokeniser: an unterminated construct ends the input, never throws. */
function parseFragment(source: string): HtmlNode[] {
  const root: StackNode = { children: [], tag: "" };
  const stack: StackNode[] = [root];
  let index = 0;

  const append = (node: HtmlNode) => {
    (stack[stack.length - 1] ?? root).children.push(node);
  };

  const appendText = (raw: string) => {
    const text = decodeEntities(raw);
    if (text !== "") append({ text, type: "text" });
  };

  const close = (tag: string) => {
    for (let position = stack.length - 1; position >= 1; position -= 1) {
      if (stack[position]?.tag === tag) {
        stack.length = position;
        return;
      }
    }
  };

  while (index < source.length) {
    const open = source.indexOf("<", index);

    if (open === -1) {
      appendText(source.slice(index));
      break;
    }

    if (open > index) appendText(source.slice(index, open));

    const rest = source.slice(open);

    if (rest.startsWith("<!--")) {
      const end = source.indexOf("-->", open + 4);
      index = end === -1 ? source.length : end + 3;
      continue;
    }

    if (rest.startsWith("<!") || rest.startsWith("<?")) {
      const end = findTagEnd(source, open + 2);
      index = end === -1 ? source.length : end + 1;
      continue;
    }

    if (rest.startsWith("</")) {
      const end = findTagEnd(source, open + 2);

      if (end === -1) {
        appendText("<");
        index = open + 1;
        continue;
      }

      const name = /^<\/\s*([a-zA-Z][a-zA-Z0-9:-]*)/u.exec(rest)?.[1]?.toLowerCase();
      index = end + 1;
      if (name !== undefined) close(name);
      continue;
    }

    const name = /^<([a-zA-Z][a-zA-Z0-9:-]*)/u.exec(rest)?.[1];
    const end = findTagEnd(source, open + 1);

    if (name === undefined || end === -1) {
      appendText("<");
      index = open + 1;
      continue;
    }

    const raw = source.slice(open + 1 + name.length, end);
    const selfClosing = /\/\s*$/u.test(raw);
    const element: StackNode = {
      children: [],
      tag: name.toLowerCase(),
    };

    append({
      attrs: parseAttributes(raw.replace(/\/\s*$/u, "")),
      children: element.children,
      tag: element.tag,
      type: "element",
    });

    if (!VOID_ELEMENTS.has(element.tag) && !selfClosing) stack.push(element);
    index = end + 1;
  }

  return root.children;
}

/** The children with each one sanitised. */
function transformNodes(nodes: readonly HtmlNode[], context: SanitizeContext): HtmlNode[] {
  return nodes.flatMap((node) => (node.type === "text" ? [node] : transformElement(node, context)));
}

/** The name an element is kept under, or its own name. */
function resolvedTag(tag: string): string {
  return TAG_ALIASES[tag] ?? tag;
}

function transformElement(element: ElementNode, context: SanitizeContext): HtmlNode[] {
  const tag = resolvedTag(element.tag);

  // An image is read before the drop list, and the drop list no longer holds it:
  // it is a node the document has, as long as its source is one this Tool can draw.
  if (tag === "img") return transformImage(element, context);

  if (DROPPED_ELEMENTS.has(tag)) return [];

  if (tag === "br" || tag === "hr") {
    return [{ attrs: {}, children: [], tag, type: "element" }];
  }

  if (tag === "pre") return [transformPre(element)];

  if (tag === "code") {
    const language = languageOf(element);
    const text = collectText(element);

    return [
      {
        attrs: language === "" ? {} : { class: `language-${language}` },
        children: text === "" ? [] : [{ text, type: "text" }],
        tag: "code",
        type: "element",
      },
    ];
  }

  if (tag === "ul" || tag === "ol") return [transformList(element, tag, context)];

  if (tag === "li") return [transformListItem(element, false, context)];

  if (tag === "table") return transformTable(element, context);

  if (tag === "a") {
    const href = safeHref(element.attrs.href);

    if (href === null) return transformNodes(element.children, context);

    return [
      {
        attrs: { href },
        children: transformNodes(element.children, context),
        tag: "a",
        type: "element",
      },
    ];
  }

  if (KEPT_ELEMENTS.has(tag)) {
    return [
      {
        attrs: {},
        children: transformNodes(element.children, context),
        tag,
        type: "element",
      },
    ];
  }

  // A wrapper the schema has no node for (div, section, span, …) keeps its words
  // and loses its box.
  return transformNodes(element.children, context);
}

/**
 * An `<img>` as the document's own image, or the alt text that remains of it.
 *
 * A source is kept only when it is a base64 `data:` URL this Tool can measure and
 * admit. The rejection is the same decision for both halves: a remote `https:` image
 * would be a request this site's CSP never allows and an upload service this site
 * does not have, and an image over a limit is one the document may not hold — its
 * alt text is the words that were written about it, which is what a reader can still
 * use. An image with no alt leaves nothing rather than an empty node.
 *
 * `style` is not a kept attribute; the one value read from it is the percentage
 * width this Tool's own writer puts there, because that number is part of the
 * document — it is the Markdown export that has to drop it, not the HTML one.
 */
function transformImage(element: ElementNode, context: SanitizeContext): HtmlNode[] {
  const alt = element.attrs.alt ?? "";
  const verdict = context.admission.admit(element.attrs.src);

  if (verdict?.kind !== "admitted") {
    const text = imageAltText(alt);

    return text === null ? [] : [{ text, type: "text" }];
  }

  const src = (element.attrs.src ?? "").trim();
  // `src` first, in the order the writer puts them: the two are read back by the
  // same parser, and a round trip that reorders attributes is noise in a diff.
  const attrs: Record<string, string> = { src, alt };
  const width = percentageWidth(element);

  if (width !== null) attrs.style = `width: ${String(width)}%`;

  return [{ attrs, children: [], tag: "img", type: "element" }];
}

/** The percentage width an `<img>` declares, clamped to the node's own 1–100. */
function percentageWidth(element: ElementNode): number | null {
  const written = /(?:^|;)\s*width\s*:\s*(\d+(?:\.\d+)?)\s*%/iu.exec(element.attrs.style ?? "");
  const raw = written?.[1] ?? element.attrs.width ?? "";
  const parsed = Number.parseFloat(raw);

  if (!Number.isFinite(parsed)) return null;

  return Math.min(100, Math.max(1, Math.round(parsed)));
}

/**
 * A table, and the two wrapper elements a table may carry.
 *
 * `thead`, `tbody` and `tfoot` are not nodes of this document — its table is rows of
 * cells, and its first row is the header — so the wrappers are taken off and their
 * rows kept in order. Anything else directly inside the table (`caption`, stray
 * text) is not a cell and says nothing about the document; a table with no rows left
 * says nothing at all.
 */
function transformTable(element: ElementNode, context: SanitizeContext): HtmlNode[] {
  const rows = tableRows(element).flatMap((row) => {
    const transformed = transformRow(row, context);

    return transformed === null ? [] : [transformed];
  });

  return rows.length === 0 ? [] : [{ attrs: {}, children: rows, tag: "table", type: "element" }];
}

/** The `<tr>`s under a table, with any `thead`/`tbody`/`tfoot` wrapper taken off. */
function tableRows(element: ElementNode): ElementNode[] {
  return element.children.flatMap((child) => {
    if (child.type !== "element") return [];

    const tag = resolvedTag(child.tag);
    if (tag === "tr") return [child];
    if (tag === "thead" || tag === "tbody" || tag === "tfoot") return tableRows(child);

    return [];
  });
}

/**
 * One row: its `<td>`/`<th>` cells, and nothing else.
 *
 * A row with no cells is dropped rather than kept as an empty grid line. A cell with
 * no content gets the paragraph its schema requires, so `<td></td>` is an empty cell
 * rather than a cell the parser has to invent content for.
 */
function transformRow(row: ElementNode, context: SanitizeContext): HtmlNode | null {
  const cells = row.children.flatMap((child): HtmlNode[] => {
    if (child.type !== "element") return [];

    const tag = resolvedTag(child.tag);
    if (tag !== "td" && tag !== "th") return [];

    const content = transformNodes(child.children, context);
    const children: HtmlNode[] =
      content.length === 0 ? [{ attrs: {}, children: [], tag: "p", type: "element" }] : content;

    return [{ attrs: {}, children, tag, type: "element" }];
  });

  return cells.length === 0 ? null : { attrs: {}, children: cells, tag: "tr", type: "element" };
}

/** A code block: the text of everything inside it, with its language if it had one. */
function transformPre(element: ElementNode): ElementNode {
  const code = element.children.find(
    (child): child is ElementNode => child.type === "element" && resolvedTag(child.tag) === "code",
  );
  const language = languageOf(code);
  const text = collectText(element);

  return {
    attrs: {},
    children: [
      {
        attrs: language === "" ? {} : { class: `language-${language}` },
        children: text === "" ? [] : [{ text, type: "text" }],
        tag: "code",
        type: "element",
      },
    ],
    tag: "pre",
    type: "element",
  };
}

/** Every text run inside an element, with `<br>` as a line break. */
function collectText(element: ElementNode): string {
  return element.children
    .map((child) => {
      if (child.type === "text") return child.text;
      if (resolvedTag(child.tag) === "br") return "\n";

      return collectText(child);
    })
    .join("");
}

/** A heading, paragraph, quote or list's language class, if it carries one. */
function languageOf(element: ElementNode | undefined): string {
  if (element === undefined) return "";

  for (const className of (element.attrs.class ?? "").split(/\s+/u)) {
    const match = LANGUAGE_CLASS.exec(className);

    if (match !== null) return match[1] ?? "";
  }

  return "";
}

/**
 * A list, and whether it is a task list.
 *
 * The editor's task list parses `<ul data-type="taskList">` with
 * `<li data-type="taskItem" data-checked>`, while the standalone HTML export
 * writes a plain `<ul class="task-list">` whose items carry checkboxes. Both are
 * read here and written back in the editor's own shape, which is what makes an
 * exported file importable again.
 */
function transformList(
  element: ElementNode,
  tag: "ul" | "ol",
  context: SanitizeContext,
): ElementNode {
  const task = tag === "ul" && isTaskList(element);
  const items = element.children
    .filter(
      (child): child is ElementNode => child.type === "element" && resolvedTag(child.tag) === "li",
    )
    .map((item) => transformListItem(item, task, context));
  const attrs: Record<string, string> = {};

  if (task) {
    attrs["data-type"] = "taskList";
  } else if (tag === "ol") {
    const start = Number.parseInt(element.attrs.start ?? "1", 10);

    if (Number.isInteger(start) && start !== 1) attrs.start = String(start);
  }

  return { attrs, children: items, tag: task ? "ul" : tag, type: "element" };
}

/** One list item, as a task item when its list is a task list. */
function transformListItem(
  element: ElementNode,
  task: boolean,
  context: SanitizeContext,
): ElementNode {
  const checked = task && isChecked(element);
  const attrs: Record<string, string> = {};

  if (task) {
    attrs["data-type"] = "taskItem";
    attrs["data-checked"] = checked ? "true" : "false";
  }

  return {
    attrs,
    children: transformNodes(element.children, context),
    tag: "li",
    type: "element",
  };
}

/** Whether a `<ul>` is a task list: TipTap's own marker, or any checkbox inside one of its items. */
function isTaskList(element: ElementNode): boolean {
  if ((element.attrs["data-type"] ?? "").toLowerCase() === "tasklist") return true;
  if (/\btask-list\b/u.test(element.attrs.class ?? "")) return true;

  return element.children.some(
    (child) =>
      child.type === "element" &&
      resolvedTag(child.tag) === "li" &&
      findCheckbox(child) !== undefined,
  );
}

/** The first checkbox inside an item, ignoring ones that belong to a nested list. */
function findCheckbox(element: ElementNode): ElementNode | undefined {
  for (const child of element.children) {
    if (child.type !== "element") continue;

    const tag = resolvedTag(child.tag);

    if (tag === "ul" || tag === "ol") continue;
    if (tag === "input" && (child.attrs.type ?? "").toLowerCase() === "checkbox") return child;

    const found = findCheckbox(child);

    if (found !== undefined) return found;
  }

  return undefined;
}

/** Whether a task item is checked, from its own marker or from its checkbox. */
function isChecked(element: ElementNode): boolean {
  const data = element.attrs["data-checked"];

  if (data !== undefined) return data === "" || data.toLowerCase() === "true";

  const checkbox = findCheckbox(element);

  return checkbox !== undefined && "checked" in checkbox.attrs;
}

/**
 * Whether a string carries a character a URL must never contain.
 *
 * Written as a loop rather than a character range in a regular expression: the
 * range would be a control-character match, which the linter rejects as a likely
 * mistake, and here it is the point.
 */
function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;

    if (code < 0x20 || code === 0x7f) return true;
  }

  return false;
}

/**
 * A link destination worth keeping.
 *
 * Relative and fragment links stay. Absolute links must name a scheme this site
 * is willing to send a reader to; a `javascript:` or `data:` URL is not a link
 * the editor should carry, and the element is unwrapped to its words instead.
 */
function safeHref(raw: string | undefined): string | null {
  if (raw === undefined) return null;

  const href = raw.trim();

  if (href === "" || hasControlCharacter(href)) return null;

  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/u.exec(href);

  if (scheme === null) return href;

  return ALLOWED_SCHEMES.has((scheme[1] ?? "").toLowerCase()) ? href : null;
}

function serialize(nodes: readonly HtmlNode[]): string {
  return nodes.map(serializeNode).join("");
}

function escapeText(text: string): string {
  return text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/gu, "&quot;");
}

function serializeNode(node: HtmlNode): string {
  if (node.type === "text") return escapeText(node.text);

  const attributes = Object.entries(node.attrs)
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join("");

  if (VOID_ELEMENTS.has(node.tag)) return `<${node.tag}${attributes}>`;

  return `<${node.tag}${attributes}>${serialize(node.children)}</${node.tag}>`;
}
