import { useEffect, useRef, useState } from "react";

/**
 * Keeps `onFit` current with how an element's width compares to a fixed width,
 * and returns a stop function. Lives at module scope so the effect's return
 * value is one shape on every path.
 */
function observeFit(el: HTMLElement, ratioWidth: number, onFit: (fit: number) => void): () => void {
  const update = () => onFit(el.clientWidth / ratioWidth);
  update();
  const observer = new ResizeObserver(update);
  observer.observe(el);
  return () => observer.disconnect();
}

/**
 * How much the full-size composition has to shrink to fit its pane.
 *
 * The preview renders the composition at its true pixel size and scales it by
 * this factor, so the visitor sees the whole cover whatever the pane's width.
 * The ratio's width changes what "full size" means, so the effect re-runs when
 * it does; the wrapper element is owned here and handed back for the caller to
 * attach to the pane.
 */
export function useFitScale(ratioWidth: number) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState(1);

  useEffect(() => {
    const el = wrapperRef.current;
    if (el === null) return () => undefined;
    return observeFit(el, ratioWidth, setFit);
  }, [ratioWidth]);

  return { fit, wrapperRef };
}
