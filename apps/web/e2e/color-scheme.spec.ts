import { expect, test } from "@playwright/test";

import { open } from "./tool-page";

/**
 * The colour scheme, which the site owns since #168.
 *
 * Until then the scheme was the outgoing component library's: its manager wrote
 * `data-mantine-color-scheme` before the first paint and its hooks read it back, and
 * nothing in this gate had ever asserted that the switch worked at all — the risk the
 * ticket names in its own user story is exactly "the manual switch is lost with the
 * library that happened to implement it". So the seam moved, and this is the spec that
 * says the behaviour did not.
 *
 * What it drives is the whole mechanism and nothing about how it is built: the
 * attribute on `<html>` (which is what the stylesheet's dark variant and the tokens
 * are defined against), the switch's own accessible name (which is what a visitor
 * hears), the stored choice under **this site's** key (which is what makes the next
 * load remember), and a fresh context with the operating system asking for dark (which
 * is what "follow the system until the visitor chooses" means).
 *
 * The toggle is addressed by its place in the header rather than by its name, because
 * its name is one of the things being asserted: a locator built from the name would
 * pass a page whose name never changed.
 */
const toggle = (page: import("@playwright/test").Page) =>
  page.locator('[data-slot="site-header"] button');

/** This site's key, spelled out: a spec that read it from the module would agree with
 * whatever the module says, and the point is that the library's key is not in use. */
const KEY = "toolbox-color-scheme";

test.describe("the colour scheme", () => {
  test("follows the operating system when the visitor has not chosen", async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: "dark" });
    const page = await context.newPage();

    try {
      await open(page, "/");

      await expect(page.locator("html")).toHaveAttribute("data-color-scheme", "dark");
      await expect(toggle(page)).toHaveAccessibleName("切换到浅色");
      // Following the system is not choosing: nothing is stored, so a later change of
      // the system's preference still applies on the next load.
      expect(await page.evaluate((key) => window.localStorage.getItem(key), KEY)).toBeNull();
    } finally {
      await context.close();
    }
  });

  test("the switch works in both directions, and the choice survives a reload", async ({
    page,
  }) => {
    await open(page, "/");

    await expect(page.locator("html")).toHaveAttribute("data-color-scheme", "light");
    await expect(toggle(page)).toHaveAccessibleName("切换到深色");

    await toggle(page).click();
    await expect(page.locator("html")).toHaveAttribute("data-color-scheme", "dark");
    await expect(toggle(page)).toHaveAccessibleName("切换到浅色");
    await expect
      .poll(() => page.evaluate((key) => window.localStorage.getItem(key), KEY))
      .toBe("dark");

    // The script in the head is what makes this a choice rather than a state: the
    // reload has no React state to inherit, only the stored value.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-color-scheme", "dark");

    await toggle(page).click();
    await expect(page.locator("html")).toHaveAttribute("data-color-scheme", "light");
    await expect
      .poll(() => page.evaluate((key) => window.localStorage.getItem(key), KEY))
      .toBe("light");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-color-scheme", "light");
  });
});
