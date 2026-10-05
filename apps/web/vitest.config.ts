import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Unit tests for Tool logic, shared helpers, and the pure parts of the browser
 * instruments — in a Node environment, no Next runtime, no DOM. A Tool that
 * needs browser APIs is tested through its pure parts; see
 * `docs/adr/0003-vitest-for-unit-tests.md`.
 *
 * Tests live in a `__tests__` directory beside what they cover, and keep the
 * `*.test.ts` name, so the globs below find them wherever that directory is.
 * `scripts/` is here for one seam only: the shared connection layer's
 * classification of a single CDP response, which is pure and needs no socket,
 * no browser and no dependency to pin down (see issue #104).
 */
export default defineConfig({
  resolve: {
    // Mirrors the `@/*` mapping in tsconfig.json, which Vite does not read.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Scoped rather than the default glob so build output in `.next` is
    // never collected.
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
