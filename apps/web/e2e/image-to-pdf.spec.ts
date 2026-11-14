import { expect, test, type Locator, type Page } from "@playwright/test";
import { unzlibSync } from "fflate";

import {
  avifFile,
  chooseFiles,
  dropFiles,
  gifFile,
  hugeHeaderPng,
  inspectDownloadedPdf,
  jpeg,
  open,
  renamedTextFile,
  todayPdfName,
  transparentPng,
  webp,
  type NamedBytes,
  type PdfFacts,
} from "./image-to-pdf-page";

/**
 * The Tool's promise at the highest point a machine can reach: a real JPEG goes
 * in through the page's own file input, the page's single action builds the
 * document, and the file that lands on disk is read back by a second PDF
 * implementation.
 *
 * What this proves is the structure a reader needs — a preamble, a page tree
 * with one page per image, each page's media box on the chosen paper, one image
 * XObject per page, and the original JPEG bytes inside the stream. What it cannot
 * prove is that a reader *draws* it: that stays in the Tool's README as a manual
 * item.
 *
 * The reordering specs press the same controls a visitor does: a real mouse
 * down/move/up at the handle's coordinates, the keyboard's lift/move/drop, and a
 * dispatched touch. The file that comes out is the proof in every case, because
 * "the list looks reordered" and "the document is reordered" are different
 * claims and only one of them is the Tool's promise.
 */

/** The papers' sizes in points, as a reader would state them. */
const A4_PORTRAIT = { width: 595.28, height: 841.89 };
const A4_LANDSCAPE = { width: 841.89, height: 595.28 };
const LETTER_PORTRAIT = { width: 612, height: 792 };

function expectBox(
  box: { width: number; height: number } | undefined,
  expected: { width: number; height: number },
): void {
  expect(box).toBeDefined();
  expect(box?.width).toBeCloseTo(expected.width, 2);
  expect(box?.height).toBeCloseTo(expected.height, 2);
}

/** Press the page's own download and read the file that lands on disk. */
async function downloadPdf(page: Page): Promise<PdfFacts> {
  const link = page.locator("a[download]");
  await expect(link).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  const path = await download.path();
  if (path === null) throw new Error("the download produced no file to read");

  return inspectDownloadedPdf(path);
}

/**
 * The structural minimum every page this Tool writes must show: a preamble, a
 * trailer the second implementation can follow, and an end marker. The xref
 * offset is read here rather than left to `pdf-lib`, which reconstructs a broken
 * table instead of refusing the file.
 */
function expectValidPdf(pdf: PdfFacts): void {
  const text = pdf.bytes.toString("latin1");

  expect(text.startsWith("%PDF-1.7\n")).toBe(true);
  expect(text.trimEnd().endsWith("%%EOF")).toBe(true);

  const startxref = /startxref\s+(\d+)/.exec(text);
  expect(startxref, "the file has no startxref").not.toBeNull();
  expect(text.startsWith("xref", Number(startxref?.[1]))).toBe(true);
}

