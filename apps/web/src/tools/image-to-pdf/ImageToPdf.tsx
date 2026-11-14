"use client";

import { useCallback, useRef, useState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useObjectUrl } from "@/hooks/use-object-url/use-object-url";

import { DEFAULT_PAPER, type Paper } from "./core/geometry";
import {
  addHeading,
  addMoreLabel,
  cancelLabel,
  clearLabel,
  convertLabel,
  downloadLabel,
  emptyPages,
  noImagesHint,
  onDevicePromise,
  pagesHeading,
  pickLabel,
  progressText,
  refusedTitle,
} from "./core/hints";
import { invalidates, type DocumentChange } from "./core/invalidation";
import { usePageList } from "./hooks/use-page-list/use-page-list";
import { usePdfBuild } from "./hooks/use-pdf-build/use-pdf-build";
import { PageList } from "./page-list/page-list";
import { PaperRow } from "./paper-row/paper-row";

/**
 * The Image to PDF page.
 *
 * It is a client component by necessity: the files are read here, the document
 * is built in a Worker, and nothing leaves the tab. What it holds is only the
 * form; the page list is `usePageList`, the chosen paper is one piece of state
 * here, and one run is `usePdfBuild`, which is also where the download's object
 * URL is created and released.
 *
 * The paper is passed to every row and to the build, so the miniature and the
 * file cannot disagree about it. Changing it is a change to the document, and
 * therefore invalidates a produced file exactly as touching the list does.
 */

/**
 * The page's secondary action: a 42px control with a hairline border and the
 * surface token as its fill, the same one the reference Tool uses for its own
 * picker. A real `<button>` opens the picker, because a file input's own box is
 * a replaced element and cannot be drawn as this action.
 */
const SECONDARY_ACTION =
  "h-[42px] border-input bg-card px-[22px] text-base leading-4 font-semibold hover:bg-secondary dark:bg-card dark:hover:bg-secondary";

