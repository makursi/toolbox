"use client";

import type { Node as ProseMirrorNode, ResolvedPos } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

import {
  BLOCK_DRAG_THRESHOLD,
  BLOCK_HANDLE_LABEL,
  BLOCK_MENU_LABEL,
  BLOCK_OPERATIONS,
  blockAtPointer,
  dropBoundary,
  dropIndicatorTop,
  placeBlockHandle,
  type BlockBand,
  type BlockHandlePlacement,
  type BlockOperationId,
} from "../core/block";
import { commandsInGroup, type CommandId } from "../core/commands";
import { BLOCK_DISABLED_REASON } from "../core/copy";
import { FLOATING_LAYER_Z_INDEX } from "../core/layers";
import { blockDragKey, blockDragPlugin, setBlockDragging } from "../editor/block-drag";
import { moveBlockToBoundary, runBlockOperation, runCommandOnBlock } from "../editor/execute";
import { useViewportReposition } from "../hooks/use-viewport-reposition/use-viewport-reposition";

/**
 * 块手柄: the control beside the block a visitor is acting on (#229).
 *
 * It is a real `<button>` that is always in the document and always in the tab
 * order. It is placed beside the block holding the caret, and beside the block
 * under the pointer, so a block can be moved, deleted or converted without first
 * selecting it. Pressing it opens the 块操作 menu; dragging it reorders the
 * document.
 *
 * Both homes come from `core/block.ts` — the page gutter when it is at least the
 * control plus 8px of clearance, the canvas's own 52px left inset below that —
 * and the headline promise is the one both homes keep: the control never covers a
 * glyph of the text it acts on. The geometry is the hit-area Instrument's
 * (`block-handle-clearance`); this component only draws what the pure function
 * returned.
 *
 * The menu is the command table's second surface for block types, not a second
 * list: 上移 / 下移 / 删除 then a hairline, then the four rows of
 * `commandsInGroup("block")`, so a block type added to the table appears here
 * without an edit. The three operations are a second executor map keyed by
 * `BlockOperationId` because they act on the block the handle names rather than on
 * a document-wide selection; the four conversions run the table's own commands,
 * moved into the named block first (`runCommandOnBlock`).
 *
 * A pointer drag is the same handle: a press that moves less than 4px is a click
 * that opens the menu, and a press that moves further is a drag. During the drag
 * the source block is dimmed and a 2px ink line marks the drop boundary; the move
 * is applied as one transaction on release (`moveBlockToBoundary`), so one 撤销
 * puts the block back, and Escape cancels without touching the document. There is
 * no ghost following the pointer and no auto-scroll, which is why the spec rejects
 * `@tiptap/extension-drag-handle` and its collaboration peers: this is a rectangle
 * and arithmetic the Tool already owns.
 *
 * It is a floating surface, not a fingerprint anchor: its position follows the
 * caret and the pointer, and a region that moves whenever a visitor hovers is not
 * a region a snapshot can diff (`ui-fingerprint.mjs`). The hit-area Instrument
 * still declares it by name, because it is a control the page carries on load.
 */
export interface BlockHandleProps {
  readonly editor: Editor;
  /**
   * The canvas card. Its measured left edge is where the inset home puts the
   * handle, and its width is what the drop line spans; the 52px inset itself is
   * the card's own class, derived from the same `blockHandleHome` the placement
   * uses.
   */
  readonly canvas: RefObject<HTMLDivElement | null>;
}

/** The 44px control's own frame: ink-coloured, on the page's surface. */
const HANDLE_CLASS =
  "touch-target size-11 rounded-md border border-border bg-background hover:bg-secondary";

/** A block the menu was opened for: enough to run its rows without re-reading a moving caret. */
interface MenuBlock {
  readonly childCount: number;
  readonly index: number;
  readonly pos: number;
  /** The command id of the block's own type, when it is one of the four the menu offers. */
  readonly type: CommandId | null;
}

/** What the drag draws, and what it will do on release. */
interface DragView {
  readonly boundary: number;
  readonly canvasLeft: number;
  readonly canvasWidth: number;
  readonly lineTop: number;
  readonly pos: number;
}

