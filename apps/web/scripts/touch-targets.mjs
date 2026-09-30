#!/usr/bin/env node
/**
 * The touch-target probe: the hit area of every `.touch-target` control, measured
 * in a real browser.
 *
 * `apps/web/docs/design/components.md` wants a 44px touch target, and the pre-flight
 * checklist claims no clickable control is under it at 360 / 390 / 768 / 1024.
 * That is a claim about the *rendered* page, so nothing short of a browser can
 * make it: `.touch-target` declares 44x44 on a pseudo-element, and a declaration
 * is not a hit area. On a Mantine `Button` the declaration was there and the hit
 * area was the button's own box, because the root clipped the overlay with
 * `overflow: hidden` — that is issue #29, and this script is what sees it.
 *
 * The method, so that the numbers mean something: walk out from the control's
 * centre one pixel at a time, asking `elementFromPoint` at each step, and stop
 * when either side stops answering. A 44px overlay reads 43, because 44 whole
 * pixels hold 43 interior sample points. Requiring *both* sides is deliberate: it
 * also catches a target that grew into a neighbour, which is the other way this
 * fails.
 *
 * What it deliberately does not cover: anything that is not hit-testing — the
 * keyboard, focus order, the drawing. Those keep the one-off scripts and
 * `ui-fingerprint.mjs` (which answers "did anything move", not "is this big
 * enough"). The three controls the checklist needs a file for (清空 and a row's
 * remove cross, and the cover generator's 清除) get one through CDP, the
 * technique `apps/web/docs/design/log.md` already records.
 *
 * It grew two more claims, both about the rendered page and neither about a hit
 * area: every page names the controls it has to carry (#81 — a floor on the count
 * cannot tell 清除 from the ~50 icon rows that arrive on their own), and the cover
 * generator's canvas column has to sit on the side of the breakpoint its layout
 * rule names (#80 — an `order` swap moves what a visitor sees without moving the
 * DOM, resizing anything or overflowing).
 *
 * Usage — Chrome has to be running already, because launching it is the part that
 * differs per machine:
 *
 *   pnpm build && pnpm --filter @toolbox/web start -p 3111
 *   chrome --headless=new --remote-debugging-port=9333 --user-data-dir=<tmp dir>
 *   pnpm --filter @toolbox/web touch-targets [baseUrl]
 *
 * CI does that launching for you: the `Hit areas` step in `.github/workflows/ci.yml`
 * starts the server and the Chrome `@playwright/test` pins, on the build the gate
 * just drove — a threshold nobody runs is not a check (`apps/web/docs/design/log.md`
 * item 3, 2026-09-30).
 *
 * `CDP_PORT` overrides the debugging port. Exit code is 1 when a control probes
 * under 43, when a control the page should carry is missing, or on horizontal
 * overflow, so it gates a shell chain.
 */
import { fileURLToPath } from "node:url";

import { connect } from "./cdp.mjs";

/** The four widths the pre-flight checklist names. */
const WIDTHS = [360, 390, 768, 1024];

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
 * Both schemes: the toggle swaps a moon for a sun, and the two icons could differ
 * in size, which would move the control it sits in.
 */
const SCHEMES = ["light", "dark"];

/** Tall enough for the tool page to lay out; only the width is under test. */
const HEIGHT = 900;

/** The probe's resolution: a 44px span reads 43. */
const MIN = 43;

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
 * check (see `LAYOUT`).
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
    controls: ["切换到", "返回首页", "获取系统字体", "下载 16:9", "清除"],
    fileInput: ".mantine-Dropzone-root input[type=file]",
    layout: true,
    name: "cover",
    path: "/tools/cover-generator",
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
 */
const LABEL = `(el) => (el.getAttribute('aria-label') || el.innerText || '').replace(/\\s+/g, ' ').trim()`;

const MEASURE = `(() => {
  const label = ${LABEL};
  const hits = (el, x, y) => {
    const hit = document.elementFromPoint(x, y);
    return Boolean(hit) && (hit === el || el.contains(hit));
  };
  const span = (el, cx, cy, axis) => {
    let offset = 0;
    while (
      offset < 120 &&
      (axis === 'x'
        ? hits(el, cx - offset - 1, cy) && hits(el, cx + offset + 1, cy)
        : hits(el, cx, cy - offset - 1) && hits(el, cx, cy + offset + 1))
    ) {
      offset += 1;
    }
    return 2 * offset + 1;
  };
  const controls = [...document.querySelectorAll('.touch-target')].map((el) => {
    el.scrollIntoView({ block: 'center' });
    const rect = el.getBoundingClientRect();
    const cx = Math.round(rect.left + rect.width / 2);
    const cy = Math.round(rect.top + rect.height / 2);
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
 * The cover generator's two columns, and which side of the breakpoint it is on.
 *
 * A swap written with `order` moves what a visitor sees without moving the DOM,
 * resizing anything or overflowing: on 2026-09-30 the editor column was first and
 * 320px wide from 768 to 991 with the preview pushed below all of it, and every
 * measurement this script already made stayed green (#80). So the boxes are read
 * directly — where the canvas is relative to the editor, and how wide each one is.
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
  return JSON.stringify({
    canvas: box(canvas),
    direction: getComputedStyle(flex).flexDirection,
    editor: box(editor),
  });
})()`;

