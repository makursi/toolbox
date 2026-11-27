import { describe, expect, it } from "vitest";

import {
  DEFAULT_IMAGE_WIDTH,
  asImageWidth,
  imageAltText,
} from "@/tools/rich-text-editor/core/image";

/**
 * The image node's width rule (#216, #220).
 *
 * The rule is read by two entry points that see different shapes — the node's
 * `parseHTML` reads an element, the HTML writer reads JSON — so the test drives the
 * shared function instead of either caller: a clamp that only one of them applied
 * would still show up here as one number disagreeing with itself.
 */
describe("the image width rule", () => {
  it("reads both forms an HTML attribute can carry", () => {
    expect(asImageWidth("50%")).toBe(50);
    expect(asImageWidth("50")).toBe(50);
    expect(asImageWidth(50)).toBe(50);
    expect(asImageWidth(" 75 % ")).toBe(75);
  });

  it("rounds, then keeps the value inside the measure", () => {
    expect(asImageWidth(50.4)).toBe(50);
    expect(asImageWidth(50.6)).toBe(51);
    expect(asImageWidth(0)).toBe(1);
    expect(asImageWidth(-10)).toBe(1);
    expect(asImageWidth(140)).toBe(100);
    expect(DEFAULT_IMAGE_WIDTH).toBe(100);
  });

  it("answers null for a value that names no number", () => {
    expect(asImageWidth("")).toBeNull();
    expect(asImageWidth("wide")).toBeNull();
    expect(asImageWidth(Number.NaN)).toBeNull();
    expect(asImageWidth(undefined)).toBeNull();
    expect(asImageWidth(true)).toBeNull();
  });
});

/**
 * What remains of an image that cannot be drawn (#220).
 *
 * The HTML sanitiser and the Markdown reader both answer this way, and so does the
 * Markdown reader's inline flattening: the words are the description the visitor
 * can still use, and an image with no alt leaves nothing rather than an empty node.
 */
describe("the refused image's alt text", () => {
  it("keeps the words, and has nothing when the alt is empty or absent", () => {
    expect(imageAltText("一只在海边的猫")).toBe("一只在海边的猫");
    expect(imageAltText("")).toBeNull();
    expect(imageAltText(undefined)).toBeNull();
    expect(imageAltText(null)).toBeNull();
    expect(imageAltText(7)).toBeNull();
  });
});
