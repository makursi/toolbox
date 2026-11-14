# image-to-pdf · 设计规则（工具级）

> **管什么**：这个 Tool 自己的设计规则与词汇——页面结构、输入与准入、页面顺序、几何、JPEG 路径、PNG 与 WebP 路径、PDF 写出面、命名与失效规则。**只约束 image-to-pdf；站点级规则**（外壳、设计语言、CSP、门禁量具、Tool 契约）在 `apps/web/docs/design.md` 与 `apps/web/docs/design/`，两者不互相重复。站点文档只装站点级规则，一个工具的私有规则住在这里，见 `docs/adr/0014-tool-scoped-rules-live-with-the-tool.md`。**和它一起读**：`README.md`（怎么工作、手工清单）、`docs/adr/0020-the-pdf-writer-is-ours.md`（写出层为什么是自己写的）。

## 词汇

站点术语表（`CONTEXT.md`）只定义站点词；下面几个是本工具的领域词，本站其它文档不继承它们的含义：

- **页（Page）**：一张图片，连同它将成为的那一页。列表里一行就是一页，行数就是 PDF 的页数。
- **页面列表（page list）**：按页序排好的若干页；页面顺序等于列表顺序。
- **纸张（paper）**：每页的页面尺寸。**A4**（默认）、**Letter** 与 **原始尺寸**；原始尺寸是图片像素乘 0.75（96 dpi），不是一种纸。界面上解释这一点的那句原文在 `core/hints.ts` 的 `originalSizeHint`，有单测盯住。
- **添加（add）**：一次选择或一次拖放带来的一批文件。批次里的文件按访客给出的顺序走，第二批接在第一批后面。
- **拒绝（refusal）**：一个文件没有进入页面列表，连同它的一句理由。被拒的文件不占页面列表的一行，也不占张数或总字节。
- **旁路（passthrough）**：把 JPEG 的原始字节直接作为 `DCTDecode` 图像流写进 PDF，不解码、不重编码。
- **生成（build）**：一次从页面列表到一个 PDF 文件的完整运行。生成状态只有 `idle / building / done / failed` 四种。
- **进度（progress）**：一次生成里已完成的页数与计划页数，读作「已完成 x / y 页」。Worker 每写完一页报一条，界面在结果行的 live region 里读出来；生成结束保留最后一次计数，失效与取消时清空。
- **取消（cancel）**：访客在一次生成中按 `取消`。它**终止** Worker 并让下一次生成换一个新的；取消不是失败，页面回到「还没转换」。

## 页面结构

- #194 之后本页是五块区域，`data-slot` 名字是它们的指纹锚点（#200 会在量具里按页声明）：
  - 输入区 `pdf-add`：列表为空时是整块虚线框；列表有页后收拢成一行「继续添加」。两种状态里都是同一个真 `<button>`（`选择图片`）打开一个隐藏的 `input[type=file]`（**没有 `accept`**）；虚线框与那一行都承接拖放。**主按钮的无障碍名不随状态改变**，量具按名字声明一次。
  - 拒绝列表：输入区下方的站点 `Alert`（`data-slot="alert"`），标题「有文件没能加入」，一行一个文件加一句理由；只在有拒绝时渲染。它随批次追加，列表非空时由 `清空` 一并清掉。
  - 页面列表 `pdf-pages`：标题、`清空`、一行一页。`清空` 在列表非空时总在。
  - 一行 `pdf-page-row`：拖拽把手（`拖动排序`）、页号（`第 N 页`）、页面缩略图（`pdf-page-miniature`）、文件名、`移除`。
  - 页面尺寸行 `pdf-paper`：标题 `页面尺寸`、A4 / Letter / 原始尺寸 三选一、`originalSizeHint` 说明句。落在列表与结果行之间，列表为空时也在：纸张是这一页的选择，不是列表的状态。
  - 结果行 `pdf-result`：钉在视口底部，唯一的动作 `转换`、禁用理由、生成中的 `取消`、进度（文字加进度条，`data-slot="pdf-progress"`，在 live region 里）、失败句与下载链接。
- 结果行在任何时候都渲染：列表为空时它是唯一说明「还缺哪一步」的地方，有结果时它是下载入口。运行中它在 390px 下同时装得下 `转换`、`取消` 与进度条（窄屏两个动作各占满一行，见 `apps/web/docs/design/layout.md`）。
- 返回首页、标题、描述与 `metadata` 是站点级 `ToolPage` 外壳的（`src/components/tool-page/`），不在本文件职权内。

## 输入、嗅探与准入

