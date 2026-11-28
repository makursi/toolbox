/**
 * The block handle's rules (#229): the operations its menu offers, where the
 * control is drawn, and the arithmetic a pointer drag is decided by.
 *
 * It lives in the pure core for the reason `core/table.ts` and
 * `core/image-panel.ts` do: the block menu is an interface rather than a TipTap
 * chain, so what it offers is data, and the handle's two homes and the drop
 * boundary are arithmetic — the two things a Node test can hold without a DOM.
 * Whether a drag really reorders the document is the browser gate's question, and
 * whether the browser draws the handle clear of the text is the hit-area
 * Instrument's; both stand on the numbers here.
 *
 * The block operations are deliberately **not** rows of the command table. They
 * act on the block a handle names rather than on the document-wide selection the
 * toolbar's commands act on, and the toolbar never renders them. `BlockOperationId`
 * is the union `editor/execute.ts`'s second executor map is keyed by, the shape
 * `TableOperationId` and `TABLE_EXECUTORS` already establish; the four conversions
 * the menu also carries are the command table's own `block` group, not a second
 * list of block types.
 */

/** The handle's accessible name: a button that names the block it acts on. */
export const BLOCK_HANDLE_LABEL = "块手柄";

/** The menu's accessible name, so a screen reader does not read "a menu". */
export const BLOCK_MENU_LABEL = "块操作";

/** The site's control floor, and the size of the handle's own box. */
export const BLOCK_HANDLE_SIZE = 44;

/**
 * The pixels a press may travel and still be a press.
 *
 * Below this the gesture is a click that opens the menu; at or above it the
 * gesture is a drag. Four is small enough that a visitor who means to drag
 * crosses it immediately and large enough that a press on a phone does not
 * become a one-pixel reorder.
 */
export const BLOCK_DRAG_THRESHOLD = 4;

/**
 * The operations the menu offers before its hairline, in the order it draws them.
 *
 * The ids are the keys of `editor/execute.ts`'s block executor map, so a row
 * cannot be added without an action: `Record<BlockOperationId, ...>` fails the
 * build. 删除 is last because it ends the block's existence rather than moving it.
 */
export type BlockOperationId = "move-up" | "move-down" | "delete";

export interface BlockOperationSpec {
  readonly id: BlockOperationId;
  readonly label: string;
}

/**
 * The two operations the menu disables at the ends of the document.
 *
 * 上移 cannot run on the first block and 下移 cannot run on the last, so the copy
 * layer owes exactly these two a sentence saying which end it is. It is derived
 * from the union rather than written twice, so a fourth block operation that is
 * also one-directional is a `tsc` error until it is placed in one of the two.
 */
export type BlockEndOperationId = Extract<BlockOperationId, "move-up" | "move-down">;

export const BLOCK_OPERATIONS: readonly BlockOperationSpec[] = [
  { id: "move-up", label: "上移" },
  { id: "move-down", label: "下移" },
  { id: "delete", label: "删除" },
];

/** A block's vertical band in viewport coordinates, as the DOM gives it. */
export interface BlockBand {
  readonly bottom: number;
  readonly top: number;
}

/**
 * The canvas card's box, in viewport coordinates.
 *
 * Only the left edge is here, because it is the one the placement reads: the gutter
 * home measures leftwards from it and the inset home starts on it. The card's top
 * and width were declared here and never read by anything, so they are gone rather
 * than kept as a description of a box the function does not use — the drop line's
 * span is the card's own width, read where the line is drawn
 * (`block-handle/block-handle.tsx`), not by this arithmetic.
 */
export interface CanvasBox {
  /** The card's outer left edge; the inset home starts the handle here. */
  readonly left: number;
}

/** The viewport the control has to stay inside. */
export interface Viewport {
  readonly height: number;
  readonly width: number;
}

/** Which of the handle's two homes placed it. */
export type BlockHandleHome = "gutter" | "inset";

/** Where the handle goes, in viewport coordinates, and which home it took. */
export interface BlockHandlePlacement {
  readonly home: BlockHandleHome;
  readonly left: number;
  readonly top: number;
}

/**
 * The site geometry the two homes are derived from.
 *
 * These are the shell's numbers, not inventions for this control: the ToolPage
 * container is a 960px column with `px-4`, and the canvas card is 720px with
 * `p-5`. The gutter beside the canvas is therefore `(content − 720) / 2`, and it
 * reaches 52px — the 44px control plus the 8px clearance — at a viewport of 856px.
 * Above that width the handle sits in the page's own margin; below it the canvas
 * carries a 52px left inset so the text measure narrows instead of the handle
 * covering a glyph.
 */
const CONTENT_COLUMN = 960;
const PAGE_PADDING = 16;
const CANVAS_WIDTH = 720;

/** The gap between the handle and the text measure it never covers. */
const CLEARANCE = 8;

