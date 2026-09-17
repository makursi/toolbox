# Image Converter

Converts PNG, JPEG, WebP, AVIF and BMP into each other, in bulk, entirely in the browser. One input file can be sent to several target formats at once, each with its own quality, lossless setting and codec options.

Nothing is uploaded: the files are read with the File API, decoded and encoded in Web Workers, and the results are held as blobs until they are downloaded.

## Layout

```
ImageConverter.tsx   the Tool's UI — the form, and nothing that survives a render
meta.ts              the Tool Registry entry
README.md            this file: how it works, and what to check by hand
zip.ts               turns the finished outputs into one download
core/                pure, browser-free logic — the part `pnpm test` covers
  formats · advanced · options · bmp · limits · naming · plan · sniff · hints · failures · admission
  __tests__/         the tests for those modules
hooks/               the Tool's React state; only this Tool uses them
  use-file-queue     the files added, and the ones refused, and why
  use-conversion-batch  one Batch: its plan, its progress, and cancelling it
worker/              the browser-only half
  worker.ts          decode, flatten, encode — one Conversion
  converter.ts       the Worker pool and the Batch queue
```

A hook that outlives this Tool goes to `src/hooks/` instead (today only
`useObjectUrl`, which is about blob URLs and knows nothing about images), and UI
more than one route uses goes to `src/components/`; see the toolbox `AGENTS.md`.

## How a Conversion runs

`ImageConverter.tsx` (client) plans a Batch with `planConversions`, then `ConversionPool` hands each Conversion to a Worker. Inside the Worker (`worker/worker.ts`):

1. `createImageBitmap` decodes the file — the browser's own decoder, for every input format.
2. An `OffscreenCanvas` the size of the source; when the target has no alpha channel it is created with `{ alpha: false }` and filled with pure white (`flattenBackground`), which is what stops transparent pixels turning black in JPEG. There is no resizing or rotating: see `docs/adr/0010-no-output-settings.md`.
3. `context2d.getImageData`, then the encode step: **PNG** by canvas, then an oxipng pass; **BMP** by `core/bmp.ts`; **JPEG/WebP/AVIF** by the jSquash codecs. AVIF and oxipng use their single-threaded builds on purpose — see `docs/adr/0004-image-codecs-single-threaded-in-a-worker.md`.

The pure parts — `sniff`, `naming`, `limits`, `bmp`, `options`, `planConversions` — are unit-tested in `core/__tests__/` under `pnpm test`. Everything that needs a browser is covered by the checklist below instead.

## What CI does not cover

CI runs `fmt:check`, `lint`, `typecheck`, `test` and `build`. It cannot run a browser, so it does not know whether a codec produces a valid file, whether the drop zone is reachable from the keyboard, or whether the CSS layers still order correctly. Re-run the checklist by hand when a `@jsquash/*` version changes, when an encoder is touched, when the CSP in `next.config.ts` changes, or when the `@layer` line in `globals.css` changes — that line is what keeps Tailwind's utilities able to override Mantine, and getting it wrong is invisible in a build.

## Manual QA checklist

One conversion each way, using a photo with transparency and a photo without:

- [ ] All 25 pairs (5 input formats × 5 output formats) produce a file that opens in an image viewer.
- [ ] Every output's dimensions match the source.
- [ ] A transparent PNG converted to JPEG or BMP shows white, not black, and not a tint.
- [ ] PNG, WebP and AVIF keep transparency when the source has it.
- [ ] **Every format row and the 无损 switch toggles under a real mouse press, not only under the keyboard.** The keyboard is what let a dead hit area ship once: the toggle was on a `<label>`, the 44px overlay that was supposed to grow the target sat on the root `<div>` above it, and every pointer click was taken by an element that handles none. Point at the words, the box, and 20px below the words, and watch the state change.
- [ ] The file list says how many files were added, 清空 empties it (including the rejected list), and one file's cross removes only that file.
- [ ] When every file in a Batch was refused, the error Alert is still there and 清空 is what dismisses it.
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

**同一批代码的第二次执行**（2026-09-17，去掉输出设置、格式行与文件列表改版之后）：22 项全部通过。新增的鼠标一项目的是补上一轮的缺口：格式行整行为靶（296×44，实测可点区域 241×58）、无损坏开关（217×48，`classNames={{ body }}`）、清空（159×52）都用真鼠标事件点过；一次 64×48、左半透明的 PNG → PNG + JPEG，两份都是 64×48（不再有缩放），PNG 保留 `0,0,0,0`，JPEG 的透明半边是纯白、不透光的那半仍是 `255,0,0`；零外发请求、零 console 报错，360 / 390 / 768 / 1024 四个宽度无横向溢出。证据同样在 `docs/design.md` 第十一节。
