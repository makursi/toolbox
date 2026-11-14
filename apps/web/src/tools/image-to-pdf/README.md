# Image to PDF

Turns images into one PDF, one image per page, entirely in the browser. A visitor
chooses or drops several images at once and can add more later; every accepted
file becomes one row, numbered, which can be removed, and one control clears the
list. The row order is the page order: a row can be dragged by its handle, or
moved with the keyboard by a visitor who does not use a pointer, and the file
that comes out follows the list. The page size follows each image, so a mixed
album becomes a mixed document without a question the image already answers.

What a file is, is decided by its bytes: JPEG, PNG and WebP are taken, and the
name and the declared type are never consulted, which is why the file input has
no `accept` attribute. AVIF, BMP, HEIC and GIF are recognised as images this Tool
does not take and refused with **one** sentence for all of them, because a list
of refused formats expires. A file that is not an image gets a different
sentence, and each of the four limits (20 images per list, 20 MB per image,
100 MB in total, 40 M pixels per image) has a sentence that names it. The pixel
limit is the one bytes cannot express: it is read from the image's own header
before anything is decoded, so a 29-byte PNG that asks for 50 M pixels is refused
at admission. Refused files are listed once each under the input region; a
decoder's or the browser's own error text never reaches the interface.

All three formats become pages of the same document, and a JPEG costs the photo
no generation: its original bytes go into the PDF. PNG and WebP cannot, because
no PDF filter carries their own compressed bytes; the browser decodes them, their
transparent pixels are composited onto white paper, and the samples are written
through a zlib (Flate) stream. A transparent logo therefore behaves like ink on a
page rather than like a black rectangle.

A run is long enough to watch. The document is assembled in one dedicated
Worker, one page at a time, and the page counts finished pages as they arrive:
已完成 x / y 页 beside the site's progress bar, inside a live region so a screen
reader hears each page. While the run is in flight a 取消 control sits beside
转换; it terminates the Worker, and nothing from that run survives. Cancelling
is not a failure: no banner, no error sentence, just the page as it was before
转换 was pressed, ready to convert again. The page itself never blocks, because
the decode and the compression happen on the Worker's thread.

The input region is the full dashed drop zone while the list is empty, and one
「继续添加」 line once it holds pages. The real `<button>选择图片</button>` is in
both states and keeps that name, because the hit-area instrument declares a
control by its accessible name and a name that changes with state cannot be
declared. The line still accepts a drop.

This is ticket #197's run, on top of #193's batch and refusal layer, #194's paper
control, #195's decode path, #196's reordering and #199's invalidation:
page-by-page progress in a live region, a cancel that terminates the Worker it
belongs to, a second run after a cancel that still produces a valid file, and one
rule that takes a produced file away the moment the paper or the list changes. The
whole path is real: the document is assembled by this repository, with no runtime
PDF library. #198 adds EXIF orientation and the progressive/CMYK JPEG decode,
#200 the instruments, #201 the design notes.

Nothing is uploaded: files are read with the File API, their first bytes are
sniffed, their headers give the page's dimensions, and the document is built in
a Worker — a JPEG's original bytes go in untouched, and a PNG or WebP is decoded
there and written as samples.

## Layout

