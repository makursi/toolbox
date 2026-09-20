# The mark is a supplied illustration, not a drawn monogram

The site's mark used to be the wordmark's first letter — a geometric `T` on an ink tile — because `apps/web/docs/design/assets.md` had declared that the header's text _was_ the logo and that no graphic would be invented beside it. The owner then supplied a drawn character, the site's namesake, so the mark is that illustration now: cropped to the head and shoulders for the tab, shown beside the wordmark in the header, and exported to `apple-icon.png` for a home screen. A drawn `T` was derived from the wordmark and so could stay off the page; a character is derived from nothing, which is why this one is on the page and not only in a tab.

## Consequences

- Two rules in the design language are departed from knowingly. The mark is **not monochrome**: it keeps the illustration's own colours, which extends the exception the Tool cover already had (`apps/web/docs/design/colour.md`) from a card's picture to the site's own chrome. And the header's text is no longer the whole logo.
- The mark is a **bitmap**, because there is no vector original. The tab icon is a crop of the head and shoulders rather than the whole figure: rendered at 16px the figure is a brown vertical smudge, and the crop is the only version that reads in a tab.
- `apple-icon.png` therefore has a background and no alpha channel. iOS renders transparency as black, and the character's hat is dark grey, so the ink tile the old mark used would swallow the most distinctive part of the drawing; the background is the warm canvas instead.
- Every served file is an export of one master, and the master is the supplied file itself, byte for byte (`apps/web/assets/brand/makursi.png`, 500×500, 190 KB). The art is **not covered by the repository's licence**, the same way the Tool cover is not — forking the repo does not grant the right to reuse it.

## Considered Options

- **Keeping the `T` monogram**: rejected. The owner supplied the art for exactly this purpose, and a monogram of the wordmark's first letter is not even available for a name whose first character is 马.
- **A warm duotone treatment of the same illustration**, so the mark obeys the monochrome rule: rejected. It was tried on the Tool cover and lost there too, and desaturating a character removes the one thing that makes it recognisable beside an otherwise grey interface.
- **The whole figure in the tab** instead of a crop: rejected on evidence. At 16px it is a smudge; the head-and-shoulders crop is legible.
- **A vector redraw of the character**: rejected. That means drawing new art rather than using what was supplied, and this repo does not invent graphics to fill a slot — the same rule that keeps a Tool card without a cover set in type.
