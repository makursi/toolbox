import { expect, type Locator, type Page } from "@playwright/test";

/**
 * How the gate drives the Rich Text Editor.
 *
 * Everything here is a page-level action or a page-level reading: the editor is a
 * contenteditable, so "type" means a real keyboard and "read back" means the text
 * the browser is holding, not a serialiser's return value. Nothing reaches into
 * React state, TipTap internals or a module.
 */

export const TOOL_PATH = "/tools/rich-text-editor";

/** The card that holds the document; the fingerprint anchors the same region. */
const CANVAS = '[data-slot="rich-text-canvas"]';

/**
 * The two placeholders an empty document shows, as a visitor reads them.
 *
 * Spelled out rather than imported from the component: that constant is the other
 * side of this assertion, and an expectation derived from the code under test would
 * agree with it whether or not it is right.
 */
export const TITLE_PLACEHOLDER = "无标题";
export const BODY_PLACEHOLDER = "开始写吧，输入 `/` 插入内容";

/**
 * Open the Tool and wait until the editor exists.
 *
 * `next start` serves prerendered markup, so the shell is there before hydration and
 * a canvas that has not hydrated looks exactly like one that has. The signal is
 * React's own bookkeeping on a host element, attached during hydration and
 * impossible in the server's HTML — the same wait every Tool's helper uses. Then
 * the editor itself: it is created in an effect *after* hydration
 * (`immediatelyRender: false`), so the contenteditable appears one render later than
 * the page does.
 *
 * The editor is addressed by its role and accessible name on purpose: an editable
 * region with no name is announced as an anonymous textbox, and that is a defect
 * this locator would report rather than hide.
 */
export async function open(page: Page): Promise<void> {
  await page.goto(TOOL_PATH);
  await page.waitForFunction(() =>
    [...document.querySelectorAll("body *")].some((element) =>
      Object.keys(element).some((key) => key.startsWith("__reactFiber")),
    ),
  );
  await expect(editor(page)).toBeVisible();
}

/** The editing surface, found by the accessible name a screen reader reads. */
export function editor(page: Page): Locator {
  return page.getByRole("textbox", { name: "文档内容" });
}

/** The document's title block: the first line of the document. */
export function titleBlock(page: Page): Locator {
  return page.locator(`${CANVAS} h1`).first();
}

/** The document's first body paragraph. */
export function bodyParagraph(page: Page): Locator {
  return page.locator(`${CANVAS} p`).first();
}

/**
 * The placeholder sentence a block is *painting*, or `null` when it paints none.
 *
 * The placeholder is not text in the document: it is a `::before` whose content is
 * the `data-placeholder` the Placeholder extension puts on an empty block. Reading
 * the document's `textContent` therefore cannot see it, and `getByText` cannot find
 * it — `getComputedStyle(el, "::before").content` is the thing a visitor's eye
 * actually gets. A block that is not empty paints none, and the computed value is
 * `none` (the CSS keyword, not the string).
 */
export async function paintedPlaceholder(locator: Locator): Promise<string | null> {
  const content = await locator.evaluate(
    (element) => getComputedStyle(element, "::before").content,
  );

  if (content === "" || content === "none" || content === "normal") return null;

  // The computed value of a paint-time `attr()` arrives as a CSS string literal.
  return content.slice(1, -1);
}

/** The text a block holds, without the placeholder it may be painting. */
export async function textOf(locator: Locator): Promise<string> {
  return ((await locator.textContent()) ?? "").trim();
}

/**
 * Put the caret in the body paragraph and type with a real keyboard.
 *
 * A click first, because the document starts with its selection in the title block:
 * the paragraph is where a visitor writing prose starts, and the first keystroke is
 * what has to replace the body's placeholder.
 */
export async function writeInBody(page: Page, text: string): Promise<void> {
  await bodyParagraph(page).click();
  await page.keyboard.type(text);
}

/** Put the caret in the title block and type with a real keyboard. */
export async function writeInTitle(page: Page, text: string): Promise<void> {
  await titleBlock(page).click();
  await page.keyboard.type(text);
}
