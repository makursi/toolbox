/**
 * What the Tool says when a Conversion does not work, and what it says to the
 * console instead.
 *
 * The table below is every failure this project can explain: a file that will
 * not decode, a canvas the browser will not hand over, a codec that refused, a
 * Conversion that was interrupted, a Worker that died, a file that left the
 * list, and the pixel limit (which always arrives with its own measured
 * sentence). Anything else — a browser string, a bug of ours — gets the one
 * fallback, `unknown`, and the original text goes to the console where it is
 * worth something.
 *
 * Same arrangement as `hints.ts`: the wording lives in the pure half, so it can
 * be tested without a browser. What it replaced was the browser's own message
 * rendered at the visitor: `broken.webp: The source image could not be
 * decoded.` — English, in an interface that is otherwise entirely Chinese, and
 * phrased for whoever wrote the decoder rather than for whoever uploaded the
 * file.
 */
export type FailureKind =
  | "decode"
  | "canvas"
  | "encode"
  | "too-many-pixels"
  | "interrupted"
  | "gone"
  | "unknown";

const sentences: Record<FailureKind, string> = {
  decode: "这个文件解不开，可能已经损坏或者不完整。",
  canvas: "浏览器没有提供绘图画布，这个环境没法处理图片。",
  encode: "编码没有成功。再点一次转换，或者换一个目标格式试试。",
  // Never shown in practice: the Worker always hands over the measured sentence
  // from `checkLimits`. It carries no numbers on purpose, so there is nothing
  // here to keep in step with that module.
  "too-many-pixels": "这张图的像素太多，超出了上限。",
  interrupted: "转换进程中断了。再点一次转换就行。",
  gone: "这个文件已经不在列表里了。",
  unknown: "转换没有完成。再点一次转换，或者换一个目标格式试试。",
};

/**
 * A failure this project can explain.
 *
 * `sentence` replaces the table entry when the failure measured something worth
 * repeating — the pixel limit names the dimensions it refused. `cause` keeps
 * whatever actually threw, so the console line is not reduced to our own prose.
 */
export class ConversionFailure extends Error {
  readonly kind: FailureKind;

  constructor(kind: FailureKind, options: { cause?: unknown; sentence?: string } = {}) {
    super(options.sentence ?? failureSentence(kind), { cause: options.cause });
    this.name = "ConversionFailure";
    this.kind = kind;
  }
}

/**
 * The sentence for a kind, for the places that are not throwing anything: a
 * Conversion whose file left the list is a sentence, not an exception.
 */
export function failureSentence(kind: FailureKind): string {
  return sentences[kind];
}

/** The sentence to show for a failed Conversion, whatever went wrong. */
export function describeFailure(error: unknown): string {
  return error instanceof ConversionFailure ? error.message : failureSentence("unknown");
}

/**
 * What to log about a failure: the thing that actually threw, when there is one.
 * A failure with nothing behind it logs itself, rather than the word `undefined`.
 */
export function failureCause(error: unknown): unknown {
  return error instanceof ConversionFailure ? (error.cause ?? error) : error;
}
