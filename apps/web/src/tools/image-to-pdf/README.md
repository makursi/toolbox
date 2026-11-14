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

The input region is the full dashed drop zone while the list is empty, and one
「继续添加」 line once it holds pages. The real `<button>选择图片</button>` is in
both states and keeps that name, because the hit-area instrument declares a
control by its accessible name and a name that changes with state cannot be
declared. The line still accepts a drop.

This is ticket #198's orientation handling, on top of #195's decode path, #193's
batch and refusal layer, #194's paper control and #196's reordering: a handle on
every row, two sensors, and the document following the list. A PNG and a WebP are
pages of the same document a JPEG is, with the same geometry rule, and an image
beyond 40 M pixels is refused from its header with its own sentence. The whole
path is real: the document is assembled by this repository, with no runtime PDF
library. #197 adds progress and cancel, #199 invalidation coverage, #200 the
instruments, #201 the design notes.

Nothing is uploaded: files are read with the File API, their first bytes are
sniffed, their headers give the page's dimensions and its EXIF turn, and the
document is built in a Worker — a baseline JPEG's original bytes go in untouched
and are turned by the content stream, while a progressive or four-channel JPEG,
a PNG and a WebP are decoded there and written as samples.

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
  orientation          the eight EXIF values, the matrix each produces, and the size swap
  geometry             image pixels + paper + orientation -> page box + image rectangle (contain, centred)
  jpeg                 a segment walk: dimensions, channels, frame type, EXIF turn, the route, passthrough
  packing              decoded RGBA -> white-composited RGB samples -> a zlib (Flate) stream
  pdf                  the PDF writer: pages in, PDF 1.7 bytes out (orientation is a content-stream matrix)
  naming               图片-YYYY-MM-DD.pdf from a date
  hints · failures     the sentences a visitor reads (including the reorder announcements)
  __tests__/           the tests for those modules
hooks/                the Tool's React state
  use-page-list        the pages added, in page order, and the refused files
  use-pdf-build        one run, its state, and the download URL's whole life
  use-page-thumbnail   a small picture of one file, one decode at a time
worker/               the browser-only half
  worker.ts            sniffs each page, routes a JPEG, decodes the rest, writes the document
  builder.ts           the page side of the Worker protocol
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
5. **Convert.** `usePdfBuild` reads each file's bytes, transfers them to one
   dedicated Worker, and waits for one response.
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
   without its bytes being touched.
7. **Download.** The result's object URL is created when the build succeeds and
   revoked when the result is invalidated or the page unmounts. Adding at least
   one page, removing one, reordering, clearing the list, or changing the paper
   resets the run and takes the link away; a batch where every file was refused
   does not, because the list on screen did not change.

The pure parts — `sniff`, `refusal`, `limits`, `admission`, `image-size`,
`order`, `orientation`, `geometry`, `jpeg`, `packing`, `pdf`, `naming` — are
unit-tested in `core/__tests__/` under `pnpm test`. Everything that needs a
browser is covered by the gate and the checklist below.

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

The unit tests hold what the gate cannot see: the exact wording of every refusal
and limit sentence, the numbers behind them, the 40 M pixel boundary and the
admission of PNG and WebP, the sample packer (a transparent pixel becomes white;
the stream is zlib-wrapped, which `unzlibSync` reads, rather than raw deflate),
and `core/order.ts`'s semantics (a move closes the gap, a position that does not
exist changes nothing, the list is never mutated). Since #198 they also hold the
eight-value orientation table — the matrix each value produces and the corner of
the picture each value sends where — the EXIF reader (little- and big-endian, a
segment with no tag, a value outside 1-8, a cut segment), the display-size swap,
`routeJpeg`'s three answers (passthrough, decode, unsupported), and the writer's
content matrix for all eight values.

Still by hand: opening the produced PDF in a real reader (Playwright saves a
file, it does not draw it), on a phone and in a second browser; a real photo from
a phone, where the camera wrote the orientation tag and the manufacturer wrote
the EXIF directory; a real progressive JPEG and a real CMYK JPEG, neither of
which a browser can encode, so no fixture can be built inline (the gate's other
decode-path specs share the same Worker code path, and the routing is unit
tested, but the real files are a person's to try); a mirrored scan (values 2, 4,
5 and 7), for the same reason; a touch drag on a real phone, where the platform
decides whether a gesture that starts on the handle belongs to the drag or to the
page's scroll (the gate dispatches `pointerType: "touch"` events, which is not
the browser's gesture arbitration); a twenty-image run and the four limits
through the page rather than through `core/`; a PNG and a WebP page on a phone,
where the canvas area limit is lower than the pixel limit; whether the handle,
the paper row and its hint read well in dark mode and at 390px; reordering with
the keyboard at 390px; progress and cancel #197; and the invalidation cases #199
covers.

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
- [ ] **▣** A JPEG whose stored pixels are portrait and whose `APP1/Exif` says
      orientation 6 gets the swapped `/MediaBox` for the chosen paper, exactly one
      image XObject whose bytes still equal the file, and a content stream whose
      matrix is the quarter turn rather than the untouched placement.
- [ ] A real photo from a phone opens upright in a desktop reader, on the phone
      and in a second browser, with no white band where the turn did not happen.
- [ ] A real progressive JPEG (exported by a photo editor) stays in the list,
      转换 succeeds, and its page holds one `/FlateDecode` image XObject with no
      `/DCTDecode` stream: it was decoded, not handed to a JPEG encoder.
- [ ] A real CMYK JPEG (from a print workflow) converts the same way, as RGB
      samples with no `/Decode [1 0 1 0 1 0 1 0]` array and no inverted colours.
- [ ] A mirrored scan (orientation 2, 4, 5 or 7) comes out as the scanner
      recorded it, with the page's proportions and the picture's placement right.
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
- [ ] Removing the row and pressing 清空 both take the produced download away,
      without a banner.
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
- [ ] A touch drag on a real phone: a finger that starts on the handle drags the
      row rather than scrolling the page, and the page still scrolls from
      anywhere else.
- [ ] Reordering with the keyboard at 390px, with the pinned result row in view.
- [ ] The page follows the site's dark mode without a white flash on load.
- [ ] The whole flow works with the keyboard alone: Tab reaches 选择图片, Enter
      opens the picker, the action and the download are reachable, the row's
      移除 is a real button, and each row's handle reorders.

Progress and cancel (#197) are still to come; the invalidation cases belong to
#199.
