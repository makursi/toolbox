# Vitest for unit tests

Testing is `vitest run`, reached as `pnpm test` → `turbo run test` → the `test` script in `apps/web`. Vitest reuses Vite's transform pipeline, so a test resolves modules exactly the way the app does: TypeScript with no extra step, and the `@/*` alias from `tsconfig.json` via the `resolve.alias` block in `apps/web/vitest.config.ts`. Tests run in a Node environment and cover Tool logic and shared helpers — that is also why Tool logic lives in `src/tools/*` rather than inside a route file.

The price is weight: Vitest brings Vite (and with it Rolldown's native binaries) into the dev dependency tree, and `vite` is a _required_ peer rather than a bundled one, so it is declared and catalogued alongside `vitest`.

## Consequences

- `vite` and `vitest` move together in the catalog: a Vitest upgrade can raise the Vite floor, and nothing else in the repo depends on Vite.
- What is testable is what is pure. Component, DOM and routing tests are out of scope until a Tool actually needs them, and would mean adding a DOM environment (`jsdom` or `happy-dom`) plus a testing library in the same package.
- A test file must be named `*.test.ts` under `apps/web/src` and lives in a `__tests__` directory beside the module it covers; `test.include` is scoped there so build output in `.next` is never collected. Not everything covered is behaviour: `registry.test.ts` guards the shape of the Tool Registry's data, and `icons.test.ts` reads the source for icon class names, because that is where the toolchain is blind — a name the icon plugin cannot resolve logs a warning and emits no CSS, and a name assembled at runtime is never looked at in the first place.
- Type-aware linting and `tsc --noEmit` cover test files too, so `describe`/`it`/`expect` are imported explicitly from `vitest` rather than injected as globals — no ambient types to declare.

## Considered Options

- **Node's built-in `node:test`**: rejected — zero dependencies, but Node does not read `tsconfig.json`, so the `@/*` imports used throughout the app would need a custom loader, and the suite would diverge from the transform the app is built with.
- **Playwright / a browser runner**: rejected — the wrong layer for pure Tool logic, and it would not make `pnpm test` a fast local loop. The browser layer did get a runner later, as a separate task with its own budget (`pnpm e2e`, ADR 0012); this decision is about `pnpm test` and still stands.
- **No test runner until a Tool needs one**: rejected — this was the state before, and `pnpm test` silently succeeding while running nothing is worse than either choice.
