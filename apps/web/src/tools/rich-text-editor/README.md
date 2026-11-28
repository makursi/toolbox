# Rich Text Editor

A place to write on this site: one document at a time, edited in the browser, with
nothing requested from anywhere after the page has loaded. The canonical document is
ProseMirror JSON, and its title is the document's own first line rather than a second
input beside the canvas. The draft lives in this browser's IndexedDB, and the toolbar
says what happened to it.

This slice (#209) adds the local draft, and #210 adds the two exports. Typing
schedules a write 800ms after the last change, and hiding the page writes
immediately instead of waiting; the toolbar's right end reports 未保存, 保存中,
已保存到本机, or 保存失败 with a retry. A returning visit opens the stored document
silently, with no prompt, and 清空 in the file menu empties the canvas and removes
the stored record. Text has no size limit: a browser refusal to write is the only
failure. Images carry their own admission rules (#216), below.

This slice (#216) adds images. 插入图片 in the insert group opens a file picker, and
a file can also be dropped on the canvas or pasted from the clipboard; all three
paths go through one admission and one insert. An image is kept as a `data:` URL in
the document itself — there is no upload service and the CSP draws nothing from
another origin — so it survives a reload with the draft. JPEG, PNG and WebP up to
5 MB, GIF up to 2 MB, at most ten images and 40 MB of image bytes per document; a
file outside those rules is refused with the sentence for the rule it broke. The
node carries the file's name as its alt text and a percentage width, so the picture
fills the 720px measure without leaving it. The slash menu lists 图片 and inserts
through the same path.

This slice (#218) adds the panel an image gets while it is selected. Pressing a
picture selects the node, and a bar appears above it (below it when there is no room
above, and never on it) with four things: 替换, which reads a file through the same
admission and leaves the picture exactly as it was if the file is refused; 替代文本,
a one-field popover that sets the alt text; 删除, which takes the node out and is
undone like any other change; and the width presets 25 / 50 / 75 / 100 %. The alt
and the width are the node's own attributes, so the draft keeps them, a reload
brings them back, and both exports carry them: the HTML file keeps the width, and
the Markdown file inlines the picture and drops only the width (#219).

This slice (#229) makes a block something a visitor can act on. A 44×44 块手柄
appears beside the block holding the caret — and beside the block under the pointer —
and opens 块操作: 上移, 下移, 删除, a hairline, and the four block types the toolbar's
块类型 popover already offers, from the same command table. 上移 on the first block
and 下移 on the last are disabled and say which end it is. The same handle is the
drag activator: dragging it reorders the document, dims the block being moved, and
draws a 2px ink line where it will land; the move is one transaction, so one 撤销
puts the block back, and Escape during the drag changes nothing. The handle sits in
the page's gutter where there is room for it and inside the canvas's own 52px inset
below an 856px viewport, so it never covers a glyph; below that width the text
measure narrows instead.

This slice (#230) adds the sixth inline mark and block alignment. 高亮 is one mark
with no attributes: toggled from the pinned toolbar and from the selection toolbar,
written as `<mark>` in both exports and read back by both imports. It says a run is
highlighted and leaves the fill to the site — two measured tokens per colour scheme —
so the document carries no colour and the two files cannot disagree about one. 对齐
is an attribute of paragraphs and headings 1–3, chosen from one toolbar trigger named
`对齐：<当前>` whose three rows say which value is in force, with left as the absence
of the attribute. The HTML file writes it as `style="text-align: center"` and the
sanitiser reads it back; the Markdown file keeps the words and drops the layout,
which is that format's second documented degradation after the image's width. Six
marks and the link are 375px of controls at the 44px floor, and the row keeps 8px
from either edge, so a 360px or 375px viewport cannot hold it: at those widths the
selection row scrolls sideways inside its own box rather than shrinking a control,
wrapping, or growing past the viewport's edge.

This slice (#208) adds the three ways to write without leaving the keyboard. Typing
`/` at the start of a paragraph opens a menu of the block commands; typing after the
slash filters it, the arrow keys move the choice, Enter applies it and Escape closes
it. The Markdown input rules turn `#`/`##`/`###`, `-`, `1.`, `>`, a backtick pair,
` ``` `, `---`, `**`, `*` and `~~` into their blocks and marks as they are typed,
and a paragraph that begins with the same characters but makes no rule stays text.
Selecting text shows a toolbar next to the selection with the inline marks and the
link action, placed above it (or below it when there is no room above) so that it
never covers the words.

This slice (#211) adds the import. The file menu's 导入 row opens a hidden file
input that accepts `.md` and `.html`; the file is read as text, parsed, and put
back into the editor through TipTap's own `setContent`. Markdown is parsed to
ProseMirror JSON by the Tool's pure reader (`core/markdown-import.ts`); HTML is
sanitised by `core/html-import.ts` and then parsed by TipTap, so the final
document is the editor's schema in both cases. When the draft already says
something, an alert dialog asks before it is replaced, and cancelling leaves the
draft untouched. The same HTML sanitiser runs on the editor's paste path, so
pasted markup loses its scripts, styles and head material by the same rule. The
confirmed import is a document change like any other, so the draft saves it.

This slice (#220) makes the import read back what the two exports write. The
Markdown reader learns GFM pipe tables and `![alt](data:…)` images; the HTML
sanitiser learns `<table>` with its rows and cells and `data:` images while keeping
the same whitelist, so a remote source or an event handler is dropped by the rule
that already dropped them. An imported image meets the same admission an inserted
file does — the same limits, the same sentence, and its alt text where a refused
picture would have been — so a file with a tenth picture too many is cut to ten
rather than imported whole. Both parsers and both writers now disagree about
nothing but the image's width, which is the one thing Markdown cannot carry.

The toolbar (#207) is what the document is written with. A visitor can start
writing, turn a paragraph into 标题 1–3 and back, mark a selection bold, italic,
underlined, struck through, highlighted or inline code, set that block's alignment
left, centred or right, make bulleted, numbered and task lists (nested, and a task
can be checked), insert a quote, a code block and a rule, set, edit and remove a
link on selected text, undo and redo, and clear the document from the file menu.
The toolbar reads the state at the cursor, so a mark that is on says so, the block
menu names the block the caret is in, and the alignment trigger names the value in
force.

The exports landed in #210. The file menu offers 导出 Markdown and 导出 HTML, and each
one writes the document's current bytes to a download: GitHub Flavored Markdown with
underline and highlight as the two inline HTML constructs, or a complete standalone
HTML document with a doctype, a charset, the document's title and an embedded
stylesheet whose `mark` rule carries the highlight's fill. The file is named from the
sanitised title and today's date, falling back to 文档-YYYY-MM-DD when the document
has no title. There is no filename field: the document names itself. Since #219 both
formats also carry an image and a table: Markdown writes `![alt](data:…)` and a GFM
pipe table, HTML writes `<img src="data:…">` with the width and a semantic `<table>`,
and the image's width and a block's alignment are the two things only Markdown has to
drop.

Everything the three surfaces can do comes from one table in the Tool's pure core
(`core/commands.ts`): the slash menu offers its block rows, the floating toolbar its
marks plus the link, and the pinned toolbar all of them. What each command _does_ is
one executor in `editor/execute.ts`, and that map is typed
`Record<Exclude<CommandId, "link" | "image" | "table">, …>`, so a command in the
table with no handler is a `tsc` error rather than a dead button. 链接, 图片 and
表格 are the three commands that are an interface rather than a chain: the pinned
toolbar and the floating toolbar both open the same `link-control/link-control.tsx`,
插入图片 opens the file input beside it, and 表格 opens the grid picker outside a
table and the contextual row/column menu inside one. The file menu is the one
surface **not** rendered from that table and has no rows in it: 导入, the two
exports and 清空 are file I/O around the document rather than editor commands, and
`file-menu/file-menu.tsx` is their one home.

The Markdown input rules add no extension at all, and that is a checked conclusion
rather than an omission: every rule #208 names ships with StarterKit, which the Tool
already loads. The gate proves each rule and each of its near-misses, because a rule
nobody exercised is a rule nobody has.

What is deliberately **not here yet**, and lands in its own ticket: nothing in this
slice. The Tool's cover landed in #212 and is the homepage card's illustration; it
does not change this page. The page is known to both instruments and to the browser
gate, so none of this is unmeasured.

The Tool's own design rules, the command table's contract, the keyboard shortcuts,
the toolbar's groups and hit areas, the save-state machine and its sentences, the two
menus' placement and keys, the input rules StarterKit supplies, the import and paste
rules, the export and filename rules, the two placeholders and why the canvas is not a
`.touch-target`, are in [`rules.md`](./rules.md).

## Layout

```
RichTextEditor.tsx                       the writing surface: the draft gate, TipTap, the extensions, the canvas typography, the paste sanitiser
toolbar/toolbar.tsx                      the pinned toolbar: the groups from the table, the disabled history reasons, the save status
file-menu/file-menu.tsx                  the file menu: 导入, the two exports and 清空, with its hidden input and its confirmation
slash-menu/slash-menu-extension.ts       `/` at the start of a paragraph, and the plugin that follows the caret
slash-menu/slash-menu.tsx                the menu itself: rows, arrow keys, Enter
selection-toolbar/selection-toolbar.tsx  the row that follows a selection: the marks and the link, placed clear of the words
command-toggle/command-toggle.tsx        one command as a toggle, the pressed state's one appearance and hit area
link-control/link-control.tsx            the link action's trigger, field, 应用 and 移除
image-insert/image-insert.tsx            插入图片: the button and the hidden file input it opens
image-panel/image-panel.tsx              the panel an image gets while selected: 替换, 替代文本, 删除, and the four width presets
table-control/table-control.tsx          the 表格 button: the grid picker outside a table, the contextual row/column menu inside one
block-handle/block-handle.tsx            块手柄: the button, its 块操作 menu, the pointer drag, the dimmed source and the drop line
align-control/align-control.tsx          对齐: the one trigger, the three rows, and the value in force
editor/execute.ts                        what each command does: one executor for all four surfaces, plus the table's and the block's own operations
editor/align-extension.ts                TextAlign configured for the two node types and three values, with its four key bindings removed
editor/block-drag.ts                     the decoration that dims the block a drag is moving
editor/image-extension.ts                the image node: base64 allowed, width as a percentage, clamped to the measure
editor/insert-image.ts                   the one insert the toolbar, a drop and a paste share, and the one replacement 替换 uses
hooks/use-editor-command-state/…         the state at the cursor, read through TipTap's selector
hooks/use-selected-image/…               the image the selection is on, as the panel needs it
hooks/use-viewport-reposition/…          the one-per-frame redraw a fixed-position row needs on scroll and resize
core/commands.ts                         the one command table, its filters, and the slash menu's subset
core/align.ts                            alignment's model: the two node types, the three values, and the one canonical HTML form both directions share
core/block.ts                            the block handle's rules: its words, the 44px and 4px constants, the two homes' placement, and the drop arithmetic
core/table.ts                            the table's rules: the grid's extent, the one-click default, and the seven actions' words
core/image-panel.ts                      the panel's rules: the four presets, the four controls' words, and where the bar sits
core/admission.ts                        what an image may be: the sniffed type, the two per-file limits, the count and the total, and what a replacement is measured against
core/document.ts                         what an empty document is, whether it says anything, where its title comes from, and the two readers both writers share (code text and heading level)
core/draft.ts                            the stored record's shape, its schema version and the guard that reads it back
core/save.ts                             the save-state machine: the 800ms debounce, the flush, the retry and old-revision rejection
core/copy.ts                             the save-state sentences, the retry label, the disabled history and block reasons, the menus' sentences, the import confirmation's and the four image refusals
core/markdown.ts                         ProseMirror JSON to GFM
core/markdown-import.ts                  GFM to ProseMirror JSON
core/html.ts                             ProseMirror JSON to a complete standalone HTML document
core/html-import.ts                      sanitised HTML for the import and paste paths
core/import.ts                           which format a chosen file is, and the picker's accept value
core/naming.ts                           the export filename rule: sanitised title, date, extension
draft/draft-store.ts                     the hand-written IndexedDB store: open, read, write, remove
hooks/use-draft/use-draft.ts             the timer, the store and React: silent restore, debounce, flush, retry, clear
core/__tests__/commands.test.ts          the table's contract in Vitest
core/__tests__/align.test.ts             alignment's model: its two node types, three values, and the canonical form
core/__tests__/admission.test.ts         the image rules: each sniff, each limit, the document's count and total
core/__tests__/table.test.ts             the table's rules: the grid, the default size, the seven actions
core/__tests__/image-panel.test.ts       the panel's rules: the four presets, its words, and where the bar goes
core/__tests__/block.test.ts             the block handle's rules: the menu's words, the drop boundary and move, the two homes' placement
core/__tests__/save.test.ts              the state machine's transitions in Vitest
core/__tests__/copy.test.ts              the save status's wording, the menus' and the disabled reasons' words, and the punctuation in Vitest
core/__tests__/draft.test.ts             the stored record's guard in Vitest
core/__tests__/document.test.ts          the title, and the emptiness the import asks about
core/__tests__/markdown.test.ts          the Markdown writer, in GFM's terms
core/__tests__/markdown-import.test.ts   the Markdown reader, in the writer's terms
core/__tests__/html.test.ts              the standalone document and its escaping
core/__tests__/html-import.test.ts       the sanitiser: kept blocks, dropped scripts, importable task lists
core/__tests__/import.test.ts            the format rule, by name and then by content
core/__tests__/naming.test.ts            the filename rule, including the empty-title fallback
meta.ts                                  the Tool Registry entry
rules.md                                 this Tool's own rules, linked from this file
README.md                                this file: what it does, its files, a run, and the checklist
```

```
apps/web/e2e/
  rich-text-editor-page.ts   the gate's page actions: open, type, select, press a control at its coordinates, read the store
  rich-text-editor.spec.ts   what the gate asserts on every pull request
```

The page entry the instruments carry is not a file: one line in
`apps/web/scripts/touch-targets.mjs` names this page, its always-visible controls, and
the three states its claims reach (a selected run of text, the toolbar scrolled to its
end, and an image selected with the panel drawn); one line in
`apps/web/scripts/ui-fingerprint.mjs` declares its anchors, including
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
   Pressing a mark toggles it on the selection and sets `aria-pressed`; 高亮 is the
   sixth of them, and its `<mark>` carries no colour — the fill is the site's token.
   The block menu names the block at the cursor and replaces it, and the 对齐 trigger
   names the alignment in force (`对齐：<当前>`) and opens the three values, with the
   row in force carrying `aria-current`; left is the absence of the attribute, so
   choosing 左 removes the style. Lists nest with Tab and a task item's checkbox is
   the item's own state; quote and code block toggle their block, the rule inserts
   one; the link action opens one field and sets, edits or removes the link on the
   selection. Undo and redo work from the toolbar and from the keyboard, because they
   are the editor's own history; while one of them is disabled it says why, on the
   control itself (没有可撤销的步骤。 / 没有可重做的步骤。).
7. **Handle a block.** A 44×44 块手柄 is always in the document and in the tab
   order. It is drawn beside the block holding the caret, moves to the block under
   the pointer, and sits in the page's gutter or in the canvas's 52px inset so that
   it never covers a glyph. Pressing it at its coordinates opens the 块操作 menu:
   上移 / 下移 / 删除, a hairline, then the four block types from the command table.
   The three actions run the block's own executor map on the block the handle names,
   and the four conversions run the table's block commands there. 上移 on the first
   block and 下移 on the last are disabled, and each row carries the sentence that
   says which end it is for the pointer and for a screen reader. A press that moves
   less than 4px is still a press; crossing that distance starts a drag, which dims
   the block, draws a 2px ink line at the drop boundary, and on release reorders the
   document in one transaction — one 撤销 puts it back, and Escape mid-drag changes
   nothing. There is no auto-scroll and no ghost following the pointer.
8. **Write without the mouse.** Typing `/` where a paragraph starts opens the slash
   menu at the caret; what follows filters it (`标题` leaves the three headings), the
   arrow keys move the highlight, Enter deletes the typed `/query` and applies the
   command, and Escape closes the menu and leaves the slash as text. A space ends the
   match, so `/标题 ` is text rather than a command nobody can see. The rows are the
   table's block commands, so the menu and the pinned toolbar cannot disagree.
9. **Type Markdown.** `#`/`##`/`###`, `-`, `1.`, `>`, a backtick pair, a fenced
   backtick block, `---`, `**`, `*` and `~~` become their block or mark as they are
   typed. Each rule needs its complete construct, so `#没有空格`, `-没有空格`,
   `` `未闭合 `` and `**未闭合` stay text — the gate holds both ends.
10. **Select and format.** A non-empty selection shows the floating toolbar just above
    the words (below them when there is no room above), with the six inline marks and
    the link action; pressing one applies it to the same document selection the pinned
    toolbar acts on. It is not in the document at all while the selection is empty.
11. **清空.** The file menu's 清空 replaces the canvas with `EMPTY_DOCUMENT` without
    emitting an editor update, and removes the stored record rather than writing an
    empty one. A reload therefore finds no draft to restore. A write that was already
    in flight is made stale by the revision bump, and IndexedDB runs the removal after
    it.
12. **Export.** The file menu's 导出 Markdown and 导出 HTML ask the editor for its
    JSON and hand it to the pure writer for that format. The writer returns a string;
    the toolbar wraps it in a blob, mints a temporary object URL, clicks an anchor
    named by `core/naming.ts`, and revokes the URL on the next task. The browser
    saves the file, so the gate can read the bytes back. The name is the sanitised
    title and today's local date with the format's extension, capped at 40 title
    characters, or 文档 with the date when the document has no title. An empty
    document exports as an empty Markdown file and an HTML file whose article is
    empty; both are still complete files.
13. **Import.** The file menu's 导入 row opens the hidden file input. The chosen file
    is read as text and its format is decided by `core/import.ts` from the extension
    (falling back to the content when the name says nothing). Markdown goes through
    `importMarkdown` to JSON — the reader for the writer, tables and images included
    (#220) — and its images then meet the same admission an inserted file does; HTML
    goes through `importHtml` and then through TipTap's `setContent`, whose DOMParser
    is the final word on the document either way. An image that breaks a rule is
    replaced by its alt text and the first rule's sentence is painted above the
    canvas, where a refused insert says the same thing. If the draft says anything
    (`isEmptyDocument`), an alert dialog asks first: cancelling closes it and changes
    nothing, confirming replaces the document. The
    confirmed replacement is a `setContent` that emits an update, so #209 saves it
    like any other change. The input's value is cleared after every choice, so
    importing the same file twice works. A file that sanitises to nothing leaves the
    empty document, and a paste of HTML takes the same sanitiser through
    `transformPastedHTML` before ProseMirror sees it.
14. **Read back.** The text is the editor's own document: the gate reads it from the
    contenteditable after typing, and the blocks are not re-seeded from the initial
    content when the page renders again. The same document comes back after a reload,
    marks included, because ProseMirror JSON is what the store holds.

The extension set is the minimum the slices after this one need: `StarterKit` (with
Link configured `openOnClick: false`), `TaskList` and `TaskItem` from
`@tiptap/extension-list`, `Placeholder` from `@tiptap/extensions`, and #208's
`SlashMenuExtension`, which is `@tiptap/suggestion` wrapped in an `Extension` so the
plugin gets the editor it needs. #230 adds `@tiptap/extension-highlight` (one mark,
no attributes) and `@tiptap/extension-text-align`, the latter through
`editor/align-extension.ts` so its four built-in key bindings are removed: the
Tool's keyboard surface is StarterKit's keymap plus the command table, and a package
that quietly adds a second list of keys is what that rule forbids. The menus'
sentences, the two disabled block reasons and the import confirmation's live in
`core/copy.ts`.
No third-party asset and no new dependency came with any of it; the TipTap tree
arrived in `chore(web): the TipTap tree at V1's minimum` and is the dependency
expansion the Tool's spec records. The draft store is hand-written against IndexedDB,
so #209 added no dependency at all. #211 added none either: both import parsers are
the Tool's own code, and the confirmation's `alert-dialog.tsx` is generated from the
`radix-ui` package the component layer already uses. `@tiptap/extension-floating-menu`
was declared by the spec and imported nowhere; it was **removed** in the review pass
(#207), and `selection-toolbar.tsx` says why the row is a plain fixed-position `div`
rather than that plugin's element. #229 added no dependency either: the drag is the
Tool's own pointer handling, the dimmed source is a `Plugin` from `@tiptap/pm` (already
a dependency), and `@tiptap/extension-drag-handle` was **rejected** by the spec because
it would put a collaboration stack into an editor that has none. #230 adds the two
TipTap packages above, at the tree's `^3.35.0` line, and nothing else.

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
- ▣ `/` opens the slash menu with the twelve block commands in the table's order, `标题`
  filters it to the three headings, the arrow keys move the highlight and Enter
  applies 标题 2, leaves no `/标题` in the document and closes the menu.
- ▣ Escape closes the slash menu and leaves the slash it opened on as text.
- ▣ Each Markdown block rule makes its block (`#`/`##`/`###`, `-`, `1.`, `>`, a
  fenced backtick block, `---`), and each mark rule marks its words (`**`, `*`,
  `~~`, a backtick pair).
- ▣ A paragraph that begins with the same characters but makes no rule stays text
  (`#没有空格`, `>没有空格`, `-没有空格`, `1.没有空格`, an unclosed backtick, an
  unclosed `**`), and a slash inside a sentence is a slash.
- ▣ The selection toolbar shows the five marks and the link on a selection, applies
  加粗 at its own coordinates, and is gone when the selection becomes a caret. Its
  placement (outside the selected words, inside the viewport) is the hit-area
  instrument's `selection-toolbar-clearance`, not this file's: it is geometry, and
  the site's tier rule puts that in `apps/web/scripts/`.
- ▣ Undo and redo work from the keyboard (`Control+z`, `Control+Shift+z`) and from
  the toolbar's own buttons.
- ▣ The keyboard shortcuts reach a mark (`Control+B`), the link (`Control+K` opens
  the field and 应用 writes the `a`), a heading (`Control+Alt+1`) and a list
  (`Control+Shift+8`).
- ▣ 块手柄 opens 块操作 at its coordinates, with 上移 / 下移 / 删除 and the four block
  types from the command table; the two end rows are disabled and say which end it
  is, and the rows act on the block the handle names rather than on the caret's.
- ▣ A pointer drag from 块手柄 reorders the document, one 撤销 restores the order,
  the source block is marked while the drag lasts, the drop line is drawn at the
  boundary, and Escape mid-drag changes nothing. A press that moves less than 4px
  opens the menu instead of dragging.
- ▣ Tab reaches 块手柄, Enter opens the menu with its first enabled row focused, and
  Escape closes it. The handle's geometry is the hit-area instrument's
  `block-handle-clearance`.
- ▣ 高亮 toggles from the pinned toolbar and from the selection toolbar at their
  coordinates, reads back as `aria-pressed`, draws a `<mark>` in the canvas, and a
  reload brings the mark back from the draft.
- ▣ 对齐's trigger names the value in force, its three rows carry `aria-current` on
  the one in force, and each value sets the paragraph's computed alignment; choosing
  左 leaves no style, and headings 1–3 take the attribute too.
- ▣ Alignment is offered by neither the slash menu (still the twelve block commands)
  nor the 块类型 popover (still four rows).
- ▣ The Markdown export writes `<mark>` and drops the alignment; the HTML export
  writes `<mark>`, the stylesheet's `mark` rule and `style="text-align: center"`, and
  importing that file back draws both.
- ▣ At 390px the file menu still opens and every row in it is there. The middle
  groups scrolling while the right end stays put, and the page not gaining a
  horizontal scrollbar, are the hit-area instrument's `toolbar-scroll-end` and
  `horizontal-overflow` claims.
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
- ▣ Typing, formatting, saving, exporting both formats and importing a file reaches
  nothing off this origin, prints no console error or warning, and raises no uncaught
  error (`apps/web/e2e/no-outbound-requests.spec.ts`).

`pnpm test` covers the pure layers. The command table: ids are unique, every command
has a label and keywords, `commandsInGroup` keeps the table's order, `filterCommands`
matches by keyword and returns the table's order, an empty query returns the whole
table, and `slashCommands` offers exactly the twelve block commands — filtering by the
same keywords and never reaching a mark, the link, an alignment or a whole-document
command. **The table's data is all a unit test can hold**: applying a command is a
TipTap chain, and TipTap needs a DOM the Node tier does not have, so "the command in
force produces this document" is the gate's claim (see `rules.md`). Alignment's model:
the two node types, the three values, and the one canonical HTML form — left and
anything outside the model answer no style, and both writers read it from there. The
save machine: dirty → saving →
saved, failure and retry, the hidden-page flush, a change during a write, a completion
for an older revision, a debounce with no window to close, 清空 as a newer operation,
and the 800ms constant. The copy: the four save sentences, the retry label, the two
disabled history reasons, the two disabled block reasons, the menus' sentences and
the banned punctuation. The block handle: the menu's three operations and its two
names, the 4px drag threshold and the 44px control, the drop boundary at each block's
midpoint (first, last, between, and an empty document), the move's index after the
source is taken out (including the case where removing it shifts the target), the
block under a pointer, the drop line's y, the two homes and their 856px crossing, and
the placement at 390, 768, 856 and 1440px with the text measure it must not reach. The
record: the schema version, the timestamp and the ProseMirror document, with malformed
values refused. The Markdown writer: headings, both kinds of list and their nesting,
task items and their checked state, quotes, fenced code with its language and backtick
growth, rules, every mark with underline and highlight as inline HTML, links, hard
breaks, escaping, an image as `![alt](data:…)` with its width dropped, a GFM pipe table
with its header row and its pipe-escaping, a highlight inside a bold run and inside a
cell, an alignment dropped with its block kept, and the empty document's empty string.
The standalone-HTML writer: doctype, charset, title, embedded stylesheet, every block
and mark, a `mark` rule in both schemes, an alignment as a style with left as the
absence of one, escaping, both fallbacks, and an image that carries its width and a
semantic table. The filename
rule: title, date padding, invalid characters, the 40-character cap and the
empty-title fallback. The document's title and emptiness: the first heading wins, and
the import's question counts text and a rule but not empty blocks or whitespace. The
import format rule: the two extensions, the extension beating the content, the
content sniff and the Markdown fallback. The Markdown reader: the writer's constructs
read back, nested lists and task items, hard and soft breaks, the export's `<u>`
underline and `<mark>` highlight, an alignment read as its absence, escapes, unknown
syntax kept as text, and no throw on malformed input. The HTML sanitiser: kept blocks,
head and scripts dropped, unsafe links unwrapped, the export's task list read back into
the editor's markup, a kept `<mark>`, a `text-align` read from a p or an h and
re-emitted in its one canonical form, entity round-tripping, and no throw on malformed
markup. The one structural claim a unit test cannot make, that
every id has an executor, is the typed executor map in `editor/execute.ts`: `tsc` is
what holds it.

Still by hand: opening the page in both colour schemes and reading the toolbar, the
pressed state, the highlight's fill and the ink on it, the alignment trigger's row in
force, the save status in all four states, the slash menu, the floating row, the
import confirmation, the canvas and its placeholders against the palette; typing
Chinese through a real IME, which a Playwright keyboard does not simulate (the gate
types characters, not composition events) — both into a paragraph and after a `/`;
whether the slash menu follows the caret when the page scrolls while it is open, and
whether it opens where a person expects on a phone keyboard; whether a screen reader
announces the two placeholders, the toolbar's name, each control's state, the save
status's changes, the slash menu's role and highlighted row, the import confirmation's
title and buttons, and the second toolbar as 选中文本的格式 rather than as a duplicate
of the first; focus order through the toolbar, the popovers and the confirmation; the
canvas's line becoming ink while the editing surface holds the focus; the draft
surviving a real tab close rather than a Playwright reload; a browser that refuses the
write for quota rather than the gate's injected refusal; and the whole page at 360,
375, 390, 768 and 1024 px still reading as a page whose canvas keeps its measure (the
overflow, the toolbar's scrolling and pinned end, the hit areas, the selection row's
clearance and the image panel's clearance are printed by the hit-area instrument,
which a person reads rather than re-measures).

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
- [ ] **▣** Each of 加粗, 斜体, 下划线, 删除线, 行内代码 and 高亮 toggles on and off
      when pressed at its coordinates, and its button's `aria-pressed` follows; 高亮
      is pressed from both toolbars and a reload keeps the `<mark>`.
- [ ] **▣** 对齐's trigger names the value in force, its three rows carry
      `aria-current`, and each value sets the paragraph's or the heading's alignment;
      左 leaves no style.
- [ ] **▣** Alignment is offered by neither the slash menu (still twelve rows) nor
      the 块类型 popover (still four rows).
- [ ] **▣** The Markdown export writes `<mark>` and drops the alignment; the HTML
      export writes `<mark>`, the stylesheet's `mark` rule and
      `style="text-align: center"`, and importing that file back draws both.
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
- [ ] **▣** 插入图片 opens the file picker; the chosen PNG becomes an image node whose
      `src` is a `data:` URL, whose alt is the file's name, and that fills the
      measure without overflowing it; a reload brings the same picture back.
- [ ] **▣** A dropped image and a pasted image file each insert through the same
      admission and the same insert.
- [ ] **▣** A file that is not an image, one byte over 5 MB, and an eleventh image
      are each refused with their own sentence between the toolbar and the canvas,
      and a file the rules take clears it.
- [ ] **▣** `/图片` lists 图片 in the slash menu, and Enter opens the same picker.
- [ ] **▣** Pressing an image shows the panel, and a caret in the title takes it away;
      its four controls are 替换, 替代文本, 删除 and 宽度 25 % / 50 % / 75 % / 100 %.
- [ ] **▣** Each width preset writes the image's own `style` width and the `width` in
      the stored draft, and a reload draws the same share of the measure.
- [ ] **▣** 替代文本 opens holding the current alt, sets it, and both the draft and a
      reload keep the new sentence.
- [ ] **▣** 删除 removes the node and 撤销 brings it back with its bytes and its alt.
- [ ] **▣** 替换 swaps the bytes and keeps the alt and the width; a refused
      replacement shows its rule's sentence and changes nothing, and the document
      still holds one image.
- [ ] **▣** At 390px pressing an image still opens the panel and its three actions are
      reachable; that it is drawn inside the viewport and clear of the picture is the
      hit-area instrument's `image-panel-clearance`.
- [ ] **▣** 块手柄 is always on the page and in the tab order; pressing it at its
      coordinates opens the 块操作 menu with 上移, 下移, 删除 and the four block types,
      and 下移 on the last block / 上移 on the first are disabled with the sentence
      that says which end it is (`title` and `aria-describedby`).
- [ ] **▣** The menu's 上移, 下移, 删除 and 标题 2 act on the block the handle names —
      moved there by hovering it while the caret is in another block — and not on
      the caret's block.
- [ ] **▣** A pointer drag from 块手柄 reorders the document, a single 撤销 restores
      the order, the source block carries the drag decoration while the pointer is
      down, and the 2px drop line is drawn; Escape during the drag changes nothing.
- [ ] **▣** A press that moves less than 4px is a press: the menu opens and nothing
      reorders. The handle geometry (44×44, clear of the block's text, inside the
      viewport) is the hit-area instrument's `block-handle-clearance`.
- [ ] **▣** Tab reaches 块手柄, Enter opens the menu, its first enabled row takes the
      focus, and Escape closes it.
- [ ] **▣** 表格 opens the grid picker; choosing 2 rows × 3 columns inserts a 2 × 3
      table with a header row, and typing in a cell edits that cell.
- [ ] **▣** Inside a table the same button opens the seven-row 表格 menu, and each
      action adds or removes the row, column or table it names; 删除表格 leaves a
      paragraph to type in.
- [ ] **▣** `/表格` inserts the documented 3 × 3 table; deleting it with 删除表格
      leaves exactly one empty paragraph, and the caret types into it.
- [ ] **▣** 撤销 and 重做 work from the toolbar and from the keyboard; a mark
      (`Control+B`), the link (`Control+K`), a heading (`Control+Alt+1`) and a list
      (`Control+Shift+8`) also work from the keyboard.
- [ ] **▣** `/` opens the slash menu with the twelve block commands in the table's
      order; `标题` filters it to three; the arrow keys move the highlighted row and
      Enter applies 标题 2, closes the menu and leaves no `/标题` in the document.
- [ ] **▣** Escape closes the slash menu and leaves the slash it opened on as text.
- [ ] **▣** Each Markdown block rule makes its block: `#`, `##`, `###`, `-`, `1.`,
      `>`, a fenced backtick block and `---`.
- [ ] **▣** Each Markdown mark rule marks its words: `**`, `*`, `~~` and a backtick
      pair, with the delimiters gone from the document.
- [ ] **▣** A paragraph that begins with the same characters but makes no rule stays
      text (`#没有空格`, `>没有空格`, `-没有空格`, `1.没有空格`, an unclosed backtick,
      an unclosed `**`), and a slash inside a sentence is a slash.
- [ ] **▣** The selection toolbar shows the six marks and the link on a selection,
      applies 加粗 at its own coordinates, and is gone once the selection is a caret.
      Its placement is the hit-area instrument's `selection-toolbar-clearance`.
- [ ] **▣** 导出 Markdown downloads a GFM file whose bytes are the document, and the
      filename is `<title>-YYYY-MM-DD.md`.
- [ ] **▣** 导出 HTML downloads a complete document with a doctype, a charset, the
      title in `<title>` and an embedded stylesheet, and the filename is
      `<title>-YYYY-MM-DD.html`.
- [ ] **▣** An untitled document's exports are named `文档-YYYY-MM-DD.<ext>`, and the
      HTML file's `<title>` is 无标题.
- [ ] **▣** A document holding an image and a table exports in both formats: the
      Markdown file inlines the image and writes the table as GFM pipes, the HTML
      file carries the image's width and a semantic `<table>`, and the width is the
      one thing the Markdown file drops.
- [ ] **▣** 导入 a Markdown file through the file menu produces the fixture's
      headings, paragraph and its marks, nested lists, checked and unchecked task
      items, quote, fenced code with its language, link and rule; the imported
      document is editable, and exporting it again carries the added words.
- [ ] **▣** 导入 an HTML file produces the same blocks, and its `<head>`, stylesheet
      and script do not survive.
- [ ] **▣** 导入 a Markdown file with a GFM pipe table and a `data:` image produces
      the table's header and body rows and the picture, and exporting it again writes
      the same table and the same image line.
- [ ] **▣** 导入 an HTML file with a `<table>` and a `data:` `<img>` produces the
      same blocks; the image keeps its percentage width, and its `onerror` does not
      survive. An image over the limits is refused with the insert path's sentence,
      and its alt text stays as text; a remote image leaves its alt text and no
      picture.
- [ ] **▣** A non-empty draft asks 替换当前文档？ before the import; 取消 leaves the
      title and the body untouched, and 替换 replaces them.
- [ ] **▣** Pasted HTML is sanitised by the editor's own paste path: a pasted
      `<script>` does not run or reach the document, while its words and marks do.
- [ ] **▣** At 390px the file menu still opens and every row in it is there. The
      toolbar's scrolling and pinned end, and the page's horizontal overflow, are the
      hit-area instrument's claims.
- [ ] **▣** The homepage card links to `/tools/rich-text-editor`, and the sitemap
      lists the route.
- [ ] **▣** The page makes no request off this origin while typing, formatting,
      saving, exporting both formats and importing a file, writes no console error or
      warning, and raises no uncaught error.

### A person must still check

- [ ] Both colour schemes: the toolbar's hairlines, the pressed ink state, the
      highlight's fill with its ink and the exported file's own `mark` rule, the save
      status in 未保存 / 保存中 / 已保存到本机 and the failure sentence, the slash
      menu's card and highlighted row, the floating row, the import confirmation's
      overlay and card, the canvas's type and the two placeholder sentences are
      readable, and the placeholder colour is the measured one.
- [ ] Both colour schemes: the highlight fill is visibly a tint rather than a second
      page — on the canvas and in the exported HTML file — and the ink on it reads as
      body text. The measured pair is `highlight` / `highlightInk` in `src/lib/tokens.ts`.
- [ ] The 对齐 popover in both schemes: the trigger's icon, the three rows, the
      `aria-current` row's treatment and the card's hairline read as one surface, and
      the trigger is the same height as 块类型 beside it.
- [ ] The import confirmation in both schemes: the overlay dims the page rather than
      washing it out, the title and the description read as one question, focus lands
      on 取消, Escape cancels, Tab reaches both buttons, and both are 44px tall.
- [ ] A real file from another Markdown tool: tables, images, reference-style links
      and other syntax this reader does not know stay as their words rather than
      refusing or crashing, and the blocks it does know keep their order.
- [ ] A full page saved from a browser as HTML: its head, scripts, styles and layout
      wrappers are gone, its lists, quotes, code and links survive, and a
      `javascript:` link arrives as plain text.
- [ ] Pasting rich content copied from another tab: the words and the marks are kept,
      the scripts and styles are not, and the pasted link does not carry an event
      handler.
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
      committed character takes the body placeholder away, and composing after a `/`
      filters the slash menu rather than applying a command mid-composition. The
      gate types characters, not composition events.
- [ ] A screen reader announces the editing surface as 文档内容, the toolbar as
      格式工具栏, each icon control by its name, the pressed state of a mark, and the
      block menu as 块类型：<当前块>; whether it also reads the placeholders (they are
      CSS `::before` content, which screen readers are not obliged to announce); and
      whether the slash menu and the floating row are announced by their names.
- [ ] A screen reader announces 块手柄 as a menu button (`aria-haspopup`), the menu as
      块操作, each row as a menu item, and the disabled 上移 / 下移 rows with the
      sentence that says which end it is.
- [ ] The two homes read as one control: at a wide window the handle sits in the page
      gutter beside the canvas, and at 390px it sits in the canvas's 52px inset with
      the text measure narrowed rather than covered. A person checks the crossing at
      a few widths around 856px, that the handle is never drawn on a glyph, that the
      hovered block and the caret's block both get it, and that it is back at the
      caret's block once the pointer leaves the column.
- [ ] A drag with a real mouse and on a real phone: the source block dims, the 2px
      line follows the boundary, the drop is one undo step, and a finger that starts
      on the handle reorders rather than scrolling the page. The gate's drag is a
      mouse; the browser's own touch gesture arbitration is not something it can
      simulate, so this is the pointer half a person owns.
- [ ] The 块操作 menu in both colour schemes: its card, the hairline, the disabled
      rows' dimming and the focused row read as one surface.
- [ ] Tab reaches the toolbar controls in order, Enter or Space presses a toggle,
      the block menu and the file menu open and close with the keyboard, and Escape
      closes the link popover.
- [ ] Tab reaches the editing surface, the canvas's hairline becomes ink while it
      holds the focus (not the browser's blue ring), the caret is visible, and the
      line is back to the hairline after the focus leaves.
- [ ] At 360, 375, 390, 768 and 1024 px the canvas keeps its reading measure; the
      instrument prints the toolbar's scrolling, its pinned right end, the page's
      overflow and every control's hit area, and a person reads those numbers.
- [ ] At 390px the failure sentence and 重试 together still leave the file menu on
      screen and the page without horizontal overflow: that is the widest the right
      end ever gets.
- [ ] At 360 and 375px the selection row scrolls sideways inside its own box: six
      marks and the link are reachable by a swipe, none is cut below 44px, and the
      box stays inside the viewport. The instrument prints the row's box at all five
      widths; the swipe itself is a person's, and a real phone's touch arbitration is
      not something the gate can simulate.
- [ ] The slash menu opens where the caret is, does not open for a `/` typed in the
      middle of a sentence, in the title heading, or in a list item's paragraph, and
      the selection toolbar follows a page scroll while it is open. Where it sits at
      rest — above a one-line selection, below one near the top of the viewport,
      inside the viewport at either margin — is the instrument's
      `selection-toolbar-clearance`; a person checks the follow.
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
- [ ] A long title is cut at 40 characters in the filename, and an empty one falls back
      to 文档. At 390px the file menu's own rows are still all there; that its right
      edge stays inside the viewport is the instrument's `toolbar-scroll-end`.
- [ ] A long code line scrolls inside its block instead of widening the canvas, and
      a checked task item's line-through and dimmed text are legible in both schemes.
