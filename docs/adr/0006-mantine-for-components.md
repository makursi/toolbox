# Mantine for components, Tailwind for utilities

> **Superseded by [ADR-0016](0016-the-component-layer-is-shadcn-ui-again.md)** (2026-10-05). The premise this ADR was decided on has changed — the registry answers through a local wrapper, measured with exit code 0 — and its reasoning has not: the aliased imports still make hand-vendoring the registry a build step, so that rejected option stays rejected. Everything below is the reasoning as it was recorded, unedited.

`apps/web` was scaffolded with shadcn/ui, which never became usable here: its components are distributed through a registry the CLI fetches from `ui.shadcn.com`, and that host is unreachable from this environment — every `shadcn add` failed with `ECONNRESET`, having already written a `cn` dependency into `package.json` before giving up. The style it was configured with (`radix-nova`) is also not self-contained: its components use semantic class names (`cn-button`) that a 75 KB `style-nova.css` layer provides, and the CLI is what rewires the components' `from "cn"` imports to the project's alias. Hand-copying that from the repository would be vendoring a build step, not installing a library.

Mantine replaces it: it is a normal npm dependency, it ships its own styles, and its components are documented to coexist with Tailwind. shadcn was removed completely — the package, `components.json`, its CSS imports, and the design tokens `shadcn init` had written into `globals.css`, along with the `cn` helper and the `clsx`/`tailwind-merge` pair that existed only to build it. The two pages that used those tokens were rewritten with Mantine components, so the site now has one design system rather than a half-removed one.

The trade: Mantine is a larger dependency than copying a handful of components, and its visual language is not ours to edit in place. In exchange, every component arrives labelled, keyboard-operable and maintained, which is most of what the image Tool needs — and nothing depends on a registry being reachable.

## Consequences

- **Mantine's `.layer.css` entry points are mandatory here, not optional.** In Next.js the order of stylesheet imports cannot be controlled, so Mantine ships its styles wrapped in `@layer mantine` for exactly this case. `globals.css` declares `@layer theme, base, mantine, components, utilities` before its imports, which is what leaves Tailwind's utilities able to override Mantine rather than the other way round. The built stylesheet confirms the order: `theme` → `base` → `mantine` → `components` → `utilities`.
- Importing `styles.css` instead of `styles.layer.css` would look fine and silently make Tailwind utilities lose to Mantine. Changing `globals.css` carelessly can reintroduce that.
- `next.config.ts` sets `experimental.optimizePackageImports` for `@mantine/core` and `@mantine/hooks`, which is the tree-shaking hint Mantine's Next.js guide asks for.
- `postcss-preset-mantine` is **not** installed. It exists to give _our own_ CSS modules Mantine's mixins and breakpoint variables; this repo writes no Mantine CSS modules, so it would be configuration with nothing behind it. It becomes necessary the first time a Tool ships a `*.module.css` using Mantine's mixins.
- Mantine's default font is a system stack and its design tokens are emitted as CSS variables by `MantineProvider`, so nothing is fetched from a third-party host — `docs/adr/0005-no-outbound-requests.md` still holds.
- The toolbar's sliders and the file drop zone are the two places where the library's own accessibility needed help: `Slider`'s accessible name comes from `thumbLabel` (`thumbProps` is dropped by the thumb component), and the `Dropzone` root is called a presentation element by react-dropzone, so it is given `role="button"` and a label. Both would otherwise be quietly unnamed to a screen reader.
- Tailwind stays, as the utility layer the docs describe combining with Mantine (`classNames={{ input: 'mt-4' }}`), and as an escape hatch for the few places where a utility reads better than a prop. The `tailwind-merge`/`clsx` pair and shadcn's colour tokens went with shadcn; Tailwind's own palette and utilities did not.

## Considered Options

- **Keep shadcn and vendor the registry by hand**: rejected — it means owning a generated style layer and hand-rewriting imports on every component addition, with no way to verify the result in this environment.
- **Drop Tailwind as well and style everything with Mantine props**: rejected as a bigger change than asked for. Mantine has no utility classes, so page layout would lose its terse form, and ADR-0002's Tailwind class sorting in Oxfmt is configured against it.
- **Mantine with `postcss-preset-mantine`**: deferred, not rejected — see the consequence above.
- **Copy the components' markup without the library**: rejected — the accessibility and keyboard behaviour is the reason to use Mantine at all.
