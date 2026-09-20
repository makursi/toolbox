import { defineConfig } from "@playwright/test";

/**
 * The browser gate: what the site *does*, driven through a real browser, against
 * the build that ships.
 *
 * It answers the half of the pre-flight checklist that is about behaviour — a
 * real click landing on the control it looks like it landed on, a file going in
 * and five files coming out that decode back, and a page that reaches nothing
 * off this origin. The other half is geometry and computed style (does anything
 * move, is anything under 44px) and stays in `scripts/` with the two
 * instruments: they measure the same page twice on one machine, which a test
 * runner cannot express and CI could not reproduce.
 *
 * The browser is the one this package pins (`@playwright/test`), not the Chrome
 * those instruments connect to. Playwright 1.63 pins Chrome for Testing 153 and
 * this config asks for it by name (`channel: "chromium"`) rather than for the
 * headless shell that `chromium` means by default: the instruments were measured
 * on Chrome 153 in `--headless=new`, and the two reading the same build in the
 * same mode is worth one explicit line. What the two still do not share is a
 * lockfile. Install it once with
 * `pnpm --filter @toolbox/web exec playwright install chromium`.
 */
const PORT = 3111;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,

  /*
   * No retries. A retry that passes turns a flake into a green run and hides the
   * one thing this gate is for — the repo has no other check that would notice,
   * and "it is flaky" is a finding, not an inconvenience to be papered over.
   * `trace` keeps the evidence for a failure without one.
   */
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"]],

  use: {
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },

  // AVIF encoding is the slow one and the batch runs in a Worker; a default 5s
  // would be a race against the machine rather than against the page.
  expect: { timeout: 15_000 },

  projects: [{ name: "chromium", use: { browserName: "chromium", channel: "chromium" } }],

  /*
   * The production build, never `next dev`: the dev server holds hydration back
   * until its HMR origin is accepted, so the page renders and then ignores every
   * click. A green run against it would mean nothing — see `apps/web/docs/design/log.md`
   * and the Gotchas in `AGENTS.md`.
   *
   * `pnpm e2e` gets its build from Turborepo (`dependsOn: ["build"]`); running
   * `playwright test` directly needs `.next` to be there already.
   */
  webServer: {
    /*
     * Not `pnpm start -- -p 3111`: under pnpm 12 the `--` reaches `next` and it
     * reads `-p` as a project directory. (`pnpm start -p 3111` also works; this
     * form is spelled out so the two scripts' headers can be corrected to match.)
     */
    command: `pnpm exec next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
