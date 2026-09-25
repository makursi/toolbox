/**
 * The composition state: what a cover contains at this moment. Pure and
 * browser-free, so `pnpm test` can hold it — the component renders from it and
 * writes back through `updateComposition`.
 */
export type CompositionIcon =
  | { source: "lucide"; name: string }
  | { source: "upload"; url: string };

/** Which of the three elements a shadow reaches. */
export type ShadowScope = "none" | "all" | "text" | "icon";

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
  fontFamily: string | null;
  fontSize: number;
  iconSize: number;
  iconRadius: number;
  spacing: number;
  proportional: boolean;
  colorSync: boolean;
  textColor: string;
  iconColor: string;
  bgColor: string;
  shadowScope: ShadowScope;
  shadowColor: string;
  filename: string;
  transparent: boolean;
};

/** The proportions a size change carries with it under 等比缩放. */
export function proportionalSizes(fontSize: number): { iconSize: number; spacing: number } {
  return { iconSize: fontSize, spacing: Math.round((fontSize * 20) / 64) };
}

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
    fontFamily: null,
    fontSize: 64,
    iconSize: 64,
    iconRadius: 0,
    spacing: 20,
    proportional: false,
    colorSync: true,
    textColor: "#000000",
    iconColor: "#000000",
    bgColor: "#ffffff",
    shadowScope: "none",
    shadowColor: "#000000",
    filename: "",
    transparent: false,
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
