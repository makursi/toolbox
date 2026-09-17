# Toolbox

A collection of single-purpose browser tools, each running entirely in your browser. One deployable, many tools.

## Prerequisites

- Node.js >= 22.12.0
- pnpm 12 (see `packageManager` in `package.json`)

## Quick start

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

## Structure

```
apps/web/     the App (Next.js App Router, Mantine, Tailwind CSS v4)
packages/     code shared between workspace packages
docs/adr/     decisions that are hard to reverse
docs/design.md  the UI: tokens, rules, and what is unfinished
CONTEXT.md    the vocabulary: Tool, Package, App, Tool Registry
```

## Commands

| Command          | Purpose                      |
| ---------------- | ---------------------------- |
| `pnpm dev`       | run apps/web                 |
| `pnpm build`     | production build             |
| `pnpm lint`      | Oxlint, type-aware           |
| `pnpm typecheck` | `tsc --noEmit`               |
| `pnpm fmt`       | format everything with Oxfmt |
| `pnpm fmt:check` | verify formatting (CI)       |
| `pnpm test`      | Vitest unit tests            |

## CI

`.github/workflows/ci.yml` runs `fmt:check`, `lint`, `typecheck`, `test` and `build` on every push to `main` and every pull request. The pre-push hook covers only `lint` and `typecheck`.

## Adding a tool

1. `apps/web/src/tools/<slug>/` — the implementation plus a `meta.ts` exporting its `ToolMeta`.
2. `apps/web/src/app/tools/<slug>/page.tsx` — the route: a thin adapter that renders the tool.
3. `apps/web/src/tools/registry.ts` — add the Tool to the Tool Registry.

Tool logic stays in `src/tools/*` so it is testable without Next and can be moved to `packages/*` later, once a second consumer actually needs it.

Tests live in a `__tests__` directory beside the code they cover, named `<file>.test.ts`. `pnpm test` runs them in Vitest's Node environment, with `@/*` resolving — see `docs/adr/0003-vitest-for-unit-tests.md`.

## Constraints

Every Tool runs in the browser and the site makes **no outbound requests** after a page has loaded: no analytics, no telemetry, no error reporting, no third-party hosts. This is enforced by a `Content-Security-Policy` header, not by convention — see `docs/adr/0005-no-outbound-requests.md`.

## Design

`docs/design.md` is the single source of truth for how the App looks: the tokens, the rules, the pre-flight checklist to run before merging UI work, and what is still unfinished. Read it before changing anything visual, and update it in the same change — a design document that disagrees with the code is worse than none.

## Assets

`apps/web/public/` holds the site's own images. There are no third-party asset hosts: the CSP in `apps/web/next.config.ts` allows `img-src 'self'` and `font-src 'self'` only, so every image is served from this origin — see `docs/adr/0005-no-outbound-requests.md`.

The site mark is the wordmark's first letter, drawn as a geometric `T` on an ink tile. The header's `Toolbox` text _is_ the logo, not a stand-in for one, so the icon is derived from it rather than invented beside it:

| Asset            | Path                                        | Wired up by                                                                     |
| ---------------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| Site mark        | `apps/web/src/app/icon.svg`                 | Next's icon file convention; used by browser tabs, bookmarks and search results |
| Home screen icon | `apps/web/src/app/apple-icon.png` (180×180) | the same convention; used by iOS "add to home screen"                           |
| Tool cover       | `apps/web/public/tools/<slug>/cover.jpg`    | the Tool's card, via `cover` in that Tool's `meta.ts`                           |

Two things to know before editing the mark: its two colours are the design tokens written out literally (a favicon cannot read a stylesheet), and `apple-icon.png` is a hand export of the same geometry at 180×180 with no alpha channel, so both need redoing together with `theme.ts`.

A cover is two steps: drop the file at the path above, then set `cover: "/tools/<slug>/cover.jpg"` in `apps/web/src/tools/<slug>/meta.ts`. Until then the card is set in type rather than showing an invented placeholder graphic, and `registry.test.ts` checks that any declared cover is a same-origin image path.

Fonts are a different case: `next/font` downloads them at build time and serves them from this origin, so a webfont never becomes a third-party request at runtime.

## Environment

`SITE_URL` is the canonical origin, used by metadata, `robots.txt` and `sitemap.xml`. Copy `apps/web/.env.example`; it falls back to `http://localhost:3000`.
