import { describe, expect, it } from "vitest";

import { canPassThrough, readJpeg } from "@/tools/image-to-pdf/core/jpeg";

/**
 * The JPEG walk. It reads a JPEG's own header for the three things the page and
 * the writer need: pixel dimensions, channel count and whether the frame is
 * progressive. No decoding, no DOM, and no binary fixture — the bytes are built
 * here, segment by segment.
 *
 * It is deliberately narrow: enough segments to walk (`APP0` + `SOF` + `SOS`) and
 * a garbage tail, because the writer copies the original bytes and only the
 * header is ever read.
 */

type JpegOptions = {
  width: number;
  height: number;
  channels?: number;
  progressive?: boolean;
  /** Bytes put into an APP1 segment before the frame, so the walk has to skip a payload. */
  appPayload?: number;
};

function segment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;

  return [0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload];
}

function jpegBytes({
  width,
  height,
  channels = 3,
  progressive = false,
  appPayload = 0,
}: JpegOptions): Uint8Array {
  const bytes: number[] = [0xff, 0xd8];

  // APP0 (JFIF), 14 payload bytes, the usual first segment of an encoded photo.
  bytes.push(
    ...segment(
      0xe0,
      [0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00],
    ),
  );

  if (appPayload > 0) {
    bytes.push(
      ...segment(
        0xe1,
        Array.from({ length: appPayload }, () => 0x2a),
      ),
    );
  }

  // The frame header: precision, height, width, components, then three bytes a
  // component.
  const frame = [
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    channels,
  ];

  for (let component = 0; component < channels; component += 1) {
    frame.push(component + 1, 0x11, 0x00);
  }

  bytes.push(...segment(progressive ? 0xc2 : 0xc0, frame));

  // A scan header and one byte of entropy data; the walk has already returned by
  // the time it reaches this, but a real file carries it.
  const scan = [channels];
  for (let component = 0; component < channels; component += 1) {
    scan.push(component + 1, 0x00);
  }
  scan.push(0x00, 0x3f, 0x00);

  bytes.push(...segment(0xda, scan), 0x00, 0xff, 0xd9);

  return new Uint8Array(bytes);
}

describe("reading a JPEG", () => {
  it("reads the pixel dimensions from the frame header", () => {
    const info = readJpeg(jpegBytes({ width: 4032, height: 3024 }));

    expect(info).toMatchObject({ width: 4032, height: 3024, channels: 3 });
  });

  it("reads the component count", () => {
    expect(readJpeg(jpegBytes({ width: 4, height: 4, channels: 1 }))?.channels).toBe(1);
    expect(readJpeg(jpegBytes({ width: 4, height: 4, channels: 3 }))?.channels).toBe(3);
    expect(readJpeg(jpegBytes({ width: 4, height: 4, channels: 4 }))?.channels).toBe(4);
  });

  it("detects a progressive frame", () => {
    expect(readJpeg(jpegBytes({ width: 8, height: 8 }))?.frame).toBe("baseline");
    expect(readJpeg(jpegBytes({ width: 8, height: 8, progressive: true }))?.frame).toBe(
      "progressive",
    );
  });

  it("walks past a payload that is longer than the frame's interesting bytes", () => {
    const info = readJpeg(jpegBytes({ width: 1200, height: 800, appPayload: 4096 }));

    expect(info).toMatchObject({ width: 1200, height: 800, channels: 3 });
  });

  it("leaves the EXIF orientation at upright until #198 reads APP1", () => {
    expect(readJpeg(jpegBytes({ width: 8, height: 8 }))?.orientation).toBe(1);
  });

  it("answers null for bytes that are not a JPEG, or are cut short", () => {
    expect(readJpeg(new Uint8Array())).toBeNull();
    expect(readJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(readJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBeNull();
    expect(readJpeg(jpegBytes({ width: 8, height: 8 }).subarray(0, 12))).toBeNull();
  });
});

describe("the passthrough predicate", () => {
  it("passes a baseline 1-channel JPEG through unchanged", () => {
    const info = readJpeg(jpegBytes({ width: 8, height: 8, channels: 1 }));

    expect(info).not.toBeNull();
    expect(canPassThrough(info!)).toBe(true);
  });

  it("passes a baseline 3-channel JPEG through unchanged", () => {
    const info = readJpeg(jpegBytes({ width: 8, height: 8, channels: 3 }));

    expect(info).not.toBeNull();
    expect(canPassThrough(info!)).toBe(true);
  });

  it("sends a progressive JPEG to the decode path", () => {
    const info = readJpeg(jpegBytes({ width: 8, height: 8, progressive: true }));

    expect(info).not.toBeNull();
    expect(canPassThrough(info!)).toBe(false);
  });

  it("sends a 4-channel JPEG to the decode path", () => {
    const info = readJpeg(jpegBytes({ width: 8, height: 8, channels: 4 }));

    expect(info).not.toBeNull();
    expect(canPassThrough(info!)).toBe(false);
  });
});
