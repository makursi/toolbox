# 解耦工作计划：把 image-converter 的私有规则从站点文档里剥出来

- **状态**：已确认并存档（重要工作决策记录）。Q1–Q9 与 R1–R3 全部落定，执行拆为三个 PR（#45 `docs/image-converter-own-rules`、#46 `docs/site-docs-drop-tool-rules`、#47 `docs/point-to-tool-rules`）。本文件是这次决策的记录，**不是规则**；规则落入 ADR-0014 与各文档改动。
- **寿命**：按 R2 存档——本文件与决定共存留，随仓库保留；它记的是这次的提取、判据与逐条处置。
- **已读判定依据**：`CONTEXT.md`、`apps/web/docs/adding-a-tool.md`、`apps/web/docs/design.md` 与 `apps/web/docs/design/` 九个模块、`docs/adr/0001 … 0013`、`docs/agents/domain.md`、`docs/drafts/cover-generator.md`、`apps/web/src/tools/image-converter/`（README、meta、core/、hooks/、worker/）、`apps/web/e2e/`、全仓 `git log`。

---

## 1. 提取：image-converter（图片格式转换）在共享文档里留下的内容

### A. 工具私有、却写进了全站/全 App 文档（冲突源）

| #   | 位置                                                                                    | 内容                                                                                     | 判据 A 归类                                                                             |
| --- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| A1  | `apps/web/docs/design.md:60`                                                            | 否掉清单：「工具页的输出设置（缩放、旋转、背景色，以及质量、无损与高级选项，同上 ADR）」 | 私有（把一个工具的既成事实写成了全站禁令；新工具的导出面撞墙）                          |
| A2  | `docs/adr/0010`                                                                         | 标题即 _The Image Converter has no output settings_，正文未标作用域                      | 私有（决定本身只绑定它；标题对读者暗示全站适用）                                        |
| A3  | `apps/web/docs/design/components.md:7-9, 19(下半), 20, 21(例子), 24`                    | 格式行、勾选态卡片、文件列表、禁用理由两态例子、触屏无拖拽、拖拽区                       | 私有（全是「上传→转换→下载」这一个产品形态）                                            |
| A4  | `apps/web/docs/design/log.md:49`（#6 工具页结构）                                       | 「三个步骤保持可见（添加图片/转换为/下载）……不要再加回来」                               | 私有（单工具页面结构写成全站工具页规则）                                                |
| A5  | `apps/web/docs/design.md:30` 路由表末行                                                 | 「代码在哪」列点名 `core/hints.ts` / `failures.ts` / `limits.ts` / `admission.ts`        | 私有（站级路由点名单工具文件）                                                          |
| A6  | `apps/web/docs/design/checklist.md:19`                                                  | 「行为那一半」用五格式转换当例子                                                         | 私有（机制公共，例子是它的）                                                            |
| A7  | `CONTEXT.md`                                                                            | Conversion / Lossless 两个词条                                                           | 私有（工具领域词汇站在站点术语表里；`adding-a-tool.md` §2 自己规定工具词不进 glossary） |
| A8  | `apps/web/docs/design/components.md:14`；「编码器」措辞实际在 `design.md:30`（并入 A5） | 「折叠控件：**全站已经没有了**」                                                         | 私有（出身是它的码器报错与高级选项；措辞需泛化）                                        |

### B. 从它长出来、但确实公共（保留；个别只需措辞泛化）

1. ADR-0004 的结构后果：重活进 Worker、放弃 COI、只用 CSP——任何重浏览器工具都要守，ADR 已立在 doc 层，**不动**。
2. 纯函数文案层模式（拒绝原因/失败句/上限句可被单测盯住；浏览器报错只进 console）——模式公共，具体文件名降格为「先例」。
3. `layout.md:10` 网格规则（第二个 Tool 到来时改网格）——公共，不动。
4. `copy.md` 承诺一页一次 / `meta.ts` 只讲能力 / 页脚承诺——公共，不动。
5. gate（`e2e/`）与 instrument（`scripts/`）分层——公共，已是 ADR-0012。
6. `assets.md` 封面规则——公共；第 21 行例外段已自带作用域（「现有封面」），**不动**。
7. `adding-a-tool.md` 整体（Tool 契约）——公共；它点名 image-converter 的地方已是带作用域的示例（§2、§4 "in the image converter"），不动。

