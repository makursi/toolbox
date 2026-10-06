import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { shareMetadata } from "@/lib/site";
import type { ToolMeta } from "@/tools/types";

/**
 * The shell every Tool page shares: the way back, the title, the one-line
 * description, and the page's metadata.
 *
 * A component rather than a route layout — not because a layout could not do the
 * job (`metadata` may live in a layout, and a dynamic one receives the slug
 * through `params`), but because that route shape renders a Tool by looking an
 * implementation up by slug. Each Tool keeps `app/tools/<slug>/page.tsx` of its
 * own instead, and the Tool Registry stays data: `ToolMeta` grows no component
 * field, so importing the registry cannot pull a Tool's client code into the
 * module graph (ADR-0001).
 */

/**
 * The metadata for a Tool page. A page that sets `title` and `description`
 * replaces the fields it inherits from the root layout whole, so the site name
 * would silently disappear from every share card; `shareMetadata` is that rule
 * in one place, and this is the one place a Tool page reaches it.
 */
export function toolMetadata(meta: ToolMeta): Metadata {
  return {
    title: meta.title,
    description: meta.description,
    ...shareMetadata(meta.title, meta.description),
  };
}

export function ToolPage({ meta, children }: { meta: ToolMeta; children: ReactNode }) {
  return (
    /*
     * The shell in the incoming layer (#132). It is a *shared* component, so this
     * moves the other Tool page's shell with it — a shared thing cannot be half
     * migrated, and the alternative would be two shells disagreeing about one page
     * frame. What does not move is the other page's Tool.
     *
     * Every number here was read off the outgoing layer before it was replaced, with
     * one probe against the built page, rather than converted by eye: the container
     * is Mantine's `md` (960px with 16px of inline padding), the stack's gap is its
     * `xs` (10px — Mantine's scale is not Tailwind's, `xs` is `0.625rem`), the h1 is
     * 34px on a 1.3 line, the back link is 14px on Mantine's 1.45 for `Text`, and
     * the description is 16px on 1.55 with a 560px measure. Those are the values the
     * fingerprint's `tool-page` box is made of, so a swap that moved one of them
     * would show up as a page that grew.
     */
    <div className="mx-auto w-full max-w-[960px] px-4 py-10 sm:py-16" data-slot="tool-page">
      <div className="reveal flex flex-col gap-2.5">
        {/*
          A way back that is not the browser's back button. The wordmark in the
          header goes home too, and that is on purpose: one is contextual, the
          other is global. The arrow is a Phosphor icon, like every other icon on
          the site; see `docs/adr/0009-phosphor-icons-through-iconify.md`.
        */}
        {/* `self-start` matters: the shell is a flex column, which stretches its
            children, so without it the anchor's hit box is the whole 960px row and a
            click far to the right of the words would navigate home. The arrow is
            decoration — the word 返回 already carries the meaning — so it is hidden
            from screen readers, as the card hides its own. `.touch-target` sits on
            the anchor and not on the text inside it: an overlay's clicks belong to
            the element it is generated on, and the rule
            (`apps/web/docs/design/components.md`) is that this is the element which owns
            the click. The box is the same either way, because the anchor is a flex
            item sized by its content. */}
        <Link className="touch-target self-start no-underline" href="/">
          <span className="quiet-link block text-sm leading-[1.45]">
            <span aria-hidden className="icon mr-1 icon-[ph--arrow-left-bold]" />
            返回首页
          </span>
        </Link>
        <h1 className="text-[34px] leading-[1.3] font-semibold">{meta.title}</h1>
        <p className="max-w-[560px] text-base leading-[1.55] text-muted-foreground">
          {meta.description}
        </p>
      </div>

      {children}
    </div>
  );
}
