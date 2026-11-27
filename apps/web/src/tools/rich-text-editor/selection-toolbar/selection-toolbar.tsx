"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";

import { CommandToggle } from "../command-toggle/command-toggle";
import { commandsInGroup } from "../core/commands";
import { SELECTION_TOOLBAR_LABEL } from "../core/copy";
import { runCommand } from "../editor/execute";
import { useEditorCommandState } from "../hooks/use-editor-command-state/use-editor-command-state";
import { LinkControl } from "../link-control/link-control";

/**
 * The toolbar that follows a selection: the inline marks and the link action.
 *
 * It is placed from the selection's own rectangle, above it and `GAP` away, so it is
 * near the words and never on them; a selection near the top of the viewport flips
 * the row below itself rather than off the page, and a selection near either side is
 * clamped inside the viewport. The rectangle comes from the editor's positions
 * (`coordsAtPos`), not from `window.getSelection`: after a press on one of these
 * buttons the caret is no longer the browser's selection, while the document's is
 * still what the command acts on.
 *
 * Why not `@tiptap/extension-floating-menu`'s plugin, which this page depends on:
 * the plugin removes its element from the document when it hides and positions it
 * *before* re-adding it, so a React row would be placed against a detached box with
 * no height — the row would cover the words it is meant to sit above. Its React
 * binding (`@tiptap/react/menus`) is not usable either: that entry statically
 * imports `@tiptap/extension-bubble-menu` for its sibling `BubbleMenu`, a package
 * this Tool does not declare. Two passes are all this needs — draw, measure, place —
 * and the browser gate holds the "does not cover the selection" claim.
 *
 * The row is only in the document while a selection is not empty. That is not a
 * detail: `.touch-target` is the hit-area Instrument's marker, and a row of buttons
 * that always exists but is `visibility: hidden` would be measured as controls that
 * answer nowhere.
 */
const GAP = 8;

/** The closest the row may come to the viewport's edge. */
const EDGE = 8;

/** Above the canvas, below the popovers the link control opens. */
const Z_INDEX = 40;

interface Box {
  readonly bottom: number;
  readonly left: number;
  readonly top: number;
}

/** The selection's viewport rectangle, for a selection that may span lines. */
function selectionBox(editor: Editor, from: number, to: number): Box {
  const start = editor.view.coordsAtPos(from);
  const end = editor.view.coordsAtPos(to);

  return {
    bottom: Math.max(start.bottom, end.bottom),
    left: Math.min(start.left, end.left),
    top: Math.min(start.top, end.top),
  };
}

export function SelectionToolbar({ editor }: { editor: Editor }) {
  const state = useEditorCommandState(editor);
  const selection = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      empty: current.state.selection.empty,
      from: current.state.selection.from,
      to: current.state.selection.to,
    }),
  });
  const visible = !selection.empty;

  // The row's own box, measured after it is drawn and before the browser paints it.
  const barRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ height: 0, width: 0 });

  // A scroll or a resize moves the selection under a `position: fixed` row, so the
  // placement is recomputed rather than left behind; the reducer's value is nothing,
  // the re-render is the point.
  const [, redraw] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    if (!visible) return undefined;

    const bump = () => {
      redraw();
    };

    window.addEventListener("resize", bump);
    window.addEventListener("scroll", bump, true);

    return () => {
      window.removeEventListener("resize", bump);
      window.removeEventListener("scroll", bump, true);
    };
  }, [visible]);

  useLayoutEffect(() => {
    if (!visible) return;

    const node = barRef.current;
    if (node === null) return;

    const measured = { height: node.offsetHeight, width: node.offsetWidth };
    setBox((current) =>
      current.height === measured.height && current.width === measured.width ? current : measured,
    );
  }, [visible]);

  if (!visible) return null;

  const anchor = selectionBox(editor, selection.from, selection.to);
  const above = anchor.top - box.height - GAP;

  /*
   * Above the selection when there is room for the whole row, below it otherwise,
   * and never both: the row's bottom sits on `anchor.top - GAP`, so the selected
   * words stay uncovered either way.
   */
  const top = above >= EDGE ? above : anchor.bottom + GAP;
  const left = Math.max(EDGE, Math.min(anchor.left, window.innerWidth - box.width - EDGE));

  return (
    <div
      aria-label={SELECTION_TOOLBAR_LABEL}
      className="flex items-center gap-2 rounded-lg border border-border bg-background p-1 shadow-sm"
      ref={barRef}
      role="toolbar"
      style={{ left, position: "fixed", top, zIndex: Z_INDEX }}
    >
      {commandsInGroup("mark").map((command) => (
        <CommandToggle
          command={command}
          key={command.id}
          onPressed={() => {
            runCommand(editor, command.id);
          }}
          pressed={state.pressed[command.id]}
        />
      ))}

      <span aria-hidden className="h-6 w-px shrink-0 bg-border" />

      <LinkControl editor={editor} pressed={state.pressed.link} />
    </div>
  );
}
