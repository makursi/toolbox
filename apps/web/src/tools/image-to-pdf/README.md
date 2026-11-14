# Image to PDF

Turns images into one PDF, one image per page, entirely in the browser. A visitor
chooses or drops several images at once and can add more later; every accepted
file becomes one row, numbered, which can be removed, and one control clears the
list. The row order is the page order: a row can be dragged by its handle, or
moved with the keyboard by a visitor who does not use a pointer, and the file
that comes out follows the list. The page's orientation follows each image, so a
mixed album becomes a mixed document without a question the image already
answers.

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

A phone photo comes out upright. The camera stores the picture one way and
records the turn it needs in EXIF rather than in the pixels, and a PDF has no
notion of that metadata, so all eight orientation values (including the four
mirrored ones) become a matrix in the page's content stream: the JPEG is placed
by a `cm` transform, never rotated pixel by pixel and never recompressed. Because
the last four values turn the picture by a quarter, the image's own header
dimensions are swapped for the page's proportions as well, so the page and the
row's miniature agree. Two kinds of JPEG cannot take that path: a progressive
(`SOF2`) or four-channel (CMYK/YCCK) file is decoded by the browser and written
as raw RGB samples through Flate, never handed to a JPEG encoder, because that
would be one loss on top of another. The browser applies the tag while it
decodes those, so their samples arrive upright.

A run is long enough to watch. The document is assembled in one dedicated
Worker, one page at a time, and the page counts finished pages as they arrive:
已完成 x / y 页 beside the site's progress bar, inside a live region so a screen
reader hears each page. While the run is in flight a 取消 control appears in the
result row with 转换 (below it on a narrow screen); it terminates the Worker, and
nothing from that run survives. Cancelling is not a failure: no banner, no error
sentence, just the page as it was before 转换 was pressed, ready to convert again.
The page itself never blocks, because the decode and the compression happen on
the Worker's thread.

The input region is the full dashed drop zone while the list is empty, and one
「继续添加」 line once it holds pages. The real `<button>选择图片</button>` is in
both states and keeps that name, because the hit-area instrument declares a
control by its accessible name and a name that changes with state cannot be
declared. The line still accepts a drop.

This is ticket #198's orientation handling on top of #197's run, #193's batch and
refusal layer, #194's paper control, #195's decode path, #196's reordering and
#199's invalidation: page-by-page progress in a live region, a cancel that
terminates the Worker it belongs to, a second run after a cancel that still
produces a valid file, a handle on every row, and the document following the
list. A PNG and a WebP are pages of the same document a JPEG is, with the same
geometry rule, and an image beyond 40 M pixels is refused from its header with
its own sentence. The whole path is real: the document is assembled by this
repository, with no runtime PDF library. #200 adds the instruments; #201 records
this checklist and commits the design tree at `docs/agents/design-notes.md`.

Nothing is uploaded: files are read with the File API, their first bytes are
sniffed, their headers give the page's dimensions and its EXIF turn, and the
document is built in a Worker — a baseline JPEG's original bytes go in untouched
and are turned by the content stream, while a progressive or four-channel JPEG,
a PNG and a WebP are decoded there and written as samples.

## Layout

Everything under `apps/web/src/tools/image-to-pdf/`, and the two files of the
gate it owes:

