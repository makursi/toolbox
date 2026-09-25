/**
 * The icon system (ticket #54): the lucide set shipped as a same-origin chunk
 * (`@iconify-json/lucide/icons.json`, 0.61 MB / 1853 icons), searched by a pure
 * filter, rendered as inline SVG. Library icons take the text colour; uploaded
 * icons keep their own. The site's own Phosphor mechanism (ADR-0009) is
 * untouched — this picker is the Tool's input model (ADR-0014, issue #50).
 */

/** The shape of `@iconify-json/lucide/icons.json` that this Tool reads. */
export type LucideSet = {
  prefix: string;
  width?: number;
  height?: number;
  icons: Record<string, { body: string; width?: number; height?: number }>;
  aliases?: Record<string, { parent: string }>;
};

export type ResolvedLucideIcon = { body: string; width: number; height: number };

function canonical(name: string): string {
  return name.toLowerCase();
}

/** Every searchable name: real icons first, then aliases. */
export function lucideIndex(set: LucideSet): string[] {
  return [...Object.keys(set.icons), ...Object.keys(set.aliases ?? {})];
}

/**
 * The search over the bundled index: names and aliases matching the query as a
 * case-insensitive substring, capped so a broad query stays readable.
 */
export function searchLucide(set: LucideSet, query: string, limit = 50): string[] {
  const needle = canonical(query.trim());
  if (needle === "") return lucideIndex(set).slice(0, limit);
  return lucideIndex(set)
    .filter((name) => canonical(name).includes(needle))
    .slice(0, limit);
}

/** An alias resolves to its parent's body and metrics; an icon resolves to itself. */
export function resolveLucideIcon(set: LucideSet, name: string): ResolvedLucideIcon | undefined {
  const metrics = (width?: number, height?: number) => ({
    width: width ?? set.width ?? 24,
    height: height ?? set.height ?? 24,
  });

  const direct = set.icons[name];
  if (direct !== undefined) {
    return { body: direct.body, ...metrics(direct.width, direct.height) };
  }

  const alias = set.aliases?.[name];
  if (alias === undefined) return undefined;
  const parent = set.icons[alias.parent];
  if (parent === undefined) return undefined;
  return { body: parent.body, ...metrics(parent.width, parent.height) };
}
