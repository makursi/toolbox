"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { pageGeometry, type Paper } from "@/tools/image-to-pdf/core/geometry";
import {
  orderHandleLabel,
  orderRoleDescription,
  removeLabel,
} from "@/tools/image-to-pdf/core/hints";
import type { PageEntry } from "@/tools/image-to-pdf/hooks/use-page-list/use-page-list";
import { usePageThumbnail } from "@/tools/image-to-pdf/hooks/use-page-thumbnail/use-page-thumbnail";

/**
 * One row of the page list: its drag handle, its page number, a miniature of the
 * page it will become, its file's name, and its remove control.
 *
 * The miniature is drawn from `pageGeometry` — the same function the PDF writer
 * calls — so the paper's proportions and the image's letterboxing inside it
 * cannot disagree with the download. That is the point of the row being a page
 * miniature rather than a thumbnail.
 *
 * The handle is a real `<button>` carrying `.touch-target` itself, and it is the
 * only activator `useSortable` listens to. An overlay on the row would be a
 * target that handles nothing: its clicks land on the element that generates it,
 * the keyboard would keep working, and a pointer drag would silently do nothing.
 * The remove control is built the same way for the same reason.
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
  // The browser's decode already applies the EXIF turn, so the miniature's
  // picture is upright; the geometry is laid out for the turned dimensions, and
  // the two agree on the aspect ratio.
  const thumbnail = usePageThumbnail(entry.file);
  const geometry = pageGeometry(
    { width: entry.width, height: entry.height },
    paper,
    entry.orientation,
  );

  /*
   * The row is the draggable node; the handle is its activator. dnd-kit's
   * `transform` is what carries the row while a drag is in flight, and the
   * transition that makes the other rows slide out of the way is a class rather
   * than dnd-kit's inline value, so `prefers-reduced-motion` can turn it off
   * without a second rule.
   */
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef, transform } =
    useSortable({
      id: entry.id,
      disabled,
      attributes: { roleDescription: orderRoleDescription },
    });

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
    <div
      className={`file-row flex items-center gap-3 py-2.5 ${
        isDragging
          ? "relative z-10 bg-card"
          : "transition-transform duration-200 motion-reduce:transition-none"
      }`}
      data-dragging={isDragging || undefined}
      data-slot="pdf-page-row"
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform) }}
    >
      {/*
        The handle owns the drag. `.touch-target` is on the button itself, the
        name is the same on every row, and `touch-none` is what lets a finger
        drag this row instead of scrolling the page: the gesture belongs to the
        handle, which is what a handle is for.
      */}
      <Button
        {...attributes}
        {...listeners}
        aria-label={orderHandleLabel}
        className="touch-target size-11 shrink-0 touch-none p-0 text-muted-foreground"
        disabled={disabled}
        ref={setActivatorNodeRef}
        variant="ghost"
      >
        <span aria-hidden className="icon icon-[ph--dots-six-vertical-bold]" />
      </Button>

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
