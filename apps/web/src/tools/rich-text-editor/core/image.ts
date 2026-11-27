/**
 * The image node's two shared rules: the width it may be drawn at, and what
 * remains of an image that cannot be drawn (#216, #220).
 *
 * Both used to live twice. The node (`editor/image-extension.ts`) parsed and
 * rendered the percentage, and the HTML writer (`core/html.ts`) clamped the same
 * value again from JSON; the Markdown reader, the HTML sanitiser and the two
 * places that flatten a refused image each spelled out "its alt text, or nothing"
 * for themselves. A rule with two copies is a rule that can disagree with itself,
 * and the width is document content: a hand-edited draft, an imported file and a
 * node attribute have to be bounded by the same numbers.
 */

/** The width a freshly inserted image takes: the whole of the reading measure. */
export const DEFAULT_IMAGE_WIDTH = 100;

/** The narrowest a picture may be drawn, in percent of the measure. */
const MIN_IMAGE_WIDTH = 1;

/** The widest a picture may be drawn: never past the measure. */
const MAX_IMAGE_WIDTH = 100;

/**
 * A width from either form HTML can carry, kept inside the measure, or `null` when
 * the value names no number at all.
 *
 * `width="50%"` is how a writer may type it, `width="50"` is what a browser
 * serialises a percentage attribute to in some cases, and `style.width` is the form
 * the node renders. All three mean the same number here, and a value that is not a
 * number is `null` rather than a default: the caller is the one that knows what to
 * fall back to, and an `<img>` attribute and a ProseMirror node may want different
 * ones.
 */
export function asImageWidth(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;

    return Math.min(MAX_IMAGE_WIDTH, Math.max(MIN_IMAGE_WIDTH, Math.round(value)));
  }

  if (typeof value !== "string") return null;

  const match = /^\s*(\d+(?:\.\d+)?)\s*%?\s*$/u.exec(value);
  if (match === null) return null;

  const parsed = Number.parseFloat(match[1] ?? "");

  return Number.isFinite(parsed) ? asImageWidth(parsed) : null;
}

/**
 * The alt text an image leaves behind when it cannot be drawn, or `null` when it
 * has none.
 *
 * A source the Tool cannot draw — a remote URL, a `data:` URL that is not
 * measurable base64, or an image over one of the admission limits — becomes the
 * words that were written about it; an image with no alt leaves nothing rather than
 * an empty block. The HTML sanitiser and the Markdown reader both answer this way,
 * and so does the Markdown reader's inline flattening, which is why the answer is
 * here instead of in each parser.
 *
 * This is not `IMAGE_ALT_FALLBACK` (`core/copy.ts`): that word is for an accepted
 * file whose name says nothing, while this is the refusal's answer.
 */
export function imageAltText(alt: unknown): string | null {
  return typeof alt === "string" && alt !== "" ? alt : null;
}
