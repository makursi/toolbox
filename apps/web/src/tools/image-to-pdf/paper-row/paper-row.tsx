"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PAPERS, type Paper } from "@/tools/image-to-pdf/core/geometry";
import { originalSizeHint, paperHeading, paperLabels } from "@/tools/image-to-pdf/core/hints";

/**
 * The page-size row: A4, Letter, 原始尺寸, one of them chosen.
 *
 * It is built on the vendored single-select toggle group, which renders a
 * `role="radiogroup"` whose items are real `<button role="radio">` elements, so
 * the row reads as one choice to a screen reader and only the checked item is a
 * Tab stop. Each item carries `.touch-target` itself: an overlay on the group
 * would become the click target and leave the row dead to a pointer.
 *
 * Selected state is border, weight and surface, never colour: the site's only
 * colour semantics is error. The vendored variant already gives the selected
 * item a surface; the two classes below add the ink border and the weight, in
 * both colour schemes.
 *
 * The explanation of 原始尺寸 sits beside the choices rather than behind a
 * tooltip, because it is the one phrase on the page that reads as paper to some
 * visitors and as pixels to others.
 */

/** The paper one arrow key asks for, wrapped at both ends. */
function paperInDirection(paper: Paper, key: string): Paper | null {
  const direction =
    key === "ArrowRight" || key === "ArrowDown"
      ? 1
      : key === "ArrowLeft" || key === "ArrowUp"
        ? -1
        : 0;

  if (direction === 0) return null;

  const index = PAPERS.indexOf(paper);
  return PAPERS[(index + direction + PAPERS.length) % PAPERS.length] ?? paper;
}

export function PaperRow({
  paper,
  disabled,
  onChange,
}: {
  paper: Paper;
  disabled: boolean;
  onChange: (paper: Paper) => void;
}) {
  return (
    <section data-slot="pdf-paper">
      <h2 className="text-[18px] leading-[1.45] font-semibold" id="pdf-paper-heading">
        {paperHeading}
      </h2>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <ToggleGroup
          aria-describedby="pdf-paper-hint"
          aria-labelledby="pdf-paper-heading"
          className="w-full sm:w-auto"
          disabled={disabled}
          onKeyDown={(event) => {
            // Radix's toggle group moves focus with the arrow keys; a radio
            // group changes the choice with them, so the row does both. The
            // group is one Tab stop because only the checked item is focusable.
            const next = paperInDirection(paper, event.key);
            if (next === null) return;
            event.preventDefault();
            if (next !== paper) onChange(next);
          }}
          onValueChange={(value) => {
            // A click on the checked item asks the group to clear its value.
            // This row is single-select and always has exactly one choice, so
            // the empty value is not a state it has: keep the current paper.
            const choice = PAPERS.find((one) => one === value);
            if (choice === undefined || choice === paper) return;
            onChange(choice);
          }}
          spacing={2}
          type="single"
          value={paper}
          variant="outline"
        >
          {PAPERS.map((choice) => (
            <ToggleGroupItem
              className="touch-target h-11 flex-1 data-[state=on]:border-primary data-[state=on]:font-semibold data-[state=on]:hover:text-foreground"
              key={choice}
              value={choice}
            >
              {paperLabels[choice]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <p className="text-sm leading-[1.45] text-muted-foreground" id="pdf-paper-hint">
          {originalSizeHint}
        </p>
      </div>
    </section>
  );
}
