"use client";

import { useComputedColorScheme, useMantineColorScheme } from "@mantine/core";

import { Button } from "@/components/ui/button";

/**
 * A two-state switch between the light and the dark scheme.
 *
 * The site follows the operating system until this is touched, and from then on
 * it does what the visitor said: `MantineProvider` persists the choice through
 * `localStorageColorSchemeManager` (its default), and `ColorSchemeScript` reads
 * it before the first paint, so nothing flashes. See ADR-0008 for why a site
 * that used to refuse this control now has one.
 *
 * **The button is the incoming layer's since #163; the scheme is still the outgoing
 * layer's.** That split is deliberate and it is the round's own boundary: the
 * provider, the theme object and the scheme script are *ownership* rather than
 * drawing, and they change in the ticket that removes the dependency (#168), with
 * their own argument. What moved here is the box — the same 32x26 control, drawn by
 * a Primitive.
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
 *
 * The classes that are not the Primitive's own are the outgoing layer's numbers
 * read off the built page before it was replaced, which is the method the pilot
 * used and this round repeats: 26px tall and 32 wide (its `compact-sm`), a 1px
 * hairline border, the surface token as the fill, a 4px radius, 8px of inline
 * padding, and 14px text on a 14px line. They are written as utilities rather than
 * left to a variant because no variant of the registry's ladder is 26px: its
 * smallest is 24 and its `sm` is 32, and the header's height is set by the 28px
 * mark beside this control, so a taller button would move the header.
 */
export function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  /* Only used inside the handler, which runs long after hydration. */
  const computed = useComputedColorScheme("light", { getInitialValueInEffect: true });

  return (
    <Button
      className="touch-target h-[26px] rounded-sm border-input bg-card px-2 text-sm leading-none font-semibold text-foreground hover:bg-secondary dark:bg-card dark:hover:bg-secondary"
      onClick={() => setColorScheme(computed === "dark" ? "light" : "dark")}
      variant="outline"
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
