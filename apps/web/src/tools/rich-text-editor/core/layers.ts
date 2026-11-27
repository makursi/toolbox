/**
 * The layer the page's two floating surfaces sit on (#207, #218).
 *
 * The selection toolbar and the image panel are both `position: fixed` rows placed
 * from a box in the document, and both have to sit above the canvas while staying
 * below the popovers their own controls open (the link address field, the alt
 * field). They never appear for the same selection — one needs a text selection,
 * the other an image selection — so they are one layer rather than two, and the
 * number lives here so the pair cannot drift apart: two copies would let a later
 * change to one leave the other under the canvas, which reads as a row that never
 * opened.
 */
export const FLOATING_LAYER_Z_INDEX = 40;
