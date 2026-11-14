import { expect, test, type Page } from "@playwright/test";

import {
  chooseFiles,
  inspectDownloadedPdf,
  open,
  portraitJpeg,
  todayPdfName,
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

test("one JPEG becomes a one-page A4 PDF the site wrote itself", async ({ page }) => {
  await open(page);

  // The empty state: the action is unavailable and says why, which is the
  // control's own rule rather than a silent dead button.
  const convert = page.getByRole("button", { name: "转换" });
  await expect(convert).toBeDisabled();
  await expect(page.getByText("还没有图片，先选择一张。")).toBeVisible();

  const jpeg = await portraitJpeg(page.context());
  await chooseFiles(page, [jpeg]);

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
  expect(pdf.imageStreams[0]?.equals(jpeg.buffer)).toBe(true);
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

  const jpeg = await portraitJpeg(page.context());
  await chooseFiles(page, [jpeg]);
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

  const jpeg = await portraitJpeg(page.context());
  await chooseFiles(page, [jpeg]);

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

  const portrait = await portraitJpeg(page.context());
  const landscape = await portraitJpeg(page.context(), {
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
