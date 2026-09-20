#!/usr/bin/env node
/**
 * The UI fingerprint: a structural snapshot of the pages, and a comparison of
 * two of them.
 *
 * This exists because "nothing changed" is the one claim a refactor makes and
 * the one no other check in this repo can test. `pnpm test` covers the pure
 * modules, `tsc` covers the types, the build covers that it compiles — none of
 * them notice that a component moved and now renders a wrapper element, or that
 * a cover frame lost its width at one breakpoint. So: capture both pages at five
 * widths in both colour schemes before the change, capture them again after, and
 * compare text, links, a DOM outline with geometry, and the computed styles that
 * carry the design tokens.
 *
 * What it deliberately does not cover: end-to-end behaviour (a real file going
 * through a real Worker), console errors, and anything a keyboard or a pointer
 * does. `touch-targets.mjs` is the sibling that does measure one pointer
 * property — the hit area of every `.touch-target` control; the rest were
 * separate one-off scripts, and `apps/web/docs/design/log.md` records what they
 * found.
 *
 * Usage — the Chrome has to be running already, because launching it is the part
 * that differs per machine:
 *
 *   pnpm build && pnpm --filter @toolbox/web start -p 3111
 *   chrome --headless=new --remote-debugging-port=9333 --user-data-dir=<tmp dir>
 *   node scripts/ui-fingerprint.mjs capture http://127.0.0.1:3111 before.json
 *   node scripts/ui-fingerprint.mjs compare before.json after.json
 *
 * `CDP_PORT` overrides the debugging port. Exit code is 1 when a comparison
 * finds a difference, so it can gate a shell chain.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { connect } from "./cdp.mjs";

/** The pages the fingerprint covers. A second Tool is one more line here. */
const PAGES = [
  ["home", "/"],
  ["tool", "/tools/image-converter"],
];

/** Tailwind's `sm` and Mantine's `sm` are different widths, so both are covered. */
const VIEWPORTS = [360, 390, 768, 1024, 1280];
const SCHEMES = ["light", "dark"];

/** A check's whole output is its result, which is the one place a console is right. */
function report(line) {
  // oxlint-disable-next-line no-console -- see above.
  console.log(line);
}

/**
 * The outline: tags, Mantine's classes, the handful of attributes that decide
 * behaviour, the geometry, and an element's own text.
 *
 * Two things it has to get right to be comparable across builds. Mantine's
 * `m_xxxxxxxx` module classes are content-hashed and stable, but the class names
 * React generates per component instance (`__m__-_R_...`) are not, so they are
 * dropped. And text comes from `innerText` rather than `textContent`, because
 * Mantine inlines `<style>` elements inside components and `textContent` would
 * read their CSS as copy.
 */
const OUTLINE = `(() => {
  const skip = new Set(['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT']);
  const lines = [];
  const walk = (el, depth) => {
    if (skip.has(el.tagName)) return;
    const classes = [...el.classList]
      .filter((c) => c.startsWith('mantine-') || /^m_[0-9a-f]{8}$/.test(c))
      .sort();
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    const attrs = ['href', 'download', 'type', 'value', 'aria-checked', 'aria-disabled', 'data-checked']
      .filter((a) => el.hasAttribute(a))
      .map((a) => a + '=' + el.getAttribute(a))
      .join(',');
    const r = el.getBoundingClientRect();
    lines.push(
      '  '.repeat(depth) +
        el.tagName.toLowerCase() +
        (classes.length ? '.' + classes.join('.') : '') +
        (attrs ? '[' + attrs + ']' : '') +
        ' @' + Math.round(r.width) + 'x' + Math.round(r.height) +
        '+' + Math.round(r.x) + '+' + Math.round(r.y) +
        (own ? ' "' + own.slice(0, 40) + '"' : ''),
    );
    for (const child of el.children) walk(child, depth + 1);
  };
  walk(document.body, 0);
  return lines.join('\\n');
})()`;

/** The computed values that come from the design tokens rather than from markup. */
const STYLES = `(() => {
  const pick = (selector, props) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const style = getComputedStyle(el);
    return Object.fromEntries(props.map((p) => [p, style.getPropertyValue(p)]));
  };
  return JSON.stringify({
    paper: pick('.mantine-Paper-root', ['background-color', 'border-radius', 'border-top-color', 'border-top-width', 'padding-top', 'box-shadow']),
    coverFrame: pick('.cover-frame', ['aspect-ratio', 'background-color', 'border-radius', 'margin-left']),
    title: pick('h1', ['font-size', 'font-weight', 'line-height']),
    cardTitle: pick('.mantine-Paper-root p', ['font-size', 'font-weight']),
    footer: pick('footer p', ['font-size', 'color', 'line-height']),
    html: pick('html', ['font-family']),
  });
})()`;