test("one JPEG becomes a one-page A4 PDF the site wrote itself", async ({ page }) => {
  await open(page);

  // The empty state: the action is unavailable and says why, which is the
  // control's own rule rather than a silent dead button.
  const convert = page.getByRole("button", { name: "转换" });
  await expect(convert).toBeDisabled();
  await expect(page.getByText("还没有图片，先选择一张。")).toBeVisible();

  const photo = await jpeg(page.context());
  await chooseFiles(page, [photo]);
  const rows = page.locator('[data-slot="pdf-page-row"]');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("第 1 页");
  await expect(convert).toBeEnabled();

  await convert.click();

  const link = page.locator("a[download]");
  await expect(link).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);

  // The file names itself, from the visitor's own calendar day.
  expect(download.suggestedFilename()).toBe(todayPdfName());

  const path = await download.path();
  if (path === null) throw new Error("the download produced no file to read");

  const pdf = await inspectDownloadedPdf(path);
  const text = pdf.bytes.toString("latin1");

  // A preamble a reader recognises, and the binary comment line that follows it
  // so a transfer treats the file as bytes rather than as text.
  expect(text.startsWith("%PDF-1.7\n")).toBe(true);
  const comment = pdf.bytes.subarray("%PDF-1.7\n".length, "%PDF-1.7\n".length + 5);
  expect(comment.subarray(0, 1).toString("latin1")).toBe("%");
  for (const byte of comment.subarray(1)) expect(byte).toBeGreaterThan(127);
  expect(text.trimEnd().endsWith("%%EOF")).toBe(true);

  /*
   * The classic xref table, read by hand: `startxref` names where the table is,
   * and the table's first object entry names where object 1 is. `pdf-lib`
   * reconstructs a broken table instead of refusing the file, so a writer that
   * stopped writing usable offsets would otherwise pass everything below: this
   * is the one structural claim the gate has to read for itself.
   */
  const startxref = /startxref\s+(\d+)/.exec(text);
  expect(startxref, "the file has no startxref").not.toBeNull();
  const xrefOffset = Number(startxref?.[1]);
  expect(text.startsWith("xref", xrefOffset), "startxref misses the xref table").toBe(true);

  // The table's first line is the free entry (object 0); object 1's entry is the
  // one that has to resolve to `1 0 obj`.
  const firstEntry = /^xref\n0 \d+\n.*\n(\d{10}) /.exec(text.slice(xrefOffset));
  expect(firstEntry, "the xref table has no first object entry").not.toBeNull();
  const firstObject = Number(firstEntry?.[1]);
  expect(
    text.startsWith("1 0 obj", firstObject),
    "the xref's first offset does not point at object 1",
  ).toBe(true);

  expect(pdf.pageCount).toBe(1);

  // A portrait 3:4 image asks for A4 in portrait: the image's orientation
  // decides the page's, which is the Tool's one geometry rule.
  expect(pdf.mediaBoxes).toHaveLength(1);
  expect(pdf.mediaBoxes[0]?.width).toBeCloseTo(595.28, 2);
  expect(pdf.mediaBoxes[0]?.height).toBeCloseTo(841.89, 2);

  // One content stream and one image XObject per page, and nothing else.
  expect(pdf.imagesPerPage).toEqual([1]);

  // The JPEG goes in with the bytes that came out of the picker: no decode, no
  // re-encode, no generation lost.
  expect(pdf.imageStreams).toHaveLength(1);
  expect(pdf.imageStreams[0]?.equals(photo.buffer)).toBe(true);
});

/**
 * A batch that is not all acceptable: two real JPEGs become pages, a GIF, an
 * AVIF and a renamed text file are refused with sentences, and the document
 * that comes out holds exactly the accepted files in the order they arrived.
 *
 * The converted batch is JPEG-only on purpose. PNG and WebP are accepted by the
 * sniffer and do become rows, but their pages are written by #195's decode
 * path; converting one of them here would be asserting #195's work.
 */
