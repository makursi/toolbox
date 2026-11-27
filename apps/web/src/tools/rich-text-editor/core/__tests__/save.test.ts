import { describe, expect, it } from "vitest";

import {
  INITIAL_SAVE_STATE,
  SAVE_DEBOUNCE_MS,
  saveReducer,
  type SaveEvent,
  type SaveState,
} from "@/tools/rich-text-editor/core/save";

/**
 * The save-state machine, held to the four states and the two ways into a write.
 *
 * These are decisions, not browser behaviour: no timer, no IndexedDB, no editor.
 * The gate owns the part a visitor can see; this file owns the part that is easy to
 * get subtly wrong, which is the pair of counters. A unit test is the only place a
 * completion for an older revision can be constructed on purpose.
 */

function reduce(state: SaveState, events: readonly SaveEvent[]): SaveState {
  return events.reduce(saveReducer, state);
}

/** A reducer step that has to start the write effect: its run has just moved. */
function afterChange(): SaveState {
  return saveReducer(INITIAL_SAVE_STATE, { type: "change" });
}

describe("the save-state machine", () => {
  it("walks a change through its debounce to a written draft", () => {
    const dirty = afterChange();

    expect(dirty.status).toBe("dirty");
    expect(dirty.pending).toBe(true);
    expect(dirty.revision).toBe(1);
    // The change is waiting, not writing: the run has not moved yet.
    expect(dirty.run).toBe(0);

    const saving = saveReducer(dirty, { type: "debounce-elapsed" });

    expect(saving.status).toBe("saving");
    expect(saving.pending).toBe(false);
    expect(saving.run).toBe(1);

    const saved = saveReducer(saving, { type: "write-succeeded", revision: saving.revision });

    expect(saved.status).toBe("saved");
    expect(saved.pending).toBe(false);
  });

  it("reports a refusal and re-attempts the same write on retry", () => {
    const saving = reduce(afterChange(), [{ type: "debounce-elapsed" }]);
    const failed = saveReducer(saving, { type: "write-failed", revision: saving.revision });

    expect(failed.status).toBe("failed");
    expect(failed.pending).toBe(false);

    const retrying = saveReducer(failed, { type: "retry" });

    expect(retrying.status).toBe("saving");
    expect(retrying.run).toBe(saving.run + 1);
    // The retry is the same document: a change would have moved the revision.
    expect(retrying.revision).toBe(failed.revision);

    expect(
      saveReducer(retrying, { type: "write-succeeded", revision: retrying.revision }).status,
    ).toBe("saved");
  });

  it("starts the write on a hidden page instead of waiting for the debounce", () => {
    const dirty = afterChange();
    const flushed = saveReducer(dirty, { type: "page-hidden" });

    expect(flushed.status).toBe("saving");
    expect(flushed.pending).toBe(false);
    expect(flushed.run).toBe(dirty.run + 1);

    // The timer that was still scheduled arrives after the flush and finds no
    // pending window, so it cannot start a second write.
    expect(saveReducer(flushed, { type: "debounce-elapsed" })).toBe(flushed);
  });

  it("flushes a failure on a hidden page, and leaves a saved or saving page alone", () => {
    const failed = reduce(afterChange(), [
      { type: "debounce-elapsed" },
      { type: "write-failed", revision: 1 },
    ]);
    const flushed = saveReducer(failed, { type: "page-hidden" });

    expect(flushed.status).toBe("saving");
    expect(flushed.run).toBe(failed.run + 1);

    const saved = INITIAL_SAVE_STATE;
    expect(saveReducer(saved, { type: "page-hidden" })).toBe(saved);

    const saving = reduce(afterChange(), [{ type: "debounce-elapsed" }]);
    expect(saveReducer(saving, { type: "page-hidden" })).toBe(saving);
  });

  it("does not start a second write when the visitor types during one", () => {
    const saving = reduce(afterChange(), [{ type: "debounce-elapsed" }]);
    const typed = saveReducer(saving, { type: "change" });

    expect(typed.status).toBe("dirty");
    expect(typed.pending).toBe(true);
    expect(typed.revision).toBe(saving.revision + 1);
    // Still the same run: the in-flight write keeps going and this change waits
    // for its own 800ms window rather than starting a second writer immediately.
    expect(typed.run).toBe(saving.run);
  });

  it("ignores a completion for an older revision", () => {
    const saving = reduce(afterChange(), [{ type: "debounce-elapsed" }]);
    const typed = saveReducer(saving, { type: "change" });

    // The write that just finished was for the document before the last keystroke.
    expect(saveReducer(typed, { type: "write-succeeded", revision: saving.revision })).toBe(typed);
    expect(saveReducer(typed, { type: "write-failed", revision: saving.revision })).toBe(typed);
    expect(typed.status).toBe("dirty");
  });

  it("ignores a debounce timer with no window to close", () => {
    expect(saveReducer(INITIAL_SAVE_STATE, { type: "debounce-elapsed" })).toBe(INITIAL_SAVE_STATE);
  });

  it("only retries a failure", () => {
    expect(saveReducer(INITIAL_SAVE_STATE, { type: "retry" })).toBe(INITIAL_SAVE_STATE);
    expect(saveReducer(afterChange(), { type: "retry" }).status).toBe("dirty");
  });

  it("makes 清空 a newer operation than anything in flight", () => {
    const saving = reduce(afterChange(), [{ type: "debounce-elapsed" }]);
    const cleared = saveReducer(saving, { type: "clear" });

    expect(cleared.status).toBe("saving");
    expect(cleared.pending).toBe(false);
    expect(cleared.revision).toBe(saving.revision + 1);
    expect(cleared.run).toBe(saving.run + 1);

    // The write that was in flight is for the old revision and may not report
    // success over the removal.
    expect(saveReducer(cleared, { type: "write-succeeded", revision: saving.revision })).toBe(
      cleared,
    );
  });

  it("returns to rest when the store has answered", () => {
    const failed = reduce(afterChange(), [
      { type: "debounce-elapsed" },
      { type: "write-failed", revision: 1 },
    ]);

    const restored = saveReducer(failed, { type: "restored" });

    expect(restored.status).toBe("saved");
    expect(restored.pending).toBe(false);
  });

  it("debounces for the 800ms the ticket names", () => {
    expect(SAVE_DEBOUNCE_MS).toBe(800);
  });
});
