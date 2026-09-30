import { useEffect, useRef, useState } from "react";

/**
 * Keeps `onFit` and `onHeight` current with an element's width and its own outer
 * height, and returns a stop function. Lives at module scope so the effect's return
 * value is one shape on every path.
 *
 * `clientWidth` is the pane's inside — borders excluded — which is what the
 * composition is drawn into. The height is read off the element instead of derived
 * from the fit, because the pane's border is part of the box a sticky neighbour has
 * to clear: deriving it from `clientWidth` left the cover generator's tab row 2px
 * inside the preview it follows.
 */
function observeFit(
  el: HTMLElement,
  ratioWidth: number,
  onFit: (fit: number) => void,
  onHeight: (height: number) => void,
): () => void {
  const update = () => {
    onFit(el.clientWidth / ratioWidth);
    onHeight(Math.ceil(el.getBoundingClientRect().height));
  };
  update();
  const observer = new ResizeObserver(update);
  observer.observe(el);
  return () => observer.disconnect();
}

/**
 * How much the full-size composition has to shrink to fit its pane, and how tall
 * that pane ends up being.
 *
 * The preview renders the composition at its true pixel size and scales it by the
 * factor, so the visitor sees the whole cover whatever the pane's width. The ratio's
 * width changes what "full size" means, so the effect re-runs when it does; the
 * wrapper element is owned here and handed back for the caller to attach to the pane.
 * The height is the pane's own, for the things that have to sit clear of it.
 */
export function useFitScale(ratioWidth: number) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState(1);
  const [paneHeight, setPaneHeight] = useState(0);

  useEffect(() => {
    const el = wrapperRef.current;
    if (el === null) return () => undefined;
    return observeFit(el, ratioWidth, setFit, setPaneHeight);
  }, [ratioWidth]);

  return { fit, paneHeight, wrapperRef };
}