test("a mixed batch keeps the accepted files and lists every refusal once", async ({ page }) => {
  await open(page);

  // The input is what sniffing is for; a declared-type filter would defeat it.
  const input = page.locator('input[type="file"]').first();
  expect(await input.getAttribute("accept")).toBeNull();

  const context = page.context();
  const first = await jpeg(context, { width: 128, height: 96, name: "first.jpg" });
  const second = await jpeg(context, { width: 96, height: 128, name: "second.jpg" });
  const third = await jpeg(context, { width: 64, height: 96, name: "third.jpg" });
  const fourth = await jpeg(context, { width: 72, height: 96, name: "fourth.jpg" });

  // With nothing in the list, the whole dashed box is the drop target.
  await expect(page.getByText("也可以把文件拖到这里")).toBeVisible();

  // One gesture, five files, in the order a folder would offer them: accepted,
  // refused, refused, refused, accepted.
  await dropFiles(page, [first, gifFile(), avifFile(), renamedTextFile(), second]);

  const rows = page.locator('[data-slot="pdf-page-row"]');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("第 1 页");
  await expect(rows.nth(0)).toContainText("first.jpg");
  await expect(rows.nth(1)).toContainText("第 2 页");
  await expect(rows.nth(1)).toContainText("second.jpg");

  // Each refused file is listed once, under one sentence for its category. The
  // wording is stated here rather than imported from `core/`: the gate is the
  // other side of that assertion, and a copy of the constant would agree with
  // the code whether or not it is right.
  const refusalLines = page.locator('[data-slot="alert"] p');
  await expect(refusalLines).toHaveCount(3);
  await expect(
    refusalLines.filter({
      hasText: "这个格式的图片暂时不支持，请换成 JPEG、PNG 或 WebP 的图片。",
    }),
  ).toHaveCount(2);
  await expect(refusalLines.filter({ hasText: "这个文件不是图片，换一个再试。" })).toHaveCount(1);
  await expect(refusalLines.filter({ hasText: "sticker.gif" })).toHaveCount(1);
  await expect(refusalLines.filter({ hasText: "photo.avif" })).toHaveCount(1);
  await expect(refusalLines.filter({ hasText: "not-really.png" })).toHaveCount(1);

  // The full drop zone has collapsed to one line, and the picker keeps the
  // accessible name the hit-area instrument declares in both states.
  await expect(page.getByText("继续添加")).toBeVisible();
  await expect(page.getByRole("button", { name: "选择图片" })).toBeVisible();

  // A second batch appends without disturbing the first, and the collapsed line
  // is still a real drop target.
  await dropFiles(page, [third]);
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(2)).toContainText("第 3 页");
  await expect(rows.nth(2)).toContainText("third.jpg");

  // The picker behind the same collapsed line still works too.
  await chooseFiles(page, [fourth]);
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(3)).toContainText("第 4 页");
  await expect(rows.nth(3)).toContainText("fourth.jpg");
  await expect(page.getByRole("button", { name: "移除" })).toHaveCount(4);
  await expect(page.getByRole("button", { name: "清空" })).toBeVisible();

  await page.getByRole("button", { name: "转换" }).click();

  const link = page.locator("a[download]");
  await expect(link).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  const path = await download.path();
  if (path === null) throw new Error("the download produced no file to read");

  const pdf = await inspectDownloadedPdf(path);

  // The refused files contributed no page and no image; the accepted ones are
  // present in the order they were chosen.
  expect(pdf.pageCount).toBe(4);
  expect(pdf.imagesPerPage).toEqual([1, 1, 1, 1]);
  expect(pdf.imageStreams).toHaveLength(4);
  expect(pdf.imageStreams[0]?.equals(first.buffer)).toBe(true);
  expect(pdf.imageStreams[1]?.equals(second.buffer)).toBe(true);
  expect(pdf.imageStreams[2]?.equals(third.buffer)).toBe(true);
  expect(pdf.imageStreams[3]?.equals(fourth.buffer)).toBe(true);

  // Order is also visible in the page shape: the first image is landscape, the
  // rest are portrait, so the media boxes cannot be a reordered set.
  expect(pdf.mediaBoxes[0]?.width).toBeCloseTo(841.89, 2);
  expect(pdf.mediaBoxes[0]?.height).toBeCloseTo(595.28, 2);
  expect(pdf.mediaBoxes[1]?.width).toBeCloseTo(595.28, 2);
  expect(pdf.mediaBoxes[2]?.width).toBeCloseTo(595.28, 2);
  expect(pdf.mediaBoxes[3]?.width).toBeCloseTo(595.28, 2);

  // One control clears the list, and the input region is the full box again.
  await page.getByRole("button", { name: "清空" }).click();
  await expect(rows).toHaveCount(0);
  await expect(page.getByText("有文件没能加入")).toHaveCount(0);
  await expect(page.getByText("继续添加")).toHaveCount(0);
  await expect(page.getByText("也可以把文件拖到这里")).toBeVisible();
});

/**
 * The paper is a choice, and the three media boxes are the proof: the visitor's
 * selection is not a preview preference, it is what every page in the file says.
 *
 * The same test carries the invalidation the control owes: a change takes the
 * produced file away, because a download that no longer matches the preview is
 * the worst thing this page can hand over.
 */