/** The press in progress, before and after it becomes a drag. */
interface Gesture {
  cancelled: boolean;
  dragging: boolean;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
}

/** The top-level block a document position belongs to: the last block at or before it. */
function blockPositionAt(doc: ProseMirrorNode, pos: number): number {
  let found = 0;

  doc.forEach((_node, offset) => {
    if (offset <= pos) found = offset;
  });

  return found;
}

/** The top-level block holding the caret. */
function caretBlockPosition(doc: ProseMirrorNode, from: ResolvedPos): number {
  // A text caret is inside a block, so `before(1)` is its top-level start; a node
  // selection on a top-level node (an image, a rule) sits on the document's own
  // boundary and `before(1)` has no depth to reach, so its position is the block's.
  const pos = from.depth > 0 ? from.before(1) : from.pos;

  return blockPositionAt(doc, pos);
}

/** A top-level block's vertical band and the document position it starts at. */
interface MeasuredBlock extends BlockBand {
  readonly pos: number;
}

/** Every top-level block's vertical band and position, in document order. */
function measuredBlocks(editor: Editor): readonly MeasuredBlock[] {
  const blocks: MeasuredBlock[] = [];

  editor.state.doc.forEach((_node, offset) => {
    const dom = editor.view.nodeDOM(offset);
    if (!(dom instanceof HTMLElement)) return;

    const rect = dom.getBoundingClientRect();
    blocks.push({ bottom: rect.bottom, pos: offset, top: rect.top });
  });

  return blocks;
}

/** A block node's type as the command table names it, or `null` for a non-text block. */
function blockTypeCommand(node: ProseMirrorNode): CommandId | null {
  if (node.type.name === "paragraph") return "paragraph";
  if (node.type.name !== "heading") return null;

  const level = Number(node.attrs.level ?? 1);
  if (level === 1) return "heading-1";
  if (level === 2) return "heading-2";
  if (level === 3) return "heading-3";

  return null;
}

