<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

The rules for the repository — commands, branches, the Tool contract — are in the root `AGENTS.md`. What is here is only true inside this package.

## Where things live

```
apps/web/
├── src/                    the App: routes in src/app, Tools in src/tools
├── e2e/                    the gate: what the site does, with Playwright
├── scripts/                the instruments: what it draws, how big a hit area is (node + CDP)
├── docs/                   design.md (the entry) + design/ (one file per area), adding-a-tool.md
├── public/                 served as-is; Next.js requires it at the package root
├── assets/                 not served: the brand exports, and inbox/ for cover candidates
├── next.config.ts          the App's config
├── vitest.config.ts        the unit tests' config
└── playwright.config.ts    the gate's config
```

**Where each of these goes is the root `AGENTS.md`'s rule** — a runner's config at the package root, the code it configures in the directory it names — and the tree above is what that rule produces inside `apps/web`. Repository-level rules get named in this file, never restated: two copies of a sentence drift apart.

**Every documentation path is written from the repository root** — `apps/web/docs/design.md`, `docs/adr/0005-no-outbound-requests.md`, `docs/agents/domain.md` — and never as a bare `docs/…`: inside this package, `docs/` on its own would mean the App's own.

## The two tiers of browser check, and their names

`e2e/` is the **gate**: `@playwright/test`, the production build, every pull request. It asserts what the site _does_ — a real pointer landing on the control it looks like it landed on, a file going in and coming back out as a valid file, no request off this origin.

`scripts/` is the **instruments**: `node` plus CDP, printing numbers. `ui-fingerprint.mjs` says whether anything moved between two snapshots, against a Chrome you started; `touch-targets.mjs` says how big a hit area really is, whether the controls and regions each page declares are there and still carry the hit-area class, and whether anything on a page still carries the outgoing layer's class names — and **also runs in CI** (the Hit areas step), where it exits 1 on: a hit area under 43, a declaration that matches nothing (a page's controls, carriers, panels or scan regions), a control that lost the hit-area class, a panel another section owns or a section's own panel missing, horizontal overflow, a class name from the layer the site left (`no-outgoing-layer`), a page's own layout claims, or a claim that declares no way to go red. The claim registry in the script is the full list, and the same step runs the instrument's falsification mode, so every claim's injection is proved unattended (#109).

The directories are named for the tier, not for the tool, and neither is a `tests/`: the unit tests are already `__tests__/*.test.ts` beside the code they cover, so a third name would say nothing about which runner runs what. A claim about how something is _drawn_ goes in `scripts/`; a claim about what it _does_ goes in `e2e/`; when it could be either, `scripts/` wins — see `docs/adr/0012-playwright-for-the-browser-gate.md`, and each script's header comment for its usage, including the Chrome it needs already running.
