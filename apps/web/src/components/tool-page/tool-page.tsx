import { Container, Stack, Text, Title } from "@mantine/core";
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
    <Container className="py-10 sm:py-16" size="md">
      <Stack className="reveal" gap="xs">
        {/*
          A way back that is not the browser's back button. The wordmark in the
          header goes home too, and that is on purpose: one is contextual, the
          other is global. The arrow is a Phosphor icon, like every other icon on
          the site; see `docs/adr/0009-phosphor-icons-through-iconify.md`.
        */}
        {/* `alignSelf` matters: the hero is a Stack, which stretches its children,
            so without it the anchor's hit box is the whole 960px row and a click
            far to the right of the words would navigate home. The arrow is
            decoration — the word 返回 already carries the meaning — so it is
            hidden from screen readers, as the card hides its own.
            `.touch-target` sits on the anchor and not on the `<p>` inside it: an
            overlay's clicks belong to the element it is generated on, and the rule
            (`apps/web/docs/design/components.md`) is that this is the element which owns
            the click. On a descendant it works only for as long as the click
            happens to bubble to an ancestor that handles it. The box is the same
            either way, because the anchor is a flex item sized by its content. */}
        <Link
          className="touch-target"
          href="/"
          style={{ alignSelf: "flex-start", textDecoration: "none" }}
        >
          <Text className="quiet-link" size="sm">
            <span aria-hidden className="icon mr-1 icon-[ph--arrow-left-bold]" />
            返回首页
          </Text>
        </Link>
        <Title order={1}>{meta.title}</Title>
        <Text c="dimmed" maw={560}>
          {meta.description}
        </Text>
      </Stack>

      {children}
    </Container>
  );
}