test("the paper row is one choice of three, and the download says which was chosen", async ({
  page,
}) => {
  await open(page);

  const group = page.getByRole("radiogroup", { name: "页面尺寸" });
  await expect(group).toBeVisible();

  const a4 = group.getByRole("radio", { name: "A4" });
  const letter = group.getByRole("radio", { name: "Letter" });
  const original = group.getByRole("radio", { name: "原始尺寸" });

  /*
   * A fresh page is on A4, and the group is a single choice: exactly one item is
   * checked. `aria-checked`/`data-state` are the machine-readable half of the
   * selection; the drawn half is border, weight and surface, never colour, and
   * the row's own component carries those classes.
   */
  await expect(a4).toHaveAttribute("aria-checked", "true");
  await expect(a4).toHaveAttribute("data-state", "on");
  await expect(letter).toHaveAttribute("aria-checked", "false");
  await expect(letter).toHaveAttribute("data-state", "off");
  await expect(original).toHaveAttribute("aria-checked", "false");
  await expect(original).toHaveAttribute("data-state", "off");

  // 原始尺寸 is explained next to the choices: one pixel is three quarters of a
  // point at 96 dpi, so the two words cannot be read as a paper size.
  await expect(page.getByText("96 dpi")).toBeVisible();
  await expect(page.getByText("不是一种纸")).toBeVisible();

  const photo = await jpeg(page.context());
  await chooseFiles(page, [photo]);
  const convert = page.getByRole("button", { name: "转换" });

  await convert.click();
  const a4Pdf = await downloadPdf(page);
  expect(a4Pdf.pageCount).toBe(1);
  expectBox(a4Pdf.mediaBoxes[0], A4_PORTRAIT);

  // Changing the paper invalidates the produced document: no banner, no error,
  // the link is gone and the action is armed again.
  await letter.click();
  await expect(letter).toHaveAttribute("aria-checked", "true");
  await expect(a4).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("a[download]")).toHaveCount(0);
  await expect(convert).toBeEnabled();

  await convert.click();
  const letterPdf = await downloadPdf(page);
  expectBox(letterPdf.mediaBoxes[0], LETTER_PORTRAIT);

  // 原始尺寸 is the image's own pixels at 96 dpi: 96 x 128 px -> 72 x 96 pt.
  await original.click();
  await expect(original).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("a[download]")).toHaveCount(0);

  await convert.click();
  const originalPdf = await downloadPdf(page);
  expectBox(originalPdf.mediaBoxes[0], { width: 96 * 0.75, height: 128 * 0.75 });
});

/**
 * A group a pointer can use and a keyboard cannot is half a control. Tab enters
 * the row at the checked item (the group is one Tab stop, which is what makes it
 * read as one choice), and the arrow keys change the choice rather than only
 * moving focus — the behaviour a radio group promises.
 */
test("Tab reaches the paper row and the arrow keys change the choice", async ({ page }) => {
  await open(page);

  const photo = await jpeg(page.context());
  await chooseFiles(page, [photo]);

  const a4 = page.getByRole("radio", { name: "A4" });
  const letter = page.getByRole("radio", { name: "Letter" });
  const original = page.getByRole("radio", { name: "原始尺寸" });

  // Tab from the control before the row: its own remove button.
  await page.getByRole("button", { name: "移除" }).focus();
  await page.keyboard.press("Tab");
  await expect(a4).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await expect(letter).toHaveAttribute("aria-checked", "true");
  await expect(letter).toBeFocused();
  await expect(a4).toHaveAttribute("aria-checked", "false");

  await page.keyboard.press("ArrowRight");
  await expect(original).toHaveAttribute("aria-checked", "true");

  // The row wraps, so the last choice's ArrowRight is the first choice again.
  await page.keyboard.press("ArrowRight");
  await expect(a4).toHaveAttribute("aria-checked", "true");

  await page.keyboard.press("ArrowLeft");
  await expect(original).toHaveAttribute("aria-checked", "true");
});

/**
 * Orientation is not a control: each page takes its own image's. A mixed album
 * therefore becomes one document with both orientations, without a question.
 */
test("a mixed album keeps each page in its own image's orientation", async ({ page }) => {
  await open(page);

  const portrait = await jpeg(page.context());
  const landscape = await jpeg(page.context(), {
    height: 96,
    name: "landscape.jpg",
    width: 128,
  });

  await chooseFiles(page, [portrait, landscape]);
  await page.getByRole("button", { name: "转换" }).click();

  const pdf = await downloadPdf(page);
  expect(pdf.pageCount).toBe(2);
  expectBox(pdf.mediaBoxes[0], A4_PORTRAIT);
  expectBox(pdf.mediaBoxes[1], A4_LANDSCAPE);
});

/**
 * Three pages told apart by their image bytes, which the gate compares byte for
 * byte. The second is the only landscape one, so the media boxes pin its
 * position too; the first and the third differ in size as well, which is what
 * the miniatures draw.
 */
