# Design notes

The design tree a session settled, written down so the next session does not re-derive it. One section per tree: the question, the branches that are settled, the branches still open, and the branches that were rejected with the reason they were rejected. A note is a record of a decision, not a spec — the spec is the GitHub issue the tree produced.

Conventions: dates are absolute. "Rejected" branches are the ones a future reader would otherwise propose again.

---

# Image to PDF — is the toolbox gaining a third Tool, and in what shape (2026-11-14)

## The question

The owner wants an `image-to-pdf` Tool. The input was a product document (outside the repo, `2026-11-14 产品文档.md`) proposing a four-region single page — upload, image list, PDF settings, result — with page size (A4 / A3 / Letter / original), orientation, margins, fit-to-page vs fill-page as P0, custom filename as P0, rotation as P1, and compression / HEIC / GIF / long-image pagination as P2, against limits of 20 images, 20 MB each, 100 MB total.

The tree settled over four rounds the same day. The spec it produced is issue **#191**; the decisions below are what that spec has to satisfy.

## Settled branches

1. **The Tool exists, and its output surface is one axis.** Page size only: A4 (default), Letter, or 原始尺寸. No orientation control, no margin control, no fill-page. Orientation follows each page's own image, so a mixed document is legal and nobody is asked a question the image already answers.
2. **原始尺寸 is 96 dpi** (1 px = 0.75 pt), the conversion that makes "the size of the image" mean what a visitor expects on screen. A control-line explains the two words, because "original size" reads as paper to some and pixels to others.
3. **One page holds one image.** N images produce N pages; page order equals list order. Imposition (several images on one page) is a different capability, not a switch.
4. **The list row is a page, not a thumbnail.** Its box is drawn from the same pure geometry function the PDF writer uses, so the preview cannot disagree with the download, and the geometry is unit-testable instead of pixel-compared in the gate.
5. **Five regions, and the action row is pinned.** ToolPage header, input region (a full drop zone while empty, one "continue adding" line once files exist), the page list, the page-size row, the result row. The result row stays on screen while the list scrolls.
6. **The page-size row is a single-select** built on the vendored toggle group, each item carrying the hit-area class itself; selected state is expressed without colour, because the site's only colour semantics is error.
7. **The PDF is written by this repository.** No runtime PDF dependency: PDF 1.7, classic xref table, no object streams, a binary comment line, exact `/Length` per stream. About 280 lines plus its structural tests, in the same tradition as the hand-written BMP encoder.
8. **JPEG goes through unchanged.** Original bytes as a `DCTDecode` stream; all eight EXIF orientations are expressed as a content-stream matrix, so a phone photo neither lies down nor loses a generation.
9. **Progressive (SOF2) and CMYK/YCCK JPEGs leave the passthrough path** and are decoded by the browser, then written as raw samples — never re-encoded as JPEG, which would be a loss on top of a loss.
10. **PNG and WebP are decoded by the browser and flattened onto white**, written as raw RGB through `FlateDecode`. The PNG-predictor passthrough that would keep the original bytes is deliberately not used (see rejected branches).
11. **One dedicated Worker builds the whole PDF.** One message in, one PDF out, one progress message per finished page; cancel terminates the Worker and replaces it. Progress and cancel are load-bearing, not decoration: a page of non-JPEG images costs a browser decode plus a deflate each.
12. **Ordering is drag with a keyboard path** (drag-and-drop toolkit, pointer and keyboard sensors). Each row's handle is a real button, carries the hit-area class itself, and uses one accessible name across rows so the instrument can declare it once.
13. **Limits: 20 images, 20 MB each, 100 MB total, 40 M pixels each.** The image count is also a page count, which is what makes it meaningful here; the total matches the existing tool's single number; the pixel cap bounds one decode, which bytes alone cannot.
14. **Three formats, one refusal sentence.** JPEG, PNG and WebP are accepted by byte sniffing (no `accept` attribute); everything else — AVIF, BMP, HEIC, GIF — is refused with the same sentence, because a list of refused formats expires.
15. **The file names itself** `图片-YYYY-MM-DD.pdf`. No filename input.
16. **Any change invalidates the result.** Changing the page size or touching the list clears the download and re-arms the button: downloading a file that does not match the preview is the worst failure this page can produce.
17. **Nothing is extracted into a Package.** The new Tool writes its own pure core and its own thumbnail hook; the second consumer is a signal that a Package is worth having, and it is its own pull request, made once the second shape is known rather than guessed.
18. **The gate parses the download with a library the site does not ship** — the PDF library goes in as a dev dependency, so production bytes stay ours and the gate checks us against a second implementation.
19. **The vendored toggle group's radio roles were enough for a single choice.** It renders `role="radiogroup"` with `role="radio"` items carrying `aria-checked`; the gate asserts that the arrow keys change the choice and the checked state. The hand-rolled radiogroup was the fallback if pressed-state wording did not read as one choice, and it was not needed. A real screen reader remains a manual checklist item, not an open design question.
20. **The pinned-row claim's injected style is written, not deferred.** The falsification run injects `position: static` on `[data-slot="pdf-result"]` at 390×900, and the claim has been watched go red.
21. **The cover arrived after the Tool did.** The spec's out-of-scope list said no cover shipped and none was invented; on 2026-11-14 the owner supplied an illustration of the site's mark character, cropped here to 4:3 at 1440×1080. It joins the recorded exception class: it keeps its own colour, is not desaturated, and is not re-licensed by the repository (`apps/web/docs/design/assets.md`).