export function BlockHandle({ editor, canvas }: BlockHandleProps) {
  const button = useRef<HTMLButtonElement | null>(null);
  const [placement, setPlacement] = useState<BlockHandlePlacement>({
    home: "gutter",
    left: 0,
    top: 0,
  });

  /*
   * The block under the pointer, when it is over the editor.
   *
   * It is deliberately not cleared when the pointer leaves the editor: the handle
   * sits outside the editing surface, and clearing it on the way out would move
   * the control away from the block the visitor is reaching for. The caret's block
   * is the fallback, which is the other half of the ticket's sentence.
   */
  const [hovered, setHovered] = useState<number | null>(null);

  const [open, setOpen] = useState(false);
  const [menuBlock, setMenuBlock] = useState<MenuBlock | null>(null);
  const [drag, setDrag] = useState<DragView | null>(null);
  const dragRef = useRef<DragView | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const gestureSource = useRef(0);
  const suppressClick = useRef(false);
  const openRef = useRef(false);
  const pointerDownOpen = useRef(false);
  const outsidePress = useRef(false);
  const committed = useRef(false);
  const reasonId = useId();

  /*
   * The caret's block, through TipTap's selector: the component re-renders when
   * the caret moves to another block and not on every keystroke, because a
   * keystroke inside the same block leaves the block's start where it was.
   */
  const caret = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      pos: caretBlockPosition(current.state.doc, current.state.selection.$from),
    }),
  });

  const blockPos = hovered ?? caret.pos;
  const blockPosRef = useRef(blockPos);
  blockPosRef.current = blockPos;

  /*
   * A fixed surface placed from the document's own coordinates has to be recomputed
   * when the page scrolls or the window resizes; `hooks/use-viewport-reposition`
   * is the one-per-frame, non-animating signal the other two floating rows use.
   */
  useViewportReposition(true);

  /*
   * Two passes: draw at the last placement, then measure the block and the canvas
   * before the browser paints and place again, so no frame shows the handle beside
   * the wrong block. It runs after *every* commit rather than on a dependency list
   * because the block moves without a transaction of its own — a wrapped line, the
   * refusal sentence above the canvas, a heading that grew — which is the image
   * panel's reasoning, and `setPlacement` compares before storing so the extra pass
   * settles instead of looping.
   */
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- no list on purpose: the block moves without these values changing (see above), and the equality guard is what ends the chain
  useLayoutEffect(() => {
    const card = canvas.current;
    const dom = editor.view.nodeDOM(blockPos);

    if (card === null || !(dom instanceof HTMLElement)) return;

    const block = dom.getBoundingClientRect();
    const box = card.getBoundingClientRect();
    const next = placeBlockHandle(
      { bottom: block.bottom, top: block.top },
      { left: box.left, top: box.top, width: box.width },
      { height: window.innerHeight, width: window.innerWidth },
    );

    setPlacement((current) =>
      current.home === next.home && current.left === next.left && current.top === next.top
        ? current
        : next,
    );
  });

  /*
   * The block under the pointer.
   *
   * The listener is on the editing surface rather than on the page, because that is
   * where "a block under the pointer" is a thing at all; the handle's own presses
   * and an open menu are excluded so a gesture or a click inside the menu cannot
   * move the surface it is acting through.
   *
   * The hover is cleared when the pointer leaves the page's content column — the
   * shell's 960px column the canvas and its gutter both live in — and only then:
   * the handle is drawn outside the editing surface, so clearing on the editor's own
   * boundary would move the control away before the visitor could reach it. A press
   * in progress and an open menu are not cleared either, for the same reason.
   */
  useEffect(() => {
    const dom = editor.view.dom;
    const column = canvas.current?.parentElement ?? null;

    const onPointerMove = (event: PointerEvent) => {
      if (gesture.current?.dragging === true || openRef.current) return;

      const bands = measuredBlocks(editor);
      const index = blockAtPointer(bands, event.clientY);
      const pos = index === null ? null : (bands[index]?.pos ?? null);

      setHovered((current) => (current === pos ? current : pos));
    };

    const onPointerLeave = () => {
      if (gesture.current !== null || openRef.current) return;

      setHovered(null);
    };

    dom.addEventListener("pointermove", onPointerMove);
    column?.addEventListener("pointerleave", onPointerLeave);

    return () => {
      dom.removeEventListener("pointermove", onPointerMove);
      column?.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [canvas, editor]);

  /*
   * The drag's two transient marks on the page: the source block dimmed by a
   * decoration (the `block-dragging` class, painted by the canvas's own typography)
   * and a `user-select: none` on the document, because a press that crosses text
   * would otherwise extend a text selection into the document the drag is about to
   * reorder. For an attribute on the block's element instead of a decoration, see
   * `editor/block-drag.ts`: ProseMirror discards foreign attributes, which the gate
   * caught. Both marks are restored in the cleanup, so an unmount mid-drag leaves
   * nothing behind.
   */
  const draggingPos = drag?.pos ?? null;

  useEffect(() => {
    editor.registerPlugin(blockDragPlugin);

    return () => {
      if (!editor.isDestroyed) editor.unregisterPlugin(blockDragKey);
    };
  }, [editor]);

  useEffect(() => {
    if (draggingPos === null) return undefined;

    const node = editor.state.doc.nodeAt(draggingPos);
    if (node === null) return undefined;

    const previous = document.body.style.userSelect;

    setBlockDragging(editor.view, { from: draggingPos, to: draggingPos + node.nodeSize });
    document.body.style.userSelect = "none";

    return () => {
      if (!editor.isDestroyed) setBlockDragging(editor.view, null);
      document.body.style.userSelect = previous;
    };
  }, [draggingPos, editor]);

  /*
   * Escape cancels the drag. The listener is on the document rather than on the
   * handle because the pointer has capture and the visitor's hand is elsewhere;
   * the gesture is marked cancelled so the release that follows changes nothing,
   * and the click the browser reports after it is suppressed like a completed
   * drag's.
   */
  const dragging = drag !== null;

  useEffect(() => {
    if (!dragging) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      event.preventDefault();
      if (gesture.current !== null) {
        gesture.current.cancelled = true;
        suppressClick.current = true;
      }
      dragRef.current = null;
      setDrag(null);
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dragging]);

  const showMenu = (next: boolean) => {
    openRef.current = next;
    if (next) setMenuBlock(snapshotMenuBlock(editor, blockPosRef.current));
    setOpen(next);
  };

  /*
   * A press that moved is not a click, and the browser reports one anyway after a
   * pointerup; `suppressClick` is what keeps a drag from also opening the menu.
   * A keyboard's click has no pointerdown before it (`detail` is 0), so it toggles
   * like a button should; a pointer's press opens the menu only when the menu was
   * closed when the press began, because a press on an open menu is how Radix's
   * layer dismisses it and must not immediately reopen it.
   */
  const onClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }

    if (event.detail === 0) {
      showMenu(!openRef.current);
      return;
    }

    if (!pointerDownOpen.current) showMenu(true);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;

    pointerDownOpen.current = openRef.current;
    gestureSource.current = blockPosRef.current;
    gesture.current = {
      cancelled: false,
      dragging: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (current === null || current.cancelled) return;

    if (!current.dragging) {
      const travelled = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
      if (travelled < BLOCK_DRAG_THRESHOLD) return;

      current.dragging = true;
    }

    const bands = measuredBlocks(editor);
    const boundary = dropBoundary(bands, event.clientY);
    const lineTop = dropIndicatorTop(bands, boundary);
    const card = canvas.current;

    if (lineTop === null || card === null) return;

    const box = card.getBoundingClientRect();
    const next: DragView = {
      boundary,
      canvasLeft: box.left,
      canvasWidth: box.width,
      lineTop,
      pos: gestureSource.current,
    };

    dragRef.current = next;
    setDrag(next);
  };

  const endGesture = (event: ReactPointerEvent<HTMLButtonElement>, commit: boolean) => {
    const current = gesture.current;
    gesture.current = null;

    if (current === null) return;

    if (event.currentTarget.hasPointerCapture(current.pointerId)) {
      event.currentTarget.releasePointerCapture(current.pointerId);
    }

    const view = dragRef.current;
    dragRef.current = null;
    setDrag(null);

    if (!current.dragging) return;

    // A drag's click has to be swallowed: without this the menu would open on the
    // release of every reorder.
    suppressClick.current = true;

    if (commit && !current.cancelled && view !== null) {
      moveBlockToBoundary(editor, view.pos, view.boundary);
    }
  };

  const run = (id: BlockOperationId) => {
    if (menuBlock === null) return;

    committed.current = true;
    runBlockOperation(editor, id, menuBlock.pos);
    showMenu(false);
  };

  const convert = (id: CommandId) => {
    if (menuBlock === null) return;

    committed.current = true;
    runCommandOnBlock(editor, id, menuBlock.pos);
    showMenu(false);
  };

  const moveDisabled = (id: BlockOperationId): boolean => {
    if (menuBlock === null) return true;
    if (id === "move-up") return menuBlock.index === 0;
    if (id === "move-down") return menuBlock.index === menuBlock.childCount - 1;

    return false;
  };

  const reasonOf = (id: BlockOperationId): string | null => {
    if (id !== "move-up" && id !== "move-down") return null;

    return moveDisabled(id) ? BLOCK_DISABLED_REASON[id] : null;
  };

  return (
    <>
      <Popover onOpenChange={showMenu} open={open}>
        {/*
         * The handle is the popover's anchor rather than its trigger: the trigger's
         * own click toggle would fight the pointer gesture (a drag whose release
         * the browser still reports as a click would open the menu), and the
         * anchor's `aria-haspopup`/`expanded` are ours to state. Radix still owns
         * Escape, the outside press and the layer the menu is drawn on.
         */}
        <PopoverAnchor asChild>
          <Button
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={BLOCK_HANDLE_LABEL}
            className={HANDLE_CLASS}
            onClick={onClick}
            onPointerCancel={(event) => endGesture(event, false)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(event) => endGesture(event, true)}
            ref={button}
            style={{
              left: placement.left,
              position: "fixed",
              top: placement.top,
              zIndex: FLOATING_LAYER_Z_INDEX,
            }}
            type="button"
            variant="ghost"
          >
            <span aria-hidden className="icon icon-[ph--dots-six-vertical-bold]" />
          </Button>
        </PopoverAnchor>

        <PopoverContent
          align="start"
          className="w-44 p-1"
          onCloseAutoFocus={(event) => {
            // The command a row runs focuses the editor itself, so the focus must
            // not be pulled back here; Escape and a press on the page both hand it
            // back to the handle, which is where the visitor was. An outside press
            // is the one close that must leave the focus where the visitor put it.
            event.preventDefault();

            const back = !committed.current && !outsidePress.current;
            committed.current = false;
            outsidePress.current = false;

            if (back) button.current?.focus();
          }}
          onOpenAutoFocus={(event) => {
            // Focus the menu's first row rather than the popover's own container:
            // the row is what a keyboard acts on, and the container would be a
            // nameless stop before it.
            event.preventDefault();

            const content = event.currentTarget;
            if (content instanceof HTMLElement) firstEnabledRow(content);
          }}
          onPointerDownOutside={() => {
            outsidePress.current = true;
          }}
        >
          {menuBlock === null ? null : (
            <div className="flex flex-col">
              {/*
               * The disabled reasons are descriptions of the two rows, kept out of
               * the menu's own list so the region contains nothing but its items.
               */}
              <div className="sr-only">
                {BLOCK_OPERATIONS.map((operation) => {
                  const reason = reasonOf(operation.id);

                  return reason === null ? null : (
                    <span id={`${reasonId}-${operation.id}`} key={operation.id}>
                      {reason}
                    </span>
                  );
                })}
              </div>
              <div aria-label={BLOCK_MENU_LABEL} className="flex flex-col" role="menu">
                {BLOCK_OPERATIONS.map((operation) => {
                  const disabled = moveDisabled(operation.id);
                  const reason = reasonOf(operation.id);
                  const describedBy = reason === null ? undefined : `${reasonId}-${operation.id}`;

                  return (
                    <Button
                      aria-describedby={describedBy}
                      className="touch-target h-11 w-full justify-start px-3 text-sm font-normal"
                      disabled={disabled}
                      key={operation.id}
                      onClick={() => run(operation.id)}
                      role="menuitem"
                      title={reason ?? undefined}
                      variant="ghost"
                    >
                      {operation.label}
                    </Button>
                  );
                })}

                <span aria-hidden className="my-1 h-px w-full shrink-0 bg-border" />

                {commandsInGroup("block").map((command) => (
                  <Button
                    aria-current={menuBlock.type === command.id ? "true" : undefined}
                    className="touch-target h-11 w-full justify-start gap-2 px-3 text-sm font-normal"
                    key={command.id}
                    onClick={() => convert(command.id)}
                    role="menuitem"
                    variant="ghost"
                  >
                    <span
                      aria-hidden
                      className={`icon ${command.icon} ${
                        menuBlock.type === command.id ? "" : "invisible"
                      }`}
                    />
                    {command.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {drag === null ? null : (
        /*
         * The drop boundary: a 2px ink line across the canvas at the gap the block
         * will land in. It is the whole of the drag's feedback besides the dimmed
         * source block — no ghost follows the pointer, which is why the spec needs
         * no reduced-motion path for the gesture.
         */
        <div
          aria-hidden
          className="pointer-events-none fixed h-0.5 bg-foreground"
          data-slot="block-drop-line"
          style={{
            left: drag.canvasLeft,
            top: drag.lineTop,
            width: drag.canvasWidth,
            zIndex: FLOATING_LAYER_Z_INDEX,
          }}
        />
      )}
    </>
  );
}

/** What the menu was opened for: the named block, its index and its own type. */
function snapshotMenuBlock(editor: Editor, pos: number): MenuBlock | null {
  const blocks: { node: ProseMirrorNode; offset: number }[] = [];

  editor.state.doc.forEach((node, offset) => blocks.push({ node, offset }));

  const index = blocks.findIndex((block) => block.offset === pos);
  const found = blocks[index];
  if (found === undefined) return null;

  return {
    childCount: blocks.length,
    index,
    pos,
    type: blockTypeCommand(found.node),
  };
}

/** Focus the menu's first row that can be pressed, for the keyboard that opened it. */
function firstEnabledRow(content: HTMLElement): void {
  content.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
}
