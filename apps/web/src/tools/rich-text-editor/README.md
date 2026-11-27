# Rich Text Editor

A place to write on this site: one document at a time, edited in the browser, with
nothing requested from anywhere after the page has loaded. The canonical document is
ProseMirror JSON, and its title is the document's own first line rather than a second
input beside the canvas. The draft lives in this browser's IndexedDB, and the toolbar
says what happened to it.

This slice (#209) adds the local draft. Typing schedules a write 800ms after the last
change, and hiding the page writes immediately instead of waiting; the toolbar's right
end reports 未保存, 保存中, 已保存到本机, or 保存失败 with a retry. A returning visit
opens the stored document silently, with no prompt, and 清空 in the file menu empties
the canvas and removes the stored record. There is no document size limit: a browser
refusal to write is the only failure.

The toolbar itself landed in #207: a visitor can turn a paragraph into 标题 1–3 and
back, mark a selection bold, italic, underlined, struck through or inline code, make
bulleted, numbered and task lists (nested, and a task can be checked), insert a quote,
a code block and a rule, set, edit and remove a link on selected text, undo and redo.
The toolbar reads the state at the cursor, so a mark that is on says so and the block
menu names the block the caret is in.

Everything the toolbar can do comes from one table in the Tool's pure core
(`core/commands.ts`). The toolbar renders it; the slash menu in #208 will render the
same table. What each command _does_ is a TipTap chain in the toolbar's executor map,
and that map is typed `Record<CommandId, () => void>`, so a command in the table with
no handler is a `tsc` error rather than a dead button.

What is deliberately **not here yet**, and lands in its own ticket: the slash menu,
Markdown input rules and the selection toolbar (#208), export (#210) and import
(#211). The Tool's cover landed in #212 and is the homepage card's illustration; it
does not change this page. The page is known to both instruments and to the browser
gate, so none of this is unmeasured.

The Tool's own design rules, the command table's contract, the toolbar's groups and
hit areas, the save-state machine and its sentences, the two placeholders and why the
canvas is not a `.touch-target`, are in [`rules.md`](./rules.md).

## Layout

```
RichTextEditor.tsx                the writing surface: the draft gate, TipTap, the extensions, the canvas typography
toolbar/toolbar.tsx               the toolbar, the block menu, the link popover, the save status, the file menu, the executor map
core/commands.ts                  the one command table, and the filter the slash menu will use
core/document.ts                  what an empty document is, for the editor and for 清空
core/draft.ts                     the stored record's shape, its schema version and the guard that reads it back
core/save.ts                      the save-state machine: the 800ms debounce, the flush, the retry and old-revision rejection
core/copy.ts                      the four save-state sentences and the retry label
draft/draft-store.ts              the hand-written IndexedDB store: open, read, write, remove
hooks/use-draft/use-draft.ts      the timer, the store and React: silent restore, debounce, flush, retry, clear
core/__tests__/commands.test.ts   the table's contract in Vitest
core/__tests__/save.test.ts       the state machine's transitions in Vitest
core/__tests__/copy.test.ts       the save status's wording and punctuation in Vitest
core/__tests__/draft.test.ts      the stored record's guard in Vitest
meta.ts                           the Tool Registry entry
rules.md                          this Tool's own rules, linked from this file
README.md                         this file: what it does, its files, a run, and the checklist
```

```
apps/web/e2e/
  rich-text-editor-page.ts   the gate's page actions: open, type, select, press a control at its coordinates, read the store
  rich-text-editor.spec.ts   what the gate asserts on every pull request
```

The page entry the instruments carry is not a file: one line in
`apps/web/scripts/touch-targets.mjs` names this page and its always-visible controls,
and one line in `apps/web/scripts/ui-fingerprint.mjs` declares its anchors, including
`rich-text-save-status`. The fingerprint's baseline is a local file, not a repository
one.

## How a run works

1. **Open.** The route renders the shared `ToolPage` shell, a toolbar-shaped
   placeholder and an empty canvas. The editor is created in an effect after
   hydration (`immediatelyRender: false`), and only once the draft store has answered,
   so the server never renders a contenteditable and a late restore never lands on a
   cursor that is already typing. The placeholder is the toolbar's own height, so the
   canvas does not jump when the editor arrives.
2. **Restore.** One IndexedDB record is read before the editor exists: a schema
   version, the ProseMirror JSON document and its timestamp. A valid record becomes
   the editor's initial content, silently and with no prompt. No record, or one this
   build cannot read, is simply the empty document; a failed read is an empty canvas
   rather than a failure the visitor has to answer.
3. **Start.** The empty document is a `doc` with two empty text blocks: a `heading`
   at level 1 and a `paragraph`. The Placeholder extension paints 无标题 on the empty
   title heading and 开始写吧，输入 `/` 插入内容 on the document's first body block. An
   empty line the visitor makes with Enter paints nothing: that sentence is about an
   empty document, not about every empty line.
4. **Type.** A click puts the caret in a block and a real keyboard writes into it.
   The first keystroke in the paragraph makes it non-empty, so its placeholder
   disappears; the title's sentence stays until the title itself is typed.
5. **Save.** Each change moves the status to 未保存 and starts an 800ms window. When
   it closes the status is 保存中 while the record is written, then 已保存到本机. A
   change during a write starts its own window and makes the older completion stale,
   so a slow write cannot report "saved" over text it never saw. Hiding the page
   writes at once instead of waiting; if the browser refuses the write, the status
   says 保存失败，草稿还在页面上。 and a 重试 control re-attempts exactly the operation
   that failed.
6. **Format.** Every toolbar control is a real `<button>` with its own 44px box.
   Pressing a mark toggles it on the selection and sets `aria-pressed`; the block
   menu names the block at the cursor and replaces it; lists nest with Tab and a task
   item's checkbox is the item's own state; quote and code block toggle their block,
   the rule inserts one; the link action opens one field and sets, edits or removes
   the link on the selection. Undo and redo work from the toolbar and from the
   keyboard, because they are the editor's own history.
7. **清空.** The file menu's 清空 replaces the canvas with `EMPTY_DOCUMENT` without
   emitting an editor update, and removes the stored record rather than writing an
   empty one. A reload therefore finds no draft to restore. A write that was already
   in flight is made stale by the revision bump, and IndexedDB runs the removal after
   it.
8. **Read back.** The text is the editor's own document: the gate reads it from the
   contenteditable after typing, and the blocks are not re-seeded from the initial
   content when the page renders again. The same document comes back after a reload,
   marks included, because ProseMirror JSON is what the store holds.

The extension set is the minimum the slices after this one need: `StarterKit` (with
Link configured `openOnClick: false`), `TaskList` and `TaskItem` from
`@tiptap/extension-list`, and `Placeholder` from `@tiptap/extensions`. No third-party
asset and no new dependency came with it; the TipTap tree arrived in
`chore(web): the TipTap tree at V1's minimum` and is the dependency expansion the
Tool's spec records. The draft store is hand-written against IndexedDB, so #209 added
no dependency at all.

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
- ▣ Typing and pausing writes the one record and reports 已保存到本机; the record
  carries schema version 1, a numeric timestamp and the typed document.
- ▣ A reload in the same browser context restores the title, the body and the bold
  run exactly, with no dialog asking whether to open the draft.
- ▣ Hiding the page before the 800ms window closes writes immediately: the status
  read in the same step is 未保存, and 已保存到本机 follows from the flush.
- ▣ 清空 empties the canvas, removes the record (not an empty one), and a reload finds
  both the canvas and the store empty.
- ▣ A refused write shows 保存失败，草稿还在页面上。, the 重试 control is visible, and
  pressing it at its coordinates writes the document that failed.
- ▣ The Tool has a homepage card linking to its route and an entry in `/sitemap.xml`.
- ▣ Typing reaches nothing off this origin, prints no console error or warning, and
  raises no uncaught error (`apps/web/e2e/no-outbound-requests.spec.ts`).

`pnpm test` covers the pure layers. The command table: ids are unique, every command
has a label and keywords, `commandsInGroup` keeps the table's order, `filterCommands`
matches by keyword and returns the table's order, and an empty query returns the whole
table. The save machine: dirty → saving → saved, failure and retry, the hidden-page
flush, a change during a write, a completion for an older revision, a debounce with no
window to close, 清空 as a newer operation, and the 800ms constant. The copy: the four
sentences, the retry label, and the banned punctuation. The record: the schema version,
the timestamp and the ProseMirror document, with malformed values refused. The one
structural claim a unit test cannot make, that every id has an executor, is the typed
executor map in `toolbar/toolbar.tsx`: `tsc` is what holds it.

Still by hand: opening the page in both colour schemes and reading the toolbar, the
pressed state, the save status in all four states, the canvas and its placeholders
against the palette; typing Chinese through a real IME, which a Playwright keyboard
does not simulate (the gate types characters, not composition events); whether a
screen reader announces the two placeholders, the toolbar's name, each control's state
and the save status's changes; focus order through the toolbar and the popovers; the
canvas's line becoming ink while the editing surface holds the focus; the draft
surviving a real tab close rather than a Playwright reload; a browser that refuses the
write for quota rather than the gate's injected refusal; and the whole page at 360,
375, 390, 768 and 1024 px looking for horizontal overflow, a toolbar that scrolls
where it should and keeps its right end (status and file menu) still, and a canvas
that still reads as a page.

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
- [ ] **▣** A fresh page has no stored record and reports 已保存到本机; typing and
      pausing writes one record with schema version 1, a numeric timestamp and the
      typed document, and the status says 已保存到本机.
- [ ] **▣** A reload restores the title, the body and the bold run exactly, and no
      dialog asks whether to open the draft.
- [ ] **▣** Hiding the page while the status is still 未保存 writes immediately, and
      已保存到本机 follows without waiting for the debounce.
- [ ] **▣** 清空 empties the canvas and removes the record; a reload finds both the
      canvas and the store empty.
- [ ] **▣** A refused write shows 保存失败，草稿还在页面上。 with a visible 重试, and
      pressing 重试 writes the document that failed.
- [ ] **▣** 链接 sets, edits and removes a link on selected text.
- [ ] **▣** 撤销 and 重做 work from the toolbar and from the keyboard.
- [ ] **▣** At 390px the middle groups scroll, the file menu does not move, and the
      page does not gain a horizontal scrollbar.
- [ ] **▣** The homepage card links to `/tools/rich-text-editor`, and the sitemap
      lists the route.
- [ ] **▣** The page makes no request off this origin while typing, writes no
      console error or warning, and raises no uncaught error.

### A person must still check

- [ ] Both colour schemes: the toolbar's hairlines, the pressed ink state, the save
      status in 未保存 / 保存中 / 已保存到本机 and the failure sentence, the canvas's
      type and the two placeholder sentences are readable, and the placeholder colour
      is the measured one.
- [ ] In the browser's application panel the draft is one IndexedDB database, one
      object store and one record under one key, holding `version: 1`, the
      `type: "doc"` JSON and a timestamp; a second tab sees the same draft rather than
      a second one.
- [ ] Closing a real tab and opening the page again restores the draft; a reload is
      only the gate's version of that path, and a tab close gives the flush less time.
- [ ] A browser that refuses the write for quota (or a private window with storage
      disabled) reaches 保存失败，草稿还在页面上。 rather than losing the text
      silently, and 重试 recovers once the refusal is gone.
- [ ] A screen reader announces the save region politely as it moves through the four
      states, reads the failure sentence, and reaches 重试 by the keyboard.
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
- [ ] At 390px the failure sentence and 重试 together still leave the file menu on
      screen and the page without horizontal overflow: that is the widest the right
      end ever gets.
- [ ] Pressing Enter at the end of the paragraph creates a second paragraph that
      paints no placeholder of its own: the starting sentence belongs to the
      document's first body block, not to every empty line.
- [ ] A heading made in the body and left empty paints no 无标题: that sentence
      belongs to the document's first block, not to every heading.
- [ ] The link popover opens with the caret in the field, an address without a
      scheme is read as `https`, and the remove action appears only when the
      selection is a link.
- [ ] A long code line scrolls inside its block instead of widening the canvas, and
      a checked task item's line-through and dimmed text are legible in both schemes.
