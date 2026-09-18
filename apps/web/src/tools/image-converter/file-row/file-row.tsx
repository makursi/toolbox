import { CloseButton, Group, Text } from "@mantine/core";

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
    <Group className="file-row" justify="space-between" wrap="nowrap">
      {/* `min-w-0` twice: both this group and the name inside it are flex items,
          and a flex item will not shrink below its content unless it is told it
          may — which is what lets a long name truncate instead of pushing the
          format off the row. */}
      <Group className="min-w-0" gap="sm" wrap="nowrap">
        {/* The frame is always here so the name cannot jump sideways when the
            picture arrives, and it draws nothing until there is one to draw: a
            file that will not decode leaves an empty box, not an empty frame. */}
        <span className="file-preview">
          {thumbnail !== null && (
            // oxlint-disable-next-line nextjs/no-img-element -- the source is a `blob:` URL that exists only in this tab, so there is no optimizer that could fetch it, and the bitmap is already the 80px one this box shows.
            <img alt="" className="file-preview-image" src={thumbnail} />
          )}
        </span>
        <Text className="min-w-0" size="sm" truncate>
          {entry.file.name}
        </Text>
        <Text c="dimmed" size="sm">
          {formatSpecs[entry.format].label}
        </Text>
      </Group>
      <CloseButton
        aria-label={`移除 ${entry.file.name}`}
        className="touch-target"
        disabled={disabled}
        onClick={onRemove}
      />
    </Group>
  );
}