- **格式由字节而不是文件名决定**，输入框从没有 `accept` 开始：声明的类型是重命名文件唯一能控制的东西，一个过滤器会把嗅探要防的那件事挡在门外。`core/sniff.ts` 只看前 `sniffByteLength`（96）字节。
- 认三种：JPEG（`FF D8 FF`）、PNG（`89 50 4E 47 0D 0A 1A 0A`）、WebP（`RIFF` + `WEBP`）。AVIF、BMP、HEIC、GIF 被**认成图片但本工具不收**；其它字节不是图片。AVIF 与 HEIC 同属 ISO-BMFF，靠 `ftyp` 的 brand 区分。
- **拒绝措辞写在纯层**（`core/refusal.ts`、`core/limits.ts`），单测盯住原文：
  - 「认得出、但不收的格式」**所有格式共用一句**，不逐格式列名：拒绝格式的清单会过期，访客要的是「换成什么」。
  - 「根本不是图片」一句。
  - 已认可的图片若自己的头部读不出尺寸，用「已经损坏」一句；这不是第三种格式措辞。
- **尺寸从各自头部读**（`core/image-size.ts`）：JPEG 走 `SOF`，PNG 读 `IHDR`，WebP 读首个 chunk（`VP8X` 画布、`VP8 ` 关键帧、`VP8L` 位流）。读不出尺寸的文件不进列表；行上的迷你页用这个尺寸，PDF 的几何对 JPEG 用同一尺寸、对 PNG/WebP 用解码后的尺寸（见下一节）。
- 四道限制，每道一句、句子点名这道限制（`core/limits.ts`）：**一个列表 20 张**、**单张 20 MB**、**合计 100 MB**、**单张 4000 万像素**。张数与合计都是按列表算的，所以第二批会撞到同一道上限。像素那道约束的是一次解码而不是一个文件：29 字节的 PNG 头也能要求 5000 万像素，所以它的数字来自头部尺寸，在准入阶段就拒绝，不等到解码。
- **准入是一个纯函数**（`core/admission.ts`）：输入每个文件「字节说的格式 + 大小 + 头部给出的像素 + 列表已有的张数/字节」，按输入顺序返回每个文件的判决。hook 只负责读字节、按序追加；被拒的文件不消耗张数，也不占合计。
- 一次添加是串行的：第二批看到第一批追加后的张数与合计，两批不会同时挤进同一道上限。
- **PNG 与 WebP 不只是准入**：它们经浏览器解码后成为页，路径见下一节。准入只看头部尺寸，解码发生在 Worker 里，所以一张头小、解码大的图仍会被 Worker 用同一句像素句子拒绝。

## 页面尺寸行

- 三个选项来自 `core/geometry.ts` 的 `PAPERS`（顺序就是这条行的顺序），名字来自 `core/hints.ts` 的 `paperLabels`，初始值 `DEFAULT_PAPER`（A4）。新上传不会重置选择。
- 建在 vendored `ToggleGroup` 上：它的 single 模式渲染 `role="radiogroup"`，每项是 `role="radio"` 的真 `<button>`，`aria-checked` 与 `data-state` 跟着选择走，整组只有一个 Tab 停点。**方向键既移焦点也改选择**：组件层只做前者，这一行在 `onKeyDown` 里补上后者并首尾回绕——单选组对键盘与读屏的承诺就是这个。
- 每一项**自己**带 `.touch-target`（点击归属于那个 `<button>`，挂在组上会变成「覆盖点击」），高 44px。
- **选中态不是颜色**：边框从发丝线换成 ink（`data-[state=on]:border-primary`）、字重加到 `font-semibold`、再加一个表面色（vendored 变体自带的 `data-[state=on]:bg-accent`，本站的 accent 是 hover 表面而不是色相）。两套配色都成立；站点的颜色语义仍然只有错误。
- **`原始尺寸` 的说明句**常驻在控件旁，不藏在 tooltip 里，原文在 `core/hints.ts` 的 `originalSizeHint`：原始尺寸是图片自己的像素尺寸（96 dpi，1 像素 = 0.75 磅），不是一种纸。措辞由单测 `core/__tests__/hints.test.ts` 盯住。
- 换纸就是换文档：与列表的增删一样调用 `reset()`，清掉下载与运行状态、重新武装 `转换`，不弹横幅、不写错误句。生成中控件禁用，避免一份按旧纸写出的文件配着新纸的预览出现。

## 页面顺序

