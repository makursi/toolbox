import { createTable } from "@tiptap/extension-table";
import { closeHistory } from "@tiptap/pm/history";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, Selection, TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";

import type { BlockOperationId } from "../core/block";
import { moveBlockIndex } from "../core/block";
import type { CommandId } from "../core/commands";
import type { TableOperationId, TableSize } from "../core/table";
import { insertionPointAfterSelectedNode } from "./insertion-point";

/**
 * What each command of the table does, as one TipTap chain.
 *
 * The table says what exists; this map says what it does, and it is the only such
 * map: the pinned toolbar, the slash menu and the selection toolbar all run a
 * command through `runCommand`, so a command cannot behave one way in the menu and
 * another on the bar. `Record<Exclude<CommandId, "link" | "image" | "table">, ...>`
 * is the exhaustiveness check TipTap's own commands cannot give: adding an id to
 * the table without a line here is a `tsc` error rather than a control that does
 * nothing.
 *
 * 链接, 图片 and 表格 are the three commands that are not a chain: their behaviour
 * is an interface, so `runCommand` answers `false` for each and the caller owns
 * the interface. 链接 is the field the pinned toolbar and the selection toolbar
 * both open; 图片 is the toolbar's file input, which the slash menu reaches
 * through the surface that owns it; 表格 is the grid picker in
 * `table-control/table-control.tsx`, whose chosen size commits through
 * `insertTable` below. The three are excluded from this map by name, so a fourth
 * interface command is a `tsc` error until someone decides which exclusion list
 * it belongs in.
 */

type ExecutedCommandId = Exclude<CommandId, "link" | "image" | "table">;

const EXECUTORS: Record<ExecutedCommandId, (editor: Editor) => void> = {
  undo: (editor) => {
    editor.chain().focus().undo().run();
  },
  redo: (editor) => {
    editor.chain().focus().redo().run();
  },
  paragraph: (editor) => {
    editor.chain().focus().setParagraph().run();
  },
  "heading-1": (editor) => {
    editor.chain().focus().toggleHeading({ level: 1 }).run();
  },
  "heading-2": (editor) => {
    editor.chain().focus().toggleHeading({ level: 2 }).run();
  },
  "heading-3": (editor) => {
    editor.chain().focus().toggleHeading({ level: 3 }).run();
  },
  bold: (editor) => {
    editor.chain().focus().toggleBold().run();
  },
  italic: (editor) => {
    editor.chain().focus().toggleItalic().run();
  },
  underline: (editor) => {
    editor.chain().focus().toggleUnderline().run();
  },
  strike: (editor) => {
    editor.chain().focus().toggleStrike().run();
  },
  code: (editor) => {
    editor.chain().focus().toggleCode().run();
  },
  highlight: (editor) => {
    editor.chain().focus().toggleHighlight().run();
  },
  "bullet-list": (editor) => {
    editor.chain().focus().toggleBulletList().run();
  },
  "ordered-list": (editor) => {
    editor.chain().focus().toggleOrderedList().run();
  },
  "task-list": (editor) => {
    editor.chain().focus().toggleTaskList().run();
  },
  /*
   * Alignment's three rows (#230). Left is the absence of the attribute rather
   * than a value it carries, so the left row unsets it: `setTextAlign("left")`
   * would write `style="text-align: left"` and make the same document compare
   * unequal to one that was never aligned.
   */
  "align-left": (editor) => {
    editor.chain().focus().unsetTextAlign().run();
  },
  "align-center": (editor) => {
    editor.chain().focus().setTextAlign("center").run();
  },
  "align-right": (editor) => {
    editor.chain().focus().setTextAlign("right").run();
  },
  blockquote: (editor) => {
    editor.chain().focus().toggleBlockquote().run();
  },
  "code-block": (editor) => {
    editor.chain().focus().toggleCodeBlock().run();
  },
  "horizontal-rule": (editor) => {
    editor.chain().focus().setHorizontalRule().run();
  },
};