async function threePages(
  page: Page,
): Promise<{ first: NamedBytes; second: NamedBytes; third: NamedBytes }> {
  const context = page.context();

  return {
    first: await jpeg(context, { height: 128, name: "first.jpg", width: 96 }),
    second: await jpeg(context, { height: 96, name: "second.jpg", width: 128 }),
    third: await jpeg(context, { height: 96, name: "third.jpg", width: 64 }),
  };
}

/**
 * A control's centre, in viewport coordinates.
 *
 * The caller brings the list into the middle of the viewport first, because
 * `page.mouse` takes viewport coordinates and drops anything outside them
 * without a word (see the Gotchas in `AGENTS.md`), and the pinned result row can
 * sit over a row that was only scrolled to its edge. The point is hit-tested
 * before it is returned: a press at the handle's centre must resolve to the
 * handle, not to a wrapper, or a pointer drag is dead while the keyboard keeps
 * working. That is the assertion the hit-area class's placement exists for.
 */
async function centreOf(page: Page, control: Locator): Promise<{ x: number; y: number }> {
  const box = await control.boundingBox();
  if (box === null) throw new Error("the handle has no geometry to press");

  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const viewport = page.viewportSize();
  if (
    viewport !== null &&
    (point.x < 0 || point.y < 0 || point.x >= viewport.width || point.y >= viewport.height)
  ) {
    throw new Error(
      `the handle is at ${Math.round(point.x)},${Math.round(point.y)}, outside the ${viewport.width}×${viewport.height} viewport — a press there would be dropped, not failed`,
    );
  }

  const onHandle = await page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y);
    return hit !== null && hit.closest('button[aria-label="拖动排序"]') !== null;
  }, point);
  expect(
    onHandle,
    "the handle's centre is covered by something else, so a press would miss it",
  ).toBe(true);

  return point;
}

/** Bring a row to the middle of the viewport, so its neighbours are on screen too. */
async function centreRow(row: Locator): Promise<void> {
  await row.evaluate((element) => {
    element.scrollIntoView({ block: "center" });
  });
}

/** The three rows of a list whose pages were just chosen, in list order. */
function pageRows(page: Page): Locator {
  return page.locator('[data-slot="pdf-page-row"]');
}

/**
 * The keyboard reordering path, proved from the file that lands on disk.
 *
 * Focus the first row's handle, lift it with Space, walk it to the end with the
 * arrow keys, put it down with Space, and read the announcement dnd-kit's live
 * region spoke on the way. The document is converted before and after, so the
 * run also carries the invalidation a reorder owes: the first file is taken away
 * the moment the list changes, and the second one's page order is the new list
 * order rather than the old one.
 */
