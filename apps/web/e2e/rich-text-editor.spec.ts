import { readFile } from "node:fs/promises";

import { expect, test, type Download } from "@playwright/test";

import {
  BODY_PLACEHOLDER,
  TITLE_PLACEHOLDER,
  answerImportDialog,
  blockTrigger,
  bodyParagraph,
  canvas,
  clearDocument,
  downloadFromFileMenu,
  editor,
  fileTrigger,
  hidePage,
  importDialog,
  importFromFileMenu,
  linkField,
  open,
  paintedPlaceholder,
  pressAt,
  retrySave,
  saveStatus,
  selectBodyText,
  selectedTextBox,
  selectionControl,
  selectionToolbar,
  slashItem,
  slashMenu,
  slashMenuItems,
  storedDraft,
  textOf,
  titleBlock,
  toolbarControl,
  writeInBody,
  writeInTitle,
} from "./rich-text-editor-page";

/**
 * The Rich Text Editor: the page and its placeholders (#206), the toolbar and the
 * command table (#207), the three ways to write without leaving the keyboard (#208),
 * the two exports (#210), the local draft with its save status (#209), and the
 * import (#211).
 *
 * What this holds is the document's *external* behaviour: the two sentences an
 * empty document paints, the text a visitor typed read back out of the browser,
 * what each control does to the blocks and marks a screen reader can see, the
 * bytes of the files the file menu downloads, the record the browser keeps, and the
 * document an imported file produces. It does not read TipTap's state, React's
 * state or any serialiser: the exported file is judged by its own text, the
 * filename by the rule's arithmetic, the draft through the page's own IndexedDB,
 * and the imported document by the blocks the canvas renders.
 *
 * Every toolbar press goes through `pressAt`, which measures the control and
 * clicks its centre: a control that looks right and is dead to the mouse is the
 * failure this file exists to catch, and a keyboard path would never see it. The
 * slash menu is the exception that proves the rule — it is a keyboard surface, so it
 * is driven by keys and only its rows are pressed when a row has to be checked.
 */

/**
 * The five inline marks, in the order the toolbar offers them, with the element
 * TipTap's mark renders as.
 *
 * Spelled out rather than read from the command table: the table is the other side
 * of this assertion, and an expectation derived from the code under test would
 * agree with it whether or not it is right.
 */
const MARKS = [
  { element: "strong", label: "加粗" },
  { element: "em", label: "斜体" },
  { element: "u", label: "下划线" },
  { element: "s", label: "删除线" },
  { element: "code", label: "行内代码" },
] as const;

