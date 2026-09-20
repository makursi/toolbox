# A warm monochrome design language, in both colour schemes

> **Partly superseded by ADR-0009**: the site now has an icon set (Phosphor, through Iconify at build time), so the disclosure no longer uses the `+` / `−` glyphs and the reason given below for having no icon library no longer applies.

The site had no design language of its own. Mantine's defaults sat on top of the colour tokens `shadcn init` had written before shadcn was removed (ADR-0006), which left the light scheme a pure white canvas and no dark scheme at all. This records what replaced that: a warm monochrome with no accent colour, in both schemes, following the operating system's preference.

Two skill protocols were consulted and one was chosen as the language: **`minimalist-ui`** supplies the palette, the typographic hierarchy, the whitespace and the component specifications, while **`design-taste-frontend`** (the default skill of the `taste-skill` family) supplies the gates — its §6 accessibility and performance rules, its §9 list of AI tells, its §11 redesign protocol and the §14 pre-flight check that has to pass before the work counts as done.

**The design doc set is the living version of this decision** — `apps/web/docs/design.md` is its entry and routes to the modules: the tokens as they stand, the rules for new work, the checklist to run before merging, and what is still unfinished. This ADR records why the language exists; that set records what it currently is, and the two are meant to be read together.

## The tokens

Canvas `#f7f6f3`, surface `#fbfaf8`, text `#111111`, muted `#6b6862` and hairline `#eaeaea` in light; `#171614`, `#1f1e1c`, `#edebe8`, `#a5a19a` and `#313030` in dark. There is **no accent colour**: the only colour in the interface is the one that carries meaning, which is an error.

Every pair was measured with a WCAG contrast calculator rather than judged by eye, and one measurement changed the design: the muted tone the reference suggests, `#787774`, is **4.14:1 on the canvas and fails AA**, so it became `#6b6862` (5.14:1). The first placeholder colour, `#8a877f`, was worse at 3.44:1 on the input surface and became `#75726a` (4.61:1). Body text is 17.47:1 light and 15.20:1 dark.

Type is Geist Sans with Geist Mono for code and tabular figures, self-hosted by `next/font` at build time so that a webfont never becomes a third-party request at runtime. No serif: an editorial serif was the alternative, and it was rejected because it reopens a settled choice and adds a font file to buy a mood the brief does not ask for.

## Consequences

- The tokens live in `apps/web/src/app/theme.ts` as a Mantine `createTheme` plus a `cssVariablesResolver`, **not in a stylesheet**. Mantine writes its own variables at runtime, after our stylesheet, so a plain CSS override of `--mantine-color-body` would lose the cascade; the resolver is the supported path and the only one that reliably wins.
- `cssVariablesResolver` is a function, and a Server Component may not hand a function to a Client Component, so the provider tree moved into `apps/web/src/app/providers.tsx` with `"use client"`. This is the pattern Mantine's own Next.js guide describes, and the build enforces it.
- Two Mantine style props do not accept breakpoint objects (`py` and `gap` are typed as spacing, not as responsive values), so responsive page padding is written as Tailwind utilities. That is deliberate, and it is the reason Tailwind keeps its place in the App after ADR-0006: the utilities layer sits after `mantine` in `globals.css`, so a utility reliably wins over a Mantine default.
- Cards are flat: a hairline border from the token, a maximum radius of 8px for containers and 4px for controls, and no shadow except a 4%-opacity lift on hover. Stated as a consequence because "no shadow" is the first thing a later reader will be tempted to "fix".
- Disclosures use the glyphs `+` and `−` rather than icons, so no icon library is installed. A `+` is typography, not a hand-rolled SVG icon, and it carries the same information.
- Motion is CSS only, gated behind `prefers-reduced-motion: no-preference`: a 600ms fade-up on load rather than a scroll-triggered reveal, because the page has two blocks and both are above the fold, so a scroll observer would be machinery with nothing to observe.
- The scheme is `auto` in both `ColorSchemeScript` and `MantineProvider`, so the site follows the operating system. **Both schemes are defined but only the light one has been seen in a browser** — see the Tool README's checklist, which asks for both.
- Images stay self-hosted: the design calls for a logo and a per-Tool cover, the cover is optional in `ToolMeta` so no Tool waits on artwork, and no placeholder graphic is invented to stand in for one. ADR-0005 still forbids the remote image sources the skill protocol would otherwise reach for.

## Considered Options

- **`high-end-visual-design`, also installed**: rejected. It is a good skill that contradicts this one where it matters most — it bans the `1px` hairline border that this design is built from and requires pill-shaped primary buttons, which `minimalist-ui` bans outright. Two rules that flatly disagree, in the same project, is a conflict rather than a fusion.
- **`antfu-design`**: rejected — it assumes UnoCSS, and this App is Tailwind v4 with Mantine.
- **An editorial serif headline**: rejected, as above.
- **An icon library** (`@phosphor-icons/react`, which both skills allow): rejected — the interface needs two disclosure glyphs and one arrow, and a dependency for three characters is not a trade worth making.
- **Placeholder images from a public source**: rejected — `picsum.photos` and Simple Icons are both blocked by the CSP, and relaxing it would break ADR-0005 for the sake of a placeholder.