test("the keyboard lifts, moves and drops a page, and the document follows the list", async ({
  page,
}) => {
  await open(page);

  const { first, second, third } = await threePages(page);
  await chooseFiles(page, [first, second, third]);

  const rows = pageRows(page);
  const handles = page.getByRole("button", { name: "拖动排序" });
  await expect(rows).toHaveCount(3);
  await expect(handles).toHaveCount(3);

  /*
   * The instrument's contract, asserted here because this is the change that
   * could break it: one handle per row, a real button, the hit-area class on
   * the button itself, and one name for all of them. 移除 is the same shape and
   * is declared the same way, so it is read here too.
   */
  for (const handle of await handles.all()) {
    await expect(handle).toHaveClass(/\btouch-target\b/);
    await expect(handle).toHaveAttribute("aria-roledescription", "可排序页面");
  }
  const removes = page.getByRole("button", { name: "移除" });
  await expect(removes).toHaveCount(3);
  for (const remove of await removes.all()) {
    await expect(remove).toHaveClass(/\btouch-target\b/);
  }

  // A produced file exists before the reorder, so the invalidation below means
  // something: this run takes a real download away.
  await page.getByRole("button", { name: "转换" }).click();
  const before = await downloadPdf(page);
  expect(before.pageCount).toBe(3);
  expect(before.imageStreams[0]?.equals(first.buffer)).toBe(true);
  expect(before.imageStreams[1]?.equals(second.buffer)).toBe(true);
  expect(before.imageStreams[2]?.equals(third.buffer)).toBe(true);

  // Focus the first row's handle. The keyboard path starts where the pointer's
  // does, and the same accessible name is what a screen reader announces.
  await handles.nth(0).focus();
  await expect(handles.nth(0)).toBeFocused();

  const announcements = page.locator('[role="status"][aria-live="assertive"]');

  await page.keyboard.press("Space");
  await expect(announcements).toContainText("已拿起第 1 页，共 3 页。");
  // Lifting alone changes nothing: the list is still the old order.
  await expect(rows.nth(0)).toContainText("first.jpg");

  /*
   * One arrow press at a time, and the announcement is the wait: dnd-kit moves
   * the row to the next position it can see, so the next press has to arrive
   * after the previous move has been committed, and a screen-reader visitor
   * hears each position anyway. Asserting both makes the test say that.
   */
  await page.keyboard.press("ArrowDown");
  await expect(announcements).toContainText("第 1 页已移到第 2 位，共 3 页。");

  await page.keyboard.press("ArrowDown");
  await expect(announcements).toContainText("第 1 页已移到第 3 位，共 3 页。");

  await page.keyboard.press("Space");
  await expect(announcements).toContainText("已放下，第 1 页现在在第 3 位。");

  // The list is the order the keyboard chose, renumbered from the top.
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("second.jpg");
  await expect(rows.nth(0)).toContainText("第 1 页");
  await expect(rows.nth(1)).toContainText("third.jpg");
  await expect(rows.nth(1)).toContainText("第 2 页");
  await expect(rows.nth(2)).toContainText("first.jpg");
  await expect(rows.nth(2)).toContainText("第 3 页");

  // Reordering is a change to the document: the produced file is gone, with no
  // banner and no error, and 转换 is armed for the new order.
  await expect(page.locator("a[download]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "转换" })).toBeEnabled();

  await page.getByRole("button", { name: "转换" }).click();
  const after = await downloadPdf(page);

  // The document follows the list, read back from the downloaded file by a
  // second implementation: same page count, one image per page, and the pages
  // in the order the keyboard left them.
  expect(after.pageCount).toBe(3);
  expect(after.imagesPerPage).toEqual([1, 1, 1]);
  expect(after.imageStreams).toHaveLength(3);
  expect(after.imageStreams[0]?.equals(second.buffer)).toBe(true);
  expect(after.imageStreams[1]?.equals(third.buffer)).toBe(true);
  expect(after.imageStreams[2]?.equals(first.buffer)).toBe(true);

  // The shapes say it too: the landscape fixture is page one now, and the two
  // portrait fixtures follow it.
  expectBox(after.mediaBoxes[0], A4_LANDSCAPE);
  expectBox(after.mediaBoxes[1], A4_PORTRAIT);
  expectBox(after.mediaBoxes[2], A4_PORTRAIT);
});

/**
 * The pointer path, pressed at coordinates rather than dispatched at the
 * element, because that is the bug this repository has already paid for: an
 * overlay on a wrapper takes the click while the keyboard keeps working. The
 * drag is a real mouse down, a move and an up, and the download that follows is
 * the proof the document moved with the list.
 */
test("a pointer drag of a handle reorders the list, and the document follows it", async ({
  page,
}) => {
  await open(page);

  const { first, second, third } = await threePages(page);
  await chooseFiles(page, [first, second, third]);

  const rows = pageRows(page);
  const handles = page.getByRole("button", { name: "拖动排序" });
  await expect(rows).toHaveCount(3);

  // Bring the list into the middle first, so the first and last handles are
  // both on screen when the press begins; each point is hit-tested.
  await centreRow(rows.nth(2));
  const from = await centreOf(page, handles.nth(0));
  const to = await centreOf(page, handles.nth(2));

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + 8, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();

  // The list changed, which is what a pointer drag has to buy.
  await expect(rows.nth(0)).toContainText("second.jpg");
  await expect(rows.nth(1)).toContainText("third.jpg");
  await expect(rows.nth(2)).toContainText("first.jpg");

  /*
   * dnd-kit's pointer sensor keeps a document-level `click` suppressor for 50 ms
   * after a drop (`AbstractPointerSensor.detach` defers `documentListeners`
   * removal with `setTimeout`), because the click that ends a drag must not also
   * activate the handle. A press dispatched inside that window is swallowed
   * before React sees it, so this test would race the library: on a fast machine
   * the three assertions above resolve first and 转换 never runs. Wait out the
   * window explicitly rather than pressing a control that is briefly deaf.
   */
  await page.waitForTimeout(100);

  await page.getByRole("button", { name: "转换" }).click();
  const pdf = await downloadPdf(page);

  expect(pdf.pageCount).toBe(3);
  expect(pdf.imagesPerPage).toEqual([1, 1, 1]);
  expect(pdf.imageStreams).toHaveLength(3);
  expect(pdf.imageStreams[0]?.equals(second.buffer)).toBe(true);
  expect(pdf.imageStreams[1]?.equals(third.buffer)).toBe(true);
  expect(pdf.imageStreams[2]?.equals(first.buffer)).toBe(true);
  expectBox(pdf.mediaBoxes[0], A4_LANDSCAPE);
  expectBox(pdf.mediaBoxes[1], A4_PORTRAIT);
  expectBox(pdf.mediaBoxes[2], A4_PORTRAIT);
});

/**
 * Touch, on a context that has one.
 *
 * `page.mouse` cannot say "finger", so the gesture is dispatched as pointer
 * events with `pointerType: "touch"` at the handle's coordinates: down, a dozen
 * moves, up. The points go through `elementFromPoint`, so a touch that would
 * land on something other than the handle fails here rather than silently doing
 * nothing, and the list order is read back from the rows. What this cannot prove
 * is the browser's own gesture arbitration on a real phone (whether a finger
 * that starts on the handle scrolls the page instead), which is why the Tool's
 * README keeps that as a named manual item.
 */
test.describe("on a touch device", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("a touch drag of a handle reorders the list", async ({ page }) => {
    await open(page);

    const { first, second, third } = await threePages(page);
    await chooseFiles(page, [first, second, third]);

    const rows = pageRows(page);
    const handles = page.getByRole("button", { name: "拖动排序" });
    await expect(rows).toHaveCount(3);

    await centreRow(rows.nth(2));
    const from = await centreOf(page, handles.nth(0));
    const to = await centreOf(page, handles.nth(2));

    /*
     * The touch itself: pointer events with `pointerType: "touch"`, dispatched
     * at the handle's coordinates. Each phase is its own task, because a finger
     * delivers them one task at a time and dnd-kit computes its collisions
     * between them; dispatching the whole gesture inside one task tests a
     * sequence no device ever produces, and it does not reorder.
     */
    await page.evaluate(
      ({ x, y }) => {
        const target = document.elementFromPoint(x, y);
        if (target === null) throw new Error("nothing at the handle's point to start a touch on");

        target.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            button: 0,
            buttons: 1,
            cancelable: true,
            clientX: x,
            clientY: y,
            composed: true,
            isPrimary: true,
            pointerId: 1,
            pointerType: "touch",
          }),
        );
      },
      { x: from.x, y: from.y },
    );

    const announcements = page.locator('[role="status"][aria-live="assertive"]');
    await expect(announcements).toContainText("已拿起第 1 页");

    for (let step = 1; step <= 8; step += 1) {
      await page.evaluate(
        ({ x, y }) => {
          document.dispatchEvent(
            new PointerEvent("pointermove", {
              bubbles: true,
              button: 0,
              buttons: 1,
              cancelable: true,
              clientX: x,
              clientY: y,
              composed: true,
              isPrimary: true,
              pointerId: 1,
              pointerType: "touch",
            }),
          );
        },
        {
          x: from.x + ((to.x - from.x) * step) / 8,
          y: from.y + ((to.y - from.y) * step) / 8,
        },
      );
    }
    await expect(announcements).toContainText("第 1 页已移到第 3 位");

    await page.evaluate(
      ({ x, y }) => {
        document.dispatchEvent(
          new PointerEvent("pointerup", {
            bubbles: true,
            button: 0,
            buttons: 0,
            cancelable: true,
            clientX: x,
            clientY: y,
            composed: true,
            isPrimary: true,
            pointerId: 1,
            pointerType: "touch",
          }),
        );
      },
      { x: to.x, y: to.y },
    );

    await expect(rows.nth(0)).toContainText("second.jpg");
    await expect(rows.nth(1)).toContainText("third.jpg");
    await expect(rows.nth(2)).toContainText("first.jpg");
  });
});

