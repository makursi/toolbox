"use client";

/**
 * The cover generator editor.
 *
 * Ticket #51 (tool spine) renders the composition area's scaffold: the preview
 * canvas frame with its ratio badge. The editor arrives in later slices — the
 * state model and the export in #52, the left column + canvas layout in #53,
 * the icon system in #54, and so on. The ratio is hard-wired to the default
 * here until #52 gives it state.
 */
export function CoverGenerator() {
  return (
    <div className="mt-10 sm:mt-12">
      {/* The canvas the composition will be drawn on. One frame, preview = export:
          the badge is real copy (the default ratio), not invented content. */}
      <div
        className="relative w-full overflow-hidden rounded-md border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-body)]"
        style={{ aspectRatio: "16 / 9" }}
      >
        <span className="absolute top-2 left-2 text-sm text-[var(--mantine-color-dimmed)]">
          16:9
        </span>
      </div>
    </div>
  );
}
