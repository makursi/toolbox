<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

`toolbox` is a pnpm + Turborepo monorepo. Its single deployable is `apps/web`, a Next.js site made of single-purpose browser tools.

## Commands

| Command             | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `pnpm dev`          | run the site via `turbo run dev`            |
| `pnpm start`        | serve the production build                  |
| `pnpm build`        | production build                            |
| `pnpm lint`         | `oxlint --type-aware` per package           |
| `pnpm lint:fix`     | same, with `--fix`                          |
| `pnpm typecheck`    | `tsc --noEmit` per package                  |
| `pnpm test`         | run Vitest via `turbo run test`             |
| `pnpm e2e`          | the browser gate below, via `turbo run e2e` |
| `pnpm fmt`          | format the repo with Oxfmt                  |
| `pnpm check:readme` | check the two READMEs against each other    |

One thing that is not a `turbo` task because CI cannot run it: `pnpm --filter @toolbox/web fingerprint capture|compare` (`apps/web/scripts/ui-fingerprint.mjs`) snapshots both pages at five widths in both colour schemes and diffs two snapshots — the check that says a refactor moved code without moving anything on screen. Its sibling `pnpm --filter @toolbox/web touch-targets` (`apps/web/scripts/touch-targets.mjs`) is the other instrument: it measures every `.touch-target` control's hit area at four widths in both colour schemes and fails under 43 as it measures — 44 within the probe's resolution, since a 44px span holds 43 interior sample points — which is the claim in `apps/web/docs/design/components.md`. The usage of both, including the Chrome they need already running, is in each script's header comment.

`pnpm e2e` is the other half, and it **is** a `turbo` task: `@playwright/test` against `pnpm build && pnpm start`, in `apps/web/e2e/`, depending on `build` and never on `dev` (the dev server holds hydration back, so a green run against it would mean nothing). It needs its browser once per machine — `pnpm --filter @toolbox/web exec playwright install chromium`, ~200MB, which `pnpm install` deliberately does not do; on a slow link `PLAYWRIGHT_DOWNLOAD_HOST=https://cdn.npmmirror.com/binaries/playwright` turned ten minutes into one here. The seam between the gate and the two instruments is the subject of `docs/adr/0012-playwright-for-the-browser-gate.md`: **an instrument measures, the gate asserts.**

## Layout

