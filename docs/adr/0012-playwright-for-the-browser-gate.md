# Playwright for the browser gate

CI had never run a browser when this was decided. Everything this site has learned about how it behaves — a `transition` that was not gated behind reduced-motion, the 44px overlay a Mantine `Button` clipped with `overflow: hidden`, the format row whose clicks went to an element that handles none — came from a one-off CDP script run by hand against `pnpm build && pnpm start`, and none of it could stop the next pull request. `pnpm e2e` is that half of the pre-flight checklist as a gate: `@playwright/test` in `apps/web`, `apps/web/e2e/`, against the production build, started by Turborepo (`e2e` depends on `build`) and run by CI.

The two instruments do not move. `ui-fingerprint.mjs` and `touch-targets.mjs` measure geometry and computed style: the same page twice, on one machine, where "before" is a file a person saved. That is not a test case and no runner makes it one. _Update 2026-09-30: the hit-area instrument has since moved into CI, where its exit code can stop a build; it is still not a test case — see the update section at the end._ The seam:

- **an instrument measures** — is anything under 44px, did anything move;
- **the gate asserts** — did the click do what it looked like it would do.

A claim about how something is drawn belongs in `scripts/`; a claim about what it does belongs in `e2e/`. When it could be either, `scripts/` wins, because a claim about drawing wants the pixels rather than an expectation.

## Consequences

- **Two browsers, each named.** The gate runs the Chrome for Testing that `@playwright/test` pins — asked for by name (`channel: "chromium"`) so it is that build and not the headless shell — and it happens to be 153, the same engine major the instruments were last measured on, in the same headless mode: Playwright passes `--headless`, an instrument's own shell passes `--headless=new`, and Chrome 153 treats the two as one. The instruments keep running whatever Chrome is on the machine. Only the gate's is pinned by a lockfile, and when this was decided only the gate's ran in CI, so "red locally, green in CI" has one more explanation to rule out first. _Update 2026-09-30: the hit-area instrument runs there too — see the update section at the end._
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

## Update — 2026-09-30: the threshold instrument moves into CI

The seam above stands, and one of the two instruments has crossed the "runs locally" half of it. `touch-targets.mjs` was found red on the cover generator's page since #54 — 406 failures: 938px of horizontal overflow at 360px, and every icon result row declaring a 44px target with a 1px hit area. Nothing had said so, because nothing ran it, and the five days are what the arrangement above costs: **a threshold nobody runs is not a check.**

What moved is only who hands it a browser and a server:

- **The measurement code is unchanged.** Still `node:` plus CDP, still `elementFromPoint` walked out from each control's centre, still numbers printed. It measures; it asserts nothing about behaviour, and it is still not a test case. Its exit code is 1 when a hit area probes under 43, when a control the page says it must carry is missing, or on horizontal overflow — the threshold was always there, the names arrived with #81.
- **CI gains one step** (`Hit areas` in `.github/workflows/ci.yml`, after the gate, on the build the gate already drove). It starts `next start` and launches the Chrome for Testing that `@playwright/test` pins, so the two tiers keep reading the same engine major in the same headless mode (this step's shell passes `--headless=new`; Playwright passes `--headless`; Chrome 153 treats them as one).
- **`ui-fingerprint.mjs` does not move, and cannot.** Its "before" is a file a person saved on the same machine; CI has nothing to compare against, and committing a baseline would redefine "nothing moved" as "nothing moved since that file" — the option rejected below.

The rejected option below ("let CI launch Chrome itself") is not this one: that was about not having a gate at all and having CI improvise one around throwaway scripts. Here the instrument already existed and already printed numbers; CI only supplies what a person used to supply by hand.

**Where each tier runs**, in one place, because it used to take four documents to assemble: **the gate and the hit-area instrument run in CI** — every push to `main` and every pull request, in `.github/workflows/ci.yml`, against the build CI just made — and **`ui-fingerprint.mjs` runs only on a machine a person is sitting at**, because its "before" is a file that person saved there and CI has nothing to compare against. Neither of the first two is a local prerequisite for pushing: locally each wants a server and a Chrome that someone started, which is the part that differs per machine, so `apps/web/docs/adding-a-tool.md` asks for the other six checks before a push and leaves these two to CI.
