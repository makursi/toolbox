"use client";

import { useEditorState, type Editor } from "@tiptap/react";

import { headingCommand, type CommandId } from "../../core/commands";

/**
 * The state at the cursor, read through TipTap's own selector.
 *
 * It is a hook rather than a block inside the toolbar because two surfaces need the
 * same answer: the pinned toolbar, whose block menu names the block the caret is in,
 * and the toolbar that follows a selection, whose marks show whether they are on.
 * Two readers of the editor's state are fine, because neither keeps a copy: a
 * "bold is on" flag of our own would be a second answer that goes stale between a
 * keystroke and a render.
 *
 * `pressed` is exhaustive, so a command added to the table cannot quietly arrive
 * without an answer to "is it on" — the map is `Record<CommandId, boolean>` and an
 * id with no line here is a type error.
 */
export interface EditorCommandState {
  /** The block at the cursor, as the id of the command that produces it. */
  readonly block: CommandId;
  readonly canRedo: boolean;
  readonly canUndo: boolean;
  /**
   * Whether the caret is inside a table.
   *
   * It is the 表格 button's state: outside a table it opens the grid picker, inside
   * one it opens the contextual row/column menu (#217). It is read from the
   * selection rather than from a copy of the document, like every other field here,
   * so moving the caret in or out of a table flips the menu without the toolbar
   * keeping a second answer.
   */
  readonly inTable: boolean;
  readonly pressed: Record<CommandId, boolean>;
}

export function useEditorCommandState(editor: Editor): EditorCommandState {
  return useEditorState({
    editor,
    selector: ({ editor: current }): EditorCommandState => {
      /*
       * The block at the caret, named by the command that produces it. The level is
       * read through the extension's own attributes and mapped by
       * `core/commands.ts`'s `headingCommand`, which is the same mapping the block
       * menu uses: a level the table has no row for (4–6) has no command to name it,
       * and 正文 is the fallback both readers share.
       */
      const level = current.isActive("heading")
        ? Number(current.getAttributes("heading").level ?? 1)
        : null;
      const block: CommandId =
        level === null ? "paragraph" : (headingCommand(level) ?? "paragraph");

      return {
        block,
        canRedo: current.can().redo(),
        canUndo: current.can().undo(),
        inTable: current.isActive("table"),
        pressed: {
          undo: false,
          redo: false,
          paragraph: block === "paragraph",
          "heading-1": block === "heading-1",
          "heading-2": block === "heading-2",
          "heading-3": block === "heading-3",
          bold: current.isActive("bold"),
          italic: current.isActive("italic"),
          underline: current.isActive("underline"),
          strike: current.isActive("strike"),
          code: current.isActive("code"),
          highlight: current.isActive("highlight"),
          "bullet-list": current.isActive("bulletList"),
          "ordered-list": current.isActive("orderedList"),
          "task-list": current.isActive("taskList"),
          /*
           * Alignment is one attribute with three rows, and left is the absence of
           * it: the left row is on when neither of the other two is, so the
           * toolbar's trigger always has one value to name. The caret's block may
           * be one that cannot carry the attribute (a code block, an image), and
           * the row in force is still left, which is what a block with no
           * alignment renders as.
           */
          "align-left":
            !current.isActive({ textAlign: "center" }) && !current.isActive({ textAlign: "right" }),
          "align-center": current.isActive({ textAlign: "center" }),
          "align-right": current.isActive({ textAlign: "right" }),
          blockquote: current.isActive("blockquote"),
          "code-block": current.isActive("codeBlock"),
          "horizontal-rule": false,
          link: current.isActive("link"),
          image: false,
          table: false,
        },
      };
    },
  });
}
