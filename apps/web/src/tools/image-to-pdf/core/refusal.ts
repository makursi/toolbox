/**
 * "No, and here is the sentence the visitor reads."
 *
 * Two checks answer a file this way: whether its bytes are a format the Tool
 * takes, and whether its own header could be read. They are separate decisions
 * with separate wording, but the visitor-facing shape of a refusal is one
 * thing, so it is spelled once here.
 *
 * One sentence covers every unsupported format on purpose. A list of refused
 * formats expires the first time a format is added, and the visitor does not
 * need the format's name to act: the accepted formats are the positive form of
 * the same rule.
 */
export type Refusal = { ok: false; message: string };

/** A recognised image in a format this Tool does not take. AVIF, BMP, HEIC and GIF all get this one. */
export const unsupportedFormatSentence =
  "这个格式的图片暂时不支持，请换成 JPEG、PNG 或 WebP 的图片。";

/** A file whose bytes are not an image at all. */
export const notAnImageSentence = "这个文件不是图片，换一个再试。";

/** A recognised image whose own header stops before it says how big it is. */
export const damagedImageSentence = "这张图片已经损坏，读不出来，换一张再试。";
