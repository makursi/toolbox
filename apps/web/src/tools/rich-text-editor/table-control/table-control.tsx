"use client";

import type { Editor } from "@tiptap/react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { commandById } from "../core/commands";
import {
  TABLE_GRID_HINT,
  TABLE_GRID_LABEL,
  TABLE_MAX_COLUMNS,
  TABLE_MAX_ROWS,
  TABLE_MENU_LABEL,
  TABLE_OPERATIONS,
  tableGridCellLabel,
  tableSizeLabel,
  type TableOperationId,
  type TableSize,
} from "../core/table";
import { insertTable, runTableOperation } from "../editor/execute";

/**
 * The grid's cells, in reading order: row one's ten columns, then row two's, and so
 * on. Built once rather than per render, because the pointer moves over this grid
 * and each move is a render.
 */
const GRID_SIZES: readonly TableSize[] = Array.from(
  { length: TABLE_MAX_ROWS * TABLE_MAX_COLUMNS },
  (_, index) => ({
    columns: (index % TABLE_MAX_COLUMNS) + 1,
    rows: Math.floor(index / TABLE_MAX_COLUMNS) + 1,
  }),
);

/**
 * The toolbar's 表格 button, in its two states (#217).
 *
 * Outside a table it opens the grid picker: a 10 × 10 field of cells where the
 * pointer (or the keyboard's focus) reads the size it is over and a press commits
 * the rows and columns under it. Inside a table the same button, at the same place,
 * opens the contextual menu: 上方插入行 / 下方插入行 / 左侧插入列 / 右侧插入列 /
 * 删除行 / 删除列 / 删除表格.
 *
 * The state is a prop rather than a read of the document here: the toolbar gets it
 * from `useEditorCommandState` (`inTable`), which observes the selection, and this
 * component only decides which of the two transient surfaces that state opens. Two
 * readers of TipTap's state would be two answers, and the one that is not observed
 * is the one that goes stale.
 *
 * Both surfaces are transient, so neither is declared to the hit-area instrument
 * (`scripts/touch-targets.mjs`): the gate opens them and presses their cells and
 * rows at their coordinates. Every one of them still carries `.touch-target`, on the
 * button itself — the element that owns the click — so a scan that catches the
 * surface open measures 44px.
 */
export interface TableControlProps {
  readonly editor: Editor;
  /** Whether the caret is inside a table; the button then opens the menu. */
  readonly inTable: boolean;
}

export function TableControl({ editor, inTable }: TableControlProps) {
  const [open, setOpen] = useState(false);
  /*
   * Whether the popover is closing because one of its own actions ran. Radix returns
   * the focus to the trigger on every close, which is right after Escape or a click
   * outside and wrong after a commit: every action chains `.focus()`, so the caret
   * is already where it belongs — in the new table's first cell, or in the paragraph
   * 删除表格 leaves behind — and sending it back to the toolbar button would take it
   * away. The flag is what tells the two closes apart.
   */
  const committed = useRef(false);
  const command = commandById("table");

  const pick = (size: TableSize) => {
    committed.current = true;
    insertTable(editor, size);
    setOpen(false);
  };

  const run = (id: TableOperationId) => {
    committed.current = true;
    runTableOperation(editor, id);
    setOpen(false);
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          aria-haspopup={inTable ? "menu" : undefined}
          aria-label={command.label}
          className="touch-target size-11"
          size="icon"
          variant="ghost"
        >
          <span aria-hidden className={`icon ${command.icon}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-2"
        onCloseAutoFocus={(event) => {
          if (!committed.current) return;

          committed.current = false;
          event.preventDefault();
        }}
      >
        {inTable ? <TableMenu onRun={run} /> : <TableGrid onPick={pick} />}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The grid picker.
 *
 * Each cell is a real 44px button with its own accessible name — "2 行 × 3 列" —
 * so a keyboard reaches a size by tabbing to the cell and pressing Enter, and a
 * screen reader reads a size rather than one of a hundred identical squares. The
 * summary under the grid is a polite live region: it says the size the pointer or
 * the focus is on, and it starts as the instruction (`TABLE_GRID_HINT`), so the
 * picker is usable with the pointer off the grid.
 *
 * The cells are laid out by a static 10-column template rather than by a generated
 * style: Tailwind has to see the class in the source to emit it, and an arbitrary
 * value built at runtime would ship no rule at all.
 */
function TableGrid({ onPick }: { readonly onPick: (size: TableSize) => void }) {
  const [hovered, setHovered] = useState<TableSize | null>(null);

  return (
    <div className="flex flex-col">
      <p className="mb-2 text-xs text-muted-foreground">{TABLE_GRID_LABEL}</p>
      {/*
       * The grid is wider than a phone: 10 cells at the 44px floor are 440px. It
       * scrolls inside the popover instead of shrinking the cells, because the floor
       * is the control's size and not a suggestion; the popover itself stays inside
       * the viewport.
       */}
      <div className="max-w-[calc(100vw-2rem)] overflow-x-auto">
        {/*
         * A named region rather than a `role="group"` div: a `<section>` with an
         * accessible name is already a region, and the lint rule that prefers the
         * native element over the role is the same point. The name is what the gate
         * finds the grid by; the cells are its buttons.
         */}
        <section
          aria-label={TABLE_GRID_LABEL}
          className="grid grid-cols-[repeat(10,2.75rem)] gap-px bg-border p-px"
        >
          {GRID_SIZES.map((size) => {
            const highlighted =
              hovered !== null && size.rows <= hovered.rows && size.columns <= hovered.columns;

            return (
              <button
                aria-label={tableGridCellLabel(size)}
                className={`touch-target h-11 w-11 shrink-0 p-0 ${
                  highlighted ? "bg-secondary" : "bg-background"
                }`}
                key={`${size.rows}-${size.columns}`}
                onClick={() => onPick(size)}
                onFocus={() => setHovered(size)}
                onMouseEnter={() => setHovered(size)}
                type="button"
              />
            );
          })}
        </section>
      </div>
      <p aria-live="polite" className="mt-2 min-h-5 text-xs text-muted-foreground">
        {hovered === null ? TABLE_GRID_HINT : tableSizeLabel(hovered)}
      </p>
    </div>
  );
}

/** The contextual menu's seven rows, in `TABLE_OPERATIONS`' order. */
function TableMenu({ onRun }: { readonly onRun: (id: TableOperationId) => void }) {
  return (
    <div aria-label={TABLE_MENU_LABEL} className="flex w-44 flex-col" role="menu">
      {TABLE_OPERATIONS.map((operation) => (
        <Button
          className="touch-target h-11 w-full justify-start px-3 text-sm font-normal"
          key={operation.id}
          onClick={() => onRun(operation.id)}
          role="menuitem"
          variant="ghost"
        >
          {operation.label}
        </Button>
      ))}
    </div>
  );
}
