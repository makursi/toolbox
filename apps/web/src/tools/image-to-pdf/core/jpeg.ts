/**
 * A byte walk over a JPEG's header, without decoding it.
 *
 * The Tool needs three facts before it can put a JPEG on a page: how many pixels
 * it has, how many colour components it carries, and whether its frame is
 * progressive. All three live in the `SOFn` segment, which is a handful of bytes
 * behind zero or more length-prefixed segments, so this walks markers rather
 * than trusting the file's name or its extension.
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
 * `other` is every other frame type, which this Tool leaves alone.
 */
export type JpegFrame = "baseline" | "progressive" | "other";

/** What a JPEG's own header says about it. */
export type JpegInfo = {
  width: number;
  height: number;
  channels: number;
  frame: JpegFrame;
  /**
   * The EXIF orientation, 1 meaning upright. It is fixed at 1 for now: #198 owns
   * reading the APP1 segment, and that is where this field begins to vary. The
   * page's geometry is already written against the field rather than against the
   * absence of one, so #198 changes this module and the content-stream matrix
   * together and nothing above them.
   */
  orientation: number;
};

const EOI = 0xd9;
const SOS = 0xda;

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

    if (frameMarkers.has(marker)) return readFrame(view, marker, offset, length);

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
    // #198: an APP1/Exif segment before the frame changes this; nothing else
    // in this module does.
    orientation: 1,
  };
}

/**
 * Whether the JPEG can go into the PDF with its original bytes.
 *
 * The passthrough path is `/Filter /DCTDecode` over the untouched file, which
 * keeps the photo's own generation. It is only correct when the frame is
 * sequential and the colour space is one PDF reads without a transform:
 * baseline carries 1 channel (gray) or 3 (YCbCr, which DCTDecode converts to
 * `DeviceRGB` itself). A progressive file needs a browser decode first, and a
 * 4-channel one is CMYK or YCCK, which needs the decode path's colour handling;
 * both are #198's work, so both are refused here rather than written wrongly.
 */
export function canPassThrough(info: JpegInfo): boolean {
  return info.frame === "baseline" && (info.channels === 1 || info.channels === 3);
}
