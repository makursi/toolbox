import { readFile } from "node:fs/promises";

import { expect, test, type Download } from "@playwright/test";

import {
  BODY_PLACEHOLDER,
  TITLE_PLACEHOLDER,
  altField,
  answerImportDialog,
  blockTrigger,
  bodyParagraph,
  canvas,
  clearDocument,
  deleteImage,
  downloadFromFileMenu,
  dropImage,
  editor,
  fileTrigger,
  hidePage,
  imagePanel,
  imagePanelControl,
  imagesInCanvas,
  importDialog,
  importFromFileMenu,
  insertImageFromToolbar,
  insertTableOfSize,
  linkField,
  notAnImage,
  open,
  openAltPopover,
  oversizedPng,
  paintedPlaceholder,
  pasteImage,
  pngFile,
  pressAt,
  pressTableMenuItem,
  refusalNotice,
  replaceImage,
  replacementPng,
  retrySave,
  saveStatus,
  selectBodyText,
  selectImage,
  selectionControl,
  selectionToolbar,
  slashItem,
  slashMenu,
  slashMenuItems,
  storedDraft,
  tableMenu,
  tableMenuItem,
  tableTrigger,
  textOf,
  titleBlock,
  toolbarControl,
  widthPreset,
  writeInBody,
  writeInTitle,
} from "./rich-text-editor-page";

/**
 * The Rich Text Editor: the page and its placeholders (#206), the toolbar and the
 * command table (#207), the three ways to write without leaving the keyboard (#208),
 * the two exports (#210), the local draft with its save status (#209), the import
 * (#211), the images and tables that travel with the document (#216, #217), and
 * the two formats that now carry them (#219).
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
 * Story 9's shortcuts, the ones the Tool did not get from TipTap for free.
 *
 * The marks, undo/redo, the headings (`Mod-Alt-1`–`3`) and the lists
 * (`Mod-Shift-7`/`8`/`9`) are StarterKit's own keyboard shortcuts, so the gate
 * presses one of each where the claim is that the editor wires them; the link action
 * is the one command with no chain, and `Mod-K` is the Tool's own key for it. Every
 * press here is a real key on the focused canvas: a shortcut that only worked from
 * the toolbar would be the bug this test exists for.
 */
test("the keyboard shortcuts reach a mark, a heading, a list and the link action", async ({
  page,
}) => {
  await open(page);
  await writeInBody(page, "快捷测试。");
  await selectBodyText(page);

  await page.keyboard.press("Control+b");
  await expect(bodyParagraph(page).locator("strong")).toHaveText("快捷测试。");

  // The link is the command whose behaviour is a field, so its shortcut has to
  // open that field rather than run a chain. The address is then applied through
  // the page's own 应用 button, at its coordinates.
  await page.keyboard.press("Control+k");
  await expect(linkField(page)).toBeVisible();
  await linkField(page).fill("https://example.com/keyboard");
  await pressAt(page, page.getByRole("button", { name: "应用", exact: true }));
  await expect(canvas(page).locator('a[href="https://example.com/keyboard"]')).toHaveText(
    "快捷测试。",
  );

  await clearDocument(page);
  await bodyParagraph(page).click();
  await page.keyboard.type("标题快捷键");
  await page.keyboard.press("Control+Alt+1");
  await expect(canvas(page).locator("h1").filter({ hasText: "标题快捷键" })).toBeVisible();

  await clearDocument(page);
  await bodyParagraph(page).click();
  await page.keyboard.type("列表快捷键");
  await page.keyboard.press("Control+Shift+8");
  await expect(canvas(page).locator("ul li").first()).toHaveText("列表快捷键");
});

/**
 * The slash menu: `/` at the start of a paragraph, filtered by typing, moved with
 * the arrow keys, applied with Enter and closed with Escape.
 *
 * The rows are the command table's block commands, so the count and the first row
 * are asserted against what a visitor sees rather than against the table: a table
 * that grew an extra row without the menu drawing it would be invisible here, which
 * is why the count is spelled out (twelve: 正文, three headings, three lists, 引用,
 * 代码块, 分隔线, 图片 and 表格).
 */
