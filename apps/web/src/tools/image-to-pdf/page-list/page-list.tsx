"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useCallback, useMemo } from "react";

import type { Paper } from "@/tools/image-to-pdf/core/geometry";
import {
  orderCancelled,
  orderDropped,
  orderInstructions,
  orderMoved,
  orderPickedUp,
} from "@/tools/image-to-pdf/core/hints";
import type { PageEntry } from "@/tools/image-to-pdf/hooks/use-page-list/use-page-list";
import { PageRow } from "@/tools/image-to-pdf/page-row/page-row";

/**
 * The page list as a sortable list of pages.
 *
 * Two paths, one capability. A pointer drags a row's handle; a visitor without a
 * pointer focuses that same handle, lifts the row with Space, moves it with the
 * arrow keys and puts it down with Space again. The handle is the only
 * activator: the row itself is not draggable, so a click on the remove control
 * or a text selection never starts a drag.
 *
 * dnd-kit reports lifts, moves and drops to its own live region. The sentences
 * it reads are in `core/hints.ts` with the rest of the page's copy, in the page's
 * language rather than the library's English defaults, so what a screen-reader
 * visitor hears is something this repository writes.
 */

export function PageList({
  pages,
  paper,
  disabled,
  onRemove,
  onReorder,
}: {
  pages: readonly PageEntry[];
  paper: Paper;
  disabled: boolean;
  onRemove: (id: number) => void;
  onReorder: (activeId: number, overId: number) => void;
}) {
  /*
   * Both sensors on purpose. The pointer sensor is what a mouse and a finger
   * use; the keyboard sensor is the same capability for a visitor who cannot
   * drag, and `sortableKeyboardCoordinates` is what makes an arrow key move the
   * row over its neighbour rather than by a guessed number of pixels.
   */
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /* Positions are what the announcements speak; the ids dnd-kit reports are not. */
  const positionOf = useCallback(
    (id: string | number): number => {
      const index = pages.findIndex((page) => page.id === id);
      return index === -1 ? 1 : index + 1;
    },
    [pages],
  );

  const announcements = useMemo<Announcements>(() => {
    const total = pages.length;

    return {
      onDragStart({ active }) {
        return orderPickedUp(positionOf(active.id), total);
      },
      // Lifting a row reports the row itself as `over` before anything moves.
      // Announcing "moved to position 1" at that moment would overwrite the
      // sentence that says how to use the keyboard, so a row that has not moved
      // is not a move; dnd-kit keeps the previous announcement.
      onDragOver({ active, over }) {
        if (over === null || over.id === active.id) return undefined;
        return orderMoved(positionOf(active.id), positionOf(over.id), total);
      },
      onDragEnd({ active, over }) {
        return orderDropped(
          positionOf(active.id),
          over === null ? positionOf(active.id) : positionOf(over.id),
        );
      },
      onDragCancel() {
        return orderCancelled;
      },
    };
  }, [pages.length, positionOf]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      // Dropping a row where it already was is not a change, and `PageRow`'s own
      // position is the only thing that would make the document stale.
      if (event.over === null || event.over.id === event.active.id) return;

      onReorder(Number(event.active.id), Number(event.over.id));
    },
    [onReorder],
  );

  return (
    <DndContext
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: orderInstructions },
      }}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <SortableContext items={pages.map((page) => page.id)} strategy={verticalListSortingStrategy}>
        <div className="mt-1 flex flex-col">
          {pages.map((entry, index) => (
            <PageRow
              disabled={disabled}
              entry={entry}
              index={index}
              key={entry.id}
              onRemove={() => onRemove(entry.id)}
              paper={paper}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
