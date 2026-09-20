# Playwright for the browser gate

CI has never run a browser. Everything this site has learned about how it behaves — a `transition` that was not gated behind reduced-motion, the 44px overlay a Mantine `Button` clipped with `overflow: hidden`, the format row whose clicks went to an element that handles none — came from a one-off CDP script run by hand against `pnpm build && pnpm start`, and none of it could stop the next pull request. `pnpm e2e` is that half of the pre-flight checklist as a gate: `@playwright/test` in `apps/web`, `apps/web/e2e/`, against the production build, started by Turborepo (`e2e` depends on `build`) and run by CI.

The two instruments do not move. `ui-fingerprint.mjs` and `touch-targets.mjs` measure geometry and computed style: the same page twice, on one machine, where "before" is a file a person saved. That is not a test case and no runner makes it one. The seam:

- **an instrument measures** — is anything under 44px, did anything move;
- **the gate asserts** — did the click do what it looked like it would do.

A claim about how something is drawn belongs in `scripts/`; a claim about what it does belongs in `e2e/`. When it could be either, `scripts/` wins, because a claim about drawing wants the pixels rather than an expectation.

## Consequences

- **Two browsers, each named.** The gate runs the Chrome for Testing that `@playwright/test` pins — asked for by name (`channel: "chromium"`) so it is that build and not the headless shell — and it happens to be 153, the same engine major, in the same `--headless=new`, that the instruments were last measured on. The instruments keep running whatever Chrome is on the machine. Only the gate's is pinned by a lockfile, and only the gate's runs in CI, so "red locally, green in CI" has one more explanation to rule out first.
- **`pnpm install` does not download a browser.** `pnpm --filter @toolbox/web exec playwright install chromium` does, once per machine (~200MB), and the gate fails with Playwright's own message until it has.
- **CI gains a step and a cache keyed on the Playwright version.** A cold `playwright install` is the slowest part of the job; a cache key that does not track the version is worse than none, because it serves binaries the library no longer matches.
- **The gate never retries.** A retry that passes turns a flake into a green run and hides the one thing the gate is for. A failure keeps its trace instead.
- **`apps/web`'s dependency, not the repo's.** One consumer, so a literal range in that `package.json` rather than a catalog entry.
- **ADR 0003 stands.** It rejected Playwright for `pnpm test`, and this does not touch that: the gate is its own task, and `pnpm test` stays Node-only with no DOM.

## Considered Options

- **Keep the one-off scripts, and let CI launch Chrome itself**: rejected — it would work (the runner images ship Chrome), but it is the arrangement that produced nine rounds of re-written harnesses, and the cost of writing the next check is what kept them one-off.
- **`chrome-remote-interface`, for the transport alone**: rejected — it replaces the 67-line `cdp.mjs` and nothing else: no auto-waiting, no retries, no trace, no runner, and no CI.
- **The Playwright CLI plus its skill, installed globally and no dependency in the repo**: genuinely cheaper (nothing in the repo at all, and it would help in every other repo in the workspace), but it makes an agent better at writing a throwaway script; it does not make a check exist on every pull request. Worth adding later for the throwaway half — not as a substitute for this.
- **Porting the instruments into Playwright as well**: rejected — the measurement code would move unchanged, and the fingerprint's "before" is a saved file; turning it into a committed fixture would quietly redefine "nothing moved" as "nothing moved since that file".
