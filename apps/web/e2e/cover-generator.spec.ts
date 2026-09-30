import type { Readable } from "node:stream";

import { expect, test, type BrowserContext } from "@playwright/test";

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

    // The background post-processing controls arrive with the background image:
    // blur and grayscale sliders, enabled now that a background exists. Drive
    // each a few steps so a non-zero value reaches the export.
    const blur = page.getByRole("slider", { name: "背景模糊" });
    const grayscale = page.getByRole("slider", { name: "背景灰度" });
    await expect(blur).toBeEnabled();
    await expect(grayscale).toBeEnabled();
    await blur.focus();
    await blur.press("ArrowRight");
    await blur.press("ArrowRight");
    await grayscale.focus();
    await grayscale.press("ArrowRight");
    await grayscale.press("ArrowRight");
    await grayscale.press("ArrowRight");

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

  /*
   * #75: the scale is an export-only decision. What a visitor can check without
   * a pixel diff is the name the file lands under and the size in its IHDR, plus
   * the preview's own caption — which shows the base ratio and must not follow
   * the scale.
   */
  test("exports at the chosen scale, naming and sizing the file for it", async ({ page }) => {
    await open(page, COVER_PATH);

    await page.getByLabel("左侧文字").fill("新品发布");
    await page.getByLabel("右侧文字").fill("此刻");
    await expect(page.getByText("16:9 · 1280×720")).toBeVisible();

    // Mantine's SegmentedControl puts a visually hidden radio under a visible
    // label; the label is what a visitor clicks, and what a real click has to
    // land on here.
    await page.getByText("2x", { exact: true }).click();

    // Still the base ratio's pixels: the scale only reaches the exported file.
    await expect(page.getByText("16:9 · 1280×720")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载 16:9 @2x" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("16-9-新品发布此刻@2x.png");

    const header = await readPngHeader(await download.createReadStream());
    expect(header.signature).toBe(true);
    expect([header.width, header.height]).toEqual([2560, 1440]);
  });

  /* #73: 清除 takes the background and the post-processing that came with it. */
  test("clears the background and resets the post-processing it enabled", async ({ page }) => {
    await open(page, COVER_PATH);

    const background = await solidPng(page.context(), "#00aa88");
    await page.locator(".mantine-Dropzone-root input[type=file]").setInputFiles(background);

    const blur = page.getByRole("slider", { name: "背景模糊" });
    await expect(blur).toBeEnabled();
    await blur.focus();
    await blur.press("ArrowRight");
    await blur.press("ArrowRight");
    await expect(blur).toHaveAttribute("aria-valuenow", "2");

    const clear = page.getByRole("button", { name: "清除" });
    await expect(clear).toBeVisible();
    await clear.click();

    await expect(clear).toBeHidden();

    // Mantine takes a disabled slider's thumb out of the layout (`display: none`
    // in its own stylesheet), so the `slider` role leaves with it and a role
    // query can no longer name the control. The element is still there carrying
    // its aria state — and the track stays visible, greyed.
    const disabledBlur = page.locator('[role=slider][aria-label="背景模糊"]');
    await expect(disabledBlur).toHaveAttribute("aria-disabled", "true");
    await expect(disabledBlur).toHaveAttribute("aria-valuenow", "0");
  });

  /*
   * #78: the picker is disabled until 获取系统字体 is pressed, and reading the
   * machine's fonts needs a permission this browser has to be granted — the one
   * thing the gate can arrange and a visitor cannot. Without the grant the
   * promise never settles in headless Chrome (no prompt to answer), so the
   * refusal sentence is held by its unit test in `core/hints.ts` and the gate
   * drives the path that ends in a list.
   */
  test("lists the machine's fonts once asked, and filters and applies them", async ({
    page,
    context,
  }) => {
    await open(page, COVER_PATH);

    // `getByLabel` also reaches the Select's own listbox, which Mantine labels
    // with the input's id; the combobox role names the control itself.
    const picker = page.getByRole("combobox", { name: "系统字体" });
    await expect(picker).toBeDisabled();
    await expect(picker).toHaveAttribute("placeholder", "先获取系统字体");

    await context.grantPermissions(["local-fonts"]);
    await page.getByRole("button", { name: "获取系统字体" }).click();
    await expect(picker).toBeEnabled();

    // Typing filters by case-insensitive substring, so every name left in the
    // dropdown carries the query — and picking one applies it and collapses.
    await picker.click();
    await picker.fill("a");
    const options = page.getByRole("option");
    await expect(options.first()).toBeVisible();
    const names = await options.allInnerTexts();
    expect(names.length, "the machine listed no fonts at all").toBeGreaterThan(0);
    for (const name of names) expect(name.toLowerCase()).toContain("a");

    const chosen = names[0]?.trim() ?? "";
    await options.first().click();
    await expect(picker).toHaveValue(chosen);
    await expect(page.getByRole("listbox")).toBeHidden();
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
  const signature = bytes
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return {
    signature,
    width: bytes.length >= 24 ? bytes.readUInt32BE(16) : 0,
    height: bytes.length >= 24 ? bytes.readUInt32BE(20) : 0,
  };
}
