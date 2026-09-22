# The Image Converter has no output settings

> **Scope**: this decision binds the Image Converter and no other Tool. A new
> Tool's export surface — format, ratio, quality, filename — is its own product
> decision; nothing here is inherited. See
> `docs/adr/0014-tool-scoped-rules-live-with-the-tool.md`.

> **Updated 2026-09-18**: the quality slider, the 无损 switch and the Advanced panel went too, which makes this title literally true — the only thing a Conversion sets is the format it is encoded to, and the section is five checkboxes. Quality now comes from `formatSpecs.quality` for the three codecs that take one (`core/formats.ts`; one number per codec as before, AVIF 50 and the rest 75) and PNG's oxipng level is a constant beside the PNG encoder in `worker/worker.ts` (`pngOptimisationLevel`, 2) — BMP takes neither. WebP and AVIF are always lossy, and `core/options.ts`, `core/advanced.ts` and the `LosslessMode` type went with the controls. The reasoning is the one below, applied to the controls that were still left.

Resizing, rotating and choosing the colour that transparent pixels fall back to
are things a phone's own photo editor does better, and on a 390px screen they
were three controls with three help lines standing between the format list and
the Convert button. The Tool is "pick the formats, convert"; whoever needs a
1600px copy makes one in Photos, before or after. A Tool page that needs a wide
screen to make sense of its own form is the shape this one is getting away from.

## Consequences

- `core/geometry.ts` and its tests, the rotate and resize steps in the Worker,
  and the `@jsquash/resize` dependency went with the controls. ADR-0004 counted
  that dependency as ~150 KB of WebAssembly that shipped whether or not anyone
  resized anything, so the removal paid for itself twice.
- Transparent pixels still have to land somewhere in JPEG and BMP, so the Worker
  flattens onto **pure white** — `flattenBackground` in `core/formats.ts`. That
  is a pixel in the visitor's own file rather than a surface of the interface,
  which is why the ban on pure white in `apps/web/docs/design/colour.md` does not
  reach it; the comment there in `formats.ts` says so where the next reader will
  be standing.
- Nothing is kept behind the interface for later. The history is in git, and a
  code path nobody can reach is still a code path somebody has to read, type and
  keep green.

## Considered Options

- **Keeping the controls for wide screens** (`hidden` below `md`): rejected. The
  controls are one layout, not three, and "the mobile version hides it" is how
  one form grows two behaviours that drift apart.
- **Keeping the plumbing without the controls**: rejected — dead code with a test
  suite that has to be maintained for nothing.
- **Flattening onto the light scheme's canvas instead of white**: rejected. A
  warm cast on every exported JPEG that nobody asked for and nobody would think
  to check.
