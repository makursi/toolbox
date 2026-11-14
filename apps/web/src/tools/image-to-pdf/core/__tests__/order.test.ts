import { describe, expect, it } from "vitest";

import { movePage } from "@/tools/image-to-pdf/core/order";

/**
 * The ordering rule, held by a test instead of by a browser.
 *
 * Both reordering paths end in the same question — the visitor moved the item at
 * one position onto another, what is the new order? — and the answer is this
 * function. A test at the gate proves the drag works; this one proves what
 * "works" means for the list.
 */

/** Three pages, told apart by a name, because the order is the whole subject. */
const pages = ["first", "second", "third"];

describe("movePage", () => {
  it("moves an item forward and closes the gap behind it", () => {
    expect(movePage(pages, 0, 2)).toEqual(["second", "third", "first"]);
  });

  it("moves an item backward and closes the gap behind it", () => {
    expect(movePage(pages, 0, 1)).toEqual(["second", "first", "third"]);
    expect(movePage(pages, 2, 0)).toEqual(["third", "first", "second"]);
  });

  it("leaves the order alone when the item is dropped where it was", () => {
    expect(movePage(pages, 1, 1)).toEqual(pages);
  });

  it("leaves the order alone for a position that does not exist", () => {
    // A drop outside the list, or an id the list no longer holds, is not an
    // instruction to move anything, and a list that is silently half-moved is
    // worse than one that did not change.
    expect(movePage(pages, -1, 1)).toEqual(pages);
    expect(movePage(pages, 0, 3)).toEqual(pages);
    expect(movePage([], 0, 0)).toEqual([]);
  });

  it("does not mutate the list it was given", () => {
    const original = [...pages];
    movePage(original, 0, 2);

    expect(original).toEqual(pages);
  });

  it("keeps the moved object itself, not a copy of it", () => {
    const first = { id: 1 };
    const second = { id: 2 };
    const moved = movePage([first, second], 0, 1);

    expect(moved[1]).toBe(first);
    expect(moved[0]).toBe(second);
  });
});
