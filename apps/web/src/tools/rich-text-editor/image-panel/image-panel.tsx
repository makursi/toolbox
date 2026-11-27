"use client";

import type { Editor } from "@tiptap/react";
import { useLayoutEffect, useId, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { IMAGE_ACCEPT } from "../core/admission";
import {
  IMAGE_ALT_APPLY_LABEL,
  IMAGE_ALT_LABEL,
  IMAGE_ALT_PLACEHOLDER,
  IMAGE_DELETE_LABEL,
  IMAGE_PANEL_LABEL,
  IMAGE_REPLACE_LABEL,
  IMAGE_WIDTH_PRESETS,
  placeImagePanel,
  widthPresetLabel,
  type PanelAnchor,
  type PanelSize,
} from "../core/image-panel";
import type { ImageReplacement } from "../editor/insert-image";
import { useSelectedImage } from "../hooks/use-selected-image/use-selected-image";
import { useViewportReposition } from "../hooks/use-viewport-reposition/use-viewport-reposition";

/** Above the canvas, below the popovers it opens: the selection toolbar's own layer. */
const Z_INDEX = 40;

/**
 * 图片操作: the panel an image gets while it is selected (#218).
 *
 * It exists only while the selection *is* an image — the component returns nothing at
 * all otherwise, which is the same rule the selection toolbar follows and for the same
 * reason: a row of `visibility: hidden` controls is a row the hit-area Instrument
 * measures as targets that answer nowhere.
 *
 * It is placed from the image's own box by `core/image-panel.ts`: above the picture,
 * one gap away, flipping below when there is no room above, and clamped inside the
 * viewport either way. A floating bar rather than a row in the page's flow, because a
 * row that appears when an image is selected pushes every word under it down by its
 * own height (the rejected alternative: a pinned row above the canvas — the document
 * would move under the visitor's caret every time they clicked a picture). Two
 * passes, as the selection toolbar does: draw at the anchor, measure the real height
 * before the browser paints, place again, so nothing is drawn on top of the picture
 * for a frame.
 *
 * The four things it does are the ticket's four: 替换 reads a file through the same
 * admission the insert uses (a refused one leaves the picture exactly as it was, and
 * shows the copy layer's sentence where the insert's refusals appear), 替代文本 opens
 * one field and sets the alt, 删除 removes the node, and the four presets set the
 * node's `width`. Alt and width are document content: they are the node's attributes,
 * so the draft stores them, a reload keeps them, and undo covers them like any other
 * change.
 *
 * Every control is a real `<button>` with the name a screen reader reads, and
 * `.touch-target` sits on the button itself — the element that owns the click — never
 * on the row. The row is a named `<section>`, and it is transient, so it is not
 * declared to the hit-area Instrument: the gate selects an image and presses these at
 * their coordinates (`apps/web/scripts/touch-targets.mjs`, `core/image-panel.ts`).
 */
export interface ImagePanelProps {
  readonly editor: Editor;
  /** Hands the chosen file to the one replacement path, with the image it targets. */
  readonly onReplaceImage: (image: ImageReplacement, file: File) => void;
}

export function ImagePanel({ editor, onReplaceImage }: ImagePanelProps) {
  const image = useSelectedImage(editor);
  const visible = image !== null;

  // The row's own box, measured after it is drawn and before the browser paints it.
  const panelRef = useRef<HTMLElement | null>(null);
  const [size, setSize] = useState<PanelSize>({ height: 0, width: 0 });

  /*
   * The panel is fixed, so scrolling the page moves the picture out from under it and
   * the placement has to follow. Recomputing only, never animating
   * (`apps/web/docs/design/motion.md`); the listener is
   * `hooks/use-viewport-reposition`, shared with the selection toolbar.
   */
  useViewportReposition(visible);

  useLayoutEffect(() => {
    if (!visible) return;

    const node = panelRef.current;
    if (node === null) return;

    const measured = { height: node.offsetHeight, width: node.offsetWidth };
    setSize((current) =>
      current.height === measured.height && current.width === measured.width ? current : measured,
    );
  }, [visible]);

  /*
   * The alt popover's field and its open state.
   *
   * The field is React's, like the link action's, so the popover's commit is a form
   * submission rather than a chain: the value has to be read from an input before it
   * becomes a document attribute. `useId` rather than a constant, for the link
   * control's reason — a second copy of this panel would otherwise point its label at
   * the other instance's field.
   */
  const [altOpen, setAltOpen] = useState(false);
  const [altDraft, setAltDraft] = useState("");
  const altFieldId = useId();

  const fileInput = useRef<HTMLInputElement | null>(null);

  // Nothing selected: no surface, and no hooks below this point — the state above is
  // declared before the early return so the hook order never changes.
  if (image === null) return null;

  const anchor = imageBox(editor, image.pos);
  if (anchor === null) return null;

  const placement = placeImagePanel(anchor, size, {
    height: window.innerHeight,
    width: window.innerWidth,
  });

  const applyAlt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    editor
      .chain()
      .focus()
      .setNodeSelection(image.pos)
      .updateAttributes("image", { alt: altDraft.trim() })
      .run();
    setAltOpen(false);
  };

  const setWidth = (width: number) => {
    editor.chain().focus().setNodeSelection(image.pos).updateAttributes("image", { width }).run();
  };

  const remove = () => {
    editor.chain().focus().setNodeSelection(image.pos).deleteSelection().run();
  };

  return (
    <section
      aria-label={IMAGE_PANEL_LABEL}
      className="flex max-w-[calc(100vw-1rem)] flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background p-1.5 shadow-sm"
      ref={panelRef}
      style={{ left: placement.left, position: "fixed", top: placement.top, zIndex: Z_INDEX }}
    >
      {/*
       * 替换 is the file-menu shape (`apps/web/docs/design/components.md`): a real
       * button whose only job is to open the `sr-only` input beside it, because a
       * file input is a replaced element that cannot be drawn as this row's action.
       * The input is emptied after every choice, so picking the same file twice is
       * two changes rather than one and a silence.
       */}
      <Button
        className="touch-target h-11 shrink-0 px-3"
        onClick={() => fileInput.current?.click()}
        variant="ghost"
      >
        {IMAGE_REPLACE_LABEL}
      </Button>
      <input
        accept={IMAGE_ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";

          if (file !== undefined) onReplaceImage(image, file);
        }}
        ref={fileInput}
        type="file"
      />

      <Popover
        onOpenChange={(next) => {
          // Read the alt when the field is about to be drawn, not when the panel is:
          // the panel outlives every press, and reopening must be an edit of what the
          // document says now rather than of what it said at mount.
          if (next) setAltDraft(image.alt);
          setAltOpen(next);
        }}
        open={altOpen}
      >
        <PopoverTrigger asChild>
          <Button className="touch-target h-11 shrink-0 px-3" variant="ghost">
            {IMAGE_ALT_LABEL}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3">
          <form className="flex flex-col gap-3" onSubmit={applyAlt}>
            <Label htmlFor={altFieldId}>{IMAGE_ALT_LABEL}</Label>
            <Input
              id={altFieldId}
              onChange={(event) => setAltDraft(event.target.value)}
              placeholder={IMAGE_ALT_PLACEHOLDER}
              value={altDraft}
            />
            <div className="flex items-center justify-end">
              <Button className="touch-target h-11" type="submit">
                {IMAGE_ALT_APPLY_LABEL}
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>

      {/*
       * The rule between the actions and the width presets is a hairline rather than a
       * second row's gap: the two groups answer different questions, and the presets
       * read as one set only if something separates them from the three actions.
       */}
      <span aria-hidden className="mx-0.5 h-6 w-px shrink-0 bg-border" />

      {IMAGE_WIDTH_PRESETS.map((width) => (
        <Button
          aria-label={widthPresetLabel(width)}
          aria-pressed={image.width === width}
          className="touch-target h-11 min-w-11 shrink-0 px-2 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary aria-pressed:hover:text-primary-foreground"
          key={width}
          onClick={() => setWidth(width)}
          variant="ghost"
        >
          {width}%
        </Button>
      ))}

      <span aria-hidden className="mx-0.5 h-6 w-px shrink-0 bg-border" />

      {/*
       * 删除 is the node's own deletion, not the draft's: it is one transaction in the
       * editor's history, so undo brings the picture back with its bytes, its alt and
       * its width intact.
       */}
      <Button className="touch-target h-11 shrink-0 px-3" onClick={remove} variant="ghost">
        {IMAGE_DELETE_LABEL}
      </Button>
    </section>
  );
}

/**
 * The selected image's box in viewport coordinates, or `null` when the node has no
 * DOM of its own to measure.
 *
 * The node's own element rather than the caret's coordinates: an image at 50% is
 * centred in the measure, so the bar belongs over the picture rather than over the
 * column it sits in. `nodeDOM` answers the `<img>` the extension rendered, and a
 * `null` there means the position no longer names a node in the view — nothing to
 * draw a panel for.
 */
function imageBox(editor: Editor, pos: number): PanelAnchor | null {
  const dom = editor.view.nodeDOM(pos);
  if (!(dom instanceof HTMLElement)) return null;

  const rect = dom.getBoundingClientRect();

  return { bottom: rect.bottom, left: rect.left, top: rect.top };
}
