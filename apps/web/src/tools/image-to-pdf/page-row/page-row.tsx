"use client";

import { Button } from "@/components/ui/button";
import { pageGeometry, type Paper } from "@/tools/image-to-pdf/core/geometry";
import { removeLabel } from "@/tools/image-to-pdf/core/hints";
import type { PageEntry } from "@/tools/image-to-pdf/hooks/use-page-list/use-page-list";
import { usePageThumbnail } from "@/tools/image-to-pdf/hooks/use-page-thumbnail/use-page-thumbnail";

/**
 * One row of the page list: its page number, a miniature of the page it will
 * become, its file's name, and its remove control.
 *
 * The miniature is drawn from `pageGeometry` — the same function the PDF writer
 * calls — so the paper's proportions and the image's letterboxing inside it
 * cannot disagree with the download. That is the point of the row being a page
 * miniature rather than a thumbnail.
 *
 * The remove control is a real `<button>` carrying `.touch-target` itself: an
 * overlay on the row would take the pointer while the keyboard kept working.
 */
export function PageRow({
  entry,
  index,
  paper,
  disabled,
  onRemove,
}: {
  entry: PageEntry;
  index: number;
  paper: Paper;
  disabled: boolean;
  onRemove: () => void;
}) {
  const thumbnail = usePageThumbnail(entry.file);
  const geometry = pageGeometry({ width: entry.width, height: entry.height }, paper);

  // Geometry's origin is the page's lower-left corner; CSS positions from the
  // upper-left, so the top is what remains above the rectangle.
  const inset = {
    left: `${String((geometry.image.x / geometry.page.width) * 100)}%`,
    top: `${String(
      ((geometry.page.height - geometry.image.y - geometry.image.height) / geometry.page.height) *
        100,
    )}%`,
    width: `${String((geometry.image.width / geometry.page.width) * 100)}%`,
    height: `${String((geometry.image.height / geometry.page.height) * 100)}%`,
  };

  return (
    <div className="file-row flex items-center gap-3 py-2.5" data-slot="pdf-page-row">
      <span className="w-11 shrink-0 text-sm leading-[1.45] text-muted-foreground">
        {`第 ${String(index + 1)} 页`}
      </span>

      {/*
        The page miniature. Its box is the paper's own ratio, and the image's
        rectangle is positioned inside it as percentages of that box, so it
        scales with the frame at any width without a second geometry rule.
      */}
      <div
        aria-hidden
        className="relative h-14 shrink-0 overflow-hidden rounded-sm border border-border bg-card"
        data-slot="pdf-page-miniature"
        style={{ aspectRatio: `${String(geometry.page.width)} / ${String(geometry.page.height)}` }}
      >
        {thumbnail !== null && (
          // oxlint-disable-next-line nextjs/no-img-element -- the source is a `blob:` URL that exists only in this tab, so there is no optimizer that could fetch it, and the bitmap is already the small one this box shows.
          <img
            alt=""
            className="absolute block h-full w-full object-fill"
            src={thumbnail}
            style={inset}
          />
        )}
      </div>

      <p className="min-w-0 flex-1 truncate text-sm leading-[1.45]">{entry.file.name}</p>

      {/*
        A real button, 44px square, with the class on it: it owns the click. The
        icon is decoration, so the accessible name is the word.
      */}
      <Button
        aria-label={removeLabel}
        className="touch-target size-11 shrink-0 p-0"
        disabled={disabled}
        onClick={onRemove}
        variant="ghost"
      >
        <span aria-hidden className="icon icon-[ph--x-bold]" />
      </Button>
    </div>
  );
}
