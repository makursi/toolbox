/**
 * The README is one document in two languages: `README.md` is the English
 * original, `README.zh-CN.md` is its Chinese translation. The failure mode of a
 * translation is that it quietly stops tracking the original — the file is long,
 * the diff that would have caught it is small, and nobody re-reads both.
 *
 * Nothing here reads the prose: a translation is *supposed* to differ there.
 * What is compared is what a translation has no licence to change:
 *
 *   - the heading structure — the same number of headings at the same levels,
 *     in the same order (their text differs by definition);
 *   - every fenced block that names a language, byte for byte. A block with an
 *     info string holds commands or values (`bash`, `json`) and must not drift;
 *     a bare fence is a picture of text — the directory tree — whose labels are
 *     prose, so those are exempt;
 *   - links and inline code spans, as multisets. Both languages write paths,
 *     command names and flags as code, so a command or a path added to one file
 *     and not to the other lands here.
 *
 * The one link allowed to differ is the language switch at the top of each file,
 * which by construction points at the other README — and whose presence in both
 * files is checked, since deleting it is otherwise invisible.
 *
 * Run with `pnpm check:readme`; CI runs it too.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const documents = ["README.md", "README.zh-CN.md"].map((name) => ({
  name,
  markdown: readFileSync(resolve(root, name), "utf8"),
}));
const [en, zh] = documents;

/**
 * A document split into its fenced blocks and the prose between them, so that a
 * `#` inside a block is not read as a heading and a path inside one is not read
 * as an inline code span.
 */
function splitDocument(markdown) {
  const prose = [];
  const blocks = [];
  let open = null;

  for (const line of markdown.split("\n")) {
    const fence = /^(`{3,}|~{3,})(.*)$/.exec(line);
    if (open === null && fence !== null) {
      open = { marker: fence[1][0], length: fence[1].length, info: fence[2].trim(), body: [] };
      continue;
    }
    if (
      open !== null &&
      fence !== null &&
      fence[1][0] === open.marker &&
      fence[1].length >= open.length &&
      fence[2].trim() === ""
    ) {
      blocks.push({ info: open.info, body: open.body.join("\n") });
      open = null;
      continue;
    }
    (open === null ? prose : open.body).push(line);
  }

  if (open !== null) throw new Error("unclosed code fence");
  return { prose: prose.join("\n"), blocks };
}

const headingLevels = (prose) =>
  [...prose.matchAll(/^(#{1,6})\s/gm)].map((match) => match[1].length);

/** The switch link is the one target that must differ between the two files. */
const isLanguageSwitch = (target) => /^\.?\/?README(\.[\w-]+)?\.md$/.test(target);

const links = (prose) =>
  [...prose.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)]
    .map((match) => match[1])
    .filter((target) => !isLanguageSwitch(target));

const inlineCode = (prose) => [...prose.matchAll(/`([^`]+)`/g)].map((match) => match[1]);

const taggedBlocks = (blocks) =>
  blocks.filter((block) => block.info !== "").map((block) => `${block.info}\n${block.body}`);

const showValue = (value) => (value === undefined ? "(missing)" : JSON.stringify(value));

const showValues = (values) =>
  values.length > 8
    ? `${values.slice(0, 8).map(showValue).join(", ")}, …and ${values.length - 8} more`
    : values.map(showValue).join(", ");

/** What is in `from` and not in `against`, counted rather than searched for. */
function difference(from, against) {
  const remaining = [...against];
  const extra = [];
  for (const value of from) {
    const index = remaining.indexOf(value);
    if (index === -1) extra.push(value);
    else remaining.splice(index, 1);
  }
  return extra;
}

const problems = [];

/** In order: the same entries, in the same positions. */
function compareSequences(aspect, left, right) {
  if (JSON.stringify(left) === JSON.stringify(right)) return;

  if (left.length !== right.length) {
    problems.push(`${aspect}: ${en.name} has ${left.length}, ${zh.name} has ${right.length}`);
  }
  let reported = 0;
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    if (left[index] === right[index]) continue;
    if (reported === 5) {
      problems.push(`  ${aspect}: …and more`);
      break;
    }
    problems.push(
      `  ${aspect}[${index}]: ${en.name} ${showValue(left[index])} — ${zh.name} ${showValue(right[index])}`,
    );
    reported++;
  }
}

/** As a multiset: the same entries, wherever they appear in the document. */
function compareMultisets(aspect, left, right) {
  const onlyInEn = difference(left, right);
  const onlyInZh = difference(right, left);
  if (onlyInEn.length > 0) problems.push(`${aspect} only in ${en.name}: ${showValues(onlyInEn)}`);
  if (onlyInZh.length > 0) problems.push(`${aspect} only in ${zh.name}: ${showValues(onlyInZh)}`);
}

const enDocument = splitDocument(en.markdown);
const zhDocument = splitDocument(zh.markdown);

compareSequences("headings", headingLevels(enDocument.prose), headingLevels(zhDocument.prose));
compareSequences("code blocks", taggedBlocks(enDocument.blocks), taggedBlocks(zhDocument.blocks));
compareMultisets("links", links(enDocument.prose), links(zhDocument.prose));
compareMultisets("inline code", inlineCode(enDocument.prose), inlineCode(zhDocument.prose));

for (const [document, target] of [
  [en, `./${zh.name}`],
  [zh, `./${en.name}`],
]) {
  if (!document.markdown.includes(`](${target})`)) {
    problems.push(`${document.name} has no link to ${target}`);
  }
}

if (problems.length > 0) {
  // oxlint-disable-next-line no-console -- a check's whole output is its result.
  console.error(
    `${en.name} and ${zh.name} are out of step — a change in one needs its counterpart in the other:\n\n` +
      problems.map((problem) => `  ${problem}`).join("\n"),
  );
  process.exit(1);
}

// oxlint-disable-next-line no-console -- a check's whole output is its result.
console.log(
  `${en.name} and ${zh.name} agree: ` +
    `${headingLevels(enDocument.prose).length} headings, ` +
    `${taggedBlocks(enDocument.blocks).length} code blocks, ` +
    `${links(enDocument.prose).length} links, ` +
    `${inlineCode(enDocument.prose).length} inline code spans.`,
);
