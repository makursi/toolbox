"use client";

import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { useCallback, useState } from "react";

import { EMPTY_DOCUMENT } from "./core/document";
import { sanitizeHtml } from "./core/html-import";
import type { SaveStatus } from "./core/save";
import { useDraft } from "./hooks/use-draft/use-draft";
import { SelectionToolbar } from "./selection-toolbar/selection-toolbar";
import { SlashMenuExtension } from "./slash-menu/slash-menu-extension";
import { EditorToolbar } from "./toolbar/toolbar";

/** What an empty document says, in the words a visitor reads. */
const TITLE_PLACEHOLDER = "无标题";
const BODY_PLACEHOLDER = "开始写吧，输入 `/` 插入内容";

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
 * The levels below it are the document's own hierarchy, so they are set from the
 * same scale rather than from a second one: 24px for an h2, 20px for an h3.
 *
 * The editing surface paints no outline of its own: the canvas's hairline becomes ink
 * while the editor holds the focus (`focus-within` on the card below), which is the
 * site's focus colour and the same "the line changes, nothing moves" state the
 * format cards use. A 2px ring around a 60vh area drew a second rectangle inside the
 * card, and the card's own line is the boundary a visitor already reads.
 *
 * Lists, task items, quotes, code and rules are styled here because the document is
 * ProseMirror's own DOM and the site has no stylesheet for it. A task item is a
 * `label` with a native checkbox and a `div` of content, so the checked state is the
 * node's own `data-checked` attribute; the line through a finished item is the one
 * piece of the canvas that changes without the visitor typing.
 */
const EDITOR_CLASS = [
  "min-h-[60vh] outline-none",
  "[&_.is-empty::before]:pointer-events-none",
  "[&_.is-empty::before]:text-[color:var(--site-placeholder)]",
  "[&_.is-empty::before]:content-[attr(data-placeholder)]",
  "[&_h1]:mt-2 [&_h1]:mb-4 [&_h1]:text-[34px] [&_h1]:leading-[1.3] [&_h1]:font-semibold",
  "[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-[24px] [&_h2]:leading-[1.35] [&_h2]:font-semibold",
  "[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-[20px] [&_h3]:leading-[1.4] [&_h3]:font-semibold",
  "[&_p]:my-2",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6",
  "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_li]:my-1",
  "[&_li>p]:my-0",
  "[&_ul_ul]:list-[circle]",
  "[&_ol_ol]:list-[lower-alpha]",
  "[&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0",
  "[&_li[data-checked]]:flex [&_li[data-checked]]:items-start [&_li[data-checked]]:gap-2",
  "[&_li[data-checked]>label]:mt-0.5 [&_li[data-checked]>label]:shrink-0",
  "[&_li[data-checked]>div]:min-w-0 [&_li[data-checked]>div]:flex-1",
  "[&_li[data-checked]_input[type=checkbox]]:size-4 [&_li[data-checked]_input[type=checkbox]]:accent-[var(--site-text)]",
  "[&_li[data-checked=true]>div]:text-muted-foreground [&_li[data-checked=true]>div]:line-through",
  "[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
  "[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-secondary [&_pre]:p-4 [&_pre]:text-sm [&_pre]:leading-[1.6] [&_pre]:[font-family:var(--font-geist-mono),ui-monospace,monospace]",
  "[&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_code]:[font-family:var(--font-geist-mono),ui-monospace,monospace]",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit",
  "[&_hr]:my-8 [&_hr]:border-t [&_hr]:border-border",
  "[&_a]:underline [&_a]:underline-offset-[3px]",
].join(" ");

/**
 * The writing surface: the draft, one TipTap editor, the toolbar above it, and the
 * document they both act on.
 *
 * The canonical document is ProseMirror JSON (`apps/web/src/tools/rich-text-editor/rules.md`),
 * and the local draft is that same document plus a schema version and a timestamp
 * in IndexedDB (`core/draft.ts`). The page is the editor's only consumer, so the
 * component takes no configuration: the draft's four operations arrive from
 * `useDraft`, which owns the timer and the store.
 *
 * The editor is created **on the client only** (`immediatelyRender: false`): the
 * server cannot know anything about a document the visitor has not typed yet, and a
 * contenteditable rendered on the server is HTML that a hydrating editor would have
 * to reconcile with the visitor's cursor. The page therefore serves an empty canvas
 * and the editor and toolbar arrive with hydration, which is the same reason the
 * gate waits for React before it types.
 *
 * The draft is read before the editor exists. `initialDocument` is `null` until the
 * store answers, and the surface below is mounted only once it does, so a returning
 * visitor's document is the editor's initial content rather than a late `setContent`
 * over a cursor that is already typing. Restore is silent: there is no prompt, and a
 * missing or broken record is just the empty document.
 *
 * The toolbar's own placeholder is the height the toolbar will have, so the canvas
 * does not jump when the editor arrives: the row is 44px of controls plus two 4px
 * paddings, and the placeholder is that box and nothing else.
 */
