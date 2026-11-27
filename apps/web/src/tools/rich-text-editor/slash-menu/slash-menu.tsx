"use client";

import type { SuggestionKeyDownProps } from "@tiptap/suggestion";
import { forwardRef, useImperativeHandle, useState } from "react";

import type { CommandSpec } from "../core/commands";
import { SLASH_MENU_EMPTY, SLASH_MENU_LABEL } from "../core/copy";

/**
 * The slash menu: the command table's block rows, filtered by what was typed.
 *
 * It is drawn by `ReactRenderer`, not by the page's own tree, because the suggestion
 * plugin owns this element: it appends it to the body, anchors it to the caret and
 * takes it away again. So the component is handed the same props the plugin's render
 * callbacks are, and the keyboard is forwarded into it through the handle below: the
 * caret never leaves the document, which is what keeps a menu you drive with arrow
 * keys from stealing the typing.
 *
 * The list is the command table's, in the table's order (`core/commands.ts`), so it
 * cannot disagree with the pinned toolbar about what exists or what a command is
 * called. What this component adds is the one thing a table cannot: which row the
 * arrow keys are on.
 */
export interface SlashMenuHandle {
  /**
   * Handle one key while the menu is open. `true` means the menu used it, and the
   * editor must not also act on it — Enter would otherwise insert a paragraph as
   * well as apply a command.
   */
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export interface SlashMenuProps {
  /** The commands the query matched, in the table's order. */
  items: readonly CommandSpec[];
  /** Apply one command; the plugin removes the typed `/query` first. */
  command: (item: CommandSpec) => void;
}

export const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(function SlashMenu(
  { items, command },
  ref,
) {
  const [selected, setSelected] = useState(0);

  // A filter can shrink the list under the highlight, so the row the keys are on is
  // clamped to what is drawn rather than trusted: a query that matches one command
  // must never leave Enter pointing at a row that no longer exists.
  const active = items.length === 0 ? -1 : Math.min(selected, items.length - 1);

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: ({ event }) => {
        if (items.length === 0) return false;

        if (event.key === "ArrowDown") {
          setSelected((active + 1) % items.length);
          return true;
        }

        if (event.key === "ArrowUp") {
          setSelected((active - 1 + items.length) % items.length);
          return true;
        }

        if (event.key === "Enter") {
          const item = items[active];
          if (item === undefined) return false;
          command(item);
          return true;
        }

        // Everything else, Escape included, is the plugin's or the editor's:
        // the plugin closes the menu on Escape itself, and letters are the filter.
        return false;
      },
    }),
    [active, command, items],
  );

  return (
    <div
      aria-label={SLASH_MENU_LABEL}
      className="w-56 rounded-lg border border-border bg-background p-1 shadow-sm"
      role="menu"
    >
      {items.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">{SLASH_MENU_EMPTY}</p>
      ) : (
        items.map((item, index) => (
          <button
            aria-current={index === active ? "true" : undefined}
            className="touch-target flex h-11 w-full items-center gap-2 rounded-md px-3 text-left text-sm aria-[current=true]:bg-secondary"
            key={item.id}
            onClick={() => command(item)}
            onMouseDown={(event) => {
              // Keep the caret where it is: a mousedown that moves focus would
              // close the menu before the click that applies the command arrives.
              event.preventDefault();
            }}
            onMouseEnter={() => setSelected(index)}
            role="menuitem"
            tabIndex={-1}
            type="button"
          >
            <span aria-hidden className={`icon ${item.icon} shrink-0`} />
            <span className="truncate">{item.label}</span>
          </button>
        ))
      )}
    </div>
  );
});
