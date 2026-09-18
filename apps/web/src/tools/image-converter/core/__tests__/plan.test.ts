import { describe, expect, it } from "vitest";

import { planConversions } from "@/tools/image-converter/core/plan";

describe("planConversions", () => {
  it("plans one Conversion per source and target format", () => {
    const planned = planConversions(["a.png", "b.png"], ["webp", "avif"]);

    expect(planned).toHaveLength(4);
    expect(planned.map((entry) => entry.outputName)).toEqual([
      "a.webp",
      "a.avif",
      "b.webp",
      "b.avif",
    ]);
  });

  it("plans nothing when no target format is chosen", () => {
    expect(planConversions(["a.png"], [])).toEqual([]);
  });

  it("keeps the order the sources were added in", () => {
    const planned = planConversions(["first.png", "second.png"], ["jpeg"]);

    expect(planned.map((entry) => entry.sourceName)).toEqual(["first.png", "second.png"]);
  });

  it("keeps two sources with the same base name apart", () => {
    const planned = planConversions(["photo.png", "photo.jpg"], ["webp"]);

    expect(planned.map((entry) => entry.outputName)).toEqual(["photo.webp", "photo-1.webp"]);
  });

  it("numbers the Conversions so a Worker response can be matched", () => {
    const planned = planConversions(["a.png", "b.png"], ["png"]);

    expect(planned.map((entry) => entry.id)).toEqual([0, 1]);
  });

  it("remembers which source file each Conversion came from", () => {
    const planned = planConversions(["a.png", "b.png"], ["webp"]);

    expect(planned.map((entry) => entry.sourceIndex)).toEqual([0, 1]);
  });

  it("remembers the format each Conversion is encoded to", () => {
    const planned = planConversions(["a.png"], ["webp", "bmp"]);

    expect(planned.map((entry) => entry.format)).toEqual(["webp", "bmp"]);
  });
});
