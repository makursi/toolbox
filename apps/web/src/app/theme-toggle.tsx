"use client";

import { Button, useComputedColorScheme, useMantineColorScheme } from "@mantine/core";

/**
 * A two-state switch between the light and the dark scheme.
 *
 * The site follows the operating system until this is touched, and from then on
 * it does what the visitor said: `MantineProvider` persists the choice through
 * `localStorageColorSchemeManager` (its default), and `ColorSchemeScript` reads
 * it before the first paint, so nothing flashes. See ADR-0008 for why a site
 * that used to refuse this control now has one.
 *
 * **The label is chosen by the stylesheet, not by React state.** The server
 * cannot know the operating system's preference, so anything derived from the
 * scheme at render time would either mismatch on hydration or briefly lie and
 * then correct itself. Both labels are in the markup and
 * `[data-mantine-color-scheme]` — which the script above sets before the first
 * paint — decides which one is visible. That also means **no `aria-label`**: the
 * visible word is the accessible name, and a label supplied by hand would
 * disagree with whichever word is on screen.
 *
 * The word names the mode it switches *to*: one word with no state to infer.
 * It is a word rather than a sun and a moon because this site has no icon set
 * yet (issue #14); when Phosphor lands those two replace it.
 */
export function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  /* Only used inside the handler, which runs long after hydration. */
  const computed = useComputedColorScheme("light", { getInitialValueInEffect: true });

  return (
    <Button
      className="touch-target"
      onClick={() => setColorScheme(computed === "dark" ? "light" : "dark")}
      size="compact-sm"
      variant="default"
    >
      <span className="theme-label-light">深色</span>
      <span className="theme-label-dark">浅色</span>
    </Button>
  );
}
