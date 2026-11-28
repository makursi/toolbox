import { describe, expect, it } from "vitest";

import {
  BLOCK_DRAG_THRESHOLD,
  BLOCK_HANDLE_LABEL,
  BLOCK_HANDLE_SIZE,
  BLOCK_MENU_LABEL,
  BLOCK_OPERATIONS,
  blockAtPointer,
  blockHandleHome,
  dropBoundary,
  dropIndicatorTop,
  moveBlockIndex,
  placeBlockHandle,
} from "@/tools/rich-text-editor/core/block";

/**
 * The block handle's rules (#229): what its menu offers, where the handle is
 * drawn, and the arithmetic a drop is decided by.
 *
 * Everything here is data or arithmetic that can be held without a DOM. Whether
 * the browser really draws the handle there is the hit-area Instrument's reading
 * (`block-handle-clearance`); whether a drag really reorders the document is the
 * browser gate's. This file is the rule both of them stand on.
 */

/**
 * Three blocks, one above the next, as `getBoundingClientRect` would give them:
 * a block is a vertical band and the pointer decides by its midpoint.
 */
const BLOCKS = [
  { bottom: 140, top: 100 },
  { bottom: 180, top: 140 },
  { bottom: 220, top: 180 },
];

/** A block the handle is drawn beside: its top is what the handle lines up with. */
const BLOCK = { bottom: 160, top: 120 };

describe("the block menu's words", () => {
  it("names the handle and the menu it opens", () => {
    expect(BLOCK_HANDLE_LABEL).toBe("块手柄");
    expect(BLOCK_MENU_LABEL).toBe("块操作");
  });

  it("offers the three operations in the order the menu draws them", () => {
    expect(BLOCK_OPERATIONS).toEqual([
      { id: "move-up", label: "上移" },
      { id: "move-down", label: "下移" },
      { id: "delete", label: "删除" },
    ]);
  });

  it("separates a click from a drag at four pixels", () => {
    expect(BLOCK_DRAG_THRESHOLD).toBe(4);
  });

  it("is a 44px control, the size the site's controls are", () => {
    expect(BLOCK_HANDLE_SIZE).toBe(44);
  });
});

/**
 * The drop boundary: the index of the gap a block would land in, counted before
 * the dragged block is taken out. A block's own midpoint decides which side of it
 * the pointer is on, so the boundary changes exactly halfway down a block rather
 * than at its edges.
 */
describe("dropBoundary", () => {
  it("answers 0 above the first block, and 0 for an empty document", () => {
    expect(dropBoundary(BLOCKS, 90)).toBe(0);
    expect(dropBoundary([], 100)).toBe(0);
  });

  it("answers the gap between two blocks", () => {
    // Midpoints: 120, 160, 200. The pointer at 150 is past the first and not
    // past the second, so the block would land between them.
    expect(dropBoundary(BLOCKS, 150)).toBe(1);
    expect(dropBoundary(BLOCKS, 190)).toBe(2);
  });

  it("changes side at a block's midpoint", () => {
    expect(dropBoundary(BLOCKS, 119)).toBe(0);
    expect(dropBoundary(BLOCKS, 121)).toBe(1);
  });

  it("answers the document's length below the last block", () => {
    expect(dropBoundary(BLOCKS, 230)).toBe(3);
    expect(dropBoundary(BLOCKS, 220)).toBe(3);
  });
});

/**
 * The index the dragged block ends at once it is taken out.
 *
 * Removing the source shifts every index after it down by one, which is the case
 * this function exists for: a block dropped after the last one lands at
 * `boundary - 1`, not at `boundary`. Dropping a block just above or just below
 * itself is no move at all.
 */
describe("moveBlockIndex", () => {
  it("shifts a boundary after the source down by the removal", () => {
    expect(moveBlockIndex(0, 3)).toBe(2);
    expect(moveBlockIndex(1, 3)).toBe(2);
    expect(moveBlockIndex(0, 2)).toBe(1);
  });

  it("leaves a boundary before the source alone", () => {
    expect(moveBlockIndex(2, 0)).toBe(0);
    expect(moveBlockIndex(1, 0)).toBe(0);
  });

  it("is no move when the block is dropped above or below itself", () => {
    expect(moveBlockIndex(0, 0)).toBe(0);
    expect(moveBlockIndex(0, 1)).toBe(0);
    expect(moveBlockIndex(1, 1)).toBe(1);
    expect(moveBlockIndex(1, 2)).toBe(1);
    expect(moveBlockIndex(2, 2)).toBe(2);
    expect(moveBlockIndex(2, 3)).toBe(2);
  });
});

