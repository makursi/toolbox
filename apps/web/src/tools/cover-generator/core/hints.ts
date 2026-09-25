/**
 * The sentences that explain why the system-font list is empty.
 *
 * Local Font Access is Chromium-only, and the visitor deserves a reason rather
 * than a dead button. These live in the pure half so a test holds the wording,
 * the way `failures.ts` keeps the refusal sentences and the Image Converter's
 * `core/hints.ts` keeps its convert-button hints.
 */

/** The browser has no Local Font Access API (not Chromium, or denied at launch). */
export function systemFontsUnsupported(): string {
  return "此浏览器不支持读取系统字体。";
}

/** The API exists but the visitor refused permission. */
export function systemFontsDenied(): string {
  return "读取系统字体被拒绝。";
}