export function RichTextEditor() {
  const draft = useDraft();
  const initialDocument = draft.initialDocument;

  if (initialDocument === null) {
    return (
      <div className="mx-auto mt-10 w-full max-w-[960px] sm:mt-12">
        <div aria-hidden className="h-[60px] rounded-lg border border-border bg-background" />
        <div
          className="mx-auto mt-6 w-full max-w-[720px] rounded-lg border border-border bg-background p-5"
          data-slot="rich-text-canvas"
        />
      </div>
    );
  }

  return (
    <EditorSurface
      initialContent={initialDocument}
      onChange={draft.change}
      onClear={draft.clear}
      onRetry={draft.retry}
      saveStatus={draft.status}
    />
  );
}

interface EditorSurfaceProps {
  readonly initialContent: JSONContent;
  readonly saveStatus: SaveStatus;
  readonly onChange: (document: JSONContent) => void;
  readonly onRetry: () => void;
  readonly onClear: () => void;
}

/**
 * The mounted editor: TipTap, the extensions, the toolbar and the canvas.
 *
 * It is a component of its own so `useEditor` is not called on the server and not
 * called conditionally: the outer surface picks between the placeholder and this
 * surface, and `useEditor` only ever runs where there is a document to open.
 */
function EditorSurface({
  initialContent,
  saveStatus,
  onChange,
  onRetry,
  onClear,
}: EditorSurfaceProps) {
  /*
   * The link action's keyboard request (#207).
   *
   * The address field is React's (`link-control/link-control.tsx`), so TipTap's
   * keymap cannot open it: a shortcut that only ran a chain would have nowhere to put
   * the address. `handleKeyDown` is the seam that sees the key before the keymap and
   * can hand the request to React; the counter is what makes a second `Mod-K` a
   * second open rather than a no-op.
   */
  const [linkRequest, setLinkRequest] = useState(0);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      /*
       * Link is StarterKit's own extension, configured rather than added twice.
       * `openOnClick: false` is the important option: inside a contenteditable a
       * click is how the visitor puts the caret into a link, and a link that
       * navigates away from an unsaved document is a trap rather than a feature.
       * The URL bar is the link action's job (#207); the export is #210's.
       */
      StarterKit.configure({
        link: {
          autolink: true,
          defaultProtocol: "https",
          linkOnPaste: true,
          openOnClick: false,
        },
      }),
      /*
       * TaskList and TaskItem are not in StarterKit, and nesting is not their
       * default. The checkbox's accessible name is written here because the
       * extension's default is English, and this page's interface is Chinese.
       */
      TaskList,
      TaskItem.configure({
        a11y: {
          checkboxLabel: (node, checked) =>
            `${checked ? "已完成" : "未完成"}：${node.textContent || "空任务"}`,
        },
        nested: true,
      }),
      Placeholder.configure({
        /*
         * One placeholder function, two sentences: the document's first block says
         * 无标题 when it is the empty title heading, and the document's own first
         * body block says where to start. The body sentence is tied to that one
         * position rather than to every empty paragraph, because it is a sentence
         * about the empty *document*: an empty line the visitor made with Enter is
         * not a place to say "start writing" again, and the sentence would
         * otherwise repeat down the page.
         *
         * The title sentence is tied to the first position as well. A heading the
         * visitor makes further down the document is not the title, and an empty
         * one must not say 无标题 as if it were.
         *
         * `showOnlyCurrent` is off on purpose: the title is a block of its own, so
         * the paragraph the visitor is writing in must not hide the title's
         * sentence, and the title keeps its own until the title itself is typed.
         */
        placeholder: ({ editor: current, node, pos }) => {
          if (pos === 0 && node.type.name === "heading") return TITLE_PLACEHOLDER;

          const first = current.state.doc.firstChild;
          return first?.type.name === "heading" && pos === first.nodeSize ? BODY_PLACEHOLDER : "";
        },
        showOnlyCurrent: false,
      }),
      /*
       * The slash menu. It reads the command table, so it is not a second list of
       * blocks (#208).
       */
      SlashMenuExtension,
      /*
       * No input-rule extension is added here, and that is a finding rather than an
       * omission. Every rule #208 names is StarterKit's own: the heading rule
       * (`# `, `## `, `### `) comes with Heading, the list rules (`- `, `1. `) with
       * the list nodes, `> ` with Blockquote, ` ``` ` with CodeBlock, `---` with
       * HorizontalRule, and the inline pairs (`**`, `*`, `~~`, a backtick pair) with
       * the four mark extensions. The browser gate proves each one and proves that a
       * paragraph beginning with the same characters but making no rule stays text,
       * because a rule nobody exercised is a rule nobody has.
       */
    ],
    content: initialContent,
    /*
     * Every document change is the draft's business, but the editor does not know
     * that: this is the one seam between TipTap and the save machine, and it hands
     * over the canonical JSON rather than the editor's mutable state.
     */
    onUpdate: ({ editor: current }) => onChange(current.getJSON()),
    /*
     * `role="textbox"` is TipTap's own default on the contenteditable, so the only
     * thing this adds is the name a screen reader reads: an editable region with no
     * name is announced as an anonymous textbox.
     *
     * `transformPastedHTML` is the editor's own paste path (#211): pasted markup is
     * sanitised by the same rule an imported file is, before ProseMirror parses it.
     * A `<script>` in a copied page is therefore dropped before it can become part
     * of the document, rather than relied on to be rejected by the schema.
     */
    editorProps: {
      attributes: { "aria-label": EDITOR_LABEL, class: EDITOR_CLASS },
      /*
       * The story 9 shortcut list is TipTap's own for undo/redo, the marks, the
       * headings (`Mod-Alt-1`–`3`) and the lists (`Mod-Shift-7`/`8`/`9`); the link
       * action is the one that had no key, because its interface is the popover
       * above. This is that key. It runs before the keymap so the `k` never reaches
       * the document.
       */
      handleKeyDown: (_view, event) => {
        if (!(event.metaKey || event.ctrlKey) || event.altKey) return false;
        if (event.key.toLowerCase() !== "k") return false;

        event.preventDefault();
        setLinkRequest((count) => count + 1);

        return true;
      },
      transformPastedHTML: (html) => sanitizeHtml(html),
    },
  });

  /*
   * 清空 empties the canvas and the stored draft together.
   *
   * `emitUpdate: false` is what keeps the clear from scheduling a save of the empty
   * document: the draft store's own removal is the write, and a save racing it
   * would leave a record behind. The hook bumps the revision, so a write already in
   * flight is ignored if it lands late.
   */
  const handleClear = useCallback(() => {
    editor?.commands.setContent(EMPTY_DOCUMENT, { emitUpdate: false });
    onClear();
  }, [editor, onClear]);

  return (
    /*
     * The toolbar is the content column's width and the canvas is the reading
     * measure inside it: a line of Chinese text longer than roughly 40 characters
     * is hard to follow back, and the measure is a site rule for prose
     * (`apps/web/docs/design/layout.md`). The toolbar is page chrome above the
     * measure, so it is allowed to be wider than the page the words sit on.
     *
     * The canvas's `data-slot` is the fingerprint's anchor for the region: the
     * blocks inside it are ProseMirror's own children, so the card is the thing a
     * change moves. The toolbar carries its own anchor, so a move of the bar is a
     * move of the bar rather than of the canvas under it.
     */
    <div className="mx-auto mt-10 w-full max-w-[960px] sm:mt-12">
      {editor === null ? (
        <div aria-hidden className="h-[60px] rounded-lg border border-border bg-background" />
      ) : (
        <>
          <EditorToolbar
            editor={editor}
            linkRequest={linkRequest}
            onClear={handleClear}
            onRetry={onRetry}
            saveStatus={saveStatus}
          />
          {/*
           * The selection toolbar is a fixed-position row placed from the
           * selection's own rectangle, so its place in this tree is only where it
           * is rendered: nothing about it is drawn between the toolbar and the
           * canvas.
           */}
          <SelectionToolbar editor={editor} />
        </>
      )}

      <div
        className="mx-auto mt-6 w-full max-w-[720px] rounded-lg border border-border bg-background p-5 focus-within:border-ring"
        data-slot="rich-text-canvas"
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