```
ImageToPdf.tsx          the page: input region, page list, paper row, pinned result row
meta.ts                 the Tool Registry entry
rules.md                this Tool's own rules (page structure, input, ordering, geometry, the writer)
README.md               this file: what it does, its files, a run, and the checklist

core/                   pure, browser-free logic; the part `pnpm test` covers
  admission.ts          one pure decision per batch: accepted pages and refusals, in input order
  failures.ts           the closed failure set, one sentence each
  geometry.ts           image pixels + paper + orientation -> page box + image rectangle (contain, centred)
  hints.ts              every sentence the page says that is not a field's content
  image-size.ts         JPEG SOF, PNG IHDR and WebP's first chunk: the page's pixel dimensions
  invalidation.ts       the one rule: a changed paper or list makes a produced file stale
  jpeg.ts               a segment walk: dimensions, channels, frame type, EXIF turn, the route, passthrough
  limits.ts             the four limits and the sentence each refusal is listed under
  naming.ts             图片-YYYY-MM-DD.pdf from a date
  order.ts              moving one page to another position: the one rule both reorder paths ask
  orientation.ts        the eight EXIF values, the matrix each produces, and the size swap
  packing.ts            decoded RGBA -> white-composited RGB samples -> a zlib (Flate) stream
  pdf.ts                the PDF writer: pages in, PDF 1.7 bytes out (orientation is a content-stream matrix)
  refusal.ts            the sentences for an unsupported format, a non-image and a damaged header
  sniff.ts              the first 96 bytes: JPEG, PNG, WebP, the four refused formats, or not an image
  __tests__/            one *.test.ts per module above

hooks/                  the Tool's React state
  use-page-list/use-page-list.ts            the pages added, in page order, and the refused files
  use-page-thumbnail/use-page-thumbnail.ts  a small picture of one file, one decode at a time
  use-pdf-build/use-pdf-build.ts            one run, its progress and cancel, and the bytes it produced

page-list/page-list.tsx   the sortable list: two sensors, the rows, their announcements
page-row/page-row.tsx     one row: drag handle, page number, page miniature, name, remove
paper-row/paper-row.tsx   the page-size row: A4 / Letter / 原始尺寸, one choice

worker/                   the browser-only half
  builder.ts            the page side of the Worker protocol: progress, the result, and termination
  worker.ts             sniffs each page, routes a JPEG, decodes the rest, reports progress, writes the document
```

```
apps/web/e2e/
  image-to-pdf-page.ts  the gate's fixtures, the page actions, and the pdf-lib reader
  image-to-pdf.spec.ts  what the gate asserts on every pull request
```

The one asset this Tool ships, outside `src/`:

