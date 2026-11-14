# image-to-pdf · 设计规则（工具级）

> **管什么**：这个 Tool 自己的设计规则与词汇——页面结构、几何、JPEG 路径、PDF 写出面、命名与失效规则。**只约束 image-to-pdf；站点级规则**（外壳、设计语言、CSP、门禁量具、Tool 契约）在 `apps/web/docs/design.md` 与 `apps/web/docs/design/`，两者不互相重复。站点文档只装站点级规则，一个工具的私有规则住在这里，见 `docs/adr/0014-tool-scoped-rules-live-with-the-tool.md`。**和它一起读**：`README.md`（怎么工作、手工清单）、`docs/adr/0020-the-pdf-writer-is-ours.md`（写出层为什么是自己写的）。

## 词汇

站点术语表（`CONTEXT.md`）只定义站点词；下面几个是本工具的领域词，本站其它文档不继承它们的含义：

- **页（Page）**：一张图片，连同它将成为的那一页。列表里一行就是一页，行数就是 PDF 的页数。
- **页面列表（page list）**：按页序排好的若干页；页面顺序等于列表顺序。
- **纸张（paper）**：每页的页面尺寸。**A4**（默认）、**Letter** 与 **原始尺寸**；原始尺寸是图片像素乘 0.75（96 dpi），不是一种纸。
- **旁路（passthrough）**：把 JPEG 的原始字节直接作为 `DCTDecode` 图像流写进 PDF，不解码、不重编码。
- **生成（build）**：一次从页面列表到一个 PDF 文件的完整运行。生成状态只有 `idle / building / done / failed` 四种。

## 页面结构

- 本票（#192）落四块区域，`data-slot` 名字是它们的指纹锚点（#200 会在量具里按页声明）：
  - 输入区 `pdf-add`：一个真 `<button>`（`选择图片`）打开一个隐藏的 `input[type=file]`（**没有 `accept`**），虚线框承接拖放；添加后不改变按钮的无障碍名。
  - 页面列表 `pdf-pages`：标题、`清空`、一行一页。
  - 一行 `pdf-page-row`：页号（`第 N 页`）、页面缩略图（`pdf-page-miniature`）、文件名、`移除`。
  - 结果行 `pdf-result`：钉在视口底部，唯一的动作 `转换`、禁用理由、运行状态与下载链接。
- **页面尺寸行**（A4 / Letter / 原始尺寸）是 #194 的，落在列表与结果行之间；它的初始值来自 `core/geometry.ts` 的 `DEFAULT_PAPER`。
- 结果行在任何时候都渲染：列表为空时它是唯一说明「还缺哪一步」的地方，有结果时它是下载入口。
- 返回首页、标题、描述与 `metadata` 是站点级 `ToolPage` 外壳的（`src/components/tool-page/`），不在本文件职权内。

## 几何

- **只有一个几何函数**：`core/geometry.ts` 的 `pageGeometry(image, paper)`，输入图片像素尺寸与纸张，输出以点为单位的页面框和图片在页面上的矩形。预览行与 PDF writer 都调它，没有第二份实现。
- 数字：A4 = `595.28 x 841.89` pt，Letter = `612 x 792` pt，原始尺寸 = 像素 x `0.75`。三者都是导出常量，单测直接断言它们。
- **方向跟着图片走**：横图用横向的纸张，竖图用纵向的；正方形算纵向。没有方向控件，也不问访客。
- **Fit 永远是 contain + centre**：取两个比例中较小的一个，两个轴都居中。没有裁切、没有边距参数、没有 fill-page。
- 原始尺寸页面就是 `像素 x 0.75` 本身，因此 contain 恰好填满整页。

## JPEG 路径

