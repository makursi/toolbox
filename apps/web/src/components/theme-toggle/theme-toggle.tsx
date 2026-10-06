"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { applyScheme, currentScheme, watchSystemScheme } from "@/lib/color-scheme";

/**
 * A two-state switch between the light and the dark scheme.
 *
 * **The site owns the scheme since #168.** The value is resolved before the first
 * paint by the script in the document's head and written to `data-color-scheme` on
 * `<html>`; this control is the only thing that changes it afterwards, and both ends
 * go through `src/lib/color-scheme.ts` — one owner, one attribute, one storage key.
 * See `docs/adr/0017-the-site-owns-the-colour-scheme.md` for why the attribute is this
 * site's now, and `docs/adr/0008-manual-colour-scheme-switch.md` for why a site that
 * once refused a toggle has one.
 *
 * It is a Primitive (since #163), with the outgoing layer's numbers read off the built
 * page: 32x26, a 1px hairline border, the surface token as the fill, a 4px radius, 8px
 * of inline padding, and 14px text on a 14px line. They are utilities rather than a
 * variant because no variant of the registry's ladder is 26px — its smallest is 24 and
 * its `sm` is 32 — and the header's height is set by the 28px mark beside this
 * control, so a taller button would move the header.
 *
 * The icon names the mode it switches *to* — a moon in the light scheme — and both
 * icons live in the markup together with the words that name them, which are hidden
 * from sight and read out instead. Which pair is live is decided by the stylesheet
 * from `data-color-scheme`, not by React state: the server cannot know the operating
 * system's preference, so a value read during render would either mismatch on
 * hydration or briefly lie and then correct itself. The same constraint is why the
 * button carries no `aria-label` — a label written here is one fixed string, and it
 * would name the wrong mode in one of the two schemes — and why the click reads the
 * scheme off the document instead of holding it.
 *
 * Icons are Phosphor from Iconify, compiled in at build time; see
 * `docs/adr/0009-phosphor-icons-through-iconify.md`.
 */
export function ThemeToggle() {
  /*
   * While the visitor has not chosen, the operating system is followed *live*: both
   * macOS and Windows switch on a schedule, and a page that only read the preference
   * at load would sit in the wrong scheme until it was reloaded. The listener writes
   * the attribute and never the storage, and it goes inert the moment a choice exists.
   */
  useEffect(() => watchSystemScheme(), []);

  return (
    <Button
      className="touch-target h-[26px] rounded-sm border-input bg-card px-2 text-sm leading-none font-semibold text-foreground hover:bg-secondary dark:bg-card dark:hover:bg-secondary"
      onClick={() => applyScheme(currentScheme() === "dark" ? "light" : "dark")}
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
