# Image Converter

Converts PNG, JPEG, WebP, AVIF and BMP into each other, in bulk, entirely in the browser. One input file can be sent to several target formats at once; the target format is the only thing to choose, because the Tool has no output settings — quality comes from each format's own default in `core/formats.ts` (see `docs/adr/0010-no-output-settings.md`).

Nothing is uploaded: the files are read with the File API, decoded and encoded in Web Workers, and the results are held as blobs until they are downloaded.

## Layout

```
ImageConverter.tsx   the Tool's UI — the form, and nothing that survives a render
file-row/            one row of the file list: thumbnail, name, format, remove
meta.ts              the Tool Registry entry
README.md            this file: how it works, and what to check by hand
zip.ts               turns the finished outputs into one download
core/                pure, browser-free logic — the part `pnpm test` covers
  formats · bmp · limits · naming · plan · sniff · hints · counts · failures · admission
  __tests__/         the tests for those modules
hooks/               the Tool's React state; only this Tool uses them
  use-file-queue     the files added, and the ones refused, and why
  use-file-thumbnail   a small picture of one file, one decode at a time
  use-conversion-batch  one Batch: its plan, its progress, and cancelling it
worker/              the browser-only half
  worker.ts          decode, flatten, encode — one Conversion
  converter.ts       the Worker pool and the Batch queue
```

A hook that knows nothing about this Tool goes to `src/hooks/` instead (today only
`useObjectUrl`, which is about blob URLs), and UI that no route owns goes to
`src/components/`. The threshold is ownership, not how many places use it — the
place that counts consumers is `packages/*`; see the toolbox `AGENTS.md`.

## How a Conversion runs

`ImageConverter.tsx` (client) plans a Batch with `planConversions`, then `ConversionPool` hands each Conversion to a Worker. Inside the Worker (`worker/worker.ts`):

1. `createImageBitmap` decodes the file — the browser's own decoder, for every input format.
2. An `OffscreenCanvas` the size of the source; when the target has no alpha channel it is created with `{ alpha: false }` and filled with pure white (`flattenBackground`), which is what stops transparent pixels turning black in JPEG. There is no resizing or rotating: see `docs/adr/0010-no-output-settings.md`.
3. `context2d.getImageData`, then the encode step: **PNG** by canvas, then an oxipng pass; **BMP** by `core/bmp.ts`; **JPEG/WebP/AVIF** by the jSquash codecs. AVIF and oxipng use their single-threaded builds on purpose — see `docs/adr/0004-image-codecs-single-threaded-in-a-worker.md`.

The pure parts — `sniff`, `naming`, `limits`, `bmp`, `formats`, `planConversions` — are unit-tested in `core/__tests__/` under `pnpm test`. Everything that needs a browser is covered by the checklist below instead.

## What CI covers, and what is still yours

CI runs `fmt:check`, `check:readme`, `lint`, `typecheck`, `test`, `build` and `pnpm e2e`. The browser gate drives the production build in a real browser and covers the part of the checklist below that a machine can re-run — the items marked **▣**. Read them as claims the repo already checks on every pull request; the rest are the ones a person still has to make, and they are why this section exists. `docs/adr/0012-playwright-for-the-browser-gate.md` records what the gate deliberately does not do and why the two instruments below were left alone.

Still by hand: the 25 input×output pairs (the gate sends one source to all five targets, not five sources), the drag path, the thumbnail queue under twenty large photos, the ZIP, the limits and the unreadable file, cancel, and every claim about geometry or a colour scheme. The gate does read pixel channels — is the transparent half still transparent, is the flattened half white — but that is about someone's exported file, not about the palette. Re-run the checklist when a `@jsquash/*` version changes, when an encoder is touched, when the CSP in `next.config.ts` changes, or when the `@layer` line in `globals.css` changes — that line is what keeps Tailwind's utilities able to override Mantine, and getting it wrong is invisible in a build.

The instruments are in the repo and stay there: `pnpm --filter @toolbox/web fingerprint capture|compare` snapshots this page and the homepage at five widths in both colour schemes and diffs two snapshots — run it before and after a change that is supposed to be structural only, because it is what turns “nothing looks different” into evidence — and `pnpm --filter @toolbox/web touch-targets` measures the hit area of every `.touch-target` control at four widths in both schemes.