### C. 公共部分的总结（判据 A 的落点）

- **站点级规则（留在设计文档集 / repo 级 ADR）**：站点外壳（页头/页脚/404/卡片/注册表/路由/配色/字体/图标/动效/触控目标）+ 横切纪律（CSP、设计语言、承诺一页一次、纯函数文案层**模式**、文案禁词与标点）+ 工程分层（gate/instrument、单测、文档纪律、CI、Tool 契约）。
- **工具级规则（搬到 `src/tools/<slug>/design.md`）**：每个工具自己的产品形态——页面结构、输入模型、导出面（输出设置/命名/格式/质量）、领域词汇、数字与限值、文案原文。
- 工具之间的共享照旧走 `packages/*` 的「第二消费者」门槛；**第一个工具的私有决定不是公共规则的原料**。

---

## 2. 逐条处置表（Q6 已确认，整表执行）

| #   | 位置                             | 处置                                                                                                                                                                                                                                                          |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `design.md:60`                   | **拆行**：删「工具页的输出设置（缩放、旋转、背景色，以及质量、无损与高级选项，同上 ADR）」整条全站禁令；同行「纯黑与纯白（导出的图片像素不算：JPEG 的压平底色就是纯白）」是通用豁免，**保留**并去掉对 ADR-0010 的引用（豁免理由在 ADR-0010 的作用域段里写明） |
| A2  | `docs/adr/0010`                  | 文件开头加一段**作用域声明**（正向措辞，见第 4.4 节模板）：「本 ADR 记的是 image-converter 的决定，只绑定它；每个新 Tool 的导出面是自己的产品决定，不继承本条。」标题与论证不动                                                                               |
| A3  | `components.md`                  | 相应段落整段移去 `image-converter/design.md`；`components.md` 只留通用骨架：「禁用的控件必须说明原因」（删转换按钮两态例子）、「窄屏上动作占满一行」（例子泛化）、触控目标通用规则（保留，删重复的测量数字）、`layout.md:17` 的「触屏≠窄屏」原则（例子泛化）  |
| A4  | `log.md:49`                      | 改写为通用：「ToolPage 外壳是公共的（`components/tool-page`）；**页面结构是每个工具自己的决定**，image-converter 的三步骤见其 `design.md`」                                                                                                                   |
| A5  | `design.md:30`                   | 代码列改为「工具自己的纯文案层（先例：image-converter 的 `core/hints.ts` 等）」，文件名降格为示例；「浏览器或编码器」同步泛化为「浏览器或底层库」                                                                                                             |
| A6  | `checklist.md:19`                | 机制保留（行为归 e2e gate），例子改通用并指向「每个工具的 QA 清单在它自己的 README」                                                                                                                                                                          |
| A7  | `CONTEXT.md`                     | 删 Conversion / Lossless 词条，进 `image-converter/design.md` 的词汇节（引用它们的 ADR/README 保持原词——那本是工具域文档）                                                                                                                                    |
| A8  | `copy.md:10`、`components.md:14` | 前者「编码器」→「底层库」；后者改写为「折叠控件目前没有在用；要不要折叠是每个工具自己的决定（先例：image-converter 已删，见其 `design.md`）」                                                                                                                 |
| +1  | `colour.md:9`                    | 「文件行里那张 40×40 的缩略图」→「工具自己渲染的资源预览（先例：image-converter 文件行的缩略图）」                                                                                                                                                            |
| +2  | `components.md:22-23`            | 删与工具 README 重复的测量数字（清空 45×45 等），留一句指向                                                                                                                                                                                                   |
| +3  | `assets.md:21`                   | 不动（已是作用域正确的形状）                                                                                                                                                                                                                                  |
| +4  | `docs/drafts/cover-generator.md` | C3（188–191 行）与待决表第 5 行的过期引用，机械更新为「全站禁令已被解耦移除（ADR-0014 / ADR-0010 作用域段）；导出面是封面生成器自己的产品决定」，其余不动（产品决定留在它的 issue 流程）                                                                      |

