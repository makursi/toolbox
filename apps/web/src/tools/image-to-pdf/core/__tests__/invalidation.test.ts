import { describe, expect, it } from "vitest";

import { invalidates, type DocumentChange } from "@/tools/image-to-pdf/core/invalidation";

/**
 * The invalidation rule, held by a test instead of by the page that calls it.
 *
 * A produced file is built from the paper and the list, in order, so any change
 * to either of them makes it a file that no longer matches the screen. The rule
 * is one function because a page that asks it in five places must get the same
 * answer in all five, and because the two changes that are *not* a change to the
 * document — a batch that was refused whole, a row dropped where it started —
 * have to be stated once rather than remembered by every caller.
 *
 * The gate proves the page resets; this test proves what resetting means.
 */

describe("invalidates", () => {
  it("invalidates when the paper changes", () => {
    expect(invalidates({ kind: "paper" })).toBe(true);
  });

  it("invalidates when a batch adds at least one page", () => {
    expect(invalidates({ kind: "add", accepted: 1 })).toBe(true);
    expect(invalidates({ kind: "add", accepted: 20 })).toBe(true);
  });

  it("keeps the file when a batch was refused whole", () => {
    // Nothing joined the list, so the document on screen is still the document
    // the file was built from. Throwing it away would punish the visitor for
    // choosing a file this Tool does not take.
    expect(invalidates({ kind: "add", accepted: 0 })).toBe(false);
  });

  it("invalidates when a page is removed", () => {
    expect(invalidates({ kind: "remove" })).toBe(true);
  });

  it("invalidates when the list is cleared", () => {
    expect(invalidates({ kind: "clear" })).toBe(true);
  });

  it("invalidates when a reorder moves a page", () => {
    expect(invalidates({ kind: "reorder", moved: true })).toBe(true);
  });

  it("keeps the file when a page is dropped where it started", () => {
    // A lift, an Escape and a drop back onto the row's own position are not a
    // new page order, so the file still matches the list.
    expect(invalidates({ kind: "reorder", moved: false })).toBe(false);
  });

  it("keeps the file for exactly the two changes that did not change the document", () => {
    // The whole matrix in one place: a sixth kind of change has to be added to
    // this list and to the switch in `core/invalidation.ts`, so forgetting to
    // decide what it does is not how a produced file goes stale.
    const everyChange: DocumentChange[] = [
      { kind: "paper" },
      { kind: "add", accepted: 20 },
      { kind: "add", accepted: 0 },
      { kind: "remove" },
      { kind: "clear" },
      { kind: "reorder", moved: true },
      { kind: "reorder", moved: false },
    ];

    expect(everyChange.filter((change) => !invalidates(change))).toEqual([
      { kind: "add", accepted: 0 },
      { kind: "reorder", moved: false },
    ]);
  });
});