## Manual QA checklist

One conversion each way, using a photo with transparency and a photo without:

- [ ] All 25 pairs (5 input formats × 5 output formats) produce a file that opens in an image viewer.
- [ ] **▣** Every output's dimensions match the source (one source to all five, and each output downloaded off disk, in the gate).
- [ ] **▣** A transparent PNG converted to JPEG or BMP shows white, not black, and not a tint.
- [ ] **▣** PNG, WebP and AVIF keep transparency when the source has it.
- [ ] **▣ Every format row toggles under a real mouse press, not only under the keyboard.** The keyboard is what let a dead hit area ship once: the toggle was on a `<label>`, the 44px overlay that was supposed to grow the target sat on the root `<div>` above it, and every pointer click was taken by an element that handles none. Point at the words, the box, and 20px below the words, and watch the state change.
- [ ] **▣** The file list says how many files were added, 清空 empties it (including the rejected list), and one file's cross removes only that file — leaving the other rows' pictures on screen rather than blanking and decoding them again (the pictures are the part the gate does not look at).
- [ ] **▣** The count line names both numbers once there are results (`已添加 3 张，已生成 9 个文件`), and one press of 清空 empties the file list, the rejected list **and** the download list (the gate asserts the first two; the download list is cleared by the same press, which nothing has yet driven).
- [ ] Every row shows a 40×40 thumbnail of the file's own pixels, its name, and the format its bytes say. A file that will not decode keeps its name and format and leaves an empty box, not an empty frame.
- [ ] Twenty large photos fill in one thumbnail at a time, in list order, without the page stopping to answer.
- [ ] When every file in a Batch was refused, the error Alert is still there and 清空 is what dismisses it.
- [ ] **▣** Selecting two target formats produces two outputs per source file (five, in the gate).
- [ ] Two sources whose names share a base (`photo.png` and `photo.jpg`) get `photo.webp` and `photo-1.webp`.
- [ ] A file over the size or pixel limit is refused with a readable reason, and the rest of the Batch still runs.
- [ ] One unreadable file fails on its own; the other Conversions in the Batch still complete.
- [ ] Cancel stops the Batch and clears the results.
- [ ] The ZIP download contains every successful output, named as the list shows.
- [ ] **▣** The whole flow is usable with the keyboard alone: Space toggles a focused format row, and the file dialog opens from the drop zone with Enter. The rest of the flow (choosing targets, converting, downloading) is still checked by hand, because the gate drives it with the pointer.
- [ ] Mantine's components look styled at all (if they render unstyled, the `@layer` order in `globals.css` has been changed and Tailwind is losing to Mantine, or winning over it).
- [ ] **▣** With DevTools open, a full Batch produces **no outbound requests** after the page has loaded.
- [ ] **▣** With the console open, no CSP violation is reported (a violation means `next.config.ts` and the Worker disagree about something).
- [ ] A large image (near the pixel limit) does not freeze the page while it converts.

**最近一次全量执行**：2026-09-17，全部条目通过（质量与无损、高级面板——这三条控件 2026-09-18 已删，见本节最后一段——以及命名冲突、超限、单个坏文件、取消、纯键盘、大图长任务、CSP）。执行方法：无头 Chrome 对着 `pnpm build && pnpm start`，用 CDP 的 `DOM.setFileInputFiles` 把文件送进文件选择器（无头浏览器做得到，React 也照常收到 change）。逐条证据记在 `apps/web/docs/design.md` 第十一节。**像素上限那条是例外**，它由 `core/__tests__/limits.test.ts` 的单测覆盖（造一张超过 268 MP 的真图要差不多 1 GB 内存），下面这条同理。

**同一批代码的第二次执行**（2026-09-17，去掉输出设置、格式行与文件列表改版之后）：22 项全部通过。新增的鼠标一项目的是补上一轮的缺口：格式行整行为靶（296×44，实测可点区域 241×58）、无损坏开关（217×48，`classNames={{ body }}`）、清空（159×52）都用真鼠标事件点过；一次 64×48、左半透明的 PNG → PNG + JPEG，两份都是 64×48（不再有缩放），PNG 保留 `0,0,0,0`，JPEG 的透明半边是纯白、不透光的那半仍是 `255,0,0`；零外发请求、零 console 报错，360 / 390 / 768 / 1024 四个宽度无横向溢出。证据同样在 `apps/web/docs/design.md` 第十一节。

