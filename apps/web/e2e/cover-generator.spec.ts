import { expect, test, type BrowserContext } from "@playwright/test";
import type { Readable } from "node:stream";

import { open } from "./tool-page";

/** The Tool these specs drive. */
const COVER_PATH = "/tools/cover-generator";

/**
 * The full cover flow, at the gate's seam: a real browser against the
 * production build, writing both texts, picking a library icon, dropping a
 * background image, downloading the PNG and asserting the bytes are a valid
 * 1280×720 PNG named by the rule — with the no-outbound and zero-console
 * assertions that belong to this Tool's page just like the converter's.
 *
 * This spec has been seen red once (see `apps/web/docs/design/log.md`): the
 * filename assertion first expected `16-9-示例文本.png` and the flow returned
 * `16-9-新品发布此刻.png`, which is the rule doing its job. The gate can fail.
 */
test.describe("the cover generator", () => {
  test("composes a cover and downloads a valid PNG, touching nothing off this origin", async ({
    page,
    baseURL,
  }) => {
    if (baseURL === undefined) throw new Error("the config sets no baseURL to compare against");
    const origin = new URL(baseURL).origin;

    const offSite: string[] = [];
    const noise: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      // `blob:` is this page's own exports and uploads; `data:` is the icons
      // compiled in at build time.
      if (url.origin === origin || url.protocol === "blob:" || url.protocol === "data:") return;
      offSite.push(request.url());
    });
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        noise.push(`${message.type()}: ${message.text()}`);
      }
    });

    await open(page, COVER_PATH);

    await page.getByLabel("左侧文字").fill("新品发布");
    await page.getByLabel("右侧文字").fill("此刻");

    await page.getByLabel("搜索图标").fill("image");
    await page.getByRole("button", { name: "image", exact: true }).click();

    const background = await solidPng(page.context(), "#00aa88");
    await page.locator(".mantine-Dropzone-root input[type=file]").setInputFiles(background);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载 16:9" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("16-9-新品发布此刻.png");

    const header = await readPngHeader(await download.createReadStream());
    expect(header.signature).toBe(true);
    expect([header.width, header.height]).toEqual([1280, 720]);

    expect(offSite, "requests off this origin").toEqual([]);
    expect(noise, "console errors and warnings").toEqual([]);
  });
});

/** A solid-colour PNG built by the browser, named like the visitor's file would be. */
async function solidPng(context: BrowserContext, fill: string) {
  const builder = await context.newPage();
  try {
    const dataUrl = await builder.evaluate((color) => {
      const canvas = document.createElement("canvas");
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext("2d");
      if (ctx === null) throw new Error("no 2d context");
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 200, 200);
      return canvas.toDataURL("image/png");
    }, fill);
    return {
      name: "background.png",
      mimeType: "image/png",
      buffer: Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"),
    };
  } finally {
    await builder.close();
  }
}

/** The PNG signature and the size from the IHDR chunk, read off the stream. */
async function readPngHeader(stream: Readable) {
  const bytes = await new Promise<Buffer>((resolve, reject) => {
    const parts: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => parts.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(parts).subarray(0, 32)));
    stream.on("error", reject);
  });
  const signature = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return {
    signature,
    width: bytes.length >= 24 ? bytes.readUInt32BE(16) : 0,
    height: bytes.length >= 24 ? bytes.readUInt32BE(20) : 0,
  };
}