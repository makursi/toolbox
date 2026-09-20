# Toolbox

[简体中文](./README.zh-CN.md)

A collection of single-purpose browser tools. Every Tool runs entirely in your browser: no account, and the files you give it stay on your device.

## Development

Node.js >= 22.12.0 and pnpm — the exact pnpm version is `packageManager` in `package.json`.

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

**Open the site at the host the dev server prints:** Next rejects every other hostname, and it holds back hydration until its HMR socket connects, so a page loaded from a hostname it does not allow renders and then ignores every click. `apps/web/next.config.ts` lists the hostnames this project allows — `127.0.0.1` and the `10/8` LAN range, so a phone can reach the dev server — and is where this machine's own address goes when it is on another network. Verify interactive work against the production build for the same reason:

```bash
pnpm build
pnpm start
```

## Commands

| Command             | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `pnpm dev`          | run the site                               |
| `pnpm build`        | production build                           |
| `pnpm start`        | serve the production build                 |
| `pnpm lint`         | Oxlint, type-aware                         |
| `pnpm typecheck`    | `tsc --noEmit`                             |
| `pnpm test`         | Vitest unit tests                          |
| `pnpm e2e`          | browser gate: Playwright, production build |
| `pnpm fmt`          | format the repository with Oxfmt           |
| `pnpm fmt:check`    | verify formatting                          |
| `pnpm check:readme` | check that the two READMEs still match     |

## Configuration

`SITE_URL` is the canonical origin, used by metadata, `robots.txt` and `sitemap.xml`. Copy `apps/web/.env.example`; it falls back to `http://localhost:3000`, so local development needs no configuration.

## Structure

```
apps/web/      the only deployable: Next.js App Router, Mantine, Tailwind CSS v4
  src/         the App itself: routes in src/app, Tools in src/tools
  e2e/         the gate: what the site does, with Playwright, on every pull request
  scripts/     the instruments: what it draws, and how big a hit area really is
  docs/        the App's own docs: design.md, adding-a-tool.md
packages/      code shared between workspace packages (today: tsconfig only)
docs/adr/      decisions that are hard to reverse
docs/agents/   how agents file issues and read these docs
CONTEXT.md     the vocabulary: Tool, Package, App, Tool Registry
```

An instrument measures and a gate asserts; `docs/adr/0012-playwright-for-the-browser-gate.md` draws the line between the two, and `CONTEXT.md` defines both words.

## Licence

There is no `LICENSE` file, so the code is all rights reserved by default.

The supplied art is not covered by the repository's licence at all: forking this repo does not grant the right to reuse the site mark (`apps/web/assets/brand/makursi.png` and its three exports) or the Tool cover. See [section 9 of `apps/web/docs/design.md`](apps/web/docs/design.md).
