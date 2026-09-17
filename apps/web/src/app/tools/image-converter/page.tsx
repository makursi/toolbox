import { Container, Stack, Text, Title } from "@mantine/core";
import type { Metadata } from "next";

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
        <Title order={1}>{meta.title}</Title>
        <Text c="dimmed" maw={560}>
          {meta.description}
        </Text>
      </Stack>

      <ImageConverter />
    </Container>
  );
}
