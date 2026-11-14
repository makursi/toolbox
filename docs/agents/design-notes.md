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