/**
 * A PNG cannot go into a PDF the way a JPEG can, so the browser decodes it and
 * the writer takes the pixels. This test reads those pixels back out of the
 * downloaded file with `fflate`: the stream must be zlib (`/FlateDecode`, no
 * predictor), and the transparent half of the fixture must have become white
 * paper while the opaque half kept its own colour.
 *
 * It is deliberately the whole capability at the highest point: a real
 * transparent PNG through the page's own input, the page's action, a download,
 * and a second implementation decompressing it.
 */
test("a transparent PNG becomes a page whose pixels land on white paper", async ({ page }) => {
  await open(page);

  const png = await transparentPng(page.context());
  await chooseFiles(page, [png]);

  const rows = page.locator('[data-slot="pdf-page-row"]');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("第 1 页");

  await page.getByRole("button", { name: "转换" }).click();

  const pdf = await downloadPdf(page);
  expectValidPdf(pdf);

  // A 64x48 image is landscape, so A4 is used in its landscape orientation: the
  // decode path is a page, not a second geometry.
  expect(pdf.pageCount).toBe(1);
  expectBox(pdf.mediaBoxes[0], A4_LANDSCAPE);
  expect(pdf.imagesPerPage).toEqual([1]);

  // Exactly one image XObject, written as raw RGB samples through Flate, and no
  // predictor parameters anywhere in the file.
  expect(pdf.imageFilters).toEqual(["/FlateDecode"]);
  expect(pdf.bytes.toString("latin1")).not.toContain("/DecodeParms");

  const samples = unzlibSync(pdf.imageStreams[0]!);
  expect(samples).toHaveLength(64 * 48 * 3);

  const at = (x: number, y: number): number[] => [
    ...samples.subarray((y * 64 + x) * 3, (y * 64 + x) * 3 + 3),
  ];

  // (8, 24) and (56, 24) are the two halves' centres, 8px clear of the seam: the
  // transparent half is paper white, the opaque half is the red the fixture set.
  expect(at(8, 24)).toEqual([255, 255, 255]);
  expect(at(56, 24)).toEqual([255, 0, 0]);
});