- `apps/web` — the only App, arranged the way Next.js documents for a project that uses `src` (see “Project structure and organization” in the installed `next` package's docs). `src/app` is the routing tree plus this project's own site-level files there (`globals.css`, `theme.ts`, `providers.tsx`, and the tests for the icon check).
- The rest of `src` is ours, and the rule for it is **who owns it**: code a route or a Tool owns lives with it — a Tool's whole implementation is `src/tools/<slug>/` (`core/` pure and tested, `worker/`, `hooks/`, `meta.ts`, `README.md`), and the Tool Registry is `src/tools/registry.ts` with its `ToolMeta` in `src/tools/types.ts`; code no single route owns goes to `src/components/<name>/<name>.tsx`, `src/hooks/<name>/<name>.ts`, or `src/lib/` for helpers that are not UI.
- Directory name equals file name, kebab-case, and no barrel files: every import names the file it wants.
- **Ownership is the threshold here, not the number of consumers.** The one that counts consumers is `packages/*`, and it is unchanged: a second consumer is when something becomes a Package.
- `packages/tsconfig` — the only Package: shared TypeScript config, no runtime code.
- **A runner's config sits at the package root; the code it configures lives in the directory it names.** `apps/web/playwright.config.ts` configures `apps/web/e2e/`, `apps/web/vitest.config.ts` configures the `__tests__/` directories under `src/`. Which tier a browser check belongs to is a rule of its own, in Conventions below.
- **Docs are repo-level or App-level by the ownership rule above.** At the root: `docs/adr/` — decisions worth not re-litigating — `docs/agents/` — how agents file issues and read these docs — and `CONTEXT.md`, the vocabulary. Inside the App: `apps/web/docs/design.md` — the entry to the design doc set, with one module per rule area under `apps/web/docs/design/` — and `apps/web/docs/adding-a-tool.md` — the contract for the thing this repo does most: what a Tool has to pass, which files it touches, where its code lives, and the order the work happens in.

## Conventions

- **Root scripts only delegate.** Root `package.json` runs `turbo run <task>`; the actual task commands live in each package. Never put task logic in the root. The exception is repo-level tooling that belongs to no package: `fmt` and `fmt:check` run Oxfmt across the whole repository and `check:readme` runs `scripts/check-readme-parity.mjs` across its two READMEs — neither has a package to live in, and neither gains parallelism or caching as a task.
- **A Tool is not a Package.** No `packages/<tool-name>`. Shared code moves to `packages/*` when a second consumer reuses it, and Tool metadata lives beside its implementation.
- **Toolchain is Oxlint + Oxfmt.** There is no ESLint, Prettier or Biome anywhere; do not add configuration for them. Lint config is a root baseline (`.oxlintrc.json`) plus small per-package files that `extends` it — only `rules`, `plugins` and `overrides` are inheritable, so `env`, `settings` and `ignorePatterns` stay per package.
- **Type-aware linting runs from package scripts** (`oxlint --type-aware`), never from `lint-staged`, which runs only `oxfmt` and a non-type-aware `oxlint --fix` on staged files.
- **Types are checked by `tsc`**, not by Oxlint's `--type-check` (still experimental).
- **Tests are Vitest unit tests in a `__tests__` directory beside the code they cover, named `*.test.ts`.** They run in a Node environment with no Next or DOM, and `@/*` resolves through `apps/web/vitest.config.ts`; see `docs/adr/0003-vitest-for-unit-tests.md`. `vite` is a required peer of `vitest`, so the two are versioned together in the catalog.
- **Browser checks split by what they claim, not by tool.** An **instrument** (`apps/web/scripts/`, `node:` plus CDP, connecting to a Chrome you started) measures the rendered page and prints numbers — geometry, computed style, whether anything moved. A **gate** (`apps/web/e2e/`, `@playwright/test`) asserts what the site does and blocks a PR, on every change, against the production build. A claim about how something is drawn goes in `scripts/`; a claim about what it does goes in `e2e/`; when it could be either, `scripts/` wins, because geometry wants pixels rather than an expectation. Both words are defined in `CONTEXT.md` and the reasoning is in `docs/adr/0012-playwright-for-the-browser-gate.md`.
- **CI is `fmt:check` + `check:readme` + `lint` + `typecheck` + `test` + `build` + `e2e`.** `.github/workflows/ci.yml` runs all seven on every push to `main` and every pull request, so work is not finished until `pnpm fmt:check` passes too — the pre-push hook only runs `lint` and `typecheck`.
- **The README is one document in two languages.** `README.md` is the English original and the one GitHub shows; `README.zh-CN.md` is its Chinese translation. `pnpm check:readme` (`scripts/check-readme-parity.mjs`) compares the heading structure, every language-tagged code block verbatim, and the links and inline code spans — the parts a translation has no licence to change — because a translation that quietly stops tracking the original is invisible in review.
- **Server-only values** such as `SITE_URL` are read in server components and route metadata, never inlined into client code. `SITE_URL` is declared in the build task's `env` _and_ `.env*` is in its `inputs`, so a changed `.env.local` cannot be served a cached build with a stale origin.
- **Catalog versions.** The catalog holds versions shared by more than one package plus the repo toolchain; single-consumer dependencies use literal ranges in their own `package.json`. `typescript` and `oxlint-tsgolint` are pinned exactly because tsgolint tracks one TypeScript release.
- Commits are English, conventional commits.
- **UI work follows the design doc set.** Start at `apps/web/docs/design.md`: the invariants that must never be missed, the directions already rejected, and the table from "what you are touching" to the file that owns the rule. Change the file that owns the rule, run `apps/web/docs/design/checklist.md` before merging, and update the owning file in the same commit as the change. The visual language comes from the `minimalist-ui` protocol, the gates from `design-taste-frontend`.
- **Nothing is loaded from a third party.** The CSP in `apps/web/next.config.ts` allows `img-src 'self'` and `font-src 'self'`, so images, fonts and icons are all self-hosted or built at build time. See `docs/adr/0005-no-outbound-requests.md`.

## Gotchas

Traps that cost an hour to find the first time and that no check can see.

- **Verify UI against the production build** (`pnpm build && pnpm start`), because `next dev` holds back hydration until its HMR origin is accepted, so the page renders and then ignores every click. `apps/web/docs/design/log.md` carries the method, the evidence and what is still unverified.
- **A fixture that measures size has to be incompressible.** An index multiplied by a constant is periodic and compresses to nothing — a 3000×3000 "noise" PNG came out at 206 KB — so quality and file-size assertions pass on an image that has neither. Print the fixture's own size before trusting the measurement.
- **Wait for a state transition, not for an absence.** Polling for a transient control to disappear succeeds before React has rendered it at all, which reads as an empty result. Wait for the control to go disabled and then enabled again.
- **`next build` rewrites `apps/web/CLAUDE.md`**, the agent-rules block Next re-adds itself. Run `pnpm fmt` after a build so the tree reads clean.
- **A build that dies spawning a worker** — `node process exited before we could connect`, exit code `0xc0000142` — is a Turbopack flake on this machine. Retry once before treating it as a regression.
- **Build large fixtures in a page that is not the one under test.** Generating a 13.7 MB PNG and then uploading it from that same page wedged the renderer twice; a fresh page took the same file in 9 ms. The mechanism is unknown, so the habit is the rule: build in one page, upload in another.
- **A control can pass keyboard QA and be dead to the mouse.** Mantine's `Checkbox` and `Switch` put the toggle on the inner `<input>` and its `<label for>`; the root `<div>` in between handles nothing. An overlay on that root (`.touch-target`, the 44px hit area) covers the control and takes every pointer click without passing it on, because a pseudo-element's clicks belong to the element it is generated on. A key never hits a pseudo-element, so the keyboard kept working and the bug survived a QA round that used Space. Put the class on the element that owns the click, or stretch the `<label>` across the row — `.format-row` in `globals.css`. The gate in `e2e/interaction.spec.ts` presses at coordinates for exactly this reason, and it has been watched fail on this bug.
- **`page.mouse.click` drops coordinates outside the viewport without a word.** `boundingBox()` is viewport-relative and does not scroll, so a row measured below the fold produces a click that lands nowhere — which reads as a missing handler rather than a missing scroll. Measure _after_ `scrollIntoViewIfNeeded()`, and assert the point is inside `page.viewportSize()` so the failure is loud (`e2e/tool-page.ts`).
- **`pnpm start -- -p 3111` does not work under pnpm 12**: the `--` reaches `next`, which reads `-p` as a project directory and exits. Write `pnpm start -p 3111`, or `pnpm exec next start -p 3111` when the command is generated rather than typed.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues, driven by the `gh` CLI (it infers the repo from `git remote`). See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles map 1:1 to `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at the repo root plus `docs/adr/`. See `docs/agents/domain.md`.
