import { useState } from "react";

import { refuseBackgroundImage } from "@/tools/cover-generator/core/failures";
import { backgroundTooBig } from "@/tools/cover-generator/core/limits";
import {
  createDefaultComposition,
  updateComposition,
  type Composition,
} from "@/tools/cover-generator/core/state";
import { readAsDataUrl } from "@/tools/cover-generator/read-data-url";

/**
 * The composition itself: what a cover contains at this moment.
 *
 * This hook is the single writer of the composition. Every other hook in this
 * Tool is a read side — it loads icons or fonts or fits the canvas — and none of
 * them imports this one; the component bridges their results back through the
 * `set` returned here. That keeps the dependency graph one-way and the merge in
 * one place (`updateComposition`, which returns the same reference when nothing
 * changed so a control reporting its own value back costs no render).
 *
 * The background upload lives here too, because a background image is one field
 * of the composition plus one refusal sentence — it has no lifecycle of its own,
 * so a dedicated hook would over-split.
 */
export function useCoverComposition() {
  const [composition, setComposition] = useState<Composition>(createDefaultComposition);
  const [bgRefusal, setBgRefusal] = useState<string | null>(null);

  const set = (patch: Partial<Composition>) =>
    setComposition((previous) => updateComposition(previous, patch));

  async function uploadBackground(file: File | null) {
    if (file === null) return;
    if (backgroundTooBig(file.size)) {
      setBgRefusal(refuseBackgroundImage(file.size));
      return;
    }
    const url = await readAsDataUrl(file);
    setBgRefusal(null);
    set({ backgroundImage: url });
  }

  return { composition, set, bgRefusal, uploadBackground };
}
