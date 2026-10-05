#!/usr/bin/env node
/**
 * The touch-target instrument: the hit area of every `.touch-target` control, measured
 * in a real browser.
 *
 * `apps/web/docs/design/components.md` wants a 44px touch target, and the pre-flight
 * checklist claims no clickable control is under it at 360 / 375×667 / 390 / 768 /
 * 1024. That is a claim about the *rendered* page, so nothing short of a browser can
 * make it: `.touch-target` declares 44x44 on a pseudo-element, and a declaration
 * is not a hit area. On a Mantine `Button` the declaration was there and the hit
 * area was the button's own box, because the root clipped the overlay with
 * `overflow: hidden` — that is issue #29, and this script is what sees it.
 *
 * The method, so that the numbers mean something: walk out from the control's
 * centre one pixel at a time, asking `elementFromPoint` at each step, and stop
 * when either side stops answering. A 44px overlay reads 43, because 44 whole
 * pixels hold 43 interior sample points. The centre it walks out from is the real
 * one rather than a rounded one, so a control sitting at a fractional offset is
 * not reported smaller than it is — the walk requires both sides, which turns half
 * a pixel of bias into two or three pixels of apparent loss (#91). Requiring *both*
 * sides is deliberate: it also catches a target that grew into a neighbour, which
 * is the other way this fails.
 *
 * What it deliberately does not cover: anything that is not hit-testing — the
 * keyboard, focus order, the drawing. Those keep the one-off scripts and
 * `ui-fingerprint.mjs` (which answers "did anything move", not "is this big
 * enough"). The three controls the checklist needs a file for (清空 and a row's
 * remove cross, and the cover generator's 清除) get one through CDP, the
 * technique `apps/web/docs/design/log.md` already records.
 *
 * Four things about the reading itself, so that a number can be read without
 * reverse-engineering the walk. The walk stops at 120 steps each way, so a control
 * larger than 241px on an axis reads as 241 — far past the threshold this exists
 * for. A point counts as a hit when `elementFromPoint` returns the control **or
 * anything inside it**, which is deliberate: a target that grew over a neighbour
 * fails here rather than passing. A control is landed on whole pixels before it is
 * measured, because the walk answers in whole pixels while a row's top is a
 * fraction (#91). And horizontal overflow is read from the page's own
 * `documentElement`: a nested scroller is not searched, because a legitimately
 * scrollable list would then be reported as a defect.
 *
 * It grew more claims, all about the rendered page and none of them about a hit
 * area: every page names the controls it has to carry (#81 — a floor on the count
 * cannot tell 清除 from the ~50 icon rows that arrive on their own), the cover
 * generator's canvas column has to sit on the side of the breakpoint its layout
 * rule names (#80 — an `order` swap moves what a visitor sees without moving the
 * DOM, resizing anything or overflowing), and that page's preview has to stay
 * within the share of a short viewport its rule allows (#90 — a cap that is
 * silently removed would otherwise be invisible to every check here).
 *
 * Since #84 each width is measured on the desktop pointer first, and the narrow
 * widths again as a phone (`hover: none`): the site keeps 窄屏 and 触屏 apart, the
 * touch branch is allowed to grow a control, so the narrow *window* is the strict
 * case and the phone is the one no other check looks at. Waits are for React's own
 * hydration signal rather than for a sleep — and, since #135, for the page to stop
 * changing, which is the third half of the shared navigation and not this script's
 * (`cdp.mjs`): a control in the prerendered HTML
 * looks hydrated, and a click or a file dropped on it is silently lost.
 *
 * Every guarded property is a named **claim** (#98): a unit with its own reading,
 * its own predicate and the lines it prints, walked from `CLAIMS` below. Naming
 * them is what lets `--falsify` re-run a guard on a page it has just broken, rather
 * than writing a second version of the guard to test the first.
 *
 * Usage — Chrome has to be running already, because launching it is the part that
 * differs per machine:
 *
 *   pnpm build && pnpm --filter @toolbox/web start -p 3111
 *   chrome --headless=new --remote-debugging-port=9333 --user-data-dir=<tmp dir>
 *   pnpm --filter @toolbox/web touch-targets [baseUrl]
 *   pnpm --filter @toolbox/web touch-targets --falsify [baseUrl]
 *
 * CI does that launching for you: the `Hit areas` step in `.github/workflows/ci.yml`
 * starts the server and the Chrome `@playwright/test` pins, on the build the gate
 * just drove — a threshold nobody runs is not a check (`apps/web/docs/design/log.md`
 * item 3, 2026-09-30). The launching is duplicated on purpose, in three places (that
 * shell and the two script headers): it is the part that differs per machine. The
 * command's *text* has a fourth copy, in `cdp.mjs`, where a browser that has gone is
 * reported — a failure nobody can act on is not worth printing (#99).
 *
 * `--falsify` is the in-place falsification run (#100): after a green pass it breaks
 * each geometry property the claims below guard, one at a time, by injecting a style
 * into the live page, re-runs **that claim** and requires it to go red. An injection
 * that leaves its claim green exits 1 — an injection that changes nothing proves
 * nothing. The injection is reliable because it is **unlayered**: this repository's
 * layer order is `theme → base → mantine → components → utilities` (declared at the
 * top of `apps/web/src/app/globals.css`) and an unlayered rule outranks every layer,
 * so an injected rule wins whatever the stylesheet says.
 *
 * What `--falsify` cannot prove: anything structural or behavioural. Whether an
 * unpicked panel is still mounted, whether the chosen section is written to the URL,
 * the keyboard model — those are React props and event handlers rather than computed
 * styles, so the only place to inject them is the source, on CI (prior art: putting
 * `keepMounted` back and watching the gate's new assertion go red, PR #94). It proves
 * the claims it names and nothing else: a page line it does not mention is untouched
 * by the run.
 *
 * Since #109 every claim declares how it is shown to fail — `falsification` on the
 * claim: an injection entry in the list, or a named source route for a property no
 * style can break (a class, a mounted panel). A claim that declares neither fails the
 * run before a browser is asked for, the roster of routes is printed first so that
 * "proven by injection" is never a guess, and the whole mode runs in CI on the same
 * build and the same browser as the sweep: a guard that can no longer go red is a
 * guard that has stopped guarding.
 *
 * `CDP_PORT` overrides the debugging port. Exit code is 1 when a control probes
 * under 43, when a control the page says it must carry is missing, when a control
 * matching a declared selector has lost the hit-area class, when a control or a
 * panel another section owns is on the page while a section is open — or when a
 * section's own panel is not — when the cover
 * generator's two columns are on the wrong side of the breakpoint, when its preview
 * is taller than the share its rule allows or no longer fills its column, when its
 * tab row has scrolled away, or on horizontal overflow — and, under `--falsify`,
 * when an injection fails to turn its claim red or when any claim declares no way to
 * go red at all — so it gates a shell chain.
 */
import { fileURLToPath } from "node:url";

import { connect } from "./cdp.mjs";

