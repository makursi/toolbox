/**
 * The image panel's rules: the four width presets, the words its four controls
 * carry, and where the bar sits over the picture it edits (#218).
 *
 * It is in the pure core for the reason `core/table.ts` is: the panel's behaviour is
 * an interface rather than a TipTap chain, so what it offers and how it is placed are
 * data and arithmetic a unit test can hold. Whether a width really reaches the
 * document is the gate's question, because only the node's own attributes can answer
 * it; whether the bar lands on the picture or off the edge of a phone is decided
 * here, in numbers, and then drawn by `image-panel/image-panel.tsx`.
 *
 * The words are the ticket's own — 替换, 替代文本, 删除 — and they are here rather
 * than in `core/copy.ts` for the reason the table's seven row labels are in
 * `core/table.ts`: a transient surface's own labels belong with the rules that make
 * it, while `core/copy.ts` keeps the sentences the toolbar's status paints (the four
 * image refusals among them). The gate spells these same words out, so a rename has
 * to be made twice rather than followed by the test.
 */

/**
 * The four shares of the measure the panel offers, narrowest first.
 *
 * They are percentages rather than pixels because the node stores a percentage
 * (`editor/image-extension.ts`), and they are these four rather than a slider because
 * the spec ranges free drag-to-resize out: a picture fills a quarter, half, three
 * quarters or the whole of the reading measure, and the node's own clamp keeps a
 * hand-edited value inside the same range.
 */
export const IMAGE_WIDTH_PRESETS: readonly number[] = [25, 50, 75, 100];

/**
 * The panel's accessible name.
 *
 * The region is named rather than anonymous for the reason the table's menu is: a
 * screen reader that lands in it has to hear what these controls act on, and "a
 * toolbar" would be a second, unnamed row beside the pinned one. 操作 rather than
 * 格式 because half of it is not formatting: it replaces the bytes, deletes the node,
 * and describes the picture.
 */
export const IMAGE_PANEL_LABEL = "图片操作";

/** The file input's control: swaps the bytes and keeps the rest of the node. */
export const IMAGE_REPLACE_LABEL = "替换";

/** The popover that sets the alt text, and the field inside it. */
export const IMAGE_ALT_LABEL = "替代文本";

/** What the empty alt field says it is for, so the control explains itself. */
export const IMAGE_ALT_PLACEHOLDER = "描述这张图片";

/** The alt popover's commit, the same word the link action's field uses. */
export const IMAGE_ALT_APPLY_LABEL = "应用";

/** The control that removes the node; undo is the editor's own history. */
export const IMAGE_DELETE_LABEL = "删除";

/** A preset's accessible name: the share of the measure it sets. */
export function widthPresetLabel(width: number): string {
  return `宽度 ${width}%`;
}

/**
 * The gap between the bar and the picture, and the margin it keeps from the viewport.
 *
 * Eight is the same number the selection toolbar uses for the same two jobs, so the
 * two floating rows on this page are placed by one measure rather than two.
 */
const GAP = 8;
const EDGE = 8;

/** The image's rectangle in viewport coordinates, as `getBoundingClientRect` gives it. */
export interface PanelAnchor {
  readonly bottom: number;
  readonly left: number;
  readonly top: number;
}

/** The bar's own measured box. */
export interface PanelSize {
  readonly height: number;
  readonly width: number;
}

/** The viewport the bar has to stay inside. */
export interface Viewport {
  readonly height: number;
  readonly width: number;
}

/** Where the bar goes, in viewport coordinates. */
export interface PanelPlacement {
  readonly left: number;
  readonly top: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(max, min));
}

/**
 * Where the bar sits for an image's box.
 *
 * Above the picture with one gap between them, which is where the selection toolbar
 * goes for the same reason: the bar belongs to the thing it acts on and covers
 * neither it nor the words under it. An image near the top of the viewport has no
 * room above, so the bar flips below it; an image taller than the viewport has
 * neither, and then the bar takes the room below and is clamped inside the viewport.
 * That last case is the only one that covers the picture, and the alternative is a
 * bar off the page: a control a visitor cannot reach is worse than one on top of a
 * photograph that fills the screen.
 *
 * The width is clamped first, because a bar measured wider than the viewport (a
 * window narrower than one row of controls) would otherwise make the left clamp
 * impossible and put the bar's right end past the edge.
 */
export function placeImagePanel(
  anchor: PanelAnchor,
  size: PanelSize,
  viewport: Viewport,
): PanelPlacement {
  const width = Math.min(size.width, viewport.width - 2 * EDGE);
  const left = clamp(anchor.left, EDGE, viewport.width - width - EDGE);

  const above = anchor.top - size.height - GAP;
  const below = anchor.bottom + GAP;
  const bottomLimit = viewport.height - size.height - EDGE;

  if (above >= EDGE) return { left, top: above };
  if (below + size.height <= viewport.height - EDGE) return { left, top: below };

  return { left, top: clamp(below, EDGE, bottomLimit) };
}
