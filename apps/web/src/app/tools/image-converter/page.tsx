import { Container, Stack, Text, Title } from "@mantine/core";
import type { Metadata } from "next";
import Link from "next/link";

import { shareMetadata } from "@/lib/site";
import { ImageConverter } from "@/tools/image-converter/ImageConverter";
import { meta } from "@/tools/image-converter/meta";

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  ...shareMetadata(meta.title, meta.description),
};

export default function ImageConverterPage() {
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

      <ImageConverter />
    </Container>
  );
}
