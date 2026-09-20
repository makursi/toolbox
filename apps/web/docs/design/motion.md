# 动效

> **管什么**：入场与悬停动效，以及 reduced-motion 门控。**和它一起读**：`apps/web/docs/design/components.md`（那条 200ms 的阴影提升定义在卡片上）。

只用 CSS，并且**动效与过渡都在** `@media (prefers-reduced-motion: no-preference)` 里：关掉动效的人仍然看得到悬停阴影，只是它立刻出现。

- **入场**：600ms、`cubic-bezier(0.16, 1, 0.3, 1)` 的上浮淡入（`translateY(12px)`），首页两个区块之间错开 80ms。
- **悬停**：`apps/web/docs/design/components.md` 里那条 200ms 的阴影提升，只对 `box-shadow` 做过渡。
- 它在**加载时**触发，不是滚动触发——因为首页只有两个区块且都在首屏内，装一个滚动观察器会是一套没有观察对象的机器。
- 永远不要用 `window.addEventListener('scroll')`。只动画 `transform` 与 `opacity`。**没有安装任何动效库**。
