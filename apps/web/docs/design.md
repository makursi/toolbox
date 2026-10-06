# 设计

这**一套**文档是这个站点「长什么样、以及为什么这样」的单一依据。本文件是**入口**，它只装五样东西：遵循的规范、不变量索引、「你在动什么 → 哪个文件」的路由表、三条不属于任何模块的结构性规矩、以及已经否掉的方向。带日期和取舍的正式决策记录在 `docs/adr/`（例如 `docs/adr/0007-warm-monochrome-design-language.md`）；各模块记的是**当前状态**：现在生效的规则、现在的 token 值，以及还没做完的事。

> **关于语言**：这套文档用中文书写，方便本人阅读；代码、注释、ADR 与 commit message 仍保持英文（那是仓库的既有约定）。站点文案**已经是中文**，相应的排版与标点规则见 `apps/web/docs/design/typography.md` 与 `apps/web/docs/design/copy.md`。

**入口的三条纪律**（它是唯一有机会长成第二份设计文档的文件）：只装上面那五样；**不搬任何一条规则的理由**，一条规则为什么成立写在拥有它的模块里，入口最多写那句规则本身；只有「改哪个文件」这件事变了才动这里。

## 不变量

**分两类，分法本身就是组件层迁移这一轮的结论（#122）。** **美学项**是选择，所以随组件层一起重新打开，由 #116 重新定并重新量过；**强制项**是原样带过的，因为它们各自被某个**能变红的东西**或者一条谁都逃不掉的策略盯着——门禁、量具、单测、CSP，或 `apps/web/docs/design/checklist.md` 里那条要人过的手过项——所以换组件层不是动它们的理由。纯黑与纯白在强制项那一组，因为它是**量出来的结论**而不是口味（`docs/adr/0007-warm-monochrome-design-language.md`）。每条一行、不写理由，规则本身与它的例外在箭头指向的文件里。

**美学项——本次工作重新打开：**

- **没有强调色**：颜色只用来表达语义，也就是错误。→ `apps/web/docs/design/colour.md`
- **暖单色**，以及「容器一个圆角、控件一个更小的圆角」这套尺度：同属这一组，规则与它们的理由在 `apps/web/docs/design/colour.md` 与 `apps/web/docs/design/components.md`。

**强制项——原样带过：**

- **没有纯 `#000000` 与纯 `#ffffff`**：浅色画布是暖白，深色也不是纯黑（**导出的图片像素不算**：JPEG 的压平底色就是纯白）。→ `apps/web/docs/design/colour.md`
- **用户能读到的文案零 `—`（em dash）与零 `——`（中文破折号）**，标点用全角。→ `apps/web/docs/design/copy.md`
- **可点控件的命中区域 ≥44px**：视觉尺寸不算数，声明尺寸也不算数。→ `apps/web/docs/design/components.md`
- **一切资源自本站提供**：不引第三方图片、字体或图标，CSP 会拦掉。→ `apps/web/docs/design/assets.md`
- **图标只用 Phosphor，写字面量类名，在构建期编进 CSS**：拼出来的名字不会被编译，图标测试会拦下这种写法。→ `apps/web/docs/design/components.md`
- **不编造图形与数据**：不放替代图形、不放占位数据、不放假名字。→ 图形 `apps/web/docs/design/assets.md`；句子与数据 `apps/web/docs/design/copy.md`

## 从哪里改

