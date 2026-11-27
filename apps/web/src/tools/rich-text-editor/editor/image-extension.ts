import Image from "@tiptap/extension-image";

import { DEFAULT_IMAGE_WIDTH, asImageWidth } from "../core/image";

/**
 * The image node: `@tiptap/extension-image`, configured so a document can carry its
 * own pixels and a width that reads as a share of the measure (#216).
 *
 * `allowBase64` is the one option that makes this node usable at all: the CSP here
 * allows `img-src 'self'` and the site has no upload service, so an image *is* a
 * `data:` URL in the document JSON (issue #215's Implementation Decisions). The
 * extension refuses base64 sources by default, which would make every image the
 * visitor inserts invisible after a reload — the node would be in the JSON and the
 * parser would drop it on the way back in.
 *
 * The width is a percentage rather than pixels for one reason that outlasts this
 * slice: Markdown has no width syntax, so the export has to drop it, and a
 * percentage is the only number whose absence is not a visible lie when a file is
 * re-read at a different measure. The stock attribute renders `width="50"`, an HTML
 * pixel width, so it is replaced here: it renders as `style="width: 50%"` and
 * parses back from either form, which is what the canvas's `max-width: 100%` guard
 * works on and what the image panel's presets set (#218).
 *
 * The bounds and the default are `core/image.ts`'s, not this file's: the HTML
 * writer clamps the same value out of JSON, and a document can arrive from an
 * import (#220) or from a hand-edited draft, so the two must answer the same
 * question the same way.
 */

/** A width from either form HTML can carry, defaulting to the measure. */
function parseWidth(element: HTMLElement): number {
  return (
    asImageWidth(element.style.width) ??
    asImageWidth(element.getAttribute("width")) ??
    DEFAULT_IMAGE_WIDTH
  );
}

/**
 * The node this Tool registers, as `ImageNode` rather than `Image`.
 *
 * The name is its own so a reader can tell the configured node from the package's
 * default one at the import site; nothing else about the extension is wrapped.
 */
export const ImageNode = Image.extend({
  addAttributes() {
    return {
      /*
       * The package's own attributes first — src, alt, title — and width last, so
       * this one replaces the pixel-valued definition rather than sitting beside it.
       * `title` stays because the package's Markdown writer uses it; this Tool's
       * node carries alt and width only, but dropping an attribute the extension
       * still renders would be a second, silent schema change.
       */
      ...this.parent?.(),
      width: {
        default: DEFAULT_IMAGE_WIDTH,
        parseHTML: (element: HTMLElement) => parseWidth(element),
        renderHTML: (attributes: Record<string, unknown>) => ({
          style: `width: ${asImageWidth(attributes.width) ?? DEFAULT_IMAGE_WIDTH}%`,
        }),
      },
    };
  },
}).configure({
  allowBase64: true,
  inline: false,
});
