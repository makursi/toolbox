import { expect, type Download, type Locator, type Page } from "@playwright/test";

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

/**
 * Press a control where it is drawn.
 *
 * The toolbar is the first part of this page a visitor reaches with a pointer, and
 * the point of pressing at coordinates is that a control can look right and be
 * dead to the mouse (the overlay that grows a hit area can become the target
 * instead of the element that owns the click). A keyboard path would never see
 * that, so every toolbar claim goes through here.
 *
 * `scrollIntoViewIfNeeded` first, and the viewport check second: `page.mouse.click`
 * takes viewport coordinates and drops anything outside them without a word, so a
 * control measured below the fold or beyond the toolbar's horizontal scroll would
 * read as a missing handler rather than as a missing scroll (`e2e/tool-page.ts`).
 */
export async function pressAt(page: Page, control: Locator): Promise<void> {
  await control.scrollIntoViewIfNeeded();

  const box = await control.boundingBox();
  if (box === null) throw new Error("the control has no geometry to press");

  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const viewport = page.viewportSize();
  if (
    viewport !== null &&
    (point.x < 0 || point.y < 0 || point.x >= viewport.width || point.y >= viewport.height)
  ) {
    throw new Error(
      `the control is at ${Math.round(point.x)},${Math.round(point.y)}, outside the ${viewport.width}×${viewport.height} viewport, so a press there would be dropped rather than fail`,
    );
  }

  await page.mouse.click(point.x, point.y);
}

/** A toolbar control by the name a screen reader reads on it. */
export function toolbarControl(page: Page, name: string): Locator {
  return page.getByRole("button", { name, exact: true });
}

/** The block menu's trigger, whose name carries the block at the cursor. */
export function blockTrigger(page: Page): Locator {
  return page.getByRole("button", { name: /^块类型：/ });
}

/**
 * Select the text of the first body paragraph with the keyboard.
 *
 * Home then Shift+End is a selection the visitor could make with two keys, and it
 * is the smallest selection the marks and the link action need. `Control+A` would
 * also select the empty title block, which is harmless for a mark but says less
 * about the one paragraph under test.
 */
export async function selectBodyText(page: Page): Promise<void> {
  await bodyParagraph(page).click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
}

/**
 * The file menu's trigger. 清空 and the two exports are inside the popover, so
 * the gate opens the menu by pressing this and then presses the item.
 */
export function fileTrigger(page: Page): Locator {
  return page.getByRole("button", { name: "文件", exact: true });
}

/**
 * Open the file menu, press one of its items, and return the download it starts.
 *
 * The item is pressed at its coordinates like every other control on this page:
 * the menu is a popover that appears over the page, and a button that looks right
 * and is dead to the pointer is exactly the failure the toolbar's coordinate
 * presses exist to catch. Waiting for the download before the assertion is what
 * makes the read-back a fact about the bytes rather than about the click.
 */
export async function downloadFromFileMenu(page: Page, label: string): Promise<Download> {
  await pressAt(page, fileTrigger(page));

  const item = page.getByRole("button", { name: label, exact: true });
  const [download] = await Promise.all([page.waitForEvent("download"), pressAt(page, item)]);

  return download;
}

/** The link popover's URL field. */
export function linkField(page: Page): Locator {
  return page.getByRole("textbox", { name: "链接地址" });
}

/**
 * The hidden file input behind the file menu's 导入 row.
 *
 * It is `sr-only` rather than `display: none`, so it stays a real input the gate
 * can set and a browser can open; the row is the control a visitor presses and
 * this is what receives the file (the pattern the cover generator uses).
 */
export function importInput(page: Page): Locator {
  return page.locator('input[type="file"]');
}

/** A file to import, in Playwright's in-memory form. */
export interface ImportFile {
  readonly name: string;
  readonly mimeType: string;
  readonly buffer: Buffer;
}

/**
 * Import a file through the page's own file menu.
 *
 * The 导入 row is pressed at its coordinates like every other control, and the
 * browser's file chooser is what Playwright answers; the input is never set
 * directly, because the claim is that the menu's own action reaches it. The row
 * and the input are two halves of one control, and this is the path a visitor
 * takes.
 */
export async function importFromFileMenu(page: Page, file: ImportFile): Promise<void> {
  await pressAt(page, fileTrigger(page));

  const chooser = page.waitForEvent("filechooser");
  await pressAt(page, page.getByRole("button", { name: "导入", exact: true }));

  await (await chooser).setFiles(file);
}

/** The confirmation the import shows when the draft says something. */
export function importDialog(page: Page): Locator {
  return page.getByRole("alertdialog");
}

/** Answer the import confirmation with 取消 or 替换, at the button's coordinates. */
export async function answerImportDialog(page: Page, answer: "取消" | "替换"): Promise<void> {
  await pressAt(page, importDialog(page).getByRole("button", { name: answer, exact: true }));
}

/** The document as the browser is holding it, for claims about structure. */
export function canvas(page: Page): Locator {
  return page.locator(CANVAS);
}
