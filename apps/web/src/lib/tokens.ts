/**
 * The site's design tokens: a warm monochrome, in one engine-agnostic module.
 *
 * This is the single source for every colour value this site uses. Two consumers
 * read it, and they are why it is a plain module rather than a stylesheet:
 *
 * - **The outgoing layer** reads it here, in TypeScript, inside Mantine's theme
 *   factory (`src/app/theme.ts`).
 * - **The incoming layer** reads it as custom properties, which the root layout
 *   emits into the document from `tokensCss()` below; `globals.css` maps the new
 *   layer's utility names onto those properties in one `@theme inline` block.
 *
 * Two owners of colour cannot coexist (#111), so nothing else may declare a
 * value: a stylesheet that repeats one of these hexes is a second owner, and
 * `tokens.test.ts` is what notices (#127).
 *
 * Every value is required in both schemes. Pure `#000000` and pure `#ffffff` are
 * banned, and that ban is the outcome of a measurement rather than a taste
 * (`docs/adr/0007-warm-monochrome-design-language.md`): the light canvas is a
 * bone off-white so that a white card can sit on it, and the dark scheme is an
 * off-black. The ratios beside each value are the ones the palette was chosen
 * against, and `apps/web/docs/design/colour.md` carries what each pair is for.
 *
 * What is deliberately **not** here yet, and who owns it: the site's error
 * colour. The interface has only ever borrowed Mantine's red (`Alert color="red"`
 * on the image converter), so there is no measured value of ours to move; the
 * palette is re-derived and measured in #116, and that is where an error value
 * gets its name and its number.
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
    // 4.61:1 against the surface it sits on.
    canvas: "#f7f6f3",
    dimmed: "#6b6862",
    hairline: "#eaeaea",
    placeholder: "#75726a",
    surface: "#fbfaf8",
    surfaceHover: "#f2f1ed",
    text: "#111111",
  },
  dark: {
    // 15.20:1, 6.48:1 and 5.65:1 — the muted margin kept above AA on purpose.
    canvas: "#171614",
    dimmed: "#a5a19a",
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

  const channels = [0, 2, 4].map(
    (offset) => Number.parseInt(full.slice(offset, offset + 2), 16) / 255,
  );
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/**
 * The contrast ratio between two colours, 1:1 to 21:1.
 *
 * Symmetric: the lighter colour is the numerator whichever way round the pair is
 * given, so a caller cannot get the reciprocal by accident.
 */
export function contrastRatio(one: string, other: string): number {
  const [lighter, darker] = [luminance(one), luminance(other)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The custom properties both schemes are published as, for the layout to emit.
 *
 * Both schemes are emitted rather than one plus a media query, because exactly one
 * mechanism owns the scheme and it is not the operating system: Mantine's
 * `ColorSchemeScript` writes `data-mantine-color-scheme` on `<html>` before the
 * first paint, and the stylesheet reads that. The light block is on `:root` and
 * the dark block follows it at equal specificity, so the attribute wins on source
 * order. See `apps/web/docs/design/colour.md`.
 */
export function tokensCss(): string {
  const block = (scheme: Scheme, indent: string) =>
    tokenNames.map((name) => `${indent}${cssName(name)}: ${tokens[scheme][name]};`).join("\n");

  return [
    ":root {",
    block("light", "  "),
    "}",
    '[data-mantine-color-scheme="dark"] {',
    block("dark", "  "),
    "}",
  ].join("\n");
}