test("the slash menu filters by typing, moves with the arrow keys and applies with Enter", async ({
  page,
}) => {
  await open(page);
  await bodyParagraph(page).click();
  await page.keyboard.type("/");

  await expect(slashMenu(page)).toBeVisible();
  await expect(slashMenuItems(page)).toHaveCount(12);
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

/**
 * Tables (#217), driven the way a visitor drives them.
 *
 * The picker and the contextual menu are transient surfaces the hit-area instrument
 * deliberately does not declare; the gate opens them through the toolbar's own 表格
 * button and presses their cells and rows at their coordinates. What is asserted is
 * the table the canvas then holds — rows, header cells, cells and their text — not
 * TipTap's state, so a picker that opened a 3 × 3 for every cell would fail here.
 */
test("the grid picker inserts the rows and columns it was given", async ({ page }) => {
  await open(page);

  // Outside a table the button opens the picker, so it is not a menu trigger.
  await expect(tableTrigger(page)).not.toHaveAttribute("aria-haspopup");

  await insertTableOfSize(page, 2, 3);

  const table = canvas(page).locator("table");
  await expect(table).toHaveCount(1);
  await expect(table.locator("tr")).toHaveCount(2);
  await expect(table.locator("tr").first().locator("th")).toHaveCount(3);
  await expect(table.locator("td")).toHaveCount(3);

  // Inside the table the same button is the contextual menu's trigger.
  await expect(tableTrigger(page)).toHaveAttribute("aria-haspopup", "menu");
});

test("typing in a cell edits that cell", async ({ page }) => {
  await open(page);
  await insertTableOfSize(page, 2, 2);

  const cell = canvas(page).locator("table th").nth(1);
  await cell.click();
  await page.keyboard.type("单元格内容");

  await expect(cell).toHaveText("单元格内容");
});

test("inside a table the trigger becomes 表格 and each row and column action does what it says", async ({
  page,
}) => {
  await open(page);
  await insertTableOfSize(page, 2, 3);

  const table = canvas(page).locator("table");
  const rows = table.locator("tr");
  const firstRowCells = table.locator("tr").first().locator("th, td");

  await pressAt(page, tableTrigger(page));
  await expect(tableMenu(page)).toBeVisible();
  await expect(tableMenu(page).getByRole("menuitem")).toHaveCount(7);

  // The menu is already open, so its first row is pressed where it stands; every
  // later action reopens it, because choosing a row closes it.
  await pressAt(page, tableMenuItem(page, "上方插入行"));
  await expect(rows).toHaveCount(3);

  await pressTableMenuItem(page, "下方插入行");
  await expect(rows).toHaveCount(4);

  await pressTableMenuItem(page, "左侧插入列");
  await expect(firstRowCells).toHaveCount(4);

  await pressTableMenuItem(page, "右侧插入列");
  await expect(firstRowCells).toHaveCount(5);

  await pressTableMenuItem(page, "删除行");
  await expect(rows).toHaveCount(3);

  await pressTableMenuItem(page, "删除列");
  await expect(firstRowCells).toHaveCount(4);

  /*
   * 删除表格 is the one action that ends the table's existence, and the paragraph
   * is part of it: a document that was the title and one table must not end with no
   * block to type into. The keystroke after the deletion is what proves the caret
   * is in that paragraph rather than in the title block.
   */
  await pressTableMenuItem(page, "删除表格");
  await expect(table).toHaveCount(0);
  await expect(tableTrigger(page)).not.toHaveAttribute("aria-haspopup");

  await expect(bodyParagraph(page)).toHaveText("");
  await page.keyboard.type("删除表格后继续写。");
  await expect(bodyParagraph(page)).toHaveText("删除表格后继续写。");
});

/**
 * The slash menu's half of the table insert: it has no second step, so 表格 applies
 * the documented 3 × 3 (`TABLE_DEFAULT_SIZE`) rather than opening the picker.
 *
 * It also deletes the table it just made, so the contract is read after the action
 * rather than only as an insert assertion: after 删除表格 exactly one empty paragraph
 * is left and the caret types into it. The table lands beside the empty body paragraph
 * rather than over it, so this is not `deleteTableLeavingParagraph`'s no-paragraph
 * branch (the note below says why that shape cannot rest in this editor); it is the
 * outcome the ticket promises, asserted on the document the insert produced.
 */
test("the slash menu lists 表格, inserts a 3 × 3 table, and 删除表格 leaves one paragraph", async ({
  page,
}) => {
  await open(page);
  await bodyParagraph(page).click();
  await page.keyboard.type("/");

  await expect(slashItem(page, "表格")).toHaveCount(1);

  await page.keyboard.type("表格");
  await expect(slashMenuItems(page)).toHaveCount(1);
  await expect(slashItem(page, "表格")).toHaveAttribute("aria-current", "true");

  await page.keyboard.press("Enter");

  await expect(slashMenu(page)).toBeHidden();
  const table = canvas(page).locator("table");
  await expect(table).toHaveCount(1);
  await expect(table.locator("tr")).toHaveCount(3);
  await expect(table.locator("tr").first().locator("th")).toHaveCount(3);
  await expect(table.locator("td")).toHaveCount(6);

  /*
   * The caret is put into the table before the menu opens, the way the delete case
   * above does it: 表格 is one button in two states, and which state it opens is the
   * selection's (`useEditorCommandState`'s `inTable`), not a second flag.
   *
   * What is asserted after 删除表格 is the outcome, not which code produced it. The
   * empty body paragraph the slash menu typed into is still in the document — the
   * table goes in beside it, not over it — so this case does not reach
   * `deleteTableLeavingParagraph`'s "no paragraph at all" branch either. A document
   * cannot rest in that shape: StarterKit's trailing-node plugin keeps an empty
   * paragraph at the end, and ProseMirror puts the block beside an empty text block
   * rather than replacing it. The outcome is what the ticket promises, though: exactly
   * one empty paragraph, and the caret types into it. A repair that mistook this for a
   * document without a paragraph would leave a second one behind, and a caret left in
   * the title would lose the first keystroke.
   */
  const paragraphs = editor(page).locator(":scope > p");

  await table.locator("th").first().click();
  await pressTableMenuItem(page, "删除表格");

  await expect(table).toHaveCount(0);
  await expect(paragraphs).toHaveCount(1);
  await expect(bodyParagraph(page)).toHaveText("");
  await page.keyboard.type("删除表格后继续写。");
  await expect(bodyParagraph(page)).toHaveText("删除表格后继续写。");
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
 * command table, applied at the row's own coordinates.
 *
 * Where the row sits — above the words when there is room, below them otherwise,
 * never across them — is the hit-area Instrument's claim
 * (`selection-toolbar-clearance` in `apps/web/scripts/touch-targets.mjs`): that is a
 * geometry reading, and the site's tier rule puts those in `scripts/`. This file
 * holds what the surface does.
 */
test("the selection toolbar offers the marks and the link, and applies them", async ({ page }) => {
  await open(page);
  await writeInBody(page, "选中这一段话。");
  await selectBodyText(page);

  const bar = selectionToolbar(page);
  await expect(bar).toBeVisible();

  for (const label of ["加粗", "斜体", "下划线", "删除线", "行内代码", "链接"]) {
    await expect(selectionControl(page, label)).toBeVisible();
  }

  // The marks it offers are the editor's own, applied at the row's coordinates.
  await pressAt(page, selectionControl(page, "加粗"));
  await expect(bodyParagraph(page).locator("strong")).toHaveCount(1);

  // A caret is the pinned toolbar's state: this row is for a selection only. The
  // click goes to the title block rather than to the paragraph that is selected: a
  // mousedown *inside* a selection is where ProseMirror starts a drag, and whether
  // it also collapses the caret there is not what this line is about — clicking a
  // different block is.
  await titleBlock(page).click();
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
 * The export of a document that is not text (#219).
 *
 * An image and a table are inserted through the page's own controls, and the two
 * files are downloaded through the file menu and read back as bytes. The image's
 * width is the one difference between the formats: the HTML file carries it as the
 * node's inline style, while GFM has no syntax for it, so it is dropped in the
 * Markdown file and only there.
 */
test("an image and a table export in both formats, with the width only in the HTML", async ({
  page,
}) => {
  await open(page);
  await writeInTitle(page, "图文导出");
  await writeInBody(page, "一段正文。");

  await insertImageFromToolbar(page, pngFile("照片.png"));
  await expect(imagesInCanvas(page)).toHaveCount(1);

  await insertTableOfSize(page, 2, 2);
  const table = canvas(page).locator("table");
  await expect(table).toHaveCount(1);

  // The table is written through its own cells, so the exported rows carry words
  // rather than an empty grid that would satisfy a shape-only assertion.
  const header = table.locator("th");
  await header.nth(0).click();
  await page.keyboard.type("项目");
  await header.nth(1).click();
  await page.keyboard.type("数量");

  const body = table.locator("td");
  await body.nth(0).click();
  await page.keyboard.type("甲");
  await body.nth(1).click();
  await page.keyboard.type("1");

  const markdown = await downloadFromFileMenu(page, "导出 Markdown");
  expect(markdown.suggestedFilename()).toBe(`图文导出-${todayStamp()}.md`);

  const markdownBytes = await readDownload(markdown);
  expect(markdownBytes).toContain("![照片](data:image/png;base64,");
  expect(markdownBytes).toContain("| 项目 | 数量 |");
  expect(markdownBytes).toContain("| --- | --- |");
  expect(markdownBytes).toContain("| 甲 | 1 |");
  // The documented degradation: GFM has no width, so the Markdown file cannot be
  // mistaken for one that kept it.
  expect(markdownBytes).not.toContain("width");
  expect(markdownBytes).not.toContain("<img");

  const html = await downloadFromFileMenu(page, "导出 HTML");
  expect(html.suggestedFilename()).toBe(`图文导出-${todayStamp()}.html`);

  const standalone = await readDownload(html);
  expect(standalone).toContain('<img src="data:image/png;base64,');
  expect(standalone).toContain('alt="照片"');
  expect(standalone).toContain('style="width: 100%"');
  expect(standalone).toContain("<thead>");
  expect(standalone).toContain("<tbody>");
  expect(standalone).toContain("<th>项目</th>");
  expect(standalone).toContain("<th>数量</th>");
  expect(standalone).toContain("<td>甲</td>");
  expect(standalone).toContain("<td>1</td>");
});

/**
 * A table picked while the image is still selected keeps the image (#216/#217).
 *
 * The image insert deliberately leaves a `NodeSelection` on the picture — that is how
 * a second insert appends — and the table insert used to run the plain command, which
 * treats that selection as content to replace: the picture vanished and the export
 * carried nothing but the grid. So this case presses nothing on the canvas between
 * the two inserts, and reads the document back through both exports: the blocks
 * survive on screen, and the files prove they are the same document.
 *
 * It is the small, direct version of the export case above; that one is about the two
 * writers, and this one is about the selection the picker inherits.
 */
test("a table inserted while the image is still selected keeps both blocks", async ({ page }) => {
  await open(page);
  await writeInTitle(page, "图文并存");
  await writeInBody(page, "一段正文。");

  await insertImageFromToolbar(page, pngFile("照片.png"));
  await expect(imagesInCanvas(page)).toHaveCount(1);

  // No press between the insert and the picker: the picture is still the selection,
  // which is the state in which the table insert used to replace it.
  await insertTableOfSize(page, 2, 2);
  await expect(imagesInCanvas(page)).toHaveCount(1);
  await expect(canvas(page).locator("table")).toHaveCount(1);

  const markdown = await readDownload(await downloadFromFileMenu(page, "导出 Markdown"));
  expect(markdown).toContain("![照片](data:image/png;base64,");
  expect(markdown).toContain("|  |  |");
  expect(markdown).toContain("| --- | --- |");

  const standalone = await readDownload(await downloadFromFileMenu(page, "导出 HTML"));
  expect(standalone).toContain('<img src="data:image/png;base64,');
  expect(standalone).toContain('alt="照片"');
  expect(standalone).toContain("<table>");
  expect(standalone).toContain("<thead>");
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
 * Images (#216): the three ways in, the node they produce, the measure it fits,
 * and the sentence a refused file is shown.
 *
 * The files are real — a 1×1 PNG's own bytes go in through the page's controls —
 * and the node is read back off the canvas: a `data:` URL in `src`, the file's name
 * in `alt`, and a percentage in the inline style. The load-bearing claim is the
 * data URL: there is no upload service and the CSP allows `img-src 'self'`, so an
 * image that is not carried by the document could not be drawn at all, and a
 * reload is what proves the bytes are in the draft rather than in this page's
 * memory.
 */
test("the toolbar's 插入图片 inserts an image the draft and a reload both keep", async ({
  page,
}) => {
  await open(page);
  await bodyParagraph(page).click();

  await insertImageFromToolbar(page, pngFile("照片.png"));

  const image = imagesInCanvas(page).first();
  await expect(image).toBeVisible();

  const src = await image.getAttribute("src");
  expect(src, "the image's source is the document's own data URL").toMatch(
    /^data:image\/png;base64,/,
  );
  expect(await image.getAttribute("alt")).toBe("照片");
  expect(await image.getAttribute("style")).toContain("width: 100%");

  // The measure is the 720px canvas; the picture fills it and stays inside it.
  const box = await image.boundingBox();
  const measure = await canvas(page).boundingBox();
  if (box === null || measure === null) throw new Error("the image or the canvas has no geometry");

  expect(box.width).toBeLessThanOrEqual(measure.width);
  expect(box.width).toBeGreaterThan(measure.width * 0.8);

  await expect(saveStatus(page)).toHaveText("已保存到本机");

  const stored = await storedDraft(page);
  const document = JSON.stringify(stored?.document);
  expect(document, "the node is in the draft's JSON").toContain('"type":"image"');
  expect(document).toContain("data:image/png;base64,");
  expect(document).toContain('"width":100');
  expect(document).toContain('"alt":"照片"');

  await page.reload();
  await expect(editor(page)).toBeVisible();
  await expect(imagesInCanvas(page)).toHaveCount(1);
  expect(await imagesInCanvas(page).first().getAttribute("src")).toBe(src);
  expect(await imagesInCanvas(page).first().getAttribute("alt")).toBe("照片");
});

test("a dropped image is inserted, and its file name becomes the alt text", async ({ page }) => {
  await open(page);
  // The drop carries bytes, not a caret, so the caret is where a visitor's would be
  // when they drag a file into a document they are writing.
  await bodyParagraph(page).click();
  await dropImage(page, pngFile("拖进来的.png"));

  await expect(imagesInCanvas(page)).toHaveCount(1);
  expect(await imagesInCanvas(page).first().getAttribute("src")).toMatch(
    /^data:image\/png;base64,/,
  );
  expect(await imagesInCanvas(page).first().getAttribute("alt")).toBe("拖进来的");
});

test("a pasted image file is inserted", async ({ page }) => {
  await open(page);
  await bodyParagraph(page).click();

  await pasteImage(page, pngFile("截图.png"));

  await expect(imagesInCanvas(page)).toHaveCount(1);
  expect(await imagesInCanvas(page).first().getAttribute("src")).toMatch(
    /^data:image\/png;base64,/,
  );
  expect(await imagesInCanvas(page).first().getAttribute("alt")).toBe("截图");
});

/**
 * Two of the four refusals, each with the sentence its own rule owns.
 *
 * The other two are the document's: the eleventh image and a document over 40 MB
 * are held by the admission unit tests and by the count case below, because the
 * total case would have to put more than forty megabytes of pictures through the
 * page to reach a sentence that the count case already proves is displayed.
 */
test("a wrong type and an oversize file are each refused with their own sentence", async ({
  page,
}) => {
  await open(page);
  await bodyParagraph(page).click();

  await insertImageFromToolbar(page, notAnImage());
  await expect(refusalNotice(page)).toHaveText("只支持 JPEG、PNG、WebP 和 GIF 图片。");
  await expect(imagesInCanvas(page)).toHaveCount(0);

  await insertImageFromToolbar(page, oversizedPng());
  await expect(refusalNotice(page)).toHaveText(
    "图片太大了：JPEG、PNG、WebP 不超过 5 MB，GIF 不超过 2 MB。",
  );
  await expect(imagesInCanvas(page)).toHaveCount(0);

  // A file the rules take clears the sentence the previous one left.
  await insertImageFromToolbar(page, pngFile("可以.png"));
  await expect(imagesInCanvas(page)).toHaveCount(1);
  await expect(refusalNotice(page)).toHaveCount(0);
});

test("the eleventh image is refused with the document's own sentence", async ({ page }) => {
  await open(page);

  for (let index = 0; index < 10; index += 1) {
    await dropImage(page, pngFile(`第${index + 1}张.png`));
    await expect(imagesInCanvas(page)).toHaveCount(index + 1);
  }

  await insertImageFromToolbar(page, pngFile("第十一张.png"));

  await expect(refusalNotice(page)).toHaveText("一份文档最多放十张图片。");
  await expect(imagesInCanvas(page)).toHaveCount(10);
});

/**
 * The slash menu's 图片 row, and the two-step it takes to run.
 *
 * 图片 is interface-shaped like the link: it has no TipTap chain, so `runCommand`
 * answers `false` and the surface that owns the file input opens it. The proof is
 * the chooser the menu's Enter raises and the node that arrives from it; the typed
 * `/图片` is the filter, so it must not be left in the document.
 */
test("the slash menu lists 图片, and applying it opens the same insert", async ({ page }) => {
  await open(page);
  await bodyParagraph(page).click();
  await page.keyboard.type("/图片");

  await expect(slashMenuItems(page)).toHaveCount(1);
  await expect(slashItem(page, "图片")).toHaveAttribute("aria-current", "true");

  const chooser = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  await (await chooser).setFiles(pngFile("菜单.png"));

  await expect(slashMenu(page)).toBeHidden();
  await expect(imagesInCanvas(page)).toHaveCount(1);
  expect(await imagesInCanvas(page).first().getAttribute("alt")).toBe("菜单");
  await expect(canvas(page)).not.toContainText("/图片");
});

/**
 * The image panel (#218): the four controls an image gets while it is selected.
 *
 * Every case starts by pressing the picture, because that is how a visitor selects
 * one and the panel exists only in that state. What is asserted is the document's
 * own answer — the `style` the image is drawn with, the `alt` a screen reader reads,
 * whether the node is still there, and the JSON the draft stores — never the panel's
 * internals. The panel is transient, so the hit-area Instrument does not declare it;
 * these presses at coordinates are what proves its controls are reachable.
 */
test("selecting an image shows the panel, and a text selection hides it", async ({ page }) => {
  await open(page);
  await bodyParagraph(page).click();
  await insertImageFromToolbar(page, pngFile("面板.png"));

  await expect(imagesInCanvas(page)).toHaveCount(1);
  await expect(imagePanel(page)).toHaveCount(0);

  await selectImage(page);

  await expect(imagePanel(page)).toBeVisible();
  await expect(imagePanelControl(page, "替换")).toBeVisible();
  await expect(imagePanelControl(page, "替代文本")).toBeVisible();
  await expect(imagePanelControl(page, "删除")).toBeVisible();
  for (const percent of [25, 50, 75]) {
    await expect(widthPreset(page, percent)).toBeVisible();
  }
  // 100 % is the width a fresh image already has, so its preset says so.
  await expect(widthPreset(page, 100)).toHaveAttribute("aria-pressed", "true");

  // A caret somewhere else is no longer an image selection, and the panel is gone
  // rather than hidden: a row of invisible buttons is a row of targets that answer
  // nowhere.
  await titleBlock(page).click();
  await expect(imagePanel(page)).toHaveCount(0);
});

test("each width preset changes the drawn width and the stored width", async ({ page }) => {
  await open(page);
  await bodyParagraph(page).click();
  await insertImageFromToolbar(page, pngFile("宽度.png"));
  await expect(saveStatus(page)).toHaveText("已保存到本机");

  await selectImage(page);
  await expect(imagePanel(page)).toBeVisible();

  const image = imagesInCanvas(page).first();
  const full = await image.boundingBox();
  if (full === null) throw new Error("the image has no geometry");

  for (const percent of [50, 25, 75]) {
    await pressAt(page, widthPreset(page, percent));

    /*
     * The style is read as a substring rather than compared whole: ProseMirror
     * writes it through `style.cssText`, so the browser serialises it back with its
     * own spacing and a trailing semicolon. The percentage is the claim; the
     * serialisation is the browser's.
     */
    expect(await image.getAttribute("style")).toContain(`width: ${percent}%`);
    await expect(widthPreset(page, percent)).toHaveAttribute("aria-pressed", "true");

    const box = await image.boundingBox();
    if (box === null) throw new Error(`the image has no geometry at ${percent}%`);

    // The picture is drawn at the share of the measure the preset names, measured
    // against the width it had at 100 %: a percentage is only meaningful relative to
    // the measure, and this is that ratio in pixels.
    expect(Math.abs(box.width - (full.width * percent) / 100)).toBeLessThan(2);
  }

  // The node's attribute is document content, so the draft carries the last preset.
  await expect(saveStatus(page)).toHaveText("未保存");
  await expect(saveStatus(page)).toHaveText("已保存到本机");
  expect(JSON.stringify((await storedDraft(page))?.document)).toContain('"width":75');

  await page.reload();
  expect(await imagesInCanvas(page).first().getAttribute("style")).toContain("width: 75%");
});

test("替代文本 sets the alt, and a reload keeps it", async ({ page }) => {
  await open(page);
  await bodyParagraph(page).click();
  await insertImageFromToolbar(page, pngFile("照片.png"));
  await expect(imagesInCanvas(page).first()).toHaveAttribute("alt", "照片");
  await expect(saveStatus(page)).toHaveText("已保存到本机");

  await selectImage(page);
  await openAltPopover(page);

  // The field opens holding what the document says now, so reopening is an edit.
  await expect(altField(page)).toHaveValue("照片");

  await altField(page).fill("一只在海边的猫");
  await pressAt(page, page.getByRole("button", { name: "应用", exact: true }));

  await expect(imagesInCanvas(page).first()).toHaveAttribute("alt", "一只在海边的猫");

  await expect(saveStatus(page)).toHaveText("未保存");
  await expect(saveStatus(page)).toHaveText("已保存到本机");
  expect(JSON.stringify((await storedDraft(page))?.document)).toContain('"alt":"一只在海边的猫"');

  await page.reload();
  await expect(imagesInCanvas(page)).toHaveCount(1);
  await expect(imagesInCanvas(page).first()).toHaveAttribute("alt", "一只在海边的猫");
});

test("删除 removes the image, and undo brings it back", async ({ page }) => {
  await open(page);
  await bodyParagraph(page).click();
  await insertImageFromToolbar(page, pngFile("要删掉的.png"));
  await expect(imagesInCanvas(page)).toHaveCount(1);

  await selectImage(page);
  await deleteImage(page);

  await expect(imagesInCanvas(page)).toHaveCount(0);
  await expect(imagePanel(page)).toHaveCount(0);

  await pressAt(page, toolbarControl(page, "撤销"));

  await expect(imagesInCanvas(page)).toHaveCount(1);
  expect(await imagesInCanvas(page).first().getAttribute("alt")).toBe("要删掉的");
  expect(await imagesInCanvas(page).first().getAttribute("style")).toContain("width: 100%");
});

test("替换 swaps the bytes, and a refused replacement leaves the image unchanged", async ({
  page,
}) => {
  await open(page);
  await bodyParagraph(page).click();
  await insertImageFromToolbar(page, pngFile("第一张.png"));
  await expect(imagesInCanvas(page)).toHaveCount(1);

  const before = await imagesInCanvas(page).first().getAttribute("src");

  await selectImage(page);

  // A file the rules refuse: the sentence says which rule, and the picture keeps
  // every byte it had, including the alt text the visitor can still edit.
  await replaceImage(page, notAnImage());

  await expect(refusalNotice(page)).toHaveText("只支持 JPEG、PNG、WebP 和 GIF 图片。");
  expect(await imagesInCanvas(page).first().getAttribute("src")).toBe(before);
  expect(await imagesInCanvas(page).first().getAttribute("alt")).toBe("第一张");

  // A file they take: the bytes are the new file's, and the alt and the width are
  // the ones the document already held, because replacing a picture is not editing
  // the visitor's description of it.
  await replaceImage(page, replacementPng());

  const after = await imagesInCanvas(page).first().getAttribute("src");
  expect(after, "the source is the new file's own data URL").not.toBe(before);
  expect(after).toMatch(/^data:image\/png;base64,/);
  expect(await imagesInCanvas(page).first().getAttribute("alt")).toBe("第一张");
  expect(await imagesInCanvas(page).first().getAttribute("style")).toContain("width: 100%");
  // A file the rules take clears the sentence the refused one left.
  await expect(refusalNotice(page)).toHaveCount(0);
  // One image, not two: a replacement is not an insert.
  await expect(imagesInCanvas(page)).toHaveCount(1);
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

  /*
   * The toolbar's middle groups scrolling while its right end stays put is a
   * geometry claim, and it moved to the hit-area Instrument
   * (`toolbar-scroll-end`). What is left for the gate is the behaviour a visitor
   * needs on a phone: the pinned end still opens, and every row in it is there.
   */
  test("the pinned file menu still opens", async ({ page }) => {
    await open(page);

    await pressAt(page, fileTrigger(page));

    await expect(page.getByRole("button", { name: "导入", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "导出 Markdown", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "导出 HTML", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "清空", exact: true })).toBeVisible();
  });

  /*
   * The image panel at 390px (#218).
   *
   * The ticket asks for a bar that stays inside the viewport on a phone, and the
   * screen is the only place that can be shown: the panel is a transient surface, so
   * the hit-area Instrument does not open it, and the rule that places it is
   * arithmetic in `core/image-panel.ts` with its own unit tests. What is left here is
   * the one claim arithmetic cannot make — that the browser draws the real bar
   * inside the real screen, and off the picture it edits.
   */
  test("the image panel is drawn inside the viewport and clear of the image", async ({ page }) => {
    await open(page);
    await bodyParagraph(page).click();
    await insertImageFromToolbar(page, pngFile("窄屏.png"));
    await selectImage(page);

    const panel = imagePanel(page);
    await expect(panel).toBeVisible();

    const bar = await panel.boundingBox();
    const picture = await imagesInCanvas(page).first().boundingBox();
    const viewport = page.viewportSize();
    if (bar === null || picture === null || viewport === null) {
      throw new Error("the panel, the image or the viewport has no geometry");
    }

    expect(bar.x).toBeGreaterThanOrEqual(0);
    expect(bar.y).toBeGreaterThanOrEqual(0);
    expect(bar.x + bar.width).toBeLessThanOrEqual(viewport.width);
    expect(bar.y + bar.height).toBeLessThanOrEqual(viewport.height);

    // Above the picture or below it, never on it: the bar edits the image, so it
    // may not hide the thing it is editing.
    const clear = bar.y + bar.height <= picture.y || bar.y >= picture.y + picture.height;
    expect(
      clear,
      `a bar at ${bar.y}…${bar.y + bar.height} covers ${picture.y}…${picture.y + picture.height}`,
    ).toBe(true);
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
