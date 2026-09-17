import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * An icon is a Tailwind class naming an Iconify icon (`icon-[ph--sun-bold]`),
 * which the icon plugin compiles into CSS at build time — see
 * `docs/adr/0009-phosphor-icons-through-iconify.md`.
 *
 * Both ways that can go wrong are silent. A misspelled name makes the plugin
 * log a warning and return no rules, so the icon is not broken, it is absent;
 * a name assembled at runtime (`icon-[ph--${weight}]`) is never seen by the
 * scanner, so it is never compiled. Neither shows up in a type check, in lint,
 * or in the build's exit code, which is why this test reads the source.
 */

const sourceRoot = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);

/** The one shape an icon is allowed to take, outside the brackets. */
const iconClass = /icon-\[([^\]]*)\]/g;
const iconName = /^([a-z0-9]+(?:-[a-z0-9]+)*)--([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/** An Iconify JSON set: the icons themselves under `icons`, aliases beside them. */
type IconSetJson = { icons: Record<string, unknown>; aliases?: Record<string, unknown> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIconSetJson(value: unknown): value is IconSetJson {
  return (
    isRecord(value) &&
    isRecord(value.icons) &&
    (value.aliases === undefined || isRecord(value.aliases))
  );
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      // Tests are not shipped styles: the pattern above would match itself.
      return entry.name === "__tests__" ? [] : sourceFiles(path);
    }
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** Every icon class in the source, mapped to the files that use it. */
const icons = new Map<string, string[]>();

for (const file of sourceFiles(sourceRoot)) {
  for (const [, name] of readFileSync(file, "utf8").matchAll(iconClass)) {
    const files = icons.get(name ?? "") ?? [];
    icons.set(name ?? "", [...files, relative(sourceRoot, file)]);
  }
}

const where = (name: string) => `${name} in ${icons.get(name)?.join(", ")}`;

describe("icons", () => {
  it("uses at least one", () => {
    // Without this, a source with no icons at all would pass the two checks
    // below by having nothing to check.
    expect(icons.size).toBeGreaterThan(0);
  });

  it("names every icon as a static <prefix>--<name> literal", () => {
    for (const name of icons.keys()) {
      expect(name, where(name)).toMatch(iconName);
    }
  });

  it("finds every icon in the icon set it names", () => {
    for (const name of icons.keys()) {
      const [, prefix, icon] = name.match(iconName) ?? [];
      if (prefix === undefined || icon === undefined) continue;

      // Resolving through the package is the point: it is also what fails if
      // the icon set the class names was never installed.
      const path = require.resolve(`@iconify-json/${prefix}/icons.json`);
      const set: unknown = JSON.parse(readFileSync(path, "utf8"));
      if (!isIconSetJson(set)) throw new TypeError(`${path} is not an Iconify icon set`);

      expect(set.icons[icon] ?? set.aliases?.[icon], where(name)).toBeDefined();
    }
  });
});
