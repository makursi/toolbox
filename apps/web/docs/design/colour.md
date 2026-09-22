# 色彩 token 与明暗配色

> **管什么**：颜色的值（token）与模式（浅色 / 深色）怎么选、怎么存。**和它一起读**：`apps/web/docs/design/components.md`（配色开关与触控目标）、`apps/web/docs/design/assets.md`（唯一允许保留自己颜色的东西）。

## 值（token）

暖色单色（warm monochrome），定义在 `apps/web/src/app/theme.ts`。**没有强调色（accent color）**：界面上唯一的颜色只用来表达语义，也就是错误。

**一个例外，而且是明知的选择**：工具封面与**站点标记**都是外部素材（见 `apps/web/docs/design/assets.md`），保留它们自己的颜色，不进这套调色板、也不受"无强调色"约束；工具自己渲染的资源预览同理（先例：image-converter 文件行里的 40×40 缩略图，见它的 `design.md`），那些就是访客自己的图片像素。换句话说，界面本身仍然只有一个颜色在说话；封面、标记与缩略图是页面上的一幅图，不是界面的一部分。（标记把这条例外从"卡片里的配图"扩到了页头与浏览器标签，那是 2026-09-18 有意的扩大，理由见 `docs/adr/0011-the-mark-is-a-supplied-illustration.md`。）

| 用途                           | 浅色      | 深色      |
| ------------------------------ | --------- | --------- |
| 画布（body）                   | `#f7f6f3` | `#171614` |
| 表面（输入框、封面框）         | `#fbfaf8` | `#1f1e1c` |
| 正文                           | `#111111` | `#edebe8` |
| 次要文字（`c="dimmed"`）       | `#6b6862` | `#a5a19a` |
| 发丝线（`withBorder`、分隔线） | `#eaeaea` | `#313030` |
| 占位符                         | `#75726a` | `#9a968e` |

对比度是**算出来的，不是看出来的**：正文 17.47:1（浅）/ 15.20:1（深）；次要文字 5.14:1 / 6.48:1；占位符 4.61:1 / 5.65:1；主按钮实心填充两个模式都是 17.33:1。AA 对正文的要求是 4.5:1。

有**两次测量直接改变了设计**，而不是被记录成"已知问题"绕过去：参考方案建议的次要色 `#787774` 只有 4.14:1，被换掉了；第一版占位符颜色 `#8a877f` 只有 3.44:1，也被换掉了。**以后新增任何颜色，都要用同样的方式先测量**（见 `apps/web/docs/design/checklist.md`）。

**为什么 token 不写在样式表里**：它们是 Mantine 的 `createTheme` 加一个 `cssVariablesResolver`。Mantine 会在运行时把变量写到文档里，位置在我们的样式表之后——所以在 CSS 里直接覆盖 `--mantine-color-body` 会输掉层叠。resolver 是官方支持的路径，也是唯一稳赢的路径。

## 模式（明暗配色）

`ColorSchemeScript` 与 provider 都设为 `auto`：**默认跟随操作系统**。页头右侧有一个两态开关（`ThemeToggle`，`variant="default"`、`size="compact-sm"`、带 `.touch-target`），**只有图标**（浅色下是月亮、深色下是太阳），图标写的是**它将要切到的模式**。**一旦点过，就不再跟随系统**，直到清除站点数据——这是知情的取舍，见 `docs/adr/0008-manual-colour-scheme-switch.md`。

持久化由 Mantine 自带的 `localStorageColorSchemeManager` 完成（就是 provider 的默认值，没改一行配置），`ColorSchemeScript` 在首屏前读取它，所以没有闪白也没有 hydration 不匹配。

**名字由样式表切，不由 JS 状态切**：图标与 `sr-only` 的名字都按模式各备一份、都在 DOM 里，`[data-mantine-color-scheme]` 决定哪一份活着。服务端不可能知道系统配色，所以任何在渲染期读 scheme 的做法，要么 hydration 不匹配、要么先撒一句谎再自我纠正。也因此**它没有 `aria-label`**：写在组件里的 `aria-label` 是一个固定字符串，总有一种配色下会与实际显示的模式不符；而两份 `sr-only` 文字正好可以写成完整的句子（「切换到深色」），这是以前那个可见的词负担不起的。

任何 token 都必须**先补齐两个模式**才能上线。禁止纯 `#000000` 与纯 `#ffffff`：两者都撑不起层次；浅色画布之所以是暖白（bone），正是为了让白卡片能落在它上面。任何一"节"都不允许在页面中途翻转成反色主题。