/** `YYYY-MM-DD` on this machine's own calendar day, the day the name carries. */
function todayStamp(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/** The downloaded file's bytes, as the text the page wrote. */
async function readDownload(download: Download): Promise<string> {
  const path = await download.path();
  if (path === null) throw new Error("the download produced no file to read");

  return readFile(path, "utf8");
}

/** A file for the import, in Playwright's in-memory form. */
function fileOf(name: string, mimeType: string, contents: string) {
  return { buffer: Buffer.from(contents, "utf8"), mimeType, name };
}

/**
 * The Markdown fixture: one of each construct the Tool exports.
 *
 * Written as lines rather than one template literal because the fixture contains
 * backticks and fences, and a fixture is easier to read as the lines a reader
 * sees than as an escape puzzle.
 */
const MARKDOWN_FIXTURE = [
  "# 导入测试",
  "",
  "一段**加粗**、*斜体*、~~删除线~~、`代码`与[链接](https://example.com/docs)的段落。",
  "",
  "- 第一项",
  "  - 嵌套项",
  "- 第二项",
  "",
  "1. 编号一",
  "2. 编号二",
  "",
  "- [x] 已完成",
  "- [ ] 未完成",
  "",
  "> 引用一句。",
  "",
  "```ts",
  "const answer = 42;",
  "```",
  "",
  "---",
  "",
].join("\n");

/**
 * The HTML fixture: a complete document with the material an import must drop.
 *
 * The `<head>` carries a title, a stylesheet and a script; the body repeats the
 * Markdown fixture's blocks in HTML, including the standalone export's task-list
 * shape, so the two imports are judged by the same blocks.
 */
const HTML_FIXTURE = [
  "<!doctype html>",
  '<html lang="zh-CN"><head>',
  "<title>忽略的标题</title>",
  "<style>p { color: red }</style>",
  "<script>window.__htmlImportPwned = true</script>",
  "</head><body><article>",
  "<h1>HTML 导入</h1>",
  '<p>一段<strong>加粗</strong>、<em>斜体</em>、<s>删除线</s>、<code>代码</code>与<a href="https://example.com/html">链接</a>的段落。</p>',
  "<ul><li>第一项<ul><li>嵌套项</li></ul></li><li>第二项</li></ul>",
  "<ol><li>编号一</li><li>编号二</li></ol>",
  '<ul class="task-list"><li class="task-list-item"><input type="checkbox" checked disabled>已完成</li>',
  '<li class="task-list-item"><input type="checkbox" disabled>未完成</li></ul>',
  "<blockquote>引用一句。</blockquote>",
  '<pre><code class="language-js">const answer = 42;</code></pre>',
  "<hr>",
  "</article></body></html>",
].join("");

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

test("each inline mark toggles from its toolbar control at its coordinates", async ({ page }) => {
  await open(page);
  await writeInBody(page, "标记测试。");

  for (const mark of MARKS) {
    const control = toolbarControl(page, mark.label);

    await selectBodyText(page);
    await pressAt(page, control);

    // The state at the cursor is the button's own state, so the assertion is on
    // `aria-pressed` rather than on a class: it is what a screen reader reads, and
    // what a button that merely looks pressed cannot fake.
    await expect(control).toHaveAttribute("aria-pressed", "true");
    await expect(bodyParagraph(page).locator(mark.element)).toHaveCount(1);

    await pressAt(page, control);

    await expect(control).toHaveAttribute("aria-pressed", "false");
    await expect(bodyParagraph(page).locator(mark.element)).toHaveCount(0);
  }
});

test("the block menu names the block and turns a paragraph into headings 1-3 and back", async ({
  page,
}) => {
  await open(page);
  await writeInBody(page, "块测试。");

  for (const level of [1, 2, 3] as const) {
    await bodyParagraph(page).click();
    await pressAt(page, blockTrigger(page));
    await pressAt(page, page.getByRole("button", { name: `标题 ${level}`, exact: true }));

    await expect(canvas(page).locator(`h${level}`).filter({ hasText: "块测试。" })).toBeVisible();
    await expect(blockTrigger(page)).toHaveAttribute("aria-label", `块类型：标题 ${level}`);

    await pressAt(page, blockTrigger(page));
    await pressAt(page, page.getByRole("button", { name: "正文", exact: true }));

    await expect(canvas(page).locator("p").filter({ hasText: "块测试。" })).toBeVisible();
    await expect(blockTrigger(page)).toHaveAttribute("aria-label", "块类型：正文");
  }
});

test("a bulleted list nests, and a task item can be checked", async ({ page }) => {
  await open(page);

  await bodyParagraph(page).click();
  await pressAt(page, toolbarControl(page, "项目符号列表"));
  await page.keyboard.type("第一项");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.type("嵌套项");

  const list = canvas(page).locator("ul").first();
  await expect(list.locator("li").first()).toContainText("第一项");
  await expect(list.locator("ul li")).toContainText("嵌套项");

  // The same document, emptied through the file menu and used again: 清空 is the
  // only way to get a clean document without a reload, so the task list is proved
  // on the state the menu produces.
  await pressAt(page, fileTrigger(page));
  await pressAt(page, page.getByRole("button", { name: "清空", exact: true }));

  await bodyParagraph(page).click();
  await pressAt(page, toolbarControl(page, "任务列表"));
  await page.keyboard.type("买菜");

  const item = canvas(page).locator('ul[data-type="taskList"] li').first();
  const checkbox = canvas(page).locator('input[type="checkbox"]');

  await expect(item).toHaveAttribute("data-checked", "false");
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await expect(item).toHaveAttribute("data-checked", "true");
});

test("quote, code block and rule insert their block, and the file menu clears the document", async ({
  page,
}) => {
  await open(page);

  await writeInBody(page, "引用一句。");
  await pressAt(page, toolbarControl(page, "引用"));
  await expect(canvas(page).locator("blockquote")).toContainText("引用一句。");

  await pressAt(page, fileTrigger(page));
  await pressAt(page, page.getByRole("button", { name: "清空", exact: true }));

  await expect(canvas(page).locator("blockquote")).toHaveCount(0);
  expect(await paintedPlaceholder(bodyParagraph(page))).toBe(BODY_PLACEHOLDER);

  await bodyParagraph(page).click();
  await pressAt(page, toolbarControl(page, "代码块"));
  await page.keyboard.type("const answer = 42;");
  await expect(canvas(page).locator("pre")).toContainText("const answer = 42;");

  await pressAt(page, fileTrigger(page));
  await pressAt(page, page.getByRole("button", { name: "清空", exact: true }));

  await bodyParagraph(page).click();
  await pressAt(page, toolbarControl(page, "分隔线"));
  await expect(canvas(page).locator("hr")).toHaveCount(1);
});

test("the link action sets, edits and removes a link on selected text", async ({ page }) => {
  await open(page);
  await writeInBody(page, "示例文字。");
  await selectBodyText(page);

  await pressAt(page, toolbarControl(page, "链接"));
  await expect(linkField(page)).toBeVisible();
  await linkField(page).fill("https://example.com");
  await pressAt(page, page.getByRole("button", { name: "应用", exact: true }));

  await expect(canvas(page).locator('a[href="https://example.com"]')).toHaveText("示例文字。");

  // Reopening on the link's own text prefills the field with the address that is
  // already there, which is what makes the second pass an edit rather than a set.
  await pressAt(page, toolbarControl(page, "链接"));
  await expect(linkField(page)).toHaveValue("https://example.com");
  await linkField(page).fill("https://example.org/edited");
  await pressAt(page, page.getByRole("button", { name: "应用", exact: true }));

  await expect(canvas(page).locator('a[href="https://example.org/edited"]')).toHaveText(
    "示例文字。",
  );

  await pressAt(page, toolbarControl(page, "链接"));
  await pressAt(page, page.getByRole("button", { name: "移除", exact: true }));

  await expect(canvas(page).locator("a")).toHaveCount(0);
});

test("undo and redo work from the keyboard and from the toolbar", async ({ page }) => {
  await open(page);
  await writeInBody(page, "撤销测试。");
  await expect(bodyParagraph(page)).toHaveText("撤销测试。");

  await page.keyboard.press("Control+z");
  await expect(bodyParagraph(page)).toHaveText("");

  await page.keyboard.press("Control+Shift+z");
  await expect(bodyParagraph(page)).toHaveText("撤销测试。");

  await pressAt(page, toolbarControl(page, "撤销"));
  await expect(bodyParagraph(page)).toHaveText("");

  await pressAt(page, toolbarControl(page, "重做"));
  await expect(bodyParagraph(page)).toHaveText("撤销测试。");
});

/**
 * The slash menu: `/` at the start of a paragraph, filtered by typing, moved with
 * the arrow keys, applied with Enter and closed with Escape.
 *
 * The rows are the command table's block commands, so the count and the first row
 * are asserted against what a visitor sees rather than against the table: a table
 * that grew an extra row without the menu drawing it would be invisible here, which
 * is why the count is spelled out (ten: 正文, three headings, three lists, 引用,
 * 代码块 and 分隔线).
 */
test("the slash menu filters by typing, moves with the arrow keys and applies with Enter", async ({
  page,
}) => {
  await open(page);
  await bodyParagraph(page).click();
  await page.keyboard.type("/");

  await expect(slashMenu(page)).toBeVisible();
  await expect(slashMenuItems(page)).toHaveCount(10);
  await expect(slashMenuItems(page).first()).toHaveText("正文");

  await page.keyboard.type("标题");
  await expect(slashMenuItems(page)).toHaveCount(3);
  await expect(slashItem(page, "标题 1")).toHaveAttribute("aria-current", "true");

  await page.keyboard.press("ArrowDown");
  await expect(slashItem(page, "标题 2")).toHaveAttribute("aria-current", "true");
  await expect(slashItem(page, "标题 1")).not.toHaveAttribute("aria-current", "true");

  await page.keyboard.press("Enter");

  await expect(slashMenu(page)).toBeHidden();
  await expect(canvas(page).locator("h2")).toHaveCount(1);
  // The typed `/标题` was the filter and not content: it is not in the document.
  await expect(canvas(page)).not.toContainText("/");
});

test("Escape closes the slash menu, and the slash it opened on stays text", async ({ page }) => {
  await open(page);
  await bodyParagraph(page).click();
  await page.keyboard.type("/");

  await expect(slashMenu(page)).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(slashMenu(page)).toBeHidden();
  await expect(bodyParagraph(page)).toHaveText("/");
  await expect(canvas(page).locator("h1")).toHaveCount(1);
});

test("each Markdown block rule makes its block", async ({ page }) => {
  await open(page);

  const headings = [
    { typed: "# 一级标题", level: 1 },
    { typed: "## 二级标题", level: 2 },
    { typed: "### 三级标题", level: 3 },
  ] as const;

  for (const heading of headings) {
    await clearDocument(page);
    await bodyParagraph(page).click();
    await page.keyboard.type(heading.typed);

    await expect(
      canvas(page).locator(`h${heading.level}`).filter({ hasText: "级标题" }),
    ).toHaveCount(1);
  }

  await clearDocument(page);
  await bodyParagraph(page).click();
  await page.keyboard.type("- 第一项");
  await expect(canvas(page).locator("ul li").first()).toHaveText("第一项");

  await clearDocument(page);
  await bodyParagraph(page).click();
  await page.keyboard.type("1. 第一条");
  await expect(canvas(page).locator("ol li").first()).toHaveText("第一条");

  await clearDocument(page);
  await bodyParagraph(page).click();
  await page.keyboard.type("> 引用一句");
  await expect(canvas(page).locator("blockquote")).toContainText("引用一句");

  await clearDocument(page);
  await bodyParagraph(page).click();
  await page.keyboard.type("```");
  await page.keyboard.type(" ");
  await page.keyboard.type("const answer = 42;");
  await expect(canvas(page).locator("pre")).toContainText("const answer = 42;");

  await clearDocument(page);
  await bodyParagraph(page).click();
  await page.keyboard.type("---");
  await expect(canvas(page).locator("hr")).toHaveCount(1);
});

test("each Markdown mark rule marks its words", async ({ page }) => {
  await open(page);

  const marks = [
    { typed: "**加粗**", element: "strong", text: "加粗" },
    { typed: "*斜体*", element: "em", text: "斜体" },
    { typed: "~~删除~~", element: "s", text: "删除" },
    { typed: "`代码`", element: "code", text: "代码" },
  ] as const;

  for (const mark of marks) {
    await clearDocument(page);
    await bodyParagraph(page).click();
    await page.keyboard.type(mark.typed);

    await expect(canvas(page).locator(`p ${mark.element}`)).toHaveText(mark.text);
    // The delimiters were the rule rather than the content.
    await expect(bodyParagraph(page)).toHaveText(mark.text);
  }
});

/**
 * The other half of an input rule: the characters that *begin* one but make no rule
 * are ordinary text.
 *
 * A rule that ate a paragraph beginning with `-` or `#` would be a bug a person
 * would find with their first sentence, and the regular expressions only fire on a
 * complete construct (a space after `#`, a closing delimiter). This holds the whole
 * list of near-misses, because "it did not eat mine" is not a check.
 */
test("a paragraph that begins with the same characters but makes no rule stays text", async ({
  page,
}) => {
  await open(page);

  const nearMisses = [
    "#没有空格",
    ">没有空格",
    "-没有空格",
    "1.没有空格",
    "`未闭合",
    "**未闭合",
  ] as const;

  for (const typed of nearMisses) {
    await clearDocument(page);
    await bodyParagraph(page).click();
    await page.keyboard.type(typed);

    await expect(bodyParagraph(page)).toHaveText(typed);
    await expect(slashMenu(page)).toBeHidden();
  }

  // A slash inside a sentence is a slash: the menu is a start-of-paragraph gesture.
  await clearDocument(page);
  await bodyParagraph(page).click();
  await page.keyboard.type("一段话/后面");
  await expect(bodyParagraph(page)).toHaveText("一段话/后面");
  await expect(slashMenu(page)).toBeHidden();
});

/**
 * The toolbar that follows a selection: the five marks and the link, from the same
 * command table, placed near the words and never on them.
 */
test("the selection toolbar offers the marks and the link, and covers no selected word", async ({
  page,
}) => {
  await open(page);
  await writeInBody(page, "选中这一段话。");
  await selectBodyText(page);

  const bar = selectionToolbar(page);
  await expect(bar).toBeVisible();

  for (const label of ["加粗", "斜体", "下划线", "删除线", "行内代码", "链接"]) {
    await expect(selectionControl(page, label)).toBeVisible();
  }

  const words = await selectedTextBox(page);
  const box = await bar.boundingBox();
  if (words === null || box === null) {
    throw new Error("the selection or the selection toolbar has no geometry to compare");
  }

  // Above the words when there is room for the whole row, below them otherwise,
  // never across them.
  const above = box.y + box.height <= words.top;
  const below = box.y >= words.bottom;
  expect(
    above || below,
    `the row at ${box.y}..${box.y + box.height} covers ${words.top}..${words.bottom}`,
  ).toBe(true);

  // And the marks it offers are the editor's own, applied at the row's coordinates.
  await pressAt(page, selectionControl(page, "加粗"));
  await expect(bodyParagraph(page).locator("strong")).toHaveCount(1);

  // A caret is the pinned toolbar's state: this row is for a selection only.
  await bodyParagraph(page).click();
  await expect(bar).toBeHidden();
});

/**
 * The export, driven the way a visitor drives it and judged by the bytes.
 *
 * The document is typed and formatted through the page's own controls, and the
 * file is downloaded through the page's own menu, so what is read back is the
 * file the browser would save. The name is asserted against the rule's own
 * arithmetic rather than against `core/naming.ts`: an expectation derived from
 * the module under test would agree with it whether or not it is right.
 */
test("the file menu exports Markdown and a standalone HTML document, and names both", async ({
  page,
}) => {
  await open(page);
  await writeInTitle(page, "导出测试");
  await writeInBody(page, "第一段。");
  await selectBodyText(page);
  await pressAt(page, toolbarControl(page, "加粗"));

  const markdown = await downloadFromFileMenu(page, "导出 Markdown");
  expect(markdown.suggestedFilename()).toBe(`导出测试-${todayStamp()}.md`);
  expect(await readDownload(markdown)).toBe("# 导出测试\n\n**第一段。**\n");

  const html = await downloadFromFileMenu(page, "导出 HTML");
  expect(html.suggestedFilename()).toBe(`导出测试-${todayStamp()}.html`);

  const standalone = await readDownload(html);
  expect(standalone.startsWith("<!doctype html>")).toBe(true);
  expect(standalone).toContain('<meta charset="utf-8">');
  expect(standalone).toContain("<title>导出测试</title>");
  expect(standalone).toContain("<h1>导出测试</h1>");
  expect(standalone).toContain("<p><strong>第一段。</strong></p>");
  // The stylesheet is in the file, so the download opens on its own elsewhere.
  expect(standalone).toContain("<style>");
  expect(standalone.trimEnd().endsWith("</html>")).toBe(true);
});

test("an untitled document exports under the dated fallback name", async ({ page }) => {
  await open(page);
  await writeInBody(page, "没有标题。");

  const markdown = await downloadFromFileMenu(page, "导出 Markdown");
  expect(markdown.suggestedFilename()).toBe(`文档-${todayStamp()}.md`);
  expect(await readDownload(markdown)).toBe("没有标题。\n");

  const html = await downloadFromFileMenu(page, "导出 HTML");
  expect(html.suggestedFilename()).toBe(`文档-${todayStamp()}.html`);
  expect(await readDownload(html)).toContain("<title>无标题</title>");
});

/**
 * The import, driven the way a visitor drives it (#211).
 *
 * The file goes in through the file menu's 导入 row, and the document is judged
 * by the blocks the canvas renders rather than by JSON: the importer's own output
 * is TipTap's `setContent`, so the canvas is where the claim is true. The fixture
 * holds one of each construct this Tool exports, which is also what makes a
 * missing block a failure rather than a shorter document.
 */
test("the file menu imports a Markdown file, and the imported document exports again", async ({
  page,
}) => {
  await open(page);
  await importFromFileMenu(page, fileOf("导入.md", "text/markdown", MARKDOWN_FIXTURE));

  // An empty draft is replaced without asking: there is nothing to lose.
  expect(await importDialog(page).count()).toBe(0);

  await expect(canvas(page).locator("h1")).toHaveText("导入测试");

  const paragraph = canvas(page).locator("p").first();
  await expect(paragraph.locator("strong")).toHaveText("加粗");
  await expect(paragraph.locator("em")).toHaveText("斜体");
  await expect(paragraph.locator("s")).toHaveText("删除线");
  await expect(paragraph.locator("code")).toHaveText("代码");
  await expect(paragraph.locator('a[href="https://example.com/docs"]')).toHaveText("链接");

  const bullet = canvas(page).locator("ul").first();
  await expect(bullet.locator(":scope > li")).toHaveCount(2);
  await expect(bullet.locator(":scope > li").first().locator("ul > li")).toHaveText("嵌套项");
  await expect(canvas(page).locator("ol > li")).toHaveCount(2);

  const tasks = canvas(page).locator('ul[data-type="taskList"] > li');
  await expect(tasks).toHaveCount(2);
  await expect(tasks.first()).toHaveAttribute("data-checked", "true");
  await expect(tasks.nth(1)).toHaveAttribute("data-checked", "false");

  await expect(canvas(page).locator("blockquote")).toHaveText("引用一句。");
  await expect(canvas(page).locator("pre code")).toHaveText("const answer = 42;");
  await expect(canvas(page).locator("pre code")).toHaveClass(/language-ts/);
  await expect(canvas(page).locator("hr")).toHaveCount(1);

  // The imported document is editable and exports like any other: the caret goes
  // into the imported paragraph and the words it adds come back in the file.
  await paragraph.click();
  await page.keyboard.press("End");
  await page.keyboard.type("补充。");
  await expect(paragraph).toContainText("补充。");

  const exported = await downloadFromFileMenu(page, "导出 Markdown");
  expect(exported.suggestedFilename()).toBe(`导入测试-${todayStamp()}.md`);
  expect(await readDownload(exported)).toContain("补充。");
});

test("the file menu imports an HTML file, and its head, script and style do not survive", async ({
  page,
}) => {
  await open(page);
  await importFromFileMenu(page, fileOf("导入.html", "text/html", HTML_FIXTURE));

  await expect(canvas(page).locator("h1")).toHaveText("HTML 导入");

  const paragraph = canvas(page).locator("p").first();
  await expect(paragraph.locator("strong")).toHaveText("加粗");
  await expect(paragraph.locator("em")).toHaveText("斜体");
  await expect(paragraph.locator("s")).toHaveText("删除线");
  await expect(paragraph.locator("code")).toHaveText("代码");
  await expect(paragraph.locator('a[href="https://example.com/html"]')).toHaveText("链接");

  const bullet = canvas(page).locator("ul").first();
  await expect(bullet.locator(":scope > li")).toHaveCount(2);
  await expect(bullet.locator(":scope > li").first().locator("ul > li")).toHaveText("嵌套项");
  await expect(canvas(page).locator("ol > li")).toHaveCount(2);

  const tasks = canvas(page).locator('ul[data-type="taskList"] > li');
  await expect(tasks).toHaveCount(2);
  await expect(tasks.first()).toHaveAttribute("data-checked", "true");

  await expect(canvas(page).locator("blockquote")).toHaveText("引用一句。");
  await expect(canvas(page).locator("pre code")).toHaveText("const answer = 42;");
  await expect(canvas(page).locator("pre code")).toHaveClass(/language-js/);
  await expect(canvas(page).locator("hr")).toHaveCount(1);

  // Nothing from the head or a script survives, in the document or in the page.
  expect(await page.evaluate("window.__htmlImportPwned")).toBeUndefined();
  await expect(canvas(page).locator("script")).toHaveCount(0);
  await expect(canvas(page).locator("style")).toHaveCount(0);
  await expect(canvas(page).locator("title")).toHaveCount(0);

  const exported = await downloadFromFileMenu(page, "导出 HTML");
  expect(exported.suggestedFilename()).toBe(`HTML 导入-${todayStamp()}.html`);
  expect(await readDownload(exported)).toContain("<h1>HTML 导入</h1>");
});

/**
 * The confirmation, both ways: cancelling leaves the draft exactly as it was, and
 * confirming replaces it. The draft is written through the page's own controls, so
 * "untouched" means the same blocks the visitor typed, not a JSON comparison.
 */
test("a non-empty draft asks before an import replaces it, and cancelling changes nothing", async ({
  page,
}) => {
  await open(page);
  await writeInTitle(page, "原标题");
  await writeInBody(page, "原稿。");

  await importFromFileMenu(page, fileOf("导入.md", "text/markdown", MARKDOWN_FIXTURE));
  await expect(importDialog(page)).toBeVisible();
  await expect(importDialog(page)).toContainText("替换当前文档？");

  await answerImportDialog(page, "取消");
  await expect(importDialog(page)).toHaveCount(0);
  expect(await textOf(titleBlock(page))).toBe("原标题");
  expect(await textOf(bodyParagraph(page))).toBe("原稿。");

  await importFromFileMenu(page, fileOf("导入.md", "text/markdown", MARKDOWN_FIXTURE));
  await expect(importDialog(page)).toBeVisible();
  await answerImportDialog(page, "替换");
  await expect(importDialog(page)).toHaveCount(0);

  await expect(canvas(page).locator("h1")).toHaveText("导入测试");
  await expect(canvas(page).locator("p").first()).toContainText("加粗");
});

/**
 * The paste path, with the sanitiser the import uses.
 *
 * The paste is a real `ClipboardEvent` carrying `text/html`, dispatched on the
 * editable the same way the browser's paste handler receives one; ProseMirror's
 * own listener is what reads it. The script in the pasted paragraph must not run
 * and must not reach the document.
 */
test("pasted HTML is sanitised, so a script in it does not survive", async ({ page }) => {
  await open(page);
  await bodyParagraph(page).click();

  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData(
      "text/html",
      "<p>粘贴的<strong>内容</strong><script>window.__pastePwned = true</script></p>",
    );
    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: data,
    });
    document.querySelector('[contenteditable="true"]')?.dispatchEvent(event);
  });

  await expect(bodyParagraph(page)).toContainText("粘贴的内容");
  await expect(bodyParagraph(page).locator("strong")).toHaveText("内容");
  expect(await page.evaluate("window.__pastePwned")).toBeUndefined();
  await expect(canvas(page).locator("script")).toHaveCount(0);
});

