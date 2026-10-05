import { describe, expect, it } from "vitest";

import { contrastRatio, tokenNames, tokens, type TokenName } from "@/lib/tokens";

/**
 * "Contrast is calculated, not eyeballed" was a sentence in a document with
 * nothing behind it, and #116 re-derived the whole palette — which is exactly the
 * moment a hand-kept discipline has no protection left. The values and the
 * calculation now live in one plain module, and this file is what reads them
 * (#127). No DOM, no browser, no library, and no new tier: it sits under `src/`
 * with the `*.test.ts` name, which is the include every other unit test is found
 * by.
 *
 * The list below is the interface's own pairings, **stated rather than derived**.
 * A pairing added to the interface and not added here is a visible omission
 * instead of an invisible one, and the last test is what makes forgetting one
 * fail rather than pass: every token has to appear in at least one pairing.
 *
 * Pairs are named by *token*, never by value, so a value can move without the
 * test needing to move with it — and a value moved below AA turns this red, which
 * is the whole point. That was demonstrated once rather than assumed: with
 * `light.dimmed` temporarily set to `#c9c7c2`, the pairing assertion failed and
 * said which one it was — `light: muted text on the page — dimmed on canvas is
 * 1.56:1` — while the other three tests in the file stayed green. The value was
 * put back afterwards.
 */

const AA_TEXT = 4.5;

type Pairing = {
  /** What this pairing is, in the interface's words. */
  readonly about: string;
  /** The colour being read — text, an icon, a border. */
  readonly on: TokenName;
  /** The surface it is read against. */
  readonly over: TokenName;
  /** `null` declares the pairing exempt, and `why` then has to say why. */
  readonly floor: number | null;
  readonly why?: string;
};

/**
 * Every pairing the interface actually uses. Not every pairing that *could* be
 * constructed: a four-colour palette has twelve orderings, and asserting ones
 * nobody draws would make the list unreadable and the failures uninteresting.
 *
 * Deliberately absent, and named so the omission is not invisible: the filled
 * error control the registry's `destructive` variant draws (`bg-destructive/60`
 * in dark, which composites to 3.60:1 against its own label — measured, and
 * recorded with its numbers in `apps/web/docs/design/colour.md`). It is not in
 * the interface, so it is not a pairing here; if it is ever drawn, this list is
 * where its number belongs, and it will fail until the variant is replaced.
 */
const pairings: readonly Pairing[] = [
  { about: "body text on the page", floor: AA_TEXT, on: "text", over: "canvas" },
  { about: "body text in a card", floor: AA_TEXT, on: "text", over: "surface" },
  { about: "body text on a hovered surface", floor: AA_TEXT, on: "text", over: "surfaceHover" },
  { about: "muted text on the page", floor: AA_TEXT, on: "dimmed", over: "canvas" },
  { about: "muted text in a card", floor: AA_TEXT, on: "dimmed", over: "surface" },
  { about: "muted text on a hovered surface", floor: AA_TEXT, on: "dimmed", over: "surfaceHover" },
  { about: "an input's placeholder", floor: AA_TEXT, on: "placeholder", over: "surface" },
  { about: "a filled control's label", floor: AA_TEXT, on: "canvas", over: "text" },
  { about: "error text on the page", floor: AA_TEXT, on: "error", over: "canvas" },
  { about: "error text in a card", floor: AA_TEXT, on: "error", over: "surface" },
  {
    about: "the hairline, which is decoration",
    floor: null,
    on: "hairline",
    over: "canvas",
    why: "it draws a card's edge or a separator and never a control's boundary, so WCAG 1.4.11's 3:1 — which is about boundaries — does not apply to it. The one place that argument fails is an input's border, which *is* its only boundary; that is recorded as an open item with its own number in apps/web/docs/design/colour.md rather than waived here in silence.",
  },
];

const schemes = ["light", "dark"] as const;

describe("the palette", () => {
  it("defines every token in both schemes", () => {
    for (const scheme of schemes) {
      // Compared as sets rather than as sorted lists: `Array#toSorted` is above
      // this project's `lib` target, and a sort here would earn a lint warning it
      // does not need to earn.
      expect(new Set(Object.keys(tokens[scheme])), scheme).toEqual(new Set(tokenNames));
    }
  });

  it("has no pure black and no pure white", () => {
    // An enforced invariant, and one a measurement settled rather than a taste
    // (ADR-0007): the light canvas is a bone off-white so that a white card can
    // sit on it, and the dark scheme is an off-black. Its ban is asserted here so
    // that a future value cannot quietly reintroduce one.
    for (const scheme of schemes) {
      for (const name of tokenNames) {
        const value = tokens[scheme][name].toLowerCase();
        expect(value, `${scheme}.${name}`).not.toBe("#000000");
        expect(value, `${scheme}.${name}`).not.toBe("#ffffff");
      }
    }
  });

  it("clears AA on every pairing the interface uses, in both schemes", () => {
    for (const scheme of schemes) {
      for (const pairing of pairings) {
        const ratio = contrastRatio(tokens[scheme][pairing.on], tokens[scheme][pairing.over]);
        const what = `${scheme}: ${pairing.about} — ${pairing.on} on ${pairing.over} is ${ratio.toFixed(2)}:1`;

        if (pairing.floor === null) {
          expect(pairing.why, `${what}, declared exempt without a reason`).toBeTruthy();
          // A waiver has to be a *decorative* pairing, not a number that nearly
          // passed: anything within reach of the floor has to be fixed instead.
          expect(ratio, `${what}, which is too close to the floor to waive`).toBeLessThan(3);
          continue;
        }

        expect(ratio, what).toBeGreaterThanOrEqual(pairing.floor);
      }
    }
  });

  it("names every token in at least one pairing", () => {
    const named = new Set(pairings.flatMap((pairing) => [pairing.on, pairing.over]));
    const unmeasured = tokenNames.filter((name) => !named.has(name));

    expect(unmeasured, `a token no pairing measures: ${unmeasured.join(", ")}`).toEqual([]);
  });
});