- **页面顺序等于列表顺序**，行数就是 PDF 的页数。文档跟着列表走：重排之后重新转换，下载文件里的页序就是屏幕上的顺序。
- **两条路径，同一个能力**：拖某一行的把手；或者把焦点放到把手上，空格拿起、上下方向键移动、空格放下，Esc 取消。两个传感器都在：`PointerSensor` 与 `KeyboardSensor`（配 `sortableKeyboardCoordinates`，方向键一步跨过一行）。行本身不是激活器，**只有把手是**，所以点 `移除` 或选择文字都不会误起拖拽。
- **把手是一个真 `<button>`，`.touch-target` 挂在它自己身上**。挂在外层行上不是放大靶子，而是吃掉点击：伪元素的点击算在生成它的元素头上，外层没有处理器，于是鼠标和手指失效、键盘照常；只过一遍键盘的 QA 发现不了。这个 bug 本仓库已经付过一次钱（`apps/web/docs/design/components.md`），门禁用坐标命中测试盯着它。
- **每一行的把手用同一个无障碍名 `拖动排序`**，`移除` 同理：命中区量具按名字声明控件，写不下二十个不同的名字，一个随行变化的名字根本没法声明。把手还带 `touch-none`（`touch-action: none`）：从把手上开始的手势属于拖拽，不属于滚动，这正是把手存在的理由。
- **移动会被读出来**：dnd-kit 的 live region（`role="status"`、`aria-live="assertive"`）读的是本工具自己的句子，原文在 `core/hints.ts`、有单测。拿起、每次移动后的位置、放下、Esc 取消各一句；**没有移动的自重叠不播报**，否则「拿起」那句会被「已移到第 1 位」立刻冲掉。
- 重排和增删、换纸一样让已生成的文件失效：清掉下载、重新武装 `转换`，不弹横幅、不写错误句。完整矩阵在 #199。
- 行的绘制没有被替换：把手是**加**上去的，页号、迷你页、文件名、`移除` 都还在。拖拽中的行临时加一层表面色（`bg-card`），否则它滑过别的行时两层文字会互相穿透；位移过渡是 `transition-transform` + `motion-reduce:transition-none`，reduced-motion 下静止。

## 几何

- **只有一个几何函数**：`core/geometry.ts` 的 `pageGeometry(image, paper)`，输入图片像素尺寸与纸张，输出以点为单位的页面框和图片在页面上的矩形。预览行与 PDF writer 都调它，没有第二份实现。
- 数字：A4 = `595.28 x 841.89` pt，Letter = `612 x 792` pt，原始尺寸 = 像素 x `0.75`。三者都是导出常量，单测直接断言它们。
- **方向跟着图片走**：横图用横向的纸张，竖图用纵向的；正方形算纵向。没有方向控件，也不问访客。
- **Fit 永远是 contain + centre**：取两个比例中较小的一个，两个轴都居中。没有裁切、没有边距参数、没有 fill-page。
- 原始尺寸页面就是 `像素 x 0.75` 本身，因此 contain 恰好填满整页。
- **列表每一行都从 `pageGeometry` 画**：缩略图高度固定 56px，宽度由页面比例决定，所以换纸时行会变宽变窄；图片矩形按页面的百分比定位。原始尺寸下行与图片同形、没有白边，这一点由 `core/__tests__/geometry.test.ts` 的「miniature」两条断言盯住。

## JPEG 路径

- `core/jpeg.ts` 只走段头：从 `SOFn` 读出宽、高、通道数与帧类型；`SOF2` 是 progressive，`SOF0`/`SOF1` 是 baseline，其余帧类型一律不认。
- **旁路条件**：帧是 baseline，且通道数是 1（灰度）或 3（YCbCr，`DCTDecode` 自己转成 `DeviceRGB`）。progressive 与 4 通道（CMYK/YCCK）走将来的解码路径，**本票先拒绝**，绝不把未经确认的流写进 PDF。
- **EXIF 方向还没有解析**（#198 拥有 APP1）：`JpegInfo.orientation` 恒为 1，字段与注释已经把位置留好；#198 只改这个模块、矩阵和几何的交换，不改调用方。
- Worker 收到每一页时先重新嗅探格式与头部，不信任页面送来的任何说法。**旁路谓词一字未动**：baseline 的 1/3 通道 JPEG 仍以原字节进 PDF，从不交给编码器，也不重编码。progressive 与 4 通道 JPEG 仍以 `unsupported` 拒绝，它们的解码路径是 #198 的。

## PNG 与 WebP 路径

