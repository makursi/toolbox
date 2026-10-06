/**
 * The sentences that explain a disabled control, and why the system-font list is
 * empty.
 *
 * A disabled control says which step is missing, in words that change with the
 * state rather than one generic line (`apps/web/docs/design/components.md`), and
 * the words come from here — the Tool's own copy layer, the way `failures.ts` keeps
 * the refusal sentences and the Image Converter's `core/hints.ts` keeps its
 * convert-button hints. They live in the pure half so a test holds the wording.
 *
 * #129 and #130 wrote three of these inline in the component and recorded them as
 * owed to this round's consistency pass, because their own scope forbade touching
 * `core/`. This is that pass: the sentences moved here, the component reads them,
 * and the tests below hold them — including the one property the component cannot
 * show by itself, that two states disabling one control read *differently*.
 */

/** The browser has no Local Font Access API (not Chromium, or denied at launch). */
export function systemFontsUnsupported(): string {
  return "此浏览器不支持读取系统字体。";
}

/** The API exists but the visitor refused permission. */
export function systemFontsDenied(): string {
  return "读取系统字体被拒绝。";
}

/**
 * Why the background's post-processing controls are disabled, or `null` when they
 * are not.
 *
 * Two states disable them and they are **different missing steps**, so they read
 * differently: one has a background but the visitor asked for it not to be
 * processed, the other has none to process. A single sentence covering both would
 * be the generic line the rule exists to prevent.
 */
export function backgroundProcessingReason(state: {
  transparent: boolean;
  hasBackground: boolean;
}): string | null {
  if (state.transparent) return "「背景透明」打开时不处理背景图，先关掉它。";
  if (!state.hasBackground) return "先加一张背景图，模糊与灰度才有作用。";
  return null;
}

/** Why the icon colour field is disabled, or `null` when it is not. */
export function iconColorReason(colorSync: boolean): string | null {
  return colorSync ? "「颜色同步」打开时，图标颜色跟随文字颜色。" : null;
}

/**
 * Why the system-font picker is disabled, or `null` when it is not.
 *
 * Silent while `hint` is set: that sentence already carries the reason (the API is
 * missing, or permission was refused), and two explanations for one disabled
 * control is one too many.
 */
export function systemFontPickerReason(state: {
  hasList: boolean;
  hint: string | null;
}): string | null {
  if (state.hasList || state.hint !== null) return null;
  return "还没读取系统字体，先按「获取系统字体」。";
}