/**
 * The left inset the canvas card carries in the inset home: the control plus its
 * clearance.
 *
 * `placeBlockHandle` puts the handle on the card's own left edge in that home, so
 * the text has to start this far in; the card reads this number rather than
 * spelling 52 a second time, because two copies of it are two ways for the text and
 * the control to end up in different homes.
 */
export const BLOCK_HANDLE_INSET = BLOCK_HANDLE_SIZE + CLEARANCE;

/** The room the handle keeps from the viewport's edges when it is clamped. */
const EDGE = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(max, min));
}

/**
 * The width of the page gutter beside the canvas, at this viewport.
 *
 * The content column is the viewport minus its 16px inline paddings, capped at
 * 960px; the canvas fills 720px of it and is centred, so half of what is left is
 * the gutter on either side. At 856px this is exactly 52; at 855 it is 51.5, and
 * 51.5 cannot hold a 44px control plus 8px of clearance.
 */
function gutterWidth(viewport: Viewport): number {
  const content = Math.min(viewport.width, CONTENT_COLUMN) - 2 * PAGE_PADDING;

  return (content - Math.min(CANVAS_WIDTH, content)) / 2;
}

/**
 * Which home the handle takes at this viewport width.
 *
 * One predicate with two readers: `placeBlockHandle` (where the handle is drawn)
 * and the canvas card (whether it carries the 52px inset). They have to agree, or
 * the text and the handle would move to different homes, so the class on the card
 * and the placement both come from here.
 */
export function blockHandleHome(viewport: Viewport): BlockHandleHome {
  return gutterWidth(viewport) >= BLOCK_HANDLE_SIZE + CLEARANCE ? "gutter" : "inset";
}

/**
 * Where the handle sits beside a block.
 *
 * Vertically it lines up with the block's top — the first line of the block, the
 * way every editor's handle does — and is clamped inside the viewport so a block
 * half off the screen still has a reachable control. Horizontally the two homes
 * are the whole rule: in the gutter the handle ends 8px left of the canvas, and
 * in the inset it starts at the canvas's own left edge, where the card's 52px of
 * padding leaves 44px for the control and 8px before the text.
 */
export function placeBlockHandle(
  block: BlockBand,
  canvas: CanvasBox,
  viewport: Viewport,
): BlockHandlePlacement {
  const home = blockHandleHome(viewport);
  const left = home === "gutter" ? canvas.left - BLOCK_HANDLE_SIZE - CLEARANCE : canvas.left;
  const top = clamp(block.top, EDGE, viewport.height - BLOCK_HANDLE_SIZE - EDGE);

  return { home, left, top };
}

/**
 * The gap a block dropped at `pointerY` would land in.
 *
 * The answer is an insertion index counted **before** the dragged block is taken
 * out, so it ranges from 0 to `blocks.length`: each block's midpoint decides
 * whether the pointer has passed it, which makes the boundary change halfway down
 * a block rather than at its edges. An empty document has one gap, at 0.
 */
export function dropBoundary(blocks: readonly BlockBand[], pointerY: number): number {
  return blocks.filter((block) => (block.top + block.bottom) / 2 < pointerY).length;
}

/**
 * The index a block dragged from `from` ends at, after the removal shifts it.
 *
 * `boundary` counts the blocks the pointer has passed, so it is an index into the
 * list *including* the dragged block. Taking the source out first moves every
 * later index down by one, which is the case this function exists for: a block
 * dropped after the last one lands at `boundary - 1`. Dropping a block above or
 * below itself is no move at all, and answers its current index.
 */
export function moveBlockIndex(from: number, boundary: number): number {
  if (boundary === from || boundary === from + 1) return from;

  return boundary > from ? boundary - 1 : boundary;
}

/**
 * The block a pointer at `pointerY` names, for the handle that follows it.
 *
 * It is the drop boundary read as a block rather than as a gap: above the first
 * block (or between none of them) answers the first, below the last answers the
 * last. That keeps the handle on a block while the pointer crosses the margin
 * between two, where neither block's own box contains it. `null` only for a
 * document with no blocks, which the editor cannot produce.
 */
export function blockAtPointer(blocks: readonly BlockBand[], pointerY: number): number | null {
  if (blocks.length === 0) return null;

  return Math.min(dropBoundary(blocks, pointerY), blocks.length - 1);
}

/**
 * The y a drop line is drawn at for `boundary`: the top edge of the block the
 * dragged block would land above, or the bottom of the last block when it lands
 * below the whole document. `null` when there is no block to draw against.
 */
export function dropIndicatorTop(blocks: readonly BlockBand[], boundary: number): number | null {
  const last = blocks[blocks.length - 1];
  if (last === undefined) return null;

  const below = boundary >= blocks.length ? last : blocks[boundary];
  if (below === undefined) return null;

  return boundary >= blocks.length ? last.bottom : below.top;
}
