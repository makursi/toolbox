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

The leftover flow items (transparency, filename input, pixel cap, styles, backgrounds, fonts) arrive with the slices that build them, and the gate spec that re-runs the whole flow arrives with #61. Until then, the design decisions live in `rules.md` and the spec in issue #50 (tickets #51–#61).

**引擎实验（#55 / #57，待执行）**：SnapDOM 的 `blob:` 背景图抓取、以及 `FontFace(ArrayBuffer)` 注册的字体进 SVG-as-image 序列化后在 `font-src 'self'` 下的行为——两条都要对着 `pnpm build && pnpm start` 的生产构建跑，结论与证据记在这里和 `apps/web/docs/design/log.md`。
