import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { convertInEveryFormat, readPixels } from "./tool-page";

/**
 * The Tool's promise, end to end: a file goes in, files come out, and they are
 * what their names say they are.
 *
 * What the unit tests cannot reach. `pnpm test` covers `sniff`, `naming`,
 * `limits`, `bmp` and the plan; it cannot say whether a codec produced a valid
 * file, because a codec needs a browser. That gap is what the manual checklist
 * exists for, and this is the part of it a machine can re-run: one source to
 * five targets, each output decoded back and measured, each download read off
 * disk and checked against its own format signature.
 */

/** The stem every output is named from (`core/naming.ts`) — the source is `half-transparent.png`. */
const STEM = "half-transparent";

/**
 * What each output should be, in the UI's own order.
 *
 * `alpha` is the Tool README's promise — PNG, WebP and AVIF keep transparency,
 * JPEG and BMP flatten onto pure white — and it is spelled out here rather than
 * read from `core/formats.ts`, so that a change to that table has to be a change
 * to this file too.
 *
 * The signatures are the files' own first bytes, because "the download arrived
 * and a viewer opened it" is not something a machine can borrow: what it can
 * check is that the bytes really are the container the name claims.
 */
const OUTPUTS = [
  {
    extension: "png",
    alpha: true,
    signature: (bytes: Buffer) => bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a",
  },
  {
    extension: "jpg",
    alpha: false,
    signature: (bytes: Buffer) => bytes.subarray(0, 3).toString("hex") === "ffd8ff",
  },
  {
    extension: "webp",
    alpha: true,
    signature: (bytes: Buffer) =>
      bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
      bytes.subarray(8, 12).toString("latin1") === "WEBP",
  },
  {
    extension: "avif",
    alpha: true,
    // An ISO base media file: the `ftyp` box, then the brand — `avif` for a still
    // image, `avis` for a sequence.
    signature: (bytes: Buffer) =>
      bytes.subarray(4, 8).toString("latin1") === "ftyp" &&
      ["avif", "avis"].includes(bytes.subarray(8, 12).toString("latin1")),
  },
  {
    extension: "bmp",
    alpha: false,
    signature: (bytes: Buffer) => bytes.subarray(0, 2).toString("latin1") === "BM",
  },
];

/** Add one file, turn every format on, convert, and wait for the five results. */
test("one file to five formats, and every output decodes back", async ({ page }) => {
  await convertInEveryFormat(page);

  await expect(
    page.getByText(`已添加 1 张，已生成 ${OUTPUTS.length} 个文件`, { exact: true }),
  ).toBeVisible();

  for (const output of OUTPUTS) {
    const name = `${STEM}.${output.extension}`;
    const link = page.locator(`a[download="${name}"]`);
    await expect(link, name).toBeVisible();

    const href = await link.getAttribute("href");
    expect(href, name).toMatch(/^blob:/);

    const pixels = await readPixels(page, href ?? "");
    expect(pixels.width, name).toBe(64);
    expect(pixels.height, name).toBe(48);

    // The right half is the red that went in. A lossy codec drifts by a little,
    // so the reading is "still red" rather than "exactly 255, 0, 0".
    expect(pixels.right[0], name).toBeGreaterThan(250);
    expect(pixels.right[1], name).toBeLessThan(6);
    expect(pixels.right[2], name).toBeLessThan(6);

    if (output.alpha) {
      // Transparency survives. The colour of a transparent pixel is not asserted:
      // a lossy codec may put anything there, and nothing ever reads it.
      expect(pixels.left[3], name).toBe(0);
    } else {
      // Flattened onto white — not onto black, and not onto the site's own
      // surface token, which would read as a tinting bug in someone's file.
      expect(pixels.left[3], name).toBe(255);
      for (const channel of pixels.left.slice(0, 3)) expect(channel, name).toBeGreaterThan(250);
    }
  }
});

test("every download lands on disk as the format its name claims", async ({ page }) => {
  await convertInEveryFormat(page);

  for (const output of OUTPUTS) {
    const name = `${STEM}.${output.extension}`;
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(`a[download="${name}"]`).click(),
    ]);

    expect(download.suggestedFilename(), name).toBe(name);

    const path = await download.path();
    if (path === null) throw new Error(`${name} produced no file to read`);

    const bytes = await readFile(path);
    expect(bytes.byteLength, name).toBeGreaterThan(0);
    expect(output.signature(bytes), `${name} is not a ${output.extension} container`).toBe(true);
  }
});
