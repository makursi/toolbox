import { describe, expect, it } from "vitest";

import { matchesFont } from "@/tools/cover-generator/core/fonts";

/**
 * The system-font match rule: a case-insensitive substring match over a font
 * family, mirroring the icon search in `icons.ts`. Tests run against literal
 * families, not real machine fonts — the point is the rule, not the data.
 */
describe("font match", () => {
  it("matches a case-insensitive substring", () => {
    expect(matchesFont("Yatra One", "ya")).toBe(true);
    expect(matchesFont("Arial", "ARIAL")).toBe(true);
    expect(matchesFont("思源黑体", "思源")).toBe(true);
  });

  it("matches a substring in the middle of a name", () => {
    expect(matchesFont("Noto Sans SC", "sans")).toBe(true);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(matchesFont("Arial", "  aria ")).toBe(true);
  });

  it("rejects a query that is not a substring", () => {
    expect(matchesFont("Arial", "zzz")).toBe(false);
    expect(matchesFont("Arial", "yatra")).toBe(false);
  });
});
