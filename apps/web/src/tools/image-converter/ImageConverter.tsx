"use client";

import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  CloseButton,
  Collapse,
  FileButton,
  Flex,
  Group,
  NumberInput,
  Paper,
  Progress,
  Slider,
  Stack,
  Switch,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { useCallback, useMemo, useState } from "react";

import { useObjectUrl } from "@/hooks/use-object-url/use-object-url";

import { advancedFields, type AdvancedField } from "./core/advanced";
import { formatSpecs, imageFormats, type ImageFormat } from "./core/formats";
import { convertHint } from "./core/hints";
import type { TargetSettings } from "./core/options";
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
 * What is left is the form — which formats are on, what each one is set to, and
 * the words around it.
 *
 * The controls are Mantine components, so labels, roles and keyboard behaviour
 * come from the library rather than being re-derived here — which is also why
 * the file input is a `Dropzone`: it is clickable, droppable and reachable from
 * the keyboard (Space/Enter) in one element.
 */
type TargetState = {
  enabled: boolean;
  quality: number;
  lossless: boolean;
  advanced: Record<string, number | boolean>;
};

/**
 * Every format starts disabled except WebP, which is what most conversions want.
 *
 * Spelled out rather than built from `imageFormats` so that adding a format to
 * the table without deciding how it starts here is a type error, not a silent
 * default.
 */
function initialTargets(): Record<ImageFormat, TargetState> {
  const off = { enabled: false, lossless: false, advanced: {} };

  return {
    png: { ...off, quality: formatSpecs.png.quality },
    jpeg: { ...off, quality: formatSpecs.jpeg.quality },
    webp: { ...off, enabled: true, quality: formatSpecs.webp.quality },
    avif: { ...off, quality: formatSpecs.avif.quality },
    bmp: { ...off, quality: formatSpecs.bmp.quality },
  };
}

