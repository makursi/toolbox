"use client";

import type { Editor } from "@tiptap/react";
import { Fragment, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { CommandToggle } from "../command-toggle/command-toggle";
import { commandById, commandsInGroup, type CommandId, type CommandSpec } from "../core/commands";
import { HISTORY_DISABLED_REASON, SAVE_RETRY_LABEL, SAVE_STATUS_TEXT } from "../core/copy";
import type { SaveStatus } from "../core/save";
import { runCommand } from "../editor/execute";
import { FileMenu } from "../file-menu/file-menu";
import { useEditorCommandState } from "../hooks/use-editor-command-state/use-editor-command-state";
import { LinkControl } from "../link-control/link-control";

/**
 * The toolbar above the canvas: every command the table names, grouped the way
 * the table groups them, and the save status at the right end beside the file
 * menu.
 *
 * It is the table's renderer, not a second list. The groups come from
 * `commandsInGroup` in table order, so a command added to the core appears here
 * without an edit. What each command does is `runCommand` (`editor/execute.ts`),
 * which the slash menu and the selection toolbar run too: one table, one executor,
 * three surfaces. The file menu's four actions are the exception, and they say why
 * in `file-menu/file-menu.tsx`: they are file I/O around the document rather than
 * editor commands, so they have no row in the table and no executor.
 *
 * The state at the cursor comes from `useEditorCommandState`, so a mark that is on
 * says so and the block menu names the block the caret is in, without this component
 * keeping a copy of the document.
 *
 * The save status beside the file menu is the draft's own state (#209); its
 * sentences come from the Tool's pure copy layer, and the retry control exists
 * only while a write is refused. 清空 goes through the same draft store: the
 * writing surface empties the canvas and removes the record in one action, so a
 * cleared document is not saved back as an empty one.
 */

export interface EditorToolbarProps {
  readonly editor: Editor;
  /** Bumped when `Mod-K` asks for the link action (#207). */
  readonly linkRequest: number;
  readonly saveStatus: SaveStatus;
  /** 重试, shown only in the failure state. */
  readonly onRetry: () => void;
  /** 清空, which the writing surface routes through the draft store. */
  readonly onClear: () => void;
}

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

export function EditorToolbar({
  editor,
  linkRequest,
  saveStatus,
  onRetry,
  onClear,
}: EditorToolbarProps) {
  const [blockOpen, setBlockOpen] = useState(false);
  const state = useEditorCommandState(editor);
  const historyReasonId = useId();

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
        {commandsInGroup("history").map((command) => {
          /*
           * 撤销 and 重做 are the only controls in this toolbar that are disabled
           * at rest, and a greyed control with no reason is a dead end
           * (`apps/web/docs/design/components.md`). The sentence follows the
           * state, comes from the pure copy layer, and reaches both channels a
           * disabled button has: `title` for the pointer, an associated
           * description for a screen reader. It is carried on the control rather
           * than in a line beside it because this is one pinned row of icon
           * buttons, and a second line appearing on the first keystroke would move
           * the canvas under the caret.
           */
          const disabled = command.id === "undo" ? !state.canUndo : !state.canRedo;
          const reason = disabled
            ? HISTORY_DISABLED_REASON[command.id === "undo" ? "undo" : "redo"]
            : null;
          const describedBy = reason === null ? undefined : `${historyReasonId}-${command.id}`;

          return (
            <Fragment key={command.id}>
              <Button
                aria-describedby={describedBy}
                aria-label={command.label}
                className="touch-target size-11"
                disabled={disabled}
                onClick={() => run(command)}
                size="icon"
                title={reason ?? undefined}
                variant="ghost"
              >
                <span aria-hidden className={`icon ${command.icon}`} />
              </Button>
              {reason === null ? null : (
                <span className="sr-only" id={describedBy}>
                  {reason}
                </span>
              )}
            </Fragment>
          );
        })}

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
            <LinkControl
              editor={editor}
              key={command.id}
              openRequest={linkRequest}
              pressed={state.pressed.link}
            />
          ) : TOGGLE_COMMANDS.has(command.id) ? (
            toggle(command)
          ) : (
            action(command)
          ),
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-l border-border pl-2.5">
        {/*
         * The save status is page chrome beside the file menu, not a control in
         * the scrolling groups: it must stay readable while the middle scrolls,
         * and it is the one thing on this row that changes without the visitor
         * pressing anything. `<output>` carries the implicit `role="status"` a
         * screen reader announces politely for each sentence; the region's
         * `data-slot` is what the fingerprint anchors. The minimum width stops
         * 未保存 and 保存中 from shifting the file menu on every keystroke, while
         * the failure sentence is allowed to be its own width because it is both
         * longer and rarer.
         */}
        <div className="flex items-center gap-1.5" data-slot="rich-text-save-status">
          <output
            aria-atomic="true"
            aria-live="polite"
            className={`min-w-[6em] text-xs whitespace-nowrap ${
              saveStatus === "failed" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {SAVE_STATUS_TEXT[saveStatus]}
          </output>
          {saveStatus === "failed" ? (
            <Button className="touch-target h-11 px-2.5 text-xs" onClick={onRetry} variant="ghost">
              {SAVE_RETRY_LABEL}
            </Button>
          ) : null}
        </div>

        <FileMenu editor={editor} onClear={onClear} />
      </div>
    </div>
  );
}