```
ImageToPdf.tsx        the page: input region, page list, paper row, pinned result row
page-list/            the sortable list: two sensors, the rows, their announcements
page-row/             one row: drag handle, page number, page miniature, name, remove
paper-row/            the page-size row: A4 / Letter / 原始尺寸, one choice
meta.ts               the Tool Registry entry
rules.md              this Tool's own rules (page structure, input, ordering, geometry, the writer)
README.md             this file: how it works, and what to check by hand
core/                 pure, browser-free logic — the part `pnpm test` covers
  sniff                the first bytes: JPEG, PNG, WebP, the four refused formats, or not an image
  refusal              the sentences for an unsupported format, a non-image and a damaged header
  limits               the four limits and the sentence each refusal is listed under
  admission            one pure decision per batch: accepted pages and refusals, in input order
  image-size           JPEG SOF, PNG IHDR and WebP's first chunk: the page's pixel dimensions
  order                moving one page to another position: the one rule both reorder paths ask
  geometry             image pixels + paper -> page box + image rectangle (contain, centred)
  jpeg                 a segment walk: dimensions, channels, progressive, passthrough predicate
  packing              decoded RGBA -> white-composited RGB samples -> a zlib (Flate) stream
  pdf                  the PDF writer: pages in, PDF 1.7 bytes out
  naming               图片-YYYY-MM-DD.pdf from a date
  invalidation         the one rule: a changed paper or list makes a produced file stale
  hints · failures     the sentences a visitor reads (including progress and the reorder announcements)
  __tests__/           the tests for those modules
hooks/                the Tool's React state
  use-page-list        the pages added, in page order, and the refused files
  use-pdf-build        one run, its progress and cancel, and the download URL's whole life
  use-page-thumbnail   a small picture of one file, one decode at a time
worker/               the browser-only half
  worker.ts            sniffs each page, decodes PNG/WebP, reports progress, writes the document
  builder.ts           the page side of the Worker protocol: progress, the result, and termination
```

A hook that knows nothing about this Tool goes to `src/hooks/` instead, and UI
that no route owns goes to `src/components/`. The threshold is ownership, not how
many places use it — the place that counts consumers is `packages/*`.

## How a run works

1. **Choose or drop.** The real `<button>选择图片</button>` opens a hidden
   `input[type=file]` (no `accept`), and the dashed box is also a drop target.
   Both hand over every file at once, in the order the picker or the folder
   gives them. A second batch appends to the list instead of replacing it.
2. **Admit.** Each file's first 96 bytes are sniffed. `core/admission.ts` then
   decides the whole batch against the list's current count and total bytes:
   unsupported formats and non-images are refused with one sentence each, a file
   over 20 MB with its own, a twenty-first image with its own, a file that would
   push the list over 100 MB with its own, and an image whose header names more
   than 40 M pixels with its own — that last one without ever decoding the file.
   Accepted files have their page dimensions read from their own header, so the
   miniature does not need a second opinion about its size. The accepted files
   become pages in input order; the refused ones are listed once each, in the
   same order, under the input region.
3. **Preview.** `PageRow` calls `pageGeometry` with the image's dimensions and
   the chosen paper — A4 until the visitor picks another — and draws the page's
   box and the image's true rectangle inside it. The PDF writer calls the same
   function, so the preview cannot disagree with the file. Switching paper
   reshapes every row, which is how the visitor sees a landscape photo's white
   bands before downloading it.
4. **Order.** Each row has one drag handle, the same `拖动排序` button on every
   row, and it is the only activator: the row's text and its remove control never
   start a drag. A pointer drags the handle; a visitor on the keyboard focuses
   the handle, presses Space to lift the row, the arrow keys to move it over its
   neighbour, and Space again to put it down (Esc cancels). Both paths end in
   `core/order.ts`, and dnd-kit's live region announces the lift, each new
   position, the drop and the cancellation in this page's own words. A row that
   is dropped where it was changes nothing, so it does not invalidate a result.
5. **Convert.** `usePdfBuild` reads each file's bytes, shows the run at
   已完成 0 / y 页, transfers the bytes to one dedicated Worker, and waits for
   one result.
6. **Write.** Inside the Worker (`worker/worker.ts`), each page's bytes are
   sniffed again and its header walked, the passthrough predicate is applied,
   `pageGeometry` is called, and `buildPdf` assembles PDF 1.7 with a classic xref
   table, one page object, one content stream and one image XObject per page. A
   baseline 1- or 3-channel JPEG is copied byte for byte into a `/DCTDecode`
   stream. PNG and WebP are decoded in the Worker (`createImageBitmap` into an
   `OffscreenCanvas`), composited onto white by `core/packing.ts`, compressed with
   `fflate`'s `zlibSync`, and written as `DeviceRGB` samples through
   `/FlateDecode` with no `/DecodeParms`; the decoded dimensions are checked
   against the pixel limit here too, because a header is only a claim.
   Progressive and 4-channel JPEGs still end in the `unsupported` sentence until
   #198 lands their decode path. Pages are handled one at a time because a PDF is
   one output stream; after each one the Worker posts `{done, total}` and the
   page redraws 已完成 x / y 页 and the bar. The page stays interactive
   throughout: only the Worker's thread is busy, which is what lets the visitor
   read progress and press 取消 while a run is taking tens of seconds.
