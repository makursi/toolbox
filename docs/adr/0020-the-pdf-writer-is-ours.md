# The PDF writer is this repository's

> **Scope**: this decision binds the Image to PDF Tool and no other Tool. A
> future Tool that writes an Office file, an archive or a second document format
> makes its own decision; nothing here is inherited. See
> `docs/adr/0014-tool-scoped-rules-live-with-the-tool.md`.

The Image to PDF Tool needs PDF bytes from a browser, with no server, keeping the
site's promise that a file never leaves the device. The decision is that **this
repository writes the PDF**, in one replaceable layer behind
`apps/web/src/tools/image-to-pdf/core/pdf.ts`: pages in (geometry plus an encoded
image), PDF 1.7 bytes out. It is about 280 lines, with its structural tests, in
the same tradition as the hand-written BMP encoder.

The requirement that settles it is not the page assembly — that is a catalog, a
page tree and three objects per page. It is **what happens to a JPEG**. A phone
photo of a receipt or a signed contract has already been through a lossy encoder
once, and writing it into a PDF by decoding and re-encoding would spend a
generation of quality on the way to paper. PDF has a filter for exactly this:
`/Filter /DCTDecode` over the original bytes. The same requirement recurs for
PNG and WebP, which must be decoded, flattened onto white and written as raw
samples through `FlateDecode`; and for EXIF orientation, which is expressed as a
content-stream matrix rather than by rotating pixels.

**The gate and the unit tests are two different readings, and both exist.** The
unit tests assert the properties a reader relies on — every xref offset resolves
to its own object header, `/Count` agrees with the page tree, every stream's
declared `/Length` matches its data, every `/MediaBox` is the chosen paper. The
browser gate parses the downloaded file with `pdf-lib`, installed as a **dev
dependency only** and never imported by app code, so this repository's writer is
checked against a second implementation rather than against itself.

## Consequences

- **No runtime PDF dependency exists.** The shipped bundle carries the writer and
  nothing else; `pdf-lib` is in `devDependencies` because the gate reads files
  with it.
- **The writer is one seam and is expected to be replaced rather than patched.**
  If real use produces one "this file will not open" in a reader, the writer is
  replaced by the library considered below. The page model, the geometry, the
  components, the Worker protocol and the tests stay put. That exit criterion is
  recorded in the Tool's own rules file, where the person holding the broken file
  will be reading.
- **Growth lands inside the layer, not above it.** #195 adds a raw-RGB
  `FlateDecode` image kind to `PdfImage`; #198 adds the content-stream matrix.
  Callers keep passing a page with its geometry and an image source.
- **The cost is ours to carry.** Classic xref, no object streams, no fonts, no
  transparency groups — the subset the Tool needs. A future capability this
  subset cannot express (a text layer, a bookmark, an encrypted file) is a new
  decision, not a reason to keep the library installed "just in case".
- **The gate is deliberately not a reader.** Playwright saves a PDF; it does not
  draw it. "Open it once in a desktop reader, once on a phone" stays a manual item
  in the Tool's README, which is where this repository keeps what a machine cannot
  re-run.

## Considered Options

Each of the three PDF libraries was costed before it was rejected. The numbers
are the ones the design note recorded; the reason each is rejected is that the
cost buys no answer to this Tool's two hard parts, EXIF orientation and WebP.

- **`pdf-lib` as a runtime dependency.** Rejected at about 177 KB gzip, most of
  it font metrics this Tool never uses, on a package frozen upstream since 2021.
  It would still leave EXIF orientation and WebP to this repository, because it
  does not apply the orientation tag and does not decode a WebP; its pako
  dependency also carries a known bundler fault. The bundle is paid and the two
  hard parts stay.
- **The maintained fork of `pdf-lib`.** Rejected at about 26 MB unpacked. It
  fixes the abandonment and not the shape: same embedders, same two gaps, so the
  trade is a much larger install for the same remaining work.
- **`pdfkit`.** Rejected at about 10 MB unpacked. It is the one candidate that
  rotates JPEGs by EXIF itself, but it is a Node-flavoured entry with a streaming
  API this one-image-per-page document would have to be contorted around, and it
  still does not take WebP. The one hard part it does solve, JPEG orientation, is
  the content-stream matrix this repository writes itself, which is cheaper than
  the install and keeps the original bytes untouched.
- **A server-side generator.** Rejected before it was costed: it breaks the
  site's one promise for exactly the documents where the promise matters most.
- **The browser's own print dialog.** Rejected: it hands the visitor a preview
  they must operate, gives no control over the bytes, and cannot put a JPEG in
  without a re-encode.