/**
 * Run one command on the editor.
 *
 * `true` means this function ran it. `false` means the command needs an interface
 * of its own — 链接, 图片 or 表格 — and the caller is the one that owns that
 * interface.
 */
export function runCommand(editor: Editor, id: CommandId): boolean {
  if (id === "link" || id === "image" || id === "table") return false;

  EXECUTORS[id](editor);
  return true;
}

/**
 * Insert a table of the chosen size, with a header row.
 *
 * This is the table command's one insert path: the grid picker commits the size the
 * visitor chose with it, and the slash menu applies the documented default with it
 * (`TABLE_DEFAULT_SIZE`), so the two cannot produce different table shapes. The
 * first row is a header because both writers treat the first row as the header row
 * (#219/#220) and the spec gives no cell styling with which to mark one later.
 *
 * Where the table goes is `insertionPointAfterSelectedNode`'s question, and the
 * answer is what #217's own gate case taught: an image insert leaves that image
 * selected (#216's transaction, deliberately, because it is how the next insert
 * appends), and `insertTable` replaces whatever the selection is — so a table picked
 * while the image was still selected replaced the picture and the export carried a
 * table with no image. A selected node therefore gets `insertContentAt` with the
 * extension's own `createTable`, which inserts *after* it; a caret or a range keeps
 * the plain command, because there the selection is where the visitor wants the grid
 * and replacing it is the ordinary insert. Both surfaces benefit: the picker reaches
 * this function with the image still selected, and the slash menu reaches it after
 * deleting its `/query` range, which leaves a caret.
 *
 * The extension is configured with `resizable: false` in `RichTextEditor.tsx`: the
 * spec excludes column widths and free drag-to-resize, so the grid this inserts is
 * fixed.
 */
export function insertTable(editor: Editor, { columns, rows }: TableSize): void {
  const insertionPoint = insertionPointAfterSelectedNode(editor);
  const insert =
    insertionPoint === null
      ? editor.chain().focus().insertTable({ cols: columns, rows, withHeaderRow: true })
      : editor
          .chain()
          .focus()
          .insertContentAt(insertionPoint, createTable(editor.schema, rows, columns, true));

  insert.run();
}

/**
 * What each contextual table action does.
 *
 * It is a second map because it is a second menu: these seven act on the table the
 * caret is in, not on the document, so they are not rows of the command table and
 * are unreachable from the toolbar at rest. The menu is the one surface that draws
 * them; `Record<TableOperationId, ...>` is the exhaustiveness check it relies on.
 */
const TABLE_EXECUTORS: Record<TableOperationId, (editor: Editor) => void> = {
  "add-row-before": (editor) => {
    editor.chain().focus().addRowBefore().run();
  },
  "add-row-after": (editor) => {
    editor.chain().focus().addRowAfter().run();
  },
  "add-column-before": (editor) => {
    editor.chain().focus().addColumnBefore().run();
  },
  "add-column-after": (editor) => {
    editor.chain().focus().addColumnAfter().run();
  },
  "delete-row": (editor) => {
    editor.chain().focus().deleteRow().run();
  },
  "delete-column": (editor) => {
    editor.chain().focus().deleteColumn().run();
  },
  /*
   * 删除表格 leaves a paragraph behind because StarterKit's `TrailingNode` does:
   * its plugin appends an empty paragraph whenever the document's last block is
   * not one, and the transaction that removes the table is immediately followed by
   * one that puts a paragraph back. The command is therefore the extension's own
   * `deleteTable` and nothing else — the append this entry used to carry could
   * never run, because by the time the state was read there was always a paragraph.
   * The gate proves the outcome rather than the mechanism: one empty paragraph is
   * left, and the caret types in it.
   */
  "delete-table": (editor) => {
    editor.chain().focus().deleteTable().run();
  },
};

