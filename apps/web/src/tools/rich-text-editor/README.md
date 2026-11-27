# Rich Text Editor

A place to write on this site: one document at a time, edited in the browser, with
nothing requested from anywhere after the page has loaded. The canonical document is
ProseMirror JSON, and its title is the document's own first line rather than a second
input beside the canvas.

This slice (#211) adds the import. The file menu's 导入 row opens a hidden file
input that accepts `.md` and `.html`; the file is read as text, parsed, and put
back into the editor through TipTap's own `setContent`. Markdown is parsed to
ProseMirror JSON by the Tool's pure reader (`core/markdown-import.ts`); HTML is
sanitised by `core/html-import.ts` and then parsed by TipTap, so the final
document is the editor's schema in both cases. When the draft already says
something, an alert dialog asks before it is replaced, and cancelling leaves the
draft untouched. The same HTML sanitiser runs on the editor's paste path, so
pasted markup loses its scripts, styles and head material by the same rule.

The previous slice (#210) added the two exports. The file menu offers 导出 Markdown
and 导出 HTML, and each one writes the document's current bytes to a download:
GitHub Flavored Markdown with underline as the one inline HTML construct, or a
complete standalone HTML document with a doctype, a charset, the document's title
and an embedded stylesheet. The file is named from the sanitised title and today's
date, falling back to 文档-YYYY-MM-DD when the document has no title. There is no
filename field: the document names itself.

The toolbar (#207) is what the document is written with. A visitor can start
writing, turn a paragraph into 标题 1–3 and back, mark a selection bold, italic,
underlined, struck through or inline code, make bulleted, numbered and task lists
(nested, and a task can be checked), insert a quote, a code block and a rule, set,
edit and remove a link on selected text, undo and redo, and clear the document from
the file menu. The toolbar reads the state at the cursor, so a mark that is on says
so and the block menu names the block the caret is in.

Everything the toolbar can do comes from one table in the Tool's pure core
(`core/commands.ts`). The toolbar renders it; the slash menu in #208 will render the
same table. What each command _does_ is a TipTap chain in the toolbar's executor map,
and that map is typed `Record<CommandId, () => void>`, so a command in the table with
no handler is a `tsc` error rather than a dead button.

What is deliberately **not here yet**, and lands in its own ticket: the slash menu,
Markdown input rules, the selection toolbar (#208), and autosave and restore (#209).
The Tool's cover landed in #212 and is the homepage card's illustration; it does not
change this page. Nothing is saved yet either: a reload gives a fresh empty document,
which is the current state rather than a bug. The page is known to both instruments
and to the browser gate, so none of this is unmeasured.

The Tool's own design rules, the command table's contract, the toolbar's groups and
hit areas, the import, export and filename rules, the two placeholders and why the
canvas is not a `.touch-target`, are in [`rules.md`](./rules.md).

## Layout

```
RichTextEditor.tsx              the writing surface: TipTap, the extensions, the canvas typography, the paste sanitiser
toolbar/toolbar.tsx             the toolbar, the block menu, the link popover, the file menu, the import and the downloads
core/commands.ts                the one command table, and the filter the slash menu will use
core/document.ts                what an empty document is, whether it says anything, and where its title comes from
core/markdown.ts                ProseMirror JSON to GFM
core/markdown-import.ts         GFM to ProseMirror JSON
core/html.ts                    ProseMirror JSON to a complete standalone HTML document
core/html-import.ts             sanitised HTML for the import and paste paths
core/import.ts                  which format a chosen file is, and the picker's accept value
core/naming.ts                  the export filename rule: sanitised title, date, extension
core/__tests__/commands.test.ts the table's contract in Vitest
core/__tests__/document.test.ts the title, and the emptiness the import asks about
core/__tests__/markdown.test.ts the Markdown writer, in GFM's terms
core/__tests__/markdown-import.test.ts the Markdown reader, in the writer's terms
core/__tests__/html.test.ts     the standalone document and its escaping
core/__tests__/html-import.test.ts the sanitiser: kept blocks, dropped scripts, importable task lists
core/__tests__/import.test.ts   the format rule, by name and then by content
core/__tests__/naming.test.ts   the filename rule, including the empty-title fallback
meta.ts                         the Tool Registry entry
rules.md                        this Tool's own rules, linked from this file
README.md                       this file: what it does, its files, a run, and the checklist
```

```
apps/web/e2e/
  rich-text-editor-page.ts   the gate's page actions: open, type, select, press a control at its coordinates
  rich-text-editor.spec.ts   what the gate asserts on every pull request
```

The two page entries the instruments carry are not files: one line in
`apps/web/scripts/touch-targets.mjs` names this page and its always-visible controls,
and one line in `apps/web/scripts/ui-fingerprint.mjs` declares its anchors. The
fingerprint's baseline is a local file, not a repository one.

## How a run works

1. **Open.** The route renders the shared `ToolPage` shell, a toolbar-shaped
   placeholder and an empty canvas. The editor is created in an effect after
   hydration (`immediatelyRender: false`), so the server never renders a
   contenteditable and the visitor's first cursor is never reconciled with server
   HTML. The placeholder is the toolbar's own height, so the canvas does not jump
   when the toolbar arrives.
2. **Start.** The document is a `doc` with two empty text blocks: a `heading` at
   level 1 and a `paragraph`. The Placeholder extension paints 无标题 on the empty
   title heading and 开始写吧，输入 `/` 插入内容 on the document's first body block. An
   empty line the visitor makes with Enter paints nothing: that sentence is about an
   empty document, not about every empty line.
3. **Type.** A click puts the caret in a block and a real keyboard writes into it.
   The first keystroke in the paragraph makes it non-empty, so its placeholder
   disappears; the title's sentence stays until the title itself is typed.
4. **Format.** Every toolbar control is a real `<button>` with its own 44px box.
   Pressing a mark toggles it on the selection and sets `aria-pressed`; the block
   menu names the block at the cursor and replaces it; lists nest with Tab and a task
   item's checkbox is the item's own state; quote and code block toggle their block,
   the rule inserts one; the link action opens one field and sets, edits or removes
   the link on the selection. Undo and redo work from the toolbar and from the
   keyboard, because they are the editor's own history.
5. **Read back.** The text is the editor's own document: the gate reads it from the
   contenteditable after typing, and the blocks are not re-seeded from the initial
   content when the page renders again.
6. **Export.** The file menu's 导出 Markdown and 导出 HTML ask the editor for its
   JSON and hand it to the pure writer for that format. The writer returns a string;
   the toolbar wraps it in a blob, mints a temporary object URL, clicks an anchor
   named by `core/naming.ts`, and revokes the URL on the next task. The browser
   saves the file, so the gate can read the bytes back. The name is the sanitised
   title and today's local date with the format's extension, capped at 40 title
   characters, or 文档 with the date when the document has no title. An empty
   document exports as an empty Markdown file and an HTML file whose article is
   empty; both are still complete files.
7. **Import.** The file menu's 导入 row opens the hidden file input. The chosen file
   is read as text and its format is decided by `core/import.ts` from the extension
   (falling back to the content when the name says nothing). Markdown goes through
   `documentFromMarkdown` to JSON; HTML goes through `sanitizeHtml` and then through
   TipTap's `setContent`, whose DOMParser is the final word on the document either
   way. If the draft says anything (`isEmptyDocument`), an alert dialog asks first:
   cancelling closes it and changes nothing, confirming replaces the document. The
   input's value is cleared after every choice, so importing the same file twice
   works. A file that sanitises to nothing leaves the empty document, and a paste of
   HTML takes the same sanitiser through `transformPastedHTML` before ProseMirror
   sees it.

The extension set is the minimum the slices after this one need: `StarterKit` (with
Link configured `openOnClick: false`), `TaskList` and `TaskItem` from
`@tiptap/extension-list`, and `Placeholder` from `@tiptap/extensions`. The import
added no dependency: both parsers are the Tool's own code, and the confirmation's
`alert-dialog.tsx` is generated from the `radix-ui` package the component layer
already uses. No third-party asset came with it either; the TipTap tree arrived in
`chore(web): the TipTap tree at V1's minimum` and is the dependency expansion the
Tool's spec records.

## What CI covers, and what is still yours

CI runs `fmt:check`, the docs checks, `lint`, `typecheck`, `test`, `build`, `pnpm e2e`,
and the hit-area instrument (`touch-targets`, with `--falsify`). The gate
(`apps/web/e2e/rich-text-editor.spec.ts`) drives the production build in a real
browser and covers the items marked **▣**:

- ▣ A fresh page shows both placeholders; they are read off the `::before` that
  paints them, because they are decoration rather than document content.
- ▣ The first keystroke in the body replaces the body's placeholder, leaves the
  title's, and the typed text reads back out of the contenteditable.
- ▣ Text typed into a paragraph survives a page-wide change and the document
  rendering again around a second block.
- ▣ Each of the five inline marks is pressed **at its coordinates**, applies to the
  selection, shows `aria-pressed="true"`, and removes itself on the second press.
- ▣ The block menu names the current block and turns the body paragraph into 标题 1,
  标题 2 and 标题 3 and back to 正文.
- ▣ A bulleted list nests with Tab, and a task item's checkbox checks the item
  (`data-checked` flips, the input is checked).
- ▣ 引用, 代码块 and 分隔线 insert their block, and the file menu's 清空 empties the
  document and brings the body placeholder back.
- ▣ The link action sets a link on selected text, reopens with its address prefilled,
  edits it, and removes it.
- ▣ Undo and redo work from the keyboard (`Control+z`, `Control+Shift+z`) and from
  the toolbar's own buttons.
- ▣ At 390px the middle groups scroll horizontally while the file menu's position
  does not move, the page itself does not overflow, and the file menu still opens.
- ▣ The file menu downloads both formats: the Markdown file is the document as GFM,
  the HTML file is a complete document with its title in `<title>` and an embedded
  stylesheet, and each file's name is the sanitised title, today's date and the
  format's extension.
- ▣ A document with no title exports as `文档-YYYY-MM-DD.md` and
  `文档-YYYY-MM-DD.html`, and the HTML file's `<title>` is 无标题.
- ▣ 导入 a Markdown file through the file menu produces the fixture's headings,
  paragraph and its marks, nested bulleted and ordered lists, checked and unchecked
  task items, quote, fenced code with its language, link and rule; the imported
  document is editable, and exporting it again carries the added words.
- ▣ 导入 an HTML file produces the same blocks, and its `<head>`, stylesheet and
  script do not survive: the script's global is undefined, and the canvas holds no
  `<script>`, `<style>` or `<title>`.
- ▣ A non-empty draft asks 替换当前文档？ before the import; 取消 leaves the title and
  the body exactly as typed, and 替换 replaces them.
- ▣ Pasted HTML is sanitised by the editor's own paste path: a pasted `<script>`
  does not run and does not reach the document, while the pasted words and their
  marks do.
- ▣ The Tool has a homepage card linking to its route and an entry in `/sitemap.xml`.
- ▣ Typing, formatting, exporting both formats and importing a file reaches nothing
  off this origin, prints no console error or warning, and raises no uncaught error
  (`apps/web/e2e/no-outbound-requests.spec.ts`).

`pnpm test` covers the command table (ids are unique, every command has a label and
keywords, `commandsInGroup` keeps the table's order, `filterCommands` matches by
keyword and returns the table's order, and an empty query returns the whole table),
the Markdown writer (headings, both kinds of list and their nesting, task items and
their checked state, quotes, fenced code with its language and backtick growth,
rules, every mark with underline as inline HTML, links, hard breaks, escaping, and
the empty document's empty string), the standalone-HTML writer (doctype, charset,
title, embedded stylesheet, every block and mark, escaping, and both fallbacks), the
filename rule (title, date padding, invalid characters, the 40-character cap and the
empty-title fallback), the document's title and emptiness, the import format rule,
the Markdown reader (the writer's constructs read back, nested lists and task items,
hard and soft breaks, the export's `<u>` underline, escapes, unknown syntax kept as
text, and no throw on malformed input), and the HTML sanitiser (kept blocks, head and
scripts dropped, unsafe links unwrapped, the export's task list read back into the
editor's markup, entity round-tripping, and no throw on malformed markup). The one
structural claim a unit test cannot make, that every id has an executor, is the typed
executor map in `toolbar/toolbar.tsx`: `tsc` is what holds it.

Still by hand: opening the page in both colour schemes and reading the toolbar, the
pressed state, the canvas and its placeholders against the palette; typing Chinese
through a real IME, which a Playwright keyboard does not simulate (the gate types
characters, not composition events); whether a screen reader announces the two
placeholders, the toolbar's name and each control's state; focus order through the
toolbar and the popovers; the canvas's line becoming ink while the editing surface
holds the focus; and the whole page at 360, 375, 390, 768 and 1024 px looking for
horizontal overflow, a toolbar that scrolls where it should, and a canvas that still
reads as a page.

## Manual QA checklist

`▣` marks what the browser gate asserts on every pull request, from
`apps/web/e2e/rich-text-editor.spec.ts`. An unmarked item is a person's: no machine
here re-runs it.

### The gate already asserts

- [ ] **▣** An empty document paints 无标题 on the title block and
      开始写吧，输入 `/` 插入内容 on the body paragraph.
- [ ] **▣** The editor is a textbox named 文档内容.
- [ ] **▣** The first keystroke in the body replaces the body's placeholder, the
      body reads back the typed text, and the title's placeholder is still painted.
- [ ] **▣** A real keyboard types a sentence into the body; it reads back exactly.
- [ ] **▣** The text survives the scheme switch and a second block being typed
      above it: the document is not re-seeded from the initial content.
- [ ] **▣** Typing the title replaces the title's placeholder, and both placeholders
      are gone once both blocks have text.
- [ ] **▣** Each of 加粗, 斜体, 下划线, 删除线 and 行内代码 toggles on and off when
      pressed at its coordinates, and its button's `aria-pressed` follows.
- [ ] **▣** The block menu names 正文 / 标题 1 / 标题 2 / 标题 3 as the caret moves,
      and each level turns the paragraph into that heading and back.
- [ ] **▣** 项目符号列表 nests a second item with Tab, and 任务列表's checkbox checks
      the item.
- [ ] **▣** 引用, 代码块 and 分隔线 insert their block; 清空 empties the document.
- [ ] **▣** 链接 sets, edits and removes a link on selected text.
- [ ] **▣** 撤销 and 重做 work from the toolbar and from the keyboard.
- [ ] **▣** 导出 Markdown downloads a GFM file whose bytes are the document, and the
      filename is `<title>-YYYY-MM-DD.md`.
- [ ] **▣** 导出 HTML downloads a complete document with a doctype, a charset, the
      title in `<title>` and an embedded stylesheet, and the filename is
      `<title>-YYYY-MM-DD.html`.
- [ ] **▣** An untitled document's exports are named `文档-YYYY-MM-DD.<ext>`, and the
      HTML file's `<title>` is 无标题.
- [ ] **▣** 导入 a Markdown file through the file menu produces the fixture's
      headings, paragraph and its marks, nested lists, checked and unchecked task
      items, quote, fenced code with its language, link and rule; the imported
      document is editable, and exporting it again carries the added words.
- [ ] **▣** 导入 an HTML file produces the same blocks, and its `<head>`, stylesheet
      and script do not survive.
- [ ] **▣** A non-empty draft asks 替换当前文档？ before the import; 取消 leaves the
      title and the body untouched, and 替换 replaces them.
- [ ] **▣** Pasted HTML is sanitised by the editor's own paste path: a pasted
      `<script>` does not run or reach the document, while its words and marks do.
- [ ] **▣** At 390px the middle groups scroll, the file menu does not move, and the
      page does not gain a horizontal scrollbar.
- [ ] **▣** The homepage card links to `/tools/rich-text-editor`, and the sitemap
      lists the route.
- [ ] **▣** The page makes no request off this origin while typing, formatting,
      exporting both formats and importing a file, writes no console error or
      warning, and raises no uncaught error.

### A person must still check

- [ ] Both colour schemes: the toolbar's hairlines, the pressed ink state, the
      canvas's type and the two placeholder sentences are readable, and the
      placeholder colour is the measured one.
- [ ] The import confirmation in both schemes: the overlay dims the page rather than
      washing it out, the title and the description read as one question, focus lands
      on 取消, Escape cancels, Tab reaches both buttons, and both are 44px tall.
- [ ] A real file from another Markdown tool: tables, images, reference-style links
      and other syntax this reader does not know stay as their words rather than
      refusing or crashing, and the blocks it does know keep their order.
- [ ] A full page saved from a browser as HTML: its head, scripts, styles and layout
      wrappers are gone, its lists, quotes, code and links survive, and a
      `javascript:` link arrives as plain text.
- [ ] Pasting rich content copied from another tab: the words and the marks are
      kept, the scripts and styles are not, and the pasted link does not carry an
      event handler.
- [ ] Chinese input through a real IME composes into the paragraph and the first
      committed character takes the body placeholder away. The gate types
      characters, not composition events.
- [ ] A screen reader announces the editing surface as 文档内容, the toolbar as
      格式工具栏, each icon control by its name, the pressed state of a mark, and the
      block menu as 块类型：<当前块>; whether it also reads the placeholders (they are
      CSS `::before` content, which screen readers are not obliged to announce).
- [ ] Tab reaches the toolbar controls in order, Enter or Space presses a toggle,
      the block menu and the file menu open and close with the keyboard, and Escape
      closes the link popover.
- [ ] Tab reaches the editing surface, the canvas's hairline becomes ink while it
      holds the focus (not the browser's blue ring), the caret is visible, and the
      line is back to the hairline after the focus leaves.
- [ ] At 360, 375, 390, 768 and 1024 px the canvas keeps its reading measure, the
      toolbar scrolls sideways where it must and keeps its right end in place, the
      page does not scroll sideways, and every toolbar control keeps its 44px hit
      area (the instrument prints the numbers; a person reads the page).
- [ ] Pressing Enter at the end of the paragraph creates a second paragraph that
      paints no placeholder of its own: the starting sentence belongs to the
      document's first body block, not to every empty line.
- [ ] A heading made in the body and left empty paints no 无标题: that sentence
      belongs to the document's first block, not to every heading.
- [ ] The link popover opens with the caret in the field, an address without a
      scheme is read as `https`, and the remove action appears only when the
      selection is a link.
- [ ] The exported HTML opens on its own from the filesystem in another browser
      profile: its tab reads the document title, the stylesheet is the file's own,
      the nesting and the checked task item read, and nothing is requested.
- [ ] The exported Markdown opens in a GFM viewer: the headings, nested lists,
      checked task item, quote, fenced code with its language, rule and link read as
      the document, and underline shows as underlined text in a viewer that renders
      inline HTML (and as `<u>` where it does not, which is the one construct GFM
      has no form for).
- [ ] A long title is cut at 40 characters in the filename, an empty one falls back
      to 文档, and the file menu at 390px still shows 导入, 导出 Markdown, 导出 HTML
      and 清空 inside the viewport.
- [ ] A long code line scrolls inside its block instead of widening the canvas, and
      a checked task item's line-through and dimmed text are legible in both schemes.
