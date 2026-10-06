import Image from "next/image";
import Link from "next/link";

import { toolPath } from "@/tools/registry";
import type { ToolMeta } from "@/tools/types";

/**
 * The homepage's card for one Tool: a cover it may not have, a title, one line
 * of description, and the whole card as one link.
 *
 * The card is the only place a Tool's cover is used, and the rules for its shape
 * are the design doc set's, not this file's — the 4:3 frame, the cover moving under
 * the text on a narrow screen, the hairline border, and the hover shadow that is
 * a deliberate part of the design rather than a missing style. What lives here is
 * the markup those rules describe.
 *
 * Drawn by the incoming layer since #163, with the outgoing layer's numbers read off
 * the built page: 20px of padding (the outgoing layer's `lg`, which is `1.25rem` and
 * not Tailwind's `lg`), an 8px container radius, a 20px gap between the cover and the
 * text, and the type on the leading the outgoing layer gave it — 20px/18px titles on
 * 1.55, a 16px description on 1.55, and the 打开 line at 14px on 1.45 with 10px above
 * it. The two flips happen at 768px, which is Tailwind's `md` and the outgoing
 * layer's `sm`; naming the same number twice is the point (`apps/web/docs/design/layout.md`).
 *
 * Two values are *not* the outgoing layer's, and both are corrections rather than
 * conversions. Its card was filled with the canvas token, so the card and the page
 * were the same colour and only the hairline separated them — `bg-background` keeps
 * exactly that. And its `withBorder` drew Mantine's own cool grey (measured
 * `rgb(222, 226, 230)` light, `rgb(66, 66, 66)` dark) rather than this site's warm
 * hairline, which is what the card rule always said it should be; `border-border`
 * is that token, so the stylesheet no longer disagrees with the rule.
 */
export function ToolCard({ tool }: { tool: ToolMeta }) {
  /*
   * The cover frame exists only when there is a cover to put in it. An earlier
   * version reserved the 4:3 frame unconditionally, which meant the card's most
   * prominent box held nothing and, because that box also carried an inline
   * `width: 100%`, squeezed the text into a sliver from 768px up (Mantine's `sm`
   * is 48em, not Tailwind's 640px). A Tool without artwork is set in type.
   *
   * The frame keeps its aspect ratio when it *is* rendered, so an arriving image
   * cannot shift the layout; what changes when a cover lands is the card's shape,
   * which is a deliberate revision rather than a load-time jump.
   */
  const text = (
    <div className="flex flex-col gap-2.5">
      {/* A notch larger on a phone: with the cover below the fold of the card
          rather than beside it, the title is the only thing doing the talking. */}
      <p
        className="text-[20px] leading-[1.55] font-medium md:text-[18px]"
        data-slot="tool-card-title"
      >
        {tool.title}
      </p>
      <p
        className="text-base leading-[1.55] text-muted-foreground"
        data-slot="tool-card-description"
      >
        {tool.description}
      </p>
      <p className="mt-2.5 text-sm leading-[1.45]">
        打开
        <span aria-hidden className="icon ml-1 icon-[ph--arrow-right-bold]" />
      </p>
    </div>
  );

  return (
    <Link className="text-foreground no-underline" href={toolPath(tool.slug)}>
      {/* The card, its frame and its two lines of copy are anchored for the
          fingerprint (#114): they are what it compares on this page, and an anchor
          is the one way to name them that survives a change of component layer. */}
      <div className="lift rounded-lg border border-border bg-background p-5" data-slot="tool-card">
        {tool.cover ? (
          /*
           * The cover sits beside the text on a wide screen and *under* it on a
           * phone. That order comes from one utility pair: the markup is
           * [cover, text], `flex-col-reverse` reads the text first on a narrow
           * screen, and `md:flex-row` puts the cover back on the left from 768 up.
           */
          <div className="flex flex-col-reverse gap-5 md:flex-row">
            {/* Width comes from the responsive utilities alone; the rest of the
                frame is `.cover-frame` in globals.css, and the radius is a utility
                so that the stylesheet holds no variable of a component library
                (see apps/web/docs/design/layout.md). */}
            <div className="cover-frame w-full rounded-md md:w-[220px]" data-slot="tool-card-cover">
              {/* Decorative: the card's text already names the Tool. */}
              <Image
                alt=""
                fill
                sizes="(min-width: 768px) 220px, 100vw"
                src={tool.cover}
                style={{ objectFit: "cover" }}
              />
            </div>

            {text}
          </div>
        ) : (
          text
        )}
      </div>
    </Link>
  );
}
