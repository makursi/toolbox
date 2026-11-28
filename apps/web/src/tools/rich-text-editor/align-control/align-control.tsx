"use client";

import type { Editor } from "@tiptap/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { commandById, commandsInGroup, type CommandId, type CommandSpec } from "../core/commands";
import { runCommand } from "../editor/execute";

/**
 * 对齐 (#230): one toolbar trigger over the alignment group's three rows.
 *
 * It is a popover rather than three 44px controls for the reason the block-type
 * trigger is one: the toolbar already sits at the content column's width, and
 * three more buttons for a secondary formatting action is the expensive way to
 * say what one named trigger and three rows say. The rows are the command table's
 * `align` group — the same table the toolbar and both other surfaces render from,
 * so alignment cannot exist in one place and not another.
 *
 * The trigger's accessible name is `对齐：<当前>`, which is what makes the state
 * readable without opening it; the row in force carries `aria-current`, so a
 * screen reader hears the same fact twice rather than having to infer it. The
 * current value comes from `pressed`, the state hook's exhaustive map, and left is
 * the absence of the attribute, so the left row is the one in force by default —
 * there is always exactly one.
 */
export function AlignControl({
  editor,
  pressed,
}: {
  readonly editor: Editor;
  readonly pressed: Record<CommandId, boolean>;
}) {
  const [open, setOpen] = useState(false);
  const commands = commandsInGroup("align");
  const current = commands.find((command) => pressed[command.id]) ?? commandById("align-left");

  const choose = (command: CommandSpec) => {
    runCommand(editor, command.id);
    setOpen(false);
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-label={`对齐：${current.label}`}
          className="touch-target h-11 gap-1.5 px-3 text-sm font-normal"
          variant="ghost"
        >
          <span aria-hidden className={`icon ${current.icon}`} />
          <span aria-hidden className="icon icon-[ph--caret-down-bold] text-[12px]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-36 p-1">
        <div className="flex flex-col">
          {commands.map((command) => (
            <Button
              aria-current={pressed[command.id] ? "true" : undefined}
              className="touch-target h-11 w-full justify-start gap-2 px-3 text-sm font-normal"
              key={command.id}
              onClick={() => choose(command)}
              variant="ghost"
            >
              <span aria-hidden className={`icon ${command.icon}`} />
              {command.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