/**
 * The local draft (#209): what the browser keeps, what the toolbar says about it,
 * and what a returning visit and 清空 do.
 *
 * The store is read through the page's own IndexedDB rather than through a module:
 * the claim is that the browser has the record, and a read through the Tool would
 * agree with a broken writer that never touched the store.
 */
test.describe("the local draft", () => {
  test("typing and pausing writes the draft and reports 已保存到本机", async ({ page }) => {
    await open(page);

    // A fresh context has no draft: the empty document is the state, not a save.
    expect(await storedDraft(page)).toBeNull();
    await expect(saveStatus(page)).toHaveText("已保存到本机");

    await writeInBody(page, "今天写一点东西。");
    await expect(saveStatus(page)).toHaveText("已保存到本机");

    const stored = await storedDraft(page);

    expect(stored?.version, "the record carries its schema version").toBe(1);
    expect(typeof stored?.savedAt, "the record carries a timestamp").toBe("number");
    expect(JSON.stringify(stored?.document), "the record carries the document").toContain(
      "今天写一点东西。",
    );
  });

  test("a reload restores the exact document, with no prompt", async ({ page }) => {
    await open(page);
    await writeInTitle(page, "草稿标题");
    await writeInBody(page, "第一段。");
    await selectBodyText(page);
    await pressAt(page, toolbarControl(page, "加粗"));
    await expect(saveStatus(page)).toHaveText("已保存到本机");

    const dialogs: string[] = [];
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });

    await page.reload();
    await expect(editor(page)).toBeVisible();

    expect(await textOf(titleBlock(page))).toBe("草稿标题");
    expect(await textOf(bodyParagraph(page))).toBe("第一段。");
    // The mark is part of the document, not a class a re-render would drop: the
    // stored JSON is what TipTap opened, so a restore keeps the bold run.
    await expect(bodyParagraph(page).locator("strong")).toHaveText("第一段。");
    expect(dialogs, "restore is silent: no prompt asks whether to open the draft").toEqual([]);
  });

  test("hiding the page writes immediately instead of waiting for the debounce", async ({
    page,
  }) => {
    await open(page);
    await writeInBody(page, "隐藏前写一句。");

    // Hiding in the same evaluate as reading the status is what makes the claim
    // about the flush: if the sentence was still 未保存, the 800ms window had not
    // closed, so only the hidden page's own write can reach 已保存到本机 below.
    const before = await hidePage(page);
    expect(before, "the debounce had not elapsed when the page was hidden").toBe("未保存");

    await expect(saveStatus(page)).toHaveText("已保存到本机");
    expect(await storedDraft(page)).not.toBeNull();
  });

  test("清空 empties the canvas and the stored draft, and a reload finds both empty", async ({
    page,
  }) => {
    await open(page);
    await writeInTitle(page, "要删掉的草稿");
    await writeInBody(page, "这段也会消失。");
    await expect(saveStatus(page)).toHaveText("已保存到本机");
    expect(await storedDraft(page)).not.toBeNull();

    await pressAt(page, fileTrigger(page));
    await pressAt(page, page.getByRole("button", { name: "清空", exact: true }));

    await expect(canvas(page)).not.toContainText("要删掉的草稿");
    await expect(canvas(page)).not.toContainText("这段也会消失。");
    await expect(saveStatus(page)).toHaveText("已保存到本机");
    expect(await storedDraft(page), "the record is removed, not overwritten").toBeNull();

    await page.reload();
    await expect(editor(page)).toBeVisible();

    expect(await textOf(titleBlock(page))).toBe("");
    expect(await textOf(bodyParagraph(page))).toBe("");
    expect(await paintedPlaceholder(titleBlock(page))).toBe(TITLE_PLACEHOLDER);
    expect(await paintedPlaceholder(bodyParagraph(page))).toBe(BODY_PLACEHOLDER);
    expect(await storedDraft(page), "the reload wrote nothing back").toBeNull();
  });

  test("a refused write shows the failure sentence and the retry writes the draft", async ({
    page,
  }) => {
    await open(page);

    /*
     * Refuse exactly one write the way a browser refuses one: `put` throws the
     * quota error a full disk would raise. Every later call is the real method, so
     * the retry has a working store to write into.
     */
    await page.evaluate(() => {
      // oxlint-disable-next-line typescript/unbound-method -- the original is re-bound with `.call(this, ...)` inside the replacement.
      const original = IDBObjectStore.prototype.put;
      let refused = false;

      IDBObjectStore.prototype.put = function (
        this: IDBObjectStore,
        value: unknown,
        key?: IDBValidKey,
      ) {
        if (!refused) {
          refused = true;
          throw new DOMException("the gate refused this write", "QuotaExceededError");
        }

        return original.call(this, value, key);
      };
    });

    await writeInBody(page, "写一句，看看保存失败。");
    await expect(saveStatus(page)).toContainText("保存失败");
    await expect(retrySave(page)).toBeVisible();

    await pressAt(page, retrySave(page));
    await expect(saveStatus(page)).toHaveText("已保存到本机");

    const stored = await storedDraft(page);
    expect(JSON.stringify(stored?.document), "the retry wrote the document that failed").toContain(
      "写一句，看看保存失败。",
    );
  });
});

test.describe("at 390px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the middle groups scroll while the file menu stays put", async ({ page }) => {
    await open(page);

    const scroller = page.locator('[data-slot="rich-text-toolbar-scroll"]');
    const file = fileTrigger(page);

    const before = await file.boundingBox();
    if (before === null) throw new Error("the file menu has no geometry at 390px");
    expect(before.x + before.width).toBeLessThanOrEqual(390);

    const metrics = await scroller.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollLeft: element.scrollLeft,
      scrollWidth: element.scrollWidth,
    }));

    // The row does not fit a phone, and that is the state this claim needs: a
    // toolbar that fitted would scroll nowhere and prove nothing.
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
    expect(metrics.scrollLeft).toBe(0);

    await scroller.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    expect(await scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

    const after = await file.boundingBox();
    if (after === null) throw new Error("the file menu has no geometry after scrolling");
    expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);

    // The scrolling stays inside the row: the page itself does not gain a
    // horizontal scrollbar, which is the other half of "the toolbar scrolls".
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);

    // And the pinned end still works after the middle has moved.
    await pressAt(page, file);
    await expect(page.getByRole("button", { name: "清空", exact: true })).toBeVisible();
  });
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
