"use client";

import type { Editor } from "@tiptap/react";
import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { commandById } from "../core/commands";

/**
 * The link action: a trigger, one field, 应用 and 移除.
 *
 * It is one component because two surfaces offer the action — the pinned toolbar's
 * insert group and the toolbar that follows a selection — and the link is the one
 * command whose behaviour is an interface rather than a chain
 * (`editor/execute.ts`). A second copy would be a second place for the address to
 * be read from, and the two would drift the first time one of them learned to
 * prefill differently.
 *
 * The field's id comes from `useId` rather than a constant, because the two
 * instances can be mounted at once: a fixed id would make one label point at the
 * other instance's input, and a screen reader would announce the wrong field. The
 * field is prefilled from the mark at the cursor when the popover opens, which is
 * what makes reopening on existing link text an edit rather than a reset.
 *
 * `openOnClick: false` on the Link extension is the other half: inside a
 * contenteditable a click is how a visitor puts the caret into a link, and a link
 * that navigates away from an unsaved document is a trap rather than a feature.
 */
export function LinkControl({ editor, pressed }: { editor: Editor; pressed: boolean }) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  const fieldId = useId();
  const command = commandById("link");

  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = href.trim();
    const chain = editor.chain().focus().extendMarkRange("link");

    if (url === "") chain.unsetLink().run();
    else chain.setLink({ href: url }).run();

    setOpen(false);
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setOpen(false);
  };

  return (
    <Popover
      onOpenChange={(next) => {
        // Read the mark when the field is about to be drawn, not when it is
        // mounted: the button outlives every selection the caret makes.
        if (next) setHref(editor.getAttributes("link").href ?? "");
        setOpen(next);
      }}
      open={open}
    >
      <PopoverTrigger asChild>
        <Button
          aria-label={command.label}
          className="touch-target size-11"
          size="icon"
          variant="ghost"
        >
          <span aria-hidden className={`icon ${command.icon}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <form className="flex flex-col gap-3" onSubmit={apply}>
          <Label htmlFor={fieldId}>链接地址</Label>
          <Input
            id={fieldId}
            onChange={(event) => setHref(event.target.value)}
            placeholder="https://example.com"
            value={href}
          />
          <div className="flex items-center justify-end gap-2">
            {pressed ? (
              <Button className="touch-target h-11" onClick={remove} type="button" variant="ghost">
                移除
              </Button>
            ) : null}
            <Button className="touch-target h-11" type="submit">
              应用
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
