import { describe, expect, it } from "vitest";

import { A4, LETTER, ORIGINAL_SCALE, pageGeometry } from "@/tools/image-to-pdf/core/geometry";

/**
 * The one geometry function this Tool has. The row's miniature and the PDF
 * writer both call it, so what is asserted here is the rectangle a page-writer
 * needs: a page box in points and the image's own rectangle inside it.
 *
 * The expected values are worked examples against the spec, not the arithmetic
 * of the implementation written out again: a square image on A4 leaves
 * `(841.89 - 595.28) / 2` of white above and below, and a landscape image asks
 * A4 to be used sideways.
 */

describe("page geometry", () => {
  it("states the paper sizes the ticket settled", () => {
    expect(A4).toEqual({ width: 595.28, height: 841.89 });
    expect(LETTER).toEqual({ width: 612, height: 792 });
    expect(ORIGINAL_SCALE).toBe(0.75);
  });

  it("puts a portrait image on A4 contained and centred", () => {
    const geometry = pageGeometry({ width: 600, height: 800 }, "a4");

    expect(geometry.page).toEqual({ width: 595.28, height: 841.89 });

    // 600:800 is wider than A4 is, so the width is the limiting side.
    expect(geometry.image.width).toBeCloseTo(595.28, 4);
    expect(geometry.image.height).toBeCloseTo(793.7067, 3);
    expect(geometry.image.x).toBeCloseTo(0, 6);
    expect(geometry.image.y).toBeCloseTo((841.89 - 793.7067) / 2, 3);
  });

  it("turns A4 sideways when the image is landscape", () => {
    const geometry = pageGeometry({ width: 1600, height: 900 }, "a4");

    expect(geometry.page).toEqual({ width: 841.89, height: 595.28 });

    // The width is still the limiting side: 1600 / 900 is wider than 841.89 / 595.28.
    expect(geometry.image.width).toBeCloseTo(841.89, 4);
    expect(geometry.image.height).toBeCloseTo(473.5631, 3);
    expect(geometry.image.x).toBeCloseTo(0, 6);
    expect(geometry.image.y).toBeCloseTo((595.28 - 473.5631) / 2, 3);
  });

  it("keeps Letter at 612x792 and follows the image's orientation", () => {
    const portrait = pageGeometry({ width: 400, height: 800 }, "letter");
    expect(portrait.page).toEqual({ width: 612, height: 792 });
    expect(portrait.image.width).toBeCloseTo(396, 4);
    expect(portrait.image.height).toBeCloseTo(792, 4);
    expect(portrait.image.x).toBeCloseTo(108, 4);
    expect(portrait.image.y).toBeCloseTo(0, 6);

    const landscape = pageGeometry({ width: 800, height: 400 }, "letter");
    expect(landscape.page).toEqual({ width: 792, height: 612 });
    expect(landscape.image.width).toBeCloseTo(792, 4);
    expect(landscape.image.height).toBeCloseTo(396, 4);
    expect(landscape.image.x).toBeCloseTo(0, 6);
    expect(landscape.image.y).toBeCloseTo(108, 4);
  });

  it("uses the image's own size at 96 dpi for 原始尺寸", () => {
    const geometry = pageGeometry({ width: 1000, height: 1500 }, "original");

    expect(geometry.page).toEqual({ width: 750, height: 1125 });
    expect(geometry.image).toEqual({ x: 0, y: 0, width: 750, height: 1125 });
  });

  it("contains a very wide image on A4 with white above and below", () => {
    const geometry = pageGeometry({ width: 4000, height: 100 }, "a4");

    // A 40:1 strip asks A4 to be used sideways; the width is the limiting side
    // and the rest of the page is the margin above and below.
    expect(geometry.page).toEqual({ width: 841.89, height: 595.28 });
    expect(geometry.image.width).toBeCloseTo(841.89, 4);
    expect(geometry.image.height).toBeCloseTo((100 / 4000) * 841.89, 4);
    expect(geometry.image.x).toBeCloseTo(0, 6);
    expect(geometry.image.y).toBeCloseTo((595.28 - (100 / 4000) * 841.89) / 2, 3);
  });

  it("never lets the image leave the page or change its aspect ratio", () => {
    const images = [
      { width: 1, height: 1000 },
      { width: 1000, height: 1 },
      { width: 1000, height: 1000 },
      { width: 1024, height: 768 },
      { width: 4032, height: 3024 },
    ];

    for (const image of images) {
      for (const paper of ["a4", "letter", "original"] as const) {
        const geometry = pageGeometry(image, paper);
        const ratio = image.width / image.height;

        expect(geometry.image.width).toBeGreaterThan(0);
        expect(geometry.image.height).toBeGreaterThan(0);
        expect(geometry.image.x).toBeGreaterThanOrEqual(0);
        expect(geometry.image.y).toBeGreaterThanOrEqual(0);
        expect(geometry.image.x + geometry.image.width).toBeLessThanOrEqual(
          geometry.page.width + 1e-9,
        );
        expect(geometry.image.y + geometry.image.height).toBeLessThanOrEqual(
          geometry.page.height + 1e-9,
        );
        expect(geometry.image.width / geometry.image.height).toBeCloseTo(ratio, 9);
      }
    }
  });

  it("centres the image on both axes", () => {
    const geometry = pageGeometry({ width: 300, height: 600 }, "letter");

    expect(geometry.image.x).toBeCloseTo((612 - geometry.image.width) / 2, 9);
    expect(geometry.image.y).toBeCloseTo((792 - geometry.image.height) / 2, 9);
  });
});