/**
 * The viewports this instrument measures: the four widths the pre-flight checklist
 * names, plus the phone the owner actually holds — each with the height it is
 * measured at (#89).
 *
 * 900 was the only height for as long as this script existed, because only the
 * width was ever under test. A symptom that a *short* screen produces and a tall
 * one hides — the cover generator's pinned preview eating half the viewport — is
 * invisible at 900, so the height became part of the case. 375×667 is the iPhone
 * SE: a width no check covered and a height no check had ever used.
 */
const CASES = [
  { height: 900, width: 360 },
  { height: 667, width: 375 },
  { height: 900, width: 390 },
  { height: 900, width: 768 },
  { height: 900, width: 1024 },
];

/**
 * The site's own `sm`, in pixels (Mantine's `sm` is 48em, Tailwind's `md` is
 * 48rem — the same 768): below it a tool page keeps its one-column layout, at or
 * above it the cover generator's editor and canvas sit side by side. The layout
 * assertion expects *this*, rather than reading which breakpoint the page happened
 * to pick — taking "narrow" from the page's own `flex-direction` would let the
 * check ratify any band, including the wrong one.
 */
const NARROW_BELOW = 768;

/**
 * The two pointers the site keeps apart — "窄屏 and 触屏 are two things"
 * (`apps/web/docs/design/layout.md`) — and what each is measured for.
 *
 * Every width runs the desktop one first, because that is the strict case for the
 * 44px rule: the touch branch is allowed to grow a control (`@media (hover: none)`
 * takes the Image Converter's drop-zone button to 50px), so a control can pass as
 * a phone and fail as a narrow desktop window. The narrow widths are then measured
 * again as the phone, because that is the device the rule is written for and no
 * other check looks at it.
 */
const POINTERS = [
  { label: "", media: [] },
  {
    label: " (touch)",
    media: [
      { name: "hover", value: "none" },
      { name: "pointer", value: "coarse" },
    ],
    narrowOnly: true,
  },
];

/**
 * Both schemes: the toggle swaps a moon for a sun, and the two icons could differ
 * in size, which would move the control it sits in.
 */
const SCHEMES = ["light", "dark"];

/** The probe's resolution: a 44px span reads 43. */
const MIN = 43;

/**
 * The cover generator's narrow-screen preview cap, as a share of the viewport
 * height (#90). Repeated here rather than read back out of the stylesheet on
 * purpose: a guard that follows the implementation it guards cannot fail. The rule
 * and its reasoning are the Tool's own (`src/tools/cover-generator/rules.md`); the
 * number in the stylesheet is `.cover-preview-pane`.
 */
const PREVIEW_MAX_SHARE = 0.45;

/**
 * The three pages, and the controls each one has to carry **by name**.
 *
 * A floor on the count cannot carry this: the cover page renders ~50 icon result
 * rows the moment the lucide chunk lands, and 获取系统字体 carries the class too,
 * so "at least 4" was already true with no background image and no 清除 — the
 * control the file is dropped for was the one control the check could not miss
 * (#81). Every name below is awaited before the measurement, so a control that
 * never renders fails as a missing name rather than leaving the report quietly.
 *
 * A page whose controls only exist after a file is dropped names the input that
 * takes it in `fileInput`; `layout` asks for the cover generator's two-column
 * check (see `LAYOUT`); `sections` says the page's controls live in an editor that
 * shows one panel at a time, so each section names its own and each is visited
 * (#91). A section declares two dimensions of "its own": `carriers` (selectors whose
 * matches must carry the hit-area class) and `presence` (`.show` — the panel that
 * must be showing — and `.hidden` — the ones that must not be). The page-level names
 * still have to be there for every section — the shell, and the tab row itself,
 * which is the new must-carry control.
 *
 * A control no name identifies cannot be checked by name at all, so a page — or one
 * of its sections — may declare `carriers`: selectors whose matches must carry the
 * hit-area class (#106). That class is what makes a control visible to this
 * Instrument, so losing it is a failure rather than an absence — and each declared
 * selector must match at least one element, because a selector that matches nothing
 * would guard nothing and tell nobody.
 */
const PAGES = [
  { controls: ["切换到"], name: "home", path: "/" },
  {
    controls: ["切换到", "返回首页", "清空", "移除"],
    fileInput: "input[type=file]",
    name: "tool",
    path: "/tools/image-converter",
  },
  {
    controls: ["切换到", "返回首页", "内容", "样式", "导出"],
    fileInput: ".mantine-Dropzone-root input[type=file]",
    layout: true,
    name: "cover",
    path: "/tools/cover-generator",
    sections: [
      {
        // The icon result rows are this page's only controls that no name identifies
        // (~50 of them, one per lucide result), so they are declared by their hook
        // class: losing it would take the whole list out of this Instrument's sight
        // without moving a pixel (#106).
        carriers: [".cover-icon-option"],
        controls: ["获取系统字体", "清除"],
        presence: {
          absent: [".cover-panel-style", ".cover-panel-export"],
          present: [".cover-panel-content"],
        },
        tab: "内容",
      },
      // The 样式 panel holds no `.touch-target` control — its controls are sliders
      // and switches — so no name can hold it. `presence` holds it instead: a section
      // declares the panel DOM it owns, which is the side a name check can never see,
      // a panel leaking *in* rather than out (#107). That the absence is real is
      // `keepMounted={false}` on the tabs.
      {
        controls: [],
        presence: {
          absent: [".cover-panel-content", ".cover-panel-export"],
          present: [".cover-panel-style"],
        },
        tab: "样式",
      },
      {
        controls: ["下载 16:9"],
        presence: {
          absent: [".cover-panel-content", ".cover-panel-style"],
          present: [".cover-panel-export"],
        },
        tab: "导出",
      },
    ],
  },
];

/**
 * A file for the controls that only exist once something has been dropped: 清空
 * and a row's remove cross in the Image Converter, and the cover generator's 清除,
 * which arrives with a background image (the Dropzone takes `image/*`). The Tool's
 * own cover is a real JPEG, so no fixture has to be committed and no encoder has
 * to live in this script; the file is never converted, only queued.
 */
const FIXTURE = fileURLToPath(
  new URL("../public/tools/image-converter/cover.jpg", import.meta.url),
);

/**
 * How a control is named — in one place, because two expressions need the exact
 * same rule: the measurement that lists them, and the wait that checks the names
 * have arrived. `aria-label` first (an icon-only control has no text), the
 * visible text otherwise. A name is matched as a *substring*, which is what lets
 * one expected name cover the colour switch's two labels (切换到深色 / 浅色).
 *
 * The expressions below — `LABEL` through `STICKY` — are JavaScript **inside**
 * template literals. None of them may contain a backtick — not even inside a
 * comment, because that is where the outer template ends: a `45dvh` written in a
 * comment here broke the whole file, and the way it fails (`Invalid or unexpected
 * token`, hundreds of lines below) names nothing (#108).
 */
const LABEL = `(el) => (el.getAttribute('aria-label') || el.innerText || '').replace(/\\s+/g, ' ').trim()`;