---

## 3. 结构改动（Q5 / Q7 / Q9 已定）

### 3.1 新文件 `apps/web/src/tools/image-converter/design.md`（Q5:(a)）

职权：image-converter 自己的设计规则与词汇，只约束它。大纲（内容均从现有文档迁移，不新造规则）：

- **词汇**：Conversion / Lossless / Batch（从 CONTEXT.md 迁来）
- **页面结构**：三步骤（添加图片 / 转换为 / 下载）、无折叠（历史：高级选项已删）
- **组件**：格式行（可勾卡片、勾选态只换发丝）、文件列表（发丝行 + 40×40 缩略图 + 嗅探格式 + 计数行）、拖拽区与触屏无拖拽、禁用理由两态例子、窄屏动作占满一行的工具级例子
- **输出面**：没有输出设置（指向 ADR-0010 的作用域段）；质量来自 `formatSpecs.quality`（AVIF 50、其余 75）；`pngOptimisationLevel = 2`；无损语义（PNG/BMP 永远无损、JPEG 无、WebP/AVIF 永远有损）；透明像素的压平底色是纯白
- **报错**：浏览器/编码器报错只进 console（实例：`core/hints.ts` 等）
- **指向**：ADR-0004（codec 单线程 Worker，为何不用 COI）、ADR-0010（无输出设置）、`assets.md`（封面例外的所有权记在站点文档）
- README 增一行链接指向它。

### 3.2 `log.md` 标注格式（Q9：不搬，但每条标注归属/内容/时间戳）

条目开头加一行标签，格式：

```
**所属**：image-converter ｜ 站点外壳 ｜ 文档 ｜ 通用　**内容**：一句话　**时间**：YYYY-MM-DD（取自 commit 或执行日）
```

文内已带日期的轮次（2026-09-17/18/20）不动正文，只补条目级标签；归属在轮次之间变化时（如第 2 条里第九~十一轮是量具/门禁/站点文档），在轮次小标题里补一个轮次级标签。时间戳取 `git log` 实测日期：封面 #13（09-17）、设计指南 #11（09-14）、QA #19（09-17）、#20（09-17）、#24（09-17）、#25（09-17）、#26（09-17）、#28（09-18）、#30（09-18）、#39–#44（09-20）。

### 3.3 `CONTEXT.md` 词条草稿（Q7:(a)，英文正文保持 glossary 文风）

```markdown
**Site-level rule**:
A rule that binds every Tool because it is about the site itself: the shell
(header, footer, cards, registry, routes), the design language, the CSP, the
gate and instrument tiers, the Tool contract, the copy discipline. It lives in
the design doc set or a repo-level ADR, and a Tool that breaks it reopens that
decision.
_Avoid_: common rule, shared rule, public rule

**Tool-scoped rule**:
A rule that records one Tool's own product decision — its page structure, its
input model, its export surface, its numbers and wording, its vocabulary. It
lives with the Tool (`src/tools/<slug>/design.md`) or in an ADR whose first
line states the scope; no other Tool inherits it.
_Avoid_: site rule, universal rule — and never call a Tool's own rule a
"site-level" one just because it was written down first.
```

### 3.4 ADR-0014 大纲（英文草稿，落 `docs/adr/0014-tool-scoped-rules-live-with-the-tool.md`）

