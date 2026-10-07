#!/usr/bin/env node
/**
 * Each instrument under `apps/web/scripts/` keeps one pointer line at the top of
 * its file, naming the Design doc module that owns its rules (`rulesModule`
 * below). The pointer is what a reader of a 1800-line script is left with, and a
 * pointer is exactly the kind of sentence that rots: a script is renamed, or the
 * module moves, and nothing says so.
 *
 * The pointer is pinned: it is the first comment line after the shebang, and it
 * names the module. Nothing further down counts, however many documents it cites
 * — otherwise a header citing the log or an ADR would be read as the pointer and
 * the real one below it would go unchecked.
 *
 * This reads both directions of that pair, once per script:
 *
 *   - the pointer names the module, so a pointer naming something else — an older
 *     module, a citation — is a failure rather than a wrong answer;
 *   - the pointer names a document that exists, so a rename or a delete is a
 *     failure rather than a dangling path;
 *   - that document names the script's own file name, so a script that arrives
 *     without a section is a failure rather than a silence — the direction a
 *     one-way check cannot see, and the one a new instrument would slip through.
 *
 * The anchor is not read: `#touch-targets` is accepted without being resolved,
 * because an anchor breaks on a heading rename for reasons that say nothing
 * about whether the text is still true.
 *
 * `--falsify` proves the check can go red. It is in memory and writes no file:
 * the audit takes the scripts and a document reader as arguments, so an
 * injection is one array different from the one on disk. It injects (a) a pointer
 * naming a document that does not exist and (b) a script the document does not
 * mention, requires each injection to produce the failure it stands for, and then
 * requires the untouched tree to come back green. An injection that leaves its
 * claim green exits 1, the way the hit-area instrument's own `--falsify` does.
 *
 * Run with `pnpm check:docs`; CI runs it and its falsification mode.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const instrumentsDirectory = "apps/web/scripts";

/**
 * The one module that owns every instrument's rules. Renaming or moving it is a
 * change to this line and to the four pointers that name it — nothing else in the
 * tree is asked to find them.
 */
const rulesModule = "apps/web/docs/design/instruments.md";

/**
 * The pointer is the first comment line after the shebang: the first line that is
 * neither the shebang nor blank, which has to be a comment naming a markdown
 * document. Nothing below it counts, however many documents those lines name —
 * the headers further down cite the log and the ADRs too, and a citation is not a
 * pointer.
 */
function pointerOf(source) {
  const lines = source.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (line === "" || line.startsWith("#!")) continue;
    if (!line.startsWith("//")) return null;
    const match = /([\w./-]+\.md)(#[\w-]+)?/.exec(line);
    return match === null ? null : { document: match[1], line: index + 1 };
  }
  return null;
}

/** One script, with the document its pointer names swapped for another. */
function pointedAt(script, document) {
  const pointer = pointerOf(script.source);
  if (pointer === null) throw new Error(`${script.name} has no pointer line to rewrite`);
  const lines = script.source.split("\n");
  lines[pointer.line - 1] = lines[pointer.line - 1].replace(pointer.document, document);
  return { ...script, source: lines.join("\n") };
}

/**
 * One pass over the scripts. `read` returns a document's text, or `undefined`
 * when there is no such file, so an injected pointer is checked without a
 * temporary file on disk.
 */
function audit(scripts, read) {
  const problems = [];
  for (const script of scripts) {
    const file = `${instrumentsDirectory}/${script.name}`;
    const pointer = pointerOf(script.source);
    if (pointer === null) {
      problems.push(`${file} names no document — its rules have nowhere to be read`);
      continue;
    }
    const document = read(pointer.document);
    if (document === undefined) {
      problems.push(`${file} points at ${pointer.document}, which does not exist`);
      continue;
    }
    if (pointer.document !== rulesModule) {
      problems.push(
        `${file} points at ${pointer.document}, not at ${rulesModule} — the pointer names the module that owns the rules`,
      );
      continue;
    }
    if (!document.includes(script.name)) {
      problems.push(
        `${pointer.document} never names ${file} — the document that owns a script's rules names the script back`,
      );
    }
  }
  return problems;
}

const scripts = readdirSync(resolve(root, instrumentsDirectory), { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
  .map((entry) => entry.name)
  .toSorted()
  .map((name) => ({
    name,
    source: readFileSync(resolve(root, instrumentsDirectory, name), "utf8"),
  }));

const documents = new Map();

function readDocument(document) {
  if (!documents.has(document)) {
    try {
      documents.set(document, readFileSync(resolve(root, document), "utf8"));
    } catch {
      // A path a pointer names is allowed to be absent: that is the failure the
      // audit reports, not a crash.
      documents.set(document, undefined);
    }
  }
  return documents.get(document);
}

/** A check's whole output is its result. */
// oxlint-disable-next-line no-console -- a check's whole output is its result.
const say = (message) => console.log(message);

function report(problems) {
  // oxlint-disable-next-line no-console -- a check's whole output is its result.
  console.error(
    `the instruments' pointers are not true — each script under ${instrumentsDirectory}/ names the document that owns its rules, and that document names the script:\n\n` +
      problems.map((problem) => `  ${problem}`).join("\n"),
  );
}

const missingDocument = "apps/web/docs/design/instruments-missing.md";

/**
 * The two injections, each required to produce the failure it stands for.
 * `inject` takes the loaded scripts and returns a different array; nothing here
 * touches the tree on disk.
 */
const injections = [
  {
    claim: "a pointer naming a document that does not exist",
    inject: (loaded) => loaded.map((script) => pointedAt(script, missingDocument)),
    expect: (problems, loaded) =>
      problems.length === loaded.length &&
      problems.every((problem) => problem.includes(missingDocument)),
  },
  {
    claim: "a script the document does not mention",
    inject: (loaded) => [
      ...loaded,
      {
        name: "not-yet-an-instrument.mjs",
        source:
          "// The rules this script implements are in apps/web/docs/design/instruments.md#not-yet-an-instrument.\n",
      },
    ],
    expect: (problems) =>
      problems.some(
        (problem) =>
          problem.includes("not-yet-an-instrument.mjs") && problem.includes("never names"),
      ),
  },
];

function falsify() {
  say("Falsification run — the check's own claims, injected one at a time");

  const baseline = audit(scripts, readDocument);
  if (baseline.length > 0) {
    report(baseline);
    say("");
    say("FALSIFICATION FAILURE: the tree is already red, so an injection proves nothing");
    process.exitCode = 1;
    return;
  }
  say(`  green — the tree as it is, ${scripts.length} pointers checked in both directions`);

  let failures = 0;
  for (const injection of injections) {
    const problems = audit(injection.inject(scripts), readDocument);
    const red = injection.expect(problems, scripts);
    if (!red) failures++;
    say(`  ${red ? "red" : "STILL GREEN"} — ${injection.claim} (${problems.length} problem(s))`);
  }

  const after = audit(scripts, readDocument);
  if (after.length > 0) {
    failures++;
    report(after);
    say("STILL RED — the tree did not come back green after the injections");
  } else {
    say("  green — the tree as it is, after both injections");
  }

  say(
    failures === 0
      ? "\nALL FALSIFIED — every injection turned its claim red, and the tree came back green"
      : `\n${failures} FALSIFICATION FAILURE(S)`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

if (process.argv.slice(2).includes("--falsify")) {
  falsify();
} else {
  const problems = audit(scripts, readDocument);
  if (problems.length > 0) {
    report(problems);
    process.exit(1);
  }
  say(
    `${scripts.length} instruments point at a document that names them back: ` +
      `${scripts.map((script) => script.name).join(", ")}.`,
  );
}