const MEASURE = `(() => {
  const label = ${LABEL};
  const hits = (el, x, y) => {
    const hit = document.elementFromPoint(x, y);
    return Boolean(hit) && (hit === el || el.contains(hit));
  };
  const span = (el, cx, cy, axis) => {
    // The centre arrives fractional and only the sampling points are rounded. Rounding
    // the centre first biases every step by up to half a pixel, and a walk that
    // requires both sides turns that into a hit area two or three pixels smaller
    // than the one that is really there: the cover generator's tab row sits at a
    // fractional top (an aspect-ratio pane above it decides that height), and 44px
    // tabs read 41 at 360 while reading 43 everywhere else (#91). A box on whole
    // pixels measures exactly as it did before.
    const px = Math.round(cx);
    const py = Math.round(cy);
    let offset = 0;
    while (
      offset < 120 &&
      (axis === 'x'
        ? hits(el, Math.round(cx - offset - 1), py) && hits(el, Math.round(cx + offset + 1), py)
        : hits(el, px, Math.round(cy - offset - 1)) && hits(el, px, Math.round(cy + offset + 1)))
    ) {
      offset += 1;
    }
    return 2 * offset + 1;
  };
  const controls = [...document.querySelectorAll('.touch-target')].map((el) => {
    el.scrollIntoView({ block: 'center' });
    // Land the control on whole pixels before measuring it. Where a row's top falls
    // is a fraction — an aspect-ratio pane above it decides that height, and the
    // scroll offset adds its own — while the walk answers in whole pixels. Without
    // this, the same 44px control measures differently from one visit to the next:
    // the cover generator's tab row read 43 on one pass and 41 on the next, with
    // nothing on the page different but the scroll position (#91).
    const before = el.getBoundingClientRect();
    window.scrollBy(0, before.top - Math.round(before.top));
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const after = getComputedStyle(el, '::after');
    const name = label(el);
    return {
      control: el.tagName.toLowerCase() + (name ? ' "' + name.slice(0, 24) + '"' : ''),
      label: name,
      drawn: Math.round(rect.width) + 'x' + Math.round(rect.height),
      declared: after.width + ' x ' + after.height,
      x: span(el, cx, cy, 'x'),
      y: span(el, cx, cy, 'y'),
    };
  });
  return JSON.stringify({
    controls,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  });
})()`;

/**
 * What the page's declared selectors match, and whether each match carries the
 * hit-area class.
 *
 * `MEASURE` walks what *does* carry the class; this walks what *should*. The class
 * is the only thing that makes a control visible to this Instrument, so a control
 * that lost it draws exactly as it did and, when nothing else names it, leaves the
 * report in silence — which is the gap #106 is about. A declaration that matches
 * nothing fails rather than passes, for the reason #81 gives about a floor on a
 * count: a check that cannot see its own subject is not a check.
 */
const readCarriers = (selectors) => {
  const expression = `(() => {
  const label = ${LABEL};
  return JSON.stringify(${JSON.stringify(selectors)}.map((selector) => {
    const matches = [...document.querySelectorAll(selector)];
    return {
      selector,
      matched: matches.length,
      missing: matches
        .filter((el) => !el.classList.contains('touch-target'))
        .map((el) => el.tagName.toLowerCase() + (label(el) ? ' "' + label(el).slice(0, 24) + '"' : '')),
    };
  }));
})()`;
  assertNoDanglingInterpolation("readCarriers", expression);
  return expression;
};

/**
 * Which of a section's declared panels are *showing*, and the height each one has.
 *
 * "Showing" rather than "in the DOM", because Mantine keeps every panel element
 * mounted and hides the ones that are not picked with `display: none` — measured on
 * the production build, all three panels are present with the same classes whatever
 * the tab row says. What changes when a section is opened is visibility: the picked
 * panel goes to `display: block` with a real height, and the others go to `none`
 * with a height of 0. `keepMounted={false}` on the tabs decides whether a panel's
 * *contents* are mounted, which is what an unnamed control leaking out would follow.
 *
 * The name check answers "are the controls this section names here"; this answers
 * the question a name cannot: "is this the section that is open, and is nothing else
 * showing". Every declaration is counted, so a section whose selectors all went
 * stale reports zeroes rather than silence.
 */
const readPresence = (presence) => {
  const expression = `(() => {
  const count = (selectors) => selectors.map((selector) => {
    const elements = [...document.querySelectorAll(selector)];
    const showing = elements.filter((el) => {
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.getBoundingClientRect().height > 0;
    });
    return { selector, matched: elements.length, showing: showing.length };
  });
  return JSON.stringify({
    absent: count(${JSON.stringify(presence.absent ?? [])}),
    present: count(${JSON.stringify(presence.present ?? [])}),
  });
})()`;
  assertNoDanglingInterpolation("readPresence", expression);
  return expression;
};

/**
 * A guard over an emitter, so the mistake that shipped once cannot ship twice: after
 * interpolation, the page-side source must contain no `${` at all.
 *
 * Called by the two emitters that interpolate — `readCarriers` and `readPresence` —
 * at the moment they build their expression, which is when the mistake would be made.
 * That is *not* "at load": `MEASURE`, `LAYOUT` and `STICKY` interpolate only
 * `LABEL`, which is itself a literal, so they cannot carry a dangling one and are not
 * wired to this. The cost is that a mistyped emitter is caught when a claim first
 * reads it, not before the browser is asked for.
 */
function assertNoDanglingInterpolation(name, source) {
  if (source.includes("${")) {
    throw new Error(
      `${name} still carries a \${...} after interpolation: the page would receive it as text`,
    );
  }
}

/**
 * The cover generator's two columns, which side of the breakpoint it is on, and
 * the preview pane's box.
 *
 * A swap written with `order` moves what a visitor sees without moving the DOM,
 * resizing anything or overflowing: on 2026-09-30 the editor column was first and
 * 320px wide from 768 to 991 with the preview pushed below all of it, and every
 * measurement this script already made stayed green (#80). So the boxes are read
 * directly — where the canvas is relative to the editor, and how wide each one is.
 *
 * The pane is read in the same pass because the cap (#90) is a claim about its box
 * rather than about a hit area, and because the pane's own width is what its height
 * comes from.
 */
const LAYOUT = `(() => {
  const editor = document.querySelector('.cover-editor-column');
  const canvas = document.querySelector('.cover-canvas-column');
  if (!editor || !canvas) return JSON.stringify({ missing: true });
  // The columns' own parent is the flex container: no guessing at "the first Flex
  // in main", and nothing to update if the page above them grows one.
  const flex = editor.parentElement;
  if (!flex || flex !== canvas.parentElement) return JSON.stringify({ missing: true });
  const box = (el) => {
    const rect = el.getBoundingClientRect();
    return { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width) };
  };
  const pane = document.querySelector('.cover-preview-pane');
  const paneBox =
    pane === null
      ? null
      : { height: Math.round(pane.getBoundingClientRect().height), width: Math.round(pane.getBoundingClientRect().width) };
  return JSON.stringify({
    canvas: box(canvas),
    direction: getComputedStyle(flex).flexDirection,
    editor: box(editor),
    preview: paneBox,
    // The height the page has, not the height that was asked for: the cap this is
    // compared against is 45dvh, whose basis is the page's own viewport (#108).
    viewport: window.innerHeight,
  });
})()`;

