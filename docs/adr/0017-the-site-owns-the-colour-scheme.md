# The site owns the colour scheme

`data-mantine-color-scheme` on `<html>` was written before the first paint by the outgoing component library's manager, and its hooks read it back. The incoming layer's dark variant was defined against that attribute rather than adding a second one (ADR-0008, #126), which was the right call while the library was there: two mechanisms deciding one scheme would disagree the moment a visitor chose a scheme the system did not prefer. The library left in #168, and the attribute, the storage key and the two hooks the switch used went with it.

## Decision

1. **One attribute, named after this site**: `data-color-scheme` on `<html>`, written before the first paint. The tokens' dark block, Tailwind's `dark` variant and the switch's two icons are all defined against it.
2. **One key**: `toolbox-color-scheme` in `localStorage`, holding `light` or `dark` and nothing else. `auto` is deliberately not a value the site stores — "follow the system" is what _not_ having a value means.
3. **One module**: `apps/web/src/lib/color-scheme.ts` holds the whole policy — what a stored value means, the script that runs in the head, the write, the read, and the watcher. The switch is the only thing that calls it.
4. **The system is followed while the visitor has not chosen**, including while the page is open: a `matchMedia` listener, which is what the library's `auto` did. The watcher writes the attribute and never the key — the system's current answer is not the visitor's choice.
5. **A failure to read storage is not a failure to paint.** Every access is guarded, and the fallback is light: a page that throws in its head renders unstyled rather than in the wrong scheme.

## Consequences

- The old attribute name is gone from the stylesheet, the token module, the layout and the docs. `data-mantine-color-scheme` survives only in the history in `apps/web/docs/design/log.md` and in the ADRs that predate this one.
- **A visitor's stored choice is reset once.** The old key is not read: keeping it would keep the library's name in the site's own module forever, and the value is a preference rather than data. The next time the switch is used, the choice is stored under the new key.
- The scheme is covered by the gate now (`apps/web/e2e/colour-scheme.spec.ts`), which it never was while the library owned it. The ticket's own user story names that risk — "the site's manual switch is not lost with the library that happened to implement it" — and a spec was the only way to answer it rather than assert it.
- `apps/web/src/app/theme.ts` and `apps/web/src/app/providers.tsx` are gone. With the runtime resolver gone the tokens have one end — the module plus the custom properties the layout emits — which is what "the two ends of the token source become one" means.
- The document's typography (family, 16px, a 1.7 leading, the text and canvas tokens) moved into `globals.css`, because the library's global stylesheet was what provided it and every anchor both Instruments read inherits from there. The layer swap's fingerprint came back `ALL IDENTICAL`, which is that rule being right rather than plausible.

## Considered Options

- **Keep `data-mantine-color-scheme` as the attribute name.** Rejected: the site would carry a departed library's name in the one attribute that decides how it looks, and the next reader would have to find out why.
- **Read the old storage key as a fallback, then migrate it.** Rejected: it keeps the library's name in the site's own module for a preference the visitor can set again in one click.
- **Store `auto` and resolve it at read time.** Rejected: it is a third state the switch cannot show, and no value already means exactly that.
- **Drop the live system watcher.** Rejected: macOS and Windows both switch to dark on a schedule, and a page that read the preference only at load would sit in the wrong scheme until it was reloaded. It was the library's behaviour and there was no argument for losing it.
- **Hold the scheme in React state** (`useSyncExternalStore` over the media query). Rejected: the server cannot know the visitor's choice, so a value read during render either mismatches on hydration or lies and then corrects itself — the same reason the icons are chosen by the stylesheet (ADR-0008's update).
