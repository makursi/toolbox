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
 * The icon names the mode it switches *to* — a moon in the light scheme — and
 * both icons live in the markup together with the words that name them, which
 * are hidden from sight and read out instead. Which pair is live is decided by
 * the stylesheet from `[data-mantine-color-scheme]`, not by React state: the
 * server cannot know the operating system's preference, so a value read during
 * render would either mismatch on hydration or briefly lie and then correct
 * itself. The same constraint is why the button carries no `aria-label` — a
 * label written here is one fixed string, and it would name the wrong mode in
 * one of the two schemes.
 *
 * Icons are Phosphor from Iconify, compiled in at build time; see
 * `docs/adr/0009-phosphor-icons-through-iconify.md`.
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
      <span className="theme-toggle-light">
        <span aria-hidden className="icon icon-[ph--moon-bold]" />
        <span className="sr-only">切换到深色</span>
      </span>
      <span className="theme-toggle-dark">
        <span aria-hidden className="icon icon-[ph--sun-bold]" />
        <span className="sr-only">切换到浅色</span>
      </span>
    </Button>
  );
}
