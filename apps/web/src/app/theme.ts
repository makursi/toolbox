import { createTheme, type CSSVariablesResolver } from "@mantine/core";

import { tokens } from "@/lib/tokens";

/**
 * Mantine's view of the site's tokens — the outgoing layer's end of the single
 * source in `src/lib/tokens.ts`.
 *
 * Nothing here declares a colour. The values used to live in this file, and the
 * reason they are read from a plain module instead is #111: the incoming
 * component layer needs the same values, and two owners of colour cannot coexist.
 * `apps/web/docs/design/colour.md` records the decision and what each value is
 * for; ADR-0016 records why the layer changed.
 *
 * The one thing here that is still Mantine-shaped is the `ink` ramp: a
 * ten-stop palette is what Mantine's `colors` wants, so it is derived from this
 * site's ink and paper and disappears with the library. It is not a second
 * palette — every stop is a step between `tokens.light.text` and its canvas.
 */
const light = tokens.light;
const dark = tokens.dark;

/**
 * Geist covers Latin; the Chinese copy needs a CJK fallback behind it.
 *
 * Nothing is downloaded for this: the CJK fonts are the ones the operating
 * system already has, so the Chinese text renders in PingFang on macOS, YaHei on
 * Windows and Noto on Linux. Self-hosting a CJK font would make the two machines
 * agree, at the cost of megabytes, so it stays a documented option rather than a
 * default (see `apps/web/docs/design/typography.md`).
 */
const sansStack = [
  "var(--font-geist-sans)",
  "'PingFang SC'",
  "'Hiragino Sans GB'",
  "'Microsoft YaHei'",
  "'Noto Sans CJK SC'",
  "system-ui",
  "sans-serif",
].join(", ");

export const theme = createTheme({
  colors: {
    // Used for primary buttons and checked controls. Shade 9 is the ink of the
    // light scheme and shade 0 the paper of the dark one.
    ink: [
      "#f6f5f3",
      "#e9e7e4",
      "#d5d2cd",
      "#bab6b0",
      "#9c978f",
      "#7e7a72",
      "#63605a",
      "#4a4843",
      "#2c2b29",
      light.text,
    ],
  },
  primaryColor: "ink",
  // Filled controls read as ink-on-paper in light and paper-on-ink in dark.
  primaryShade: { light: 9, dark: 0 },
  defaultRadius: "md",
  fontFamily: sansStack,
  fontFamilyMonospace: "var(--font-geist-mono), ui-monospace, monospace",
  headings: {
    fontFamily: sansStack,
    fontWeight: "600",
  },
  components: {
    // Minimum radius for a container, small radius for a control: a pill button
    // in a square-ish card reads as decoration.
    Button: { defaultProps: { radius: "sm" } },
  },
});

/** Mantine reads its canvas, text and hairline from these, so they are set here
 * rather than fought with in a stylesheet. The `colorScheme` blocks are named for
 * *this site's* values, not Mantine's, and the resolver is the one place they are
 * written into CSS — which is why a plain `globals.css` override loses the
 * cascade and why this end of the source is TypeScript.
 */
export const cssVariables: CSSVariablesResolver = () => ({
  variables: {
    // 1.7 rather than 1.6: Chinese needs more leading than Latin at the same size.
    "--mantine-line-height": "1.7",
    "--mantine-webkit-font-smoothing": "antialiased",
    "--mantine-moz-font-smoothing": "grayscale",
  },
  light: {
    "--mantine-color-body": light.canvas,
    "--mantine-color-text": light.text,
    "--mantine-color-dimmed": light.dimmed,
    "--mantine-color-anchor": light.text,
    "--mantine-color-default": light.surface,
    "--mantine-color-default-hover": light.surfaceHover,
    "--mantine-color-default-color": light.text,
    "--mantine-color-default-border": light.hairline,
    "--mantine-color-placeholder": light.placeholder,
  },
  dark: {
    "--mantine-color-body": dark.canvas,
    "--mantine-color-text": dark.text,
    "--mantine-color-dimmed": dark.dimmed,
    "--mantine-color-anchor": dark.text,
    "--mantine-color-default": dark.surface,
    "--mantine-color-default-hover": dark.surfaceHover,
    "--mantine-color-default-color": dark.text,
    "--mantine-color-default-border": dark.hairline,
    "--mantine-color-placeholder": dark.placeholder,
  },
});