/**
 * The cover generator's tab row and preview, read at two scroll positions.
 *
 * The row pins below the preview (#92), and "pinned" is a claim about the rendered
 * page rather than about a rule in a stylesheet. Halfway down the page is where that
 * claim is actually testable: the preview is on screen there if it is pinned at all,
 * and it is where a row offset that ignored the preview would overlap it. Reading
 * only at the end of the page proves nothing about the overlap — by then the
 * preview is far above the row whatever the offset is.
 */
const STICKY = `(() => {
  const list = document.querySelector('.cover-tabs .mantine-Tabs-list');
  if (list === null) return JSON.stringify({ missing: true });
  const pane = document.querySelector('.cover-preview-pane');
  const box = (el) => {
    const rect = el.getBoundingClientRect();
    return { bottom: Math.round(rect.bottom), top: Math.round(rect.top) };
  };
  const read = () => ({
    pane: pane === null ? null : box(pane),
    row: box(list),
    scrollY: Math.round(window.scrollY),
    viewport: window.innerHeight,
  });
  // Where the preview sits in the document, before any scrolling, so the caller can
  // tell a page long enough for the preview to reach its pinning offset from one too
  // short to get there.
  window.scrollTo(0, 0);
  const paneStaticTop = pane === null ? null : Math.round(pane.getBoundingClientRect().top);
  const reach = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo(0, Math.round(reach / 2));
  const middle = read();
  window.scrollTo(0, document.documentElement.scrollHeight);
  return JSON.stringify({
    end: read(),
    middle,
    paneStaticTop,
    scrollable: reach > 40,
  });
})()`;

/** A check's whole output is its result, which is the one place a console is right. */
function report(line) {
  // oxlint-disable-next-line no-console -- see above.
  console.log(line);
}

/**
 * Put a file into the page's file input. React does receive this: the input keeps
 * its own change event and CDP sets the files on it. See item 2 of `apps/web/docs/design/log.md` — headless Chrome can do this, and the claim that it could not was
 * a limitation of an older tool, not of the browser.
 *
 * No sleep after this: whatever the file triggers (a row, a background image, 清除)
 * is waited for by name in `waitForControls`, which is both faster and stricter
 * than the 1200 ms this used to wait.
 */
async function addFile(client, selector) {
  const document = await client.send("DOM.getDocument", { depth: 1 });
  const input = await client.send("DOM.querySelector", {
    nodeId: document.result.root.nodeId,
    selector,
  });
  if (!input.result?.nodeId) throw new Error(`no file input matching ${selector}`);
  await client.send("DOM.setFileInputFiles", {
    files: [FIXTURE],
    nodeId: input.result.nodeId,
  });
}

/**
 * Wait until the page carries every control it names, and let the name check
 * below report the one that never arrived. A control that appears a beat after a
 * file has been read would otherwise be measured as a control the page does not
 * have — the one failure this instrument would report for the wrong reason.
 */
async function waitForControls(client, names) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const texts = JSON.parse(
      await client.evaluate(`JSON.stringify(
        [...document.querySelectorAll('.touch-target')].map(${LABEL}),
      )`),
    );
    if (names.every((name) => texts.some((text) => text.includes(name)))) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/**
 * Click the element whose own text is exactly `text`, among those matching
 * `selector`, and say whether one was there.
 *
 * One expression, because the three callers below all want the same thing from
 * Mantine controls whose visible text is the whole of what names them, and the
 * find-and-click was written out once per caller before this.
 */
async function clickByText(client, selector, text) {
  return client.evaluate(`(() => {
    const target = [...document.querySelectorAll(${JSON.stringify(selector)})].find(
      (el) => el.textContent.trim() === ${JSON.stringify(text)},
    );
    if (!target) return false;
    target.click();
    return true;
  })()`);
}

/**
 * Open one of an editor's sections, and wait for the page to say it did.
 *
 * The wait is on `aria-selected`, which is the transition the tab row makes — a
 * section with no control of its own (样式) would otherwise have nothing to wait
 * for, and the measurement after it would report a panel nobody opened.
 */
async function selectTab(client, name) {
  if ((await clickByText(client, "[role=tab]", name)) !== true) {
    throw new Error(`no tab labelled ${name} on the page`);
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    const selected = await client.evaluate(`(() => {
      const tab = [...document.querySelectorAll('[role=tab]')].find(
        (el) => el.textContent.trim() === ${JSON.stringify(name)},
      );
      return tab !== undefined && tab.getAttribute('aria-selected') === 'true';
    })()`);
    if (selected === true) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`the ${name} tab never came to be selected`);
}

/**
 * Pick a ratio preset, and wait for the page to say it did.
 *
 * The download button is named after the ratio ("下载 16:9"), so "1:1 has arrived"
 * is a state transition rather than a sleep — and, unlike waiting for something to
 * disappear, it cannot be true before React has rendered it. This throws instead of
 * returning quietly: a ratio that never changed would leave the cap below measuring
 * the one ratio that does not bind it, which reads as a pass.
 */
async function selectRatio(client, ratioKey) {
  if ((await clickByText(client, "label", ratioKey)) !== true) {
    throw new Error(`no ratio preset labelled ${ratioKey} on the page`);
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    const labels = JSON.parse(
      await client.evaluate(`JSON.stringify(
        [...document.querySelectorAll('.touch-target')].map(${LABEL}),
      )`),
    );
    if (labels.some((label) => label.includes(`下载 ${ratioKey}`))) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`the download button never came to say 下载 ${ratioKey}`);
}

/**
 * The claims, in the order the report reads them.
 *
 * Each one is a named unit: `read` takes its reading off the page, `judge` is the
 * predicate and the lines it prints, and `per` says whether it is taken once per
 * editor section or once per page. `runClaim` is the only thing that evaluates one,
 * which is what lets the falsification mode below re-run a guard on a page it has
 * just broken instead of writing a second copy of it.
 *
 * Readings are shared through `ctx.read`: several claims read the same measurement,
 * and taking it once is what keeps a full pass at the ~40 seconds it has always
 * been. A claim whose `prepare` changes the page resets that cache, because the old
 * reading is no longer what the page says.
 */