/** A check's whole output is its result, which is the one place a console is right. */
function report(line) {
  // oxlint-disable-next-line no-console -- see above.
  console.log(line);
}

async function navigate(client, url) {
  await client.send("Page.navigate", { url });
  // The page is prerendered, the hydrate has to finish before a click or a file
  // will be taken: the fingerprint waits the same 1800ms for the same reason.
  await new Promise((resolve) => setTimeout(resolve, 1800));
}

/**
 * Put a file into the page's file input. React does receive this: the input keeps
 * its own change event and CDP sets the files on it. See item 2 of `apps/web/docs/design/log.md` — headless Chrome can do this, and the claim that it could not was
 * a limitation of an older tool, not of the browser.
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
  // The row renders, then its thumbnail decodes into it; the cover generator reads
  // its background as a data: URL and only then renders 清除. Only geometry is
  // measured, so this only has to outlast the render.
  await new Promise((resolve) => setTimeout(resolve, 1200));
}

/**
 * Wait until the page carries every control it names, and let the name check
 * below report the one that never arrived. A control that appears a beat after a
 * file has been read would otherwise be measured as a control the page does not
 * have — the one failure this probe would report for the wrong reason.
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

async function probe(baseUrl) {
  const port = Number(process.env.CDP_PORT ?? 9333);
  const client = await connect(port);
  let failures = 0;

  try {
    for (const width of WIDTHS) {
      for (const scheme of SCHEMES) {
        await client.send("Emulation.setDeviceMetricsOverride", {
          width,
          height: HEIGHT,
          deviceScaleFactor: 1,
          mobile: width < 768,
        });
        await client.send("Emulation.setEmulatedMedia", {
          features: [{ name: "prefers-color-scheme", value: scheme }],
        });

        for (const page of PAGES) {
          await navigate(client, `${baseUrl}${page.path}`);
          if (page.fileInput !== undefined) {
            await addFile(client, page.fileInput);
          }
          await waitForControls(client, page.controls);

          const measured = JSON.parse(await client.evaluate(MEASURE));
          report(`\n${width}px ${scheme} — ${page.path}`);

          for (const name of page.controls) {
            const found = measured.controls.some((control) => control.label.includes(name));
            if (!found) failures++;
            report(`  ${found ? "PASS" : "FAIL"}  ${name}`);
          }

          if (page.layout === true) {
            const layout = JSON.parse(await client.evaluate(LAYOUT));
            if (layout.missing === true) {
              failures++;
              report("  FAIL  the cover generator's two columns are not on the page");
            } else {
              const narrow = width < NARROW_BELOW;
              const ok = narrow
                ? layout.canvas.top < layout.editor.top &&
                  Math.abs(layout.canvas.width - layout.editor.width) <= 1
                : layout.editor.left < layout.canvas.left &&
                  Math.abs(layout.canvas.top - layout.editor.top) <= 1;
              if (!ok) failures++;
              report(
                `  ${ok ? "PASS" : "FAIL"}  ${
                  narrow
                    ? "the canvas column comes before the editor's"
                    : "the editor and the canvas are side by side"
                } — editor ${layout.editor.width}px at ${layout.editor.left},${layout.editor.top}; canvas ${layout.canvas.width}px at ${layout.canvas.left},${layout.canvas.top}; the page's own direction is ${layout.direction}`,
              );
            }
          }

          if (measured.overflow > 0) {
            failures++;
            report(`  FAIL  horizontal overflow: ${measured.overflow}px`);
          }

          for (const control of measured.controls) {
            const ok = control.x >= MIN && control.y >= MIN;
            if (!ok) failures++;
            report(
              `  ${ok ? "PASS" : "FAIL"}  ${control.control} — drawn ${control.drawn}, declared ::after ${control.declared}, hit-testable ${control.x}x${control.y}`,
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

const [baseUrl = "http://127.0.0.1:3111"] = process.argv.slice(2);
await probe(baseUrl);
