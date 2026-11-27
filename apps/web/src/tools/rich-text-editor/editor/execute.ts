import { createTable } from "@tiptap/extension-table";
import type { Editor } from "@tiptap/react";

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
  "bullet-list": (editor) => {
    editor.chain().focus().toggleBulletList().run();
  },
  "ordered-list": (editor) => {
    editor.chain().focus().toggleOrderedList().run();
  },
  "task-list": (editor) => {
    editor.chain().focus().toggleTaskList().run();
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
