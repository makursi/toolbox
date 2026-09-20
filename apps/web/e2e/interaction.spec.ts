import { expect, test } from "@playwright/test";

import {
  FORMAT_LABELS,
  ROW_PARTS,
  STARTS_ON,
  expectFormat,
  formatCheckbox,
  isFormatOn,
  open,
  queueFiles,
  toggleAt,
  toggleFormat,
  transparentPng,
} from "./tool-page";

/**
 * The checklist item the keyboard let through.
 *
 * The Tool's manual checklist says it in capitals: every format row toggles
 * under a real mouse press, not only under the keyboard. That is not a flourish
 * — the toggle once sat on a `<label>`, the overlay that was supposed to grow the
 * hit area sat on the `<div>` above it, and every pointer click was taken by an
 * element that handles none. A key never hits a pseudo-element, so the keyboard
 * kept working and the bug survived a QA round that used Space.
 *
 * So this presses at coordinates, the way the instruments do, and reads the
 * answer off the card — both because that is what a visitor does and because a
 * click that lands nowhere leaves no other trace.
 */

/**
 * A narrow screen and a wide one. Not the instruments' 360/390/768/1024 matrix:
 * that one is about geometry and lives in `scripts/touch-targets.mjs`. These two
 * are here to prove the row behaves the same when the label wraps and when it
 * does not.
 */
const WIDTHS = [360, 1280];

test.describe("a format row answers a real click anywhere on it", () => {
  for (const width of WIDTHS) {
    test.describe(`at ${width}px`, () => {
      test.use({ viewport: { width, height: 900 } });

      for (const label of FORMAT_LABELS) {
        test(`${label} toggles from the box, the words and the label's lower edge`, async ({
          page,
        }) => {
          await open(page);

          for (const part of ROW_PARTS) {
            await test.step(part, async () => {
              await toggleAt(page, label, part);
            });
          }
        });
      }
    });
  }
});

test.describe("the keyboard reaches the same controls", () => {
  test("Space toggles every format row once it has focus", async ({ page }) => {
    await open(page);

    for (const label of FORMAT_LABELS) {
      await test.step(label, async () => {
        const wasOn = await isFormatOn(page, label);
        await formatCheckbox(page, label).focus();
        await page.keyboard.press("Space");
        await expectFormat(page, label, !wasOn);
      });
    }
  });

  test("the file dialog opens from the drop zone with no pointer at all", async ({ page }) => {
    await open(page);

    // `press` focuses first, so this is the whole keyboard path: reach the
    // button, activate it, and hand the resulting dialog a file.
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: "选择文件" }).press("Enter"),
    ]);
    await chooser.setFiles(await transparentPng(page.context()));

    await expect(page.getByText("已添加 1 张", { exact: true })).toBeVisible();
  });
});

test.describe("the file list", () => {
  test("counts what is in it, removes one file, and clears everything", async ({ page }) => {
    await open(page);

    const fixture = await transparentPng(page.context());
    await queueFiles(page, [
      { ...fixture, name: "first.png" },
      { ...fixture, name: "second.png" },
      // Neither good nor refused by accident: the list has to be able to hold a
      // rejection next to an addition, which is the only reason 清空 is said to
      // empty both.
      { buffer: Buffer.from("this is not an image"), mimeType: "text/plain", name: "notes.txt" },
    ]);

    await expect(page.getByText("已添加 2 张", { exact: true })).toBeVisible();
    await expect(page.getByText("有文件没能加入")).toBeVisible();

    await page.getByRole("button", { name: "移除 first.png" }).click();
    await expect(page.getByText("已添加 1 张", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "移除 second.png" })).toBeVisible();

    await page.getByRole("button", { name: "清空" }).click();
    await expect(page.locator(".file-row")).toHaveCount(0);
    await expect(page.getByText("有文件没能加入")).toHaveCount(0);
    await expect(page.getByText(/已添加/)).toHaveCount(0);
  });
});

test.describe("the way out of a disabled control", () => {
  test("转换 names the condition it is waiting for", async ({ page }) => {
    await open(page);

    // Nothing added yet.
    await expect(page.getByRole("button", { name: "转换", exact: true })).toBeDisabled();
    await expect(page.getByText("先添加文件。")).toBeVisible();

    await queueFiles(page, [await transparentPng(page.context())]);
    await expect(page.getByRole("button", { name: "转换 1 个文件" })).toBeEnabled();
    await expect(page.getByText("先添加文件。")).toHaveCount(0);

    // WebP is the target a fresh page already has; with it off there are none.
    await toggleFormat(page, STARTS_ON);
    await expect(page.getByRole("button", { name: "转换 1 个文件" })).toBeDisabled();
    await expect(page.getByText("至少选择一个目标格式。")).toBeVisible();
  });
});
