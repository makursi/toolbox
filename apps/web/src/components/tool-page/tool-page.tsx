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
 * A component rather than a route layout: `metadata` belongs to a page, and a
 * layout has no slug to look a Tool up by, so `app/tools/<slug>/layout.tsx`
 * cannot produce per-Tool metadata. Each Tool keeps its own explicit route
 * instead, and what that route would otherwise repeat lives here once.
 *
 * The registry stays data — `ToolMeta` has no component field — so importing it
 * does not pull a Tool's client code into the module graph; see ADR-0001.
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
            hidden from screen readers, as the card hides its own. */}
        <Link href="/" style={{ alignSelf: "flex-start", textDecoration: "none" }}>
          <Text className="quiet-link touch-target" size="sm">
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
