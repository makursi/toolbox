/**
 * The closed set of ways a build can fail, and the one plain sentence each
 * carries.
 *
 * A decoder's, a browser's or a Worker's own error text never reaches the
 * interface: it goes to the console, and the visitor gets the sentence for the
 * step that failed. An error this module does not recognise becomes the generic
 * sentence rather than an English stack trace.
 */

import { imageTooManyPixelsSentence } from "./limits";

/**
 * Why a build failed, as a value the Worker can send back and the hook can name.
 *
 * `too-many-pixels` is the pixel limit reached during a build rather than at
 * admission: the header said the image was small enough, and the decode
 * disagreed. Its sentence is the limit's own, because one condition has one
 * sentence however it was discovered.
 */
export type PdfFailureCode =
  | "unreadable"
  | "unsupported"
  | "too-many-pixels"
  | "interrupted"
  | "unknown";

const sentences: Record<PdfFailureCode, string> = {
  unreadable: "这张图片读不出来，换一张再试。",
  unsupported: "这张图片暂时无法直接写入 PDF，换一张再试。",
  "too-many-pixels": imageTooManyPixelsSentence,
  interrupted: "生成被中断了，请再试一次。",
  unknown: "生成 PDF 失败，请再试一次。",
};

/** The failure a module raises when it knows which step failed. */
export class PdfFailure extends Error {
  readonly code: PdfFailureCode;

  constructor(code: PdfFailureCode, options?: { cause?: unknown }) {
    super(code, options);
    this.name = "PdfFailure";
    this.code = code;
  }
}

/** The sentence a visitor reads for `code`. */
export function failureSentence(code: PdfFailureCode): string {
  return sentences[code];
}

/** The code an unknown thrown value stands for; anything unrecognised is `unknown`. */
export function failureCode(error: unknown): PdfFailureCode {
  return error instanceof PdfFailure ? error.code : "unknown";
}

/** The sentence a visitor reads for any thrown value. */
export function describeFailure(error: unknown): string {
  return failureSentence(failureCode(error));
}
