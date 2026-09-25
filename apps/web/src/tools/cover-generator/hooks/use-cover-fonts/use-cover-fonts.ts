import { useState } from "react";

import { fontUnreadable, refuseFontFile } from "@/tools/cover-generator/core/failures";
import { systemFontsDenied, systemFontsUnsupported } from "@/tools/cover-generator/core/hints";
import { fontTooBig } from "@/tools/cover-generator/core/limits";
import { sanitizeFileName } from "@/tools/cover-generator/core/naming";

/** The one field of a Local Font Access read that this Tool uses. */
type LocalFontRead = { family: string };

/**
 * The fonts a visitor can put on the cover: an uploaded file, or a family from
 * the machine via Local Font Access.
 *
 * This hook is a read side: it loads a font into `document.fonts` and returns
 * the family to apply (uploaded) or the list of families to choose from
 * (system), and the component writes the choice back through the composition's
 * `set({ fontFamily })`. The refusal and hint sentences come from the pure
 * layer so their wording is test-held.
 */
export function useCoverFonts() {
  const [fontRefusal, setFontRefusal] = useState<string | null>(null);
  const [sysFonts, setSysFonts] = useState<string[]>([]);
  const [sysHint, setSysHint] = useState<string | null>(null);

  /**
   * Upload a font: bytes → FontFace → document fonts. Returns the family to
   * apply, or `null` when the file was refused or would not load (in both cases
   * the refusal sentence is set here, not returned).
   */
  async function uploadFont(file: File | null): Promise<string | null> {
    if (file === null) return null;
    if (fontTooBig(file.size)) {
      setFontRefusal(refuseFontFile(file.size));
      return null;
    }
    setFontRefusal(null);
    try {
      const bytes = await file.arrayBuffer();
      const family = sanitizeFileName(file.name.replace(/\.[^.]+$/, "")) || "访客字体";
      const face = new FontFace(family, bytes);
      await face.load();
      document.fonts.add(face);
      return family;
    } catch {
      // The browser's own parse error goes to the console only.
      setFontRefusal(fontUnreadable());
      return null;
    }
  }

  /** Local Font Access, graceful where the API does not exist (Chromium only). */
  async function fetchSystemFonts() {
    const query = (window as Window & { queryLocalFonts?: () => Promise<LocalFontRead[]> })
      .queryLocalFonts;
    if (typeof query !== "function") {
      setSysHint(systemFontsUnsupported());
      return;
    }
    try {
      const fonts = await query();
      const families = [...new Set(fonts.map((font) => font.family))];
      // The tsconfig target (ES2022) has no Array#toSorted; the array is a
      // fresh spread, so sorting it mutates nothing shared.
      // oxlint-disable-next-line unicorn/no-array-sort -- see above
      families.sort((a, b) => a.localeCompare(b));
      setSysFonts(families);
      setSysHint(null);
    } catch {
      setSysHint(systemFontsDenied());
    }
  }

  return { fontRefusal, sysFonts, sysHint, uploadFont, fetchSystemFonts };
}