/** Run one contextual table action. */
export function runTableOperation(editor: Editor, id: TableOperationId): void {
  TABLE_EXECUTORS[id](editor);
}

/**
 * A top-level block of the document: where it starts, what it is, and which of
 * the document's blocks it is.
 *
 * `pos` is a document position at a node boundary, which is what a caret's
 * `$from.before(1)` and a pointer's measured block both give. `index` is the same
 * block counted among the document's top-level children, which is what the move
 * arithmetic and the menu's two disabled ends are about.
 */
interface BlockTarget {
  readonly index: number;
  readonly node: ProseMirrorNode;
  readonly pos: number;
}

/**
 * The top-level block that starts at `pos`, or `null` when no block does.
 *
 * A block operation always arrives with a position a block starts at — the caret's
 * `$from.before(1)` for a menu action, a measured child's offset for a drag — so
 * this is the one place that turns such a position into the node and index the
 * arithmetic needs. A position inside a block is not one: the operations act on
 * whole blocks, and a caller that handed over a text position has already made a
 * mistake that this guard turns into nothing rather than into a wrong deletion.
 */
function blockAt(doc: ProseMirrorNode, pos: number): BlockTarget | null {
  let target: BlockTarget | null = null;
  let index = 0;

  doc.forEach((node, offset) => {
    if (offset === pos) target = { index, node, pos };

    index += 1;
  });

  return target;
}

/**
 * Run a command-table command on the block at `pos` rather than on wherever the
 * selection happens to be (#229).
 *
 * The block menu's four conversions are the table's own `block` rows, so they run
 * through `runCommand` like every other surface's commands; what differs is which
 * block they apply to. A handle can name a block the caret is not in — it follows
 * the pointer — so the selection is moved into the named block first. Existing
 * selections that are already inside it are left alone, because then the command
 * means what the caret says rather than what the menu says.
 */
export function runCommandOnBlock(editor: Editor, id: CommandId, pos: number): void {
  const block = blockAt(editor.state.doc, pos);
  if (block === null) return;

  const { from, to } = editor.state.selection;
  const inside = from >= block.pos && to <= block.pos + block.node.nodeSize;

  if (!inside) {
    if (block.node.isTextblock) editor.commands.setTextSelection(block.pos + 1);
    else editor.commands.setNodeSelection(block.pos);
  }

  runCommand(editor, id);
}

/**
 * Where a block of `nodeSize` starts after `count` top-level children of `doc`.
 *
 * A document position is the sum of the sizes before it; the move needs the
 * position a block lands at in the document left after the source was removed,
 * and this is that sum written once instead of at each call site.
 */
function positionAfter(doc: ProseMirrorNode, count: number): number {
  let pos = 0;

  for (let index = 0; index < count; index++) pos += doc.child(index).nodeSize;

  return pos;
}

/**
 * Move the block at `pos` to a drop boundary, in one transaction.
 *
 * `boundary` is the index of the gap the block was dropped in, counted **before**
 * the block is taken out (`core/block.ts`'s `dropBoundary`). The deletion shifts
 * every index after the source down by one, so the insertion point is
 * `moveBlockIndex(from, boundary)`, not `boundary` — the case the pure module
 * exists for.
 *
 * Both steps are in one transaction, which is the ticket's requirement: one 撤销
 * puts the block back. `closeHistory` opens a history group first, for the reason
 * 删除 in the image panel does: ProseMirror merges a change into the previous undo
 * step when it happens soon after and touches adjacent content, so without the
 * group a drag right after typing could be undone together with the typing.
 *
 * The caret follows the block when it was inside it. A drag that names a block the
 * caret is not in leaves the caret where it was, mapped through the moved text —
 * a pointer gesture on one block must not move the visitor's caret in another.
 */
