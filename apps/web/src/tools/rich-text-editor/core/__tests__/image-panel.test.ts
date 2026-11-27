import { describe, expect, it } from "vitest";

import {
  IMAGE_ALT_APPLY_LABEL,
  IMAGE_ALT_LABEL,
  IMAGE_ALT_PLACEHOLDER,
  IMAGE_DELETE_LABEL,
  IMAGE_PANEL_LABEL,
  IMAGE_REPLACE_LABEL,
  IMAGE_WIDTH_PRESETS,
  placeImagePanel,
  widthPresetLabel,
} from "@/tools/rich-text-editor/core/image-panel";

/**
 * The image panel's rules, as data and arithmetic (#218).
 *
 * The words here are the ticket's own — 替换, 替代文本, 删除 and the four presets —
 * because the panel is the one surface where a visitor changes an image that is
 * already in the document, and the gate spells the same words out. The placement
 * cases are the ticket's other two promises: the bar never sits on the picture it
 * edits while either side has room for it, and it stays inside a 390px viewport
 * rather than hanging off the edge of a phone.
 *
 * The geometry is arithmetic rather than a measurement: this function is handed the
 * image's box, its own measured box and the viewport, and answers where the bar
 * goes. Whether the browser then draws it there is the gate's question; whether the
 * rule is right is this file's.
 */

/** The image the panel is for, as a viewport rectangle. */
const anchor = (top: number, bottom: number, left = 60) => ({ bottom, left, top });

/** The bar's own measured box: one row of controls. */
const SIZE = { height: 60, width: 300 };

/** A desktop viewport with room above and below. */
const DESKTOP = { height: 900, width: 1024 };

/** The width the ticket names: the panel has to fit on a phone. */
const PHONE = { height: 844, width: 390 };

describe("IMAGE_WIDTH_PRESETS", () => {
  it("offers the four shares of the measure the spec decided, in that order", () => {
    expect([...IMAGE_WIDTH_PRESETS]).toEqual([25, 50, 75, 100]);
  });

  it("names each preset by the share it sets, so a screen reader reads a number", () => {
    expect(IMAGE_WIDTH_PRESETS.map(widthPresetLabel)).toEqual([
      "宽度 25%",
      "宽度 50%",
      "宽度 75%",
      "宽度 100%",
    ]);
  });
});

describe("the panel's words", () => {
  it("names its three actions with the words the ticket uses", () => {
    expect([IMAGE_REPLACE_LABEL, IMAGE_ALT_LABEL, IMAGE_DELETE_LABEL]).toEqual([
      "替换",
      "替代文本",
      "删除",
    ]);
  });

  it("names the region, the field and the field's action", () => {
    expect([IMAGE_PANEL_LABEL, IMAGE_ALT_PLACEHOLDER, IMAGE_ALT_APPLY_LABEL]).toEqual([
      "图片操作",
      "描述这张图片",
      "应用",
    ]);
  });

  it("keeps every sentence free of the two dashes the copy rules forbid", () => {
    for (const sentence of [
      IMAGE_PANEL_LABEL,
      IMAGE_REPLACE_LABEL,
      IMAGE_ALT_LABEL,
      IMAGE_ALT_PLACEHOLDER,
      IMAGE_ALT_APPLY_LABEL,
      IMAGE_DELETE_LABEL,
      widthPresetLabel(50),
    ]) {
      expect(sentence).not.toContain("—");
      expect(sentence).not.toContain("–");
      expect(sentence).not.toContain("——");
    }
  });
});

describe("placeImagePanel", () => {
  it("sits above the image, one gap away, when there is room for it", () => {
    expect(placeImagePanel(anchor(400, 600), SIZE, DESKTOP)).toEqual({
      left: 60,
      top: 400 - 60 - 8,
    });
  });

  it("moves below an image too near the top to hold it", () => {
    expect(placeImagePanel(anchor(40, 300), SIZE, DESKTOP)).toEqual({ left: 60, top: 300 + 8 });
  });

  it("covers the image only when neither side has room for the bar", () => {
    // An image taller than the viewport: there is no side with room, so the bar
    // takes the roomier side and stays on the page rather than off it.
    const placement = placeImagePanel(anchor(0, 800), SIZE, PHONE);

    expect(placement.top).toBeGreaterThanOrEqual(8);
    expect(placement.top + SIZE.height).toBeLessThanOrEqual(PHONE.height - 8);
  });

  it("never sits on the image it edits while one of the two sides has room", () => {
    for (const top of [0, 40, 120, 300, 500, 700]) {
      const placement = placeImagePanel(anchor(top, top + 180), SIZE, DESKTOP);
      const clear = placement.top + SIZE.height <= top || placement.top >= top + 180;

      expect(
        clear,
        `an image at ${top}…${top + 180} was covered by a bar at ${placement.top}`,
      ).toBe(true);
    }
  });

  it("stays inside the viewport horizontally, at 390px and next to its right edge", () => {
    const placement = placeImagePanel(anchor(400, 600, 330), SIZE, PHONE);

    expect(placement.left).toBeGreaterThanOrEqual(8);
    expect(placement.left + SIZE.width).toBeLessThanOrEqual(PHONE.width - 8);
  });

  it("stays inside the viewport vertically when the image runs off the bottom of a phone", () => {
    const placement = placeImagePanel(anchor(10, 830), SIZE, PHONE);

    expect(placement.top).toBeGreaterThanOrEqual(8);
    expect(placement.top + SIZE.height).toBeLessThanOrEqual(PHONE.height - 8);
  });

  it("keeps room at both edges for a bar as wide as the phone itself", () => {
    // A wrapped panel measures as wide as the phone allows, which is the case a
    // narrow window produces: the left clamp must still leave the 8px margins.
    const placement = placeImagePanel(anchor(400, 600, 12), { height: 104, width: 374 }, PHONE);

    expect(placement.left).toBe(8);
    expect(placement.left + 374).toBeLessThanOrEqual(PHONE.width - 8);
  });
});
