/**
 * The site's design tokens: a warm monochrome, in one engine-agnostic module.
 *
 * This is the single source for every colour value this site uses, and since #168 it
 * is the **only end** of that source: the outgoing layer read it through a theme
 * factory and a runtime CSS-variable resolver (`src/app/theme.ts`), and both went with
 * the library. What reads it now is the root layout, which emits every value as a
 * custom property before anything paints (`tokensCss()` below), and `globals.css`,
 * whose `@theme inline` block maps the incoming layer's utility names onto those
 * properties.
 *
 * One owner of colour (#111), so nothing else may declare a value: a stylesheet that
 * repeats one of these hexes is a second owner, and `tokens.test.ts` is what notices
 * (#127).
 *
 * Every value is required in both schemes. Pure `#000000` and pure `#ffffff` are
 * banned, and that ban is the outcome of a measurement rather than a taste
 * (`docs/adr/0007-warm-monochrome-design-language.md`): the light canvas is a
 * bone off-white so that a white card can sit on it, and the dark scheme is an
 * off-black. The ratios beside each value are the ones the palette was chosen
 * against, and `apps/web/docs/design/colour.md` carries what each pair is for.
 *
 * What is deliberately **not** here: nothing from the incoming layer's own
 * palette. #116 read its defaults before deciding anything and replaced every
 * value they touched, and the reading is recorded with its source in
 * `apps/web/docs/design/colour.md` — including the one that settled it, since the
 * incoming light canvas is `oklch(1 0 0)`, a pure white that ADR-0007 had already
 * measured and rejected.
 *
 * The one value that had to be *chosen* rather than moved is the error colour, and
 * the reason it is two values is a measurement: no single red clears AA as a filled
 * control's background in both schemes (`#c92a2a` is 5.05:1 against the light paper
 * but 3.31:1 against the dark ink; `#ff8787` is 7.81:1 against the dark ink and
 * 2.14:1 against the light paper). Both also clear AA as error *text* on their own
 * canvas, which is the other way this value gets used.
 */

export type Scheme = "light" | "dark";

/** Every name this module owns. Both schemes define every one of them. */
export const tokenNames = [
  "canvas",
  "surface",
  "surfaceHover",
  "text",
  "dimmed",
  "placeholder",
  "hairline",
  "error",
] as const;

export type TokenName = (typeof tokenNames)[number];

/**
 * The palette, light first.
 *
 * Contrast was calculated rather than eyeballed, and two measurements changed the
 * design instead of being filed as known issues: the muted tone a reference
 * suggested measured 4.14:1 and was replaced, and the first placeholder value
 * measured 3.44:1 and was replaced. AA asks 4.5:1 of body text.
 */
export const tokens: Record<Scheme, Record<TokenName, string>> = {
  light: {
    // Body text on the canvas is 17.47:1, the muted tone 5.14:1, the placeholder
    // 4.61:1 against the surface it sits on, and the error colour 5.05:1 both as
    // text on the canvas and as a filled control under this scheme's paper.
    canvas: "#f7f6f3",
    dimmed: "#6b6862",
    error: "#c92a2a",
    hairline: "#eaeaea",
    placeholder: "#75726a",
    surface: "#fbfaf8",
    surfaceHover: "#f2f1ed",
    text: "#111111",
  },
  dark: {
    // 15.20:1, 7.03:1 on the canvas and 5.65:1 — the muted margin kept above AA
    // on purpose. The error colour is a *lighter* red here for the same reason
    // the ink is lighter: it has to hold 7.81:1 against this scheme's ink.
    canvas: "#171614",
    dimmed: "#a5a19a",
    error: "#ff8787",
    hairline: "#313030",
    placeholder: "#9a968e",
    surface: "#1f1e1c",
    surfaceHover: "#262523",
    text: "#edebe8",
  },
};

/** `surfaceHover` -> `surface-hover`, so the CSS names read like CSS. */
export function cssName(name: TokenName): string {
  return `--site-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

/**
 * WCAG 2.1 relative luminance, from `#rgb` or `#rrggbb`.
 *
 * Deliberately no third-party colour library and no `color-mix`, `oklch` or
 * alpha handling: the values above are opaque sRGB, and a calculator that accepts
 * more than the palette contains would invite a value nobody measured. A form it
 * cannot read throws rather than returning a number.
 */
function luminance(hex: string): number {
  const match = /^#(?<short>[0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  const digits = match?.groups?.short;
  if (digits === undefined) throw new Error(`not an opaque hex colour: ${hex}`);

  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : digits;

  // Destructured with defaults rather than cast to a tuple: the map returns an
  // array, and an assertion here would be a claim about its length rather than a
  // use of it.
  const [red = 0, green = 0, blue = 0] = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(full.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/**
 * The contrast ratio between two colours, 1:1 to 21:1.
 *
 * Symmetric: the lighter colour is the numerator whichever way round the pair is
 * given, so a caller cannot get the reciprocal by accident. `Math.max` rather than
 * a sort of two values, which is also why this file earns no `no-array-sort`
 * warning for the privilege (`Array#toSorted` is above this project's `lib`
 * target).
 */
export function contrastRatio(one: string, other: string): number {
  const first = luminance(one);
  const second = luminance(other);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/**
 * The custom properties both schemes are published as, for the layout to emit.
 *
 * Both schemes are emitted rather than one plus a media query, because exactly one
 * mechanism owns the scheme and it is not the operating system: the script in the
 * layout's head writes `data-color-scheme` on `<html>` before the first paint
 * (`src/lib/color-scheme.ts`, and `docs/adr/0017-the-site-owns-the-colour-scheme.md`
 * for why the attribute is this site's), and the stylesheet reads that. The light
 * block is on `:root` and the dark block follows it at equal specificity, so the
 * attribute wins on source order. See `apps/web/docs/design/colour.md`.
 */
export function tokensCss(): string {
  const block = (scheme: Scheme, indent: string) =>
    tokenNames.map((name) => `${indent}${cssName(name)}: ${tokens[scheme][name]};`).join("\n");

  return [
    ":root {",
    block("light", "  "),
    "}",
    '[data-color-scheme="dark"] {',
    block("dark", "  "),
    "}",
  ].join("\n");
}
