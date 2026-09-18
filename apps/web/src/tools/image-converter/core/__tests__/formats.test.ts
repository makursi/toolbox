import { describe, expect, it } from "vitest";

import { formatSpecs, imageFormats, type ImageFormat } from "@/tools/image-converter/core/formats";

describe("the format table", () => {
  it("lists every format exactly once", () => {
    expect(imageFormats).toHaveLength(Object.keys(formatSpecs).length);
    expect(new Set(imageFormats).size).toBe(imageFormats.length);
  });

  it("gives every format a distinct mime type and extension", () => {
    const mimes = imageFormats.map((format) => formatSpecs[format].mime);
    const extensions = imageFormats.map((format) => formatSpecs[format].extension);

    expect(new Set(mimes).size).toBe(mimes.length);
    expect(new Set(extensions).size).toBe(extensions.length);
  });

  it("marks the formats that cannot carry alpha", () => {
    expect(formatSpecs.jpeg.alpha).toBe(false);
    expect(formatSpecs.bmp.alpha).toBe(false);
    expect(formatSpecs.png.alpha).toBe(true);
    expect(formatSpecs.webp.alpha).toBe(true);
    expect(formatSpecs.avif.alpha).toBe(true);
  });

  it("gives every format a quality the codecs accept", () => {
    // Only these three read `quality` — the switch in the Worker's `encode` is
    // what decides that, and PNG and BMP are encoded without a codec that takes
    // one (PNG's own knob, the oxipng level, is a constant in that same file).
    // The table is the only place this number is set now that the Tool has no
    // output settings (ADR-0010), so a value outside the 1-100 the encoders
    // take is not a poor default: it is an encode that fails the first time a
    // visitor runs one.
    const lossy: ImageFormat[] = ["jpeg", "webp", "avif"];

    for (const format of lossy) {
      const { quality } = formatSpecs[format];
      expect(Number.isInteger(quality), format).toBe(true);
      expect(quality, format).toBeGreaterThanOrEqual(1);
      expect(quality, format).toBeLessThanOrEqual(100);
    }
  });
});
