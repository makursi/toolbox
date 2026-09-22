# 组件

> **管什么**：逐组件的外观与行为规则，含触控目标、图标与禁用态。**和它一起读**：`apps/web/docs/design/colour.md`（勾选态只换发丝颜色、配色开关）、`apps/web/docs/design/layout.md`（`sm` 到底是哪一个）、`apps/web/docs/design/assets.md`（封面例外）。

- **卡片**：`Paper withBorder`——发丝线来自 token，绝不硬编码灰色；`radius="md"`（8px）、`p="lg"`（24px），外加一个 `lift` 类，hover 时把阴影提到 4% 不透明度、过渡 200ms。
  **没有阴影是设计本身，不是漏写的样式**——「给卡片加个阴影」是后来者最容易"顺手修"的地方，所以特意写在这里。
- **卡片在窄屏上的形状**：封面在宽屏上在左侧（220×165），在窄屏上**移到文字下方**且**高度封顶 180px**（多余的裁掉），标题同时从 18px 升到 20px。理由：手机上封面占满屏宽会把标题挤到下面、又把卡片拉得很长，而直接隐藏封面等于把这张图在手机上删掉。换序由一个属性完成：标里是 `[封面, 文字]`，`direction={{ base: "column-reverse", sm: "row" }}`。
- **圆角**：容器 8px、控件 4px（`Button` 默认 `radius="sm"`）。一套体系两个值；**药丸形主按钮被否决**——放在方正的卡片里，它读起来像装饰。
- **按钮**：Mantine `filled`，用 `ink` 调色板（浅色接近黑、深色接近白），对比色由 Mantine 自动计算（17.33:1）。
- **图标**：来自 Phosphor，由 Iconify 的 Tailwind v4 插件在**构建期**编进 CSS（`apps/web/src/app/globals.css` 里的 `@plugin`），写成一个字面量类名 `icon-[ph--arrow-right-bold]`，绘制方式是 `currentColor` 的 mask，所以图标跟随所在文字的颜色与字号。**统一用 bold 一个字重**，尺寸就是 `1em`，没有图标专用的尺寸 token。**不做包装组件**：Tailwind 是从源码里读出类名的，拼出来的名字不会被编译，`apps/web/src/app/__tests__/icons.test.ts` 会拦下这种写法和写错的图标名。除了这三条，`.icon` 只负责插件管不到的两件事（`flex-shrink`、以及把 inline-block 的图标下移 `0.125em` 与文字对齐）。理由与取舍见 `docs/adr/0009-phosphor-icons-through-iconify.md`。
- **折叠控件（disclosure）**：目前没有在用。要不要折叠是每个工具自己的决定，按工具级规则进工具自己的文档（`docs/adr/0014-tool-scoped-rules-live-with-the-tool.md`）；image-converter 的「高级选项」2026-09-18 已删，见它的 `design.md`。
- **Tool 页的返回入口**：标题上方一行（图标 + 返回首页，`size="sm"`、dimmed，hover 提亮到正文色，用 `.quiet-link`），箭头是 `ph--arrow-left-bold`。页头的 wordmark 也回首页，两者是有意的：一个是上下文、一个是全局。404 页不加（它已经有一个主按钮）。
- **配色开关**：页头右侧，`variant="default"` + `size="compact-sm"`，带 `.touch-target`（页头里最小的靶子也是 44×44）。**只有图标，没有可见文字**：浅色下是月亮、深色下是太阳，写的都是**将要切到的模式**。名字给读屏（「切换到深色」/「切换到浅色」），用 `sr-only` 文字写在图标旁边，两套都在 DOM 里、由样式表切换（见 `apps/web/docs/design/colour.md`）。
- **输入控件**：发丝边框；占位符与标签的对比度都按它们实际所在的表面测过；聚焦环取 ink 色。
- **404 页**（`apps/web/src/app/not-found.tsx`）：三个东西，不多不少 —— 发生了什么、为什么可能发生、一个出口。用它自己的排版站起来（`Container size="md"`、标题用 `h1`、说明用 `dimmed`、出口是一个主按钮）；**不放超大数字、不放插画、不列「你可能想找」的链接清单** —— 一个只有一个工具的站点没有那么多去处可推荐。回首页的按钮写成 `component="a"` 而不是 `component={Link}`：字符串让 Mantine 渲染成真锚点，页面因此保持 Server Component（传函数给 Client Component 会被构建拒绝），代价是一次整页加载，而对一个 404 来说这反而更稳：关掉 JavaScript 也回得去。
- **禁用的控件必须说明原因**：灰掉的按钮或输入框旁边要写清缺的是哪一步，而不是让人猜、也不是用 tooltip 藏起来。这些句子来自工具自己的纯文案层（先例：image-converter 的 `core/hints.ts`），有单测；而且必须**随状态变化**，一句通用的"请完成上面的步骤"等于没说。
- **窄屏上动作占满一行**：`.action-full-width` 在 `max-width: 640px` 生效（Tailwind 的 `sm`），主要动作按钮按此占满，理由文字换行到按钮下方。
- **触控目标 ≥44px**：视觉尺寸与可点尺寸不是一回事。`.touch-target` 用一个居中的伪元素把可点区域撑到至少 44×44，不改绘制、不改布局。**它只能挂在「自己处理点击」的元素上**（`<button>`、`<a>`、`<label for>`），挂在只负责包裹的容器上不是把靶子变大，而是把点击吃掉：伪元素收到的点击算在它所属的元素头上，而容器没有处理器，于是鼠标永远点不中、键盘却照常能用。格式行因此不用这个类，改成把它的 `<label>` 撑满整行（`.format-row`）；移除文件、配色开关、清空各自就是自己处理点击的元素，返回首页挂在 `<a>` 上而不是它里面的那个 `<p>`（伪元素的点击属于生成它的元素，「拥有者」才是规则要的东西）。主要动作按钮用 `size="md"`（42px）：Mantine 默认的 `sm` 是 36px，在触屏上偏小。**但 42 ≠ 44**：那是写明的例外，不是达标线——凡是要 44 的地方都不许拿 `size="md"` 顶替。
  **伪元素会被裁：Mantine 的 `Button` 自带 `overflow: hidden`**，它把伪元素裁成按钮自己的框，于是挂在 `Button` 上的 `.touch-target` 只有声明、没有那个可点区域（2026-09-18 的绘制尺寸是 32×26 与 46×26，2026-09-20 用探针量到它们的可点区域是 31×25 与 45×27，而两者的 `::after` 一直算得出 44×44）。**2026-09-20 已修**，办法是一条带守卫的覆盖：`.touch-target.mantine-Button-root:not([data-loading]) { overflow: visible }`。守卫不是装饰：Mantine 需要那个裁切只在 loading 一个状态里（label 会向下滑出，还有一道模糊扫光会溢出），而 `loading` 同时也会 `disabled`（Mantine 的 `Button` 传的是 `disabled: disabled || loading`），所以「保留裁切的状态」正是「不能被点的状态」，其余时候遮罩逃出去。实测就是这个行为：在按钮上加上 `data-loading`，计算出的 `overflow` 从 `visible` 变回 `hidden`，去掉再变回 `visible`。`CloseButton` 不裁，从来不用管它。重量的结果（360 / 390 / 768 / 1024 × 两套配色，`pnpm --filter @toolbox/web touch-targets`）全部达标；image-converter 那几个控件的逐个数在它的 `design.md` 与 README。探针按像素中心向外走，正好 44 的量出来就是 43；它要求两侧都答得上，所以靶子长大盖住邻居也会读成不达标。
- **页脚**（`src/components/site-footer/site-footer.tsx`）：发丝上边框加一行小字（`dimmed`、`size="xs"`）。只写站点真正承诺的那句话（文件只在这台设备上处理），**不复述导航**（页头已经有一份），不放第二组链接，不放版权年份。它存在的理由是让每个页面都有结尾；它就只该做这一件事。
