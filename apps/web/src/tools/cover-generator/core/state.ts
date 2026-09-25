/**
 * The composition state: what a cover contains at this moment. Pure and
 * browser-free, so `pnpm test` can hold it — the component renders from it and
 * writes back through `updateComposition`. The style sliders (sizes, spacing,
 * colours, shadow) arrive in a later slice (#59) and extend this shape.
 */
export type CompositionIcon =
  | { source: "lucide"; name: string }
  | { source: "upload"; url: string };

export type Composition = {
  leftText: string;
  rightText: string;
  weight: number;
  ratioId: string;
  icon: CompositionIcon | null;
  iconVisible: boolean;
  iconBackground: boolean;
  backgroundImage: string | null;
  backgroundOpacity: number;
};

/** The sample layout a visitor starts from — real copy, not invented content. */
export function createDefaultComposition(): Composition {
  return {
    leftText: "示例",
    rightText: "文本",
    weight: 400,
    ratioId: "16:9",
    icon: { source: "lucide", name: "image" },
    iconVisible: true,
    iconBackground: false,
    backgroundImage: null,
    backgroundOpacity: 1,
  };
}

/**
 * One field at a time. Returns the same reference when nothing changes, which
 * is what lets the component skip a render when a control reports its own value
 * back.
 */
export function updateComposition(prev: Composition, patch: Partial<Composition>): Composition {
  // Object.keys widens to string[]; the keys really are Composition's, and this
  // is the standard recovery.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const changed = (Object.keys(patch) as (keyof Composition)[]).some(
    (key) => patch[key] !== prev[key],
  );
  return changed ? { ...prev, ...patch } : prev;
}
