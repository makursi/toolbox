import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

/**
 * The mark on the block a drag is moving (#229).
 *
 * It is a ProseMirror decoration rather than an attribute written onto the block's
 * element, and that is not a preference. ProseMirror observes its own editable
 * subtree: a foreign attribute set on a paragraph is read as a DOM mutation it did
 * not make, and it redraws the block to restore it — the attribute is gone before
 * the next frame, which is exactly what the gate caught. A decoration is the
 * supported way to paint a transient state on a node: the view owns it, and the
 * class survives every redraw because ProseMirror is the one drawing it.
 *
 * The plugin carries no document change, only a decoration set keyed by a
 * transaction meta. Meta-only transactions do not mark the document changed, so
 * starting or ending a drag never schedules a draft save; they do reach the view,
 * which is what redraws the block.
 */

/** The class the canvas's own typography dims (`EDITOR_CLASS`). */
export const BLOCK_DRAGGING_CLASS = "block-dragging";

/** The range a drag has marked, or `null` to clear the mark. */
export interface BlockDragRange {
  readonly from: number;
  readonly to: number;
}

export const blockDragKey = new PluginKey<DecorationSet>("richTextBlockDrag");

/** Whether a transaction meta is the range this plugin understands. */
function isBlockDragRange(value: unknown): value is BlockDragRange {
  if (typeof value !== "object" || value === null) return false;

  const from: unknown = Reflect.get(value, "from");
  const to: unknown = Reflect.get(value, "to");

  return typeof from === "number" && typeof to === "number";
}

export const blockDragPlugin = new Plugin<DecorationSet>({
  key: blockDragKey,
  state: {
    init: () => DecorationSet.empty,
    apply(transaction, current) {
      const next: unknown = transaction.getMeta(blockDragKey);

      if (next === undefined) return current.map(transaction.mapping, transaction.doc);
      if (next === null) return DecorationSet.empty;
      if (!isBlockDragRange(next)) return current.map(transaction.mapping, transaction.doc);

      return DecorationSet.create(transaction.doc, [
        Decoration.node(next.from, next.to, { class: BLOCK_DRAGGING_CLASS }),
      ]);
    },
  },
  props: {
    decorations: (state) => blockDragKey.getState(state) ?? DecorationSet.empty,
  },
});

/** Mark the block a drag is moving, or clear the mark with `null`. */
export function setBlockDragging(view: EditorView, range: BlockDragRange | null): void {
  view.dispatch(view.state.tr.setMeta(blockDragKey, range));
}
