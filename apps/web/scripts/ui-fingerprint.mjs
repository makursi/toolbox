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
 * Two limits are written down here so that "identical" is never read as "nothing
 * could have changed". The outline keeps Mantine's own classes (static
 * `mantine-*` names and content-hashed `m_*` ones) and drops every Tailwind
 * utility class, and it reads a fixed list of attributes — so a swap from one
 * utility class to another with the same computed effect is invisible unless it
 * moves something. And the view states are emulated on a page that is already
 * loaded, one navigation per page rather than one per state: the scheme is set,
 * then the read waits out its budget. That is a race this site has never lost,
 * and it is the first suspect if a scheme pair ever differs with nothing else on
 * the page different. Each view state is given 350 ms to settle before its reading
 * is taken.
 *
 * A reading is taken on a page that has **stopped moving**, because the first one
 * after a navigation was not (#111, measured 2026-10-05). Three separate things
 * arrive after the connection layer has said the navigation landed, and each of
 * them changes what the outline reads: the `.reveal` entrance animation is a
 * 12px translate over 600ms, a page that lazily imports something grows when the
 * chunk lands (the cover generator's 50 icon rows are 236px of page), and Next
 * appends its route announcer element on its own schedule. Measured on one
 * unchanged build in one unchanged browser, two runs of `capture` differed at
 * all three of those, and a cold browser profile differed from a warm one on the
 * same build — while the per-view readings 350ms later agreed. So every navigation
 * now waits for stillness: no running CSS animation, the document loaded, and the
 * number of resource entries unchanged across two consecutive samples. It is a
 * wait on the page's own state rather than a longer budget, for the reason the
 * hydration wait gives below, and it fails loudly rather than reading a page that
 * never settles.
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

/** The pages the fingerprint covers. A third Tool is one more line here. */
const PAGES = [
  ["home", "/"],
  ["tool", "/tools/image-converter"],
  ["cover", "/tools/cover-generator"],
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
    // Mantine's module class names are content-hashed and stable across builds, but
    // the hash is seven *or* eight hex characters depending on the component
    // (measured against the installed build: 28 of its 407 are seven), so both
    // lengths are kept. An eight-only pattern dropped those classes from the outline
    // in silence. React's per-instance names are not stable and stay out.
    const classes = [...el.classList]
      .filter((c) => c.startsWith('mantine-') || /^m_[0-9a-f]{7,8}$/.test(c))
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

/**
 * What "this page has stopped moving" means, in one expression: nothing is
 * animating, the document is loaded, and no resource has arrived since the last
 * time this was asked.
 *
 * The three are not the same kind of thing on purpose. The animation is the
 * `reveal` entrance — 12px over 600ms — and a reading taken inside it lands on a
 * fractional offset that `Math.round` flips between runs. The resource count is
 * how a lazily imported chunk is noticed: the cover generator's icon library
 * arrives after mount and its 50 rows are 236px of page. And `readyState` is the
 * cheap half of both.
 *
 * Type is deliberately not part of it: a web font swapping in does not move the
 * boxes this reads, and waiting on `document.fonts` would make the instrument
 * depend on a font loading policy it has no business in.
 */
const STILL = `JSON.stringify({
  animating: document.getAnimations().filter((a) => a.playState === 'running').length,
  ready: document.readyState === 'complete',
  resources: performance.getEntriesByType('resource').length,
})`;

/**
 * Wait for that, rather than sleeping and hoping.
 *
 * Two consecutive equal resource counts is what makes this a wait rather than a
 * snapshot: a single reading of "nothing in flight" is satisfiable by the instant
 * before a chunk is requested. The cap is 40 samples of 100ms — a page still
 * moving after four seconds is a failure with a sentence, not a reading of a page
 * mid-flight, and a silent longer wait would turn a defect into a slow pass. That
 * the whole matrix is unchanged is the other half of the decision: this adds a
 * wait before a reading, it does not move a viewport, a scheme or a budget.
 */
const SETTLE_ATTEMPTS = 40;
const SETTLE_INTERVAL_MS = 100;

async function settle(client) {
  let previousResources = null;
  for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt++) {
    const sample = JSON.parse(await client.evaluate(STILL));
    if (
      sample.ready &&
      sample.animating === 0 &&
      previousResources !== null &&
      sample.resources === previousResources
    ) {
      return;
    }
    previousResources = sample.resources;
    await new Promise((resolve) => setTimeout(resolve, SETTLE_INTERVAL_MS));
  }
  throw new Error(
    `the page never settled: ${SETTLE_ATTEMPTS} samples of ${SETTLE_INTERVAL_MS}ms without a still document — a reading taken while the page is still moving is not a reading`,
  );
}

async function capture(baseUrl, outFile) {
  const port = Number(process.env.CDP_PORT ?? 9333);
  const client = await connect(port);
  const fingerprint = {};

  try {
    for (const [name, path] of PAGES) {
      // The page-level outline is taken at a fixed viewport *and* a fixed colour
      // scheme. Both halves used to be inherited: the viewport read as a difference
      // in the first comparison that ran after a mobile-width pass, and the scheme
      // was still inherited from the page before, because the loop below sets its
      // media after a page has loaded (#105).
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: 1280,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await client.send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-color-scheme", value: SCHEMES[0] }],
      });
      // Navigating through the shared connection layer is what refuses a page that
      // never arrived — and what replaces the 1800 ms sleep that used to be the only
      // thing between a dead server and a fingerprint of its error page (ADR-0015).
      await client.navigate(`${baseUrl}${path}`);
      // Everything below reads a page that has stopped moving; see `settle`.
      await settle(client);

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

    // Both files' view states, not only the "before" file's: a state that exists in
    // "after" alone used to be skipped in silence (#105).
    const views = [...new Set([...Object.keys(b.views), ...Object.keys(a.views)])].sort();
    for (const view of views) {
      const bv = b.views[view];
      const av = a.views[view];
      if (!bv || !av) {
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
