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

/**
 * A toolbar control by the name a screen reader reads on it.
 *
 * It is scoped to the pinned toolbar's region because there are two toolbars on this
 * page: the one above the canvas and the one that follows a selection, which offers
 * the same five marks and the link. A document-wide query would find both names and
 * fail on the ambiguity rather than on the control.
 */
export function toolbarControl(page: Page, name: string): Locator {
  return page
    .getByRole("toolbar", { name: "格式工具栏" })
    .getByRole("button", { name, exact: true });
}

/** The toolbar that follows a selection, by the name its region carries. */
export function selectionToolbar(page: Page): Locator {
  return page.getByRole("toolbar", { name: "选中文本的格式" });
}

/** One control of the selection toolbar, by the name a screen reader reads. */
export function selectionControl(page: Page, name: string): Locator {
  return selectionToolbar(page).getByRole("button", { name, exact: true });
}

/** The slash menu, by the name its region carries. */
export function slashMenu(page: Page): Locator {
  return page.getByRole("menu", { name: "插入内容" });
}

/** The slash menu's rows, in the order the command table gives them. */
export function slashMenuItems(page: Page): Locator {
  return slashMenu(page).getByRole("menuitem");
}

/** One row of the slash menu, by the label the command table gives it. */
export function slashItem(page: Page, label: string): Locator {
  return slashMenu(page).getByRole("menuitem", { name: label, exact: true });
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
 * The file menu's trigger. 导入, 清空 and the two exports are inside the popover,
 * so the gate opens the menu by pressing this and then presses the item.
 */
export function fileTrigger(page: Page): Locator {
  return page.getByRole("button", { name: "文件", exact: true });
}

/**
 * Empty the document from the file menu.
 *
 * It is how a claim starts from a clean title, an empty paragraph and nothing else:
 * the alternative is a reload per case, and the draft is not persisted yet.
 */
export async function clearDocument(page: Page): Promise<void> {
  await pressAt(page, fileTrigger(page));
  await pressAt(page, page.getByRole("button", { name: "清空", exact: true }));
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

/** The save status's own region: the sentence the toolbar reports. */
export function saveStatus(page: Page): Locator {
  return page.locator('[data-slot="rich-text-save-status"]');
}

/** The retry control the failure state adds beside the sentence. */
export function retrySave(page: Page): Locator {
  return page.getByRole("button", { name: "重试", exact: true });
}

/**
 * Hide the page the way a tab switch does, and answer the status that was showing
 * immediately before it.
 *
 * `document.visibilityState` is a read-only accessor, so the page defines it on the
 * document object and dispatches the event the browser would: that is the only way
 * a headless page can reach the hidden state the save flush is written for. The
 * returned sentence is the state *before* the dispatch; a caller that needs the
 * flush to be the writer, rather than the debounce that was still pending, checks
 * that it read 未保存.
 */
export async function hidePage(page: Page): Promise<string> {
  return page.evaluate(() => {
    const before =
      document.querySelector('[data-slot="rich-text-save-status"]')?.textContent?.trim() ?? "";

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    return before;
  });
}

/** The record the store keeps; spelled out here rather than imported from the Tool. */
export interface StoredDraftRecord {
  readonly version: number;
  readonly document: unknown;
  readonly savedAt: number;
}

/**
 * Read the one record out of IndexedDB, or `null` when there is none.
 *
 * The names are the store's contract, but they are written here rather than imported
 * from the Tool: an expectation derived from the code under test would agree with a
 * renamed database. `indexedDB.databases()` is asked first so a read on a page that
 * has never saved does not create an empty database as a side effect.
 */
export async function storedDraft(page: Page): Promise<StoredDraftRecord | null> {
  return page.evaluate(async () => {
    const databases = await indexedDB.databases();

    if (!databases.some((database) => database.name === "rich-text-editor")) return null;

    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("rich-text-editor");
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () =>
        reject(request.error ?? new Error("the draft database could not open")),
      );
    });

    if (!database.objectStoreNames.contains("drafts")) {
      database.close();
      return null;
    }

    return await new Promise<StoredDraftRecord | null>((resolve, reject) => {
      const transaction = database.transaction("drafts", "readonly");
      const request = transaction.objectStore("drafts").get("draft");

      request.addEventListener("success", () => {
        const value: unknown = request.result;
        database.close();

        if (
          typeof value === "object" &&
          value !== null &&
          "version" in value &&
          "document" in value &&
          "savedAt" in value
        ) {
          resolve({
            document: value.document,
            savedAt: Number(value.savedAt),
            version: Number(value.version),
          });
          return;
        }

        resolve(null);
      });
      request.addEventListener("error", () => {
        database.close();
        reject(request.error ?? new Error("the draft could not be read"));
      });
    });
  });
}

/** The document as the browser is holding it, for claims about structure. */
export function canvas(page: Page): Locator {
  return page.locator(CANVAS);
}

/**
 * The toolbar's 表格 button (#217): one control in two states.
 *
 * Outside a table it opens the grid picker, inside a table the contextual menu. The
 * name is the same in both, so every press goes through it; what the button opens is
 * asserted by the region that appears and by `aria-haspopup`.
 */
export function tableTrigger(page: Page): Locator {
  return toolbarControl(page, "表格");
}

/** The grid picker's region, by the name its section carries. */
export function tableGrid(page: Page): Locator {
  return page.getByRole("region", { name: "表格大小" });
}

/** One cell of the grid picker, by the size a screen reader reads on it. */
export function tableGridCell(page: Page, rows: number, columns: number): Locator {
  return tableGrid(page).getByRole("button", { name: `${rows} 行 × ${columns} 列`, exact: true });
}

