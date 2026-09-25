# cover-generator · 设计规则（工具级）

> **管什么**：这个 Tool 自己的设计规则与词汇——页面结构、输出面、图标机制、字形承诺。**只约束 cover-generator；站点级规则**（外壳、设计语言、CSP、门禁量具、Tool 契约）在 `apps/web/docs/design.md` 与 `apps/web/docs/design/`，两者不互相重复。站点文档只装站点级规则，一个工具的私有规则住在这里，见 `docs/adr/0014-tool-scoped-rules-live-with-the-tool.md`（issue #50 的拷打结论）。**和它一起读**：`apps/web/docs/design.md`（站点级规则）、`docs/adr/0005-no-outbound-requests.md`。

## 词汇

站点术语表（`CONTEXT.md`）只定义站点词；下面是本工具的领域词，本站其它文档不继承它们的含义：

- **封面**：本工具的导出产物。UI 里永远带用途/比例前缀（下载按钮文案「下载 16:9」），不与 `CONTEXT.md` 的 Tool Card cover 共用一词。
- **构图**：导出图里的一切内容——两段文字、图标、背景、以及它们的位置与样式；构图的那一面是内容，不让步。

## 页面结构

- **ThisCover 式编辑器**：左配置栏（内容 / 样式 / 导出三段）+ 中央预览画布。**单一布局随宽度重排**：390px 下预览置顶（sticky）、分区折叠；不是两套布局（`ADR-0010` 的 "hidden below md" 教训）。折叠行为对所有宽度同一套。
- 返回首页、标题、描述与 `metadata` 是站点级 `ToolPage` 外壳的（`src/components/tool-page/`），不在本文件职权内。

## 输出面

- **v1 形状（issue #50 定案）**：格式固定 **PNG**（JPG/WebP 下拉不进 v1）；倍率只留 **1x**（"选比例即得对应像素"；多像素密度未来用预设档位，不是开关）；**文件名接受输入框**，默认值由规则给出（比例 + 示例文案，去重后缀沿用 `naming` 规则）；**背景透明**保留，规则是"透明只对 PNG 有意义"。
- 输出面是本 Tool 自己的产品决定（ADR-0014）；`docs/adr/0010-no-output-settings.md` 的禁令只绑定 image-converter，本工具不继承。
- **像素上限**：最大档 21:9@2560×1080（≈2.8 MP），画布最大边长与上限文案随实现定，拒绝文案进纯函数层。

## 图标机制

- **lucide 同源 chunk**：`icons.json`（0.61 MB / 1853 图标）整体进仓，动态 `import()`，inline SVG 渲染（被 SnapDOM 直接捕获）。搜索 = 对捆绑索引的**纯函数过滤**。站点级 CSP 仍然绑：图标数据必须同源到达，不许请求 `api.iconify.design`。
- **颜色规则**：库图标单色（`currentColor`）、上传图标保持本色；没有"原色"开关。
- 站点的 Phosphor 机制（`docs/adr/0009-phosphor-icons-through-iconify.md`）是站点级的，本工具不动它——选择器是本工具的输入模型（ADR-0014，issue #50 的 C1 判"不绑"）。

## 字形承诺

- **导出图里的字形取决于导出机器**：系统回退 + 访客自带。README 写明"同一份设计在两台不同系统的机器上导出，字形不一样"；不进站点 `design/typography.md`。
- 字体上传走 `new FontFace(family, ArrayBuffer)`（规格层面不经 `font-src`）；生产构建录一次基线（accentance，见 #57）。
- 系统字体（Local Font Access）仅 Chromium 桌面可用：「不支持时会提示」，回退文案进 `core/hints.ts`；不引入 polyfill。

## 指向

- 截图引擎：`@zumer/snapdom`（MIT、~244 KB、维护中；`blob:` 与严格 CSP 行为无文档，实验见 README）。
- 比例基准：1:1@1080×1080 · 4:3@1320×990（=站点自己 Tool Card 封面那一档，`assets/inbox/README.md`）· 16:9@1280×720 · 21:9@2560×1080。
- 历次浏览器验证的证据：`apps/web/docs/design/log.md`（条目标注了归属与时间）。
