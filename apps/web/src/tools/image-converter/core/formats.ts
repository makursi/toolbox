/**
 * The formats this Tool can read and write.
 *
 * One table, read by the UI (labels), the naming code (extensions) and the
 * encoder registry (mime types), so a format cannot be spelled three ways.
 */
export type ImageFormat = "png" | "jpeg" | "webp" | "avif" | "bmp";

/** `always` formats ignore the quality setting; `never` ones have no lossless mode. */
export type LosslessMode = "always" | "optional" | "never";

export type FormatSpec = {
  format: ImageFormat;
  label: string;
  mime: string;
  extension: string;
  /** Whether the format can carry an alpha channel. */
  alpha: boolean;
  lossless: LosslessMode;
  /**
   * The quality to start the slider at.
   *
   * Not the same number for every codec on purpose: libavif's 50 is roughly
   * libwebp's and MozJPEG's 75, so one shared default would make AVIF output
   * look worse than the others for no reason the user chose.
   */
  quality: number;
};

/**
 * What transparent pixels become when the target format cannot carry alpha.
 *
 * Pure white, and deliberately not the interface's surface token: this is a
 * pixel in the visitor's own file, not a surface of the site. Flattening onto
 * the warm bone of the light scheme would read as a tinting bug in the exported
 * image. There is no control for it any more — see
 * `docs/adr/0010-no-output-settings.md`.
 */
export const flattenBackground = "#ffffff";

export const formatSpecs: Record<ImageFormat, FormatSpec> = {
  png: {
    format: "png",
    label: "PNG",
    mime: "image/png",
    extension: "png",
    alpha: true,
    lossless: "always",
    quality: 75,
  },
  jpeg: {
    format: "jpeg",
    label: "JPEG",
    mime: "image/jpeg",
    extension: "jpg",
    alpha: false,
    lossless: "never",
    quality: 75,
  },
  webp: {
    format: "webp",
    label: "WebP",
    mime: "image/webp",
    extension: "webp",
    alpha: true,
    lossless: "optional",
    quality: 75,
  },
  avif: {
    format: "avif",
    label: "AVIF",
    mime: "image/avif",
    extension: "avif",
    alpha: true,
    lossless: "optional",
    quality: 50,
  },
  bmp: {
    format: "bmp",
    label: "BMP",
    mime: "image/bmp",
    extension: "bmp",
    alpha: false,
    lossless: "always",
    quality: 75,
  },
};

/** The order the UI offers them in: the useful ones first. */
export const imageFormats: ImageFormat[] = ["png", "jpeg", "webp", "avif", "bmp"];
