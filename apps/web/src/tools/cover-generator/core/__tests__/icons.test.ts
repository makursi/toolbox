import { describe, expect, it } from "vitest";

import {
  lucideIndex,
  resolveLucideIcon,
  searchLucide,
  type LucideSet,
} from "@/tools/cover-generator/core/icons";

/**
 * The search and alias-resolution over the lucide index. Tests run against a
 * small fixture that mirrors the shape of `@iconify-json/lucide/icons.json`,
 * not against the real 1853-icon file — the point is the rule, not the data.
 */
const fixture: LucideSet = {
  prefix: "lucide",
  width: 24,
  height: 24,
  icons: {
    image: { body: '<path d="image"/>', width: 24, height: 24 },
    heart: { body: '<path d="heart"/>', width: 24, height: 24 },
    "badge-check": { body: '<path d="badge-check"/>', width: 24, height: 24 },
  },
  aliases: {
    checked: { parent: "badge-check" },
  },
};

describe("lucide index", () => {
  it("lists every icon and alias for the search box", () => {
    expect(lucideIndex(fixture)).toEqual(["image", "heart", "badge-check", "checked"]);
  });

  it("finds names and aliases by substring, case-insensitively", () => {
    expect(searchLucide(fixture, "imag")).toEqual(["image"]);
    expect(searchLucide(fixture, "CHECK")).toEqual(["badge-check", "checked"]);
  });

  it("returns nothing for a query nothing matches", () => {
    expect(searchLucide(fixture, "zzz")).toEqual([]);
  });

  it("caps the result list so a broad query stays readable", () => {
    const value = { body: '<path d="image"/>', width: 24, height: 24 };
    const many = {
      ...fixture,
      icons: Object.fromEntries(
        Array.from({ length: 60 }, (_, i) => [`icon-${String(i).padStart(2, "0")}`, value]),
      ),
    };
    expect(searchLucide(many, "icon", 50)).toHaveLength(50);
  });

  it("resolves an alias to its parent's body and metrics", () => {
    expect(resolveLucideIcon(fixture, "checked")).toEqual({
      body: '<path d="badge-check"/>',
      width: 24,
      height: 24,
    });
  });

  it("resolves a real icon to itself", () => {
    expect(resolveLucideIcon(fixture, "heart")?.body).toBe('<path d="heart"/>');
  });

  it("resolves nothing for an unknown name", () => {
    expect(resolveLucideIcon(fixture, "ghost")).toBeUndefined();
  });
});
