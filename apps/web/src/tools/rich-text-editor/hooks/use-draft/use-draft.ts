import type { JSONContent } from "@tiptap/react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { EMPTY_DOCUMENT } from "../../core/document";
import { DRAFT_SCHEMA_VERSION, type StoredDraft } from "../../core/draft";
import {
  INITIAL_SAVE_STATE,
  SAVE_DEBOUNCE_MS,
  saveReducer,
  type SaveStatus,
} from "../../core/save";
import { loadDraft, removeDraft, writeDraft } from "../../draft/draft-store";

/**
 * The local draft: the document the visitor's browser holds, and the save status
 * the toolbar reports for it.
 *
 * The hook is the only place the timer, the IndexedDB call and React live together.
 * The decisions — when a write is owed, when a timer is stale, which completion
 * counts — are in `core/save.ts`; the record's shape is in `core/draft.ts`; the
 * sentences are in `core/copy.ts`. This module wires them to the browser and
 * nothing more.
 *
 * Restore is silent: the first read happens in an effect, and `initialDocument`
 * stays `null` until it answers. The editor is mounted only after it does, so a
 * visitor cannot type into an empty document that a late read would then replace.
 */
export interface DraftController {
  /** `null` until the store has answered; the editor waits for it. */
  readonly initialDocument: JSONContent | null;
  readonly status: SaveStatus;
  /**
   * The editor's content changed; start the debounce window.
   *
   * The parameter is named `next` rather than `document`: this module also reads
   * the DOM's `document` for the visibility flush, and one name for two things is
   * how a callback ends up asking the wrong one for `visibilityState`.
   */
  readonly change: (next: JSONContent) => void;
  /** 重试 after a failure: re-attempt the operation that was refused. */
  readonly retry: () => void;
  /** 清空: the canvas is replaced and the stored record removed. */
  readonly clear: () => void;
}

/**
 * The operation a write run is for.
 *
 * 清空 removes the record, so the same retry path can re-attempt the removal when
 * the store refuses it. Keeping the operation here rather than deriving it from the
 * current canvas is what makes "retry the same write" literal: a failed save is
 * re-attempted with the document that failed, not with whatever React has since
 * rendered.
 */
type DraftOperation =
  | { readonly kind: "save"; readonly document: JSONContent }
  | { readonly kind: "remove" };

export function useDraft(): DraftController {
  const [state, dispatch] = useReducer(saveReducer, INITIAL_SAVE_STATE);
  const [initialDocument, setInitialDocument] = useState<JSONContent | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingOperation = useRef<DraftOperation | null>(null);

  const stopTimer = useCallback(() => {
    if (timer.current === null) return;

    clearTimeout(timer.current);
    timer.current = null;
  }, []);

  /*
   * Mount: read the one record and hand the editor its content. A failed read is
   * an empty canvas, not a failure the visitor has to answer: no write has been
   * refused, and there is nothing on the canvas to lose. The console keeps the
   * browser's own reason, as every Tool here does with a raw failure.
   */
  useEffect(() => {
    let cancelled = false;

    void loadDraft()
      .then((draft: StoredDraft | null) => {
        if (cancelled) return;

        if (draft === null) {
          dispatch({ type: "restored" });
          setInitialDocument(EMPTY_DOCUMENT);
          return;
        }

        pendingOperation.current = { document: draft.document, kind: "save" };
        dispatch({ type: "restored" });
        setInitialDocument(draft.document);
      })
      .catch((error: unknown) => {
        if (cancelled) return;

        // oxlint-disable-next-line no-console -- the raw read failure belongs in the console; the page has no sentence for an empty store.
        console.error("Rich text draft could not be read:", error);
        dispatch({ type: "restored" });
        setInitialDocument(EMPTY_DOCUMENT);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // A page that unmounts takes its timer with it. Nothing is written here: the
  // hidden page's flush is the browser's last chance, and a navigation is not a
  // reason to keep a timer alive for a page nobody is looking at.
  useEffect(() => stopTimer, [stopTimer]);

  /*
   * The change path. Every change is remembered as the next write's payload and
   * starts a fresh window; the reducer decides that the status is now dirty, so the
   * toolbar's sentence follows from the same event.
   */
  const change = useCallback(
    (next: JSONContent) => {
      pendingOperation.current = { document: next, kind: "save" };
      dispatch({ type: "change" });
      stopTimer();
      timer.current = setTimeout(() => {
        timer.current = null;
        dispatch({ type: "debounce-elapsed" });
      }, SAVE_DEBOUNCE_MS);
    },
    [stopTimer],
  );

  /*
   * Hiding the page is the flush. It does not wait for the window to close and it
   * does not need the canvas to have changed: the reducer starts a write only for
   * the states that owe one, so a hide after 已保存 does nothing.
   */
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;

      stopTimer();
      dispatch({ type: "page-hidden" });
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [stopTimer]);

  /*
   * The write path. A save run is one effect: it reads the operation the reducer's
   * `run` was bumped for, writes it, and reports the revision that was current when
   * the run started. A completion for an older revision is dropped by the reducer,
   * so a slow write cannot paint "saved" over a newer change.
   */
  useEffect(() => {
    const run = state.run;

    if (state.status !== "saving" || run === 0) return undefined;

    const operation = pendingOperation.current;
    if (operation === null) return undefined;

    const revision = state.revision;
    let cancelled = false;

    const attempt: Promise<void> =
      operation.kind === "save"
        ? writeDraft({
            document: operation.document,
            savedAt: Date.now(),
            version: DRAFT_SCHEMA_VERSION,
          })
        : removeDraft();

    void attempt.then(
      () => {
        if (cancelled) return;
        dispatch({ type: "write-succeeded", revision });
      },
      (error: unknown) => {
        if (!cancelled) {
          // oxlint-disable-next-line no-console -- a refused write is worth one console line; the toolbar has the sentence.
          console.error("Rich text draft could not be written:", error);
          dispatch({ type: "write-failed", revision });
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [state.revision, state.run, state.status]);

  const retry = useCallback(() => {
    dispatch({ type: "retry" });
  }, []);

  /*
   * 清空 is not a debounced change. The canvas is emptied by the component (with
   * `emitUpdate: false`, so the editor does not schedule a save of the empty
   * document), and this removes the record immediately. A write that was already in
   * flight is made stale by the revision bump; IndexedDB runs the delete after it,
   * so the last thing the store sees is the removal.
   */
  const clear = useCallback(() => {
    stopTimer();
    pendingOperation.current = { kind: "remove" };
    dispatch({ type: "clear" });
  }, [stopTimer]);

  return {
    change,
    clear,
    initialDocument,
    retry,
    status: state.status,
  };
}
