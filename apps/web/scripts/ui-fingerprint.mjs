#!/usr/bin/env node
/**
 * The UI fingerprint: a structural snapshot of the pages, and a comparison of
 * two of them.
 *
 * This exists because "nothing changed" is the one claim a refactor makes and
 * the one no other check in this repo can test. `pnpm test` covers the pure
 * modules, `tsc` covers the types, the build covers that it compiles — none of
 * them notice that a component moved and now renders a wrapper element, or that
 * a cover frame lost its width at one breakpoint. So: capture the pages at five
 * widths in both colour schemes before the change, capture them again after, and
 * compare.
 *
 * **What it compares (#124, re-armed by #133).** Geometry — an outline of our own
 * anchored regions, each with its box and its own text — plus the page's text, its
 * link targets and its horizontal overflow, and a list of computed-style properties
 * off every match of every anchor: layout, colour, typography and radius. Nothing it
 * reads is the outgoing component library's: no `mantine-*` name and no
 * content-hashed `m_*` class appears in a reading, because a change of component
 * layer moves every one of them *by construction*, and an instrument addressed to
 * the library cannot be the safety net for the change that removes it. That is also
 * why the outline stopped printing tag names: who renders the element is exactly
 * what is changing.
 *
 * **The narrowing, and its end.** #124 took colour, typography and radius out for
 * the length of the pilot: the incoming layer brings its own palette, its own type
 * scale and its own corner radii, so keeping them in would have turned this into a
 * machine for printing differences nobody will read. That was right while the
 * language was in flight and wrong the moment it settled — an instrument that
 * ignores colour cannot notice a colour that moved by accident — so #133 puts them
 * back, addressed through the same anchors, and **re-baselines**: the baseline
 * captured before the migration describes the old design, and comparing against it
 * would now report differences that are all intended. The new baseline is a
 * capture of the settled pilot page; `apps/web/docs/design/log.md` records that it
 * moved, why, and what it therefore can no longer tell anyone — anything about the
 * state the site was in before that capture.
 *
 * What the re-armed comparison still does not see is the same list it never saw,
 * kept here rather than dropped: see "what it deliberately does not cover" below,
 * and the fixed attribute list the outline reads.
 *
 * **The anchors, and the one rule that matters most.** Each page declares the
 * anchors it must carry **by name** — a `data-slot` attribute on our own
 * components, the same convention the incoming layer stamps on everything it
 * renders, so the two ends of the migration need no translation table. Every
 * declared anchor is read, and one that matches **zero elements fails the run**,
 * on the capture and on the comparison both. A selector matching nothing guards
 * nothing, and without that rule "nothing moved" and "nothing was measured" print
 * the same word. An anchor the page carries but no declaration names is still
 * visible in the outline — the walk finds every `data-slot` — so a stray one is a
 * difference rather than a silence.
 *
 * What it deliberately does not cover: end-to-end behaviour (a real file going
 * through a real Worker), console errors, and anything a keyboard or a pointer
 * does. `touch-targets.mjs` is the sibling that does measure one pointer
 * property — the hit area of every `.touch-target` control; the rest were
 * separate one-off scripts, and `apps/web/docs/design/log.md` records what they
 * found.
 *
 * One limit is written down here so that "identical" is never read as "nothing
 * could have changed": the outline reads a fixed list of attributes, so a control
 * that swaps one attribute for another with the same computed effect is invisible
 * unless it moves something.
 *
 * **A reading is taken on a page that has stopped changing** (#135, measured
 * 2026-10-05), because the first one after a navigation was not. Three things
 * arrive after the connection layer has said the navigation landed, and each of
 * them changed what the outline read: the `.reveal` entrance animation is a 12px
 * translate over 600ms, a page that lazily imports something grows when the chunk
 * lands (the cover generator's 50 icon rows are 236px of page), and Next appends
 * its route announcer element on its own schedule — mounting nothing and fetching
 * nothing, which is why it has no cheaper signal than a DOM mutation count.
 * Measured on one unchanged build in one unchanged browser, two runs of `capture`
 * differed at all three of those, and a cold browser profile differed from a warm
 * one on the same build. The wait itself is **not here**: it is the third half of
 * `navigate` in the shared connection layer, next to the hydration wait it belongs
 * with, because "ready to measure" is one property with one answer and a second
 * definition of it is the option ADR-0015 rejected. What is this file's is the
 * evidence that it was needed at all, and the readings below it.
 *
 * The view states are emulated on a page that is already loaded, one navigation
 * per page rather than one per state: the scheme is set, then the read waits out
 * its budget. That is a race this site has never lost, and it is the first suspect
 * if a scheme pair ever differs with nothing else on the page different. Each view
 * state is given 350 ms to settle before its reading is taken.
 *
 * Usage — the Chrome has to be running already, because launching it is the part
 * that differs per machine:
 *
 *   pnpm build && pnpm --filter @toolbox/web start -p 3111
 *   chrome --headless=new --remote-debugging-port=9333 --user-data-dir=<tmp dir>
 *   node scripts/ui-fingerprint.mjs capture http://127.0.0.1:3111 before.json
 *   node scripts/ui-fingerprint.mjs compare before.json after.json
 *
 * `CDP_PORT` overrides the debugging port. Exit code is 1 when a comparison finds
 * a difference or a declared anchor matched nothing, so it can gate a shell chain.
 */
