"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
 * The controls are the incoming layer's since #166 — the whole file is off the
 * outgoing library, which is what makes this the ticket that lets the page be read
 * as one layer. Labels, roles and keyboard behaviour come from Radix or from the
 * platform rather than being re-derived here, and the two places a Primitive was the
 * wrong tool say why in place: the file input (a replaced element, so a real
 * `<button>` opens it and the input itself takes the file) and the row's stretched
 * `<label for>` (measured in Chrome before it was chosen: a label whose control is a
 * button does forward the click, which is what keeps "press anywhere on the row").
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

/**
 * The page's secondary action, in one place: 选择文件, 取消 and the ZIP button are the
 * same control, and the outgoing layer's numbers are in it — a 42px box, a 1px hairline
 * border, the surface token as the fill, 22px of inline padding, 16px text on a 16px
 * line, and this site's hover surface in both schemes. It is a constant rather than the
 * registry's `outline` variant because no variant of the ladder is 42px and the
 * variant's dark fill is a translucent input colour rather than a token (see
 * `apps/web/docs/design/components.md`).
 */
const SECONDARY_ACTION =
  "h-[42px] border-input bg-card px-[22px] text-base leading-4 font-semibold hover:bg-secondary dark:bg-card dark:hover:bg-secondary";

/**
 * One error box, for both lists this page can produce: the files that were refused and
 * the Conversions that failed. They differ in their title and in what they list, and in
 * nothing else — which is why they are one component rather than two copies of the same
 * markup. `role="alert"` comes from the Primitive, and the surface is this site's card
 * colour with the measured error colour as text.
 */
function ErrorList({
  rows,
  title,
}: {
  /* A refused file is identified by its name and a failed Conversion by its id, which
     is a number — React's key accepts either, and a narrower type here would mean the
     two callers could not share the one component. */
  rows: { id: string | number; name: string; message: string }[];
  title: string;
}) {
  return (
    <Alert className="mt-4" variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <div className="col-start-2 flex flex-col gap-1">
        {rows.map((row) => (
          <p className="text-sm leading-[1.45]" key={row.id}>
            <span className="font-medium">{row.name}</span>
            {`: ${row.message}`}
          </p>
        ))}
      </div>
    </Alert>
  );
}