| 你在动什么                                            | 规则在哪                                                                                                   | 代码在哪                                                                                                                                                                                                                                                  |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 颜色与明暗模式                                        | `apps/web/docs/design/colour.md`                                                                           | `apps/web/src/lib/tokens.ts`（**唯一声明值的地方**，两个组件层都读它）；`apps/web/src/app/theme.ts` 是旧层那一端，`apps/web/src/app/globals.css` 里的 `@theme inline` 是新层那一端的名字映射。值**不**写在 `globals.css` 里，那里的 `@layer` 顺序仍然要守 |
| 字体、字号层级、圆角、按钮默认值                      | `apps/web/docs/design/typography.md`（字体与字号层级）、`apps/web/docs/design/components.md`（圆角与按钮） | 同一个 `createTheme` 调用里（`apps/web/src/app/theme.ts`）                                                                                                                                                                                                |
| 布局与页面节奏                                        | `apps/web/docs/design/layout.md`                                                                           | 页面组件里，写成 Tailwind 工具类（旧层那套响应式属性随 #167 一起没有页面在用了）                                                                                                                                                                          |
| 组件外观、触控目标                                    | `apps/web/docs/design/components.md`                                                                       | 组件本体；`.touch-target` 本身、以及给 Mantine `Button` 那条放开裁切的覆盖，都在 `apps/web/src/app/globals.css`（量它跑 `pnpm --filter @toolbox/web touch-targets`）                                                                                      |
| 图标                                                  | `apps/web/docs/design/components.md`                                                                       | 在用了它的组件里写类名（`icon-[ph--sun-bold]`）；数据源与插件接线在 `apps/web/src/app/globals.css` 顶部的 `@plugin`；能用的名字查 <https://icon-sets.iconify.design/ph/>                                                                                  |
| 动效与过渡、工具类                                    | `apps/web/docs/design/motion.md`                                                                           | `apps/web/src/app/globals.css`（`.reveal`、`.lift`、`.icon`）                                                                                                                                                                                             |
| 用户能读到的句子                                      | `apps/web/docs/design/copy.md`                                                                             | 工具自己的纯文案层，因为文案要能被单测盯住（先例：image-converter 的 `core/hints.ts`、`core/failures.ts`、`core/limits.ts`、`core/admission.ts`）；浏览器或底层库自己的报错不进界面，只进 console                                                         |
| 图片、字体、图标素材                                  | `apps/web/docs/design/assets.md`                                                                           | `apps/web/public/`、`apps/web/assets/`（未定稿的进 `inbox/`）、`apps/web/src/app/` 里的图标文件                                                                                                                                                           |
| 合并前要过的检查                                      | `apps/web/docs/design/checklist.md`                                                                        | 半数是命令（`pnpm test`、`pnpm --filter @toolbox/web touch-targets`、`pnpm e2e`），半数是手过                                                                                                                                                             |
| 还没做完的事、历次验证的证据                          | `apps/web/docs/design/log.md`                                                                              | —                                                                                                                                                                                                                                                         |
| 想加一个新图形、新依赖、新模式                        | 本文件的「明确否掉的做法」                                                                                 | —                                                                                                                                                                                                                                                         |
| 某个 Tool 自己的设计规则（页面结构/组件/词汇/导出面） | `src/tools/<slug>/rules.md`（先例：`apps/web/src/tools/image-converter/rules.md`，它的 README 有链接）     | Tool 自己的组件与实现；站点文档只装站点级规则，见 `docs/adr/0014-tool-scoped-rules-live-with-the-tool.md`                                                                                                                                                 |

## 遵循的规范

UI 改动由两套 skill 协议共同约束，两者在动手前都已被完整读过：

| 协议                                                          | 它提供什么                                                                                          |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `minimalist-ui`                                               | **设计语言**：暖色单色调色板、排版层级、大量留白、组件规格。                                        |
| `design-taste-frontend`（`taste-skill` 家族的默认 skill，v2） | **门禁**：它自己的 §6（无障碍与性能）、§9（反 AI 套路）、§11（重设计协议）、§14（合并前检查矩阵）。 |

**明确不用**的（写在这里，免得以后有人重新捡起来）：

- `high-end-visual-design`：它禁止 `1px` 发丝边框（而本设计的卡片正是靠发丝边框成立的），并要求主按钮做成药丸形，而 `minimalist-ui` 明令禁止主按钮用药丸。两者在最关键的地方正面冲突，所以只能选一个来主控。
- `antfu-design`：它以 UnoCSS 为前提。只在**不依赖 UnoCSS**的地方借用它的约定（Iconify 的预览扩展已按它的建议写进 `.vscode/extensions.json`）。
- `antfu`（工程约定 skill）：它唯一与 UI 相关的内容是 Iconify 的 VS Code 扩展；其其余参考（ESLint、catalogs）与本仓 oxlint、字面量版本的约定冲突，不适用。

## 另外三条

- **共用的 UI 与 hook 放哪**：判据是**谁拥有它**，不是有几个消费者。某个路由段或某个 Tool 私有的，就跟它走（一个 Tool 的整体在 `src/tools/<slug>/`，它的 hook 在 `src/tools/<slug>/hooks/`）；没有单一路由拥有的，进 `src/components/<名字>/<名字>.tsx`、`src/hooks/<名字>/<名字>.ts`，非 UI 的辅助进 `src/lib/`。现在的实例是 `src/components/tool-page/tool-page.tsx`：Tool 页的外壳（返回首页、标题、描述，以及那页的 `metadata`）不属于任何一个 Tool，所以它在 `components/`，而每个 `app/tools/<slug>/page.tsx` 只剩 `ToolPage` 加这个 Tool 自己的实现。目录名与文件名一致、kebab-case、**不写 barrel**。`packages/*` 那条门槛不一样，仍然是「出现第二个消费者」，两者不要混。共用件放在 `src/` 下而不是 `app/` 里，是本仓自己的选择（我们本来就用 `src`，官方 `src` 文档也写了用 `src` 就一并搬 `components`/`lib`）；`app/blog/_components/Post.tsx` 那种私有目录写法同样合法，只是不与本仓已经选定的这一种混用。
- **改完要更新这套文档。** 如果检查清单里的某条或「明确否掉的做法」里的某项不再成立，就改相应的文件（`apps/web/docs/design/checklist.md`，或本文件里那份清单）——不要让文档和代码互相矛盾。**一份说谎的设计文档比没有更糟。**
- **工具私有规则不进设计文档集。** 设计文档集装的是站点级规则：约束站点本身、所有工具都逃不掉的东西（外壳、设计语言、CSP、门禁量具、Tool 契约、文案纪律）。一个工具自己的产品决定——页面结构、输入模型、导出面、数字与文案原文、领域词汇——进 `src/tools/<slug>/rules.md`（先例：`apps/web/src/tools/image-converter/rules.md`，它的 README 有链接）；repo 级 ADR 若记录工具级决定，首行必须写明作用域（`docs/adr/0014-tool-scoped-rules-live-with-the-tool.md`；`docs/adr/0010-no-output-settings.md` 即按此标注）。把第一个工具的决定写成全站规则，正是第二个工具撞墙的来源。

