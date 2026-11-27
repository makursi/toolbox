import { expect, test, type Page } from "@playwright/test";

import {
  chooseFiles,
  inspectDownloadedPdf,
  jpeg,
  open as openImageToPdf,
  transparentPng,
} from "./image-to-pdf-page";
import {
  downloadFromFileMenu,
  open as openRichTextEditor,
  pressAt,
  saveStatus,
  selectBodyText,
  toolbarControl,
  writeInBody,
  writeInTitle,
} from "./rich-text-editor-page";
import { convertInEveryFormat } from "./tool-page";

/**
 * The homepage promises "No accounts, no uploads", and ADR 0005 enforces it with
 * a CSP rather than with review discipline: `connect-src 'self'` makes a future
 * analytics script, telemetry beacon or third-party error reporter fail in the
 * browser instead of shipping quietly.
 *
 * This is the other half of that decision. The policy stops a request that is
 * *forbidden*; it says nothing about one that is merely unexpected — a font, an
 * icon set or a codec fetched from a CDN would be blocked by `img-src`/`font-src`
 * only if it is one of those, and a `.wasm` from a CDN would simply be allowed to
 * fail. Watching the requests themselves is what makes "nothing is loaded from a
 * third party" a fact about the page rather than a reading of the header.
 *
 * Every Tool that lands is held to the same rule by this file, which is the
 * spec's own instruction for Image to PDF (#191): extend the existing check to
 * this page rather than duplicate it. The listener below is the one definition
 * of "off this origin" for every page; each test drives its own Tool through
 * that Tool's page helper.
 */

type Watched = { offSite: string[]; noise: string[]; crashes: string[] };

/**
 * Watch one page for anything that leaves this origin or says something in the
 * console.
 *
 * Attached before the navigation, because a request made by the first paint is
 * exactly the one a later listener would miss.
 */
function watch(page: Page, origin: string): Watched {
  const offSite: string[] = [];
  const noise: string[] = [];
  const crashes: string[] = [];

  page.on("request", (request) => {
    const url = new URL(request.url());
    // `blob:` is the Tool's own Worker and its own outputs, both minted in this
    // tab; `data:` is the icons, compiled in at build time.
    if (url.origin === origin || url.protocol === "blob:" || url.protocol === "data:") return;
    offSite.push(request.url());
  });

  page.on("console", (message) => {
    // Warnings too: the CSP reports a violation at that level, and a page that
    // logs one is a page where the policy did something nobody was watching.
    if (message.type() === "error" || message.type() === "warning") {
      noise.push(`${message.type()}: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => crashes.push(error.message));

  return { offSite, noise, crashes };
}

function originOf(baseURL: string | undefined): string {
  if (baseURL === undefined) throw new Error("the config sets no baseURL to compare against");

  return new URL(baseURL).origin;
}

test("a conversion reaches nothing off this origin, and prints nothing", async ({
  page,
  baseURL,
}) => {
  const watched = watch(page, originOf(baseURL));

  // Every format is converted on purpose: each codec's WebAssembly module is a
  // separate file, and it is exactly the ones a single-target run would not touch
  // that could quietly come from somewhere else.
  await convertInEveryFormat(page);

  // A run that converted nothing cannot say anything about what it requested, and
  // would pass every assertion below. That is the one way this check can lie.
  await expect(page.getByText("已生成 5 个文件", { exact: false })).toBeVisible();

  expect(watched.offSite, "requests off this origin").toEqual([]);
  expect(watched.noise, "console errors and warnings").toEqual([]);
  expect(watched.crashes, "uncaught errors and unhandled rejections").toEqual([]);
});

/**
 * The Image to PDF page, held to the same rule (#191).
 *
 * One conversion covers both writer paths — a JPEG goes into the PDF with its
 * original bytes, and a PNG is decoded by the Worker — so the run touches the
 * Worker, the transfer and the download rather than only the input region.
 */
test("the Image to PDF conversion reaches nothing off this origin, and prints nothing", async ({
  page,
  baseURL,
}) => {
  const watched = watch(page, originOf(baseURL));

  await openImageToPdf(page);

  // Built in pages of their own, as every Image to PDF fixture is, so the file
  // is real and the page about to upload it is the page being watched.
  const photo = await jpeg(page.context());
  const picture = await transparentPng(page.context());
  await chooseFiles(page, [photo, picture]);
  await expect(page.locator('[data-slot="pdf-page-row"]')).toHaveCount(2);

  await page.getByRole("button", { name: "转换" }).click();

  const link = page.locator("a[download]");
  await expect(link).toBeVisible();

  // Waiting for the download, not only for the link: a link whose blob holds
  // nothing would still satisfy every collection assertion below.
  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  const path = await download.path();
  if (path === null) throw new Error("the download produced no file to read");

  // The second implementation reads the file back, so "a conversion really
  // happened" is a fact about the bytes rather than about the page's own state.
  const pdf = await inspectDownloadedPdf(path);
  expect(pdf.pageCount, "a PDF was really built from the two picked images").toBe(2);

  expect(watched.offSite, "requests off this origin").toEqual([]);
  expect(watched.noise, "console errors and warnings").toEqual([]);
  expect(watched.crashes, "uncaught errors and unhandled rejections").toEqual([]);
});

/**
 * The Rich Text Editor's page, held to the same rule (#206, extended by #209 and
 * #210).
 *
 * Typing drives the editor and the draft's own write, and since #210 so does
 * exporting: the editor is a third-party tree mounted into this document, the
 * draft is IndexedDB, and the export builds a blob and hands it to the browser's
 * downloader. The run therefore types, selects and formats, awaits the save
 * status, and downloads both formats before it asserts — a page that asked a
 * server for anything would have to do it on one of those paths, and the export
 * is the one that could plausibly want to. The save status is awaited rather than
 * assumed, because a write that happened after the listener had been torn down
 * would be a request nobody watched. Import extends this same test when its slice
 * lands.
 */
test("the Rich Text Editor reaches nothing off this origin, and prints nothing", async ({
  page,
  baseURL,
}) => {
  const watched = watch(page, originOf(baseURL));

  await openRichTextEditor(page);
  await writeInTitle(page, "本地文档");
  await writeInBody(page, "写一句，看看这一页会不会向外请求。");
  await expect(page.getByRole("textbox", { name: "文档内容" })).toContainText("写一句");
  await expect(saveStatus(page)).toHaveText("已保存到本机");

  await selectBodyText(page);
  await pressAt(page, toolbarControl(page, "加粗"));

  // The path is awaited, not only the download event: a download that never
  // finished would have exercised the click and not the bytes.
  expect(await (await downloadFromFileMenu(page, "导出 Markdown")).path()).not.toBeNull();
  expect(await (await downloadFromFileMenu(page, "导出 HTML")).path()).not.toBeNull();

  expect(watched.offSite, "requests off this origin").toEqual([]);
  expect(watched.noise, "console errors and warnings").toEqual([]);
  expect(watched.crashes, "uncaught errors and unhandled rejections").toEqual([]);
});
