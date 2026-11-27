"use client";

import { NodeSelection } from "@tiptap/pm/state";
import { useEditorState, type Editor } from "@tiptap/react";

import { DEFAULT_IMAGE_WIDTH } from "../../core/image";

/**
 * The image the visitor has selected, as the image panel needs it (#218).
 *
 * It is a hook of its own rather than another field on `useEditorCommandState` because
 * the panel is a selection surface, not a toolbar command: there is no row for it in
 * the command table, and the toolbar has no business keeping an image's attributes.
 * The state is read from the editor's selection through TipTap's selector, like every
 * other state on this page, so nothing here is a copy that could go stale between a
 * press and a render.
 *
 * A selected image is a `NodeSelection`: an image is an atom, so a text selection can
 * never cover one alone, and ProseMirror selects a clicked leaf node as a whole. The
 * check is that selection rather than "the caret is next to an image", because the
 * panel acts on the *node*: 删除 removes the node, 替换 rewrites its source, and the
 * width presets set its attribute.
 *
 * `pos` is the node's position at the moment of the read. The panel hands it back to
 * the command it runs, so a control always acts on the image the visitor is looking
 * at even if the popover took the focus in between.
 */
export interface SelectedImage {
  /** The current alt text, or an empty string when the document says nothing. */
  readonly alt: string;
  /** The node's position, for the command the panel runs. */
  readonly pos: number;
  /** The `data:` URL the node holds; the replacement's usage is measured against it. */
  readonly src: string;
  /** The share of the measure the node draws at, as a percentage. */
  readonly width: number;
}

export function useSelectedImage(editor: Editor): SelectedImage | null {
  return useEditorState({
    editor,
    selector: ({ editor: current }): SelectedImage | null => {
      const { selection } = current.state;

      if (!(selection instanceof NodeSelection) || selection.node.type.name !== "image") {
        return null;
      }

      const { attrs } = selection.node;

      return {
        alt: typeof attrs.alt === "string" ? attrs.alt : "",
        pos: selection.from,
        src: typeof attrs.src === "string" ? attrs.src : "",
        // The node's width is a number by the time it is in the document — its own
        // `parseHTML` and its default see to that — but a hand-edited draft is read
        // through the same guard as the alt, so a string there cannot make the
        // presets all read as unpressed.
        width: typeof attrs.width === "number" ? attrs.width : DEFAULT_IMAGE_WIDTH,
      };
    },
  });
}
