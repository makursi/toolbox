"use client";

import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  FileButton,
  Flex,
  Group,
  Paper,
  Progress,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { useCallback, useMemo, useState } from "react";

import { useObjectUrl } from "@/hooks/use-object-url/use-object-url";

import { addedSummary } from "./core/counts";
import { formatSpecs, imageFormats, type ImageFormat } from "./core/formats";
import { convertHint } from "./core/hints";
import { FileRow } from "./file-row/file-row";
import { useConversionBatch } from "./hooks/use-conversion-batch/use-conversion-batch";
import { useFileQueue } from "./hooks/use-file-queue/use-file-queue";
import type { Outcome } from "./worker/converter";
import { zipConversions } from "./zip";

/**
 * The image converter, client-side by necessity: the codecs are WebAssembly
 * running in a Worker and the files never leave the tab.
 *
 * Two things this file is not: it does not hold the visitor's files (that is
 * `useFileQueue`) and it does not run a Batch (that is `useConversionBatch`).
 * What is left is the form — which target formats are on, and the words around
 * it — because a Conversion has no settings beyond the format it is encoded to
 * (see `docs/adr/0010-no-output-settings.md`).
 *
 * The controls are Mantine components, so labels, roles and keyboard behaviour
 * come from the library rather than being re-derived here — which is also why
 * the file input is a `Dropzone`: it is clickable, droppable and reachable from
 * the keyboard (Space/Enter) in one element.
 */

/**
 * Every format starts disabled except WebP, which is what most conversions want.
 *
 * Spelled out rather than built from `imageFormats` so that adding a format to
 * the table without deciding how it starts here is a type error, not a silent
 * default.
 */
function initialEnabled(): Record<ImageFormat, boolean> {
  return { png: false, jpeg: false, webp: true, avif: false, bmp: false };
}

