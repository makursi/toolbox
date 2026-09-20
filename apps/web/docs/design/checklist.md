# 合并前检查清单

> **管什么**：任何 UI 改动合并前要跑的那一遍。**和它一起读**：`apps/web/docs/design/log.md`（历次执行的方法与证据）。

任何 UI 改动合并前跑一遍。标了*（可机械验证）*的条目要用命令检查，不能靠读代码。

- [ ] _（可机械验证）_ **渲染产物里零破折号**：构建后 `find .next/server/app -name "*.html" -exec grep -o "—\|–" {} \; | wc -l` 为 0。
- [ ] _（可机械验证）_ **没有远程资源与字体**：`find .next/server/app -name "*.html" -exec grep -o "fonts.googleapis\|fonts.gstatic" {} \; | wc -l` 为 0，**并且同一件事对构建出的 CSS 再查一遍**：`find .next/static/chunks -name "*.css" -exec grep -o "url(http" {} \; | wc -l` 为 0、`grep -rl "api.iconify.design" .next` 无输出。第二条不是重复：字体由 `next/font` 自托管所以 HTML 里查得到它，而图标是构建期编进去的 `data:` URI，一旦有人把 Iconify 改回运行期取图，**只有 CSS 这一路会报警**。（刻意不用 `grep -c`：它在计数为 0 时退出码非 0，看起来像失败。）
- [ ] _（可机械验证）_ **层顺序未被破坏**：构建产物 CSS 里 `theme` → `base` → `mantine` → `components` → `utilities`（用 `find .next/static/chunks -name "*.css"` 找到文件后按字节偏移比较）。改动 `globals.css` 里那行 `@layer` 会**静默**翻转 Tailwind 与 Mantine 的优先级。
- [ ] _（可机械验证）_ **新颜色都测过对比度**：对着它实际所在的表面测，文字至少 AA（4.5:1）。
- [ ] _（可机械验证）_ **新 token 两个模式都定义了**：在预渲染 HTML 里核对浅色与深色两组值。
- [ ] _（可机械验证）_ **图标类名都是字面量、且在 Phosphor 里存在**：`pnpm test`。拼出来的名字（`icon-[ph--${x}]`）语法检查、lint 与构建都不会报错，只会静默地不生成 CSS。
- [ ] _（可机械验证）_ **reduced-motion 下一切静止**：在 DevTools 里模拟 `prefers-reduced-motion: reduce` 后，`document.getAnimations().length` 为 0，且 `.reveal` 与 `.lift` 的 `transition-duration` 都是 `0s`。未门控的过渡不会让任何审计失败，只会让"reduced-motion 上一切静止"这句话变成假话。
- [ ] _（可机械验证）_ **无 emoji**、容器与主按钮上没有 `rounded-full`、没有 `uppercase tracking` 眉标。
- [ ] **在浏览器里把两个配色模式都看过一遍**（浅色与深色）。
- [ ] **每个禁用控件都能说出理由**，并且理由随状态变化，而不是一句通用的话。
- [ ] **动效有理由**：每个动画都能用一句话说明它为什么存在，并且 reduced-motion 之上的一切都能降级为静止。
- [ ] **多列布局都声明了窄屏回退**，并且在 360 / 390 / 768 / 1024 四个宽度各看过一遍：没有横向溢出，没有小于 44px 的可点控件。`.touch-target` 的控件这一条是**可机械验证的**：`pnpm --filter @toolbox/web touch-targets`（四个宽度 × 两套配色，任一轴探不到 43 就退出码 1）；主要动作按钮的 `size="md"` 是 **42px**，那是 `apps/web/docs/design/components.md` 里写明的例外，不算 44px 达标。
- [ ] **行为那一半不再手过**：真鼠标点格式行（方框/文字/文字下缘三处）、一次转换出五种格式并逐个解码回来、下载真的落盘且文件头是它名字声明的格式、零外发请求与零 console 报错——这四件已经在 CI 上每次改动跑一遍（`pnpm e2e`）。仍要手过的是这份单子里剩下的部分：键盘与拖拽、缩略图的顺序与长任务、ZIP、超限与坏文件、取消。**几何与两套配色的对照不在门禁里**——那是量具的活；门禁只读像素通道值（透明那一半是否还是透明、压平那一半是否纯白），那是别人文件里的像素，与界面配色不是一回事。
- [ ] **没有编造内容**：没有占位数据、没有伪造图片、没有假名字。
- [ ] **文案重读一遍**，确认不是"人不会这么写"的句子。
