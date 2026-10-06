import { describe, expect, it } from "vitest";

import {
  colorSchemeScript,
  parseScheme,
  SCHEME_ATTRIBUTE,
  SCHEME_STORAGE_KEY,
  systemScheme,
} from "@/lib/color-scheme";
import { tokensCss } from "@/lib/tokens";

/**
 * The scheme's one owner, pinned where it can be pinned without a browser.
 *
 * What is testable here is the *rule* — what a stored value means — and the two
 * strings that tie the document to it: the script that runs before the first paint
 * (which cannot import this module, so its key is interpolated) and the tokens'
 * dark block (which is defined against the attribute the script writes). The switch's
 * behaviour in a real browser is the gate's (`apps/web/e2e/colour-scheme.spec.ts`),
 * and the two halves are deliberately not a copy of each other.
 */
describe("parseScheme", () => {
  it("reads the two schemes this site stores", () => {
    expect(parseScheme("light")).toBe("light");
    expect(parseScheme("dark")).toBe("dark");
  });

  it("answers null for anything else, so the system is followed rather than guessed", () => {
    for (const value of [null, undefined, "", "auto", "Dark", "system", "true"]) {
      expect(parseScheme(value)).toBeNull();
    }
  });
});

describe("systemScheme", () => {
  it("is the operating system's answer in this site's two words", () => {
    expect(systemScheme(true)).toBe("dark");
    expect(systemScheme(false)).toBe("light");
  });
});

describe("colorSchemeScript", () => {
  const script = colorSchemeScript();

  it("carries this site's key and the attribute the stylesheet reads", () => {
    expect(script).toContain(SCHEME_STORAGE_KEY);
    expect(script).toContain("document.documentElement.dataset.colorScheme");
    expect(SCHEME_ATTRIBUTE).toBe("data-color-scheme");
  });

  it("names the library nowhere, which is what #168 was for", () => {
    expect(script).not.toContain("mantine");
    expect(tokensCss()).not.toContain("mantine");
  });

  it("falls back to the system, and to light if even that throws", () => {
    expect(script).toContain("prefers-color-scheme: dark");
    expect(script).toContain("catch");
  });
});

describe("the tokens' dark block", () => {
  it("is defined against the same attribute the script writes", () => {
    expect(tokensCss()).toContain(`[${SCHEME_ATTRIBUTE}="dark"]`);
  });
});
