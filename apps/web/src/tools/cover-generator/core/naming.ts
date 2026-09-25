/**
 * The output filename rule from issue #50: the default name is the ratio plus
 * the two texts, made safe for the filesystem, and de-duplicated with a numeric
 * suffix the way the Image Converter's `naming` does. The filename input field
 * arrives in a later slice (#60); the default it is pre-filled with comes from
 * here.
 */

/** The characters no common filesystem accepts; a filename never carries them. */
const INVALID = /[<>:"/\\|?*]/g;

export function sanitizeFileName(text: string): string {
  // Control characters are filtered by code point rather than by regex: the
  // lint rules want no control characters inside a regular expression.
  return Array.from(text)
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .replace(INVALID, "")
    .trim();
}

/**
 * A ratio's key is how it is shown ("16:9"); its file label has to survive
 * Windows, where `:` is forbidden, so a key and its file label are different
 * things: the colon becomes a hyphen. A ratio with nothing left after
 * sanitizing falls back to "cover".
 */
export function ratioFileLabel(ratioId: string): string {
  return sanitizeFileName(ratioId.replaceAll(":", "-")) || "cover";
}

/** The default cover name: ratio + the two texts, made safe. */
export function defaultCoverName(ratioId: string, leftText: string, rightText: string): string {
  const words = `${sanitizeFileName(leftText)}${sanitizeFileName(rightText)}`;
  return `${ratioFileLabel(ratioId)}${words === "" ? "" : `-${words}`}`;
}

/** De-duplicate the way the Image Converter does: `name`, `name-1`, `name-2`. */
export function uniqueCoverName(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 1;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