export function ImageConverter() {
  const { entries, refused, addFiles, remove, clearFiles } = useFileQueue();
  const { running, planned, outcomes, start, cancel, clear: clearResults } = useConversionBatch();
  const [enabled, setEnabled] = useState(initialEnabled);

  const enabledFormats = useMemo(() => imageFormats.filter((format) => enabled[format]), [enabled]);

  /** Why the Convert button is greyed out, or null when it is live. */
  const blocked = running ? null : convertHint(entries.length, enabledFormats.length);

  const setFormatEnabled = useCallback((format: ImageFormat, on: boolean) => {
    setEnabled((previous) => ({ ...previous, [format]: on }));
  }, []);

  /**
   * The one control that empties both lists.
   *
   * It is one act rather than two because it sits in the file list and, from
   * there, asking the visitor to go and find a second button further down the
   * page would be asking them to guess. Nothing here reaches into a running
   * Batch: the button is not rendered while one is running.
   */
  const clearAll = useCallback(() => {
    clearFiles();
    clearResults();
  }, [clearFiles, clearResults]);

  const succeeded = outcomes.flatMap((outcome) =>
    outcome.ok ? [{ name: outcome.conversion.outputName, bytes: outcome.bytes }] : [],
  );
  const failures = outcomes.flatMap((outcome) => (outcome.ok ? [] : [outcome]));

  // Both counts, because the 清空 button that sits beside this line empties both
  // lists — see `core/counts.ts` for why the two are one sentence.
  const summary = addedSummary(entries.length, succeeded.length);

  return (
    <Stack className="mt-10 sm:mt-12" gap="xl">
      <section>
        <Title order={2} size="h4">
          1. 添加图片
        </Title>

        {/*
          No `accept` prop on purpose: it filters by the file's declared type, and
          a renamed file is exactly what `sniffFormat` is here to catch.

          The drop zone is only the drag target. Clicking and the keyboard go
          through the FileButton inside it: that is a real `<button>`, so it is
          announced as one, whereas react-dropzone labels its own root
          `role="presentation"` — making that the control would mean overriding
          the role by hand, which is the thing jsx-a11y exists to stop.
        */}
        <Dropzone
          activateOnClick={false}
          activateOnKeyboard={false}
          /* Padding comes from a class rather than the `p` prop on purpose: a
             simple style prop is written inline, and inline beats every layer,
             so `p="lg"` could not be undone on a touch screen. */
          className="dropzone-pad dropzone-touch-flat"
          disabled={running}
          enablePointerEvents
          mt="sm"
          multiple
          onDrop={(dropped) => {
            void addFiles(dropped);
          }}
        >
          <Stack align="center" gap="sm">
            <FileButton
              disabled={running}
              multiple
              onChange={(picked) => void addFiles(toFiles(picked))}
            >
              {(props) => (
                <Button
                  {...props}
                  className="action-full-width add-files-button"
                  size="md"
                  variant="default"
                >
                  选择文件
                </Button>
              )}
            </FileButton>
            {/* Hidden where there is no pointer to drag with: see `.drag-hint`. */}
            <Text c="dimmed" className="drag-hint" size="sm">
              也可以把文件拖到这里
            </Text>
          </Stack>
        </Dropzone>

        {/* The promise belongs at the point of action, not under the title: this
            is where someone decides whether to hand over a file. The capability
            and the list of formats are one line up, in the description. */}
        <Text c="dimmed" mt="xs" size="xs">
          文件不会上传，全程只在这个标签页里完成。
        </Text>

        {/* The row is also there when every file was refused: the rejected list
            is what is left to clear, and it is the only way to clear it. */}
        {(summary !== null || refused.length > 0) && (
          <Stack gap="xs" mt="md">
            <Group justify="space-between" wrap="nowrap">
              <Text c="dimmed" size="sm">
                {summary}
              </Text>
              {/* Hidden while a Batch runs, the way 取消 only appears while one
                  does — a greyed control would owe the visitor a reason, and
                  the reason here is the one 取消 already names. */}
              {!running && (
                <Button
                  className="touch-target"
                  onClick={clearAll}
                  size="compact-sm"
                  variant="default"
                >
                  清空
                </Button>
              )}
            </Group>

            <Stack gap={0}>
              {entries.map((entry) => (
                <FileRow
                  disabled={running}
                  entry={entry}
                  key={entry.id}
                  onRemove={() => remove(entry.id)}
                />
              ))}
            </Stack>
          </Stack>
        )}

        {refused.length > 0 && (
          <Alert color="red" mt="md" title="有文件没能加入">
            <Stack gap={4}>
              {refused.map((entry) => (
                <Text key={entry.name} size="sm">
                  <Text component="span" fw={500} inherit>
                    {entry.name}
                  </Text>
                  {`: ${entry.message}`}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}
      </section>

      <section>
        <Title order={2} size="h4">
          2. 转换为
        </Title>

        <Text c="dimmed" mt="xs" size="xs">
          每个格式按调好的默认质量编码；PNG 与 BMP 无损。
        </Text>

        <Stack gap="md" mt="sm">
          {imageFormats.map((format) => {
            const spec = formatSpecs[format];

            return (
              <Paper
                className="format-card"
                data-checked={enabled[format] || undefined}
                key={format}
                p="lg"
                withBorder
              >
                <Checkbox
                  checked={enabled[format]}
                  className="format-row"
                  disabled={running}
                  label={`${spec.label} (.${spec.extension})`}
                  onChange={(event) => setFormatEnabled(format, event.currentTarget.checked)}
                />
              </Paper>
            );
          })}
        </Stack>
      </section>

      {/* A Flex rather than a Group: on a narrow screen the buttons take the
          width and the reason sits under them, which a Group cannot express. */}
      <Flex
        align={{ base: "stretch", sm: "center" }}
        direction={{ base: "column", sm: "row" }}
        gap="md"
      >
        <Button
          className="action-full-width"
          disabled={running || entries.length === 0 || enabledFormats.length === 0}
          onClick={() =>
            void start(
              entries.map((entry) => entry.file),
              enabledFormats,
            )
          }
          size="md"
        >
          {entries.length > 0 ? `转换 ${entries.length} 个文件` : "转换"}
        </Button>
        {running && (
          <Button className="action-full-width" onClick={cancel} size="md" variant="default">
            取消
          </Button>
        )}
        {/* A greyed-out button with no reason is a dead end: say which of the
            conditions is unmet, next to the button that is waiting on it. */}
        {blocked !== null && (
          <Text c="dimmed" size="sm">
            {blocked}
          </Text>
        )}
      </Flex>

      <section aria-live="polite">
        {planned.length > 0 && (
          <div>
            <Text size="sm">
              已完成 {outcomes.length} / {planned.length}
            </Text>
            <Progress mt="xs" value={(outcomes.length / planned.length) * 100} />
          </div>
        )}

        {failures.length > 0 && (
          <Alert color="red" mt="md" title="有转换失败">
            <Stack gap={4}>
              {failures.map((failure) => (
                <Text key={failure.conversion.id} size="sm">
                  <Text component="span" fw={500} inherit>
                    {failure.conversion.outputName}
                  </Text>
                  {`: ${failure.message}`}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}

        {succeeded.length > 0 && (
          <Stack gap="sm" mt="xl">
            <Group justify="space-between">
              <Title order={2} size="h4">
                3. 下载
              </Title>
              <Button
                onClick={() => saveBlob(zipConversions(succeeded), "converted-images.zip")}
                size="md"
                variant="default"
              >
                打包成 ZIP 下载
              </Button>
            </Group>

            <Stack gap="xs">
              {outcomes.flatMap((outcome) =>
                outcome.ok ? (
                  <Paper key={outcome.conversion.id} p="xs" withBorder>
                    <Group justify="space-between" wrap="nowrap">
                      <Text size="sm" truncate>
                        {outcome.conversion.outputName}
                        <Text c="dimmed" component="span" inherit>
                          {`  ${outcome.width}×${outcome.height}`}
                        </Text>
                      </Text>
                      <DownloadLink outcome={outcome} />
                    </Group>
                  </Paper>
                ) : (
                  []
                ),
              )}
            </Stack>
          </Stack>
        )}
      </section>
    </Stack>
  );
}

function DownloadLink({ outcome }: { outcome: Extract<Outcome, { ok: true }> }) {
  const url = useObjectUrl(outcome.bytes, outcome.mime);

  return (
    <Anchor download={outcome.conversion.outputName} href={url} size="sm">
      下载
    </Anchor>
  );
}

/** FileButton hands back one file, an array of them, or nothing. */
function toFiles(picked: File[] | File | null): File[] {
  if (!picked) return [];

  return Array.isArray(picked) ? picked : [picked];
}

function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
