import { TextAlign } from "@tiptap/extension-text-align";

import { TEXT_ALIGNMENTS, TEXT_ALIGN_NODE_TYPES } from "../core/align";

/**
 * 对齐 (#230): an attribute of paragraphs and headings, over the three values the
 * command table offers.
 *
 * The configuration is the model written down once (`core/align.ts`): the two node
 * types the attribute belongs to, and the three values the toolbar's one trigger
 * offers. `defaultAlignment` is left at `null` on purpose — left is the absence of
 * the attribute, so it is what a block says by not saying anything.
 *
 * **The scope is headings 1–3, and this extension is the one place it cannot be
 * enforced.** A global attribute belongs to a node *type*, not to a level of one:
 * `types: ["paragraph", "heading"]` is the finest restriction the package offers,
 * and the document's heading node accepts 1–6 (the Markdown reader keeps whatever
 * `#` run a file uses, and StarterKit's own input rule turns `####` into an H4). So
 * an H4–H6 held in the document can carry the attribute, and the canvas paints it,
 * because ProseMirror renders what the node says. What is enforced is the two HTML
 * paths — the writer writes no style for a heading outside
 * `TEXT_ALIGN_HEADING_LEVELS` and the sanitiser does not read one — so the
 * out-of-scope state never leaves the page in a file, and a file cannot bring one
 * back. `rules.md` records that as the attribute's one degradation, rather than
 * this file pretending the model is narrower than it is.
 *
 * `addKeyboardShortcuts` is emptied deliberately. The extension ships four key
 * bindings (`Mod-Shift-L`, `-E`, `-R`, `-J`), and this Tool's keyboard rule is
 * that StarterKit's keymap plus the command table's commands are the whole of it:
 * a package that quietly adds a second list of keys is exactly the thing that
 * rule exists to prevent, and none of the four is in the product document. The
 * attribute, the commands and the parser stay; only the four bindings go. The
 * overlay is one line, so the decision cannot be mistaken for the extension not
 * having any.
 */
export const Alignment = TextAlign.extend({
  addKeyboardShortcuts() {
    return {};
  },
}).configure({
  alignments: [...TEXT_ALIGNMENTS],
  types: [...TEXT_ALIGN_NODE_TYPES],
});