async function capture(baseUrl, outFile) {
  const port = Number(process.env.CDP_PORT ?? 9333);
  const client = await connect(port);
  const fingerprint = {};

  try {
    for (const [name, path] of PAGES) {
      // The page-level outline is taken at a fixed viewport: it used to inherit
      // whatever the previous run left behind, which read as a difference in the
      // first comparison that ran after a mobile-width pass.
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: 1280,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await client.send("Page.navigate", { url: `${baseUrl}${path}` });
      await new Promise((resolve) => setTimeout(resolve, 1800));

      const page = { path, views: {}, outline: await client.evaluate(OUTLINE) };

      for (const width of VIEWPORTS) {
        for (const scheme of SCHEMES) {
          await client.send("Emulation.setDeviceMetricsOverride", {
            width,
            height: 900,
            deviceScaleFactor: 1,
            mobile: width < 768,
          });
          await client.send("Emulation.setEmulatedMedia", {
            features: [{ name: "prefers-color-scheme", value: scheme }],
          });
          await new Promise((resolve) => setTimeout(resolve, 350));

          page.views[`${width}-${scheme}`] = {
            text: await client.evaluate("document.body.innerText"),
            styles: JSON.parse(await client.evaluate(STYLES)),
            links: JSON.parse(
              await client.evaluate(
                `JSON.stringify([...document.querySelectorAll('a')].map((a) => [a.getAttribute('href'), a.innerText.trim().slice(0, 30)]))`,
              ),
            ),
            outline: await client.evaluate(OUTLINE),
          };
          report(`  captured ${name} @${width}-${scheme}`);
        }
      }

      fingerprint[name] = page;
    }
  } finally {
    client.close();
  }

  writeFileSync(outFile, JSON.stringify(fingerprint, null, 2));
  report(`wrote ${outFile}`);
}

/** The first line the two differ on, which is the only part worth printing. */
function firstDifference(before, after) {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  for (let i = 0; i < Math.max(beforeLines.length, afterLines.length); i++) {
    if (beforeLines[i] !== afterLines[i]) {
      return `\n    line ${i + 1}\n      before: ${beforeLines[i] ?? "(nothing)"}\n      after:  ${afterLines[i] ?? "(nothing)"}`;
    }
  }
  return "";
}

function compare(beforeFile, afterFile) {
  const before = JSON.parse(readFileSync(beforeFile, "utf8"));
  const after = JSON.parse(readFileSync(afterFile, "utf8"));
  let differences = 0;

  const check = (name, ok, detail = "") => {
    if (!ok) differences++;
    report(`${ok ? "PASS" : "FAIL"}  ${name}${detail}`);
  };

  for (const [page] of PAGES) {
    const b = before[page];
    const a = after[page];
    if (!b || !a) {
      check(`${page}: captured in both files`, false);
      continue;
    }

    check(
      `${page}: full-page outline is identical`,
      b.outline === a.outline,
      firstDifference(b.outline, a.outline),
    );

    for (const view of Object.keys(b.views)) {
      const bv = b.views[view];
      const av = a.views[view];
      if (!av) {
        check(`${page} @${view}: captured in both files`, false);
        continue;
      }

      check(`${page} @${view}: text is identical`, bv.text === av.text);
      check(
        `${page} @${view}: links are identical`,
        JSON.stringify(bv.links) === JSON.stringify(av.links),
      );
      check(
        `${page} @${view}: outline is identical`,
        bv.outline === av.outline,
        firstDifference(bv.outline, av.outline),
      );
      check(
        `${page} @${view}: computed styles are identical`,
        JSON.stringify(bv.styles) === JSON.stringify(av.styles),
        bv.styles && av.styles && JSON.stringify(bv.styles) !== JSON.stringify(av.styles)
          ? `\n      before: ${JSON.stringify(bv.styles)}\n      after:  ${JSON.stringify(av.styles)}`
          : "",
      );
    }
  }

  report(differences === 0 ? "\nALL IDENTICAL" : `\n${differences} difference(s)`);
  process.exitCode = differences === 0 ? 0 : 1;
}

const [command, ...args] = process.argv.slice(2);

if (command === "capture" && args.length === 2) {
  await capture(args[0], args[1]);
} else if (command === "compare" && args.length === 2) {
  compare(args[0], args[1]);
} else {
  report("usage: ui-fingerprint.mjs capture <baseUrl> <outFile>");
  report("       ui-fingerprint.mjs compare <beforeFile> <afterFile>");
  process.exitCode = 2;
}