/** A WebP is decoded like a PNG and becomes the same kind of page. */
test("a WebP becomes a page like any other", async ({ page }) => {
  await open(page);

  const photo = await webp(page.context());
  await chooseFiles(page, [photo]);

  const rows = page.locator('[data-slot="pdf-page-row"]');
  await expect(rows).toHaveCount(1);

  await page.getByRole("button", { name: "转换" }).click();

  const pdf = await downloadPdf(page);
  expectValidPdf(pdf);

  expect(pdf.pageCount).toBe(1);
  // Portrait 96x128 asks for portrait A4, the same box a JPEG of those
  // dimensions gets.
  expectBox(pdf.mediaBoxes[0], A4_PORTRAIT);
  expect(pdf.imagesPerPage).toEqual([1]);
  expect(pdf.imageFilters).toEqual(["/FlateDecode"]);

  // The stream is the decoded image's samples, not the WebP file's bytes.
  const samples = unzlibSync(pdf.imageStreams[0]!);
  expect(samples).toHaveLength(96 * 128 * 3);
  expect(pdf.imageStreams[0]?.equals(photo.buffer)).toBe(false);
});

/**
 * The pixel limit is the one limit bytes cannot express: this file is 29 bytes
 * and asks for 50 M pixels. It must be refused by the pure admission layer from
 * the `IHDR` alone — a page that let it through would be asking a decoder for a
 * canvas nothing downloaded, and the failure would arrive with a different
 * sentence, if at all.
 */
test("a PNG whose header claims more than 40 M pixels is refused at admission", async ({
  page,
}) => {
  await open(page);

  await chooseFiles(page, [hugeHeaderPng()]);

  // No row, no armed action: the file never became a page.
  await expect(page.locator('[data-slot="pdf-page-row"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "转换" })).toBeDisabled();

  // The refusal names the file and the limit, from the header alone.
  const refusalLines = page.locator('[data-slot="alert"] p');
  await expect(refusalLines).toHaveCount(1);
  await expect(refusalLines.first()).toContainText("panorama.png");
  await expect(refusalLines.first()).toContainText("这张图片超过 4000 万像素的上限，没有加入。");
});
