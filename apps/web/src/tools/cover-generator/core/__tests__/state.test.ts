import { describe, expect, it } from "vitest";

import {
  createDefaultComposition,
  proportionalSizes,
  updateComposition,
} from "@/tools/cover-generator/core/state";

/**
 * The composition is the Tool's pure state model: two texts, one weight, one
 * ratio. The style sliders arrive in a later slice (#59); what is tested here is
 * the shape a visitor sees on load and how one field changes without touching
 * the others.
 */
describe("composition state", () => {
  it("starts as the sample layout the visitor sees", () => {
    expect(createDefaultComposition()).toEqual({
      leftText: "示例",
      rightText: "文本",
      weight: 400,
      ratioId: "16:9",
      icon: { source: "lucide", name: "image" },
      iconVisible: true,
      iconBackground: false,
      backgroundImage: null,
      backgroundOpacity: 1,
      backgroundBlur: 0,
      backgroundGrayscale: 0,
      fontFamily: null,
      fontSize: 64,
      iconSize: 64,
      iconRadius: 0,
      spacing: 20,
      proportional: false,
      colorSync: true,
      textColor: "#000000",
      iconColor: "#000000",
      bgColor: "#ffffff",
      shadowScope: "none",
      shadowColor: "#000000",
      filename: "",
      transparent: false,
    });
  });

  it("updates one field at a time without touching the others", () => {
    const next = updateComposition(createDefaultComposition(), { leftText: "新品发布" });
    expect(next.leftText).toBe("新品发布");
    expect(next.rightText).toBe("文本");
    expect(next.ratioId).toBe("16:9");
  });

  it("updates the background blur without touching grayscale or the rest", () => {
    const next = updateComposition(createDefaultComposition(), { backgroundBlur: 40 });
    expect(next.backgroundBlur).toBe(40);
    expect(next.backgroundGrayscale).toBe(0);
    expect(next.leftText).toBe("示例");
  });

  it("returns the same object when nothing changes", () => {
    const before = createDefaultComposition();
    expect(updateComposition(before, {})).toBe(before);
  });

  it("scales the sibling sizes with the font under 等比缩放", () => {
    expect(proportionalSizes(64)).toEqual({ iconSize: 64, spacing: 20 });
    expect(proportionalSizes(128)).toEqual({ iconSize: 128, spacing: 40 });
  });
});