7. **Cancel.** While a run is in flight a 取消 control appears beside 转换 (and
   nowhere else). It terminates the Worker rather than asking it to stop, so the
   bytes it was holding go with it, no result can arrive afterwards, and the next
   run starts from a new Worker. The page returns to the state it had before
   转换: no download, no progress, no banner, `转换` armed again, the list
   untouched. Cancelling is not a failure and writes nothing to the console.
8. **Download.** The result's object URL is created when the build succeeds and
   revoked when the result is invalidated, cancelled or the page unmounts. Every
   change to the document (the paper, adding at least one page, removing one,
   clearing the list, reordering) goes through one door in `ImageToPdf.tsx` and
   asks `core/invalidation.ts`, which puts the result row back at "not converted
   yet": the link goes away and 转换 is armed again, or, after 清空, disabled
   with its usual reason, with no banner. A batch where every file was refused
   does not invalidate, and neither does a row dropped where it started: the list
   on screen did not change.

The pure parts — `sniff`, `refusal`, `limits`, `admission`, `image-size`,
`order`, `geometry`, `jpeg`, `packing`, `pdf`, `naming`, `invalidation`, `hints`
and `failures` — are unit-tested in `core/__tests__/` under `pnpm test`.
Everything that needs a browser is covered by the gate and the checklist below.

## What CI covers, and what is still yours

CI runs `fmt:check`, the docs checks, `lint`, `typecheck`, `test`, `build` and
`pnpm e2e`. The gate (`apps/web/e2e/image-to-pdf.spec.ts`) drives the production
build in a real browser and covers the items marked **▣**: a real JPEG through
the page's own file input, the action pressed, the download captured, and the
file parsed with `pdf-lib` — a second implementation installed as a dev
dependency, never imported by app code. Since #194 it also reads the media box
back for each of the three paper choices, drives the row from the keyboard, and
checks that changing the paper takes the produced file away; since #193 a
mixed batch in which two real JPEGs surround a GIF, an AVIF and a renamed text
file, dropped as one gesture, with the refusals read as text, a second batch
appended, and a PDF whose page count, image-XObject count and image bytes equal
the accepted files in list order. Since #195 it also takes a transparent PNG and
reads the stream back with `fflate`: white where the fixture was transparent,
its own colour where it was opaque, `/FlateDecode` and no `/DecodeParms`; a
WebP page with the media box its dimensions ask for; and a PNG whose `IHDR` names
50 M pixels, refused at admission with the pixel sentence.

Since #196 it also proves the order: three JPEGs with different bytes and
different shapes go in, the first row's handle is lifted with Space, walked to
the last position with the arrow keys and dropped with Space, and the
announcement in dnd-kit's live region is read after each step. The download
produced before the move is gone (a reorder invalidates it, with no banner), and
the one produced after it has the page order the list shows — proved from the
downloaded file, not from the page. A second test performs the same move with
`page.mouse` down/move/up at the handle's coordinates, hit-testing the point
first so a wrapper that took the click would fail loudly rather than silently do
nothing; a third does it on a `hasTouch` context at 390px with dispatched
pointer events of `pointerType: "touch"`.

Since #197 it also proves the run itself: eight large PNGs are chosen, 转换 is
pressed, and while the run is still going the spec reads 取消, the 已完成 x / y 页
line at a count that is neither zero nor the total, and the progress bar. It then
presses 取消, asserts that the control, the progress, the download and any banner
are gone and that 转换 is armed again, waits long enough for a Worker that had
merely been asked to stop to have delivered, and converts the same list a second
time. The second file is read back by `pdf-lib`: valid preamble and xref, one
page per image, one image XObject each, and the media box of A4 in the images'
landscape orientation. The cancel control is asserted gone once each run ends.