/** The block a pointer at a y is over, for the handle that follows the pointer. */
describe("blockAtPointer", () => {
  it("names the block whose band the pointer is in", () => {
    expect(blockAtPointer(BLOCKS, 90)).toBe(0);
    expect(blockAtPointer(BLOCKS, 110)).toBe(0);
    expect(blockAtPointer(BLOCKS, 150)).toBe(1);
    expect(blockAtPointer(BLOCKS, 210)).toBe(2);
    expect(blockAtPointer(BLOCKS, 300)).toBe(2);
  });

  it("has no answer for a document with no blocks", () => {
    expect(blockAtPointer([], 100)).toBeNull();
  });
});

/** Where the 2px ink line is drawn for a boundary. */
describe("dropIndicatorTop", () => {
  it("draws at the top edge of the block below the boundary", () => {
    expect(dropIndicatorTop(BLOCKS, 0)).toBe(100);
    expect(dropIndicatorTop(BLOCKS, 1)).toBe(140);
    expect(dropIndicatorTop(BLOCKS, 2)).toBe(180);
  });

  it("draws at the bottom edge of the last block below the whole document", () => {
    expect(dropIndicatorTop(BLOCKS, 3)).toBe(220);
  });

  it("has no line for a document with no blocks", () => {
    expect(dropIndicatorTop([], 0)).toBeNull();
  });
});

/**
 * The handle's two homes.
 *
 * The site's geometry decides them: the content column is 960px with 16px of
 * inline padding, the canvas card is 720px wide, so the gutter beside the canvas
 * is `(content − 720) / 2`. It reaches 52px — the 44px control plus 8px of
 * clearance — at an 856px viewport, and stays under that width below it.
 */
describe("blockHandleHome", () => {
  it("keeps the handle in the page gutter at 856px and wider", () => {
    expect(blockHandleHome({ height: 900, width: 856 })).toBe("gutter");
    expect(blockHandleHome({ height: 900, width: 1024 })).toBe("gutter");
    expect(blockHandleHome({ height: 900, width: 1440 })).toBe("gutter");
  });

  it("puts the handle inside the canvas's inset below 856px", () => {
    expect(blockHandleHome({ height: 844, width: 390 })).toBe("inset");
    expect(blockHandleHome({ height: 900, width: 768 })).toBe("inset");
    // One pixel under the crossing: the gutter is 51.5px, which cannot hold 52.
    expect(blockHandleHome({ height: 900, width: 855 })).toBe("inset");
  });
});

/**
 * The placement at the ticket's four widths.
 *
 * The canvas's measured left edge is the one the browser draws — 16px at 390,
 * 24 at 768, 68 at 856 and 360 at 1440 — and each case spells out where the
 * handle has to land: flush with the content column in the gutter, and flush
 * with the canvas's inner left edge in the inset.
 */
describe("placeBlockHandle", () => {
  const VIEWPORTS = [
    { home: "inset", left: 16, viewport: { height: 844, width: 390 }, canvasLeft: 16 },
    { home: "inset", left: 24, viewport: { height: 900, width: 768 }, canvasLeft: 24 },
    { home: "gutter", left: 16, viewport: { height: 900, width: 856 }, canvasLeft: 68 },
    { home: "gutter", left: 308, viewport: { height: 900, width: 1440 }, canvasLeft: 360 },
  ] as const;

  it("lands in the home the gutter width decides", () => {
    for (const entry of VIEWPORTS) {
      expect(
        placeBlockHandle(BLOCK, { left: entry.canvasLeft, top: 100, width: 720 }, entry.viewport),
      ).toEqual({ home: entry.home, left: entry.left, top: 120 });
    }
  });

  it("never reaches the text measure of the block it names, at any of the four widths", () => {
    // The text left is the canvas's inner edge plus its own padding: 20px when the
    // gutter holds the handle (the card's `p-5`), 52px when the canvas carries the
    // inset. Written out rather than derived from the module, so a changed
    // placement has to be a changed expectation.
    const textLefts = [68, 76, 88, 380];

    VIEWPORTS.forEach((entry, index) => {
      const placement = placeBlockHandle(
        BLOCK,
        { left: entry.canvasLeft, top: 100, width: 720 },
        entry.viewport,
      );
      const textLeft = textLefts[index];
      if (textLeft === undefined) throw new Error(`no text left for case ${index}`);

      expect(
        placement.left + BLOCK_HANDLE_SIZE,
        `the handle reaches ${placement.left + BLOCK_HANDLE_SIZE} at ${entry.viewport.width}px, and the text starts at ${textLeft}`,
      ).toBeLessThanOrEqual(textLeft);
      expect(placement.left).toBeGreaterThanOrEqual(0);
    });
  });

  it("stays inside the viewport when the block is above or below it", () => {
    const viewport = { height: 900, width: 1024 };
    const canvas = { left: 152, top: 100, width: 720 };

    expect(placeBlockHandle({ bottom: 40, top: 0 }, canvas, viewport).top).toBe(8);
    expect(placeBlockHandle({ bottom: 960, top: 920 }, canvas, viewport).top).toBe(848);
    expect(placeBlockHandle({ bottom: 700, top: 660 }, canvas, viewport).top).toBe(660);
  });
});
