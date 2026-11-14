import { readExifOrientation, type ExifOrientation } from "./orientation";

/**
 * A byte walk over a JPEG's header, without decoding it.
 *
 * The Tool needs four facts before it can put a JPEG on a page: how many pixels
 * it has, how many colour components it carries, whether its frame is
 * progressive, and which way EXIF says to turn it. The first three live in the
 * `SOFn` segment, the last in an `APP1/Exif` segment, and both sit behind zero or
 * more length-prefixed segments, so this walks markers rather than trusting the
 * file's name or its extension.
 *
 * Nothing here decodes pixels and nothing here is asynchronous: the same walk
 * runs in the page (for the row's miniature) and in the Worker (for the PDF's
 * image XObject), against plain bytes.
 */

/**
 * Which `SOFn` frame a JPEG declares.
 *
 * `baseline` covers the sequential DCT frames (SOF0 and SOF1, both of which a
 * `DCTDecode` stream can carry). `progressive` is SOF2 and needs a decode first.
 * `other` is every other frame type, which no PDF filter and no browser decodes.
 */
export type JpegFrame = "baseline" | "progressive" | "other";

/** What a JPEG's own header says about it. */
export type JpegInfo = {
  /**
   * The stored pixel dimensions, as the frame header states them. An EXIF
   * orientation of 5-8 turns the picture, so the page's dimensions are these
   * swapped (`core/orientation.ts` does the swap) while the image stream keeps
   * these, because these are the samples it carries.
   */
  width: number;
  height: number;
  channels: number;
  frame: JpegFrame;
  /** The EXIF orientation, 1 meaning upright. */
  orientation: ExifOrientation;
};

const EOI = 0xd9;
const SOS = 0xda;
const APP1 = 0xe1;

/**
 * Every `SOFn` marker. They all carry the same first seven payload bytes; only
 * the frame type differs, and the ones this Tool does not recognise are still
 * worth stopping at rather than walking past as if they were length-prefixed
 * data, because a frame means no later `SOFn` is coming.
 */
const frameMarkers = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/** Standalone markers: no length field follows them. */
function isStandalone(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

function frameOf(marker: number): JpegFrame {
  if (marker === 0xc2) return "progressive";
  if (marker === 0xc0 || marker === 0xc1) return "baseline";

  return "other";
}

/**
 * Read a JPEG's header, or answer `null` when the bytes are not a complete
 * enough JPEG to describe one page.
 *
 * Every malformed shape answers `null` rather than throwing: the caller has a
 * sentence for "this file could not be read", and a decoder's own complaint is
 * not that sentence.
 */
export function readJpeg(bytes: Uint8Array): JpegInfo | null {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  // A view rather than indexed reads: every accessor here answers a number for a
  // range the bounds checks have already proved, which keeps the walk free of
  // assertions and of `undefined` arithmetic.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // The first two bytes were SOI; every segment from here carries a marker.
  let offset = 2;
  // The first `APP1/Exif` that carries the tag wins; a JPEG may carry several
  // APP1 segments (XMP is one) and only one of them is the Exif directory.
  let orientation: ExifOrientation | null = null;

  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return null;

    let marker = view.getUint8(offset + 1);
    // A marker may be preceded by any number of 0xFF fill bytes.
    while (marker === 0xff && offset + 5 <= view.byteLength) {
      offset += 1;
      marker = view.getUint8(offset + 1);
    }

    offset += 2;

    if (marker === 0xd8) return null;
    if (isStandalone(marker)) continue;
    if (marker === EOI || marker === SOS) return null;

    if (offset + 2 > view.byteLength) return null;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > view.byteLength) return null;

    if (marker === APP1 && orientation === null) {
      // The payload starts after the two length bytes.
      orientation = readExifOrientation(bytes.subarray(offset + 2, offset + length));
    }

    if (frameMarkers.has(marker)) return readFrame(view, marker, offset, length, orientation);

    // Skip this segment's payload; its length includes the two length bytes.
    offset += length;
  }

  return null;
}

/**
 * The `SOFn` payload: precision, height, width, component count, then three
 * bytes a component. The caller has already bounded the segment.
 */
function readFrame(
  view: DataView,
  marker: number,
  offset: number,
  length: number,
  orientation: ExifOrientation | null,
): JpegInfo | null {
  // precision, height (2), width (2), components: six bytes.
  if (length < 8 || offset + 8 > view.byteLength) return null;

  // The offset is the segment's first length byte; the payload starts after it.
  const height = view.getUint16(offset + 3);
  const width = view.getUint16(offset + 5);
  const channels = view.getUint8(offset + 7);

  if (width === 0 || height === 0 || channels === 0) return null;

  return {
    width,
    height,
    channels,
    frame: frameOf(marker),
    // No tag, a tag outside 1-8, or a directory that does not parse: upright,
    // which is what every reader that ignores the tag shows.
    orientation: orientation ?? 1,
  };
}

/**
 * Whether the JPEG can go into the PDF with its original bytes.
 *
 * The passthrough path is `/Filter /DCTDecode` over the untouched file, which
 * keeps the photo's own generation. It is only correct when the frame is
 * sequential and the colour space is one PDF reads without a transform:
 * baseline carries 1 channel (gray) or 3 (YCbCr, which DCTDecode converts to
 * `DeviceRGB` itself). Progressive and four-channel files are not refused any
 * more: `routeJpeg` sends them to the browser's decoder.
 */
export function canPassThrough(info: JpegInfo): boolean {
  return info.frame === "baseline" && (info.channels === 1 || info.channels === 3);
}

/**
 * Which of the two image paths a JPEG takes.
 *
 * `passthrough` keeps the original bytes and turns them with a content-stream
 * matrix; `decode` means the browser decodes the picture and the writer takes
 * raw RGB samples, because no PDF filter carries a progressive or four-channel
 * JPEG the way DCTDecode carries a baseline one. `unsupported` is the frame
 * types neither path can read (lossless, arithmetic-coded): writing one as
 * DCTDecode would produce a file that opens to a blank page, and the browser
 * cannot decode it either.
 *
 * The decision is here, in the pure layer, so every branch is unit-tested
 * without a browser; the Worker only follows it.
 */
export type JpegRoute = "passthrough" | "decode" | "unsupported";

export function routeJpeg(info: JpegInfo): JpegRoute {
  if (canPassThrough(info)) return "passthrough";
  if (info.frame === "progressive" || info.channels === 4) return "decode";

  return "unsupported";
}