export function ImageConverter() {
  const { files, refused, add, removeAt, clear } = useFileQueue();
  const { running, planned, outcomes, start, cancel } = useConversionBatch();
  const [targets, setTargets] = useState(initialTargets);

  const enabledTargets = useMemo<TargetSettings[]>(
    () =>
      imageFormats
        .filter((format) => targets[format].enabled)
        .map((format) => ({
          format,
          quality: targets[format].quality,
          lossless: targets[format].lossless,
          advanced: targets[format].advanced,
        })),
    [targets],
  );

  /** Why the Convert button is greyed out, or null when it is live. */
  const blocked = running ? null : convertHint(files.length, enabledTargets.length);

  const updateTarget = useCallback((format: ImageFormat, patch: Partial<TargetState>) => {
    setTargets((previous) => ({ ...previous, [format]: { ...previous[format], ...patch } }));
  }, []);

  const succeeded = outcomes.flatMap((outcome) =>
    outcome.ok ? [{ name: outcome.conversion.outputName, bytes: outcome.bytes }] : [],
  );
  const failures = outcomes.flatMap((outcome) => (outcome.ok ? [] : [outcome]));

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
            void add(dropped);
          }}
        >
          <Stack align="center" gap="sm">
            <FileButton
              disabled={running}
              multiple
              onChange={(picked) => void add(toFiles(picked))}
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
        {(files.length > 0 || refused.length > 0) && (
          <Stack gap="xs" mt="md">
            <Group justify="space-between" wrap="nowrap">
              <Text c="dimmed" size="sm">
                {files.length > 0 ? `已添加 ${files.length} 张` : null}
              </Text>
              {/* Hidden while a Batch runs, the way 取消 only appears while one
                  does — a greyed control would owe the visitor a reason, and
                  the reason here is the one 取消 already names. */}
              {!running && (
                <Button
                  className="touch-target"
                  onClick={clear}
                  size="compact-sm"
                  variant="default"
                >
                  清空
                </Button>
              )}
            </Group>

            <Stack gap={0}>
              {files.map((file, index) => (
                <Group
                  className="file-row"
                  key={`${file.name}-${index}`}
                  justify="space-between"
                  wrap="nowrap"
                >
                  <Text size="sm" truncate>
                    {file.name}
                  </Text>
                  <CloseButton
                    aria-label={`移除 ${file.name}`}
                    className="touch-target"
                    disabled={running}
                    onClick={() => removeAt(index)}
                  />
                </Group>
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

        <Stack gap="md" mt="sm">
          {imageFormats.map((format) => {
            const spec = formatSpecs[format];
            const state = targets[format];

            return (
              <Paper
                className="format-card"
                data-checked={state.enabled || undefined}
                key={format}
                p="lg"
                withBorder
              >
                <Checkbox
                  checked={state.enabled}
                  className="format-row"
                  disabled={running}
                  label={`${spec.label} (.${spec.extension})`}
                  onChange={(event) =>
                    updateTarget(format, { enabled: event.currentTarget.checked })
                  }
                />

                <Collapse expanded={state.enabled} keepMounted={false}>
                  <Stack gap="sm" mt="md" pl="lg">
                    {spec.lossless === "optional" && (
                      <Switch
                        checked={state.lossless}
                        /* `body` is the `<label>` that owns the toggle; the
                           root `<div>` above it would swallow the click. */
                        classNames={{ body: "touch-target" }}
                        disabled={running}
                        label="无损"
                        onChange={(event) =>
                          updateTarget(format, { lossless: event.currentTarget.checked })
                        }
                        /* `fit-content`: a Stack stretches its children, which
                           made the whole row a switch that could be flipped by
                           clicking well to the right of it. */
                        w="fit-content"
                      />
                    )}

                    {spec.lossless !== "always" && (
                      <div>
                        <Text fw={500} size="sm">
                          质量：{state.quality}
                        </Text>
                        <Slider
                          disabled={running || state.lossless}
                          max={100}
                          min={1}
                          mt="xs"
                          onChange={(value) => updateTarget(format, { quality: value })}
                          thumbLabel={`${spec.label} 质量`}
                          value={state.quality}
                        />
                      </div>
                    )}

                    <AdvancedPanel
                      fields={advancedFields[format] ?? []}
                      onChange={(key, value) =>
                        updateTarget(format, { advanced: { ...state.advanced, [key]: value } })
                      }
                      running={running}
                      values={state.advanced}
                    />
                  </Stack>
                </Collapse>
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
          disabled={running || files.length === 0 || enabledTargets.length === 0}
          onClick={() => void start(files, enabledTargets)}
          size="md"
        >
          {files.length > 0 ? `转换 ${files.length} 个文件` : "转换"}
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

function AdvancedPanel({
  fields,
  onChange,
  running,
  values,
}: {
  fields: AdvancedField[];
  onChange: (key: string, value: number | boolean) => void;
  running: boolean;
  values: Record<string, number | boolean>;
}) {
  const [expanded, setExpanded] = useState(false);

  if (fields.length === 0) return null;

  return (
    <div>
      {/*
        The disclosure's mark is an icon rather than the `+` / `-` glyphs it used
        to be. The glyphs were not wrong, but they came from whichever CJK font
        the operating system fell back to, so their width and weight differed per
        machine; a Phosphor icon is the same drawing everywhere and is the same
        family as the arrows and the scheme switch. Still hidden from assistive
        tech, because `aria-expanded` already carries the state.

        The two names are written out rather than assembled from a variable:
        Tailwind reads class names out of the source, so a name built at runtime
        would never be compiled. `icons.test.ts` fails on that mistake.
      */}
      <UnstyledButton
        aria-expanded={expanded}
        className="touch-target"
        onClick={() => setExpanded((open) => !open)}
        style={{ borderRadius: "var(--mantine-radius-sm)", padding: "2px 6px" }}
      >
        <Text fw={500} size="sm">
          {expanded ? (
            <span aria-hidden className="icon mr-1 icon-[ph--minus-bold]" />
          ) : (
            <span aria-hidden className="icon mr-1 icon-[ph--plus-bold]" />
          )}
          高级选项
        </Text>
      </UnstyledButton>

      <Collapse expanded={expanded} keepMounted={false}>
        <Stack gap="sm" mt="sm">
          {fields.map((field) => {
            const value = values[field.key] ?? field.initial;

            return field.kind === "boolean" ? (
              <Checkbox
                checked={value === true}
                disabled={running}
                key={field.key}
                label={field.label}
                onChange={(event) => onChange(field.key, event.currentTarget.checked)}
              />
            ) : (
              <NumberInput
                disabled={running}
                key={field.key}
                label={field.label}
                max={field.max}
                min={field.min}
                onChange={(next) =>
                  onChange(field.key, typeof next === "number" ? next : Number(next))
                }
                step={field.step}
                value={Number(value)}
              />
            );
          })}
        </Stack>
      </Collapse>
    </div>
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
