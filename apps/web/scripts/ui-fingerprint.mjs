#!/usr/bin/env node
// The rules this script implements — what it reads, how a Reading is taken, what it does not read, and what makes it exit 1 — are in apps/web/docs/design/instruments.md#ui-fingerprint.
/**
 * The UI fingerprint: a structural snapshot of the pages, and a comparison of
 * two of them.
 *
 * Usage — the Chrome has to be running already, because launching it is the part
 * that differs per machine:
 *
 *   pnpm build && pnpm --filter @toolbox/web start -p 3111
 *   chrome --headless=new --remote-debugging-port=9333 --user-data-dir=<tmp dir>
 *   node scripts/ui-fingerprint.mjs capture http://127.0.0.1:3111 before.json
 *   node scripts/ui-fingerprint.mjs compare before.json after.json
 *
 * `CDP_PORT` overrides the debugging port.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { connect } from "./cdp.mjs";

/**
 * The anchors every page carries, whatever it shows: the shell the layout draws
 * around the page, and the header and footer it puts on either end of it.
 */
const SHELL_ANCHORS = ["page-shell", "site-main", "site-header", "site-footer"];

/**
 * The pages the fingerprint covers, and the anchors each one must carry. A third
 * Tool is one more entry here.
 *
 * The declaration is per page because a page is what can be missing an anchor: an
 * anchor that belongs to the homepage's card is not a gap on the cover
 * generator's page, and a single global list would have to be either too short to
 * notice a gap or wrong on every page that does not render the thing. Each name is
 * the value of a `data-slot` attribute in `apps/web/src`; `anchorSelector` below
 * is the one place a name becomes a selector.
 *
 * `format-card` is the Image Converter's, and it is here because the fingerprint
 * used to read that element through `.mantine-Paper-root` — the first Paper on
 * that page happens to be one — so dropping the library's selector without
 * anchoring the element would have quietly stopped measuring it (#114).
 *
 * Four names go beyond #114's own list, and each is one of that list's regions
 * rather than a new one: `site-main` and `tool-page` are the page shell (the
 * landmark every route renders into, and the container a Tool page shares),
 * `cover-tabs` is the row's own container — without it the row and the three
 * panels have no anchored parent and their nesting is not in the reading — and
 * `cover-tab` is the row's three parts. An anchor is a name for a region, and a
 * region the ticket names is the whole of it, not only its outermost element.
 *
 * Not every page here is a Tool's: the 404 page is the frame's own, and it was
 * added by #161 for the same reason every other page is declared — it is about to
 * change, and an Instrument that cannot address a page cannot say the page did not
 * move. A page is one more entry, whether a Tool or the frame draws it.
 */