import { readFileSync, writeFileSync } from "node:fs";

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
     */
    anchors: [...SHELL_ANCHORS, "tool-page", "format-card", "converter-add", "converter-formats"],
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

/**
 * The outline: the anchored tree, each line carrying the anchor's name, the
 * handful of attributes that decide behaviour, the geometry, and an element's own
 * text.
 *
 * Two things it has to get right to be comparable across builds, and one it does
 * not read at all. Anchored elements are what it prints, and their children are
 * walked at one level deeper, so the shape of a region survives while the
 * elements the component library adds between our own — a wrapper div, a
 * generated label — are not part of the reading. The tag name is not printed
 * either: who renders the element is exactly what is changing (#124). And text
 * comes from the element's own text nodes rather than `innerText`, because
 * Mantine inlines `<style>` elements inside components and a document-wide
 * `textContent` would read their CSS as copy.
 *
 * A `data-slot` no page declaration names is still printed — the walk looks for
 * the attribute, not for the declared selectors — so an anchor someone adds
 * without declaring it shows up as a difference rather than as silence.
 */
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

/**
 * The computed properties this compares, and the whole of what it reads off a
 * style — everything else about a box is its geometry, which the outline already
 * carries.
 *
 * **Four groups, and the last three are what #133 put back.** *Layout*: a border
 * width or a padding that moves moves boxes, and an `aspect-ratio` or a
 * `margin-left` is a rule the stylesheet states rather than a box that could be
 * measured. *Colour*: the painted background, the border and the text, which is
 * the group an instrument that only reads geometry is blind to. *Typography*: the
 * family, size, weight, letter spacing and leading, which are the values a type
 * scale is made of. *Radius*: all four corners, because a radius can be changed
 * one corner at a time.
 *
 * Every one of them is read off **our own anchors** rather than off a class the
 * component layer owns, which is the property that makes them safe to compare
 * across a layer swap at all (#126's rule for site rules, applied to the reading).
 *
 * Deliberately not here, and not a residual limit but a decision: box-shadow, which
 * this site writes in one place and states as a position (`apps/web/docs/design/colour.md`),
 * and anything from a `::before`/`::after` — the hit-area instrument owns the one
 * pseudo-element this site depends on.
 */
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

/**
 * Those properties, read off **every** match of every anchor the page declares —
 * all five of the Image Converter's format cards, not the first one, because a
 * reading that stops at the first match is a reading that cannot see the fifth
 * card change. An anchor that matches nothing is caught before this is ever read
 * (see `anchorReading`), so a `values: []` here is not silence: the run has
 * already failed on the declaration.
 */
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

/**
 * Which of a page's declared anchors exist, and how many elements each one
 * matches.
 *
 * This is the reading the whole instrument hangs on: a declared anchor matching
 * zero elements is a failure, and it is a failure on the capture and on the
 * comparison both. Without it a mistyped declaration — or a renamed attribute —
 * would leave an outline of nothing, and two outlines of nothing compare equal:
 * "nothing moved" printed for a page nothing looked at. The prior art is the
 * hit-area instrument's `carriers` rule (`touch-targets.mjs`), which fails the
 * same way for the same reason.
 *
 * It is one of two places the rule is applied, not the only one: an anchor can be
 * present at 1280px and absent at 360, and that is a view state rather than a page,
 * so the per-view style read answers the same question in every state of the matrix
 * (`stylesReading` records `values: []` for a selector that matched nothing).
 */
const anchorReading = (
  selectors,
) => `JSON.stringify(${JSON.stringify(selectors)}.map((selector) => ({
  selector,
  matched: document.querySelectorAll(selector).length,
})))`;

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
                `JSON.stringify([...document.querySelectorAll('a')].map((a) => [a.getAttribute('href'), a.innerText.trim().slice(0, 30)]))`,
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
 * `where` is the view state when the miss is a state and not the page: an anchor can
 * be there at 1280 and gone at 360, and a state where it is gone measured nothing.
 */
const unaddressedLine = (selector, page, where) =>
  `  FAIL  nothing matches ${selector} on ${page}${where} — a declaration that matches nothing guards nothing`;

/**
 * What a page's anchor reading says, in the words a failure needs.
 *
 * Two failures live here and they are different ones. A file that carries no
 * anchor reading at all is a file from before this rule, or a hand-edited one, and
 * it cannot be told apart from a page nothing addressed — so it fails rather than
 * being treated as "no problems found", which is the whole shape of the mistake
 * this exists to prevent. And an anchor whose `matched` is 0 is a declaration that
 * guards nothing: the page may well have moved, but nothing on it was being looked
 * at, and the comparison would go on to print "nothing moved".
 */
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