- **格式由字节而非文件名决定**（这一点从输入框没有 `accept` 开始）；#193 把读出「不是 JPEG」的结果变成一句拒绝。
- `core/jpeg.ts` 只走段头：从 `SOFn` 读出宽、高、通道数与帧类型；`SOF2` 是 progressive，`SOF0`/`SOF1` 是 baseline，其余帧类型一律不认。
- **旁路条件**：帧是 baseline，且通道数是 1（灰度）或 3（YCbCr，`DCTDecode` 自己转成 `DeviceRGB`）。progressive 与 4 通道（CMYK/YCCK）走将来的解码路径，**本票先拒绝**，绝不把未经确认的流写进 PDF。
- **EXIF 方向还没有解析**（#198 拥有 APP1）：`JpegInfo.orientation` 恒为 1，字段与注释已经把位置留好；#198 只改这个模块、矩阵和几何的交换，不改调用方。
- 页面列表在添加时只做「这个头读得出来吗」这一道关：读不出来就不成页（#193 换成带句子的拒绝）。

## PDF 写出层

- **自己写，不用运行时 PDF 库**：PDF 1.7、经典 xref 表（没有对象流）、头部之后一行二进制注释、每个流精确的 `/Length`、trailer、`startxref`、`%%EOF`。理由与两个被否掉的库的代价见 `docs/adr/0020-the-pdf-writer-is-ours.md`。
- 每页恰好一个 page 对象、一个 content stream、一个 image XObject。`/MediaBox` 来自几何函数；content stream 用一个矩阵把图片放到几何给的矩形上。
- 图像流的颜色空间由通道数决定：1 → `DeviceGray`，3 → `DeviceRGB`，4 → `DeviceCMYK` 并加反相的 `/Decode [1 0 1 0 1 0 1 0]`。
- **写出层是一个可替换的层**：`buildPdf(pages)` 之上（页面模型、几何、组件、Worker 协议、测试）不知道 PDF 是怎么拼的。#195 加原始 RGB 的 `FlateDecode` 图像类型、#198 加 content-stream 矩阵，都只动这一层内部或它的 `PdfImage` 联合类型，不改调用方。

## 命名与失效

- 文件名由规则决定：`图片-YYYY-MM-DD.pdf`，日期取访客本地的日历日（`core/naming.ts`），界面没有文件名字段。
- **任何变化都让已生成的文件失效**：添加、移除、清空（以及 #194/#196 的换纸与重排）都会清掉下载与运行状态并重新武装 `转换`。失效不是错误态，不弹横幅、不写错误句。
- 结果的对象 URL 由 `usePdfBuild` 全权拥有：成功时创建，失效与卸载时撤销。

## 报错

- 浏览器或解码器自己的报错只进 console；访客读到的句子在纯函数层（`core/hints.ts`、`core/failures.ts`），有单测能盯住措辞。
- 失败码是闭集：`unreadable / unsupported / interrupted / unknown`，每码一句；认不出的错误回落到 `unknown`，原始错误只进 console。Worker、`builder.ts` 与 hook 三层都不会把原始错误文本带进界面。

## 推迟给后续票

- #193：PNG/WebP、20 张/20 MB/100 MB/40 MP 的限制、三种格式共用的一句拒绝措辞、输入区「继续添加」的收拢。
- #194：A4 / Letter / 原始尺寸的单选行与它的说明句；`DEFAULT_PAPER` 换成状态。
- #195：progressive 与 4 通道 JPEG 的浏览器解码路径、PNG/WebP 压白后的 `FlateDecode`。
- #196：拖拽 + 键盘重排；每行一个可访问名固定的拖拽把手。
- #197：进度（每页一条）与取消（终止并替换 Worker）。
- #198：EXIF 方向八值表与 content-stream 矩阵。
- #199：失效覆盖的测试，以及上面各票带来的新失效点。
- #200：把这一页加进两个量具的 `PAGES`（本票只保证 `data-slot` 已就位）；#201：设计笔记与截图基线。

## 已知风险

- 移动端 canvas 面积上限（约 1670 万像素）低于 4000 万像素的限制，会先画出一张空白页。这条是记录，不用上限去挡：上限会拒绝桌面能处理的图片。#195 的解码路径落地时要再读一次这一条。
- 单测证明文件结构，门禁用另一种实现读回文件；**没有机器能证明真实阅读器画得对**。「在桌面阅读器、手机、第二个浏览器里各打开一次」留在 README 的手工清单里。

## 退出标准

如果真实使用中出现一次「这个文件打不开」，写出层就换成 ADR-0020 否掉的那条库：页面模型、几何、组件、Worker 协议和测试都留在原地，这正是写出层要藏在一个缝里的原因。
