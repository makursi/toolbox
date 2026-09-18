# Toolbox

A collection of single-purpose browser tools, each running entirely in your browser. One deployable, many tools.

The site itself is called **马库斯的大书箱** — that is the name in the header, in the page titles and on a shared link's card (`siteName` in `apps/web/src/lib/site.ts`). The project keeps its own name: the repository, the workspace packages (`@toolbox/*`) and this document are all still `toolbox`, and the site's name does not rename any of them.

## Prerequisites

- Node.js >= 22.12.0
- pnpm 12 (see `packageManager` in `package.json`)

## Quick start

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

**Open the site at the host the dev server prints.** Next's dev server rejects requests from other hostnames, and, less obviously, it holds back hydration until its HMR socket connects: a page loaded from a hostname it does not allow is served, renders, and then ignores every click, with one failed-websocket line in the console as the only clue. `apps/web/next.config.ts` lists the extra hostnames this project allows — `127.0.0.1` and the `10/8` LAN range, so a phone can reach the dev server. Add this machine's address there when it is on another network. The same reason is why interactive work is worth verifying against `pnpm build && pnpm start`: a production build has no HMR socket to wait for.

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

The mark is a supplied illustration of the site's namesake, and the header shows it beside the wordmark. It is not drawn from the wordmark, and it is not in the design's monochrome palette: both departures are recorded in `docs/adr/0011-the-mark-is-a-supplied-illustration.md`. Every file below is an export of one master:

| Asset            | Path                                                        | Wired up by                                                                                                                                 |
| ---------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Master           | `apps/web/assets/brand/makursi.png` (500×500, 190 KB)       | nothing: it is the supplied file byte for byte and what every export is made from, kept so a re-export does not need the art supplied again |
| Tab icon         | `apps/web/src/app/icon1.png` (32×32), `icon2.png` (128×128) | Next's icon file convention; used by browser tabs, bookmarks and search results                                                             |
| Header mark      | `apps/web/public/brand/makursi.png` (128×128)               | `SiteHeader`, rendered at 28px                                                                                                              |
| Home screen icon | `apps/web/src/app/apple-icon.png` (180×180)                 | the same convention; used by iOS "add to home screen"                                                                                       |
| Tool cover       | `apps/web/public/tools/<slug>/cover.jpg`                    | the Tool's card, via `cover` in that Tool's `meta.ts`                                                                                       |

Three things to know before touching the mark. The tab and header files are **the same crop exported twice**, because Next only looks for an app icon inside `src/app` — this is what the old `icon.svg` / `apple-icon.png` pair was, two hand exports of one drawing. The tab icon is a crop of the **head and shoulders** rather than the whole figure: at 16px the figure is a smudge, and the tighter crop is the only version that reads in a tab. And `apple-icon.png` has no alpha channel and a warm canvas background, because iOS renders transparency as black.

The art was supplied by the owner of the site and is **not covered by the repository's licence**: forking this repo does not grant the right to reuse it. The Tool cover is the same case, and the comment in its `meta.ts` says so where the next reader stands.

A cover is two steps: drop the file at the path above, then set `cover: "/tools/<slug>/cover.jpg"` in `apps/web/src/tools/<slug>/meta.ts`. Until then the card is set in type rather than showing an invented placeholder graphic, and `registry.test.ts` checks that any declared cover is a same-origin image path.

Fonts are a different case: `next/font` downloads them at build time and serves them from this origin, so a webfont never becomes a third-party request at runtime.

## Environment

`SITE_URL` is the canonical origin, used by metadata, `robots.txt` and `sitemap.xml`. Copy `apps/web/.env.example`; it falls back to `http://localhost:3000`.
