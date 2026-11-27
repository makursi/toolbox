"use client";

import { Toggle } from "@/components/ui/toggle";

import type { CommandSpec } from "../core/commands";

/**
 * One command as a toggle: the control the pinned toolbar and the toolbar that
 * follows a selection both draw for the marks, the lists, 引用 and 代码块.
 *
 * It exists so the pressed state has one appearance and one class. A pressed toggle
 * is ink, and stays ink under the pointer (`docs/design/components.md`): the
 * vendored toggle's own on-state is the hover surface, which is 1.1:1 against the
 * canvas, so a mark that is on would look like a mark that is merely hovered. Ink on
 * paper is the site's one filled control (`Button`'s default variant), so the state
 * reuses it rather than inventing a second one; the hover rules are restated because
 * the toggle's own hover would otherwise win on the pressed control and turn the
 * label grey on ink.
 *
 * The 44px box is the button's own (`size-11`), and `.touch-target` is the
 * Instrument's marker rather than a mask, so nothing here can be shrunk by a flex
 * row without the box going with it — `shrink-0` is what holds that box in a
 * scrolling row, and it is part of the class rather than a caller's concern.
 */
const COMMAND_TOGGLE_CLASS =
  "touch-target size-11 shrink-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground";

export function CommandToggle({
  command,
  onPressed,
  pressed,
}: {
  command: CommandSpec;
  onPressed: () => void;
  pressed: boolean;
}) {
  return (
    <Toggle
      aria-label={command.label}
      className={COMMAND_TOGGLE_CLASS}
      onPressedChange={onPressed}
      pressed={pressed}
    >
      <span aria-hidden className={`icon ${command.icon}`} />
    </Toggle>
  );
}