## 明确否掉的做法

写在这里是为了不再被重新讨论：

双层嵌套卡片外壳（Double-Bezel）；药丸形主按钮；渐变、霓虹、玻璃拟态；强调色；衬线大标题；手搓 SVG 图标、Phosphor 之外的图标集、运行期取图标（见 `docs/adr/0009-phosphor-icons-through-iconify.md`）；远程图片与字体；页面中途的分节反色；在只占一屏的页面上做滚动驱动入场；滚动劫持；用 `h-screen` 而不是 `min-h-[100dvh]`；Tailwind 的重阴影；纯黑与纯白（**导出的图片像素不算**：JPEG 的压平底色就是纯白）。

**把「站点同时存在两个组件层」当成常态**，也写在这里——它和上面那串不同，因为它**不是一个可以顺手捡起来的做法，而是一个有期限的状态**：#111 这一轮**故意**造出两层，但只在试点的一页上、且带明确的退出条件——试点页上旧层彻底退场（`#132`）、指纹恢复完整比对并重新基线化（`#133`）、设计语言定稿后由新的 ADR 取代 `docs/adr/0016-the-component-layer-is-shadcn-ui-again.md`。那之后两层态就结束了，任何「再留一层也无妨」的提议都要当作新决定重新论证，而不是当作既有事实。

**这条期限在 2026-10-05 走完了第一格，2026-10-06 走完了第二格与第三格。** `#132` 之后，**封面生成器这一页**上已经没有旧组件层的任何一个组件——不是「分批都落了」推出来的，而是被量具的一条声明读出来的：`touch-targets.mjs` 的 `no-outgoing-layer` 扫一遍声明过的区域，`mantine-*` 类名的命中数必须是 0。**`#163` 之后外壳也不在旧层上了**：页头（含配色开关的按钮）、页脚、404 页与工具卡片都画在新层上，封面页与 404 页因此**整份文档**都是零命中。**`#164` 之后第二个 Tool 也开始了**：image-converter 的拖放区与五张格式卡（含勾选框、以及撑满整行的那一个 `<label for>`）搬到了新层；**`#165` 之后它的文件列表也跟着搬了**（计数行、清空、一行一个文件的行与移除叉、以及拒绝清单那个框）；**`#166` 之后这一页整体搬完了**——动作行（转换 / 取消 / 禁用理由）、进度条、失败清单、输出行与 ZIP 按钮，`globals.css` 里最后一条写给旧库类名的站点规则也随之删掉。**`#167` 之后首页也搬完了**（hero 的标题与描述、以及工具网格本身），而且指纹报的是 `ALL IDENTICAL`——这一次搬家一个读数都没动。**仍在旧层上的只剩配色与主题的「所有权」**：provider、`theme.ts`、`ColorSchemeScript`、`layout.tsx` 的 `mantineHtmlProps`、配色开关用的那两个 hook，以及 `globals.css` 里两条 `@import` 与 `@layer` 那一行里的 `mantine`。那是 #168 的事，而且它是一条决定而不只是一次搬家（谁写那个属性、为什么仍然只有一个主人），`apps/web/docs/design/colour.md` 记着它今天的样子。所以「两层态结束了」这句话，此刻对**外壳、封面生成器这一页、第二个 Tool 与首页**成立；把库整个请出去是 #168 的事，那之前不宣称。**本轮（让站点只剩一层：外壳、第二个 Tool、首页、Mantine 的退场）的登记、判据与票表在 `docs/drafts/one-layer-site.md`**——它继承的就是试点那一轮验证过的纪律（先解绑、证明能红、再搬）。