const CLAIMS = [
  {
    name: "named-controls",
    about: "every control the page says it must carry is on the page",
    falsification: {
      source: "take one declared name off its control, the way #82 took 清除's class away",
    },
    per: "section",
    read: (ctx) => ctx.read("measure", MEASURE),
    judge: (measured, ctx) =>
      ctx.names.map((name) => {
        const found = measured.controls.some((control) => control.label.includes(name));
        return { ok: found, line: `  ${found ? "PASS" : "FAIL"}  ${name}` };
      }),
  },
  {
    name: "class-carriers",
    about: "every control matching a declared selector carries the hit-area class",
    falsification: {
      source: "take the class off one matching control — one line in the Tool's component (#106)",
    },
    per: "section",
    // Nothing declared means nothing to read: a page whose every control has a name
    // is already held by `named-controls`, and an empty walk would only add silence.
    // The claim therefore says nothing on the home and image-converter pages, whose
    // `.touch-target` controls all carry names (#106 review) — that is the intended
    // division of labour, not a gap: `named-controls` catches a class lost from a
    // named control, and this catches one lost from a control that has no name.
    only: (ctx) => ctx.carriers.length > 0,
    read: (ctx) => ctx.read("carriers", readCarriers(ctx.carriers)),
    judge: (read) =>
      read.map((entry) => {
        if (entry.matched === 0) {
          return {
            ok: false,
            line: `  FAIL  nothing matches ${entry.selector} — a declaration that matches nothing guards nothing`,
          };
        }
        if (entry.missing.length > 0) {
          return {
            ok: false,
            line: `  FAIL  ${entry.missing.length} of ${entry.matched} matching ${entry.selector} do not carry the hit-area class: ${entry.missing.join(", ")}`,
          };
        }
        return {
          ok: true,
          line: `  PASS  every control matching ${entry.selector} carries the hit-area class — ${entry.matched} matched`,
        };
      }),
  },
  {
    name: "section-isolation",
    about: "nothing another section owns is on the page while a section is open",
    falsification: {
      source: "render one section's named control inside another section's panel",
    },
    per: "section",
    only: (ctx) => ctx.page.sections !== undefined,
    read: (ctx) => ctx.read("measure", MEASURE),
    judge: (measured, ctx) => {
      // The other sections' controls have to be gone, not merely hidden: a section
      // left on the page would let the row look switched while the old panel is
      // still what a pointer reaches.
      const leaked = ctx.page.sections
        .filter((other) => other.tab !== ctx.section.tab)
        .flatMap((other) => other.controls)
        .filter((name) => measured.controls.some((control) => control.label.includes(name)));
      return [
        {
          ok: leaked.length === 0,
          line: `  ${leaked.length === 0 ? "PASS" : "FAIL"}  nothing from the other sections is on the page${
            leaked.length === 0 ? "" : ` — found ${leaked.join(", ")}`
          }`,
        },
      ];
    },
  },
  {
    name: "section-presence",
    about: "the section that is showing is this one, and nothing else is",
    falsification: {
      source:
        "put keepMounted back on the tabs and render a second panel's contents, the shape #94 proved red on the gate's panel claim — a style cannot do it: Mantine writes display:none inline on the unpicked panel, which an injected rule loses to (measured 2026-10-01, both 360 and 1024, where a forced display left the count at 0)",
    },
    per: "section",
    only: (ctx) => ctx.presence !== undefined,
    read: (ctx) => ctx.read("presence", readPresence(ctx.presence)),
    judge: (read) => {
      const problems = [
        ...read.present
          .filter((entry) => entry.showing === 0)
          .map((entry) => ({
            ok: false,
            line: `  FAIL  ${entry.selector} is not showing — this section's own panel is not the open one`,
          })),
        ...read.absent
          .filter((entry) => entry.showing > 0)
          .map((entry) => ({
            ok: false,
            line: `  FAIL  ${entry.selector} is showing while another section is open (${entry.showing} of ${entry.matched} matched)`,
          })),
      ];
      if (problems.length > 0) return problems;
      const summary = [
        ...read.present.map((entry) => `${entry.selector} showing`),
        ...read.absent.map((entry) => `${entry.selector} hidden`),
      ].join(", ");
      return [{ ok: true, line: `  PASS  this is the section that is showing — ${summary}` }];
    },
  },
  {
    name: "horizontal-overflow",
    about: "the page does not scroll sideways",
    falsification: {
      source: "give a row a fixed width wider than the narrowest case — the shape #54's 938px was",
    },
    per: "section",
    read: (ctx) => ctx.read("measure", MEASURE),
    // Only the failure has a line: a page that does not overflow has nothing to say,
    // and that silence is part of the report this must not change.
    judge: (measured) =>
      measured.overflow > 0
        ? [{ line: `  FAIL  horizontal overflow: ${measured.overflow}px`, ok: false }]
        : [],
  },
  {
    name: "hit-areas",
    about: `every .touch-target control answers at ${MIN}+ on both axes`,
    falsification: { injection: true },
    per: "section",
    read: (ctx) => ctx.read("measure", MEASURE),
    judge: (measured) =>
      measured.controls.map((control) => {
        const ok = control.x >= MIN && control.y >= MIN;
        return {
          ok,
          line: `  ${ok ? "PASS" : "FAIL"}  ${control.control} — drawn ${control.drawn}, declared ::after ${control.declared}, hit-testable ${control.x}x${control.y}`,
        };
      }),
  },
  {
    name: "column-order",
    about: "the cover generator's two columns are on the side of the breakpoint its rule names",
    falsification: { injection: true },
    per: "page",
    only: (ctx) => ctx.page.layout === true,
    read: (ctx) => ctx.read("layout", LAYOUT),
    judge: (layout, ctx) => {
      if (layout.missing === true) {
        return [
          { line: "  FAIL  the cover generator's two columns are not on the page", ok: false },
        ];
      }
      const ok = ctx.narrow
        ? layout.canvas.top < layout.editor.top &&
          Math.abs(layout.canvas.width - layout.editor.width) <= 1
        : layout.editor.left < layout.canvas.left &&
          Math.abs(layout.canvas.top - layout.editor.top) <= 1;
      return [
        {
          ok,
          line: `  ${ok ? "PASS" : "FAIL"}  ${
            ctx.narrow
              ? "the canvas column comes before the editor's"
              : "the editor and the canvas are side by side"
          } — editor ${layout.editor.width}px at ${layout.editor.left},${layout.editor.top}; canvas ${layout.canvas.width}px at ${layout.canvas.left},${layout.canvas.top}; the page's own direction is ${layout.direction}`,
        },
      ];
    },
  },
  {
    name: "preview-default-ratio",
    about:
      "at the default ratio the preview is capped on a narrow screen and exactly its column on a wide one",
    falsification: { injection: true },
    per: "page",
    only: (ctx) => ctx.page.layout === true,
    // The default ratio is a state this claim has to *be* in, not one it inherits:
    // it used to be whatever the walk left behind, which made its verdict depend on
    // running before the claim that picks 1:1 — the principle this registry's own
    // comments write down for its sibling (#98, #108). 16:9 is the Tool's default,
    // and the claim names it rather than reading it back: a guard that follows the
    // implementation it guards cannot fail.
    prepare: async (ctx) => {
      ctx.reset();
      await selectTab(ctx.client, "导出");
      await selectRatio(ctx.client, "16:9");
    },
    read: (ctx) => ctx.read("layout", LAYOUT),
    // The cap is narrow-only: on a wide screen the pane has to be exactly its column
    // at 16:9 too.
    judge: (layout, ctx) => {
      if (layout.missing === true || layout.preview === null) return [];
      const share = Math.round(PREVIEW_MAX_SHARE * 100);
      const ceiling = Math.round(layout.viewport * PREVIEW_MAX_SHARE);
      const ok = ctx.narrow
        ? layout.preview.height <= ceiling + 1
        : Math.abs(layout.preview.width - layout.canvas.width) <= 1;
      return [
        {
          ok,
          line: `  ${ok ? "PASS" : "FAIL"}  ${
            ctx.narrow
              ? `at the default ratio the preview is no taller than ${share}% of the viewport`
              : "at the default ratio the preview is exactly its column"
          } — pane ${layout.preview.width}x${layout.preview.height}, column ${layout.canvas.width}px, ceiling ${ceiling}px of ${layout.viewport}px`,
        },
      ];
    },
  },
  {
    name: "preview-cap",
    about:
      "on 1:1 the preview is capped on a narrow screen and still fills its column on a wide one",
    falsification: { injection: true },
    per: "page",
    only: (ctx) => ctx.page.layout === true,
    // The cap is measured on the ratio that can bind it: at the default 16:9 a narrow
    // pane is 211px of a 667px screen and sits well inside the cap, so a guard that
    // only looked at the default would pass without ever exercising the rule. 1:1 is
    // the ratio that needs it — and the ratio control lives in 导出, which this claim
    // opens itself rather than inheriting from the sweep's last section: a claim that
    // only works when the loop happens to end where it needs to is not a unit anyone
    // can call on its own (#98). In the sweep that click lands on the tab that is
    // already selected, so it changes nothing the report can see.
    prepare: async (ctx) => {
      ctx.reset();
      await selectTab(ctx.client, "导出");
      await selectRatio(ctx.client, "1:1");
    },
    read: (ctx) => ctx.read("layout", LAYOUT),
    judge: (capped, ctx) => {
      if (capped.missing === true || capped.preview === null) {
        return [
          { line: "  FAIL  the cover generator's preview pane is not on the page", ok: false },
        ];
      }
      const share = Math.round(PREVIEW_MAX_SHARE * 100);
      const ceiling = Math.round(capped.viewport * PREVIEW_MAX_SHARE);
      const ok = ctx.narrow
        ? capped.preview.height <= ceiling + 1
        : Math.abs(capped.preview.width - capped.canvas.width) <= 1;
      return [
        {
          ok,
          line: `  ${ok ? "PASS" : "FAIL"}  ${
            ctx.narrow
              ? `on 1:1 the preview is no taller than ${share}% of the viewport`
              : "on 1:1 the preview still fills its column"
          } — pane ${capped.preview.width}x${capped.preview.height}, ceiling ${ceiling}px of ${capped.viewport}px, column ${capped.canvas.width}px`,
        },
      ];
    },
  },
  {
    name: "tab-row-pinned",
    about: "the tab row keeps its place while the page scrolls, and does not sit over the preview",
    falsification: { injection: true },
    per: "page",
    only: (ctx) => ctx.page.layout === true,
    // The long panel is the one to read from — it is the panel a visitor scrolls
    // through, and the only one long enough for the preview to reach the offset it
    // pins at.
    prepare: async (ctx) => {
      ctx.reset();
      await selectTab(ctx.client, "内容");
    },
    read: (ctx) => ctx.read("sticky", STICKY),
    judge: (sticky, ctx) => {
      if (sticky.missing === true) {
        return [{ line: "  FAIL  the cover generator's tab row is not on the page", ok: false }];
      }
      const endOk = sticky.end.row.top >= 0 && sticky.end.row.bottom <= sticky.end.viewport;
      const pane = sticky.middle.pane;
      // The preview has to be pinned once the scroll has carried its static
      // position above the offset it pins at — that is the box the visitor is
      // editing, and the row's own offset below the breakpoint is computed
      // from its height. A page too short to get there proves the clearance
      // instead, not the pinning.
      const shouldPin =
        pane !== null &&
        sticky.paneStaticTop !== null &&
        sticky.paneStaticTop - sticky.middle.scrollY <= 18;
      const pinned = !shouldPin || Math.abs(pane.top - 16) <= 2;
      const clears = !ctx.narrow || pane === null || sticky.middle.row.top >= pane.bottom - 1;
      const midOk = !sticky.scrollable || (pinned && clears && sticky.middle.row.top >= 0);
      const ok = endOk && midOk;
      return [
        {
          ok,
          line: `  ${ok ? "PASS" : "FAIL"}  the row keeps its place while the page scrolls — halfway: row ${sticky.middle.row.top}..${sticky.middle.row.bottom}, preview ${
            pane === null ? "none" : `${pane.top}..${pane.bottom}`
          } of a ${sticky.middle.viewport}px viewport at scroll ${sticky.middle.scrollY}${shouldPin ? " (pinned is required here)" : " (too short to reach the pin)"}; at the end: row ${sticky.end.row.top}..${sticky.end.row.bottom}${sticky.scrollable ? "" : " (the page does not scroll)"}`,
        },
      ];
    },
  },
];

