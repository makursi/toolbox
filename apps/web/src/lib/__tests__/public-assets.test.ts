import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { coverFrameRefusal } from "@/lib/cover-frame";
import { readImageSize } from "@/lib/image-header";
import { tools } from "@/tools/registry";

/**
 * Three ways an image can rot silently. None shows up in a type check, in
 * lint, or in the build's exit code, which is why this test reads the tree.
 *
 * **A file under `public/` that nothing names.** Next serves it forever: it
 * costs a deploy on every build, no page asks for it, and no reader of the
 * repository can tell whether it is deliberate or forgotten. The set this was
 * written for was three candidates left in the drop box by a choice already
 * made, which is why `apps/web/docs/design/assets.md` now says where a file
 * belongs and this says whether it is still wanted.
 *
 * **A `cover` that names a file which is not there.** `registry.test.ts` checks
 * that the string *looks* like a same-origin image path; it would pass on
 * `cover.jpg` with one letter wrong, and the card would render an empty frame
 * rather than a missing image. This is the other end of that assertion.
 *
 * **A `cover` that exists but is too small for the card's frame.** The card
 * reserves a 4:3 frame and crops the cover into it, so a 100×100 thumbnail
 * passes every path check and renders as a blur. The third case reads each
 * declared cover's pixels from the file's own header and asks whether the
 * centred 4:3 frame it leaves is at least 1320×990 — the file, not a script's
 * report of what it wrote.
 *
 * "Named" means named anywhere in this repository, documentation included:
 * `apps/web/docs/design/assets.md` is the register these files are meant to be
 * listed in, so a mention there is a reference. What fails is a file that
 * nothing mentions at all.
 */

const webRoot = fileURLToPath(new URL("../../../", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const publicRoot = join(webRoot, "public");

/**
 * Directories that hold no source of ours: dependencies, build output, records
 * of a run, and `__tests__` — a test that counted its own text would find a
 * reference in the assertion about a missing one.
 */
const skipped = new Set([
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  ".pnpm-store",
  ".agents",
  "test-results",
  "playwright-report",
  "blob-report",
  "out",
  "dist",
  "build",
  "coverage",
  "__tests__",
]);

const isText = /\.(?:ts|tsx|mjs|js|json|css|md)$/;

function filesUnder(directory: string, keep: (name: string) => boolean): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return skipped.has(entry.name) ? [] : filesUnder(path, keep);
    return keep(entry.name) ? [path] : [];
  });
}

/** Every image served from `public/`, written the way a page asks for it. */
const served = filesUnder(publicRoot, () => true)
  .filter((file) => {
    const parts = relative(publicRoot, file).split(sep);
    // A dotfile is housekeeping (`.gitkeep`), not an asset to ask for.
    return parts.every((part) => !part.startsWith("."));
  })
  .map((file) => `/${relative(publicRoot, file).split(sep).join("/")}`);

/** Everything in the repository that could name one of them, read once. */
const documents = filesUnder(repoRoot, (name) => isText.test(name)).map((file) => ({
  path: relative(repoRoot, file),
  text: readFileSync(file, "utf8"),
}));

const namingFile = (url: string): string | undefined =>
  documents.find((document) => document.text.includes(url))?.path;

describe("public assets", () => {
  it("serves only files something in the repository names", () => {
    // Without this, an empty `public/` would pass by having nothing to check.
    expect(served.length).toBeGreaterThan(0);

    for (const url of served) {
      expect(
        namingFile(url),
        `${url} is served but nothing in this repository names it: delete it, or wire it up and list it in apps/web/docs/design/assets.md`,
      ).toBeDefined();
    }
  });

  it("points every Tool cover at a file that exists", () => {
    for (const tool of tools) {
      if (tool.cover === undefined) continue;

      const file = join(publicRoot, tool.cover);

      expect(
        existsSync(file) && statSync(file).isFile(),
        `${tool.title}: cover ${tool.cover} is not a file under public/`,
      ).toBe(true);
    }
  });

  it("asserts every declared cover covers the card's 4:3 frame", () => {
    let declared = 0;

    for (const tool of tools) {
      if (tool.cover === undefined) continue;

      declared += 1;
      const cover = tool.cover;
      const size = readImageSize(readFileSync(join(publicRoot, cover)));
      const refusal = coverFrameRefusal(cover, size);

      // The refusal is the failure message: it names the file, its size, the
      // 4:3 frame the crop leaves and the 1320×990 the card needs.
      expect(refusal, `${tool.title}: ${cover} does not fill the card's 4:3 frame`).toBeNull();
    }

    // Without this, a registry with no covers would pass by having nothing to check.
    expect(declared).toBeGreaterThan(0);
  });
});
