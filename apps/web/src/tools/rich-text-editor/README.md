# Rich Text Editor

A place to write on this site: one document at a time, edited in the browser, with
nothing requested from anywhere after the page has loaded. The canonical document is
ProseMirror JSON, and its title is the document's own first line rather than a second
input beside the canvas.

This is the Tool's first slice (#206). A visitor can open the page, see where to start
and type: an empty document is a title block and one paragraph, the title block says
无标题 and the paragraph says 开始写吧，输入 `/` 插入内容, and the first keystroke in
the paragraph replaces the paragraph's sentence and leaves the title's. The editor is
created on the client only, so the page serves an empty canvas and the document
appears with hydration.

What is deliberately **not here yet**, and lands in its own ticket: the toolbar, the
slash menu, Markdown input rules, the selection toolbar, autosave, import and export,
and the cover. Nothing is saved yet either: a reload gives a fresh empty document,
which is the current state rather than a bug. The page is known to both instruments
and to the browser gate, so none of this is unmeasured.

The Tool's own design rules — the page, the document model, the two placeholders, the
accessible name and why the canvas is not a `.touch-target` — are in
[`rules.md`](./rules.md).

## Layout

```
RichTextEditor.tsx   the writing surface: TipTap, the empty document, the two placeholders
meta.ts              the Tool Registry entry
rules.md             this Tool's own rules, linked from this file
README.md            this file: what it does, its files, a run, and the checklist
```

```
apps/web/e2e/
  rich-text-editor-page.ts   the gate's page actions: open, type, read back
  rich-text-editor.spec.ts   what the gate asserts on every pull request
```

The two page entries the instruments carry are not files: one line in
`apps/web/scripts/touch-targets.mjs` names this page and its always-visible controls,
and one line in `apps/web/scripts/ui-fingerprint.mjs` declares its anchors. The
fingerprint's baseline is a local file, not a repository one.

## How a run works

1. **Open.** The route renders the shared `ToolPage` shell and an empty canvas. The
   editor is created in an effect after hydration (`immediatelyRender: false`), so
   the server never renders a contenteditable and the visitor's first cursor is never
   reconciled with server HTML.
2. **Start.** The document is a `doc` with two empty text blocks: a `heading` at
   level 1 and a `paragraph`. The Placeholder extension paints 无标题 on the empty
   heading and 开始写吧，输入 `/` 插入内容 on the document's first body block. An empty
   line the visitor makes with Enter paints nothing: that sentence is about an empty
   document, not about every empty line.
3. **Type.** A click puts the caret in a block and a real keyboard writes into it.
   The first keystroke in the paragraph makes it non-empty, so its placeholder
   disappears; the title's sentence stays until the title itself is typed.
4. **Read back.** The text is the editor's own document: the gate reads it from the
   contenteditable after typing, and the blocks are not re-seeded from the initial
   content when the page renders again.

The extension set is the minimum the slices after this one need: `StarterKit` and
`Placeholder` from `@tiptap/extensions`. No third-party asset and no new dependency
came with it; the TipTap tree arrived in `chore(web): the TipTap tree at V1's minimum`
and is the dependency expansion the Tool's spec records.

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
- ▣ The Tool has a homepage card linking to its route and an entry in `/sitemap.xml`.
- ▣ Typing reaches nothing off this origin, prints no console error or warning, and
  raises no uncaught error (`apps/web/e2e/no-outbound-requests.spec.ts`).

`pnpm test` covers no Tool logic for this slice, on purpose: there is no pure core
yet. The first pure module arrives with the command table or the writers, and it is
tested where it is written.

Still by hand: opening the page in both colour schemes and reading the canvas and its
placeholders against the palette; typing Chinese through a real IME, which a
Playwright keyboard does not simulate (the gate types characters, not composition
events); whether a screen reader announces the two placeholders — they are CSS
content, so the canvas's own name 文档内容 is what is guaranteed; the canvas's line
becoming ink while the editing surface holds the focus, and going back after it
leaves; and the whole page at 360, 375, 390, 768 and 1024 px looking for horizontal
overflow and a canvas that still reads as a page.

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
- [ ] **▣** The homepage card links to `/tools/rich-text-editor`, and the sitemap
      lists the route.
- [ ] **▣** The page makes no request off this origin while typing, writes no
      console error or warning, and raises no uncaught error.

### A person must still check

- [ ] Both colour schemes: the canvas hairline, the empty document's two sentences
      and the caret are readable, and the placeholder colour is the measured one.
- [ ] Chinese input through a real IME composes into the paragraph and the first
      committed character takes the body placeholder away. The gate types
      characters, not composition events.
- [ ] A screen reader announces the editing surface as 文档内容, and whether it also
      reads the placeholders (they are CSS `::before` content, which screen readers
      are not obliged to announce).
- [ ] Tab reaches the editing surface, the canvas's hairline becomes ink while it
      holds the focus (not the browser's blue ring), the caret is visible, and the
      line is back to the hairline after the focus leaves.
- [ ] At 360, 375, 390, 768 and 1024 px the canvas keeps its reading measure, the
      page does not scroll sideways, and the two shell controls keep their 44px hit
      areas (the instrument prints the numbers; a person reads the page).
- [ ] Pressing Enter at the end of the paragraph creates a second paragraph that
      paints no placeholder of its own: the starting sentence belongs to the
      document's first body block, not to every empty line.