const PAGES = [
  {
    anchors: [
      ...SHELL_ANCHORS,
      "tool-card",
      "tool-card-cover",
      "tool-card-title",
      "tool-card-description",
    ],
    name: "home",
    path: "/",
  },
  {
    /*
     * The second Tool's page. `format-card` is its own region and was declared by
     * #114 — the fingerprint used to read that element through `.mantine-Paper-root`,
     * so dropping the library's selector without anchoring the element would have
     * quietly stopped measuring it.
     *
     * `converter-add` and `converter-formats` are #164's: the two regions that batch
     * moved, anchored so that their geometry and their own computed styles are read
     * before and after the move rather than inferred from the page still being the
     * same height. They are regions rather than the whole page on purpose — the file
     * list and the outputs under them are later batches, and an anchor the page
     * carries but this list does not name still shows up in the outline as a
     * difference.
     *
     * `converter-files` and `file-row` are #165's, and they are the reason this page
     * declares a `fileInput`: the file list exists only after a file has been
     * dropped, so a capture that navigated and stopped there would fail on two
     * anchors that cannot be present — which is the rule working, not a gap to paper
     * over. The file is the same one the hit-area Instrument drops (the Tool's own
     * cover, a real JPEG); it goes in after the navigation has settled, the page is
     * settled again before anything is read, and it stays in place for all ten view
     * states of this page. What it is *not* is a second reading of "ready to
     * measure": both halves are the connection layer's (`cdp.mjs`).
     *
     * `output-row` is #166's, and it is why this page also declares `convert`: the
     * results — the row per output, the progress line, the failures — only exist
     * after a Batch has run. One conversion is run per capture (the page is navigated
     * once), and its state holds for all ten view states after it.
     */
    anchors: [
      ...SHELL_ANCHORS,
      "tool-page",
      "format-card",
      "converter-add",
      "converter-formats",
      "converter-files",
      "file-row",
      "output-row",
    ],
    convert: true,
    fileInput: "input[type=file]",
    name: "tool",
    path: "/tools/image-converter",
  },
  {
    anchors: [
      ...SHELL_ANCHORS,
      "tool-page",
      "cover-editor-column",
      "cover-canvas-column",
      "cover-preview-pane",
      "cover-tabs",
      "cover-tab-row",
      "cover-tab",
      // One panel, not three. The three sections are mutually exclusive by design —
      // the row shows exactly one at a time — so only the default one exists in the
      // state this captures, and since #117 the other two are **unmounted** rather
      // than hidden: `cover-panel-style` at 1280 in a light scheme is not a panel
      // that is hidden, it is a panel that is not there. Declaring all three was
      // right while the outgoing library kept every panel element in the DOM, and
      // it would now fail the run on two anchors that cannot be present — which is
      // the rule working, not a hole to fill: an anchor that matches nothing
      // guards nothing, and the two missing ones are covered where they can be,
      // by the Instrument opening each section and asserting its panel is the
      // showing one (`touch-targets.mjs`).
      "cover-panel-content",
    ],
    name: "cover",
    path: "/tools/cover-generator",
  },
  {
    /*
     * The 404 page, which is part of the frame rather than a page of its own: it is
     * what a visitor gets for a URL this site does not serve, and it carries the
     * shell and one thing of its own (#161). It entered this Instrument before the
     * frame moved, which is the ordering rule the round inherits — an Instrument
     * reads what is about to change, and is proved able to fail on it, before the
     * change lands. The path is a URL nothing serves on purpose: the page is the
     * one route Next renders for a miss, so any unrouted path is it.
     *
     * `not-found` is the page's own container, the one anchor it owns; the way home
     * is a control rather than a region and belongs to `touch-targets.mjs`.
     */
    anchors: [...SHELL_ANCHORS, "not-found"],
    name: "not-found",
    path: "/no-such-page",
  },
];

/**
 * How an anchor name becomes a selector — one place, because three readings use
 * it: the outline's walk, the presence check, and the computed-style read. Written
 * here rather than in each of them so a name cannot mean two things.
 */
const anchorSelector = (name) => `[data-slot="${name}"]`;

/** Tailwind's `sm` and Mantine's `sm` are different widths, so both are covered. */
const VIEWPORTS = [360, 390, 768, 1024, 1280];
const SCHEMES = ["light", "dark"];

/** A check's whole output is its result, which is the one place a console is right. */
function report(line) {
  // oxlint-disable-next-line no-console -- see above.
  console.log(line);
}

const OUTLINE = `(() => {
  const skip = new Set(['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT']);
  const lines = [];
  const walk = (el, depth) => {
    if (skip.has(el.tagName)) return;
    const slot = el.getAttribute('data-slot');
    if (slot !== null) {
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
          slot +
          (attrs ? '[' + attrs + ']' : '') +
          ' @' + Math.round(r.width) + 'x' + Math.round(r.height) +
          '+' + Math.round(r.x) + '+' + Math.round(r.y) +
          (own ? ' "' + own.slice(0, 40) + '"' : ''),
      );
    }
    for (const child of el.children) walk(child, slot === null ? depth : depth + 1);
  };
  walk(document.body, 0);
  return lines.join('\\n');
})()`;

const COMPARED_PROPERTIES = [
  // Layout.
  "aspect-ratio",
  "border-top-width",
  "margin-left",
  "padding-top",
  // Colour.
  "background-color",
  "border-bottom-color",
  "border-left-color",
  "border-right-color",
  "border-top-color",
  "color",
  // Typography.
  "font-family",
  "font-size",
  "font-weight",
  "letter-spacing",
  "line-height",
  // Radius.
  "border-bottom-left-radius",
  "border-bottom-right-radius",
  "border-top-left-radius",
  "border-top-right-radius",
];

const stylesReading = (selectors) => `(() => {
  const props = ${JSON.stringify(COMPARED_PROPERTIES)};
  return JSON.stringify(${JSON.stringify(selectors)}.map((selector) => ({
    selector,
    values: [...document.querySelectorAll(selector)].map((el) => {
      const style = getComputedStyle(el);
      return Object.fromEntries(props.map((p) => [p, style.getPropertyValue(p)]));
    }),
  })));
})()`;

const anchorReading = (
  selectors,
) => `JSON.stringify(${JSON.stringify(selectors)}.map((selector) => ({
  selector,
  matched: document.querySelectorAll(selector).length,
})))`;

