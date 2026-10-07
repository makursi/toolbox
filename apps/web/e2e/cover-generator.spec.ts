import type { Readable } from "node:stream";

import { expect, test, type BrowserContext, type CDPSession, type Page } from "@playwright/test";

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
    await page.locator(".cover-background-input").setInputFiles(background);

    // The background post-processing controls arrive with the background image:
    // blur and grayscale sliders, enabled now that a background exists. Drive
    // each a few steps so a non-zero value reaches the export. They live in
    // another section of the editor, so the tab has to be picked first (#91).
    await showSection(page, "样式");
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

    await showSection(page, "导出");
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

    // The scale control lives in the 导出 section, which the editor shows one at
    // a time (#91).
    await showSection(page, "导出");

    // Mantine's SegmentedControl is a visually hidden radio under a label whose
    // inner span carries the text; `getByText` resolves to that span, so the click
    // lands inside the label a visitor sees — the same click, and no strict-mode
    // clash between the input and the label.
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
    await page.locator(".cover-background-input").setInputFiles(background);

    await showSection(page, "样式");
    const blur = page.getByRole("slider", { name: "背景模糊" });
    await expect(blur).toBeEnabled();
    await blur.focus();
    await blur.press("ArrowRight");
    await blur.press("ArrowRight");
    // A native range carries its own value rather than an ARIA mirror of it, so
    // this reads the value since #128.
    await expect(blur).toHaveValue("2");

    // 清除 is 内容's, so the tab goes back before it can be pressed.
    await showSection(page, "内容");
    const clear = page.getByRole("button", { name: "清除" });
    await expect(clear).toBeVisible();
    await clear.click();

    await expect(clear).toBeHidden();

    // The slider 清除 reset lives in 样式, and an unpicked section is not in the DOM
    // (#91), so the tab comes first. What it reads is the composition's own value,
    // which switching tabs does not touch.
    await showSection(page, "样式");

    // Since #128 the slider is the platform's range input, and it behaves the
    // opposite way to the outgoing layer at exactly this point: a disabled range
    // keeps its place in the accessibility tree, so the role query still names it
    // and the element stays visible — greyed, not gone. The `sliderNode` helper the
    // old assertions needed (a direct selector, because a hidden thumb took the
    // `slider` role out of the tree with it) is gone with the mechanism.
    const disabledBlur = page.getByRole("slider", { name: "背景模糊" });
    await expect(disabledBlur).toBeVisible();
    await expect(disabledBlur).toBeDisabled();
    await expect(disabledBlur).toHaveValue("0");
  });

  /*
   * #128: a switch's pointer behaviour, proved at coordinates rather than with the
   * keyboard.
   *
   * The trap this guards is the shape this repo already paid for once — a control
   * whose toggle lives on an inner input, with an inert wrapper between it and the
   * row. `.touch-target`'s overlay belongs to the element it is generated on, so
   * the class on such a wrapper eats the pointer while the keyboard keeps working,
   * and a keyboard-only check cannot see it. The press is therefore aimed *inside
   * the overlay and outside the switch's own box*: only an overlay that belongs to
   * the element owning the click can answer there. The point is measured after
   * scrolling the control into view and asserted to be inside the viewport,
   * because `page.mouse.click` drops a coordinate outside it without a word.
   */
  test("the 样式 section's switches answer a pointer, not only a key", async ({ page }) => {
    await open(page, COVER_PATH);
    await showSection(page, "样式");

    const sync = page.getByRole("switch", { name: "颜色同步" });
    const iconColor = page.getByLabel("图标颜色");
    await expect(sync).toBeChecked();
    await expect(iconColor).toBeDisabled();

    await sync.scrollIntoViewIfNeeded();
    const box = await sync.boundingBox();
    if (box === null) throw new Error("the 颜色同步 switch has no geometry to press");

    // Twelve pixels above the centre: the switch is 18px tall, the overlay is 46.
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 - 12 };
    const viewport = page.viewportSize();
    if (
      viewport !== null &&
      (point.x < 0 || point.y < 0 || point.x >= viewport.width || point.y >= viewport.height)
    ) {
      throw new Error(
        `the switch is at ${Math.round(point.x)},${Math.round(point.y)}, outside the ${viewport.width}×${viewport.height} viewport — a press there would be dropped, not failed`,
      );
    }

    await page.mouse.click(point.x, point.y);

    await expect(sync).not.toBeChecked();
    await expect(iconColor).toBeEnabled();
  });

  /*
   * #172: a slider answers a touch drag, not only the keyboard.
   *
   * What was wrong was not the gesture but the target: `.touch-target`'s overlay is
   * painted above the UA's own thumb, and Chromium starts a range drag only when the
   * touch hits the *thumb* — a touch on the track does nothing, while a mouse press on
   * the track moves the value, which is the asymmetry that hid this. With the overlay
   * in the way there was nothing to drag, so the browser scrolled the page instead:
   * the report's symptom. `globals.css` takes the overlay out of hit testing, and
   * *deliberately* leaves `touch-action` alone — the first attempt at this bug set
   * `touch-action: none` on the element, which was not what restored the drag (this
   * spec is green without it) and cost the visitor the ability to scroll over the
   * slider's own track (415px of scroll became 0). Both halves are asserted below.
   *
   * The drag is driven at coordinates through real touch events, the way the switch
   * test above drives a pointer press: Playwright's `touchscreen` only exposes `tap`,
   * so the move between the press and the release is sent through the CDP
   * `Input.dispatchTouchEvent` channel the tap itself uses — the same browser input
   * pipeline a finger reaches, which is what moves a *native* thumb where a synthetic
   * DOM event would not. The release point is asserted to stay inside the viewport
   * for the same reason the switch's point is: a touch that lands nowhere is dropped,
   * not failed.
   */
  test.describe("on a touch screen", () => {
    test.use({ hasTouch: true, viewport: { width: 375, height: 667 } });

    test("a slider follows a touch drag without scrolling the page", async ({ page }) => {
      test.skip(
        page.context().browser()?.browserType().name() !== "chromium",
        "the touch drag is sent through the Chromium CDP input channel",
      );

      await open(page, COVER_PATH);
      await showSection(page, "样式");

      // 字体大小: 16–256, starting at 64 — the value the drag must move off.
      const slider = page.getByRole("slider", { name: "字体大小" });
      await expect(slider).toHaveValue("64");

      await slider.scrollIntoViewIfNeeded();
      const box = await slider.boundingBox();
      if (box === null) throw new Error("the 字体大小 slider has no geometry to drag");

      // The press has to land on the thumb, and the thumb is not at the value's share
      // of the box: the browser keeps the whole thumb on the track, so its centre is
      // inset by half the thumb's own width at each end — 12px of the 24 this site
      // draws (`globals.css`) — and then takes the value's share of what is left. 64
      // of 16–256 is 20%. Pressing at 20% of the box misses the thumb by 7px at this
      // width, which is why the inset is derived rather than assumed.
      const THUMB = 24;
      const start = {
        x: box.x + THUMB / 2 + 0.2 * (box.width - THUMB),
        y: box.y + box.height / 2,
      };
      // Diagonal on purpose: a finger is never exactly horizontal, and the vertical
      // component is what let a scroll steal the gesture in the report.
      const end = { x: start.x + 80, y: start.y - 60 };
      const viewport = page.viewportSize();
      if (
        viewport !== null &&
        (end.x < 0 || end.y < 0 || end.x >= viewport.width || end.y >= viewport.height)
      ) {
        throw new Error(
          `the drag ends at ${Math.round(end.x)},${Math.round(end.y)}, outside the ${viewport.width}×${viewport.height} viewport — a touch there would be dropped, not failed`,
        );
      }

      // The scroll position the drag must not move: the slider was scrolled into
      // view above, and `scrollIntoViewIfNeeded` may itself scroll the page, so
      // "no scroll" means "unchanged by the drag", not "at the very top".
      const scrollYBefore = await page.evaluate(() => window.scrollY);

      const session = await page.context().newCDPSession(page);
      await touchDrag(session, start, end);

      await expect(slider).not.toHaveValue("64");
      await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(scrollYBefore);
    });

    /*
     * The other half of the rule, and the half `touch-action: none` would have taken
     * away: a touch that starts on the track — not the thumb, and not a drag handle —
     * is the page's to use, so it scrolls. #172's fourth user story says exactly that,
     * and the first attempt at the fix broke it: with `touch-action: none` on the
     * element, the same gesture moved the page 0px instead of 415.
     */
    test("a touch on the track still scrolls the page", async ({ page }) => {
      test.skip(
        page.context().browser()?.browserType().name() !== "chromium",
        "the touch drag is sent through the Chromium CDP input channel",
      );

      await open(page, COVER_PATH);
      await showSection(page, "样式");

      const slider = page.getByRole("slider", { name: "字体大小" });
      await slider.scrollIntoViewIfNeeded();
      const box = await slider.boundingBox();
      if (box === null) throw new Error("the 字体大小 slider has no geometry to scroll from");

      // The far end of the track: 64 of 16–256 puts the thumb at 20%, so the last
      // 12px before the input's edge is track and nothing else.
      const start = { x: box.x + box.width - 12, y: box.y + box.height / 2 };
      const end = { x: start.x - 20, y: start.y - 120 };
      const viewport = page.viewportSize();
      if (
        viewport !== null &&
        (end.x < 0 || end.y < 0 || end.x >= viewport.width || end.y >= viewport.height)
      ) {
        throw new Error(
          `the drag ends at ${Math.round(end.x)},${Math.round(end.y)}, outside the ${viewport.width}×${viewport.height} viewport — a touch there would be dropped, not failed`,
        );
      }

      const scrollYBefore = await page.evaluate(() => window.scrollY);

      const session = await page.context().newCDPSession(page);
      await touchDrag(session, start, end);

      // A finger dragged up moves the page down, and at this width the page has
      // content below the settings panel. The track answers the press itself — the
      // platform moves the thumb to where it was touched, the same as a mouse press —
      // but the *gesture* is still the page's, which is what `touch-action: none` took
      // away and what this asserts.
      await expect
        .poll(async () => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(scrollYBefore);
    });
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

    // Since #130 the picker is the registry's own searchable list: a read-only input
    // that opens a `Command` of filtered families. Its name is the `<label for>` the
    // panel draws, so the role query names the control itself and not a listbox —
    // the same shape the outgoing layer's `Select` had, reached differently.
    const picker = page.getByRole("combobox", { name: "系统字体" });
    await expect(picker).toBeDisabled();
    await expect(picker).toHaveAttribute("placeholder", "先获取系统字体");
    // A disabled control says which step is missing (`apps/web/docs/design/components.md`),
    // in the panel's own words rather than in a tooltip — one line at the editor
    // column's 320px, which the wording was shortened to fit.
    await expect(page.getByText("还没读取系统字体，先按「获取系统字体」。")).toBeVisible();

    await context.grantPermissions(["local-fonts"]);
    await page.getByRole("button", { name: "获取系统字体" }).click();
    await expect(picker).toBeEnabled();

    // The trigger displays the choice; the field that gets typed into is the search
    // inside the popover, and it takes the focus when the list opens.
    await picker.click();
    const search = page.getByPlaceholder("搜索字体");
    await expect(search).toBeFocused();

    // The dropdown opens with the whole list; the query is what decides what
    // survives it.
    const options = page.getByRole("option");
    await expect(options.first()).toBeVisible();
    const all = await options.allInnerTexts();

    // A query that matches nothing is what makes the filter decisive: with the
    // filtering deleted, the whole list would still be rendered and the Tool's own
    // 「没有匹配的字体」 would never appear.
    await search.fill("zzzz");
    await expect(page.getByText("没有匹配的字体")).toBeVisible();

    // A query that matches something leaves only names carrying it — and fewer of
    // them than the full list. The query is the first family's own prefix, so it
    // cannot be one this machine has no font for.
    const query = (all[0] ?? "").trim().slice(0, 3);
    await search.fill(query);
    await expect(options.first()).toBeVisible();
    const names = await options.allInnerTexts();
    for (const name of names) expect(name.toLowerCase()).toContain(query.toLowerCase());
    expect(names.length, "filtering left the whole list in place").toBeLessThan(all.length);

    const chosen = names[0]?.trim() ?? "";
    await options.first().click();
    await expect(picker).toHaveValue(chosen);
    await expect(page.getByRole("listbox")).toBeHidden();
  });

  /*
   * #130: the icon search, and the waiting discipline it needs.
   *
   * The icon set is a lazily imported chunk, so before it lands the result list is
   * empty for *every* query — which makes "no matches" the state the page is in on
   * load. A test that waits for that passes before React has rendered anything,
   * which is the recorded failure mode ("wait for a state transition, not for an
   * absence"). So the transition comes first: a query that matches something has to
   * produce rows, and only then does the empty state mean the filter ran.
   */
  test("the icon search settles before its result is asserted", async ({ page }) => {
    await open(page, COVER_PATH);
    const search = page.getByLabel("搜索图标");

    await search.fill("image");
    await expect(page.getByRole("button", { name: "image", exact: true })).toBeVisible();

    await search.fill("zzzzzz");
    await expect(page.getByText("没有匹配的图标。")).toBeVisible();
    await expect(page.getByRole("button", { name: "image", exact: true })).toHaveCount(0);
  });

  /*
   * #91: the three sections are a tab row, and only the picked one is on the page.
   * This is the claim the gate owns — that picking a tab does what it looks like it
   * does. How the row is drawn, and how big its targets are, belong to the
   * instrument (`docs/adr/0012-playwright-for-the-browser-gate.md`).
   */
  test("shows one section at a time, and only that one", async ({ page }) => {
    await open(page, COVER_PATH);

    await expect(page.getByRole("tab")).toHaveCount(3);
    await expect(page.getByRole("tab", { name: "内容" })).toHaveAttribute("aria-selected", "true");

    // 内容 first, with the other two not merely hidden but absent: a section left in
    // the DOM would let the row look switched while the old panel is still what a
    // pointer reaches.
    await expect(page.getByLabel("左侧文字")).toBeVisible();
    await expect(page.getByRole("button", { name: "获取系统字体" })).toBeVisible();
    await expect(page.getByRole("slider", { name: "字体大小" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "下载 16:9" })).toHaveCount(0);

    await showSection(page, "样式");
    await expect(page.getByRole("tab", { name: "样式" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("slider", { name: "字体大小" })).toBeVisible();
    await expect(page.getByLabel("左侧文字")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "下载 16:9" })).toHaveCount(0);

    await showSection(page, "导出");
    await expect(page.getByRole("button", { name: "下载 16:9" })).toBeVisible();
    await expect(page.getByRole("slider", { name: "字体大小" })).toHaveCount(0);
    await expect(page.getByLabel("左侧文字")).toHaveCount(0);

    // The keyboard model the row inherits from the library: an arrow key moves
    // along the row instead of walking into the panel.
    await page.getByRole("tab", { name: "导出" }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("tab", { name: "样式" })).toBeFocused();
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

/**
 * Bring one of the editor's sections into view.
 *
 * The configuration column is a tab row whose unpicked panels are not mounted
 * (#91), so a control from another section is not merely hidden: it is not on the
 * page at all until its tab is picked. One line, and it stays one line because
 * Playwright settles the action itself — the click waits for the tab to be
 * actionable and every `expect` after it waits for the state it asserts. The
 * instrument had to write its own wait for the same click only because plain CDP
 * has no such waiting.
 */
async function showSection(page: Page, name: "内容" | "样式" | "导出") {
  await page.getByRole("tab", { name }).click();
}

/**
 * Drag a finger from `start` to `end` through the browser's touch input channel.
 *
 * Playwright's public touchscreen exposes only `tap`, so the move a drag needs is
 * sent over the same CDP `Input.dispatchTouchEvent` channel the tap uses — a
 * `touchStart` at the press point, a few interpolated `touchMove`s along the way,
 * and a `touchEnd` at the release. That channel is what reaches a native
 * `input[type=range]` thumb, where a synthetic DOM event dispatched on the element
 * would fire its listeners but never move the browser-drawn control.
 *
 * The few moves rather than one matter: the native slider samples the drag as it
 * goes, and a single jump reads as a tap at the release point, not a drag.
 */
async function touchDrag(
  session: CDPSession,
  start: { x: number; y: number },
  end: { x: number; y: number },
): Promise<void> {
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: start.x, y: start.y }],
  });
  for (const step of [1, 2, 3, 4]) {
    const fraction = step / 4;
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: start.x + (end.x - start.x) * fraction,
          y: start.y + (end.y - start.y) * fraction,
        },
      ],
    });
  }
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}