/**
 * One claim's context: what is being measured, and the readings it has asked for.
 *
 * `read` takes each expression at most once per context — three claims share the one
 * measurement, and paying for it three times would make the pass slower than it has
 * ever been. `reset` is how a caller says the page has moved on (a tab opened, a
 * ratio picked, a style injected) and the next `read` has to look again.
 *
 * Taken as one object rather than six positional arguments: `client`, `pointer`,
 * `scheme` and `shape` travel together to every caller, and a context built with two
 * of them swapped would measure the wrong thing silently.
 */
function context({ client, page, pointer, scheme, section, shape }) {
  const readings = new Map();
  return {
    carriers: [...(page.carriers ?? []), ...(section?.carriers ?? [])],
    client,
    narrow: shape.width < NARROW_BELOW,
    names: [...page.controls, ...(section?.controls ?? [])],
    page,
    pointer,
    presence: section?.presence,
    read: async (key, expression) => {
      if (!readings.has(key)) readings.set(key, JSON.parse(await client.evaluate(expression)));
      return readings.get(key);
    },
    reset: () => readings.clear(),
    scheme,
    section,
  };
}

/**
 * Walk the registry for one context: every claim of this scope, prepared, read,
 * judged, printed, counted. The `per` check lives here rather than at the two call
 * sites, so "which claims run now" is answered in one place.
 */
async function runClaims(scope, ctx) {
  let failures = 0;
  for (const claim of CLAIMS) {
    if (claim.per !== scope) continue;
    if (claim.only !== undefined && !claim.only(ctx)) continue;
    failures += reportResults(await runClaim(claim, ctx));
  }
  return failures;
}

/**
 * Evaluate one claim: prepare the page, take its reading, apply its own predicate.
 * The single path any claim is ever evaluated by — the sweep below walks the
 * registry through it, and the falsification mode calls it again on a page it has
 * just broken, which is what makes that a replay of the guard rather than a copy.
 *
 * `judge` is synchronous and reads nothing but its reading and the context: a
 * predicate that measured something of its own could not be replayed this way.
 */
