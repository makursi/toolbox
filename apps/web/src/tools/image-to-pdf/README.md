# Image to PDF

Turns images into one PDF, one image per page, entirely in the browser. The page
holds one row per page, each row drawn as a miniature of the page it will become,
so the paper's proportions and the image's letterboxing are visible before the
download. Page order is list order; there is no imposition and no page holds two
images.

This is ticket #192's tracer bullet, widened by the tickets after it. The whole
path is real — the document is assembled by this repository, with no runtime PDF
library — and the seams every later ticket builds on are in place: the geometry
function, the JPEG header walk, the PDF writer, the derived name and the
dedicated Worker. #194 has landed the paper control: A4, Letter or 原始尺寸,
with every row reshaping to the chosen paper. #193 adds the other two formats and
the refusal sentences, #195/#196 the decode path and reordering, #197 progress
and cancel, #198 EXIF orientation, #199 invalidation coverage, #200 the
instruments, #201 the design notes.

Nothing is uploaded: files are read with the File API, the JPEG's header is read
for its dimensions, and the document is built in a Worker from the original bytes.

## Layout

```
ImageToPdf.tsx        the page: input region, page list, paper row, pinned result row
page-row/             one row: page number, page miniature, name, remove
paper-row/            the page-size row: A4 / Letter / 原始尺寸, one choice
meta.ts               the Tool Registry entry
rules.md              this Tool's own rules (page structure, geometry, the writer)
README.md             this file: how it works, and what to check by hand
core/                 pure, browser-free logic — the part `pnpm test` covers
  geometry            image pixels + paper -> page box + image rectangle (contain, centred)
  jpeg                a segment walk: dimensions, channels, progressive, passthrough predicate
  pdf                 the PDF writer: pages in, PDF 1.7 bytes out
  naming              图片-YYYY-MM-DD.pdf from a date
  hints · failures    the sentences a visitor reads
  __tests__/          the tests for those modules
hooks/                the Tool's React state
  use-page-list       the pages added, in page order
  use-pdf-build       one run, its state, and the download URL's whole life
  use-page-thumbnail  a small picture of one file, one decode at a time
worker/               the browser-only half
  worker.ts           walks each header, decides the path, writes the document
  builder.ts          the page side of the Worker protocol
```

A hook that knows nothing about this Tool goes to `src/hooks/` instead, and UI
that no route owns goes to `src/components/`. The threshold is ownership, not how
many places use it — the place that counts consumers is `packages/*`.

## How a run works

1. **Choose.** The real `<button>选择图片</button>` opens a hidden
   `input[type=file]` (no `accept`: the format is read from the bytes). Each file
   becomes a page with the dimensions `readJpeg` finds in its own frame header,
   so the miniature does not need a second opinion about its size.
2. **Preview.** `PageRow` calls `pageGeometry` with the image's dimensions and
   the chosen paper — A4 until the visitor picks another — and draws the page's
   box and the image's true rectangle inside it. The PDF writer calls the same
   function, so the preview cannot disagree with the file. Switching paper
   reshapes every row, which is how the visitor sees a landscape photo's white
   bands before downloading it.
3. **Convert.** `usePdfBuild` reads each file's bytes, transfers them to one
   dedicated Worker, and waits for one response.
4. **Write.** Inside the Worker (`worker/worker.ts`), each page's JPEG header is
   walked again, the passthrough predicate is applied, `pageGeometry` is called,
   and `buildPdf` assembles PDF 1.7 with a classic xref table, one page object,
   one content stream and one DCT-encoded image XObject per page. A baseline 1-
   or 3-channel JPEG is copied byte for byte; anything else is refused with a
   sentence for now.
5. **Download.** The result's object URL is created when the build succeeds and
   revoked when the result is invalidated or the page unmounts. Every change to
   the list, and every change of paper, resets the run and takes the link away.

The pure parts — `geometry`, `jpeg`, `pdf`, `naming` — are unit-tested in
`core/__tests__/` under `pnpm test`. Everything that needs a browser is covered by
the gate and the checklist below.

## What CI covers, and what is still yours

CI runs `fmt:check`, the docs checks, `lint`, `typecheck`, `test`, `build` and
`pnpm e2e`. The gate (`apps/web/e2e/image-to-pdf.spec.ts`) drives the production
build in a real browser and covers the items marked **▣**: a real JPEG through
the page's own file input, the action pressed, the download captured, and the
file parsed with `pdf-lib` — a second implementation installed as a dev
dependency, never imported by app code. Since #194 it reads the media box back
for each of the three paper choices, drives the row from the keyboard, and checks
that changing the paper takes the produced file away.

Still by hand: opening the produced PDF in a real reader (Playwright saves a
file, it does not draw it), on a phone and in a second browser; the formats and
limits #193 adds; whether the paper row and its hint read well in dark mode and
at 390px; the decode path #195 adds; reordering #196; progress and cancel #197;
EXIF orientations #198; and the invalidation cases #199 covers.

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
- [ ] A progressive JPEG stays in the list and 转换 says it cannot be written
      directly (until #195 lands the decode path).
- [ ] Removing the row and pressing 清空 both take the produced download away,
      without a banner.
- [ ] The page follows the site's dark mode without a white flash on load.
- [ ] The whole flow works with the keyboard alone: Tab reaches 选择图片, Enter
      opens the picker, the action and the download are reachable, and the row's
      移除 is a real button.

The twenty-image run, the mixed formats and the limits belong to #193's
checklist; reordering, progress, cancel and the EXIF orientations to
#195-#198.
