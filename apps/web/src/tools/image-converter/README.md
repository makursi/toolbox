# Image Converter

Converts PNG, JPEG, WebP, AVIF and BMP into each other, in bulk, entirely in the browser. One input file can be sent to several target formats at once, each with its own quality, lossless setting and codec options.

Nothing is uploaded: the files are read with the File API, decoded and encoded in Web Workers, and the results are held as blobs until they are downloaded.

## Layout

```
ImageConverter.tsx   the Tool's UI; the route renders this and nothing else
meta.ts              the Tool Registry entry
README.md            this file: how it works, and what to check by hand
zip.ts               turns the finished outputs into one download
core/                pure, browser-free logic — the part `pnpm test` covers
  formats · advanced · options · bmp · geometry · limits · naming · plan · sniff
  __tests__/         the tests for those modules
worker/              the browser-only half
  worker.ts          decode, rotate, flatten, resize, encode — one Conversion
  converter.ts       the Worker pool and the Batch queue
```

## How a Conversion runs

`ImageConverter.tsx` (client) plans a Batch with `planConversions`, then `ConversionPool` hands each Conversion to a Worker. Inside the Worker (`worker/worker.ts`):

1. `createImageBitmap` decodes the file — the browser's own decoder, for every input format.
2. An `OffscreenCanvas` at the rotated size; when the target has no alpha channel it is created with `{ alpha: false }` and filled with the chosen background, which is what stops transparent pixels turning black in JPEG.
3. `context2d.getImageData` and, if a longest edge was asked for, a pass through @jsquash/resize (lanczos3).
4. Encode: **PNG** by canvas, then an oxipng pass; **BMP** by `core/bmp.ts`; **JPEG/WebP/AVIF** by the jSquash codecs. AVIF and oxipng use their single-threaded builds on purpose — see `docs/adr/0004-image-codecs-single-threaded-in-a-worker.md`.

The pure parts — `sniff`, `naming`, `limits`, `geometry`, `bmp`, `options`, `planConversions` — are unit-tested in `core/__tests__/` under `pnpm test`. Everything that needs a browser is covered by the checklist below instead.

## What CI does not cover

CI runs `fmt:check`, `lint`, `typecheck`, `test` and `build`. It cannot run a browser, so it does not know whether a codec produces a valid file, whether the drop zone is reachable from the keyboard, or whether the CSS layers still order correctly. Re-run the checklist by hand when a `@jsquash/*` version changes, when an encoder is touched, when the CSP in `next.config.ts` changes, or when the `@layer` line in `globals.css` changes — that line is what keeps Tailwind's utilities able to override Mantine, and getting it wrong is invisible in a build.

## Manual QA checklist

One conversion each way, using a photo with transparency and a photo without:

- [ ] All 25 pairs (5 input formats × 5 output formats) produce a file that opens in an image viewer.
- [ ] Every output's dimensions match the source, except when rotating or resizing.
- [ ] A transparent PNG converted to JPEG or BMP shows the chosen background, not black.
- [ ] PNG, WebP and AVIF keep transparency when the source has it.
- [ ] Moving the quality slider changes the file size of a JPEG, WebP and AVIF output.
- [ ] The lossless switch on WebP and AVIF produces a file at least as large as the lossy one, and the quality slider is disabled while it is on.
- [ ] The Advanced panel changes something observable: AVIF `speed: 10` is faster than `speed: 0`; oxipng `level: 6` produces a PNG no larger than `level: 0`.
- [ ] Selecting two target formats produces two outputs per source file.
- [ ] Two sources whose names share a base (`photo.png` and `photo.jpg`) get `photo.webp` and `photo-1.webp`.
- [ ] A file over the size or pixel limit is refused with a readable reason, and the rest of the Batch still runs.
- [ ] One unreadable file fails on its own; the other Conversions in the Batch still complete.
- [ ] Cancel stops the Batch and clears the results.
- [ ] The ZIP download contains every successful output, named as the list shows.
- [ ] The whole flow — add, choose targets, set options, convert, download — is usable with the keyboard alone, including opening the file dialog from the drop zone with Space or Enter.
- [ ] Mantine's components look styled at all (if they render unstyled, the `@layer` order in `globals.css` has been changed and Tailwind is losing to Mantine, or winning over it).
- [ ] With DevTools open, a full Batch produces **no outbound requests** after the page has loaded.
- [ ] With the console open, no CSP violation is reported (a violation means `next.config.ts` and the Worker disagree about something).
- [ ] A large image (near the pixel limit) does not freeze the page while it converts.

**最近一次全量执行**：2026-09-17，全部条目通过（质量与无损、高级面板、命名冲突、超限、单个坏文件、取消、纯键盘、大图长任务、CSP）。执行方法：无头 Chrome 对着 `pnpm build && pnpm start`，用 CDP 的 `DOM.setFileInputFiles` 把文件送进文件选择器（无头浏览器做得到，React 也照常收到 change）。逐条证据记在 `docs/design.md` 第十一节。**像素上限那条是例外**，它由 `core/__tests__/limits.test.ts` 的单测覆盖（造一张超过 268 MP 的真图要差不多 1 GB 内存），下面这条同理。