Since #199 it also proves the invalidation rule end to end. With a file
produced, each of the five changes to the document — the paper, adding at least
one more image, removing a row, a keyboard reorder, clearing the list — is made
through the page's own control, and after each one the download is gone, the
result row's live region is empty (no failure sentence, no progress line), no
banner appears, and 转换 is armed again; clearing instead leaves it disabled with
its usual reason, and a list that still has pages never shows that reason. The
same test shows what invalidation is not: a batch in which every file was refused
leaves the produced file alone, because the list did not change.

The unit tests hold what the gate cannot see: the exact wording of every refusal
and limit sentence, the progress line and the fixed name 取消, the numbers behind
the limits, the 40 M pixel boundary and the admission of PNG and WebP, the sample
packer (a transparent pixel becomes white; the stream is zlib-wrapped, which
`unzlibSync` reads, rather than raw deflate), the five failure codes' sentences
with the generic fallback for anything unrecognised, `core/order.ts`'s semantics
(a move closes the gap, a position that does not exist changes nothing, the list
is never mutated), and `core/invalidation.ts`'s matrix (which changes take a
produced file away, and the two that do not: a fully refused batch and a drop on
the row's own position).

Still by hand: opening the produced PDF in a real reader (Playwright saves a
file, it does not draw it), on a phone and in a second browser; a touch drag on a
real phone, where the platform decides whether a gesture that starts on the
handle belongs to the drag or to the page's scroll (the gate dispatches
`pointerType: "touch"` events, which is not the browser's gesture arbitration);
a twenty-image run and the four limits through the page rather than through
`core/`; a PNG and a WebP page on a phone, where the canvas area limit is lower
than the pixel limit; hearing the progress live region with a real screen reader,
and whether the pinned row still fits 转换, 取消 and the bar at 390px in dark
mode; whether the handle, the paper row and its hint read well in dark mode and
at 390px; reordering with the keyboard at 390px; and EXIF orientations and the
progressive/CMYK JPEG decode #198.

## Manual QA checklist

- [ ] **▣** One JPEG goes through the page's own picker and becomes exactly one
      row, numbered 第 1 页, with a miniature whose paper proportions and image
      rectangle match what the geometry function says.
- [ ] **▣** With the list empty, 转换 is disabled and the reason beside it says
      which step is missing.
- [ ] **▣** Pressing 转换 produces a download named `图片-YYYY-MM-DD.pdf` with
      today's local date.
- [ ] **▣** The downloaded file has a `%PDF-1.7` preamble, the binary comment
      line, a classic xref table whose first offset resolves to object 1, a
      trailer pointing at the catalog, and `%%EOF`.
- [ ] **▣** It has one page, its `/MediaBox` is A4 in the image's orientation
      (595.28 x 841.89 for a portrait photo), and each page's resources name
      exactly one image XObject.
- [ ] **▣** The image stream's bytes equal the JPEG that was picked: no decode,
      no re-encode.
- [ ] **▣** A mixed batch dropped at once: the two JPEGs become rows in the order
      given, and the GIF, the AVIF and the renamed text file are listed once each
      with the sentence for their category, under 有文件没能加入.
- [ ] **▣** A second batch appends without renumbering or disturbing the first;
      every row carries 移除 and 清空 is present while the list has pages; 清空
      empties the list and brings the full drop zone back.
- [ ] **▣** The picker's accessible name stays 选择图片 after the input region
      collapses to the 继续添加 line, and that line still accepts a drop.
- [ ] **▣** The converted mixed batch has exactly the accepted pages, in list
      order, with one image XObject each.
- [ ] **▣** The page-size row offers A4, Letter and 原始尺寸 as one single
      choice, A4 checked on a fresh page, and explains 原始尺寸 as the image's
      own pixels at 96 dpi rather than as a paper size.
- [ ] **▣** Downloading once per paper gives the media box the choice promises:
      A4 595.28 x 841.89, Letter 612 x 792, and 原始尺寸 the source's pixels x
      0.75.
- [ ] **▣** Changing the paper takes a produced download away and re-arms 转换,
      without a banner.
