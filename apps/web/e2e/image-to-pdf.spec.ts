import { expect, test } from "@playwright/test";

import {
  chooseFiles,
  inspectDownloadedPdf,
  open,
  portraitJpeg,
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
