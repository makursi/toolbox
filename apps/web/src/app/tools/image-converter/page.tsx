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
          other is global. The `←` is typography for now, like the arrow on the
          card, and becomes an icon with the rest of them (issue #14).
        */}
        <Link href="/" style={{ textDecoration: "none" }}>
          <Text className="quiet-link touch-target" size="sm">
            ← 返回首页
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
