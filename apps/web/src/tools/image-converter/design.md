# image-converter · 设计规则（工具级）

> **管什么**：这个 Tool 自己的设计规则与词汇——页面结构、组件、输出面、报错措辞、领域词。**只约束 image-converter；站点级规则**（外壳、设计语言、CSP、门禁量具、Tool 契约）在 `apps/web/docs/design.md` 与 `apps/web/docs/design/`，两者不互相重复。站点文档只装站点级规则，一个工具的私有规则住在这里，见 `docs/adr/0014-tool-scoped-rules-live-with-the-tool.md`。**和它一起读**：`apps/web/docs/design.md`（站点级规则）、`docs/adr/0004-image-codecs-single-threaded-in-a-worker.md`、`docs/adr/0010-no-output-settings.md`。

## 词汇

站点术语表（`CONTEXT.md`）只定义站点词；下面两个是本工具的领域词，本站其它文档不继承它们的含义：

- **Conversion**：一次输入图像连同它要编码成的目标格式。一个 Batch 是若干 Conversions：一个源转三个格式就是三个，每一个要么产出一个输出文件、要么失败。
- **Lossless（无损）**：原样携带源图像像素、不再经受有损压缩的输出。PNG 与 BMP 永远无损，WebP 与 AVIF 在这里永远有损，JPEG 没有无损模式。界面从不问它：这是目标格式的属性，不是设置。

## 页面结构

- **三个步骤保持可见**：`1. 添加图片 / 2. 转换为 / 3. 下载`；页面限高内不折叠。2026-09-18 起页面上没有任何东西折叠——格式行只剩一个勾选框（历史：质量滑杆、无损开关、高级面板随输出设置一起删掉，见 `docs/adr/0010-no-output-settings.md` 的更新段）。
- 返回首页、标题、描述与 `metadata` 是站点级 `ToolPage` 外壳的（`src/components/tool-page/`），不在本文件职权内。

## 输出面

- **没有输出设置**：这个页面能设的只有目标格式。质量来自 `core/formats.ts` 的 `formatSpecs.quality`（每个编解码器一个数：AVIF 50、其余 75）；PNG 的 oxipng 级别是 `worker/worker.ts` 里的常量（`pngOptimisationLevel`，2）——它是另一类旋钮，不是「质量」，所以留在 PNG 编码器旁边；BMP 两者都不读。删除过程与理由见 `docs/adr/0010-no-output-settings.md`（含它的作用域声明与更新段）。
- **无损与否由格式本身决定**（见上文词汇）。
- **透明像素落到纯白**：目标没有 alpha 通道时，Worker 先以纯白压平（`flattenBackground`，`core/formats.ts`）——那是访客自己文件里的像素，不是界面表面，所以不受「无纯黑纯白」约束（站点规则在 `apps/web/docs/design/colour.md`）。
- **输出名由规则决定**（`core/naming.ts`：换扩展名 + 后缀去重），界面没有文件名字段。

## 组件

- **格式行**：`2. 转换为` 一节是五张可勾的卡片（`.format-card`，发丝边框；`data-checked` 时边框从发丝色换成 ink）——勾选态不新增颜色，五个格式行里哪些是开的，不靠凑近看五个小方块。标题下留一行小字说明「为什么不能调质量」：控件收掉之后，这是访客唯一会问的问题，一行字比一个被禁用的控件便宜。
- **文件列表用发丝行，不用卡片**：一行一个文件（`.file-row`），行首 40×40 缩略图（`.file-preview`：方框永远在、图到了才画，文件名不会在图片到达时横向跳一下；解码失败留空框位、不画空框）、文件名与**嗅探出来的**格式（改名叫 `.jpg` 的 HEIC 进不了队列，所以标签永远是文件的真实格式）、长文件名截断而格式与移除叉不动。缩略图一次只做一张（`hooks/use-file-thumbnail`），否则一次加二十张大图就是二十次同时解码。计数行在有下载结果时同时报两个数（「已添加 3 张，已生成 9 个文件」，`core/counts.ts`），因为它紧挨着的那个清空键把两处一起清（`core/` 里的拒绝与清空措辞有单测）。
- **拖拽区（Dropzone）**：`@mantine/dropzone` 自带样式写在 Mantine 默认调色板上，两条都不是本站的值，覆盖写在 `globals.css` 的 `components` 层（该层排在 `mantine` 之后，同特异性下必赢）。虚线发丝保留——这是全站唯一一个邀请投递的框。拖拽悬停态用 ink 表达（底色换 `default-hover`、边框换文字色），不用 Mantine 的绿色：本站没有强调色。`[data-reject]` 不写规则：这里没有 `accept` 属性（格式由字节嗅探决定，见 `core/sniff.ts`），该状态渲染不出来。
- **触屏上没有拖拽区**：`@media (hover: none)` 把虚线框压平（边框、底色、内距归零），**元素留着**——文件按钮在它里面，且它仍是拖拽事件的目标（触屏上用不到而已）。触屏只负责把按钮撑到 **50px 高**；「占满一行」是站点级窄屏规则的事（`apps/web/docs/design/layout.md`），所以在宽屏触屏设备（平板）上它是 50px 高、宽度自适应。
- **禁用理由的两个态**：转换按钮是「禁用的控件必须说明原因」（站点级规则，`apps/web/docs/design/components.md`）的实例——没加文件 / 加了文件但没选格式，两种状态的句意不同。
- **窄屏上动作占满一行**：转换与取消用 `.action-full-width`——站点级窄屏规则的实例（`apps/web/docs/design/layout.md`）。

## 报错

- 浏览器或编码器自己的报错只进 console，不进界面；用户能读到的拒绝句在纯函数层（`core/hints.ts`、`core/failures.ts`、`core/limits.ts`、`core/admission.ts`），让单测能盯住措辞（这正是站点级「纯函数文案层」模式的实例，路由表见 `apps/web/docs/design.md`）。

## 指向

- 编解码器为何单线程跑在 Worker 里、为何没有跨源隔离：`docs/adr/0004-image-codecs-single-threaded-in-a-worker.md`。
- 输出设置为什么没有：`docs/adr/0010-no-output-settings.md`。
- 封面是谁交来的、为何保留原色：`apps/web/docs/design/assets.md`；封面与站点标记一样不在仓库许可范围内（`meta.ts` 的注释）。
- 历次浏览器验证的证据：`apps/web/docs/design/log.md`（条目标注了归属与时间）。
