import { useEffect, useState } from "react";

import { searchLucide, type LucideSet } from "@/tools/cover-generator/core/icons";

/**
 * The lucide chunk, loaded once, and the pure filter over it.
 *
 * The icon set is a same-origin chunk (`@iconify-json/lucide/icons.json`,
 * ~0.6 MB / 1853 icons) fetched once by dynamic import; the search is a pure
 * filter over the bundled index. This hook is a read side: it returns the loaded
 * set, the query and the results, and the component turns a chosen name into
 * `set({ icon })` — the hook never writes the composition, which keeps the
 * dependency graph one-way.
 */
export function useLucideIcons() {
  const [iconSet, setIconSet] = useState<LucideSet | null>(null);
  const [iconQuery, setIconQuery] = useState("");

  useEffect(() => {
    let live = true;
    void import("@iconify-json/lucide/icons.json").then((module) => {
      if (!live) return;
      setIconSet(module.default);
    });
    return () => {
      live = false;
    };
  }, []);

  const results = iconSet === null ? [] : searchLucide(iconSet, iconQuery);

  return { iconSet, iconQuery, setIconQuery, results };
}