- **Title**: Tool-scoped rules live with the Tool
- **Problem**: The first Tool (Image Converter) left its product decisions — page structure, the "no output settings" ban, component patterns, its vocabulary — written as site-wide rules in the design doc set, `CONTEXT.md` and an ADR titled for the site. The second Tool collides with rules that were never the toolbox's.
- **Decision**:
  1. The design doc set holds site-level rules only: a rule binds a Tool because it is about the site itself.
  2. A Tool's product decisions live in `src/tools/<slug>/design.md`, created when the first tool-scoped rule needs a home; the Tool's README links it.
  3. A repo-level ADR may record a tool-scoped decision, but its first line states the scope — ADR-0010 is done this way.
  4. A site-level exemption born inside a tool decision (exported pixels are not interface surfaces) is re-stated where it binds the whole site's reading of a rule, with the tool decision cited.
- **Consequences**（执行面清单，见第 5 节）＋ **Considered Options**（保留在文档集加作用域标注——被否：文档继续膨胀、读者要跳过别人的规则；每个新工具逐个谈判例外——被否：同一场架重打，例外开花；规则进工具 README——被否：README 是行为与 QA 的职责，设计规则另立 `design.md`）。

### 3.5 `adding-a-tool.md` / `docs/agents/domain.md` 改动点（防回潮指针）

- `adding-a-tool.md` §2 表加可选行：「`src/tools/<slug>/design.md` — when a Tool has rules that only it obeys（页面结构/组件/词汇/导出面）——站点文档只装站点级规则（ADR-0014）」；§6 反模式加一条：「把工具私有规则写成站点规则」。
- `docs/agents/domain.md` 探索清单加一行：「动某个 Tool 时，若 `src/tools/<slug>/design.md` 存在，先读它——它是这个工具的规则，不是站点的」。

---

## 4. 改动文件总清单（执行面）

| 文件                                                    | 动作                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| `apps/web/src/tools/image-converter/design.md`          | **新建**（3.1）                                                            |
| `apps/web/src/tools/image-converter/README.md`          | 加一行链接                                                                 |
| `docs/adr/0014-tool-scoped-rules-live-with-the-tool.md` | **新建**（3.4）                                                            |
| `docs/adr/0010-no-output-settings.md`                   | 开头加作用域声明                                                           |
| `apps/web/docs/design.md`                               | 拆 :60；改 :30；路由表加「工具私有规则」行；「另外两条」补第三条结构性规矩 |
| `apps/web/docs/design/components.md`                    | 删/泛化（处置表 A3、+2、A8）                                               |
| `apps/web/docs/design/colour.md`                        | 缩略图措辞泛化                                                             |
| `apps/web/docs/design/checklist.md`                     | :19 泛化                                                                   |
| `apps/web/docs/design/log.md`                           | 条目标注 + #6 改写                                                         |
| `CONTEXT.md`                                            | 删两词条、加两词条                                                         |
| `docs/drafts/cover-generator.md`                        | C3 引用机械更新                                                            |
| `docs/drafts/decouple-tool-rules.md`                    | 存档（R2，本文件即决策记录）                                               |

## 5. 执行顺序与验收

1. 先建接收端（`image-converter/design.md`）→ 2. ADR-0014 + ADR-0010 作用域 → 3. 站点文档（design/components/colour/checklist/log）→ 4. CONTEXT.md → 5. adding-a-tool.md + domain.md → 6. cover-generator 引用 → 7. `pnpm fmt` / `lint` / `typecheck` / `test`（纯文档改动，UI 与门禁不应受影响；`check:readme` 未触及 README 双语一致性）→ 8. 本文件随第三个 PR 存档（R2，状态改「已确认并存档」）。

## 6. 仍需确认的三件事（其余全部已定）

- **R1**：合意——log.md 每条标 所属 · 内容 · 时间。
- **R2**：存档——本文件即重要工作决策记录。
- **R3**：拆三个 PR（本文件随第三个存档）。
