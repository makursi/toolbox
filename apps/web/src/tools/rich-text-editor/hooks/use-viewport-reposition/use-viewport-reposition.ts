"use client";

import { useEffect, useReducer } from "react";

/**
 * Re-render a `position: fixed` surface when the page scrolls or the window resizes.
 *
 * Two rows on this page are placed from the document's own coordinates: the toolbar
 * that follows a selection (#207) and the image panel (#218). Both are fixed, so the
 * thing they are placed against moves out from under them the moment the page
 * scrolls, and both therefore need the same signal — a re-render, one per frame.
 *
 * `apps/web/docs/design/motion.md` forbids `window.addEventListener("scroll")` because
 * that is how a scroll-driven animation sneaks in. This listener drives no animation:
 * it is `passive`, it coalesces every scroll in a frame into one render, it listens on
 * the document (this page's scroll container) with capture so a scrolling region
 * inside the page is seen too, and `resize` is the same recomputation for the other
 * input. The caller keeps its own placement arithmetic; this hook only says "look
 * again".
 *
 * The returned value is nothing on purpose: the re-render is the point, and a caller
 * that also read a number would have two reasons to redraw.
 */
export function useViewportReposition(enabled: boolean): void {
  const [, redraw] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    if (!enabled) return undefined;

    let frame = 0;
    const schedule = () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        redraw();
      });
    };

    document.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    };
  }, [enabled]);
}