export function ImageToPdf() {
  const { pages, refused, addFiles, remove, reorder, clear } = usePageList();
  const { status, result, failure, progress, start, reset, cancel } = usePdfBuild();
  const input = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [paper, setPaper] = useState<Paper>(DEFAULT_PAPER);

  const building = status === "building";
  const empty = pages.length === 0;

  /**
   * The one door every change to the document goes through.
   *
   * A produced file is built from the paper and the list, in order. Any change
   * to either of them makes it a file that no longer matches the page, so the
   * download is taken away and 转换 is re-armed — with no banner and no failure
   * sentence, because this is "not converted yet" rather than an error. The five
   * changes (add, remove, clear, reorder, paper) all come through here and ask
   * `core/invalidation.ts`; a sixth one has to do the same, and a change that did
   * not change the document (a fully refused batch, a drop on the row's own
   * position) leaves the file alone.
   */
  const applyChange = useCallback(
    (change: DocumentChange) => {
      if (invalidates(change)) reset();
    },
    [reset],
  );

  /**
   * Add files, then tell the rule what happened.
   *
   * A batch where every file was refused did not change the list, so it reaches
   * the same door as the rest and the door leaves the produced file alone: the
   * document on screen is still the list on screen.
   */
  const add = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) return;
      applyChange({ kind: "add", accepted: await addFiles(files) });
    },
    [addFiles, applyChange],
  );

  const removePage = useCallback(
    (id: number) => {
      remove(id);
      applyChange({ kind: "remove" });
    },
    [remove, applyChange],
  );

  const clearPages = useCallback(() => {
    clear();
    applyChange({ kind: "clear" });
  }, [clear, applyChange]);

  /**
   * Put one page where another one was, then tell the rule whether it moved.
   *
   * The list hook answers whether the order actually changed, because a drop
   * back onto the row's own position is not a new document and must not throw
   * away a file that still matches the list.
   */
  const reorderPage = useCallback(
    (activeId: number, overId: number) => {
      const moved = reorder(activeId, overId);
      applyChange({ kind: "reorder", moved });
    },
    [reorder, applyChange],
  );

  const choosePaper = useCallback(
    (next: Paper) => {
      setPaper(next);
      applyChange({ kind: "paper" });
    },
    [applyChange],
  );

  const blocked = !building && pages.length === 0 ? noImagesHint : null;

  return (
    <div className="mt-10 flex flex-col gap-8 sm:mt-12">
      {/*
        The input region. Its `data-slot` is one of the anchors the fingerprint
        declares for this page (#200).
      */}
      <section data-slot="pdf-add">
        <h2 className="text-[18px] leading-[1.45] font-semibold">{addHeading}</h2>

        {/*
          The dashed box invites a drop while the list is empty; once it holds
          pages the same target becomes one 「继续添加」 line. The picker is the
          same real `<button>选择图片</button>` in both states, because the
          hit-area instrument declares a control by name and a name that changes
          with state cannot be declared.

          The file input carries no `accept`: the format is decided by the bytes,
          never by a declared type. It stays mounted across the two states so a
          pick in progress is not interrupted by the collapse.
        */}
        <div
          className={
            empty
              ? "add-dropzone dropzone-pad dropzone-touch-flat mt-3 rounded-lg border border-dashed border-input bg-card"
              : "add-dropzone mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2"
          }
          data-dragging={dragging || undefined}
          data-dropzone
          onDragLeave={(event) => {
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
            if (!building) void add([...event.dataTransfer.files]);
          }}
        >
          {empty ? (
            <div className="flex flex-col items-center gap-3">
              <Button
                className={`action-full-width add-files-button touch-target ${SECONDARY_ACTION}`}
                disabled={building}
                onClick={() => input.current?.click()}
                variant="outline"
              >
                {pickLabel}
              </Button>

              <p className="drag-hint text-sm leading-[1.45] text-muted-foreground">
                也可以把文件拖到这里
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm leading-[1.45] text-muted-foreground">{addMoreLabel}</p>
              <Button
                className={`add-files-button touch-target shrink-0 ${SECONDARY_ACTION}`}
                disabled={building}
                onClick={() => input.current?.click()}
                variant="outline"
              >
                {pickLabel}
              </Button>
            </>
          )}

          {/*
            `sr-only` rather than `hidden` keeps it focusable for a screen
            reader's own file-picking path. Its value is cleared after every
            pick, or choosing the same file twice would fire no change event.
          */}
          <input
            className="sr-only"
            disabled={building}
            multiple
            onChange={(event) => {
              const picked = [...(event.currentTarget.files ?? [])];
              event.currentTarget.value = "";
              void add(picked);
            }}
            ref={input}
            type="file"
          />
        </div>

        <p className="mt-2.5 text-xs leading-[1.4] text-muted-foreground">{onDevicePromise}</p>

        {/*
          The refused files, in the site's existing rejection box. One sentence
          per file, in the order the files were chosen; a refused file never
          becomes a row, so the list of refusals is the only place it appears.
        */}
        {refused.length > 0 && (
          <Alert className="mt-4" variant="destructive">
            <AlertTitle>{refusedTitle}</AlertTitle>
            <div className="col-start-2 flex flex-col gap-1">
              {refused.map((entry, index) => (
                <p
                  className="text-sm leading-[1.45]"
                  key={`${entry.name}:${entry.message}:${String(index)}`}
                >
                  <span className="font-medium">{entry.name}</span>
                  {`: ${entry.message}`}
                </p>
              ))}
            </div>
          </Alert>
        )}
      </section>

      {pages.length > 0 && (
        <section data-slot="pdf-pages">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[18px] leading-[1.45] font-semibold">{pagesHeading}</h2>
            <Button
              className="touch-target h-[26px] border-input bg-card px-2 text-sm leading-none font-semibold hover:bg-secondary dark:bg-card dark:hover:bg-secondary"
              disabled={building}
              onClick={clearPages}
              variant="outline"
            >
              {clearLabel}
            </Button>
          </div>

          <PageList
            disabled={building}
            onRemove={removePage}
            onReorder={reorderPage}
            pages={pages}
            paper={paper}
          />
        </section>
      )}

      {pages.length === 0 && (
        <p className="text-sm leading-[1.45] text-muted-foreground">{emptyPages}</p>
      )}

      {/*
        The page-size row, between the page list and the result row. It is always
        present: the choice is the page's, not a state of the list. Every row
        above reshapes when it changes, and a produced document is invalidated.
      */}
      <PaperRow disabled={building} onChange={choosePaper} paper={paper} />

      {/*
        The result row stays on screen while the list scrolls. It is the page's
        only action and its outcome: 转换, the reason it is unavailable, the
        run's state, and the download. The live region is what announces the
        state to a screen reader.
      */}
      <div
        className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-border bg-background pt-3 pb-3"
        data-slot="pdf-result"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            className="action-full-width touch-target h-[42px] border border-transparent px-[22px] text-base leading-4 font-semibold"
            disabled={building || pages.length === 0}
            onClick={() => void start(pages, paper)}
          >
            {convertLabel}
          </Button>
          {/*
            The way out of a run that is taking too long. It exists only while
            one is in flight: a greyed 取消 would owe the visitor a reason, and
            the reason is the run it does not have. It terminates the Worker
            instead of asking it to stop, so a cancelled run leaves no thread,
            no bytes and no result behind, and the page returns to "not converted
            yet" with no banner. The name is fixed so the hit-area instrument can
            declare it.
          */}
          {building && (
            <Button
              className={`action-full-width touch-target ${SECONDARY_ACTION}`}
              onClick={cancel}
              variant="outline"
            >
              {cancelLabel}
            </Button>
          )}
          {blocked !== null && (
            <p className="text-sm leading-[1.45] text-muted-foreground">{blocked}</p>
          )}
        </div>

        {/*
          The run's state, in one polite live region, so a visitor who cannot see
          the page still hears each finished page rather than a silence. The
          progress line is inside the live region rather than beside it, and the
          count comes from the Worker one message per page. The full width is
          what keeps the bar under the controls at 390px, inside the pinned row.
        */}
        <div aria-live="polite" className="flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1">
          {progress !== null && (
            <div className="flex w-full flex-col gap-2" data-slot="pdf-progress">
              <p className="text-sm leading-[1.45]">
                {progressText(progress.done, progress.total)}
              </p>
              {/*
                The site's own two values: a hover-surface track and an ink
                segment, 8px high with an 8px radius (`components.md`, 进度条).
                The percentage is the only thing the bar needs; the text above
                says the two numbers a visitor counts in.
              */}
              <Progress
                className="h-2 rounded-md bg-secondary"
                value={progress.total === 0 ? 0 : (progress.done / progress.total) * 100}
              />
            </div>
          )}

          {status === "failed" && failure !== null && (
            <p className="text-sm leading-[1.45] text-destructive">{failure}</p>
          )}

          {status === "done" && result !== null && (
            <DownloadLink bytes={result.bytes} name={result.name} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The finished file: its name and the download.
 *
 * It is an element of its own because the URL's whole life belongs to the
 * shared `useObjectUrl` hook: the URL is derived from the bytes during render
 * and revoked when this element goes away. Invalidating a produced file clears
 * the run's result, cancelling a run clears it, and leaving the page unmounts
 * it, so every exit revokes by construction — the same one lifecycle the Image
 * Converter keeps for its downloads (#191).
 *
 * The bytes are immutable for this element's life: a new run is a new result.
 */
function DownloadLink({ bytes, name }: { bytes: Uint8Array<ArrayBuffer>; name: string }) {
  const url = useObjectUrl(bytes, "application/pdf");

  return (
    <>
      <p className="min-w-0 truncate text-sm leading-[1.45]">{name}</p>
      {/*
        A real anchor with `download`, and the class is on it because it owns the
        click. Its text is small, so the overlay is what makes it a 44px target.
      */}
      <a
        className="touch-target text-sm leading-[1.45] font-semibold text-foreground hover:underline"
        download={name}
        href={url}
      >
        {downloadLabel}
      </a>
    </>
  );
}
