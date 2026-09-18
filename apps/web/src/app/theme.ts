import { createTheme, type CSSVariablesResolver } from "@mantine/core";

/**
 * The site's design tokens: a warm monochrome.
 *
 * The canvas is an off-white bone rather than `#ffffff` and the dark scheme is an
 * off-black rather than `#000000`, because neither pure value holds depth. Every
 * pair below was measured with a WCAG contrast calculator rather than judged by
 * eye: body text is 17.47:1 on the light canvas and 15.20:1 in dark, and the muted
 * tone is 5.14:1 and 7.03:1. AA wants 4.5:1 — the muted value the design reference
 * suggested measured 4.14:1 and was replaced.
 *
 * There is no accent colour on purpose. The only colour in the interface is the
 * one thing that carries meaning (an error), which is what keeps the page quiet.
 */
const lightCanvas = "#f7f6f3";
const lightSurface = "#fbfaf8";
const lightText = "#111111";
const lightDimmed = "#6b6862";
const lightHairline = "#eaeaea";

const darkCanvas = "#171614";
const darkSurface = "#1f1e1c";
const darkText = "#edebe8";
const darkDimmed = "#a5a19a";
const darkHairline = "#313030";

/**
 * Geist covers Latin; the Chinese copy needs a CJK fallback behind it.
 *
 * Nothing is downloaded for this: the CJK fonts are the ones the operating
 * system already has, so the Chinese text renders in PingFang on macOS, YaHei on
 * Windows and Noto on Linux. Self-hosting a CJK font would make the two machines
 * agree, at the cost of megabytes, so it stays a documented option rather than a
 * default (see `docs/design.md`).
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
    // Used for primary buttons and checked controls. Shade 9 is the
    // ink of the light scheme and shade 0 the paper of the dark one.
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
      "#111111",
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
 * rather than fought with in a stylesheet. */
export const cssVariables: CSSVariablesResolver = () => ({
  variables: {
    // 1.7 rather than 1.6: Chinese needs more leading than Latin at the same size.
    "--mantine-line-height": "1.7",
    "--mantine-webkit-font-smoothing": "antialiased",
    "--mantine-moz-font-smoothing": "grayscale",
  },
  light: {
    "--mantine-color-body": lightCanvas,
    "--mantine-color-text": lightText,
    "--mantine-color-dimmed": lightDimmed,
    "--mantine-color-anchor": lightText,
    "--mantine-color-default": lightSurface,
    "--mantine-color-default-hover": "#f2f1ed",
    "--mantine-color-default-color": lightText,
    "--mantine-color-default-border": lightHairline,
    // Measured, not guessed: the first value here was #8a877f, which is 3.44:1 on
    // the input surface and fails AA. AA for text wants 4.5:1.
    "--mantine-color-placeholder": "#75726a",
  },
  dark: {
    "--mantine-color-body": darkCanvas,
    "--mantine-color-text": darkText,
    "--mantine-color-dimmed": darkDimmed,
    "--mantine-color-anchor": darkText,
    "--mantine-color-default": darkSurface,
    "--mantine-color-default-hover": "#262523",
    "--mantine-color-default-color": darkText,
    "--mantine-color-default-border": darkHairline,
    // 5.65:1 on the dark input surface, matching the margin the light scheme
    // keeps above AA rather than sitting just over the line.
    "--mantine-color-placeholder": "#9a968e",
  },
});
