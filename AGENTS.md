<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

`toolbox` is a pnpm + Turborepo monorepo. Its single deployable is `apps/web`, a Next.js site made of single-purpose browser tools.

## Commands

| Command          | Purpose                           |
| ---------------- | --------------------------------- |
| `pnpm dev`       | run the site via `turbo run dev`  |
| `pnpm build`     | production build                  |
| `pnpm lint`      | `oxlint --type-aware` per package |
| `pnpm lint:fix`  | same, with `--fix`                |
| `pnpm typecheck` | `tsc --noEmit` per package        |
| `pnpm test`      | run Vitest via `turbo run test`   |
| `pnpm fmt`       | format the repo with Oxfmt        |

## Layout

- `apps/web` — the only App, and this is the arrangement Next.js documents for a project that uses `src` (see “Project structure and organization” in the installed `next` package's docs). `src/app` is the routing tree and the file conventions that go with it (`layout`, `page`, `not-found`, `robots`, `sitemap`, `globals.css`, `theme.ts`); everything else in `src` is ours: `components/<name>/<name>.tsx` for UI more than one route uses, `hooks/<name>/<name>.ts` for hooks that outlive one Tool, `lib/` for non-UI helpers, and `tools/<slug>/` for a Tool's whole implementation — `core/` (pure and tested), `worker/`, `hooks/`, plus its `meta.ts` and `README.md`.
- Directory name equals file name, kebab-case, and no barrel files: every import names the file it wants.
- `packages/tsconfig` — the only Package: shared TypeScript config, no runtime code.
- `docs/adr` — decisions worth not re-litigating, and `CONTEXT.md` — the vocabulary.

## Conventions

- **Root scripts only delegate.** Root `package.json` runs `turbo run <task>`; the actual task commands live in each package. Never put task logic in the root. The one exception is repo-level tooling that belongs to no package: `fmt` and `fmt:check` run Oxfmt across the whole repository, which has no parallel or caching benefit as a task.
- **A Tool is not a Package.** No `packages/<tool-name>`. Shared code moves to `packages/*` when a second consumer reuses it, and Tool metadata lives beside its implementation.
- **Toolchain is Oxlint + Oxfmt.** There is no ESLint, Prettier or Biome anywhere; do not add configuration for them. Lint config is a root baseline (`.oxlintrc.json`) plus small per-package files that `extends` it — only `rules`, `plugins` and `overrides` are inheritable, so `env`, `settings` and `ignorePatterns` stay per package.
- **Type-aware linting runs from package scripts** (`oxlint --type-aware`), never from `lint-staged`, which runs only `oxfmt` and a non-type-aware `oxlint --fix` on staged files.
- **Types are checked by `tsc`**, not by Oxlint's `--type-check` (still experimental).
- **Tests are Vitest unit tests in a `__tests__` directory beside the code they cover, named `*.test.ts`.** They run in a Node environment with no Next or DOM, and `@/*` resolves through `apps/web/vitest.config.ts`; see `docs/adr/0003-vitest-for-unit-tests.md`. `vite` is a required peer of `vitest`, so the two are versioned together in the catalog.
- **CI is `fmt:check` + `lint` + `typecheck` + `test` + `build`.** `.github/workflows/ci.yml` runs all five on every push to `main` and every pull request, so work is not finished until `pnpm fmt:check` passes too — the pre-push hook only runs `lint` and `typecheck`.
- **Server-only values** such as `SITE_URL` are read in server components and route metadata, never inlined into client code. `SITE_URL` is declared in the build task's `env` _and_ `.env*` is in its `inputs`, so a changed `.env.local` cannot be served a cached build with a stale origin.
- **Catalog versions.** The catalog holds versions shared by more than one package plus the repo toolchain; single-consumer dependencies use literal ranges in their own `package.json`. `typescript` and `oxlint-tsgolint` are pinned exactly because tsgolint tracks one TypeScript release.
- Commits are English, conventional commits.
- **UI work follows `docs/design.md`.** It holds the tokens, the rules that are not up for re-litigation, and the pre-flight checklist; update it in the same commit as the change. The visual language comes from the `minimalist-ui` protocol, the gates from `design-taste-frontend`.
- **Nothing is loaded from a third party.** The CSP in `apps/web/next.config.ts` allows `img-src 'self'` and `font-src 'self'`, so images, fonts and icons are all self-hosted or built at build time. See `docs/adr/0005-no-outbound-requests.md`.

## Gotchas

Traps that cost an hour to find the first time and that no check can see.

- **Verify UI against the production build** (`pnpm build && pnpm start`), because `next dev` holds back hydration until its HMR origin is accepted, so the page renders and then ignores every click. `docs/design.md` section 11 carries the method, the evidence and what is still unverified.
- **A fixture that measures size has to be incompressible.** An index multiplied by a constant is periodic and compresses to nothing — a 3000×3000 "noise" PNG came out at 206 KB — so quality and file-size assertions pass on an image that has neither. Print the fixture's own size before trusting the measurement.
- **Wait for a state transition, not for an absence.** Polling for a transient control to disappear succeeds before React has rendered it at all, which reads as an empty result. Wait for the control to go disabled and then enabled again.
- **`next build` rewrites `apps/web/CLAUDE.md`**, the agent-rules block Next re-adds itself. Run `pnpm fmt` after a build so the tree reads clean.
- **A build that dies spawning a worker** — `node process exited before we could connect`, exit code `0xc0000142` — is a Turbopack flake on this machine. Retry once before treating it as a regression.
- **Build large fixtures in a page that is not the one under test.** Generating a 13.7 MB PNG and then uploading it from that same page wedged the renderer twice; a fresh page took the same file in 9 ms. The mechanism is unknown, so the habit is the rule: build in one page, upload in another.
- **A control can pass keyboard QA and be dead to the mouse.** Mantine's `Checkbox` and `Switch` put the toggle on the inner `<input>` and its `<label for>`; the root `<div>` in between handles nothing. An overlay on that root (`.touch-target`, the 44px hit area) covers the control and takes every pointer click without passing it on, because a pseudo-element's clicks belong to the element it is generated on. A key never hits a pseudo-element, so the keyboard kept working and the bug survived a QA round that used Space. Put the class on the element that owns the click, or stretch the `<label>` across the row — `.format-row` in `globals.css`.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues, driven by the `gh` CLI (it infers the repo from `git remote`). See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles map 1:1 to `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at the repo root plus `docs/adr/`. See `docs/agents/domain.md`.