- **浏览器解码，写出层拿像素**：PNG 与 WebP 没有能装下自己压缩字节的 PDF 过滤器，所以 Worker 用 `createImageBitmap(Blob)` 解码，画进 `OffscreenCanvas`，`getImageData` 拿回 RGBA。解码、canvas、`Blob` 都只在 `worker/` 里；`core/` 仍然只认字节和数字。
- **透明像素压到白纸**：每通道 `c * a + 255 * (1 - a)`（`a` 是 alpha 的比例），在 `core/packing.ts` 的 `packRgb` 里做，因此有单测盯住「全透明 → 255,255,255」、半透明像素的取整和不透明像素保持原色。丢掉 alpha 会让透明区变成黑矩形，这正是这个模块存在的理由。
- **压白不是界面颜色**：那是访客自己文件里的像素被压平，不是页面表面，所以站点「禁纯黑纯白」的规则不适用于它；参考 Tool 记录同一例外（`apps/web/src/tools/image-converter/rules.md` 第 21 条，站点规则在 `apps/web/docs/design/colour.md`）。
- **`/FlateDecode` 是 zlib，不是 raw deflate**：压平后的 RGB 样本由 `core/packing.ts` 的 `flateRgb` 用 `fflate` 的 `zlibSync` 压。写出层写 `/ColorSpace /DeviceRGB`、`/BitsPerComponent 8`、`/Filter /FlateDecode`，**没有 `/DecodeParms`**：PNG predictor 的直通合法且省字节，但阅读器的支持没能验证，ADR-0020 记了这笔取舍。
- **几何仍来自同一个函数**：`pageGeometry(解码后的尺寸, paper)`，所以与 JPEG 同尺寸、同方向得到同一组页面框与图片矩形。页面框跟解码后的像素走，不跟文件头：一页不该与自己的样本对着 letterbox。
- **像素上限在这里再查一次**：解码后的宽高乘积超过 `MAX_IMAGE_PIXELS`（4000 万）时，Worker 抛 `too-many-pixels`，句子复用 `core/limits.ts` 的那一句。准入已经用头部拒绝过一次，这一道是给「头部说谎」留的。

## PDF 写出层

- **自己写，不用运行时 PDF 库**：PDF 1.7、经典 xref 表（没有对象流）、头部之后一行二进制注释、每个流精确的 `/Length`、trailer、`startxref`、`%%EOF`。理由与两个被否掉的库的代价见 `docs/adr/0020-the-pdf-writer-is-ours.md`。
- 每页恰好一个 page 对象、一个 content stream、一个 image XObject。`/MediaBox` 来自几何函数；content stream 用一个矩阵把图片放到几何给的矩形上。
- 流的种类由 `PdfImage.kind` 决定，调用方只说「这是 JPEG」或「这是原始 RGB」：JPEG 写 `/Filter /DCTDecode`，颜色空间由通道数决定（1 → `DeviceGray`，3 → `DeviceRGB`，4 → `DeviceCMYK` 并加反相的 `/Decode [1 0 1 0 1 0 1 0]`）；原始 RGB 写 `DeviceRGB` + 8 位 + `/Filter /FlateDecode`，没有 `/DecodeParms`（#195）。
- **写出层是一个可替换的层**：`buildPdf(pages)` 之上（页面模型、几何、组件、Worker 协议、测试）不知道 PDF 是怎么拼的。两种图像类型都在这一层内部；#198 的 content-stream 矩阵同样只动这里，不改调用方。

## 生成、进度与取消

