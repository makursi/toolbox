/**
 * The refusal sentences a visitor reads. They live in the pure layer so a test
 * holds the wording, the way the Image Converter's `finger failures` do; the
 * browser's own errors go to the console only.
 */
import { MAX_BACKGROUND_BYTES, MAX_FONT_BYTES } from "./limits";

export function refuseBackgroundImage(sizeBytes: number): string {
  const megabytes = Math.max(1, Math.ceil(sizeBytes / (1024 * 1024)));
  const limitMb = MAX_BACKGROUND_BYTES / (1024 * 1024);
  return `这个背景图有 ${megabytes} MB，上限是 ${limitMb} MB。`;
}

export function refuseFontFile(sizeBytes: number): string {
  const megabytes = Math.max(1, Math.ceil(sizeBytes / (1024 * 1024)));
  const limitMb = MAX_FONT_BYTES / (1024 * 1024);
  return `这个字体有 ${megabytes} MB，上限是 ${limitMb} MB。`;
}

/** The browser failed to parse the font; its own reason goes to the console. */
export function fontUnreadable(): string {
  return "这个字体文件无法载入。";
}
