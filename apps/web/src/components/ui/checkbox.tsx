/*
 * One recorded change to the registry's own file (#164): it imported `CheckIcon`
 * from `lucide-react`, a package this site does not have and does not want — icons
 * are Phosphor names compiled into the CSS at build time, written as a literal class
 * (`docs/adr/0009-phosphor-icons-through-iconify.md`). This is the same exception
 * `command.tsx` carries: an icon the registry reaches for from a package we do not
 * install is replaced by this site's own, never by adding the package. The size is
 * the 14px the registry's `size-3.5` asked for, because the indicator is a 16px box.
 */
"use client";

import { cn } from "cn";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import * as React from "react";

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:data-[state=checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <span aria-hidden className="icon icon-[ph--check-bold] text-[14px]" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
