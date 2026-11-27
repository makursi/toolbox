import { NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";

/**
 * Where a block insert goes when the selection is a selected node rather than a caret
 * (#216's image, #217's table).
 *
 * An image is an atom, block-level node, so pressing one selects the node itself: the
 * selection becomes a `NodeSelection` on it. Every insert this Tool makes is
 * `insertContent`-shaped — `setImage` and 表格's `insertTable`, whose
 * `replaceSelectionWith` is the same replacement — and inserting over a non-empty
 * selection *replaces* it. So the insert after a selected node deletes that node
 * instead of adding to the document, and that is two observed defects rather than a
 * theory: ten dropped images left one (each insert replaced the picture before it),
 * and a table picked while an image was still selected exported as a table with no
 * image (#217's gate case).
 *
 * A selected node is therefore an insertion *point* at its end (`selection.to`)
 * rather than a range to overwrite: `insertContentAt(selection.to, …)` puts the new
 * block after the node, and its `updateSelection` step puts the selection at the end
 * of what was inserted, which is what makes the next insert append too. The position
 * is at document level because both nodes are block-level: there is no paragraph to
 * insert into, and ProseMirror puts the node between its siblings.
 *
 * `null` means the selection is a caret or a run of text, and the caller keeps the
 * extension's own command: there the selection *is* where the visitor wants the
 * block, so replacing it is the ordinary insert rather than a loss. #218's 替换 is
 * the one caller that deliberately rewrites the selected node; it does not ask this
 * question, because rewriting the picture the visitor is standing on is its point.
 *
 * The question lives here rather than in either insert so the two cannot drift: the
 * image path has needed the distinction since #216, and the table path found it
 * missing in #217.
 */
export function insertionPointAfterSelectedNode(editor: Editor): number | null {
  const { selection } = editor.state;

  return selection instanceof NodeSelection ? selection.to : null;
}
