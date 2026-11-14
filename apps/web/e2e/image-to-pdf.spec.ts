import { expect, test, type Page } from "@playwright/test";
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
 * sniffer and do become rows, but their pages are written by the decode path
 * (#195), which the two tests at the end of this file drive on their own so a
 * failure names the format that broke.
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