const FIXTURE = fileURLToPath(
  new URL("../public/tools/image-converter/cover.jpg", import.meta.url),
);

async function convert(client) {
  const pressed = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((el) =>
      (el.innerText || '').trim().startsWith('转换'),
    );
    if (button === undefined) return false;
    const at = { bubbles: true, button: 0, cancelable: true };
    button.dispatchEvent(new MouseEvent('mousedown', at));
    button.dispatchEvent(new MouseEvent('mouseup', at));
    button.click();
    return true;
  })()`);
  if (pressed !== true) throw new Error("the page has no 转换 button to press");

  for (let attempt = 0; attempt < 80; attempt++) {
    const links = await client.evaluate(`document.querySelectorAll('a[download]').length`);
    if (links > 0) {
      // The results arrive over several frames (one per Conversion), so the page is
      // settled once more before anything is read: "a reading is taken on a page
      // that has stopped changing" is the rule this file was taught in #135.
      await client.settle();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("the Batch never produced a download link");
}

async function capture(baseUrl, outFile) {
  const port = Number(process.env.CDP_PORT ?? 9333);
  const client = await connect(port);
  const fingerprint = {};
  let unaddressed = 0;

  try {
    for (const page of PAGES) {
      const { name, path } = page;
      const selectors = page.anchors.map(anchorSelector);
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
      // never arrived, what waits for React to claim it, and what waits for it to
      // stop changing — the three halves of "the navigation succeeded", all of them
      // there rather than here (ADR-0015, and its update for #135). It also replaces
      // the 1800 ms sleep that used to be the only thing between a dead server and a
      // fingerprint of its error page.
      await client.navigate(`${baseUrl}${path}`);

      /*
       * A page whose anchors only exist after a file has been dropped gets one, and
       * then waits for the page to stop changing *again*: the file is a change that
       * arrives after the navigation settled, and a reading taken while the row is
       * still arriving is not a reading (#135's rule, applied to the one change this
       * Instrument makes itself).
       */
      if (page.fileInput !== undefined) {
        await client.setFile(page.fileInput, FIXTURE);
        await client.settle();
      }
      if (page.convert === true) await convert(client);

      // Before anything else is read: a page this run cannot address is a page it
      // must not report on. The failures are printed here, where the reason is
      // still in front of the reader, and the file is still written — a capture
      // that failed is worth diffing against the one that did not.
      const anchors = JSON.parse(await client.evaluate(anchorReading(selectors)));
      for (const entry of anchors.filter((one) => one.matched === 0)) {
        unaddressed++;
        report(unaddressedLine(entry.selector, name, ""));
      }

      const record = { anchors, path, views: {}, outline: await client.evaluate(OUTLINE) };

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

          const styles = JSON.parse(await client.evaluate(stylesReading(selectors)));
          // The same rule as the page-level reading above, asked again in this view
          // state: an anchor can be there at 1280 and gone at 360, and a state where
          // it is gone measured nothing about it.
          for (const entry of styles.filter((one) => one.values.length === 0)) {
            unaddressed++;
            report(unaddressedLine(entry.selector, name, ` @${width}-${scheme}`));
          }

          record.views[`${width}-${scheme}`] = {
            text: await client.evaluate("document.body.innerText"),
            styles,
            links: JSON.parse(
              await client.evaluate(
                /*
                 * A `blob:` target is printed as its scheme and nothing else, and that
                 * is a reading rather than a truncation (#166): the Tool mints one per
                 * page load from the bytes it just encoded, so the URL carries a fresh
                 * UUID every time — comparing it would compare two random strings and
                 * make every capture of a page with a download link differ from every
                 * other, including two captures of the same build. What the reading
                 * can honestly say is that there is a link, what it says, and that its
                 * target is a blob of this page's own making. Where it points is the
                 * gate's business, and the gate reads it.
                 */
                `JSON.stringify([...document.querySelectorAll('a')].map((a) => {
                  const href = a.getAttribute('href') ?? '';
                  return [href.startsWith('blob:') ? 'blob:' : href, a.innerText.trim().slice(0, 30)];
                }))`,
              ),
            ),
            // The page rather than a box: a nested scroller legitimately scrolls,
            // and `touch-targets.mjs` reads overflow from the same element for the
            // same reason. It is here because a widened row changes what the page
            // does without moving anything the outline anchors.
            overflow: await client.evaluate(
              "document.documentElement.scrollWidth - document.documentElement.clientWidth",
            ),
            outline: await client.evaluate(OUTLINE),
          };
          report(`  captured ${name} @${width}-${scheme}`);
        }
      }

      fingerprint[name] = record;
    }
  } finally {
    client.close();
  }

  writeFileSync(outFile, JSON.stringify(fingerprint, null, 2));
  report(`wrote ${outFile}`);

  if (unaddressed > 0) {
    report(
      `\n${unaddressed} declared anchor(s) matched nothing, on a page or in one of its view states: this file holds a measurement of nothing, and comparing it would print "nothing moved"`,
    );
    process.exitCode = 1;
  }
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

/**
 * The one sentence a declared anchor that matched nothing gets, wherever it is
 * noticed: the capture prints it as it takes the reading, and the comparison prints
 * it for either file. One function because the rule is one rule — a failure written
 * two ways is two rules that will drift, and the reader of a red run has to be able
 * to grep for it.
 *
 * `where` names the view state when the miss is a state rather than the page.
 */
const unaddressedLine = (selector, page, where) =>
  `  FAIL  nothing matches ${selector} on ${page}${where} — a declaration that matches nothing guards nothing`;

/** What a page's anchor reading says, in the words a failure needs. */
function anchorProblems(pageName, side, record) {
  if (!Array.isArray(record.anchors) || record.anchors.length === 0) {
    return [
      `  FAIL  the ${side} file records no anchor reading for ${pageName}: an address nothing checked is an address nothing measured`,
    ];
  }
  return record.anchors
    .filter((entry) => entry.matched === 0)
    .map((entry) => unaddressedLine(entry.selector, pageName, ` (${side})`));
}

function compare(beforeFile, afterFile) {
  const before = JSON.parse(readFileSync(beforeFile, "utf8"));
  const after = JSON.parse(readFileSync(afterFile, "utf8"));
  let differences = 0;

  const check = (name, ok, detail = "") => {
    if (!ok) differences++;
    report(`${ok ? "PASS" : "FAIL"}  ${name}${detail}`);
  };

  for (const page of PAGES) {
    const b = before[page.name];
    const a = after[page.name];
    if (!b || !a) {
      check(`${page.name}: captured in both files`, false);
      continue;
    }

    // The addresses first, in both files: everything below is a comparison of what
    // those addresses found, and a comparison of two nothings is not a comparison.
    const problems = [
      ...anchorProblems(page.name, "before", b),
      ...anchorProblems(page.name, "after", a),
    ];
    check(
      `${page.name}: every anchor it declares matched something`,
      problems.length === 0,
      problems.length === 0
        ? ` — ${b.anchors.length} anchors, in both files`
        : `\n${problems.join("\n")}`,
    );

    check(
      `${page.name}: full-page outline is identical`,
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
        check(`${page.name} @${view}: captured in both files`, false);
        continue;
      }

      // The page-level rule, asked again per state: the style read records an empty
      // `values` for a declared anchor that matched nothing here, so a state where an
      // anchor is missing fails the run instead of comparing two empty readings.
      const missing = [
        ...(bv.styles ?? [])
          .filter((entry) => entry.values.length === 0)
          .map((entry) => `${unaddressedLine(entry.selector, page.name, ` @${view}`)} (before)`),
        ...(av.styles ?? [])
          .filter((entry) => entry.values.length === 0)
          .map((entry) => `${unaddressedLine(entry.selector, page.name, ` @${view}`)} (after)`),
      ];
      check(
        `${page.name} @${view}: every anchor matched something in this state`,
        missing.length === 0,
        missing.length === 0 ? "" : `\n${missing.join("\n")}`,
      );

      check(`${page.name} @${view}: text is identical`, bv.text === av.text);
      check(
        `${page.name} @${view}: links are identical`,
        JSON.stringify(bv.links) === JSON.stringify(av.links),
      );
      check(
        `${page.name} @${view}: horizontal overflow is identical`,
        bv.overflow === av.overflow,
        bv.overflow === av.overflow ? "" : ` — before ${bv.overflow}px, after ${av.overflow}px`,
      );
      check(
        `${page.name} @${view}: outline is identical`,
        bv.outline === av.outline,
        firstDifference(bv.outline, av.outline),
      );
      check(
        // Named for what it now reads. It was "layout properties" from #124 to #133,
        // when the four layout properties were the whole of it; the name is the line
        // a reader greps for, so it moved with the reading rather than staying a word
        // that describes a third of it.
        `${page.name} @${view}: computed styles are identical`,
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
