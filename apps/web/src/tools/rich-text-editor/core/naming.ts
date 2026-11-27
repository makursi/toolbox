import type { JSONContent } from "@tiptap/react";

import { documentTitle } from "./document";

/**
 * The export filename rule (#210): the document names itself, and no field asks
 * the visitor for a name.
 *
 * The name is the sanitised document title, today's date and the format's own
 * extension: `标题-2026-11-27.md`. The title part is capped at 40 characters so a
 * pasted paragraph cannot become a filename the filesystem refuses; the cap is on
 * the title rather than on the whole name, so the date and the extension are
 * never the part that gets cut. A document whose title is empty, or whose title
 * is nothing but characters a filename cannot carry, falls back to `文档`.
 *
 * The date is the visitor's own calendar day, read from the local fields, for the
 * same reason the Image to PDF name is: a name built from UTC fields would roll
 * over at the wrong hour for most of the world.
 */

/** The two formats this Tool exports, and the extension each one writes. */
export type ExportFormat = "markdown" | "html";

const EXTENSIONS: Record<ExportFormat, string> = { html: "html", markdown: "md" };

/** The filename's title fallback when the document has no title to use. */
const FALLBACK_TITLE = "文档";

/** How many characters of the title a filename keeps. */
const MAX_TITLE_LENGTH = 40;

/** The characters no common filesystem accepts; a filename never carries them. */
const INVALID = /[<>:"/\\|?*]/gu;

/** `YYYY-MM-DD`, from a date's local fields. */
function dateStamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * The title as a filename can carry it: no invalid characters, no control
 * characters, one space where a run of whitespace was, no trailing dot or space,
 * and at most 40 characters.
 */
function safeTitle(title: string): string {
  const cleaned = Array.from(title)
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .replace(INVALID, "")
    .replace(/\s+/gu, " ")
    .trim();
  const capped = Array.from(cleaned).slice(0, MAX_TITLE_LENGTH).join("");

  return capped.replace(/[. ]+$/u, "");
}

/**
 * The name an exported file carries: `<title>-<date>.<extension>`, with 文档 in
 * the title's place when there is none.
 */
export function exportFileName(document: JSONContent, format: ExportFormat, date: Date): string {
  const title = safeTitle(documentTitle(document));

  return `${title === "" ? FALLBACK_TITLE : title}-${dateStamp(date)}.${EXTENSIONS[format]}`;
}