- [ ] **▣** Tab reaches the row at the checked choice and the arrow keys change
      the choice (wrapping at both ends); the selected item differs by
      `aria-checked` and `data-state`, not only by colour.
- [ ] **▣** A portrait and a landscape image in one run produce one document
      with pages of both orientations.
- [ ] Switching paper visibly reshapes every row: A4 and Letter draw different
      page proportions, and 原始尺寸 has no white bands.
- [ ] The paper row and its hint read correctly in dark mode and at 390px, and
      the pinned result row still sits inside the viewport while the list
      scrolls.
- [ ] The file opens in a desktop reader, in a phone's reader, and in a second
      browser, with the whole image visible and centred.
- [ ] A landscape JPEG produces a landscape page.
- [ ] **▣** A transparent PNG becomes a page whose media box follows its own
      dimensions; its image XObject is `/FlateDecode` with no `/DecodeParms`, and
      decompressing the stream gives white where the PNG was transparent and the
      source colour where it was opaque.
- [ ] **▣** A WebP becomes a page the same way, with the media box its dimensions
      ask for and exactly one image XObject.
- [ ] **▣** A PNG whose header claims more than 40 M pixels is refused at
      admission with the pixel sentence, without a row and without a decode.
- [ ] A twenty-first image is refused with the count sentence, a file over 20 MB
      with the per-image sentence, a batch over 100 MB with the total sentence,
      and a genuine image over 4000 万像素 at admission with the pixel sentence;
      each refused file appears once, with its own name.
- [ ] A progressive or four-channel JPEG stays in the list and 转换 says it cannot
      be written directly (the decode path is #198's).
- [ ] **▣** With a file produced, adding at least one more image, removing a row,
      and a keyboard reorder each take the download away and re-arm 转换, with no
      banner, no error sentence and no stale progress line; a list that still has
      pages never shows the empty-list reason.
- [ ] **▣** Clearing a list that has a produced file takes the download away and
      leaves 转换 disabled with its usual reason; a batch in which every file was
      refused leaves the produced file in place, because the list did not change.
- [ ] **▣** Every row carries one drag handle — a real `<button>`, the same
      accessible name `拖动排序` on all of them, and `.touch-target` on the
      button itself (`移除` is built the same way).
- [ ] **▣** A pointer drag of a handle reorders the list, and the downloaded
      file's page order is the new list order.
- [ ] **▣** Focusing a handle and pressing Space, then the arrow keys, then
      Space moves the row and announces the lift, the new position and the drop
      in dnd-kit's live region.
- [ ] **▣** The same move works on a `hasTouch` context at 390px with
      `pointerType: "touch"` events dispatched at the handle's coordinates.
- [ ] **▣** A reorder takes a produced download away and re-arms 转换, with no
      banner and no error sentence.
- [ ] **▣** While a run is in flight, 取消 appears beside 转换, the result row
      reads 已完成 x / y 页 for a count between zero and the total, and the
      progress bar is there; the line sits in a polite live region.
- [ ] **▣** Pressing 取消 ends the run: the control, the progress and the bar are
      gone, no download appears then or a moment later, there is no banner and no
      error sentence, and 转换 is enabled again. Converting the same list again
      produces a valid file with every page.
- [ ] **▣** 取消 is not rendered once a run has ended.
- [ ] A twenty-image run's progress is readable and 取消 stops it on a real phone.
- [ ] The progress live region announces each finished page with a real screen
      reader, and the result row with 转换, 取消 and the bar still fits at 390px
      in dark mode.
- [ ] A touch drag on a real phone: a finger that starts on the handle drags the
      row rather than scrolling the page, and the page still scrolls from
      anywhere else.
- [ ] Reordering with the keyboard at 390px, with the pinned result row in view.
- [ ] The page follows the site's dark mode without a white flash on load.
- [ ] The whole flow works with the keyboard alone: Tab reaches 选择图片, Enter
      opens the picker, the action and the download are reachable, the row's
      移除 is a real button, and each row's handle reorders.

The EXIF orientations and the progressive/CMYK JPEG decode (#198), the instruments
(#200) and the design notes and screenshot baseline (#201) are still to come.
