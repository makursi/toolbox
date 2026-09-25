/**
 * The four ratio presets and their pixel bases, decided in issue #50. The 4:3
 * base (1320×990) is the same size as the site's own Tool Card covers
 * (`apps/web/docs/design/assets.md`), so this Tool can produce the site's covers
 * too — a side benefit, not the reason it exists.
 */
export type Ratio = {
  key: string;
  width: number;
  height: number;
};

export const ratios = [
  { key: "1:1", width: 1080, height: 1080 },
  { key: "4:3", width: 1320, height: 990 },
  { key: "16:9", width: 1280, height: 720 },
  { key: "21:9", width: 2560, height: 1080 },
] as const satisfies readonly Ratio[];

/** The ratio a fresh page starts on. */
export const DEFAULT_RATIO = "16:9";

export function ratioByKey(key: string): Ratio | undefined {
  return ratios.find((ratio) => ratio.key === key);
}

/**
 * The caption a visitor reads next to a ratio: `1280×720`. The multiplication
 * sign is the character the UI shows; a ratio a visitor cannot have selected
 * renders nothing.
 */
export function pixelCaption(key: string): string {
  const ratio = ratioByKey(key);
  return ratio === undefined ? "" : `${ratio.width}×${ratio.height}`;
}
