#!/usr/bin/env node
/**
 * The one source rule no linter in this repo can express.
 *
 * `apps/web/docs/design/motion.md` forbids a `scroll` listener on `window`: it
 * is the doorway a scroll-driven animation comes in through. Oxlint has no
 * `no-restricted-syntax` (checked against its rule table), so the rule is
 * enforced here — a text scan of the App's source, one pattern, `file:line` on
 * a hit and exit 1.
 *
 * It reads text rather than an AST, which is enough because the rule names a
 * literal event name: a computed one is not the pattern.
 */
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOURCE = join(ROOT, "apps", "web", "src");
const PATTERN = /window\.addEventListener\(\s*["']scroll["']/;
// A line that only explains the rule is not a violation: the file that records
// this ban quotes the call it bans, and so does the doc it points at.
const COMMENT = /^\s*(?:\/\/|\/\*|\*)/;
const EXTENSIONS = new Set([".ts", ".tsx", ".mjs", ".js", ".jsx"]);

function* sources(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      yield* sources(path);
    } else if (EXTENSIONS.has(extname(entry.name))) {
      yield path;
    }
  }
}

const hits = [];
for (const file of sources(SOURCE)) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, index) => {
    if (!COMMENT.test(line) && PATTERN.test(line)) {
      hits.push(
        `${relative(ROOT, file).split(sep).join("/")}:${index + 1}  a scroll listener on window`,
      );
    }
  });
}

if (hits.length > 0) {
  for (const hit of hits) console.error(hit);
  console.error(
    `\n${hits.length} banned call(s). A scroll listener on \`window\` is forbidden by apps/web/docs/design/motion.md.`,
  );
  process.exit(1);
}

console.log(`no banned calls in ${relative(ROOT, SOURCE).split(sep).join("/")}`);