export function ImageConverter() {
  const { entries, refused, addFiles, remove, clearFiles } = useFileQueue();
  const { running, planned, outcomes, start, cancel, clear: clearResults } = useConversionBatch();
  const [enabled, setEnabled] = useState(initialEnabled);
  /*
   * The drop zone's two pieces of state that the outgoing library used to keep:
   * the file input a real `<button>` opens, and whether a drag is over the box
   * (which is what its `data-accept` highlight was). Both are the site's own now
   * (#164) — the button because a file input's own box is a replaced element and
   * cannot be styled into the action this page needs, and the highlight because
   * it is the one thing the box says while a file is over it.
   */
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

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
    /* The page's own column, and the last thing that was the outgoing layer's: a
       32px gap between the three steps, 40px/48px above the first of them. */
    <div className="mt-10 flex flex-col gap-8 sm:mt-12">
      <section>
        {/*
          The region this batch moved (#164), and an anchor for two Instruments at
          once: `ui-fingerprint.mjs` reads its geometry and its own computed styles
          per view state, and `touch-targets.mjs` scans it for the outgoing layer's
          class names. It wraps the heading, the drop zone and the promise rather
          than the whole `<section>`, because the file list under them is a later
          batch (#165) and a scope may only claim what has moved.
        */}
        <div data-slot="converter-add">
          <h2 className="text-[18px] leading-[1.45] font-semibold">1. 添加图片</h2>

          {/*
            No `accept` on purpose, and that is a rule rather than an omission: an
            accept filter reads the file's *declared* type, and a renamed file is
            exactly what `sniffFormat` is here to catch (`core/admission.ts`).

            The box is the drag target only. Clicking and the keyboard go through
            the `<button>` inside it — a real button, announced as one — because
            react-dropzone labelled its own root `role="presentation"`, and making
            that the control would mean overriding the role by hand.

            Padding comes from a class rather than a padding utility on purpose: a
            simple `style` prop is written inline, inline beats every layer, and
            the touch branch has to be able to take the box away entirely
            (`.dropzone-touch-flat`). The three classes are this site's own and
            predate the move; what changed is who renders the element.
          */}
          <div
            className="add-dropzone dropzone-pad dropzone-touch-flat mt-3 rounded-lg border border-dashed border-input bg-card"
            data-dragging={dragging || undefined}
            onDragLeave={(event) => {
              // Leaving for a child is not leaving the box: without this the
              // highlight flickers off as the pointer crosses the button inside.
              // The `instanceof` is the narrowing rather than an assertion: a drag
              // event's `relatedTarget` is an `EventTarget`, which is not a `Node`
              // until it is proved to be one.
              const entering = event.relatedTarget;
              if (!(entering instanceof Node) || !event.currentTarget.contains(entering)) {
                setDragging(false);
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void addFiles([...event.dataTransfer.files]);
            }}
          >
            <div className="flex flex-col items-center gap-3">
              <Button
                className={`action-full-width add-files-button touch-target ${SECONDARY_ACTION}`}
                disabled={running}
                onClick={() => fileInput.current?.click()}
                variant="outline"
              >
                选择文件
              </Button>
              {/*
                The input is what actually takes a file: the button above only
                opens the picker. `sr-only` rather than `hidden` so that it stays
                focusable for a screen reader's own file-picking path, and it keeps
                the `input[type=file]` the Instruments and the gate address this
                Tool by. Its value is cleared after every pick, or choosing the same
                file twice would fire no change event at all.
              */}
              <input
                className="sr-only"
                disabled={running}
                multiple
                onChange={(event) => {
                  const picked = [...(event.currentTarget.files ?? [])];
                  event.currentTarget.value = "";
                  void addFiles(picked);
                }}
                ref={fileInput}
                type="file"
              />
              {/* Hidden where there is no pointer to drag with: see `.drag-hint`. */}
              <p className="drag-hint text-sm leading-[1.45] text-muted-foreground">
                也可以把文件拖到这里
              </p>
            </div>
          </div>

          {/* The promise belongs at the point of action, not under the title: this
              is where someone decides whether to hand over a file. The capability
              and the list of formats are one line up, in the description. */}
          <p className="mt-2.5 text-xs leading-[1.4] text-muted-foreground">
            文件不会上传，全程只在这个标签页里完成。
          </p>
        </div>

        {/*
          The region #165 moved: the count line, the 清空 beside it, the queued rows
          and the rejected list. The anchor is a region for `touch-targets.mjs`,
          which drops a file before it measures — `ui-fingerprint.mjs` reads it too,
          but only because the fingerprint now drops the same file (its `fileInput`),
          since an anchor the captured state cannot carry fails the run.
        */}
        {(summary !== null || refused.length > 0) && (
          <div className="mt-4 flex flex-col" data-slot="converter-files">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm leading-[1.45] text-muted-foreground">{summary}</p>
              {/* Hidden while a Batch runs, the way 取消 only appears while one
                  does — a greyed control would owe the visitor a reason, and
                  the reason here is the one 取消 already names. */}
              {!running && (
                <Button
                  className="touch-target h-[26px] border-input bg-card px-2 text-sm leading-none font-semibold hover:bg-secondary dark:bg-card dark:hover:bg-secondary"
                  onClick={clearAll}
                  variant="outline"
                >
                  清空
                </Button>
              )}
            </div>

            {/* The rows. A column rather than a list element: each row's own hairline
                is what separates it, and the first one's separates the list from the
                count line above it. */}
            <div className="mt-2.5 flex flex-col">
              {entries.map((entry) => (
                <FileRow
                  disabled={running}
                  entry={entry}
                  key={entry.id}
                  onRemove={() => remove(entry.id)}
                />
              ))}
            </div>

            {refused.length > 0 && (
              /* `ErrorList`'s own docstring holds why this box looks the way it does,
                 and why it is the same component the failures use. */
              <ErrorList
                rows={refused.map((entry) => ({
                  id: entry.name,
                  message: entry.message,
                  name: entry.name,
                }))}
                title="有文件没能加入"
              />
            )}
          </div>
        )}
      </section>

      <section>
        {/* The second region this batch moved (#164): the heading, its one line of
            copy, and the five format rows. Same anchor contract as `converter-add`. */}
        <div data-slot="converter-formats">
          <h2 className="text-[18px] leading-[1.45] font-semibold">2. 转换为</h2>

          <p className="mt-2.5 text-xs leading-[1.4] text-muted-foreground">
            每个格式按调好的默认质量编码；PNG 与 BMP 无损。
          </p>

          <div className="mt-3 flex flex-col gap-4">
            {imageFormats.map((format) => {
              const spec = formatSpecs[format];
              const id = `format-${format}`;

              return (
                /*
                 * A card, and the same card the homepage's Tool card is: the site's
                 * own utilities rather than a generated `Card`, which carries a
                 * resting shadow, a 24px block padding and a surface fill this rule
                 * does not want — four overrides to arrive where these four classes
                 * start (`apps/web/docs/design/components.md`).
                 *
                 * `data-checked` is the row's own state written as an attribute, and
                 * the gate asserts *it* rather than the input's `checked`: an
                 * attribute written from React state cannot be flipped by the
                 * browser's default action on an input whose handlers are not
                 * attached yet.
                 */
                <div
                  className="format-card rounded-lg border border-border bg-background p-5 data-[checked]:border-primary"
                  data-checked={enabled[format] || undefined}
                  data-slot="format-card"
                  key={format}
                >
                  <div className="format-row flex items-center">
                    {/*
                      The registry's `Checkbox` is a `<button role="checkbox">`, and
                      the label beside it is a `<label for>` — measured in Chrome
                      before it was chosen (2026-10-06): a label whose control is a
                      button does forward the click, so "press anywhere on the row"
                      survives the swap. The box is 20px because the outgoing
                      layer's was, and the label carries `.touch-target` because a
                      `<label for>` is the element that owns this click: the overlay
                      belongs on it and never on the row's wrapper, which is the bug
                      `.format-row` in `globals.css` was written to fix.
                    */}
                    <Checkbox
                      checked={enabled[format]}
                      className="size-5"
                      disabled={running}
                      id={id}
                      onCheckedChange={(checked) => setFormatEnabled(format, checked === true)}
                    />
                    <Label
                      className="touch-target flex min-h-11 flex-1 items-center pl-3 text-sm leading-5 font-normal"
                      htmlFor={id}
                    >
                      {`${spec.label} (.${spec.extension})`}
                    </Label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/*
        The action row. A column below 640px and a row above it, rather than a
        `Group`: on a narrow screen the buttons take the width and the reason sits
        under them, which a `Group` cannot express. The three controls are the page's
        own since #166, and all three carry `.touch-target` and a name — 转换 and the
        ZIP are named in `touch-targets.mjs` and measured; 取消 cannot be, because it
        exists only while a Batch runs and a declaration has to match something in the
        state the claims run in.

        The filled button's label colour moves with the layer, deliberately: the
        outgoing layer painted it pure white, and this site's `text-primary-foreground`
        is its own paper, because pure white is banned
        (`apps/web/docs/design/colour.md`) and the ban is not waived for a label.
      */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Button
          className="action-full-width touch-target h-[42px] border border-transparent px-[22px] text-base leading-4 font-semibold"
          disabled={running || entries.length === 0 || enabledFormats.length === 0}
          onClick={() =>
            void start(
              entries.map((entry) => entry.file),
              enabledFormats,
            )
          }
        >
          {entries.length > 0 ? `转换 ${entries.length} 个文件` : "转换"}
        </Button>
        {running && (
          <Button
            className={`action-full-width touch-target ${SECONDARY_ACTION}`}
            onClick={cancel}
            variant="outline"
          >
            取消
          </Button>
        )}
        {/* A greyed-out button with no reason is a dead end: say which of the
            conditions is unmet, next to the button that is waiting on it. */}
        {blocked !== null && (
          <p className="text-sm leading-[1.45] text-muted-foreground">{blocked}</p>
        )}
      </div>

      <section aria-live="polite">
        {planned.length > 0 && (
          <div>
            <p className="text-sm leading-[1.45]">
              已完成 {outcomes.length} / {planned.length}
            </p>
            {/*
              The track is this site's own hover surface rather than the registry's
              `bg-primary/20`: an alpha of a token is a value nobody measured against
              anything, and this palette has two values it can name instead — the
              track is a surface, the bar is ink. `rounded-md` rather than the
              registry's `rounded-full`: a pill container is a rejected direction
              (`apps/web/docs/design.md`), and the outgoing bar was an 8px radius.
            */}
            <Progress
              className="mt-2.5 h-2 rounded-md bg-secondary"
              value={(outcomes.length / planned.length) * 100}
            />
          </div>
        )}

        {failures.length > 0 && (
          <ErrorList
            rows={failures.map((failure) => ({
              id: failure.conversion.id,
              message: failure.message,
              name: failure.conversion.outputName,
            }))}
            title="有转换失败"
          />
        )}

        {succeeded.length > 0 && (
          <div className="mt-8 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-[18px] leading-[1.45] font-semibold">3. 下载</h2>
              <Button
                className={`touch-target ${SECONDARY_ACTION}`}
                onClick={() => saveBlob(zipConversions(succeeded), "converted-images.zip")}
                variant="outline"
              >
                打包成 ZIP 下载
              </Button>
            </div>

            <div className="flex flex-col gap-2.5">
              {outcomes.flatMap((outcome) =>
                outcome.ok ? (
                  <div
                    className="rounded-lg border border-border bg-background p-2.5"
                    data-slot="output-row"
                    key={outcome.conversion.id}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="truncate text-sm leading-[1.45]">
                        {outcome.conversion.outputName}
                        <span className="text-muted-foreground">
                          {`  ${outcome.width}×${outcome.height}`}
                        </span>
                      </p>
                      <DownloadLink outcome={outcome} />
                    </div>
                  </div>
                ) : (
                  []
                ),
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function DownloadLink({ outcome }: { outcome: Extract<Outcome, { ok: true }> }) {
  const url = useObjectUrl(outcome.bytes, outcome.mime);

  /*
   * A real anchor with `download`, and the class is on it because it is the element
   * that owns the click. It is a 28x20 line of text, which is under this site's
   * floor on its own — the overlay is what makes it a target, and it is the reason
   * this link is declared as a `carriers` selector in `touch-targets.mjs`: every
   * match must carry the class, and a link that lost it would otherwise leave the
   * report without moving a pixel.
   */
  return (
    <a
      className="touch-target text-sm leading-[1.45] text-foreground hover:underline"
      download={outcome.conversion.outputName}
      href={url}
    >
      下载
    </a>
  );
}

function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
