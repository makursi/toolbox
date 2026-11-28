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