**缩略图与共享清空这一次**（2026-09-18）：33 项断言全部通过，方法仍是上一段那个：无头 Chrome 加 CDP 对着生产构建，`DOM.setFileInputFiles` 送文件进文件选择器，`Input.dispatchMouseEvent` 打真鼠标。这一轮盯的就是上面清单里的「计数行与两处同清」（第 7 条）、「每行一张缩略图」（第 8 条）和「二十张大图一张一张来」（第 9 条）这三条，所以它们不再是没跑过的条目。

- **20 张 2000×1500 的 PNG**：六次运行里 510–670ms 出齐 20 张缩略图；每 120ms 采样一次，看到它们是 1 → 8 → 14 → 19 张这样补齐的，不是一次性全出来；`longtask` 五次一条都没有，有一次是一条 51ms（阈值是 50ms，所以它刚好算一条）。也就是说二十张大图的代价是几十毫秒的抖动，不是页面卡住；脚本把上限钉在 100ms，实测的这条 51ms 就写在里。缩略图是 80×60 的位图放进 40×40 的框（宽高比是解码缩的，裁的是框）。
- **删掉一行不会动到其他行**：三张图各自出好缩略图后，用真鼠标点掉第一行的叉，剩下两行的 `blob:` URL 与前一刻**逐字相同**、图片照样显示。这是代码评审提出来的一处缺陷：原来用下标当 key，删一行会让它下面的每一行重新挂载，缩略图被 revoke 后重新解码（看着就是闪一下空框），改成入队时发一个 id、按 id 做 key 之后才真的是「只删那一行」。
- **解码失败的那一行**：一个前 8 字节是 PNG 签名、后面是垃圾的文件照常入队并显示 `PNG`，框里没有图片也没有边框（`border: 0px`、`background: rgba(0,0,0,0)`、宽 40px），文件名和格式一样都不少。
- **名字撒谎时标签仍然是真的**：改名成 `.jpg` 的 PNG 显示 `PNG`，改名成 `.png` 的 JPEG 显示 `JPEG`。
- **清空**：转完之后计数行是「已添加 1 张，已生成 1 个文件」，一次真鼠标按下同时清掉文件行、下载行、ZIP 按钮和计数行本身；把最后一个来源删掉后它退成「已生成 1 个文件」且下载仍在；同一个文件再转一次仍只有 1 个下载（结果属于当前这一批）。
- **360px 宽**：无横向溢出，长文件名截断而格式标签仍在屏内（右缘 300 < 360），移除叉的靶子声明 44×44、实测可点 43×43（探针按像素中心向外走，正好 44 的量出来就是 43）。
- 全程零 page error、零 `console.error`。

**顺带量到的那件事已经修掉（#29，2026-09-20）**：Mantine 的 `Button` 把 `.touch-target` 的伪元素裁成按钮自己的框，所以「清空」绘制 46×26、声明 44×44，而实际可点只有 45×27。现在由 `globals.css` 里一条带 `:not([data-loading])` 守卫的 `overflow: visible` 覆盖解决（放在 `components` 层里，靠层序赢过 Mantine），理由写在 `apps/web/docs/design.md` 第五节。四个宽度 × 两套配色重量的结果：清空 45×45、移除叉 43×45、配色开关 43×43、返回首页 73×45，四处绘制尺寸一个都没变；`pnpm --filter @toolbox/web touch-targets` 可以重跑。

**格式行只剩勾选框这一次**（2026-09-18）：上面清单里关于质量滑杆、无损开关与高级面板的三条随控件一起删掉了——它们已经没有可跑的控件——其余条目对着 `pnpm build` + `next start` 的生产构建重跑，54 项断言全过：五份输出（PNG / JPEG / WebP / AVIF / BMP）尺寸都是 64×48，有透明通道的来源在 PNG/WebP/AVIF 里仍是 `0,0,0,0`、在 JPEG/BMP 里落到纯白，格式行用真鼠标点得上（可点区域 886×44），页面上不再有任何滑杆、Switch 或 `高级选项`，零外发请求、零 console 报错与 CSP 违规。脚本仍是一次性的（没进仓），结论记在 `apps/web/docs/design.md` 第十一节。
