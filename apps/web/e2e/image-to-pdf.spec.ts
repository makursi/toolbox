import { expect, test } from "@playwright/test";

import {
  avifFile,
  chooseFiles,
  dropFiles,
  gifFile,
  inspectDownloadedPdf,
  jpeg,
  open,
  renamedTextFile,
  todayPdfName,
} from "./image-to-pdf-page";

/**
 * The Tool's promise at the highest point a machine can reach: a real JPEG goes
 * in through the page's own file input, the page's single action builds the
 * document, and the file that lands on disk is read back by a second PDF
 * implementation.
 *
 * What this proves is the structure a reader needs — a preamble, a page tree
 * with one page on A4 in the image's orientation, one image XObject per page,
 * and the original JPEG bytes inside the stream. What it cannot prove is that a
 * reader *draws* it: that stays in the Tool's README as a manual item.
 */
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
