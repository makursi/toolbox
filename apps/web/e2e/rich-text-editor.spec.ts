import { expect, test } from "@playwright/test";

import {
  BODY_PLACEHOLDER,
  TITLE_PLACEHOLDER,
  bodyParagraph,
  open,
  paintedPlaceholder,
  textOf,
  titleBlock,
  writeInBody,
  writeInTitle,
} from "./rich-text-editor-page";

/**
 * The Rich Text Editor's first slice (#206): the page opens, an empty document says
 * where to start, and a real keyboard puts text into the document.
 *
 * What this holds is the document's *external* behaviour: the two sentences an empty
 * document paints, the text a visitor typed read back out of the browser, and the
 * body's placeholder giving way on the first keystroke. It does not read TipTap's
 * state, React's state or any serialiser: the toolbar, the slash menu and the
 * exported file are later slices and get their own assertions there.
 */

test("an empty document shows both placeholders, and the first keystroke replaces the body one", async ({
  page,
}) => {
  await open(page);

  // The document starts as a title block and one paragraph, both empty. The
  // placeholders are painted rather than typed, so they are read off `::before`:
  // they are not in the document, and nothing in it says 无标题 yet.
  await expect(titleBlock(page)).toHaveText("");
  await expect(bodyParagraph(page)).toHaveText("");
  expect(await paintedPlaceholder(titleBlock(page))).toBe(TITLE_PLACEHOLDER);
  expect(await paintedPlaceholder(bodyParagraph(page))).toBe(BODY_PLACEHOLDER);

  await writeInBody(page, "今天写一点东西。");

  expect(await textOf(bodyParagraph(page))).toBe("今天写一点东西。");
  expect(await paintedPlaceholder(bodyParagraph(page))).toBeNull();

  // The title is a block of its own and is still empty, so its placeholder stays:
  // the two sentences are not one empty-state message that the first keystroke hides.
  expect(await textOf(titleBlock(page))).toBe("");
  expect(await paintedPlaceholder(titleBlock(page))).toBe(TITLE_PLACEHOLDER);
});

test("a real keyboard writes into the document, and the text survives a re-render", async ({
  page,
}) => {
  await open(page);

  await writeInBody(page, "第一段。");
  expect(await textOf(bodyParagraph(page))).toBe("第一段。");

  /*
   * A page-wide change between the typing and the reading: the scheme switch moves
   * every colour on the page and re-renders the shell around the editor. The
   * document is not part of that render's state, so it has nothing to be reset from
   * — which is the property this step is about.
   */
  await page.getByRole("button", { name: /切换到/ }).click();

  /*
   * Then the document itself renders again, around a second block: the title is
   * typed into, the paragraph above is redrawn with it, and the paragraph is still
   * exactly what was typed before. A document held in props or re-seeded from the
   * initial content would come back empty here.
   */
  await writeInTitle(page, "第一篇");

  expect(await textOf(titleBlock(page))).toBe("第一篇");
  expect(await textOf(bodyParagraph(page))).toBe("第一段。");
  expect(await paintedPlaceholder(titleBlock(page))).toBeNull();
  expect(await paintedPlaceholder(bodyParagraph(page))).toBeNull();
});

/**
 * The registry is what the homepage card and the sitemap both read
 * (`src/tools/registry.ts`), so the two surfaces this ticket's acceptance criteria
 * name are checked here rather than inferred from the entry existing.
 */
test("the Tool has a homepage card and a sitemap entry", async ({ page }) => {
  await page.goto("/");

  const card = page.locator('a[href="/tools/rich-text-editor"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText("富文本编辑器");

  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/tools/rich-text-editor");
});
