"use client";

import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";

/** What an empty document says, in the words a visitor reads. */
const TITLE_PLACEHOLDER = "无标题";
const BODY_PLACEHOLDER = "开始写吧，输入 `/` 插入内容";

/**
 * What an empty document is: a title block and one paragraph, both empty.
 *
 * The title is the document's first line rather than a second input beside the
 * canvas, so the exported file's title and the line a visitor types into are the
 * same node. `level: 1` is the H1 the document keeps in the export as well; the
 * page's own H1 is the Tool's name, at a different scope.
 */
const emptyDocument: JSONContent = {
  type: "doc",
  content: [{ type: "heading", attrs: { level: 1 } }, { type: "paragraph" }],
};

/** The accessible name of the editing surface; the gate finds the editor by it. */
const EDITOR_LABEL = "文档内容";

/**
 * The canvas's typography, and the rule that paints the two placeholders.
 *
 * The placeholders are the Placeholder extension's `::before` on the empty block, so
 * they are decoration rather than content: they cannot be selected, they are not part
 * of the document, and typing in the block takes the sentence away. The colour is the
 * site's placeholder token, which the colour rules measured against the surface it
 * sits on (`apps/web/docs/design/colour.md`).
 *
 * The classes are here rather than in `globals.css` because they are this Tool's
 * styling, and an arbitrary variant (`[&_.is-empty::before]`) is the site's way of
 * writing a descendant rule without a stylesheet: `.is-empty` and `data-placeholder`
 * are the extension's own contract, not this page's invention.
 *
 * The title's 34px on a 1.3 line is the shell's own h1 scale (`ToolPage`), which is
 * the site's title scale rather than a second one invented for the canvas; the
 * margin under it is what keeps an empty title from sitting on the paragraph's line.
 *
 * The editing surface paints no outline of its own: the canvas's hairline becomes ink
 * while the editor holds the focus (`focus-within` on the card below), which is the
 * site's focus colour and the same "the line changes, nothing moves" state the
 * format cards use. A 2px ring around a 60vh area drew a second rectangle inside the
 * card, and the card's own line is the boundary a visitor already reads.
 */
const EDITOR_CLASS = [
  "min-h-[60vh] outline-none",
  "[&_.is-empty::before]:pointer-events-none",
  "[&_.is-empty::before]:text-[color:var(--site-placeholder)]",
  "[&_.is-empty::before]:content-[attr(data-placeholder)]",
  "[&_h1]:mb-4 [&_h1]:text-[34px] [&_h1]:leading-[1.3] [&_h1]:font-semibold",
].join(" ");

/**
 * The writing surface: one TipTap editor, the document it holds, and the two
 * sentences an empty document shows.
 *
 * The canonical document is ProseMirror JSON (`apps/web/src/tools/rich-text-editor/rules.md`),
 * and this component is where it lives. Nothing is persisted yet: reloading the page
 * gives a fresh, empty document on purpose until the autosave slice lands. The
 * component takes no props, because the page is its only consumer and a surface for
 * a consumer that does not exist is how an API grows without a caller.
 *
 * The editor is created **on the client only** (`immediatelyRender: false`): the
 * server cannot know anything about a document the visitor has not typed yet, and a
 * contenteditable rendered on the server is HTML that a hydrating editor would have
 * to reconcile with the visitor's cursor. The page therefore serves an empty canvas
 * and the editor arrives with hydration, which is the same reason the gate waits for
 * React before it types.
 */
export function RichTextEditor() {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        /*
         * One placeholder function, two sentences: the empty title block says
         * 无标题, and the document's own first body block says where to start. The
         * body sentence is tied to that one position rather than to every empty
         * paragraph, because it is a sentence about the empty *document*: an empty
         * line the visitor made with Enter is not a place to say "start writing"
         * again, and the sentence would otherwise repeat down the page.
         *
         * `showOnlyCurrent` is off on purpose: the title is a block of its own, so
         * the paragraph the visitor is writing in must not hide the title's
         * sentence, and the title keeps its own until the title itself is typed.
         */
        placeholder: ({ editor: current, node, pos }) => {
          if (node.type.name === "heading") return TITLE_PLACEHOLDER;

          const first = current.state.doc.firstChild;
          return first?.type.name === "heading" && pos === first.nodeSize ? BODY_PLACEHOLDER : "";
        },
        showOnlyCurrent: false,
      }),
    ],
    content: emptyDocument,
    /*
     * `role="textbox"` is TipTap's own default on the contenteditable, so the only
     * thing this adds is the name a screen reader reads: an editable region with no
     * name is announced as an anonymous textbox.
     */
    editorProps: { attributes: { "aria-label": EDITOR_LABEL, class: EDITOR_CLASS } },
  });

  return (
    /*
     * The canvas is a reading measure rather than the shell's full 960px: a line of
     * Chinese text longer than roughly 40 characters is hard to follow back, and the
     * measure is a site rule for prose (`apps/web/docs/design/layout.md`). Its
     * `data-slot` is the fingerprint's anchor for the region: the blocks inside it
     * are ProseMirror's own children, so the card is the thing a change moves.
     */
    <div
      className="mx-auto mt-10 w-full max-w-[720px] rounded-lg border border-border bg-background p-5 focus-within:border-ring sm:mt-12"
      data-slot="rich-text-canvas"
    >
      <EditorContent editor={editor} />
    </div>
  );
}
