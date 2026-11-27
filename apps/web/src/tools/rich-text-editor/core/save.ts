/**
 * The save-state machine, as data.
 *
 * The hook owns the timer and the IndexedDB call; this module owns only the
 * decisions between them. That split is what lets a unit test hold the four states
 * and the two ways into them: a debounce that has not closed yet, and a page that
 * is about to be hidden. Nothing here touches the DOM, a timer or a browser API.
 *
 * `revision` is the document's generation and `run` is the write's. A change bumps
 * the revision; a write starts by bumping the run. A write reports back the
 * revision it was started for, so a completion that arrives after the visitor has
 * typed again is ignored instead of painting "saved" over a document the store has
 * never seen. The hook passes the revision back with the result; it does not have
 * to compare documents.
 */

/** How long the draft waits after the last change before it writes. */
export const SAVE_DEBOUNCE_MS = 800;

/**
 * What the toolbar reports.
 *
 * `dirty` is a change whose debounce window is still open, not a document that has
 * no home: a fresh page starts `saved`, because there is nothing to write yet.
 */
export type SaveStatus = "dirty" | "saving" | "saved" | "failed";

export interface SaveState {
  readonly status: SaveStatus;
  /** Whether the debounce timer is waiting for its window to close. */
  readonly pending: boolean;
  /** Bumped by every change; a write for an older revision is ignored. */
  readonly revision: number;
  /** Bumped whenever a write should start; the hook's effect keys on it. */
  readonly run: number;
}

/** A page with nothing to save yet: the empty document is already the state. */
export const INITIAL_SAVE_STATE: SaveState = {
  pending: false,
  revision: 0,
  run: 0,
  status: "saved",
};

export type SaveEvent =
  /** The document changed; start the 800ms window. */
  | { readonly type: "change" }
  /** The window closed; the waiting write may start. */
  | { readonly type: "debounce-elapsed" }
  /** The page became hidden; write now instead of waiting for the window. */
  | { readonly type: "page-hidden" }
  /** The visitor pressed 重试 after a failure; re-attempt the same operation. */
  | { readonly type: "retry" }
  /** 清空: the canvas and the stored draft both go, then the store is written. */
  | { readonly type: "clear" }
  /** A draft was read from the store (or none was found); the page is at rest. */
  | { readonly type: "restored" }
  /** The write finished; only the revision it was started for may report. */
  | { readonly type: "write-succeeded"; readonly revision: number }
  /** The write was refused; only the revision it was started for may report. */
  | { readonly type: "write-failed"; readonly revision: number };

export function saveReducer(state: SaveState, event: SaveEvent): SaveState {
  switch (event.type) {
    case "change":
      /*
       * A change during a write is still a change: the in-flight write is for the
       * previous revision and this one has to wait its own 800ms. Keeping the run
       * where it is means the effect does not start a second write on the spot.
       */
      return {
        pending: true,
        revision: state.revision + 1,
        run: state.run,
        status: "dirty",
      };

    case "debounce-elapsed":
      // A timer that outlived its change (it was reset, or a hide already wrote)
      // has nothing to answer: the same state comes back, so no write starts.
      if (!state.pending) return state;

      return { pending: false, revision: state.revision, run: state.run + 1, status: "saving" };

    case "page-hidden":
      /*
       * Hiding the page is the second way into a write, and it exists for the
       * states where a write is owed: a change still inside its window, or a
       * failure the visitor has not retried. `saved` has nothing to write and
       * `saving` already has a write in flight, so both are left alone.
       */
      if (state.status !== "dirty" && state.status !== "failed") return state;

      return { pending: false, revision: state.revision, run: state.run + 1, status: "saving" };

    case "retry":
      if (state.status !== "failed") return state;

      return { pending: false, revision: state.revision, run: state.run + 1, status: "saving" };

    case "clear":
      /*
       * 清空 is its own write, and a newer one than anything in flight: the old
       * draft must not land after the clear. The hook removes the record rather
       * than writing the empty document, so a reload has no draft to restore.
       */
      return {
        pending: false,
        revision: state.revision + 1,
        run: state.run + 1,
        status: "saving",
      };

    case "restored":
      return { pending: false, revision: state.revision, run: state.run, status: "saved" };

    case "write-succeeded":
      if (event.revision !== state.revision) return state;

      return { pending: false, revision: state.revision, run: state.run, status: "saved" };

    case "write-failed":
      if (event.revision !== state.revision) return state;

      return { pending: false, revision: state.revision, run: state.run, status: "failed" };

    default:
      // The union is closed; this keeps a future event from falling through
      // silently while the switch stays exhaustive for the compiler.
      return state;
  }
}
