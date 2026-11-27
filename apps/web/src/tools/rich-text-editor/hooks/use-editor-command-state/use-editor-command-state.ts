"use client";

import { useEditorState, type Editor } from "@tiptap/react";

import type { CommandId } from "../../core/commands";

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
  readonly pressed: Record<CommandId, boolean>;
}

export function useEditorCommandState(editor: Editor): EditorCommandState {
  return useEditorState({
    editor,
    selector: ({ editor: current }): EditorCommandState => {
      const block: CommandId = current.isActive("heading", { level: 1 })
        ? "heading-1"
        : current.isActive("heading", { level: 2 })
          ? "heading-2"
          : current.isActive("heading", { level: 3 })
            ? "heading-3"
            : "paragraph";

      return {
        block,
        canRedo: current.can().redo(),
        canUndo: current.can().undo(),
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
          "bullet-list": current.isActive("bulletList"),
          "ordered-list": current.isActive("orderedList"),
          "task-list": current.isActive("taskList"),
          blockquote: current.isActive("blockquote"),
          "code-block": current.isActive("codeBlock"),
          "horizontal-rule": false,
          link: current.isActive("link"),
          image: false,
        },
      };
    },
  });
}
