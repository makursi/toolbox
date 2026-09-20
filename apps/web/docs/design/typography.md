# 字体与排版

> **管什么**：字体栈、字号层级、行高，以及中文字体怎么回退。**和它一起读**：`apps/web/docs/design/copy.md`（中文排版与标点）。

正文与界面统一用 **Geist Sans**，代码与数字用 **Geist Mono**，两者都由 `next/font` 在**构建期**下载并自托管，因此不会在运行时产生第三方请求。

**刻意不用衬线体**。当时"高级感"最顺手的做法是给大标题配一支编辑风衬线，被否掉了：它会推翻一个已经定过的选择，还要为一种 brief 并未要求的气质多带一个字体文件。层级靠**字重与颜色**承载，而不是靠一味放大字号——这也是"一个单词的标题不会看起来像海报"的原因。

行高由 token 控制（`--mantine-line-height`，当前 `1.7`：中文比拉丁文需要更松的行距）。

**中文字体的处理方式**：Geist **没有中文字形**，所以字体栈里排在它后面的是各个系统自带的 CJK 字体：

```
var(--font-geist-sans), 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', system-ui, sans-serif
```

拉丁字符用 Geist，中文逐字回退到系统字体（macOS 上 PingFang、Windows 上雅黑、Linux 上 Noto）。**不下载任何字体文件**。代价是不同系统下中文观感略有差异；如果要跨平台完全一致，得用 `next/font` 自托管一套中文字体（构建期下载、自托管，不违反 CSP，但要付出数 MB 体积），这仍然是一个可以选择的方向。
