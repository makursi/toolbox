/**
 * Which of the two import formats a chosen file is (#211).
 *
 * The file menu offers one 导入 action for both formats, because the visitor
 * knows what file they picked and the Tool should not ask twice. The decision is
 * therefore made from the file's own name first: `.md` / `.markdown` is Markdown,
 * `.html` / `.htm` is HTML. Only when the extension says nothing does the content
 * get a look, and then only enough to tell a document from prose: a leading
 * doctype or html/body tag, or a leading block element, is HTML.
 *
 * A name that names neither and content that looks like neither is Markdown. It
 * is the format this Tool writes, so it is the one a bare text file is most
 * likely to be; and the Markdown parser is forgiving by design, which makes it
 * the safer wrong answer.
 */

export type ImportFormat = "markdown" | "html";

/** The file picker's `accept` value: what the menu's one action offers. */
export const IMPORT_ACCEPT = ".md,.markdown,.html,.htm,text/markdown,text/html";

const MARKDOWN_EXTENSION = /\.(?:md|markdown|mdown|mkd|mkdn)$/u;
const HTML_EXTENSION = /\.(?:html?|xhtml)$/u;
const HTML_DOCUMENT = /^\s*(?:<!doctype\s+html\b|<html\b|<body\b|<head\b)/iu;
const HTML_BLOCK = /^\s*<(?:p|div|h[1-6]|ul|ol|li|blockquote|pre|table|article|section)\b/iu;

/**
 * The format of a chosen import file.
 *
 * `contents` is only consulted when the name has no extension this Tool knows,
 * so a `.md` file that happens to contain a `<div>` is still read as Markdown.
 */
export function importFormatOf(fileName: string, contents = ""): ImportFormat {
  const name = fileName.toLowerCase();

  if (MARKDOWN_EXTENSION.test(name)) return "markdown";
  if (HTML_EXTENSION.test(name)) return "html";
  if (HTML_DOCUMENT.test(contents) || HTML_BLOCK.test(contents)) return "html";

  return "markdown";
}