- **整份文档在一个专用 Worker 里顺序生成**，页面只把每页的源字节和纸张交给它，不持有半份文档。顺序不是省事而是唯一可行的顺序：一份 PDF 是一条输出字节流，页必须按页序交给唯一的写出层；并行池只会多出几个线程，仍然要排队把手里的页交给同一个写出层，还要同时占着几张解码后的图像的内存。规格已经否掉池子，这里只保留一个 Worker。生成期间页面不阻塞：解码与压缩在 Worker 的线程里，页面只负责收消息和重画。注释里写这段理由的地方是 `worker/worker.ts` 与 `worker/builder.ts`。
- **协议只有两种消息**（`worker/worker.ts` 定义，`worker/builder.ts` 消费）：请求是 `{id, paper, pages}`，页面字节转移所有权；Worker 每写完一页发 `{id, type:"progress", done, total}`，最后发 `{id, type:"result", ok:true, bytes}` 或 `{id, type:"result", ok:false, code}`。`total` 每条都带，页面不必记住它。`builder` 一次生成一个 Worker，任何路径（成功、失败、取消）都终止它。
- **进度文字在纯层**：`core/hints.ts` 的 `progressText(done, total)` 产生「已完成 x / y 页」，`core/__tests__/hints.test.ts` 盯住原文。文字和 vendored `Progress` 条一起放在结果行的 `aria-live="polite"` 区域里，所以读屏会随每一条消息听到新计数，而不是只听到一次。进度条的两个颜色、8px 高与 8px 圆角是站点规则（`apps/web/docs/design/components.md` 的「进度条」：轨道 `bg-secondary`、已完成段 `bg-primary`），调用点按它覆盖注册表默认的 `bg-primary/20` 与 `rounded-full`。
- 进度从按下 `转换` 的那一下就存在（`已完成 0 / y 页`），因为计划页数在生成前就是已知的；生成结束后保留最后一次计数，和下载链接并排，失效或取消时清空。
- **`取消` 只在生成中出现**，名字固定为「取消」（量具按名字声明控件，一个只在某个状态里存在的控件尤其不能有两个名字）。它**终止** Worker 而不是请求它停：正在跑的解码就地结束，转交的字节随线程一起消失，之后不会再有结果消息；下一次生成开一个新 Worker，这就是「替换」。`取消` 自己带 `.touch-target`（它是一个真 `<button>`），窄屏上占满一行。
- **取消不是失败**：不借用失败码、不写错误句、不弹横幅、不写 console。页面回到和「还没转换」一样的状态：没有下载、没有进度、进度条消失、`转换` 重新可用，页面列表原样留着。
- **取消与失效是同一个状态，所以是同一个函数**：`usePdfBuild` 的 `stop` 既服务「列表或纸张变了」也服务「访客按了取消」。`generation` 计数让被取消那次运行的迟到结果不能覆盖替换它的那次运行；取消从不创建对象 URL，URL 的创建、撤销与卸载清理仍然只住在这个 hook 里。
- **失败仍然是闭集**：Worker 把 `core/failures.ts` 里的码发回来（无法识别的抛错由 `failureCode` 收敛成 `unknown`），hook 用 `describeFailure` 换成一句给访客的话；原始错误只进 console。取消走 `BuildCancelled`，它不属于这个闭集，也不该有句子。

## 命名与失效

- 文件名由规则决定：`图片-YYYY-MM-DD.pdf`，日期取访客本地的日历日（`core/naming.ts`），界面没有文件名字段。
- **任何变化都让已生成的文件失效**：添加（至少一张被接受）、移除、清空、换纸（#194）以及 #196 的重排都会清掉下载与运行状态并重新武装 `转换`。一批全部被拒不是列表的变化，不失效：屏幕上的文件仍然与屏幕上的列表一致。失效不是错误态，不弹横幅、不写错误句。
- 结果的对象 URL 由 `usePdfBuild` 全权拥有：成功时创建，失效与卸载时撤销。

## 报错

- 浏览器或解码器自己的报错只进 console；访客读到的句子在纯函数层（`core/hints.ts`、`core/failures.ts`、`core/refusal.ts`、`core/limits.ts`），有单测能盯住措辞。
- 失败码是闭集：`unreadable / unsupported / too-many-pixels / interrupted / unknown`，每码一句；认不出的错误回落到 `unknown`，原始错误只进 console。`too-many-pixels` 复用像素上限那一句（一个条件一句）；`unsupported` 的句子不点名格式。Worker、`builder.ts` 与 hook 三层都不会把原始错误文本带进界面。`core/__tests__/failures.test.ts` 盯住每个码的原文、五句互不相同，以及认不出的值回落到通用句。
- **取消不是失败**，不进入这个闭集也不带句子：它由 `worker/builder.ts` 的 `BuildCancelled` 表示，hook 认得它并回到 `idle`。

## 推迟给后续票

- #198：EXIF 方向八值表与 content-stream 矩阵，以及 progressive 与 4 通道 JPEG 的浏览器解码路径。
- #199：失效覆盖的测试与上面各票带来的新失效点；换纸这一条已随 #194 的控件落地。
- #200：把这一页加进两个量具的 `PAGES`（`data-slot` 与固定的按钮名已就位，包括只在生成中出现的 `取消`）；#201：设计笔记与截图基线。

## 已知风险

- 移动端 canvas 面积上限（约 1670 万像素）低于 4000 万像素的限制：一张像素数在限制以内但超过手机 canvas 上限的 PNG/WebP，解码时会先得到空白页或浏览器自己的失败。这条仍是记录，不用上限去挡——上限会拒绝桌面能处理的图片，而移动端真正的边界由浏览器决定。
- 单测证明文件结构，门禁用另一种实现读回文件；**没有机器能证明真实阅读器画得对**。「在桌面阅读器、手机、第二个浏览器里各打开一次」留在 README 的手工清单里。

## 退出标准

如果真实使用中出现一次「这个文件打不开」，写出层就换成 ADR-0020 否掉的那条库：页面模型、几何、组件、Worker 协议和测试都留在原地，这正是写出层要藏在一个缝里的原因。