async function runClaim(claim, ctx) {
  if (claim.prepare !== undefined) await claim.prepare(ctx);
  return claim.judge(await claim.read(ctx), ctx);
}

/** Print a claim's lines and count what failed. */
function reportResults(results) {
  let failures = 0;
  for (const result of results) {
    if (!result.ok) failures++;
    report(result.line);
  }
  return failures;
}

/**
 * Put the browser in one case: the viewport, and the two media features the site
 * reads — the colour scheme and the pointer. Taken before a page is opened, because
 * a page that is already loaded does not re-evaluate a media query the same way.
 */
async function applyCase(client, shape, pointer, scheme) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: shape.width,
    height: shape.height,
    deviceScaleFactor: 1,
    mobile: shape.width < NARROW_BELOW,
  });
  await client.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: scheme }, ...pointer.media],
  });
}

/**
 * Open one page: navigate (through the shared connection layer, which owns both the
 * arrival check and the wait for React — ADR-0015), and put the file in when the
 * page's controls only exist after something has been dropped. Shared by the sweep
 * and the falsification mode, so "the page as measured" is one definition rather than
 * two that drift.
 */
async function openPage(client, baseUrl, page) {
  await client.navigate(`${baseUrl}${page.path}`);
  if (page.fileInput !== undefined) await addFile(client, page.fileInput);
}

/**
 * Open one of a page's sections, and wait until every control the page and that
 * section name is on the page — the state every claim is measured in.
 */
async function openSection(client, page, section) {
  if (section.tab !== null) await selectTab(client, section.tab);
  await waitForControls(client, [...page.controls, ...section.controls]);
}