export function moveBlockToBoundary(editor: Editor, pos: number, boundary: number): void {
  const { state, view } = editor;
  const source = blockAt(state.doc, pos);
  if (source === null) return;

  const target = moveBlockIndex(
    source.index,
    Math.max(0, Math.min(boundary, state.doc.childCount)),
  );
  if (target === source.index) return;

  const { selection } = state;
  const blockEnd = source.pos + source.node.nodeSize;
  const contentStart = source.pos + 1;
  const caretInside = selection.from >= source.pos && selection.to <= blockEnd;
  const nodeSelected = selection instanceof NodeSelection && selection.from === source.pos;
  const anchorOffset = Math.max(
    0,
    Math.min(selection.anchor - contentStart, source.node.content.size),
  );
  const headOffset = Math.max(0, Math.min(selection.head - contentStart, source.node.content.size));

  const tr = state.tr;
  closeHistory(tr);
  tr.delete(source.pos, blockEnd);
  const insertPos = positionAfter(tr.doc, target);
  tr.insert(insertPos, source.node);

  if (nodeSelected) {
    tr.setSelection(NodeSelection.create(tr.doc, insertPos));
  } else if (caretInside) {
    tr.setSelection(
      TextSelection.create(tr.doc, insertPos + 1 + anchorOffset, insertPos + 1 + headOffset),
    );
  }

  view.dispatch(tr);
  view.focus();
}

/**
 * Delete the block at `pos` in one transaction, leaving the caret in a block that
 * can be typed in.
 *
 * The group is opened for the reason the move opens one. When the caret was in the
 * deleted block the selection is placed with `Selection.near`, because the mapped
 * position after a deletion is the boundary itself and that is not always a text
 * position — the editor has to end up somewhere the visitor can write. A document
 * whose last block was not a paragraph gets one back from StarterKit's own
 * `TrailingNode`, the way 删除表格 does, so "delete the only paragraph" leaves a
 * paragraph rather than a heading with nowhere to type below it.
 */
function deleteBlock(editor: Editor, pos: number): void {
  const { state, view } = editor;
  const source = blockAt(state.doc, pos);
  if (source === null) return;

  const blockEnd = source.pos + source.node.nodeSize;
  const caretInside = state.selection.from >= source.pos && state.selection.to <= blockEnd;

  const tr = state.tr;
  closeHistory(tr);
  tr.delete(source.pos, blockEnd);

  if (caretInside) {
    tr.setSelection(Selection.near(tr.doc.resolve(Math.min(source.pos, tr.doc.content.size)), 1));
  }

  view.dispatch(tr);
  view.focus();
}

/**
 * What each block-menu operation does, as one transaction on the block it names.
 *
 * It is a second executor map for the reason the table's seven are: these act on
 * one block rather than on the document-wide selection the command table's
 * commands act on, they are reachable from the block menu alone, and the toolbar
 * never renders them. `Record<BlockOperationId, ...>` is the exhaustiveness check
 * the menu relies on, and the two moves are one arithmetic with a direction —
 * 上移 drops the block at its own index (before the previous block) and 下移 at
 * its index plus two (after the next one), which is the same boundary the drag
 * computes with a pointer.
 */
const BLOCK_EXECUTORS: Record<BlockOperationId, (editor: Editor, pos: number) => void> = {
  "move-up": (editor, pos) => {
    const source = blockAt(editor.state.doc, pos);
    if (source === null) return;

    moveBlockToBoundary(editor, pos, Math.max(source.index - 1, 0));
  },
  "move-down": (editor, pos) => {
    const source = blockAt(editor.state.doc, pos);
    if (source === null) return;

    moveBlockToBoundary(editor, pos, Math.min(source.index + 2, editor.state.doc.childCount));
  },
  delete: (editor, pos) => deleteBlock(editor, pos),
};

/** Run one block-menu operation on the block at `pos`. */
export function runBlockOperation(editor: Editor, id: BlockOperationId, pos: number): void {
  BLOCK_EXECUTORS[id](editor, pos);
}
