import { describe, expect, it } from "vitest";

import { DEFAULT_PAPER, PAPERS } from "@/tools/image-to-pdf/core/geometry";
import {
  orderCancelled,
  orderDropped,
  orderHandleLabel,
  orderInstructions,
  orderMoved,
  orderPickedUp,
  orderRoleDescription,
  originalSizeHint,
  paperLabels,
} from "@/tools/image-to-pdf/core/hints";

/**
 * The words on the page that a test can hold. The paper row's three names are
 * one word each, and the explanation of 原始尺寸 is the one sentence on this page
 * that reads as paper to some visitors and as pixels to others, so it says what
 * the tool means by it and the unit test keeps it saying that.
 */

describe("the paper row's words", () => {
  it("offers the three papers in the control's order, defaulting to A4", () => {
    expect(PAPERS).toEqual(["a4", "letter", "original"]);
    expect(PAPERS[0]).toBe(DEFAULT_PAPER);
    expect(DEFAULT_PAPER).toBe("a4");
  });

  it("names every paper the control offers", () => {
    expect(paperLabels).toEqual({ a4: "A4", letter: "Letter", original: "原始尺寸" });
  });

  it("explains 原始尺寸 as the image's own pixels at 96 dpi, not as paper", () => {
    expect(originalSizeHint).toContain("像素");
    expect(originalSizeHint).toContain("96 dpi");
    expect(originalSizeHint).toContain("0.75");
    expect(originalSizeHint).toContain("不是一种纸");
    // The site's copy rule: no em dash anywhere a visitor reads.
    expect(originalSizeHint).not.toContain("—");
  });
});

/**
 * The words the reordering path says.
 *
 * Two of these are read rather than seen: the handle's name is in the hit-area
 * instrument's declaration, and the announcements are what a screen-reader user
 * hears as the row lifts, moves and lands. A wording a test holds is a wording
 * that cannot quietly become a different sentence.
 */

describe("the reordering path's words", () => {
  it("names every row's handle the same way", () => {
    // The instrument declares controls by accessible name and cannot declare
    // twenty different ones, so this name is a contract rather than a label.
    expect(orderHandleLabel).toBe("拖动排序");
  });

  it("describes the handle's role to a screen reader in the page's language", () => {
    expect(orderRoleDescription).toBe("可排序页面");
  });

  it("tells a keyboard visitor how to lift, move and drop", () => {
    expect(orderInstructions).toBe(
      "按空格键拿起这一页，用上、下方向键移动，再按空格键放下；按 Esc 取消。",
    );
  });

  it("announces the lift, the destination, the drop and the cancellation", () => {
    expect(orderPickedUp(1, 3)).toBe("已拿起第 1 页，共 3 页。用上、下方向键移动，按空格键放下。");
    expect(orderMoved(1, 3, 3)).toBe("第 1 页已移到第 3 位，共 3 页。");
    expect(orderDropped(1, 3)).toBe("已放下，第 1 页现在在第 3 位。");
    expect(orderCancelled).toBe("已取消排序，页面顺序没有改变。");
  });

  it("never uses an em dash, and names a position as a position", () => {
    for (const sentence of [
      orderInstructions,
      orderPickedUp(2, 4),
      orderMoved(2, 3, 4),
      orderDropped(2, 3),
      orderCancelled,
    ]) {
      expect(sentence).not.toContain("—");
      expect(sentence).not.toContain("–");
    }

    // A destination is a position in the list, not another page's number: the
    // two are the same number only when the page did not move.
    expect(orderMoved(4, 2, 5)).toContain("第 2 位");
    expect(orderDropped(4, 2)).toContain("第 2 位");
  });
});
