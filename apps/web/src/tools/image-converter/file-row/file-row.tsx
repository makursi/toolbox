import { Button } from "@/components/ui/button";

import { formatSpecs } from "../core/formats";
import type { QueuedFile } from "../hooks/use-file-queue/use-file-queue";
import { useFileThumbnail } from "../hooks/use-file-thumbnail/use-file-thumbnail";

/**
 * One file in the list under 添加图片: its picture, its name, and the format its
 * own bytes say it is.
 *
 * A component rather than a fragment inside the list's `map`, because the
 * thumbnail is state: a hook cannot be called in a loop, and the picture has to
 * belong to the row it is in so that removing one row revokes one URL.
 *
 * The format label comes from the sniffer, never from the extension. A HEIC
 * renamed to `.jpg` never reaches the list (see `core/admission.ts`), so the
 * label is always what the file really is, whatever it is called.
 *
 * Drawn by the incoming layer since #165, with the outgoing layer's numbers read off
 * the built page: a 61px row (a 40px picture, 10px above and below, and its own
 * hairline), a 12px gap inside it, 14px copy on a 1.45 line, and a 28x28 remove
 * control at an 8px radius. The cross is a Primitive with this site's own icon
 * (`ph--x-bold`), because the outgoing layer's `CloseButton` drew its own SVG — and
 * its colour is `text-muted-foreground`, this site's dimmed tone, where the library
 * used a grey from its own palette (measured `rgb(184, 184, 184)` in the dark
 * scheme, against this site's `rgb(165, 161, 154)`).
 *
 * `data-slot="file-row"` is an anchor, not a style: it is a repeated region, like
 * the homepage's cards, and it is what lets the fingerprint read the row's own box
 * and computed styles before and after a change to it.
 */
export function FileRow({
  disabled,
  entry,
  onRemove,
}: {
  disabled: boolean;
  entry: QueuedFile;
  onRemove: () => void;
}) {
  const thumbnail = useFileThumbnail(entry.file);

  return (
    <div className="file-row flex items-center justify-between gap-4 py-2.5" data-slot="file-row">
      {/* `min-w-0` twice: both this group and the name inside it are flex items,
          and a flex item will not shrink below its content unless it is told it
          may — which is what lets a long name truncate instead of pushing the
          format off the row. */}
      <div className="flex min-w-0 items-center gap-3">
        {/* The frame is always here so the name cannot jump sideways when the
            picture arrives, and it draws nothing until there is one to draw: a
            file that will not decode leaves an empty box, not an empty frame. */}
        <span className="file-preview">
          {thumbnail !== null && (
            // oxlint-disable-next-line nextjs/no-img-element -- the source is a `blob:` URL that exists only in this tab, so there is no optimizer that could fetch it, and the bitmap is already the 80px one this box shows.
            <img alt="" className="file-preview-image rounded-md" src={thumbnail} />
          )}
        </span>
        <p className="min-w-0 truncate text-sm leading-[1.45]">{entry.file.name}</p>
        <p className="text-sm leading-[1.45] text-muted-foreground">
          {formatSpecs[entry.format].label}
        </p>
      </div>
      {/* The class sits on the button and not on the row: the button is the element
          that owns this click, and an overlay on the row would take it instead.
          `p-0` is not decoration: the registry's button carries `px-4 py-2` of its
          own, and a 28px box with 16px of inline padding on each side is a 32px box
          whose icon spills — measured as `@32x28` where the outgoing layer's cross
          was 28x28, which is what the fingerprint caught. */}
      <Button
        aria-label={`移除 ${entry.file.name}`}
        className="touch-target size-7 rounded-lg p-0 text-[16px] text-muted-foreground hover:bg-secondary dark:hover:bg-secondary"
        disabled={disabled}
        onClick={onRemove}
        variant="ghost"
      >
        <span aria-hidden className="icon icon-[ph--x-bold]" />
      </Button>
    </div>
  );
}
