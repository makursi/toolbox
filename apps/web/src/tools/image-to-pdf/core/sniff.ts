/**
 * What a file's leading bytes say it is.
 *
 * The file input carries no `accept` attribute and the name is never consulted:
 * a renamed file, and the HEIC a phone hands out called `.jpg`, are exactly what
 * this module exists to catch. Three formats are taken; four more are
 * recognised as images this Tool does not take, so the refusal can be the same
 * sentence for all of them; everything else is not an image.
 *
 * Signatures only. Nothing here decodes, and nothing here is asynchronous.
 */

/** The formats this Tool puts into a PDF. */
export type ImageFormat = "jpeg" | "png" | "webp";

/** Images a visitor can have that this Tool recognises and does not take. */
export type UnsupportedImageFormat = "avif" | "bmp" | "gif" | "heic";

/** Everything the sniffer can name. */
export type SniffedFormat = ImageFormat | UnsupportedImageFormat;

/**
 * How many leading bytes a caller must hand `sniffFormat`.
 *
 * Enough for every signature here and for the ISO-BMFF brand list, which is how
 * AVIF and HEIC are told apart.
 */
export const sniffByteLength = 96;

const acceptedFormats: ReadonlySet<SniffedFormat> = new Set<SniffedFormat>(["jpeg", "png", "webp"]);

/** Whether a sniffed format is one this Tool takes. */
export function isAcceptedFormat(format: SniffedFormat): format is ImageFormat {
  return acceptedFormats.has(format);
}

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// AVIF and HEIC share the ISO-BMFF container; the `ftyp` brands are the only
// thing that tells them apart.
const avifBrands = new Set(["avif", "avis", "avio"]);
// `mif1`/`msf1` are generic HEIF brands. They mean HEIC only when no AVIF brand
// is present, which is why AVIF is checked first.
const heicBrands = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
]);

/**
 * Read the format from a file's leading bytes, or `null` when they are not an
 * image this Tool can name at all.
 *
 * The answer is a format, never a filename: the caller must not be able to pass
 * a name in, because a name is the one thing an uploader controls.
 */
export function sniffFormat(bytes: Uint8Array): SniffedFormat | null {
  if (startsWith(bytes, pngSignature)) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") return "gif";
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "bmp";
  if (ascii(bytes, 4, 4) === "ftyp") return sniffIsoBmff(bytes);

  return null;
}

function sniffIsoBmff(bytes: Uint8Array): SniffedFormat | null {
  const brands = new Set<string>();
  const boxSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  const end = Math.min(bytes.length, boxSize === 0 ? bytes.length : boxSize, sniffByteLength);

  // The major brand sits at 8 and compatible brands follow in 4-byte groups.
  // The box's own size bounds the scan, so a truncated file cannot be read past
  // its end.
  for (let offset = 8; offset + 4 <= end; offset += 4) {
    const brand = ascii(bytes, offset, 4);
    if (brand !== null) brands.add(brand);
  }

  for (const brand of brands) if (avifBrands.has(brand)) return "avif";
  for (const brand of brands) if (heicBrands.has(brand)) return "heic";

  return null;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string | null {
  if (offset + length > bytes.length) return null;

  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}
