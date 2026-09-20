import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";

/**
 * How the specs drive the Image Converter.
 *
 * Everything here is a page-level action or a page-level reading, because that
 * is the seam these specs sit at: a real browser, the production build, the
 * controls a visitor sees. Nothing reaches into React state or into a module.
 */

/** The Tool these specs drive. */
export const TOOL_PATH = "/tools/image-converter";

/**
 * The five formats the UI offers, in the order it offers them.
 *
 * Spelled out rather than read from `core/formats.ts`: that table is the other
 * side of this assertion, and an expectation derived from the code under test
 * would agree with it whether or not it is right.
 */
export const FORMAT_LABELS = [
  "PNG (.png)",
  "JPEG (.jpg)",
  "WebP (.webp)",
  "AVIF (.avif)",
  "BMP (.bmp)",
];

/** The format that starts on, and so the one a fresh page already has a target for. */
export const STARTS_ON = "WebP (.webp)";

/**
 * Open a page and wait until React has claimed it.
 *
 * `next start` serves prerendered markup, so every locator below resolves before
 * hydration, and a control that has not hydrated looks exactly like one that
 * has. The first click is what tells them apart, and a lost click is silent —
 * the very failure this gate exists to catch — so the wait has to be real rather
 * than a sleep that has to guess (the CDP instruments sleep 1800ms for the same
 * reason, and are wrong in both directions).
 *
 * The signal is React's own bookkeeping on a host element, attached during
 * hydration and impossible in server HTML. That is an implementation detail of
 * React rather than of this site, which is what makes it acceptable as a wait —
 * it would not be acceptable as an assertion.
 */
export async function open(page: Page, path: string = TOOL_PATH): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() =>
    [...document.querySelectorAll("body *")].some((element) =>
      Object.keys(element).some((key) => key.startsWith("__reactFiber")),
    ),
  );
}

/** The card that holds one format row — the element that carries `data-checked`. */
export function formatCard(page: Page, label: string): Locator {
  return page.locator(".format-card", { hasText: label });
}

/** Whether the card for `label` says the format is on. */
export async function isFormatOn(page: Page, label: string): Promise<boolean> {
  return (await formatCard(page, label).getAttribute("data-checked")) === "true";
}

/**
 * Assert whether `label` is on.
 *
 * The card's `data-checked` rather than the input's `checked` on purpose: the
 * attribute is written from React state, so it cannot be flipped by the
 * browser's own default action on an input whose handlers are not attached yet.
 * Asserting the input alone would go green on a page that is not listening.
 */
export async function expectFormat(page: Page, label: string, on: boolean): Promise<void> {
  const card = formatCard(page, label);
  await expect(card).toBeVisible();

  if (on) await expect(card).toHaveAttribute("data-checked", "true");
  else await expect(card).not.toHaveAttribute("data-checked", "true");
}

export type Point = { x: number; y: number };

/**
 * The three places the Tool's manual checklist names, in its words.
 *
 * Taken from the geometry the page has right now rather than from constants,
 * because the point of the check is that the row answers *where it is drawn*:
 * the box beside the words, the words, and the lower edge of the label — that
 * last one is what the 44px stretch buys and what a clipped overlay loses first.
 */
export const ROW_PARTS = ["the box", "the words", "the label's lower edge"] as const;

export type RowPart = (typeof ROW_PARTS)[number];

/**
 * One point on a row, measured after bringing the row into view.
 *
 * The scroll is not a convenience. `page.mouse.click` takes viewport
 * coordinates and drops anything outside them without a word, and at 1280×900
 * the last format cards start below the fold — so a row that was never scrolled
 * to is a row whose "click" lands nowhere, and the test would report a missing
 * handler where there is only a missing scroll.
 */
