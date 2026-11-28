#!/usr/bin/env node
/**
 * The CI chain, locally, in CI's order and in one command.
 *
 * Eight steps run on every pull request (`.github/workflows/ci.yml`), and until this
 * script existed a session rebuilt that chain by hand before each push — a different
 * subset each time, cheapest checks that were easy to forget (format, the docs
 * pointers) left out of the habit while the expensive ones were run twice. A round
 * that hand-assembles its gate can only be as consistent as its memory.
 *
 * The order is the gate's own: `fmt:check` first because it is five seconds and a
 * formatting slip should not wait behind a test run, then the document checks, then
 * lint, types and tests, then — with `--full` — the build and the browser gate.
 * Cheapest first means a push that fails does so early, and the output above the
 * failure is the whole diff's context.
 *
 *   pnpm gate          the seven checks that need no build: about fifteen seconds warm
 *   pnpm gate --full   adds `build` and `e2e` (the browser gate builds first anyway)
 *   pnpm gate --list   print the steps and stop
 *
 * What is deliberately absent: the hit-area instrument. It needs a server and a
 * Chrome, so it stays CI's step and the instruments' own sections
 * (`apps/web/docs/design/instruments.md#touch-targets`).
 *
 * A step that fails stops the run: the steps after it did not run, which is a
 * different sentence from "they passed", and the exit code is the step's own.
 */
import { spawn } from "node:child_process";

/** @type {[name: string, command: string][]} */
const FAST = [
  ["fmt:check", "pnpm fmt:check"],
  ["check:readme", "pnpm check:readme"],
  ["check:docs", "pnpm check:docs"],
  ["check:docs --falsify", "pnpm check:docs --falsify"],
  ["lint", "pnpm lint"],
  ["typecheck", "pnpm typecheck"],
  ["test", "pnpm test"],
];

/** @type {[name: string, command: string][]} */
const SLOW = [
  ["build", "pnpm build"],
  ["e2e", "pnpm e2e"],
];

const args = process.argv.slice(2);
const unknown = args.filter((arg) => arg !== "--full" && arg !== "--list");
if (unknown.length > 0) {
  console.error(`gate: unknown argument ${unknown.join(" ")} (expected --full or --list)`);
  process.exit(2);
}

const steps = args.includes("--full") ? [...FAST, ...SLOW] : FAST;

if (args.includes("--list")) {
  for (const [name, command] of steps) console.log(`${name}\t${command}`);
  process.exit(0);
}

/**
 * Runs one step with its output going straight to ours.
 * `inherit` is the point: a piped child is what a sandboxed run denies, and a step's
 * own output — the file, the line, the expectation — is more useful than a summary.
 *
 * @param {string} command
 * @returns {Promise<number>}
 */
function run(command) {
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, stdio: "inherit" });
    child.on("error", (error) => {
      console.error(`gate: could not start \`${command}\`: ${error.message}`);
      resolve(1);
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

const started = process.hrtime.bigint();
for (const [name, command] of steps) {
  console.log(`\n▶ ${name}`);
  const stepStarted = process.hrtime.bigint();
  const code = await run(command);
  const seconds = Number(process.hrtime.bigint() - stepStarted) / 1e9;
  if (code !== 0) {
    console.error(`\n✗ ${name} — exit ${code} after ${seconds.toFixed(1)}s`);
    console.error(`gate failed at ${name}; the steps after it did not run.`);
    process.exit(code);
  }
  console.log(`✓ ${name} (${seconds.toFixed(1)}s)`);
}

const seconds = Number(process.hrtime.bigint() - started) / 1e9;
console.log(`\n✓ gate passed — ${steps.length} steps in ${seconds.toFixed(1)}s`);
if (!args.includes("--full"))
  console.log("  (the build, the browser gate and the hit areas are CI's: `pnpm gate --full`)");
