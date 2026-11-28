/**
 * The layer the page's floating surfaces sit on (#207, #218, #229).
 *
 * The selection toolbar and the image panel are `position: fixed` rows placed from a
 * box in the document; the block handle and the drag's drop line (#229) are the same
 * kind of surface — a 44px control placed from the block it names, and the 2px line
 * the gesture draws. All four have to sit above the canvas while staying below the
 * popovers their own controls open (the link address field, the alt field, the block
 * menu), and they are one layer rather than a number each, so a later change to one
 * cannot leave another under the canvas — which reads as a surface that never
 * appeared.
 *
 * The reason this file gave before the handle existed — "they never appear for the
 * same selection" — was true of the two selection surfaces and is not true of the
 * handle: it is on the page from the moment the editor is, so it and the selection
 * toolbar can be on screen at once. The layer is a shared height, not a claim that
 * only one of its surfaces exists at a time; what keeps them apart is geometry
 * (the gutter or the canvas inset for the handle, the selection's own side for the
 * row, off the picture for the panel), which each surface's own placement function
 * owns.
 */
export const FLOATING_LAYER_Z_INDEX = 40;