## Open branches

- **The 40 M pixel number** is reasoned, not measured. It becomes a real number the first time someone feeds a 40 MP image through the page on a phone.
- **The iOS canvas area ceiling** (roughly 16.7 M pixels) is a known risk recorded in the Tool's own rules, not defended by a cap, because capping to it would refuse images that desktop handles fine. If a mobile blank page shows up, this is the first suspect.

## Rejected branches, and why

- **The full settings panel from the product document** (size + orientation + margin + fit/fill). It is the shape the site's one tool-scoped ADR on output surfaces already got away from, and only one of its four axes answers a question the image does not already answer.
- **Fill-the-page as a second layout.** Cropping pixels is destructive and invisible in the result; a visitor whose photo lost an edge would not know why.
- **A4 as one of four paper sizes including A3.** A3 nearly doubles the pixel need per page for a use this site has no evidence of; it returns when someone asks.
- **Imposition / several images per page.** A different capability; it would muddy the three words ordering already has to keep apart.
- **Paste from clipboard.** Desktop-only path for a photo tool, deferred with a reason rather than dropped silently.
- **A custom filename input.** The cheapest control to add later, and the most expensive row to keep on 390px now.
- **`pdf-lib` as a runtime dependency.** Frozen upstream since 2021, 177 KB gzip of which most is font metrics never used, a known bundler fault through its pako dependency, and it still would not handle EXIF or WebP — leaving us owning the two hard parts anyway.
- **The maintained fork of that library.** Same embedders, same two gaps, twenty-six megabytes unpacked.
- **`pdfkit`**, the one library that rotates JPEGs by EXIF itself. Node-flavoured entry, ten megabytes unpacked, and a streaming API to contort around a one-image-per-page document.
- **PNG predictor passthrough** (reusing the PNG's own compressed stream as the image stream). Legal per the PDF specification and proven in one open-source reader, but the support in the browser's own PDF engine and in the desktop viewer on this machine could not be verified; unverified correctness is not worth a few hundred kilobytes.
- **A Worker pool**, like the image converter's. The document is one output stream, so the work is sequential; parallelising the deflate buys a few seconds for a protocol nobody reads.
- **Main-thread generation with a spinner.** Half a minute of frozen page, cancel included.
- **Unique accessible names per drag handle** ("page 3 handle"). The instrument declares controls by name and would have nothing to declare.
- **A main action whose name changes with state** ("choose images" vs "add more"). Whichever name the instrument declared, the other state would fail.
- **A hand-rolled radiogroup for a three-way choice** while the component layer already has one that does it.
- **Accepting whatever the browser can decode** (AVIF, the first frame of a GIF). It turns "what this site supports" into a fact about the visitor's decoder.
- **A sticky-row threshold without a claim.** A threshold nobody runs is not a check; the alternative was dropping the pinned row entirely, and the row earns its 64 pixels.
- **Reopening the "no output settings" ADR.** It binds one tool and says so; this Tool's larger surface is its own decision, recorded in its own rules file, not an exception carved into someone else's.

---

# Image assets — which ones are unused, and where a source of record lives (2026-11-14)

## The question

The owner asked for the site's images to be "处理": first delete the ones nothing uses, then move or create directories so the rest are managed. Stated that way the tree was assumed to be untidy; the inventory said otherwise. Three of that day's facts decided the rest:

- **Every tracked image is wired.** `SiteHeader` reads `/brand/makursi.png`; the Next icon convention reads `icon1.png`, `icon2.png` and `apple-icon.png` out of `src/app`; each of the three `meta.cover` fields names its cover; `apps/web/assets/brand/makursi.png` is the master the exports come from. Nothing under `public/`, `src/app/` or `assets/brand/` is dead.
- **The only unused files were in `assets/inbox/`, which is gitignored** (`.gitignore`, "a drop box, only its README is tracked"), so deleting them there is irreversible. Measured by SHA-256 and size: `cover-anime.jpg` is byte-identical to both `微信图片_20260917102852_91_6.jpg` and the shipped `public/tools/image-converter/cover.jpg` (`415c740f78a4…`); `cover-anime-warm.jpg` is the 660×495 desaturated variant the design rules rejected; `cover-from-tool.jpg` is a 2640×1980 screenshot of the Image Converter page, never wired, and superseded by that Tool's illustration cover.
- **One inbox file is the only copy of something shipped.** `image-to-pdf.webp` (1920×1080) is the source the 1440×1080 cover was cropped from; the export cannot be un-cropped.

## Settled branches

1. **"Unused" means no wiring anywhere _and_ not the source of record for something wired.** Under that definition the deletion set is three files, all inside the drop box. `.next/cache/images/` is build output, not an asset.
2. **The three are deleted**: the byte-identical copy, the rejected tonal variant, and the unused screenshot. `cover-from-tool.jpg` is the only judgement call; it is unused and the Tool it depicts already has a cover, and the drop box is not an archive.
3. **Sources of record enter git**, at `apps/web/assets/tools/<slug>/cover.<ext>`. The two are `image-converter/cover.jpg` (byte-identical to the export — the cover was never re-encoded) and `image-to-pdf/cover.webp` (the export is the 4:3 crop of it).
4. **Order is data safety, not style**: commit the sources before deleting anything. Deletions of gitignored files leave no diff, which is exactly why a deletion must never be the step that makes something unrecoverable.
5. **`assets/` mirrors `public/` by the ownership rule.** `assets/brand/makursi.png` ↔ `public/brand/makursi.png` already held; `assets/tools/<slug>/` completes the shape. The master does not move, so no citation changes.
6. **A source is named after its export, keeping its own extension**: `cover.webp` beside `cover.jpg` says "converted", and two identical names say "not". The WeChat timestamp filename is gone; provenance is a row in `apps/web/docs/design/assets.md`.
7. **`assets/inbox/` stays the drop box** and stays gitignored, emptied to its README once the sources moved. It is a staging area; it was never the record.
8. **`ToolMeta.cover` stays a `public/` path string.** The ownership rule does not reach the covers yet.
9. **The icons stay in `src/app`.** The file convention is Next's interface; `icon2.png`'s byte-identical twin in `public/brand/` is the doubled export it requires.
10. **Two assertions are added**, in `apps/web/src/lib/__tests__/public-assets.test.ts`: every file under `public/` appears as a URL somewhere the App is described, and every declared `cover` resolves to a file that exists (until now only the path's _shape_ was checked, so a typo would render an empty frame and pass).
11. **Documentation counts as a reference.** `assets.md`'s table is where these files are registered; the assertion's job is to catch the file nothing mentions at all.
12. **No ADR and no spec issue.** The change touches no contract and adds no new decision worth re-litigating; the two commits are a cleanup plus its check.

## Open branches

- **`cover-generator` has no source of record.** Its shipped cover is a 1920×1080 16:9 frame whose 4:3 1320×990 replacement is still described as better in `meta.ts`; nothing was ever kept on disk. If that source arrives it lands at `assets/tools/cover-generator/cover.<ext>`.
- **How far the "referenced" assertion reaches** — today `public/`, later possibly `src/app`'s icons and a growing `assets/`.
- **Whether the image-to-pdf cover should be re-cropped** from the committed source. Nothing asks for it yet.

## Rejected branches, and why

- **Deleting the inbox wholesale, sources included.** It is the one place a deletion cannot be undone; the site would lose the only 1920×1080 copy of a cover in use.
- **Moving covers into `src/tools/<slug>/` as static imports.** It would make the ownership rule cover artwork too, but it changes `ToolMeta.cover`'s type and the registry test's contract for a prettier path — an ADR-level change, and its own pull request.
- **Dropping the Next icon convention for `metadata.icons`** so every image lives in one tree. Hand-written `sizes`/`rel` against the convention's automatic `<head>`, bought for tidiness.
- **`assets/sources/<slug>.<ext>`, flat.** Fewer directories, but the source stops corresponding to its export by position; the mirror costs one level and answers "does this have a source?" in one hop.
- **Keeping the original filenames** (`微信图片_20260917102852_91_6.jpg`). The name would record where a file came from and nothing about what it is.
- **Scanning only `src/` for references** and treating docs as non-references. `assets.md` is the register; a file mentioned nowhere at all is the orphan worth failing on.
- **A generated manifest** listing each asset and its wiring. A second place to update, and one that goes stale silently.

---

# Rich Text Editor — does the toolbox gain a writing Tool, and in what shape (2026-11-27)

## The question

The owner wants a new Tool whose product document (`nuxt-editor-product-spec-simplified.md`, outside the repo) describes a modular rich-text editor written against the Nuxt Editor Template, with no AI features. This site is Next.js + React, has no server, no accounts and a CSP that forbids any request after load, so the document's host responsibilities (identity, permissions, persistence, image storage) have no host here. The tree settled the same day over four rounds. Its spec is #205; the slices it produced are #206–#212.

## Settled branches

1. **It is a Tool, bounded like one.** One local draft at a time, no document list, no accounts, no host API; the draft lives in this browser and the deliverable is an exported file. The editor is a self-contained component by design (props in, events out), but it is not extracted to a package: the page is the only consumer.
2. **React + TipTap in this repo.** The product document's Nuxt 4 / Vue 3 / Nuxt UI table describes the reference product, not this site. The site's own layer carries the UI; TipTap carries the document model.
3. **The slug is `rich-text-editor`, the title 「富文本编辑器」.** The reference product's name is not usable: it names its framework.
4. **V1 is the writing core**, plus links, autosave and import/export. Images, tables, the emoji picker and the block drag menu are V1.1; Mention is never built, because the product document's own clause drops it when no host supplies data.
5. **The page keeps the shared Tool shell**, and the editor adds one pinned toolbar row: undo/redo, a block-type menu, the inline marks, the lists, the insert actions, and at the right end the save status and a file menu. The document title is the canvas's first line; there is no second title input.
6. **ProseMirror JSON is the canonical document.** Markdown and HTML are derived on export and parsed back on import; the draft is private to the editor and need not be portable.
7. **The draft lives in IndexedDB**, one record under one key. Save is debounced 800ms and flushed when the page becomes hidden; the states are 未保存, 保存中, 已保存到本机 and 保存失败 with a retry, and the product document's 正在编辑 is a resting state rather than a status.
8. **Restore is silent**; 清空 sits in the file menu.
9. **Markdown export is GFM**, with underline written as inline HTML (the one construct GFM has no form for), task lists as `- [ ]`, and fenced code carrying its language. HTML export is a complete document with an embedded stylesheet.
10. **The filename is derived, never asked for**: the sanitised title plus today's date, falling back to `文档-YYYY-MM-DD`. The title part is capped at **40 characters** — a settled number from the session, not a value the implementation was left to choose: long enough for a real title, short enough that the name stays one a filesystem accepts. The cap is on the title, so the date and the extension are never the part that gets cut.
11. **Import replaces the draft after a confirmation** when the draft is not empty; pasted HTML goes through the editor's own sanitising paste.
12. **One command table feeds both the toolbar and the slash menu**, so the two cannot disagree.
13. **The component's surface is `initialContent` and `onChange` only.** The product document's ten host configuration items wait for a real host; the repo's rule against fields for later applies.
14. **The TipTap tree is the one dependency expansion**, at V1's minimum, with literal versions rather than the catalog.
15. **No document size limit.** The browser's quota is the only boundary, and its refusal is the failure state.
16. **No new test seam.** The pure core carries the logic in Vitest, the page carries behaviour in the gate, and the instruments carry the two drawing claims.

## Open branches

- **The instruments' reach into the file menu.** Its items exist only while the menu is open; the hit-area instrument may need a small hook beside `convert`, or the menu items stay the gate's. The ticket that lands the menu decides.
- **The 720px reading measure** is a design number chosen from the product document's "suitable for long-form reading", not measured against this site's 960px column yet.
- **The TipTap extension set** is V1's minimum; V1.1's images and tables will add extensions, and that is when the dependency list is revisited.

## Rejected branches, and why

- **A separate Nuxt app (or a second deployable).** ADR-0001 settles one site; the product document's stack is a fact about its reference product.
- **The full PRD V1.0 in one slice.** Images have no upload service here, tables need their own insert and row/column surfaces, and an emoji picker needs a self-hosted dataset. Each is its own decision, not a checkbox.
- **Mention.** No host supplies the data, and the product document says not to enable it without one.
- **localStorage for the draft.** It makes 保存中 a lie and cannot hold V1.1's images.
- **HTML or Markdown as the canonical document.** HTML makes every load a re-parse of user HTML; Markdown cannot express underline or task state.
- **A full top operation bar** (title, save, undo/redo, import/export, more) above the toolbar. On 390px it is two or three rows of chrome over the writing surface.
- **A second title input** beside the canvas. The title is content; one place to type it means one answer to "what is the exported title".
- **A host configuration object now.** It would be an API for a consumer that does not exist.
- **Extracting the editor to a package now.** The second-consumer threshold is the repo's rule, and the page is the first consumer.
- **A document size cap.** A number picked without evidence would refuse ordinary long documents; the quota refusal is the real boundary.

---

# Rich Text Editor V2 — images and tables (2026-11-27)

## The question

V1 landed (#205, slices #206–#212, merged to main), and #214 lists what the product document still lacks. The owner asked for V2. Three rounds settled the scope and the mechanics: images and tables are this slice, Emoji is cut, and the block menu waits for V3.

## Settled branches

1. **V2 is images and tables.** They share one acceptance line ("the document can hold something that is not text"), and both change the two writers and the two parsers, so splitting them would edit the same code twice.
2. **Emoji is cut** (owner decision, 2026-11-27). The OS/IME emoji panel already inserts characters into the document; an in-app dataset and picker buys only "searchable", and the dataset must be self-hosted.
3. **The block menu is V3**, and then only the handle and moving, not "block settings". The slash menu already converts block types.
4. **An image is a data URL inside the document JSON.** The draft record is the image store: one truth, synchronous export, undo/redo works, and 清空 deletes one record. The cost is that every debounced save clones the bytes again, which the limits in 5 bound.
5. **Admission is a rule set, not a progress bar.** JPEG/PNG/WebP up to 5 MB each, GIF up to 2 MB (the owner's addition), at most 10 images and 40 MB total per document; the type is sniffed, the size is read before the file, and four refusals live in the pure copy layer.
6. **Tables are `@tiptap/extension-table` plus two UI surfaces**: a grid picker (1–10 × 1–10) in the insert group, and, while the caret is inside a table, the same trigger becomes a 表格 menu with add row above/below, add column before/after, delete row, delete column, delete table. No merged cells, no formulas, no column widths, no cell styling.
7. **Images arrive three ways** — the insert-group button (a file input), drag onto the canvas, paste from the clipboard — and all three go through the same admission. Selecting an image shows 替换 / 替代文本 / 删除 and width presets 25/50/75/100 %.
8. **No free drag-to-resize.** Pointer math plus a touch fallback is the control class this repo's instrument has already caught shrinking below its hit area; presets are the accessible, testable equivalent.
9. **Export inlines.** Markdown writes `![alt](data:…)` and GFM pipe tables with the first row as the header; HTML writes `<img src="data:…">` and `<table>`. Dropping images from Markdown was rejected: it is silent loss, and "some renderers strip data URIs" is the renderer's call.
10. **Import accepts data: images only.** GFM pipe tables and HTML tables are learned; a remote image is dropped and its alt text remains as text, because the CSP cannot draw it and a broken image is not content.
11. **The draft record keeps `version: 1`.** The record's shape does not change; only the node types inside the JSON grow, and that is the TipTap schema's concern. A bump is for a shape change — a new field, or JSON plus blobs — which 4 removed.
12. **Two new packages, no new seam.** `@tiptap/extension-image` and `@tiptap/extension-table` at 3.35; the pure core carries admission, both writers and both parsers, the gate carries behaviour, the instruments carry hit areas and anchors.

## Open branches

- The grid picker's exact interaction (hover to size vs click each cell), and where the table menu anchors.
- Where the refusal sentence is shown on the page (an inline line under the toolbar vs beside the canvas), and whether it needs a dismiss.
- The image and table fixtures in the gate: images built in a separate page (the Gotchas rule), and a fixture that really exceeds a limit for each refusal.
- Whether the image panel needs "open in a new tab" for inspecting a large image.

## Rejected branches, and why

- **Blob in IndexedDB plus an id on the node.** It buys write performance with an ownership problem: deleted or replaced images leave orphan blobs, and a GC that could collect one an undo resurrects is exactly the state this Tool refuses elsewhere.
- **Image-by-URL only.** The CSP's `img-src 'self'` blocks every off-origin image, so a URL can only be a data URL anyway.
- **An in-app Emoji picker.** The OS/IME panel covers insertion; the dataset would be a self-hosted megabyte for a capability the platform already has.
- **Free drag-to-resize.** See 8.
- **Dropping images from the Markdown export.** Silent loss; the PRD asks for format fidelity with a documented degradation, not deletion.
- **Bumping the draft version for new node types.** The record's shape is unchanged; the version guards the record, not the schema.
- **Accepting remote images on import.** They cannot render, and keeping them is keeping a broken image.
- **Merged cells, formulas, column widths.** The product document's own "basic tables only".
- **A second store, a second record type, or a documents list.** One draft remains the model.

---

# Asset processing — should cover work be scripted, and how is the frame proven (2026-11-28)

## The question

The Rich Text Editor's cover was cropped with a one-off PowerShell + GDI+ command whose crop box was computed by hand, on one platform, and then lost; the rules that make a cover a cover were prose, and no check could tell a correct cover from a 100×100 thumbnail. The owner asked for the processing to become a reusable script and for the workflow to absorb it. One round of five questions settled the shape. The spec is #222; the slices are #223 and #224.

## Settled branches

1. **A repository-level Python + Pillow script, invoked bare** (`python scripts/assets.py`); no package-manifest entry, no `pnpm` wrapper, no CI job.
2. **The `cover` contract**: slug, input, ratio (default 4:3), width (default 1440, never upscaling), quality (default 88), a dry run, and a move flag.
3. **Geometry**: EXIF orientation applied, alpha flattened onto white, the largest centred box, refused if that box is under 1320×990.
4. **Two files**: the source of record at the mirror path, the served cover in `public/`; copy by default, `--move` consumes the drop box so the inbox has an executor.
5. **The rule lives in the assets register; the Tool contract's cover row names the command**; the agent instructions get no third copy, because the routing table already points at the register.
6. **The frame is a test**: every declared cover, cropped to a centred 4:3 box, is at least 1320×990, read from the file's own header by a hand-written JPEG/PNG/WebP reader. The claim is "covers the box", not "is 4:3", so the 16:9 Cover Generator cover — a recorded choice the card crops — passes.
7. **Icons are not scripted yet.** The rule is "asset transformations are scripted, one subcommand per operation"; `icons` waits for a brand change.

## Open branches

- Whether the 16:9 Cover Generator cover should eventually be recropped to 4:3 rather than cropped by the card.
- The `icons` subcommand's shape, once a brand change makes it real.
- Whether the script should ever gain a "rebuild every cover and compare" mode.

## Rejected branches, and why

- **A `pnpm` wrapper.** A second invocation surface for a local command that never runs in CI.
- **A Python test runner.** A second test seam for one command; the Node assertion reads what the command produced.
- **Hand-computed crop boxes.** The arithmetic error class the script deletes.
- **GDI+ (the previous method).** Windows-only, and no EXIF handling.
- **`sharp` or `image-size` as a dependency.** The script already has Pillow, and the reader is 80 lines of header parsing.
- **An `icons` subcommand now.** An API for a brand change that has not happened.

---

# Rich Text Editor V3 — the block menu, highlight and alignment (2026-11-28)

## The question

V2 landed (#215, PR #221), and #214's checklist still lists three unbuilt items: the block-level operation menu (§4.4), text colour or highlight (§4.2 and §4.5, both marked optional in the document), and alignment (§4.2, which the document itself defers to a later version). The owner asked to continue with the checklist. One round of six questions settled the shape; the spec is #228, the slices are #229 (block handle, block menu, drag) and #230 (highlight, alignment).

## Settled branches

1. **Two slices, not one.** A is the block handle, its menu and drag-to-reorder; B is highlight and alignment. They touch the same two files (`toolbar.tsx`, `core/commands.ts`) but in different regions, and each is a complete path through the layers on its own.
2. **The block menu is a handle with four abilities.** 上移, 下移, 删除 and 转换为 — the last rendering the command table's existing `block` group rather than a second list of block types. The two PRD directions left out are deliberate: 添加新内容块 is what Enter already does, and 块设置 has nothing to set, because an image's width and alt text are its own panel's.
3. **Free drag-to-reorder — the owner's choice, asked directly.** The question offered up/down-only (which is what the repo's "presets instead of free resize" precedent would suggest) and the owner took the drag. The menu's 上移/下移 stay as the keyboard path rather than as an alternative to the gesture.
4. **The drag is ours.** A pointer drag on the handle with a 4px click/drag threshold, a pure drop-boundary function over the blocks' vertical midpoints, and one transaction so one 撤销 undoes the move. No new package in slice A.
5. **The handle is one element, always in the DOM, never over text.** It sits in the page gutter beside the canvas when the gutter holds it (52px: the control plus 8px of clearance, reached at an 856px viewport), and inside a 52px left inset of the canvas below that — the text measure narrows rather than the handle covering a glyph. One pure placement function, two homes; on 390px the reserved strip does not shrink the handle into a 36px control.
6. **The block operations are a second executor map**, keyed by their own union and living in a pure module — the shape the table's seven operations already established — not rows of the command table, because they act on the block the handle names.
7. **Highlight is one mark, not a colour.** The mark means _highlighted_; the fill is a site token per scheme, so the document carries no colour, both exports cannot disagree about one, and Markdown's `<mark>` needs no attribute. A palette would have made the colour a document value and turned Markdown into a second, lossier degradation.
8. **Alignment is an attribute of paragraphs and headings 1–3**, left being its absence, chosen from one toolbar trigger that shows the value in force. Three 44px buttons were rejected: the toolbar is already at its column's width, and a secondary formatting action does not get 132px of it.
9. **Markdown writes `<mark>`; Markdown drops alignment.** `<mark>` is underline's sibling, not a new precedent — the writer already owns exactly one inline-HTML construct for a mark GFM cannot express. Alignment is dropped the way the image width is dropped: a degradation of the format, recorded, with the words intact. The HTML export carries both, and both parsers learn both.
10. **Two new packages**, `@tiptap/extension-highlight` and `@tiptap/extension-text-align`, at the tree's 3.35 line.
11. **The highlight fill is a measured pair**, declared in the token module and walked by the token test in both schemes, so an unmeasured colour fails a test instead of shipping.
12. **No new test seam.** The pure core carries the writers, the parsers, the block arithmetic, the copy and the tokens; the gesture, the menu and the presses are the gate; the handle's geometry is the hit-area instrument.

## Open branches

- Whether the handle should also appear on a block that a touch user has tapped, or whether the caret-block rule is enough on a phone. The spec takes the caret-block rule; a real device check may ask for more.
- Whether the drag should gain auto-scroll once long documents are real in this Tool; the slice deliberately stops at the blocks on screen.
- How the handle behaves on a table row or a code block — the block it names is the top-level node, which is the answer the slice assumes and the gate does not yet probe.
- Whether 高亮 belongs in the selection toolbar at 390px: the row is clamped to the viewport with no scroll container, and a sixth mark narrows the margin (slice B's own check).

## Rejected branches, and why

- **`@tiptap/extension-drag-handle` plus its React binding.** The obvious buy, and its required peers would pull `@tiptap/extension-node-range` and the collaboration pair (`@tiptap/extension-collaboration`, `@tiptap/y-tiptap`) into an editor with no collaboration. The layer it replaces is a rectangle and some arithmetic.
- **Up/down only, with no drag.** The owner chose the gesture; it is recorded here so a later session does not re-open it as an oversight.
- **Auto-scroll during the drag.** A control class of its own — edge cases, timers, and a second way to move a block.
- **Three alignment buttons in the toolbar.** 132px of a bar that is already full, for a state the popover already shows.
- **A multi-colour highlight, or text colour.** The product document offers "colour _or_ highlight"; one mark is the complete version of the feature, and a colour stored in the document is a second degradation in Markdown and a palette to measure twice.
- **A block settings panel.** Nothing on a paragraph or a heading is configurable; an image's settings live in the panel that already exists.
- **Adding a block from the menu.** Enter at the end of a block is the same action with no menu.
- **Folding slice B's alignment into the existing `block` command group.** It would have put 左/居中/右 into the 块类型 popover and into the slash menu, which the group's own predicate decides.
