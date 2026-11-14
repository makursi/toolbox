"use client";

import { useCallback, useRef, useState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { DEFAULT_PAPER, type Paper } from "./core/geometry";
import {
  addHeading,
  addMoreLabel,
  buildingHint,
  clearLabel,
  convertLabel,
  downloadLabel,
  emptyPages,
  noImagesHint,
  onDevicePromise,
  pagesHeading,
  pickLabel,
  refusedTitle,
} from "./core/hints";
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
  const { status, result, failure, start, reset } = usePdfBuild();
  const input = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [paper, setPaper] = useState<Paper>(DEFAULT_PAPER);

  const building = status === "building";
  const empty = pages.length === 0;

  /**
   * Add files, then invalidate any produced document.
   *
   * Every change to the list has to take the download away: a file that does not
   * match the preview is the worst thing this page can hand over. The
   * invalidation is not an error state, so it shows no banner. A batch where
   * every file was refused did not change the list, so it does not invalidate
   * anything either: the document on screen is still the list on screen.
   */
  const add = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) return;
      const added = await addFiles(files);
      if (added > 0) reset();
    },
    [addFiles, reset],
  );

  const removePage = useCallback(
    (id: number) => {
      remove(id);
      reset();
    },
    [remove, reset],
  );

  const clearPages = useCallback(() => {
    clear();
    reset();
  }, [clear, reset]);

  /**
   * Put one page where another one was, then invalidate any produced document.
   *
   * Reordering is a change to the document's page order, so a file built for the
   * old order cannot stay on screen: the download goes away and 转换 is armed
   * again, with no banner, exactly as adding or removing a page does. A drop
   * that lands on the row's own position is not a change, and the hook says so.
   */
  const reorderPage = useCallback(
    (activeId: number, overId: number) => {
      if (reorder(activeId, overId)) reset();
    },
    [reorder, reset],
  );

  /**
   * Choose the paper, then invalidate any produced document.
   *
   * A file built for A4 cannot stay on screen while every row now draws Letter.
   * Like the list's own changes, this is an invalidation and not a failure: no
   * banner, no error sentence, just back to "not converted yet".
   */
  const choosePaper = useCallback(
    (next: Paper) => {
      setPaper(next);
      reset();
    },
    [reset],
  );

  const blocked = !building && pages.length === 0 ? noImagesHint : null;

  return (
    <div className="mt-10 flex flex-col gap-8 sm:mt-12">
      {/* The input region. Its `data-slot` is the anchor the fingerprint will
          declare once #200 adds this page to the instruments' lists. */}
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
          {blocked !== null && (
            <p className="text-sm leading-[1.45] text-muted-foreground">{blocked}</p>
          )}
        </div>

        <div aria-live="polite" className="flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1">
          {building && <p className="text-sm leading-[1.45]">{buildingHint}</p>}

          {status === "failed" && failure !== null && (
            <p className="text-sm leading-[1.45] text-destructive">{failure}</p>
          )}

          {status === "done" && result !== null && (
            <>
              <p className="min-w-0 truncate text-sm leading-[1.45]">{result.name}</p>
              {/*
                A real anchor with `download`, and the class is on it because it
                owns the click. Its text is small, so the overlay is what makes
                it a 44px target.
              */}
              <a
                className="touch-target text-sm leading-[1.45] font-semibold text-foreground hover:underline"
                download={result.name}
                href={result.url}
              >
                {downloadLabel}
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