async function pointOn(page: Page, label: string, part: RowPart): Promise<Point> {
  const row = formatCard(page, label).locator(".format-row");
  await row.scrollIntoViewIfNeeded();

  const box = await row.locator(".mantine-Checkbox-inner").boundingBox();
  const text = await row.locator(".mantine-Checkbox-label").boundingBox();
  if (box === null || text === null) throw new Error(`the ${label} row has no geometry to click`);

  const middle = { x: text.x + text.width / 2, y: text.y + text.height / 2 };
  const point = {
    "the box": { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    "the words": middle,
    "the label's lower edge": { x: middle.x, y: text.y + text.height - 2 },
  }[part];

  const viewport = page.viewportSize();
  if (
    viewport !== null &&
    (point.x < 0 || point.y < 0 || point.x >= viewport.width || point.y >= viewport.height)
  ) {
    throw new Error(
      `${part} of ${label} is at ${Math.round(point.x)},${Math.round(point.y)}, outside the ${viewport.width}×${viewport.height} viewport — a click there would be dropped, not failed`,
    );
  }

  return point;
}

/**
 * Press at `part` of a row and wait until the format has answered.
 *
 * `toPass` rather than an assertion once, and the point is measured *inside* the
 * retry: a click sent before hydration is swallowed with no trace, and a point
 * measured once can go stale if anything above it changes height. Each round
 * asserts the state *changed*, so a round whose click landed exits on its own
 * assertion and never presses twice.
 */
export async function toggleAt(page: Page, label: string, part: RowPart): Promise<void> {
  const wasOn = await isFormatOn(page, label);

  await expect(async () => {
    const point = await pointOn(page, label, part);
    await page.mouse.click(point.x, point.y);
    await expectFormat(page, label, !wasOn);
  }).toPass();
}

/** Turn `label` on when it is off, and off when it is on, by pressing its words. */
export async function toggleFormat(page: Page, label: string): Promise<void> {
  await toggleAt(page, label, "the words");
}

/** The `<input>` a format row's label points at — the control the keyboard reaches. */
export function formatCheckbox(page: Page, label: string): Locator {
  return formatCard(page, label).locator(".format-row input");
}

/** Hand files to the Tool the way the picker does, through its own file input. */
export async function queueFiles(page: Page, files: NamedBytes[]): Promise<void> {
  await page.locator('input[type="file"]').first().setInputFiles(files);
}

export type NamedBytes = { name: string; mimeType: string; buffer: Buffer };

export type Pixels = { width: number; height: number; left: number[]; right: number[] };

/**
 * A 64×48 PNG, transparent on the left half and opaque red on the right.
 *
 * Built by the browser's own canvas encoder rather than committed as a binary or
 * written by hand here: no fixture enters the repo, no test has to carry a PNG
 * encoder, and the fixture cannot disagree with the image decoder that will read
 * it back. It is built in a page of its own — a fixture is not built in the page
 * that is about to upload it (see the Gotchas in `AGENTS.md`), and at 64×48 the
 * habit is the only thing at stake.
 *
 * Its own pixels are checked before it is handed over, because every expectation
 * downstream is stated in terms of them: a fixture that is not what it claims
 * makes every measurement with it meaningless.
 */
export async function transparentPng(
  context: BrowserContext,
  name = "half-transparent.png",
): Promise<NamedBytes> {
  const builder = await context.newPage();

  try {
    const dataUrl = await builder.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 48;
      const context2d = canvas.getContext("2d");
      if (context2d === null) throw new Error("no 2d context to build the fixture in");

      // The left half is never painted, so it stays transparent.
      context2d.fillStyle = "#ff0000";
      context2d.fillRect(32, 0, 32, 48);

      return canvas.toDataURL("image/png");
    });

    expect(await readPixels(builder, dataUrl)).toEqual({
      width: 64,
      height: 48,
      left: [0, 0, 0, 0],
      right: [255, 0, 0, 255],
    });

    return {
      name,
      mimeType: "image/png",
      buffer: Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"),
    };
  } finally {
    await builder.close();
  }
}

/**
 * Decode an image the page is holding and read four pixels of it.
 *
 * The bytes never leave the browser: they are a `blob:` URL the Tool minted, and
 * `fetch`ing one is refused by the site's own `connect-src 'self'` — which is
 * the policy working, not a bug. Drawing it through an `<img>` is allowed
 * (`img-src 'self' blob:`) and is also how a visitor ends up seeing it.
 *
 * (8, 24) and (56, 24) are the two halves' centres, 8px clear of the seam, so
 * the reading is about the halves and not about an edge.
 */
export async function readPixels(page: Page, url: string): Promise<Pixels> {
  return page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context2d = canvas.getContext("2d");
    if (context2d === null) throw new Error("no 2d context to read the output in");

    context2d.drawImage(image, 0, 0);
    const at = (x: number, y: number): number[] => [...context2d.getImageData(x, y, 1, 1).data];

    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      left: at(8, 24),
      right: at(56, 24),
    };
  }, url);
}

/**
 * Add one file, turn every format on, convert, and wait for one result each.
 *
 * Every target on purpose: each codec's WebAssembly module is a separate file of
 * its own, so a run that used one format would never request the others' — which
 * matters most to the spec whose subject is what the page fetches.
 */
export async function convertInEveryFormat(page: Page): Promise<void> {
  await open(page);
  await queueFiles(page, [await transparentPng(page.context())]);
  await expect(page.getByText("已添加 1 张", { exact: true })).toBeVisible();

  // WebP is the target a fresh page already has; the other four are turned on by
  // pressing their rows, which is also how a visitor would do it.
  for (const label of FORMAT_LABELS.filter((one) => one !== STARTS_ON)) {
    await toggleFormat(page, label);
  }

  await page.getByRole("button", { name: "转换 1 个文件" }).click();
  await expect(page.locator("a[download]")).toHaveCount(FORMAT_LABELS.length);
}
