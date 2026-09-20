# Icons come from Phosphor, compiled in by Iconify at build time

The site had no icon set, and four things a reader sees as pictures were typographic glyphs standing in for them: `+` / `−` on the advanced-options disclosure, `→` on the Tool card, `←` on the Tool page's way back, and the words 深色 / 浅色 on the colour-scheme switch. The design language names Phosphor for icons, and ADR-0007 recorded why none was installed: three characters do not justify a dependency. That reasoning held while it did.

Two things changed it. The scheme switch is the first control whose affordance is genuinely a picture — a word for "dark" is not an icon — and the glyphs turned out to be font-dependent: `→`, `+` and `−` fall back to whichever CJK font the operating system supplies, so their width and stroke weight differ between macOS and Windows, and `＋` can come out full-width. That is the same root cause as the CJK font note in section 3 of `apps/web/docs/design.md`; this instance of it is fixable.

Icons are therefore compiled in from Phosphor through Iconify's Tailwind v4 plugin: `@plugin "@iconify/tailwind4"` in `apps/web/src/app/globals.css`, with `@iconify-json/ph` supplying the icon data. An icon is written as a literal class name — `icon-[ph--moon-bold]` — and the plugin turns it into one rule holding the icon as a `data:` URI in a custom property, painted through `mask-image` in `currentColor`.

Why this route and not the others:

- **Nothing may be fetched at runtime**, and the CSP enforces that rather than a promise doing it (ADR-0005). `@iconify/react` requests `api.iconify.design` by default, which `img-src 'self' blob: data:` blocks, so the icon data has to reach the browser in the bundle — and the build is the only place it can get there.
- **A `currentColor` mask takes the colour of the text it sits in**, so the design tokens apply to an icon for free, and the light/dark switch that decides which icon is on screen is the stylesheet rule that was already there (ADR-0008).
- **No wrapper component.** Tailwind reads class names out of the source, so a name assembled in code (`icon-[ph--${weight}]`) is never compiled and the icon silently does not exist. The name is written out where it is used, and `apps/web/src/app/__tests__/icons.test.ts` fails on a name that is missing from the set or not a literal.

Weights are Phosphor's **bold** throughout — one weight for every icon — because the design language names Phosphor's bold or fill weights and asks for one stroke width across a set. Size stays at the plugin's default of `1em`, so an icon is sized by the text around it and there are no icon-specific size tokens.

## Consequences

- `@iconify/tailwind4` and `@iconify-json/ph` are **dev** dependencies of `apps/web`: the icon sets are read while Tailwind builds the CSS, so none of that data ships. Only the icons named in the source are compiled — the set is over 9000 icons and the bundle holds six.
- **`icon-[ph--x]` is a class name, not a component.** Keeping it working means never building the name dynamically. That is now a rule with a test behind it rather than a convention to remember.
- The colour-scheme switch is **icon-only, with no visible word**, so its accessible name is `sr-only` text that sits in the markup twice, one pair per scheme, with `[data-mantine-color-scheme]` deciding which is live. An `aria-label` was not an option: the server cannot know the system's preference, so a label written in the component would name the wrong mode half the time. The hidden words did buy something the visible ones could not afford — the name is a sentence now («切换到深色»), not a bare colour word.
- `.icon` in `globals.css` carries the two properties an icon class cannot: `flex-shrink: 0`, and the `-0.125em` nudge that puts an inline-block icon on the same line as the text beside it.
- `.vscode/extensions.json` is committed — `.gitignore` ignores `.vscode/*` and un-ignores that one file — so the extension that previews and completes `icon-[ph--...]` names travels with the repository.
- Drawing an icon by hand is now closed off: adding one means naming a Phosphor icon.

## Considered Options

- **Keep the glyphs, add a sun and a moon only**: rejected. One real icon beside three fonts' worth of glyphs is the worst of both; the font-dependence argument covers the other three as well.
- **Inline SVG components** (`@iconify/react` with per-icon imports, or `unplugin-icons`): rejected — a React icon component needs a client boundary, and the card and the Tool page are Server Components today, so it buys SVG in the DOM with client JavaScript on pages that currently ship none; `unplugin-icons` additionally needs bundler wiring, which is a poor fit for Next's Turbopack build.
- **Hand-drawn SVG for the four glyphs**: rejected — the design language bans hand-rolled icons outright, and four drawings to keep consistent is the cost this decision exists to avoid.
- **`@phosphor-icons/react`** (a library both skill protocols allow): rejected for the same reason as the inline-SVG route, and it is a second delivery mechanism for the same icon set.