```
apps/web/public/tools/image-to-pdf/cover.jpg   the homepage card's cover (1440x1080, 4:3)
                                              owner-supplied, wired by `meta.ts`; keeps its own
                                              colour and is not re-licensed (design/assets.md)
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
   Accepted files have their page dimensions read from their own header — and,
   for a JPEG, the EXIF turn that header carries — so the miniature does not need
   a second opinion about its size or its way up. The accepted files become pages
   in input order; the refused ones are listed once each, in the same order,
   under the input region.
3. **Preview.** `PageRow` calls `pageGeometry` with the image's stored
   dimensions, the chosen paper — A4 until the visitor picks another — and the
   header's orientation, and draws the page's box and the image's true rectangle
   inside it. The last four EXIF values swap the sides, so a turned photo's row
   is laid out for the picture a visitor sees rather than for the pixels the file
   records; the browser's own decode already hands the miniature an upright
   picture, so the two agree on the ratio. The PDF writer calls the same function,
   so the preview cannot disagree with the file. Switching paper reshapes every
   row, which is how the visitor sees a landscape photo's white bands before
   downloading it.
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
   sniffed again and its header walked, `routeJpeg` decides the path,
   `pageGeometry` is called, and `buildPdf` assembles PDF 1.7 with a classic xref
   table, one page object, one content stream and one image XObject per page. A
   baseline 1- or 3-channel JPEG is copied byte for byte into a `/DCTDecode`
   stream, and its EXIF orientation is a `cm` matrix in the content stream: no
   pixel is turned and no generation is lost. A progressive or four-channel JPEG
   is decoded instead, and a frame neither path can read is refused. PNG, WebP
   and those decoded JPEGs are handled in the Worker (`createImageBitmap` into an
   `OffscreenCanvas`), composited onto white by `core/packing.ts`, compressed with
   `fflate`'s `zlibSync`, and written as `DeviceRGB` samples through
   `/FlateDecode` with no `/DecodeParms`; the decoded dimensions are checked
   against the pixel limit here too, because a header is only a claim. The
   browser applies the EXIF turn when it decodes (`from-image` is its default),
   so a decoded photo's samples are already upright and its page needs no second
   matrix; the orientation table is what makes the passthrough path upright
   without its bytes being touched. Pages are handled one at a time because a PDF
   is one output stream; after each one the Worker posts `{done, total}` and the
   page redraws 已完成 x / y 页 and the bar. The page stays interactive
   throughout: only the Worker's thread is busy, which is what lets the visitor
   read progress and press 取消 while a run is taking tens of seconds.
7. **Cancel.** While a run is in flight a 取消 control appears beside 转换 (and
   nowhere else). It terminates the Worker rather than asking it to stop, so the
   bytes it was holding go with it, no result can arrive afterwards, and the next
   run starts from a new Worker. The page returns to the state it had before
   转换: no download, no progress, no banner, `转换` armed again, the list
   untouched. Cancelling is not a failure and writes nothing to the console.
8. **Download.** The finished result is an element of its own (`DownloadLink`):
   `usePdfBuild` holds the built bytes and the name `core/naming.ts` derives,
   and the element asks the shared `useObjectUrl` hook for a `blob:` URL, which
   is revoked when the element unmounts. Invalidating the result, cancelling a
   run or leaving the page therefore releases it by construction. Every change
   to the document (the paper, adding at least one page, removing one, clearing
   the list, reordering) goes through one door in `ImageToPdf.tsx` and asks
   `core/invalidation.ts`, which puts the result row back at "not converted
   yet": the link goes away and 转换 is armed again, or, after 清空, disabled
   with its usual reason, with no banner. A batch where every file was refused
   does not invalidate, and neither does a row dropped where it started: the
   list on screen did not change.

The pure parts — `sniff`, `refusal`, `limits`, `admission`, `image-size`,
`order`, `orientation`, `geometry`, `jpeg`, `packing`, `pdf`, `naming`,
`invalidation`, `hints` and `failures` — are unit-tested in `core/__tests__/`
under `pnpm test`. Everything that needs a browser is covered by the gate and the
checklist below.

## What CI covers, and what is still yours

CI runs `fmt:check`, the docs checks, `lint`, `typecheck`, `test`, `build`,
`pnpm e2e`, and the hit-area instrument (`touch-targets`, with `--falsify`). The
gate (`apps/web/e2e/image-to-pdf.spec.ts`) drives the production
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

Since #198 it also proves orientation. The fixture is a real JPEG the browser's
own canvas encoder made, with a real `APP1/Exif` segment carrying value 6
spliced straight after `SOI`; its stored pixels are portrait. It goes in through
the page's picker, and the downloaded file is read back: the row's miniature has
the landscaped aspect ratio the tag asks for, the page's `/MediaBox` is A4 in its
landscape orientation (the swapped dimensions, where a writer that ignored the
tag would have answered the portrait one), there is exactly one image XObject
whose bytes equal the fixture's, and the content stream's matrix is the quarter
turn `[0 -h w 0 x y+h]` inside that box rather than the untouched `[w 0 0 h x y]`.
The media box proves the proportions; the matrix proves the placement, and
uprightness needs both. The layout the box and matrix are asserted against is A4
landscape with the image filling the height and centred across.

Since #197 it also proves the run itself: twenty 800x600 PNGs, the Tool's own page
limit, are chosen and 转换 is pressed, and the spec waits for the
已完成 x / y 页 line to report a finished page that is not the last one before it
touches 取消. The cancel is pressed on that event rather than on a timer, so the
Worker it interrupts is provably working, and the fixture is deliberately small
per page: the run is long enough to cancel in without loading a parallel suite
with a sequence of large canvases. The spec reads 取消 and the progress bar while
the run is still going, presses 取消, asserts that the control, the progress, the
download, the banner and any failure sentence (the live region is empty) are gone
and that 转换 is armed again, waits long enough for a Worker that had merely been
asked to stop to have delivered, and converts the same list a second time. The
second file is read back by `pdf-lib`: valid preamble and xref, one page per
image, one image XObject each, and the media box of A4 in the images' landscape
orientation. The cancel control is asserted gone once each run ends.

Since #199 it also proves the invalidation rule end to end. With a file
produced, each of the five changes to the document — the paper, adding at least
one more image, removing a row, a keyboard reorder, clearing the list — is made
through the page's own control, and after each one the download is gone, the
result row's live region is empty (no failure sentence, no progress line), no
banner appears, and 转换 is armed again; clearing instead leaves it disabled with
its usual reason, and a list that still has pages never shows that reason. The
same test shows what invalidation is not: a batch in which every file was refused
leaves the produced file alone, because the list did not change.

Since #200 the page is also measured rather than merely drawn. The hit-area
instrument names its controls by their accessible names — 选择图片, 转换, 清空,
移除, 拖动排序, A4, Letter, 原始尺寸 and the shell's own two — declares the
download link as a carrier because its file name is today's date, and scans the
whole document for the layer this site left. 取消 is deliberately not declared:
it exists only while a run is in flight, and the instrument drives the page to
the finished state. Its new claim, `pinned-action-row`, reads the result row at
the top, halfway and bottom on every narrow case the instrument runs (360, 375
and 390 px, in both schemes and both pointer passes) whose list really scrolls —
the instrument hands the same fixture over eight times so the list is long
enough — requires the row inside the viewport at all three, pinned to the bottom
halfway, and clear of the last row at the end; `--falsify` injects
`position: static` on the row in a 390×900 case and the claim has been watched go
red. The fingerprint declares the five regions as anchors — the input region, the
page-size row, the page list, a page row and the result row — plus the page row's
own miniature, whose proportions the preview promise rests on (a `data-slot` the
page carries is declared per page), and drives the page with one file and one
conversion so that the list and the result row's content exist when it reads.
`pdf-progress` is not declared because it exists only during a run.

The unit tests hold what the gate cannot see: the exact wording of every refusal
and limit sentence, the progress line and the fixed name 取消, the numbers behind
the limits, the 40 M pixel boundary and the admission of PNG and WebP, the sample
packer (a transparent pixel becomes white; the stream is zlib-wrapped, which
`unzlibSync` reads, rather than raw deflate), the five failure codes' sentences
with the generic fallback for anything unrecognised, `core/order.ts`'s semantics
(a move closes the gap, a position that does not exist changes nothing, the list
is never mutated), and `core/invalidation.ts`'s matrix (which changes take a
produced file away, and the two that do not: a fully refused batch and a drop on
the row's own position). Since #198 they also hold the eight-value orientation
table — the matrix each value produces and the corner of the picture each value
sends where — the EXIF reader (little- and big-endian, a segment with no tag, a
value outside 1-8, a cut segment), the display-size swap, `routeJpeg`'s three
answers (passthrough, decode, unsupported), and the writer's content matrix for
all eight values.

`core/__tests__/pdf.test.ts` also holds the writer's structural invariants: every
xref offset resolves to its own object header, `/Count` agrees with the page
tree, every stream's `/Length` matches its data, every `/MediaBox` is the chosen
paper, and the trailer points at the catalog.

Still by hand: opening the produced PDF in a real reader (Playwright saves a
file, it does not draw it), on a phone and in a second browser; a real photo from
a phone taken in portrait and one taken in landscape, where the camera wrote the
orientation tag and the manufacturer wrote the EXIF directory; a real
progressive JPEG and a real CMYK JPEG, neither of which a browser can encode, so
no fixture can be built inline (the gate's PNG and WebP specs share the same
Worker decode path, and the routing is unit tested, but the real files are a
person's to try); a mirrored scan (values 2, 4, 5 and 7), where the gate proves
the matrix for value 6 only; a touch drag on a real phone, where the platform
decides whether a gesture that starts on the handle belongs to the drag or to the
page's scroll (the gate dispatches `pointerType: "touch"` events, which is not
the browser's gesture arbitration); the four limit refusals through the page
rather than through `core/`; a JPEG near 20 MB and twenty mixed-format images in
one run; a PNG and a WebP page on a phone, where the canvas area limit is lower
than the pixel limit; hearing the progress live region with a real screen reader,
and whether the result row still fits 转换, 取消 and the bar at 390px in dark
mode; whether the handle, the paper row and its hint read well in dark mode and
at 390px; and reordering with the keyboard at 390px.

## Manual QA checklist

`▣` marks what the browser gate asserts on every pull request, from
`apps/web/e2e/image-to-pdf.spec.ts`. An unmarked item is a person's: no machine
here re-runs it. The unit tests hold the wording and the writer's structural
invariants described above.

### The gate already asserts

- [ ] **▣** With the list empty, 转换 is disabled and its reason reads
      还没有图片，先选择一张。
- [ ] **▣** One JPEG through the page's own picker becomes exactly one row,
      numbered 第 1 页, and 转换 is enabled.
- [ ] **▣** The produced file is named `图片-YYYY-MM-DD.pdf` with today's local
      date.
- [ ] **▣** The file starts `%PDF-1.7`, carries the binary comment line, ends
      `%%EOF`; `startxref` points at `xref`, and the xref's first entry resolves
      to `1 0 obj`.
- [ ] **▣** It has one page whose `/MediaBox` is A4 in the image's orientation,
      one image XObject per page, and the image stream's bytes equal the JPEG that
      was picked.
- [ ] **▣** A portrait JPEG tagged EXIF orientation 6 gets A4 landscape: the
      row's miniature has the swapped aspect ratio, the image XObject's bytes
      still equal the file, and the content stream's matrix is the quarter turn
      `[0 -h w 0 x y+h]` rather than the untouched `[w 0 0 h x y]`.
- [ ] **▣** A mixed batch dropped as one gesture: the two JPEGs become rows in
      input order; the GIF, the AVIF and the renamed text file are listed once
      each in the refusal box, with their names and the two category sentences
      (one for a recognised but unsupported format, one for a file that is not an
      image at all).
- [ ] **▣** A second batch appends at the end: the new row is 第 3 页, then
      第 4 页; every row carries 移除 and 清空 is present; 清空 empties the list,
      removes the refusal box and brings the full drop zone back.
- [ ] **▣** The picker keeps the accessible name 选择图片 after the input region
      collapses to 继续添加, and the collapsed line still accepts a drop.
- [ ] **▣** The converted mixed batch has exactly the accepted pages in list
      order, one image XObject each, with the first page landscape and the rest
      portrait.
- [ ] **▣** The page-size row is one radiogroup named 页面尺寸 with A4, Letter
      and 原始尺寸; A4 is checked on a fresh page; 96 dpi and 不是一种纸 are
      visible; converting once per paper gives 595.28 x 841.89, 612 x 792 and
      pixels x 0.75.
- [ ] **▣** Changing the paper removes the produced download and re-arms 转换;
      the invalidation test also proves no alert appears.
- [ ] **▣** Tab from 移除 reaches A4; the arrow keys change the choice and wrap
      at both ends; `aria-checked` follows; a fresh A4 reports `data-state=on`
      and the other two `off`.
- [ ] **▣** A portrait and a landscape image in one run produce one document with
      both page orientations.
- [ ] **▣** Each row has one drag handle with the accessible name 拖动排序,
      `.touch-target` on the control itself and
      `aria-roledescription="可排序页面"`; each 移除 carries `.touch-target` too.
- [ ] **▣** A keyboard reorder: Space lifts the row and announces the page and
      total, the arrow keys move it with an announcement per position, Space
      drops it; the rows renumber, the earlier download is gone with no alert,
      and the next file's pages are the new order.
- [ ] **▣** A pointer drag of a handle, hit-tested at its coordinates, reorders
      the list and the next file's pages.
- [ ] **▣** On a `hasTouch` 390x844 context, a dispatched touch pointer gesture at
      the handle's coordinates reorders the list.
- [ ] **▣** A transparent 64x48 PNG becomes an A4 landscape page; its one image
      XObject is `/FlateDecode` with no `/DecodeParms`, and the decompressed
      pixels are white where the fixture was transparent and red where it was
      opaque.
- [ ] **▣** A WebP becomes one A4 portrait page with one `/FlateDecode` image
      XObject whose bytes are not the WebP file's.
- [ ] **▣** A PNG whose `IHDR` claims 50 M pixels is refused at admission with the
      4000 万像素 sentence and never becomes a row.
- [ ] **▣** A run of twenty 800x600 PNGs: 取消 is visible and carries
      `.touch-target`; the progress line reports a finished count strictly
      between zero and the total while the run is still building; the progress
      bar is visible; after 取消, 取消 and the progress are gone, there is no
      download, no alert and an empty polite live region, 转换 is armed again,
      and a late result does not arrive within 1.2 s; converting the same list
      again gives twenty pages, one image each, all A4 landscape.
- [ ] **▣** Invalidation: with a file produced, changing the paper, adding a
      page, removing a row and a keyboard reorder each take the download away,
      re-arm 转换, empty the result row's polite live region and show no alert; a
      fully refused batch leaves the file in place; clearing takes it away and
      leaves 转换 disabled with its reason and the empty-list line.
- [ ] **▣** 取消 is not rendered before a run, after a cancel, or after a
      completed run.

### A person must still check

- [ ] Open a produced file in a desktop reader, on a phone's reader and in a
      second browser: every page draws, the whole image is visible and centred,
      the pages are in list order, and a document with one portrait and one
      landscape page shows both upright.
- [ ] A real phone photo taken in portrait and one taken in landscape both open
      upright, with no white band where a turn did not happen. The gate's tagged
      photo is synthetic; the camera's own EXIF directory is not.
- [ ] A real progressive JPEG (exported by a photo editor) stays in the list,
      转换 succeeds, and its page holds one `/FlateDecode` image XObject with no
      `/DCTDecode` stream: it was decoded, not handed to a JPEG encoder.
- [ ] A real CMYK JPEG (from a print workflow) converts the same way, as RGB
      samples with no `/Decode [1 0 1 0 1 0 1 0]` array and no inverted colours.
- [ ] A mirrored scan (orientation 2, 4, 5 or 7) comes out as the scanner
      recorded it, with the page's proportions and the picture's placement right.
      The gate proves the matrix for value 6 only; the other seven have unit
      tests but no real file here.
- [ ] A real transparent PNG (partial alpha, from a design tool) composites onto
      white rather than black and opens correctly in a reader. The gate's
      transparent fixture is built by the browser's own canvas encoder.
- [ ] A real WebP from a camera or an editor becomes a page and opens correctly
      in a reader. The gate's WebP is the browser's own encoder's output.
- [ ] A JPEG close to 20 MB is accepted, converts without a second compression
      and opens; a JPEG just over 20 MB is refused with the per-image sentence.
- [ ] Twenty images of mixed formats (JPEG, PNG and WebP in one list) convert to
      one file with twenty pages in list order, and the file opens in a reader.
- [ ] Cancel a run that is long for real reasons, then convert the same list
      again: the second file has every page, no partial file survives the cancel,
      and nothing from the cancelled run appears late. The gate's run is twenty
      800x600 PNGs.
- [ ] Drag a row by its handle on a touch device: the finger that starts on the
      handle moves the row, the page still scrolls from anywhere else, and the
      next file has the reorder.
- [ ] A twenty-first image is refused with the count sentence, a batch over
      100 MB with the total sentence, and a genuine image over 4000 万像素 at
      admission with the pixel sentence; each refused file appears once, with its
      own name, under the refusal title 有文件没能加入.
- [ ] Switching paper visibly reshapes every row: A4 and Letter draw different
      page proportions, and 原始尺寸 has no white bands.
- [ ] The miniature is the page: the paper's proportions and the image's
      letterboxing inside it match the produced file. The geometry is unit
      tested; the gate reads the swapped aspect ratio of a tagged photo, not the
      drawn rectangle.
- [ ] The paper row and its hint read correctly in dark mode and at 390px, and
      the result row still fits 转换, 取消 and the progress bar at 390px in dark
      mode.
- [ ] A run's progress is readable and 取消 stops it on a real phone.
- [ ] The progress live region announces each finished page with a real screen
      reader, and the page-size row reads as one choice with its checked state
      rather than as three unrelated buttons.
- [ ] Reordering works with the keyboard at 390px, with the pinned result row in
      view.
- [ ] The page follows the site's dark mode without a white flash on load.
- [ ] The whole flow works with the keyboard alone: Tab reaches 选择图片, Enter
      opens the picker, the action and the download are reachable, 移除 is a
      button, and each handle reorders.

The design tree that produced this Tool, including the decisions this README
records, is committed at `docs/agents/design-notes.md`. The fingerprint baseline
the instruments were compared against is a local file, not a repository one.