async function sweep(baseUrl) {
  const port = Number(process.env.CDP_PORT ?? 9333);
  const client = await connect(port);
  let failures = 0;

  try {
    for (const shape of CASES) {
      for (const pointer of POINTERS) {
        if (pointer.narrowOnly === true && shape.width >= NARROW_BELOW) continue;

        for (const scheme of SCHEMES) {
          await applyCase(client, shape, pointer, scheme);

          for (const page of PAGES) {
            await openPage(client, baseUrl, page);

            // A page with sections is visited one section at a time: the editor's
            // panels are unmounted when they are not picked (#91), so a flat list of
            // names would be a list of controls that are never on the page together,
            // and the hit areas of the sections nobody opened would never be
            // measured. A page without sections is the single pass it always was.
            const sections = page.sections ?? [{ controls: [], tab: null }];

            for (const [index, section] of sections.entries()) {
              await openSection(client, page, section);

              if (index === 0) {
                report(`\n${shape.width}×${shape.height} ${scheme}${pointer.label} — ${page.path}`);
              }
              if (section.tab !== null) report(`  [${section.tab}]`);

              failures += await runClaims(
                "section",
                context({ client, page, pointer, scheme, section, shape }),
              );
            }

            failures += await runClaims(
              "page",
              context({ client, page, pointer, scheme, section: null, shape }),
            );
          }
        }
      }
    }
  } finally {
    client.close();
  }

  report(
    failures === 0
      ? `\nALL PASS — every control answers at ${MIN}+ on both axes (44 within the probe's resolution)`
      : `\n${failures} FAILURE(S)`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

/**
 * The in-place falsification list (#100): one entry per geometry property the claims
 * above guard, and the claim that has to go red when it is broken.
 *
 * `case` is the viewport the injected property binds at, and it belongs to the entry
 * rather than to the mode because that is what the property decides: the preview cap
 * only exists below the breakpoint and only a *short* screen makes it bind (at
 * 360×900 the same injection changes nothing), while the tab row's height reads
 * exactly 43 — the threshold itself — at 375×667 and 41 at 360. An entry measured
 * where its property does not bind would prove nothing and would be read as one.
 *
 * Every entry names three things and no more: what to break (a selector, a property,
 * a value), which claim has to notice, and the case it binds at.
 */
const FALSIFY = [
  {
    case: { height: 667, width: 375 },
    claim: "preview-cap",
    note: "the cap, which only a short viewport makes bind",
    property: "--cover-preview-max-height",
    selector: ".cover-preview-pane",
    value: "100dvh",
  },
  {
    case: { height: 900, width: 360 },
    claim: "hit-areas",
    note: "the 46px the layout grants the row, on the width where it reads under the threshold",
    property: "min-height",
    selector: ".cover-tabs .mantine-Tabs-tab",
    value: "30px",
  },
  {
    case: { height: 667, width: 375 },
    claim: "tab-row-pinned",
    note: "the row's stickiness",
    property: "position",
    selector: ".cover-tabs .mantine-Tabs-list",
    value: "static",
  },
  {
    case: { height: 900, width: 360 },
    claim: "column-order",
    note: "the canvas column's place above the editor at a narrow width — forcing it last breaks the rule",
    property: "order",
    selector: ".cover-canvas-column",
    value: "2",
  },
  {
    case: { height: 900, width: 1024 },
    claim: "preview-default-ratio",
    note: "the pane's width on the wide branch, where the default ratio's cap has slack and a style can still break it",
    property: "max-width",
    selector: ".cover-preview-pane",
    value: "50%",
  },
];

/**
 * The page every entry above is measured on: the cover generator, whose geometry
 * these five properties are. The percentage pairs on the preview cap and the 46px
 * tab row are that Tool's own rules (`src/tools/cover-generator/rules.md`); the
 * other two pages have hit-area claims too, and an entry for one of them belongs
 * here the day it is worth a falsification run.
 *
 * Two of the five were written from the mechanism rather than from a run (#109):
 * `order: 2` on the canvas column puts it after the editor whatever the narrow rule
 * does, and `max-width: 50%` on the pane breaks the wide branch's "the pane is
 * exactly its column" by construction. The other three have each been watched go
 * red by hand, and every run is recorded in `apps/web/docs/design/log.md`.
 */
const FALSIFY_PAGE = "cover";

/**
 * Put one rule in the live page, unlayered, and hand back the undo.
 *
 * Unlayered is what makes this reliable: every rule this site writes lives in one of
 * `theme`/`base`/`mantine`/`components`/`utilities` (declared at the top of
 * `apps/web/src/app/globals.css`), an unlayered rule outranks all of them, and a
 * `<style>` appended at runtime is unlayered by definition. So the injection wins on
 * layer order alone, with no `!important` and no specificity contest to keep in step
 * with the stylesheet it is breaking.
 *
 * The element is removed again rather than overridden, so the next entry starts from
 * the page as shipped.
 */
async function inject(client, entry) {
  const id = `falsify-${entry.claim}`;
  const css = `${entry.selector} { ${entry.property}: ${entry.value} }`;
  await client.evaluate(`(() => {
    const style = document.createElement('style');
    style.id = ${JSON.stringify(id)};
    style.textContent = ${JSON.stringify(css)};
    document.head.append(style);
    return true;
  })()`);
  return () => client.evaluate(`document.getElementById(${JSON.stringify(id)})?.remove()`);
}

/** How a claim's result set reads in one phrase. */
const tally = (results) =>
  `${results.length} line(s), ${results.filter((result) => !result.ok).length} red`;
const red = (results) => results.filter((result) => !result.ok);

/**
 * What a claim's declaration says, in one place: the roster prints it and the
 * coverage check judges it, and two readings of the same three-way union is exactly
 * the kind of drift a second copy invites (#109 review).
 *
 * `kind` is the discriminant both readers switch on — `none` for a claim that has
 * not said anything, `injection` for one an injected style proves, `source` for one
 * only a source change can.
 */
const routeOf = (claim) => {
  const route = claim.falsification;
  if (route === undefined) return { kind: "none" };
  if (route.injection === true) return { kind: "injection" };
  if (typeof route.source !== "string" || route.source === "") return { kind: "none" };
  return { kind: "source", source: route.source };
};

/**
 * How each claim says it can be shown to fail, in the order the registry reads it.
 *
 * Printed at the start of every falsification run, because "which of these guards
 * has ever been red, and how" should be something the run says rather than something
 * a reader assembles from the list below (#109).
 */
const falsificationRoster = () =>
  CLAIMS.map((claim) => {
    const route = routeOf(claim);
    const how =
      route.kind === "none"
        ? "NOTHING DECLARED"
        : route.kind === "injection"
          ? "injection"
          : `source — ${route.source}`;
    return `  ${claim.name}: ${how}`;
  }).join("\n");

/**
 * Everything wrong with the claims' own declarations, as sentences a reader can act
 * on. A claim that cannot say how it goes red is the gap #109 closes: it can be green
 * for years with nobody able to tell whether it still guards anything.
 *
 * The rules are deliberately two-sided. A claim that says an injection proves it must
 * have an entry in the list, because an unproven declaration is the same gap wearing
 * a better word. A claim that says an injection cannot prove it must not have one,
 * because an entry is what proves an injection and a claim cannot be proved by the
 * thing it says cannot prove it.
 */
function coverageProblems() {
  const problems = [];
  for (const claim of CLAIMS) {
    const route = routeOf(claim);
    const entries = FALSIFY.filter((entry) => entry.claim === claim.name);
    if (route.kind === "none") {
      problems.push(
        `${claim.name}: no route is declared, so nothing says how it could ever go red`,
      );
      continue;
    }
    if (route.kind === "injection") {
      if (entries.length === 0) {
        problems.push(
          `${claim.name}: declared provable by injection, and the list has no entry for it`,
        );
      }
      continue;
    }
    if (entries.length > 0) {
      problems.push(`${claim.name}: declares a source route, yet the list injects for it too`);
    }
  }
  return problems;
}

/**
 * The falsification run: prove that each guard in the list above *can* fail, on the
 * page the sweep measures, without touching the source and without a second build.
 *
 * Per entry: measure the claim (it has to be green — on a page that is already red,
 * an injection proves nothing), inject the rule, measure **the same claim** again
 * through the same `runClaim`, require it to go red, remove the rule, and measure
 * once more to show the page came back. Only the first of those is new work: the
 * reading, the predicate and the report line are the ones the normal pass uses, which
 * is the whole point — a parallel check would prove a copy of the guard.
 *
 * Exit code 1 if any claim stays green under its injection, if one was already red
 * before it, or if the page does not come back green afterwards.
 */
async function falsify(baseUrl) {
  const port = Number(process.env.CDP_PORT ?? 9333);
  const problems = coverageProblems();
  let failures = 0;

  report("Falsification run — the Instrument's own guards, injected one at a time");
  report(falsificationRoster());

  // The declarations are checked before a browser is asked for: a claim that cannot
  // say how it goes red is a source-level mistake, and finding it should not cost a
  // connection, a navigation or thirty seconds.
  if (problems.length > 0) {
    for (const problem of problems) report(`  FAIL  ${problem}`);
    report(`\n${problems.length} COVERAGE FAILURE(S) — nothing was injected`);
    process.exitCode = 1;
    return;
  }

  const client = await connect(port);
  const page = PAGES.find((candidate) => candidate.name === FALSIFY_PAGE);
  const [pointer] = POINTERS;
  const [scheme] = SCHEMES;

  try {
    for (const entry of FALSIFY) {
      const claim = CLAIMS.find((candidate) => candidate.name === entry.claim);
      if (claim === undefined) {
        throw new Error(
          `the falsification list names a claim that is not in the registry: ${entry.claim}`,
        );
      }
      if (
        !CASES.some(
          (shape) => shape.width === entry.case.width && shape.height === entry.case.height,
        )
      ) {
        throw new Error(
          `the falsification list names a viewport the sweep does not measure: ${entry.case.width}×${entry.case.height}`,
        );
      }

      // A fresh page per entry, opened the way the sweep opens it — a tab, a file — so
      // what is broken is the page the sweep actually measures. The page's *default*
      // section, because that is the state the page is in before anything is picked;
      // a claim that needs another one opens it in its own `prepare`.
      await applyCase(client, entry.case, pointer, scheme);
      await openPage(client, baseUrl, page);
      const section = page.sections?.[0] ?? { controls: [], tab: null };
      await openSection(client, page, section);
      const ctx = context({ client, page, pointer, scheme, section, shape: entry.case });

      // Every measurement re-reads the page: the whole point is that the reading after
      // the injection is the same expression against a page that has changed.
      const measure = async () => {
        ctx.reset();
        return runClaim(claim, ctx);
      };

      report(`\n${claim.name} @${entry.case.width}×${entry.case.height} — ${claim.about}`);
      report(
        `  inject \`${entry.selector} { ${entry.property}: ${entry.value} }\` — ${entry.note}`,
      );

      const before = await measure();
      const undo = await inject(client, entry);
      const after = await measure();
      await undo();
      const restored = await measure();

      const beforeRed = red(before);
      const afterRed = red(after);
      const restoredRed = red(restored);

      report(`  before:   ${beforeRed.length === 0 ? "PASS" : "RED"} — ${tally(before)}`);
      if (beforeRed.length > 0) {
        failures++;
        report("            (already failing before the injection, so this entry proves nothing)");
        for (const result of beforeRed) report(`  ${result.line}`);
      }
      report(`  after:    ${afterRed.length === 0 ? "STILL GREEN" : "RED"} — ${tally(after)}`);
      for (const result of afterRed) report(`  ${result.line}`);
      if (beforeRed.length === 0 && afterRed.length === 0) failures++;
      report(`  restored: ${restoredRed.length === 0 ? "PASS" : "RED"} — ${tally(restored)}`);
      for (const result of restoredRed) report(`  ${result.line}`);
      if (restoredRed.length > 0) failures++;
    }
  } finally {
    client.close();
  }

  report(
    failures === 0
      ? `\nALL FALSIFIED — every injection turned its claim red, and every page came back green`
      : `\n${failures} FALSIFICATION FAILURE(S)`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

const argv = process.argv.slice(2);
const [baseUrl = "http://127.0.0.1:3111"] = argv.filter((argument) => argument !== "--falsify");

if (argv.includes("--falsify")) {
  await falsify(baseUrl);
} else {
  await sweep(baseUrl);
}
