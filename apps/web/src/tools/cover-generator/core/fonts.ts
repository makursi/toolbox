/**
 * The system-font match rule: a case-insensitive substring match, mirroring the
 * icon search in `icons.ts`. The list itself comes from the browser's Local
 * Font Access; this module is just the pure rule that decides whether a family
 * matches a query, so it is test-held like the rest of the core layer.
 */

/** Lowercase once, so a query and a family compare on equal footing. */
function canonical(text: string): string {
  return text.toLowerCase();
}

/** Case-insensitive: does `family` contain `query` as a substring? */
export function matchesFont(family: string, query: string): boolean {
  return canonical(family).includes(canonical(query.trim()));
}
