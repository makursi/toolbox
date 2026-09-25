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

The compose → export flow's checklist items arrive with the slices that build them (#52 to #60), and the gate spec that re-runs the whole flow arrives with #61. Until then, the design decisions live in `rules.md` and the spec in issue #50 (tickets #51–#61).

**引擎实验（#55 / #57，待执行）**：SnapDOM 的 `blob:` 背景图抓取、以及 `FontFace(ArrayBuffer)` 注册的字体进 SVG-as-image 序列化后在 `font-src 'self'` 下的行为——两条都要对着 `pnpm build && pnpm start` 的生产构建跑，结论与证据记在这里和 `apps/web/docs/design/log.md`。