/** The contextual 表格 menu, by the name its region carries. */
export function tableMenu(page: Page): Locator {
  return page.getByRole("menu", { name: "表格操作" });
}

/** One row of the contextual menu, by the words the Tool gives it. */
export function tableMenuItem(page: Page, label: string): Locator {
  return tableMenu(page).getByRole("menuitem", { name: label, exact: true });
}

/**
 * Insert a table of the chosen size through the page's own grid picker.
 *
 * Both presses are coordinate presses: the trigger is a toolbar control, and the
 * cells are the transient surface the hit-area instrument deliberately does not
 * declare, so this is the path that proves they are reachable with a pointer.
 */
export async function insertTableOfSize(page: Page, rows: number, columns: number): Promise<void> {
  await pressAt(page, tableTrigger(page));
  await pressAt(page, tableGridCell(page, rows, columns));
}

/** Open the contextual menu from inside the table and press one of its rows. */
export async function pressTableMenuItem(page: Page, label: string): Promise<void> {
  await pressAt(page, tableTrigger(page));
  await pressAt(page, tableMenuItem(page, label));
}

/**
 * One image file for the gate, in Playwright's in-memory form.
 *
 * `buffer` is the file's bytes as a person's disk would hold them, so a size claim
 * is about the file the page is handed rather than about a number this file chose.
 */
export interface ImageFile {
  readonly name: string;
  readonly mimeType: string;
  readonly buffer: Buffer;
}

/**
 * A real 1×1 PNG: the shortest file the sniffer and the browser both accept.
 *
 * It is a PNG's own bytes rather than a signature and a guess, so a case about
 * insertion exercises the same decode path a visitor's photograph does. Its size is
 * irrelevant: the node draws it at the width in the document, which is what the
 * measure claim reads.
 */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** A valid PNG under the per-file limit, named so the alt text is predictable. */
export function pngFile(name = "photo.png"): ImageFile {
  return { buffer: PNG_1X1, mimeType: "image/png", name };
}

/**
 * A PNG one byte over the 5 MB per-file limit.
 *
 * The first bytes are a PNG, so the size rule is the one it reaches; the rest is
 * padding rather than a picture, because the claim is about a file admission must
 * refuse before reading — a real 5 MB photograph would prove less and cost more.
 */
export function oversizedPng(name = "huge.png"): ImageFile {
  const buffer = Buffer.alloc(5 * 1024 * 1024 + 1);
  PNG_1X1.copy(buffer, 0);

  return { buffer, mimeType: "image/png", name };
}

/**
 * A file that claims to be a PNG and is not.
 *
 * Its name and its declared type both say `image/png`, which is exactly the case
 * the sniffer exists for: the bytes are the only thing that decides.
 */
export function notAnImage(name = "note.png"): ImageFile {
  return { buffer: Buffer.from("这不是一张图片。", "utf8"), mimeType: "image/png", name };
}

/** 插入图片: the toolbar control that opens the file picker. */
export function imageInsert(page: Page): Locator {
  return toolbarControl(page, "插入图片");
}

/**
 * Insert an image through the toolbar's own control.
 *
 * The picker is pressed at its coordinates like every other toolbar control, and
 * Playwright answers the browser's file chooser; the input is never set directly,
 * because the claim is that the button opens it.
 */
export async function insertImageFromToolbar(page: Page, file: ImageFile): Promise<void> {
  const chooser = page.waitForEvent("filechooser");
  await pressAt(page, imageInsert(page));

  await (await chooser).setFiles(file);
}

/** The sentence a refused file is shown. */
export function refusalNotice(page: Page): Locator {
  return page.getByRole("alert");
}

/** The images the canvas is drawing, in document order. */
export function imagesInCanvas(page: Page): Locator {
  return canvas(page).locator("img");
}

/** The file as the page's own JavaScript must rebuild it for a drop or a paste. */
function entriesOf(files: readonly ImageFile[]) {
  return files.map((file) => ({
    base64: file.buffer.toString("base64"),
    mimeType: file.mimeType,
    name: file.name,
  }));
}

/**
 * Drop an image onto the editing surface, the way a visitor drags a file in.
 *
 * The bytes are rebuilt into a real `File` inside the page and carried by a real
 * `DataTransfer`, so the editor's own drop handler is what reads them — the same
 * seam the converter and Image to PDF gates use. The target is the editable rather
 * than the card around it: that is where ProseMirror's handler listens, and the
 * card's padding is the canvas's own fallback, not the path under test.
 */
export async function dropImage(page: Page, file: ImageFile): Promise<void> {
  await editor(page).evaluate(
    (element, entries) => {
      const transfer = new DataTransfer();

      for (const entry of entries) {
        const binary = atob(entry.base64);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        transfer.items.add(new File([bytes], entry.name, { type: entry.mimeType }));
      }

      element.dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }),
      );
    },
    entriesOf([file]),
  );
}

/**
 * Paste an image file into the editing surface.
 *
 * A screenshot arrives as a file in the clipboard, which is what the transfer
 * carries: ProseMirror's paste listener sees the same `ClipboardEvent` a real paste
 * dispatches, so the handler under test is the page's own.
 */
export async function pasteImage(page: Page, file: ImageFile): Promise<void> {
  await editor(page).evaluate(
    (element, entries) => {
      const transfer = new DataTransfer();

      for (const entry of entries) {
        const binary = atob(entry.base64);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        transfer.items.add(new File([bytes], entry.name, { type: entry.mimeType }));
      }

      element.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: transfer,
        }),
      );
    },
    entriesOf([file]),
  );
}
