import { describe, expect, it } from "vitest";

import {
  displaySize,
  ORIENTATIONS,
  orientationMatrix,
  readExifOrientation,
  swapsSides,
  type ExifOrientation,
} from "@/tools/image-to-pdf/core/orientation";

/**
 * The EXIF orientation table: eight values, the matrix each one produces, and the
 * size swap the last four ask for.
 *
 * The expected matrices are worked examples against the EXIF definition, not the
 * implementation's own numbers written out again: value 6 is "rotate 90 CW", so
 * the stored top-left corner has to land on the display's top-right one. A
 * matrix that places the corners there is the matrix a page-writer needs, and
 * the corner assertions below say that in the vocabulary of the picture rather
 * than of the arithmetic.
 */

/** The corners of a unit square, in the stored image's own coordinates (y up). */
const storedCorners = {
  topLeft: [0, 1],
  topRight: [1, 1],
  bottomLeft: [0, 0],
  bottomRight: [1, 0],
} as const;

type Corner = keyof typeof storedCorners;

const corners = ["topLeft", "topRight", "bottomLeft", "bottomRight"] as const;

/** Apply a `[a b c d e f]` matrix to a point, the way PDF's `cm` and canvas both do. */
function apply(matrix: readonly number[], point: readonly number[]): [number, number] {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = matrix;
  const [x = 0, y = 0] = point;

  return [a * x + c * y + e, b * x + d * y + f];
}

/** Where each orientation sends a corner of the recorded picture. */
const cornerPlacement: Record<ExifOrientation, Record<Corner, Corner>> = {
  1: {
    topLeft: "topLeft",
    topRight: "topRight",
    bottomLeft: "bottomLeft",
    bottomRight: "bottomRight",
  },
  2: {
    topLeft: "topRight",
    topRight: "topLeft",
    bottomLeft: "bottomRight",
    bottomRight: "bottomLeft",
  },
  3: {
    topLeft: "bottomRight",
    topRight: "bottomLeft",
    bottomLeft: "topRight",
    bottomRight: "topLeft",
  },
  4: {
    topLeft: "bottomLeft",
    topRight: "bottomRight",
    bottomLeft: "topLeft",
    bottomRight: "topRight",
  },
  5: {
    topLeft: "topLeft",
    topRight: "bottomLeft",
    bottomLeft: "topRight",
    bottomRight: "bottomRight",
  },
  6: {
    topLeft: "topRight",
    topRight: "bottomRight",
    bottomLeft: "topLeft",
    bottomRight: "bottomLeft",
  },
  7: {
    topLeft: "bottomRight",
    topRight: "topRight",
    bottomLeft: "bottomLeft",
    bottomRight: "topLeft",
  },
  8: {
    topLeft: "bottomLeft",
    topRight: "topLeft",
    bottomLeft: "bottomRight",
    bottomRight: "topRight",
  },
};

/** Build the APP1 payload an Exif segment carries: "Exif", then a TIFF directory. */
function exifPayload(orientation: number | null, order: "II" | "MM" = "II"): Uint8Array {
  const little = order === "II";
  const short = (value: number): number[] =>
    little ? [value & 0xff, (value >> 8) & 0xff] : [(value >> 8) & 0xff, value & 0xff];
  const long = (value: number): number[] =>
    little
      ? [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff]
      : [(value >>> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];

  const bytes = [
    // The signature every APP1 that carries Exif starts with.
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00,
    ...(little ? [0x49, 0x49] : [0x4d, 0x4d]),
    ...short(42),
    ...long(8),
  ];

  // IFD0 holds at most the one tag this reader cares about.
  bytes.push(...(orientation === null ? short(0) : short(1)));
  if (orientation !== null) {
    bytes.push(...short(0x0112), ...short(3), ...long(1), ...short(orientation), ...short(0));
  }
  bytes.push(...long(0));

  return new Uint8Array(bytes);
}

describe("the orientation table", () => {
  it("has exactly the eight values EXIF defines", () => {
    expect(ORIENTATIONS).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("produces the matrix each value is defined as, worked out by hand", () => {
    // PDF's `cm` order: x' = a x + c y + e, y' = b x + d y + f, on the unit square.
    expect(orientationMatrix(1)).toEqual([1, 0, 0, 1, 0, 0]);
    expect(orientationMatrix(2)).toEqual([-1, 0, 0, 1, 1, 0]);
    expect(orientationMatrix(3)).toEqual([-1, 0, 0, -1, 1, 1]);
    expect(orientationMatrix(4)).toEqual([1, 0, 0, -1, 0, 1]);
    expect(orientationMatrix(5)).toEqual([0, -1, -1, 0, 1, 1]);
    expect(orientationMatrix(6)).toEqual([0, -1, 1, 0, 0, 1]);
    expect(orientationMatrix(7)).toEqual([0, 1, 1, 0, 0, 0]);
    expect(orientationMatrix(8)).toEqual([0, 1, -1, 0, 1, 0]);
  });

  it("sends every corner where the value's name says it goes", () => {
    for (const orientation of ORIENTATIONS) {
      const matrix = orientationMatrix(orientation);

      for (const corner of corners) {
        const [x, y] = apply(matrix, storedCorners[corner]);
        const target = cornerPlacement[orientation][corner];
        const [expectedX, expectedY] = storedCorners[target];

        expect([x, y], `orientation ${String(orientation)} ${corner}`).toEqual([
          expectedX,
          expectedY,
        ]);
      }
    }
  });
});

describe("the size swap", () => {
  it("swaps the sides only for the four that rotate by a quarter turn", () => {
    expect(ORIENTATIONS.map((orientation) => swapsSides(orientation))).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
  });

  it("answers the dimensions the picture is viewed at", () => {
    const stored = { width: 96, height: 128 };

    expect(displaySize(stored, 1)).toEqual({ width: 96, height: 128 });
    expect(displaySize(stored, 3)).toEqual({ width: 96, height: 128 });
    expect(displaySize(stored, 5)).toEqual({ width: 128, height: 96 });
    expect(displaySize(stored, 6)).toEqual({ width: 128, height: 96 });
    expect(displaySize(stored, 7)).toEqual({ width: 128, height: 96 });
    expect(displaySize(stored, 8)).toEqual({ width: 128, height: 96 });
  });
});

describe("reading the orientation from an Exif segment", () => {
  it("reads a little-endian value", () => {
    expect(readExifOrientation(exifPayload(6))).toBe(6);
  });

  it("reads a big-endian value", () => {
    expect(readExifOrientation(exifPayload(8, "MM"))).toBe(8);
  });

  it("is null when the segment has no orientation tag", () => {
    expect(readExifOrientation(exifPayload(null))).toBeNull();
  });

  it("is null for a value EXIF does not define, a foreign payload, or a cut segment", () => {
    expect(readExifOrientation(exifPayload(9))).toBeNull();
    expect(readExifOrientation(exifPayload(0))).toBeNull();
    expect(readExifOrientation(new Uint8Array([0x4a, 0x46, 0x49, 0x46]))).toBeNull();
    expect(readExifOrientation(exifPayload(6).subarray(0, 12))).toBeNull();
  });
});
