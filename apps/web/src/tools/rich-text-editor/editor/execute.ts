import type { Editor } from "@tiptap/react";

import type { CommandId } from "../core/commands";
import { EMPTY_DOCUMENT } from "../core/document";

/**
 * What each command of the table does, as one TipTap chain.
 *
 * The table says what exists; this map says what it does, and it is the only such
 * map: the pinned toolbar, the slash menu and the selection toolbar all run a
 * command through `runCommand`, so a command cannot behave one way in the menu and
 * another on the bar. `Record<Exclude<CommandId, "link">, ...>` is the
 * exhaustiveness check TipTap's own commands cannot give: adding an id to the table
 * without a line here is a `tsc` error rather than a control that does nothing.
 *
 * 链接 is the one command that is not a chain. Its behaviour is a field, and a field
 * is an interface: the pinned toolbar and the selection toolbar both open the same
 * link control, and `runCommand` answers `false` for it so a caller cannot quietly
 * believe it ran.
 */

type ExecutedCommandId = Exclude<CommandId, "link">;

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
  clear: (editor) => {
    editor.chain().focus().setContent(EMPTY_DOCUMENT).run();
  },
};

/**
 * Run one command on the editor.
 *
 * `true` means this function ran it. `false` means the command needs an interface
 * of its own — 链接 — and the caller is the one that owns that interface.
 */
export function runCommand(editor: Editor, id: CommandId): boolean {
  if (id === "link") return false;

  EXECUTORS[id](editor);
  return true;
}
