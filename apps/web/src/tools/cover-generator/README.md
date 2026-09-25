# Cover Generator

Composes a cover in the browser: two texts (left, right) around a centre icon on a background, at one of four ratios (1:1, 4:3, 16:9, 21:9), exported as a PNG. Nothing is uploaded — every asset the visitor brings is read with the File API and encoded in this tab, and the page makes no outbound request (ADR-0005).

The Tool is being built in vertical slices (#51–#61); this README is the map and the checklist, and it grows with each slice.

## Layout

```
CoverGenerator.tsx   the Tool's UI — the editor (arrives in slices from #52 on)
meta.ts              the Tool Registry entry
rules.md             this Tool's own rules — page structure, export surface, icon mechanism, the typography promise (ADR-0014)
README.md            this file: how it works, and what to check by hand
core/                pure, browser-free logic — the part `pnpm test` covers (arrives with #52)
hooks/               the Tool's React state (arrives with #52)
```

The threshold for sharing code is ownership, not the number of consumers — see the toolbox `AGENTS.md`; nothing here becomes a `packages/*` entry until a second consumer exists.

## How a run works

As of the tool-spine slice (#51): the page renders the ToolPage shell with the Tool's own title and description, and the composition canvas scaffold (a 16:9 frame with the ratio badge). Composing, styling and exporting arrive in the following slices: the state model and PNG export in #52, the editor layout in #53, the icon system in #54, backgrounds in #55–#56, fonts in #57–#58, styles in #59, and the export finish in #60. The rendering engine is SnapDOM (`@zumer/snapdom`) — two acceptance experiments (blob: backgrounds, data fonts under the CSP) are recorded here when run.

## What CI covers, and what is still yours

CI runs `fmt:check`, `check:readme`, `lint`, `typecheck`, `test`, `build` and `pnpm e2e`. Until the behaviour gate (#61) lands, the cover generator has no e2e spec of its own; the existing gate keeps running for the Image Converter and must stay green on every slice. The pure modules in `core/` (arriving from #52) are covered by `pnpm test`; everything browser-shaped is the checklist below.

The instruments already cover this page: `ui-fingerprint` and `touch-targets` gained the `/tools/cover-generator` route in `PAGES`. The fingerprint's previous snapshot is invalidated by design — a new baseline is captured with `pnpm --filter @toolbox/web fingerprint capture` when a slice changes the page, and `touch-targets` measures the page's hit areas at four widths in both schemes.

## Manual QA checklist

- [ ] The route renders the ToolPage shell with the Tool's own heading and description, and a 16:9 canvas frame with the ratio badge.
- [ ] The homepage shows the Tool as the second entry, in the grid (two columns from `sm` up; one cell is one Tool).
- [ ] The page makes no outbound request and prints nothing to the console (the gate's converter spec stays green).
- [ ] `touch-targets` measures 返回首页 and the header's colour-scheme switch at ≥44px at four widths in both schemes.

### Compose and export (#52, the composition tracer)

- [ ] Editing either text, the weight slider or the ratio updates the preview immediately.
- [ ] The badge shows the current ratio and its pixel size (e.g. `16:9 · 1280×720`).
- [ ] 「下载 16:9」 produces a PNG at the chosen ratio's pixel size (e.g. 1280×720), named by the rule (`16-9-示例文本.png`), and it opens in an image viewer.
- [ ] The preview and the export show the same composition (the export captures the same DOM at full size, off screen).
- [ ] The preview scales down without horizontal overflow at 360 / 390 / 768 / 1024.
- [ ] The flow leaves the page reachable by keyboard: the text inputs and the ratio control are focusable, and the download button is a real button.

### Editor layout (#53)

- [ ] Wide screens show the configuration column (内容 / 导出) beside the canvas.
- [ ] On a 390px screen the canvas pins to the top and the configuration column follows beneath it — one component tree with the order swapped, not a second layout.
- [ ] The accordion sections expand and collapse identically at every width; the 样式 section arrives with #59.
- [ ] The download button, 返回首页 and the header's colour-scheme switch all keep ≥44px hit areas.
- [ ] Tab and Enter reach the text inputs, the accordion controls, the ratio control and the download button.

### Icons (#54)

- [ ] 搜索图标 (e.g. `image`) surfaces lucide icons; picking one renders it in the preview and in the exported PNG, in the text colour (monochrome, no "original colour" switch).
- [ ] 上传图标 renders with its own colours in both preview and export.
- [ ] 显示图标 and 图标背景 switches change the composition and the export.
- [ ] The lucide chunk (~0.6 MB) loads from this origin; DevTools shows no outbound request and no console warnings on this page.

### Background (#56)

- [ ] 拖拽或点击上传背景图：出现在预览与导出 PNG 里（`blob:` 捕获已由实验 #55 验证）。
- [ ] 背景不透明度 0–100%（样式节）只作用于背景层，并随导出生效。
- [ ] 超过 10 MB 的背景图被拒，给出「这个背景图有 N MB，上限是 10 MB。」（copy 有单测）。

### Fonts (#58)

- [ ] 上传字体 renders in preview and export (per experiment #57).
- [ ] A font over 20 MB is refused with its size named; an unreadable font shows 「这个字体文件无法载入。」.
- [ ] 获取系统字体: where Local Font Access exists, picking a family applies it; elsewhere it shows 「此浏览器不支持读取系统字体。」 — a hint, not a dead control.
- [ ] The typography promise in the README and `rules.md` matches behaviour: the exported glyphs depend on the machine that drew them.

### Styles (#59)

- [ ] 字体大小 / 图标大小 / 图标圆角 / 间距 sliders change the preview and the export identically; 等比缩放 links them (pure `proportionalSizes`, unit-tested).
- [ ] 颜色同步 plus 文字 / 图标 / 背景 colours: with sync on the library icon follows the text colour; a colour the visitor picks lands in the exported pixels.
- [ ] 阴影 scope (全部 / 文字 / 图标 / 无) and colour render in both preview and export.

### Export finish (#60)

- [ ] 文件名 is pre-filled by the rule and editable, sanitized for the filesystem; 背景透明 exports alpha for PNG (and only PNG — the option says so).
- [ ] The largest export (21:9 → 2560×1080) matches the pixel cap constant (unit-tested); v1 has no scale multiplier.

The leftover flow items (gate coverage) arrive with #61. Until then, the design decisions live in `rules.md` and the spec in issue #50 (tickets #51–#61).

**引擎实验 #55（2026-09-22，通过，随后被 #61 门禁修正）**：`blob:` 背景图与 `blob:` 上传图标都能被 SnapDOM 捕获。方法：无头 Chrome（chromium-1243）里用 canvas 生成绿色 320×180 背景图与红色 64×64 图标（都是 `blob:` URL），SnapDOM 320×180 PNG 导出后读像素：中心 `[0,255,0,255]`、图标位 `[255,0,0,255]`、`warnings: []`。

**⚠️ 修正（#61 门禁首跑，2026-09-22）**：上面的实验跑在**无 CSP 的 about:blank** 上。在真实站点的 CSP（`connect-src 'self'`）下，SnapDOM 内联 `blob:` 图片时会对 blob: URL 发起 `fetch()`，被 CSP 拦下（console 连报 connect-src 违规，本工具门禁的"零 console 噪音"断言因此红了）。**结论反转**：站内 blob 背景图 / 上传图标要进导出，必须改走 `data:` URL（读文件用 `FileReader.readAsDataURL`），或给 SnapDOM 提供同源路径。另外 SnapDOM 对 inline/table-cell 文字发出一条 `reconcile` 警告（意思是布局可能按回退字形重排）——导出选项需加 `reconcile: true`。这两条是 #61 的剩余项。

**引擎实验 #57（2026-09-22，通过）**：`FontFace(ArrayBuffer)` 注册的字体在 SnapDOM 的 SVG-as-image 序列化下正常光栅化。方法：无头 Chrome 对着 `next start` 的**生产构建**（CSP `font-src 'self'` 生效），字节来自同源 `fetch()` 的页内字体，注册后画「字形甲乙」再导出 PNG：采样最暗像素 17（字形已绘制）、`warnings: []`、零 console 噪音（CSP 没拦）。结论：字体上传走 `File.arrayBuffer() → new FontFace → document.fonts.add` 即可，SnapDOM 的 `embedFonts` 会把它内联进文件。两条引擎实验（#55、#57）均已闭合。
