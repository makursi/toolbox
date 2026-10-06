import type { Scheme } from "@/lib/tokens";

/**
 * The colour scheme, and who writes it.
 *
 * One module, because there is exactly one owner: the scheme is resolved **before the
 * first paint** from the visitor's stored choice (or, with no choice, from the
 * operating system) and written to one attribute on `<html>`; the stylesheet's `dark`
 * variant and this site's tokens are both defined against that attribute, and the
 * header's switch is the only thing that changes it afterwards.
 *
 * Until #168 that owner was the outgoing component library's manager: its
 * `ColorSchemeScript` wrote `data-mantine-color-scheme` in the head, and its
 * `useColorScheme` hooks read it. The attribute is named after this site now
 * (`data-color-scheme`) and so is the storage key, which is a **one-time reset**: a
 * visitor who had chosen a scheme keeps it from their next choice onwards, because
 * reading the library's key would keep the library's name in this file forever. The
 * decision is `docs/adr/0017-the-site-owns-the-colour-scheme.md`.
 *
 * Two halves, and they cannot be one: the script below is a *string* that has to run
 * in the document's head before anything paints, so it cannot import this module. The
 * storage key is interpolated from here rather than typed twice, and the parse — the
 * one piece with a rule in it — is a pure function with a unit test.
 *
 * `Scheme` is the token module's type rather than a second declaration of the same two
 * words: the values are per-scheme there, so that is where the concept is named.
 */

/** The one key, and the one attribute. Both are this site's. */
export const SCHEME_STORAGE_KEY = "toolbox-color-scheme";
export const SCHEME_ATTRIBUTE = "data-color-scheme";

/**
 * What a stored value means.
 *
 * `null` for anything that is not one of the two schemes — absent, or a value some
 * other version of this site wrote. It is deliberately not "default to light": an
 * unreadable value has to fall through to the operating system, which is the same
 * answer an empty storage gets. `auto` is not a value this site stores: the switch is
 * two-state, and "follow the system" is what *not* having a value means.
 */
export function parseScheme(value: string | null | undefined): Scheme | null {
  return value === "light" || value === "dark" ? value : null;
}

/** The scheme the operating system asks for, from a media query's answer. */
export function systemScheme(prefersDark: boolean): Scheme {
  return prefersDark ? "dark" : "light";
}

/**
 * The script that runs before the first paint.
 *
 * It is written to be as small as it can be while still being honest: it reads the
 * stored value, falls back to the operating system, and writes the attribute. Every
 * access is inside the `try`, because storage throws in a browser that has it
 * disabled (Safari's private mode did for years) and a page that throws in its head
 * renders unstyled rather than in the wrong scheme.
 *
 * `document.documentElement.dataset.colorScheme` is `data-color-scheme`: the dataset
 * property is the attribute with the dashes turned into camel case, which is why the
 * name is spelled once, here, as a string.
 */
export function colorSchemeScript(): string {
  return `try {
  var stored = window.localStorage.getItem(${JSON.stringify(SCHEME_STORAGE_KEY)});
  var scheme = stored === "light" || stored === "dark" ? stored : null;
  if (scheme === null) {
    scheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.dataset.colorScheme = scheme;
} catch (error) {
  document.documentElement.dataset.colorScheme = "light";
}`;
}

/**
 * Write one scheme, and remember it.
 *
 * The only writer after the first paint, and the only thing the switch calls. The
 * storage write is guarded for the reason the script's is: a browser that refuses
 * storage must still get the scheme the visitor asked for, for as long as the page
 * is open.
 */
export function applyScheme(scheme: Scheme): void {
  document.documentElement.dataset.colorScheme = scheme;
  try {
    window.localStorage.setItem(SCHEME_STORAGE_KEY, scheme);
  } catch {
    // The attribute is set; the choice simply will not survive the next load.
  }
}

/**
 * The scheme in force right now, read off the document.
 *
 * Read at the moment of a click rather than held in React state: the server cannot
 * know the visitor's choice, so a value read during render would either mismatch on
 * hydration or briefly lie and then correct itself. The same constraint is why the
 * switch's two icons are chosen by the stylesheet.
 */
export function currentScheme(): Scheme {
  return document.documentElement.dataset.colorScheme === "dark" ? "dark" : "light";
}

/** The stored choice, or `null` — including when storage refuses to be read. */
function readStoredScheme(): Scheme | null {
  try {
    return parseScheme(window.localStorage.getItem(SCHEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Follow the operating system while the visitor has not chosen, and stop the moment
 * they have. Returns the cleanup for the effect that calls it.
 *
 * This is the half of "follow the system" that a page load cannot do: macOS and
 * Windows both switch to dark on a schedule, and a visitor who has never touched the
 * switch should see that happen rather than having to reload. It writes the attribute
 * and **not** the storage — the OS's current answer is not the visitor's choice, and
 * storing it would make the next load ignore a later change of system preference. Once
 * a choice exists the listener is inert, which is the one-owner rule holding: the
 * switch is what writes a choice, and this is what resolves the absence of one.
 */
export function watchSystemScheme(): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const follow = () => {
    if (readStoredScheme() !== null) return;
    document.documentElement.dataset.colorScheme = systemScheme(media.matches);
  };

  follow();
  media.addEventListener("change", follow);
  return () => media.removeEventListener("change", follow);
}
