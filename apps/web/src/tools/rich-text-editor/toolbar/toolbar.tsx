"use client";

import type { Editor } from "@tiptap/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { CommandToggle } from "../command-toggle/command-toggle";
import { commandById, commandsInGroup, type CommandId, type CommandSpec } from "../core/commands";
import { runCommand } from "../editor/execute";
import { useEditorCommandState } from "../hooks/use-editor-command-state/use-editor-command-state";
import { LinkControl } from "../link-control/link-control";

/**
 * The pinned toolbar above the canvas: every command the table names, grouped the
 * way the table groups them.
 *
 * It is the table's renderer, not a second list. The groups come from
 * `commandsInGroup` in table order, so a command added to the core appears here
 * without an edit. What each command does is `runCommand` (`editor/execute.ts`),
 * which the slash menu and the selection toolbar run too: one table, one executor,
 * three surfaces.
 *
 * The state at the cursor comes from `useEditorCommandState`, so a mark that is on
 * says so and the block menu names the block the caret is in, without this component
 * keeping a copy of the document.
 *
 * What is deliberately absent: the file menu holds 清空 and nothing else until the
 * import/export slices land, and there is no save status here yet. A control for a
 * feature that does not exist is a promise the page cannot keep.
 */

/** Commands that read as on/off at the cursor; the rest are one-shot actions. */
const TOGGLE_COMMANDS: ReadonlySet<CommandId> = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "bullet-list",
  "ordered-list",
  "task-list",
  "blockquote",
  "code-block",
]);

/** A hairline between two groups of controls. */
function Separator() {
  return <span aria-hidden className="h-6 w-px shrink-0 bg-border" />;
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  const [blockOpen, setBlockOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const state = useEditorCommandState(editor);

  const run = (command: CommandSpec) => {
    runCommand(editor, command.id);
  };

  const blockLabel = commandById(state.block).label;

  const toggle = (command: CommandSpec) => (
    <CommandToggle
      command={command}
      key={command.id}
      onPressed={() => run(command)}
      pressed={state.pressed[command.id]}
    />
  );

  const action = (command: CommandSpec) => (
    <Button
      aria-label={command.label}
      className="touch-target size-11"
      key={command.id}
      onClick={() => run(command)}
      size="icon"
      variant="ghost"
    >
      <span aria-hidden className={`icon ${command.icon}`} />
    </Button>
  );

  return (
    /*
     * The row is the content column's width, not the canvas's 720px: sixteen
     * controls at the 44px floor do not fit a reading measure, and the toolbar
     * is page chrome above the measure rather than part of it. The middle groups
     * scroll as one region and the file menu is a sibling outside that region,
     * which is what keeps the right end still at 390px.
     */
    <div
      aria-label="格式工具栏"
      className="flex items-center gap-2 rounded-lg border border-border bg-background p-1"
      data-slot="rich-text-toolbar"
      role="toolbar"
    >
      <div
        className="flex min-w-0 flex-1 [scrollbar-width:thin] items-center gap-2.5 overflow-x-auto px-1 py-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
        data-slot="rich-text-toolbar-scroll"
      >
        {commandsInGroup("history").map((command) => (
          <Button
            aria-label={command.label}
            className="touch-target size-11"
            disabled={command.id === "undo" ? !state.canUndo : !state.canRedo}
            key={command.id}
            onClick={() => run(command)}
            size="icon"
            variant="ghost"
          >
            <span aria-hidden className={`icon ${command.icon}`} />
          </Button>
        ))}

        <Separator />

        <Popover onOpenChange={setBlockOpen} open={blockOpen}>
          <PopoverTrigger asChild>
            <Button
              aria-label={`块类型：${blockLabel}`}
              className="touch-target h-11 gap-1.5 px-3 text-sm font-normal"
              variant="ghost"
            >
              <span>{blockLabel}</span>
              <span aria-hidden className="icon icon-[ph--caret-down-bold] text-[12px]" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-44 p-1">
            <div className="flex flex-col">
              {commandsInGroup("block").map((command) => (
                <Button
                  aria-current={state.block === command.id ? "true" : undefined}
                  className="touch-target h-11 w-full justify-start gap-2 px-3 text-sm font-normal"
                  key={command.id}
                  onClick={() => {
                    run(command);
                    setBlockOpen(false);
                  }}
                  variant="ghost"
                >
                  <span
                    aria-hidden
                    className={`icon ${command.icon} ${
                      state.block === command.id ? "" : "invisible"
                    }`}
                  />
                  {command.label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Separator />

        {commandsInGroup("mark").map(toggle)}

        <Separator />

        {commandsInGroup("list").map(toggle)}

        <Separator />

        {commandsInGroup("insert").map((command) =>
          command.id === "link" ? (
            <LinkControl editor={editor} key={command.id} pressed={state.pressed.link} />
          ) : TOGGLE_COMMANDS.has(command.id) ? (
            toggle(command)
          ) : (
            action(command)
          ),
        )}
      </div>

      <div className="flex shrink-0 items-center border-l border-border pl-2.5">
        <Popover onOpenChange={setFileOpen} open={fileOpen}>
          <PopoverTrigger asChild>
            <Button aria-label="文件" className="touch-target size-11" size="icon" variant="ghost">
              <span aria-hidden className="icon icon-[ph--folder-simple-bold]" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-40 p-1">
            <Button
              className="touch-target h-11 w-full justify-start px-3 text-sm font-normal"
              onClick={() => {
                runCommand(editor, "clear");
                setFileOpen(false);
              }}
              variant="ghost"
            >
              清空
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
