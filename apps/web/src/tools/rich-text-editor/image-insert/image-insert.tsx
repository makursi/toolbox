"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

import { IMAGE_ACCEPT } from "../core/admission";
import { commandById } from "../core/commands";
import { IMAGE_INSERT_LABEL } from "../core/copy";

/**
 * 插入图片: one real button and the hidden file input it opens (#216).
 *
 * The button is the control a visitor presses and the hit-area instrument measures,
 * so it is a `<button>` of its own (`Button` renders one) carrying `.touch-target` —
 * not a wrapper around an input. The input is `sr-only` like the file menu's 导入
 * one: a file input's own box is a replaced element that cannot be drawn as this
 * row's action, and `sr-only` keeps it a real input a browser can open, which is
 * what the gate's file chooser reaches.
 *
 * The input is emptied after every choice so the same file picked twice runs twice:
 * a file input that keeps its value fires no `change` the second time.
 *
 * `openRequest` is the slash menu's way in: applying 图片 from the menu runs no chain
 * (`runCommand` answers `false`), so the surface that owns the menu asks this
 * control to open its picker. A counter rather than a boolean, for the reason the
 * link's `Mod-K` request is one: the second application must open it again.
 */
export interface ImageInsertProps {
  /** The chosen file, handed to the one admission and the one insert. */
  readonly onFile: (file: File) => void;
  /** Bumped when the slash menu applies 图片. */
  readonly openRequest: number;
}

export function ImageInsert({ onFile, openRequest }: ImageInsertProps) {
  const input = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (openRequest > 0) input.current?.click();
  }, [openRequest]);

  return (
    <>
      <Button
        aria-label={IMAGE_INSERT_LABEL}
        className="touch-target size-11"
        onClick={() => input.current?.click()}
        size="icon"
        variant="ghost"
      >
        <span aria-hidden className={`icon ${commandById("image").icon}`} />
      </Button>
      <input
        accept={IMAGE_ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";

          if (file !== undefined) onFile(file);
        }}
        ref={input}
        type="file"
      />
    </>
  );
}
